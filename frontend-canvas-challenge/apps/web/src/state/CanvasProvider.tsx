import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from '@xyflow/react';
import type { GenerationData, SpaceData } from '@canvas/contracts';
import { api, isApiClientError, NetworkError, reportError, userMessage, type Config } from '@/api';
import {
  attachViews,
  canConnect,
  chainReady,
  DEFAULT_GENERATOR_LABEL,
  DEFAULT_RESULT_LABEL,
  fromApiGraph,
  indexEdges,
  indexNodes,
  placeNode,
  pruneEdges,
  pruneResultViews,
  toApiGraph,
  type CanvasEdge,
  type CanvasNode,
} from '@/lib/graph';
import {
  mayApplyGeneration,
  toResultView,
  viewsFromGenerations,
  waitForGeneration,
  graphsEqual,
} from '@/lib/generation';
import { edgeChangesPersist, nodeChangesPersist } from '@/lib/persist';
import { SaveQueue, type SaveStatus } from '@/lib/save-queue';
import {
  completeIdempotencyKey,
  expireIdempotencyKey,
  takeIdempotencyKey,
  writeJson,
} from '@/lib/storage';
import { updateAt } from '@/lib/update';

const FALLBACK_CONFIG: Config = {
  debounceMs: 500,
  pollIntervalMs: 500,
  generationDelayMs: 1500,
  maxNodes: 20,
  maxEdges: 20,
  nodeTypes: ['prompt', 'generator', 'result'],
  links: {},
};

type CanvasState = {
  ready: boolean;
  loadError: string | null;
  space: SpaceData | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport;
  saveStatus: SaveStatus;
  notice: string | null;
  noticeTone: 'error' | 'wait' | 'ok' | 'info';
  flowKey: number;
  config: Config;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  isValidConnection: (connection: Connection | CanvasEdge) => boolean;
  onMoveEnd: (viewport: Viewport) => void;
  updatePrompt: (id: string, text: string) => void;
  addNode: (type: CanvasNode['type']) => void;
  removeSelected: () => void;
  generate: (nodeId: string, scenario: 'success' | 'failure') => Promise<void>;
  reloadServerGraph: () => Promise<void>;
};

const CanvasContext = createContext<CanvasState | null>(null);
const PromptUiContext = createContext<{ updatePrompt: (id: string, text: string) => void } | null>(
  null,
);
const GeneratorUiContext = createContext<{
  generate: (nodeId: string, scenario: 'success' | 'failure') => Promise<void>;
  saveStatus: SaveStatus;
} | null>(null);

export function useCanvas(): CanvasState {
  const value = useContext(CanvasContext);
  if (!value) throw new Error('useCanvas outside CanvasProvider');
  return value;
}

export function usePromptUi() {
  const value = useContext(PromptUiContext);
  if (!value) throw new Error('usePromptUi outside CanvasProvider');
  return value;
}

export function useGeneratorUi() {
  const value = useContext(GeneratorUiContext);
  if (!value) throw new Error('useGeneratorUi outside CanvasProvider');
  return value;
}

