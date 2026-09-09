import type { Static } from '@sinclair/typebox';
import { Config as ConfigSchema } from '@canvas/contracts';
import type { GraphData, GenerationData, GenerationRequest, SpaceData } from '@canvas/contracts';
import { mapError } from './errors';
import { send } from './http';
import { header, ParseError, readPayload, retryAfterSeconds } from './parse';
import type { HttpRequest } from './config';

export type Config = Static<typeof ConfigSchema>;

/** Body + headers. Canvas API has no `{ data }` wrapper. */
export type ApiResult<T> = {
  data: T;
  status: number;
  etag?: string;
  location?: string | null;
  retryAfterSec?: number;
};

async function request(init: HttpRequest): Promise<ApiResult<undefined>>;
async function request<T>(init: HttpRequest): Promise<ApiResult<T>>;
async function request<T>(init: HttpRequest): Promise<ApiResult<T | undefined>> {
  const response = await send(init);
  const payload = await readPayload(response);
  if (response.status === 304) {
    return {
      data: undefined,
      status: 304,
      etag: header(response, 'ETag') ?? undefined,
      location: header(response, 'Location'),
      retryAfterSec: retryAfterSeconds(response),
    };
  }
  if (!response.ok) {
    throw mapError(response.status, payload, header(response, 'X-Request-Id'));
  }
  if (payload === undefined) {
    throw new ParseError('Пустой ответ сервера.');
  }
  return {
    data: payload as T,
    status: response.status,
    etag: header(response, 'ETag') ?? undefined,
    location: header(response, 'Location'),
    retryAfterSec: retryAfterSeconds(response),
  };
}

export const api = {
  config: (signal?: AbortSignal) => request<Config>({ method: 'GET', path: '/api/config', signal }),
  spaces: (signal?: AbortSignal) =>
    request<SpaceData[]>({ method: 'GET', path: '/api/spaces', signal }),
  createSpace: (title: string) =>
    request<SpaceData>({ method: 'POST', path: '/api/spaces', body: { title } }),
  space: (spaceId: string, signal?: AbortSignal) =>
    request<SpaceData>({ method: 'GET', path: `/api/spaces/${spaceId}`, signal }),
  graph: (spaceId: string, signal?: AbortSignal) =>
    request<GraphData>({ method: 'GET', path: `/api/spaces/${spaceId}/graph`, signal }),
  saveGraph: (spaceId: string, graph: GraphData, etag: string) =>
    request<GraphData>({
      method: 'PUT',
      path: `/api/spaces/${spaceId}/graph`,
      body: graph,
      ifMatch: etag,
    }),
  generations: (spaceId: string, signal?: AbortSignal) =>
    request<GenerationData[]>({
      method: 'GET',
      path: `/api/spaces/${spaceId}/generations`,
      signal,
    }),
  createGeneration: (
    spaceId: string,
    body: GenerationRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ) =>
    request<GenerationData>({
      method: 'POST',
      path: `/api/spaces/${spaceId}/generations`,
      body,
      idempotencyKey,
      signal,
    }),
  generation: (spaceId: string, generationId: string, signal?: AbortSignal) =>
    request<GenerationData>({
      method: 'GET',
      path: `/api/spaces/${spaceId}/generations/${generationId}`,
      signal,
    }),
};
