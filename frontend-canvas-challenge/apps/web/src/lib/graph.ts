import type { GraphData, NodeData } from '@canvas/contracts';
import type { Connection, Edge, Node, Viewport } from '@xyflow/react';

export type ResultView = {
  generationId: string;
  generatorId: string;
  status: 'processing' | 'succeeded' | 'failed';
  imageUrl: string | null;
  failureCode: string | null;
};

export type PromptNode = Node<{ text: string }, 'prompt'>;
export type GeneratorNode = Node<{ label: string; busy?: boolean }, 'generator'>;
export type ResultNode = Node<{ label: string; view?: ResultView }, 'result'>;
export type CanvasNode = PromptNode | GeneratorNode | ResultNode;
export type CanvasEdge = Edge;

export const DEFAULT_GENERATOR_LABEL = 'Генератор';
export const DEFAULT_RESULT_LABEL = 'Результат';

export type EdgeIndex = {
  incoming: Set<string>;
  generatorOut: Set<string>;
};

/** Prompt may fan out; generator and each input may not. */
export function indexEdges(edges: readonly { source: string; target: string }[]): EdgeIndex {
  const incoming = new Set<string>();
  const generatorOut = new Set<string>();
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    incoming.add(edge.target);
    generatorOut.add(edge.source);
  }
  return { incoming, generatorOut };
}

export function indexNodes(nodes: readonly CanvasNode[]): Map<string, CanvasNode> {
  const map = new Map<string, CanvasNode>();
  for (let i = 0; i < nodes.length; i++) map.set(nodes[i].id, nodes[i]);
  return map;
}

export function canConnect(
  connection: Pick<Connection, 'source' | 'target'>,
  nodeById: Map<string, CanvasNode>,
  index: EdgeIndex,
): boolean {
  if (!connection.source || !connection.target) return false;
  const source = nodeById.get(connection.source);
  const target = nodeById.get(connection.target);
  if (!source || !target) return false;
  const allowed =
    (source.type === 'prompt' && target.type === 'generator') ||
    (source.type === 'generator' && target.type === 'result');
  if (!allowed) return false;
  if (index.incoming.has(target.id)) return false;
  if (source.type === 'generator' && index.generatorOut.has(source.id)) return false;
  return true;
}

export function toApiGraph(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  viewport: Viewport,
): GraphData {
  const apiNodes: NodeData[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'prompt') {
      apiNodes.push({
        id: node.id,
        type: 'prompt',
        position: node.position,
        data: { text: node.data.text },
      });
    } else if (node.type === 'generator') {
      apiNodes.push({
        id: node.id,
        type: 'generator',
        position: node.position,
        data: { label: node.data.label },
      });
    } else if (node.type === 'result') {
      apiNodes.push({
        id: node.id,
        type: 'result',
        position: node.position,
        data: { label: node.data.label },
      });
    }
  }
  const apiEdges: GraphData['edges'] = [];
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    apiEdges.push({ id: edge.id, source: edge.source, target: edge.target });
  }
  return {
    nodes: apiNodes,
    edges: apiEdges,
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
  };
}

export function fromApiGraph(graph: GraphData): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport;
} {
  const nodes: CanvasNode[] = [];
  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i];
    if (node.type === 'prompt') {
      nodes.push({
        id: node.id,
        type: 'prompt',
        position: node.position,
        data: { text: node.data.text },
      });
    } else if (node.type === 'generator') {
      nodes.push({
        id: node.id,
        type: 'generator',
        position: node.position,
        data: { label: node.data.label },
      });
    } else {
      nodes.push({
        id: node.id,
        type: 'result',
        position: node.position,
        data: { label: node.data.label },
      });
    }
  }
  const edges: CanvasEdge[] = [];
  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i];
    edges.push({ id: edge.id, source: edge.source, target: edge.target });
  }
  return { nodes, edges, viewport: graph.viewport };
}

export function pruneEdges(nodes: readonly CanvasNode[], edges: CanvasEdge[]): CanvasEdge[] {
  const ids = new Set<string>();
  for (let i = 0; i < nodes.length; i++) ids.add(nodes[i].id);
  let needsPrune = false;
  for (let i = 0; i < edges.length; i++) {
    if (!ids.has(edges[i].source) || !ids.has(edges[i].target)) {
      needsPrune = true;
      break;
    }
  }
  if (!needsPrune) return edges;
  const next: CanvasEdge[] = [];
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (ids.has(edge.source) && ids.has(edge.target)) next.push(edge);
  }
  return next;
}

export function findPromptForGenerator(
  generatorId: string,
  nodeById: Map<string, CanvasNode>,
  edges: readonly CanvasEdge[],
): PromptNode | undefined {
  for (let i = 0; i < edges.length; i++) {
    if (edges[i].target !== generatorId) continue;
    const node = nodeById.get(edges[i].source);
    if (node?.type === 'prompt') return node;
  }
  return undefined;
}

export function findResultForGenerator(
  generatorId: string,
  edges: readonly CanvasEdge[],
): string | undefined {
  for (let i = 0; i < edges.length; i++) {
    if (edges[i].source === generatorId) return edges[i].target;
  }
  return undefined;
}

/** Clear preview when the generator→result edge is gone. */
export function pruneResultViews(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
): CanvasNode[] {
  let next: CanvasNode[] | null = null;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type !== 'result' || !node.data.view) continue;
    if (findResultForGenerator(node.data.view.generatorId, edges) === node.id) continue;
    if (!next) next = nodes.slice();
    next[i] = { ...node, data: { label: node.data.label } };
  }
  return next ?? (nodes as CanvasNode[]);
}

export function attachViews(nodes: CanvasNode[], views: Map<string, ResultView>): CanvasNode[] {
  if (views.size === 0) return nodes;
  let changed = false;
  const next = nodes.slice();
  for (let i = 0; i < next.length; i++) {
    const node = next[i];
    if (node.type !== 'result') continue;
    const view = views.get(node.id);
    if (!view) continue;
    next[i] = { ...node, data: { ...node.data, view } };
    changed = true;
  }
  return changed ? next : nodes;
}

export function chainReady(
  generatorId: string,
  nodeById: Map<string, CanvasNode>,
  edges: readonly CanvasEdge[],
): boolean {
  const prompt = findPromptForGenerator(generatorId, nodeById, edges);
  const resultId = findResultForGenerator(generatorId, edges);
  return Boolean(prompt && resultId && prompt.data.text.trim());
}

export function placeNode(
  nodes: readonly CanvasNode[],
  type: CanvasNode['type'],
): { x: number; y: number } {
  const col = type === 'prompt' ? 0 : type === 'generator' ? 1 : 2;
  let row = 0;
  for (let i = 0; i < nodes.length; i++) if (nodes[i].type === type) row += 1;
  return { x: 48 + col * 300, y: 48 + row * 168 };
}