export function CanvasProvider({ spaceId, children }: { spaceId: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<CanvasState['noticeTone']>('info');
  const [flowKey, setFlowKey] = useState(0);
  const [config, setConfig] = useState<Config>(FALLBACK_CONFIG);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const viewportRef = useRef(viewport);
  const etagRef = useRef<string | undefined>(undefined);
  const epochRef = useRef(0);
  const saveStatusRef = useRef(saveStatus);
  const configRef = useRef(config);
  const busyRef = useRef<Record<string, boolean>>({});
  const queueRef = useRef<SaveQueue | null>(null);
  const runRef = useRef(new Map<string, number>());
  const pollsRef = useRef(new Map<string, AbortController>());
  const persistRef = useRef<() => Promise<void>>(async () => undefined);
  const skipMoveRef = useRef(true);

  nodesRef.current = nodes;
  edgesRef.current = edges;
  viewportRef.current = viewport;
  saveStatusRef.current = saveStatus;
  configRef.current = config;

  const nodeById = useMemo(() => indexNodes(nodes), [nodes]);
  const edgeIndex = useMemo(() => indexEdges(edges), [edges]);
  const nodeByIdRef = useRef(nodeById);
  const edgeIndexRef = useRef(edgeIndex);
  nodeByIdRef.current = nodeById;
  edgeIndexRef.current = edgeIndex;

  const showNotice = useCallback((message: string, tone: CanvasState['noticeTone'] = 'error') => {
    setNotice(message);
    setNoticeTone(tone);
  }, []);

  const abortPolls = useCallback(() => {
    pollsRef.current.forEach((controller) => controller.abort());
    pollsRef.current.clear();
  }, []);

  const setGeneratorBusy = useCallback((nodeId: string, busy: boolean) => {
    busyRef.current[nodeId] = busy;
    setNodes((current) =>
      updateAt(current, nodeId, (node) => {
        if (node.type !== 'generator') return node;
        if (Boolean(node.data.busy) === busy) return node;
        return { ...node, data: { label: node.data.label, busy: busy || undefined } };
      }),
    );
  }, []);

  const applyGeneration = useCallback((generation: GenerationData, run: number) => {
    if (runRef.current.get(generation.nodeId) !== run) return;
    setNodes((current) => {
      if (runRef.current.get(generation.nodeId) !== run) return current;
      if (!mayApplyGeneration(generation, current, edgesRef.current)) {
        return pruneResultViews(current, edgesRef.current);
      }
      return updateAt(current, generation.resultNodeId, (node) => {
        if (node.type !== 'result') return node;
        const view = toResultView(generation);
        const prev = node.data.view;
        if (
          prev &&
          prev.generationId === view.generationId &&
          prev.status === view.status &&
          prev.imageUrl === view.imageUrl
        ) {
          return node;
        }
        return { ...node, data: { ...node.data, view } };
      });
    });
  }, []);

  const watchGeneration = useCallback(
    async (generation: GenerationData, run: number, firstDelayMs: number) => {
      pollsRef.current.get(generation.nodeId)?.abort();
      const controller = new AbortController();
      pollsRef.current.set(generation.nodeId, controller);
      applyGeneration(generation, run);
      if (generation.status !== 'processing') return generation;
      try {
        const done = await waitForGeneration(
          spaceId,
          generation.id,
          configRef.current.pollIntervalMs,
          firstDelayMs,
          controller.signal,
        );
        applyGeneration(done, run);
        return done;
      } catch (error) {
        reportError(error, showNotice);
        return undefined;
      }
    },
    [applyGeneration, showNotice, spaceId],
  );

  const persist = useCallback(async () => {
    const snapshot = toApiGraph(nodesRef.current, edgesRef.current, viewportRef.current);
    const sentEpoch = epochRef.current;
    const etag = etagRef.current;
    if (!etag) throw new Error('Не передан ETag графа. Перечитайте канвас и сохраните снова.');
    setSaveStatus('saving');
    try {
      const result = await api.saveGraph(spaceId, snapshot, etag);
      if (result.etag) etagRef.current = result.etag;
      if (epochRef.current === sentEpoch) setSaveStatus('saved');
      else setSaveStatus('dirty');
    } catch (error) {
      if (isApiClientError(error) && error.code === 'GRAPH_VERSION_CONFLICT') {
        queueRef.current?.pause();
        setSaveStatus('conflict');
        showNotice(error.message, 'error');
        throw error;
      }
      if (error instanceof NetworkError || isApiClientError(error)) {
        try {
          const fresh = await api.graph(spaceId);
          if (fresh.etag && fresh.data && graphsEqual(fresh.data, snapshot)) {
            etagRef.current = fresh.etag;
            if (epochRef.current === sentEpoch) setSaveStatus('saved');
            else setSaveStatus('dirty');
            return;
          }
          const local = toApiGraph(nodesRef.current, edgesRef.current, viewportRef.current);
          if (fresh.etag && fresh.data && graphsEqual(fresh.data, local)) {
            etagRef.current = fresh.etag;
            setSaveStatus('saved');
            return;
          }
        } catch {
          /* ignore GET after a failed PUT */
        }
      }
      setSaveStatus('error');
      showNotice(userMessage(error), 'error');
      throw error;
    }
  }, [showNotice, spaceId]);

  persistRef.current = persist;

  const markDirty = useCallback(() => {
    epochRef.current += 1;
    queueRef.current?.bump();
  }, []);

  const hydrate = useCallback(
    (
      graph: Awaited<ReturnType<typeof api.graph>>,
      generations: GenerationData[],
      nextSpace: SpaceData,
      nextConfig: Config,
    ) => {
      if (!graph.data || !graph.etag) {
        throw new Error('Не передан ETag графа. Перечитайте канвас и сохраните снова.');
      }
      const parsed = fromApiGraph(graph.data);
      etagRef.current = graph.etag;
      epochRef.current = 0;
      setSpace(nextSpace);
      setConfig(nextConfig);
      setEdges(parsed.edges);
      setViewport(parsed.viewport);
      setSaveStatus('saved');
      setLoadError(null);
      const restored = viewsFromGenerations(generations, parsed.nodes, parsed.edges);
      let nextNodes = attachViews(parsed.nodes, restored.views);
      abortPolls();
      const seenKeys = new Set<string>();
      for (let i = 0; i < generations.length; i++) {
        const generation = generations[i];
        if (seenKeys.has(generation.nodeId)) continue;
        seenKeys.add(generation.nodeId);
        if (generation.status !== 'processing') {
          expireIdempotencyKey(`idem.${nextSpace.id}.${generation.nodeId}`);
        }
      }
      for (let i = 0; i < restored.processing.length; i++) {
        const generation = restored.processing[i];
        busyRef.current[generation.nodeId] = true;
        nextNodes = updateAt(nextNodes, generation.nodeId, (node) =>
          node.type === 'generator' ? { ...node, data: { ...node.data, busy: true } } : node,
        );
        const run = (runRef.current.get(generation.nodeId) ?? 0) + 1;
        runRef.current.set(generation.nodeId, run);
        void watchGeneration(generation, run, 0).finally(() => {
          setGeneratorBusy(generation.nodeId, false);
        });
      }
      setNodes(nextNodes);
      skipMoveRef.current = true;
      setFlowKey((key) => key + 1);
    },
    [abortPolls, setGeneratorBusy, watchGeneration],
  );

  useEffect(() => {
    writeJson('lastSpaceId', spaceId);
    const queue = new SaveQueue(
      () => persistRef.current(),
      () => setSaveStatus('dirty'),
    );
    queueRef.current = queue;
    const boot = new AbortController();
    setReady(false);
    setLoadError(null);
    void (async () => {
      try {
        const [configRes, spaceRes, graphRes, gensRes] = await Promise.all([
          api.config(boot.signal),
          api.space(spaceId, boot.signal),
          api.graph(spaceId, boot.signal),
          api.generations(spaceId, boot.signal),
        ]);
        if (boot.signal.aborted) return;
        queue.debounceMs = configRes.data.debounceMs;
        hydrate(graphRes, gensRes.data, spaceRes.data, configRes.data);
        setReady(true);
      } catch (error) {
        reportError(error, setLoadError);
        setReady(true);
      }
    })();
    return () => {
      boot.abort();
      abortPolls();
      queue.dispose();
      queueRef.current = null;
    };
  }, [abortPolls, hydrate, spaceId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removed = changes.some((change) => change.type === 'remove');
      setNodes((current) => {
        let next = applyNodeChanges(changes, current) as CanvasNode[];
        if (removed) {
          const nextEdges = pruneEdges(next, edgesRef.current);
          setEdges(nextEdges);
          next = pruneResultViews(next, nextEdges);
        }
        return next;
      });
      if (nodeChangesPersist(changes)) markDirty();
    },
    [markDirty],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
  const persist = edgeChangesPersist(changes);
  setEdges((current) => {
    const next = applyEdgeChanges(changes, current);
    if (persist) {
      setNodes((currentNodes) => pruneResultViews(currentNodes, next));
    }
    return next;
  });
  if (persist) markDirty();
    },
    [markDirty],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canConnect(connection, nodeByIdRef.current, edgeIndexRef.current)) return;
      if (edgesRef.current.length >= configRef.current.maxEdges) {
        showNotice(`Можно сохранить не больше ${configRef.current.maxEdges} связей.`, 'error');
        return;
      }
      setEdges((current) => {
        const next = addEdge(
          { id: crypto.randomUUID(), source: connection.source, target: connection.target },
          current,
        );
        setNodes((currentNodes) => pruneResultViews(currentNodes, next));
        return next;
      });
      markDirty();
    },
    [markDirty, showNotice],
  );

  const isValidConnection = useCallback(
    (connection: Connection | CanvasEdge) =>
      canConnect(connection, nodeByIdRef.current, edgeIndexRef.current),
    [],
  );

  const onMoveEnd = useCallback(
    (next: Viewport) => {
      if (skipMoveRef.current) {
        skipMoveRef.current = false;
        setViewport(next);
        return;
      }
      const prev = viewportRef.current;
      if (prev.x === next.x && prev.y === next.y && prev.zoom === next.zoom) return;
      setViewport(next);
      markDirty();
    },
    [markDirty],
  );

  const updatePrompt = useCallback(
    (id: string, text: string) => {
      setNodes((current) =>
        updateAt(current, id, (node) =>
          node.type === 'prompt' ? { ...node, data: { text } } : node,
        ),
      );
      markDirty();
    },
    [markDirty],
  );

  const addNode = useCallback(
    (type: CanvasNode['type']) => {
      if (nodesRef.current.length >= configRef.current.maxNodes) {
        showNotice(`Можно сохранить не больше ${configRef.current.maxNodes} нод.`, 'error');
        return;
      }
      const id = crypto.randomUUID();
      const position = placeNode(nodesRef.current, type);
      const node: CanvasNode =
        type === 'prompt'
          ? { id, type, position, data: { text: '' } }
          : type === 'generator'
            ? { id, type, position, data: { label: DEFAULT_GENERATOR_LABEL } }
            : { id, type, position, data: { label: DEFAULT_RESULT_LABEL } };
      setNodes((current) => current.concat(node));
      markDirty();
    },
    [markDirty, showNotice],
  );

  const removeSelected = useCallback(() => {
    const current = nodesRef.current;
    const kept: CanvasNode[] = [];
    let removed = false;
    for (let i = 0; i < current.length; i++) {
      if (current[i].selected) {
        removed = true;
        continue;
      }
      kept.push(current[i]);
    }
    if (!removed) return;
    const nextEdges = pruneEdges(kept, edgesRef.current);
    setNodes(pruneResultViews(kept, nextEdges));
    setEdges(nextEdges);
    markDirty();
  }, [markDirty]);

  const generate = useCallback(
    async (nodeId: string, scenario: 'success' | 'failure') => {
      if (busyRef.current[nodeId]) return;
      setGeneratorBusy(nodeId, true);
      const keyStorage = `idem.${spaceId}.${nodeId}`;
      try {
        try {
          await queueRef.current?.flush();
        } catch {
          return;
        }
        const status = saveStatusRef.current;
        if (status === 'conflict' || status === 'error') return;
        if (status === 'dirty' || status === 'saving') {
          try {
            await queueRef.current?.flush();
          } catch {
            return;
          }
        }
        if (saveStatusRef.current !== 'saved') {
          showNotice('Дождитесь сохранения графа, затем запустите генерацию.', 'error');
          return;
        }
        if (!chainReady(nodeId, nodeByIdRef.current, edgesRef.current)) {
          showNotice('Соедините непустой текст, генератор и результат.', 'error');
          return;
        }
        const graphETag = etagRef.current;
        if (!graphETag) {
          showNotice('Не передан ETag графа. Перечитайте канвас и сохраните снова.', 'error');
          return;
        }
        const run = (runRef.current.get(nodeId) ?? 0) + 1;
        runRef.current.set(nodeId, run);
        const fingerprint = `${nodeId}|${graphETag}|${scenario}`;
        const key = takeIdempotencyKey(keyStorage, fingerprint);
        const result = await api.createGeneration(spaceId, { nodeId, graphETag, scenario }, key);
        if (runRef.current.get(nodeId) !== run) return;
        const done = await watchGeneration(result.data, run, (result.retryAfterSec ?? 0) * 1000);
        if (done && done.status !== 'processing') completeIdempotencyKey(keyStorage, fingerprint);
      } catch (error) {
        if (isApiClientError(error) && error.code === 'IDEMPOTENCY_CONFLICT') {
          expireIdempotencyKey(keyStorage);
        }
        reportError(error, showNotice);
      } finally {
        setGeneratorBusy(nodeId, false);
      }
    },
    [setGeneratorBusy, showNotice, spaceId, watchGeneration],
  );

  const reloadServerGraph = useCallback(async () => {
    abortPolls();
    queueRef.current?.reset();
    const [spaceRes, graphRes, gensRes] = await Promise.all([
      api.space(spaceId),
      api.graph(spaceId),
      api.generations(spaceId),
    ]);
    hydrate(graphRes, gensRes.data, spaceRes.data, configRef.current);
    setNotice(null);
  }, [abortPolls, hydrate, spaceId]);

  const value = useMemo<CanvasState>(
    () => ({
      ready,
      loadError,
      space,
      nodes,
      edges,
      viewport,
      saveStatus,
      notice,
      noticeTone,
      flowKey,
      config,
      onNodesChange,
      onEdgesChange,
      onConnect,
      isValidConnection,
      onMoveEnd,
      updatePrompt,
      addNode,
      removeSelected,
      generate,
      reloadServerGraph,
    }),
    [
      addNode,
      config,
      edges,
      flowKey,
      generate,
      isValidConnection,
      loadError,
      nodes,
      notice,
      noticeTone,
      onConnect,
      onEdgesChange,
      onMoveEnd,
      onNodesChange,
      ready,
      reloadServerGraph,
      removeSelected,
      saveStatus,
      space,
      updatePrompt,
      viewport,
    ],
  );

  const promptUi = useMemo(() => ({ updatePrompt }), [updatePrompt]);
  const generatorUi = useMemo(
    () => ({ generate, saveStatus }),
    [generate, saveStatus],
  );

  return (
    <CanvasContext.Provider value={value}>
      <PromptUiContext.Provider value={promptUi}>
        <GeneratorUiContext.Provider value={generatorUi}>{children}</GeneratorUiContext.Provider>
      </PromptUiContext.Provider>
    </CanvasContext.Provider>
  );
}
