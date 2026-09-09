import type { GraphData, GenerationData } from '@canvas/contracts';
import { api, apiBaseUrl } from '@/api';
import type { CanvasEdge, CanvasNode, ResultView } from './graph';
import { findResultForGenerator, indexNodes } from './graph';
import { pollUntil } from './poll';

export function graphsEqual(a: GraphData, b: GraphData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function assetUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${apiBaseUrl}${path}`;
}

export function toResultView(generation: GenerationData): ResultView {
  return {
    generationId: generation.id,
    generatorId: generation.nodeId,
    status: generation.status,
    imageUrl: assetUrl(generation.imageUrl),
    failureCode: generation.failureCode,
  };
}

/** Newest first. Skip if the result is no longer wired to that generator. */
export function viewsFromGenerations(
  generations: readonly GenerationData[],
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
): { views: Map<string, ResultView>; processing: GenerationData[] } {
  const nodeById = indexNodes(nodes);
  const views = new Map<string, ResultView>();
  const processing: GenerationData[] = [];
  for (let i = 0; i < generations.length; i++) {
    const generation = generations[i];
    if (views.has(generation.resultNodeId)) continue;
    if (!nodeById.has(generation.resultNodeId)) continue;
    if (findResultForGenerator(generation.nodeId, edges) !== generation.resultNodeId) continue;
    views.set(generation.resultNodeId, toResultView(generation));
    if (generation.status === 'processing') processing.push(generation);
  }
  return { views, processing };
}

export function mayApplyGeneration(
  generation: GenerationData,
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
): boolean {
  const nodeById = indexNodes(nodes);
  if (!nodeById.has(generation.resultNodeId)) return false;
  return findResultForGenerator(generation.nodeId, edges) === generation.resultNodeId;
}

export function waitForGeneration(
  spaceId: string,
  generationId: string,
  intervalMs: number,
  firstDelayMs: number,
  signal: AbortSignal,
): Promise<GenerationData> {
  return pollUntil(
    async (next) => (await api.generation(spaceId, generationId, next)).data,
    (generation) => generation.status !== 'processing',
    signal,
    intervalMs,
    firstDelayMs,
  );
}
