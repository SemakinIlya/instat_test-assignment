import { mapError } from './errors';
import { send } from './http';
import { ParseError, readPayload, retryAfterSeconds, unwrapData } from './parse';
import type { HttpRequest } from './config';
import type {
  Cart,
  CartItem,
  CheckoutOptions,
  CreateOrder,
  Order,
  Payment,
  Product,
  Quote,
  QuoteBody,
  Sandbox,
  Scenario,
  Session,
  SetCartItemBody,
  Simulation,
} from './types';

let currentToken: string | null = null;

/** Bearer token for all calls after boot. */
export function setAccessToken(token: string | null): void {
  currentToken = token;
}

export function getAccessToken(): string | null {
  return currentToken;
}

export type Envelope<T> = {
  data: T;
  status: number;
  retryAfterSec?: number;
};

async function request(init: Omit<HttpRequest, 'token'>): Promise<Envelope<undefined>>;
async function request<T>(init: Omit<HttpRequest, 'token'>): Promise<Envelope<T>>;
async function request<T>(init: Omit<HttpRequest, 'token'>): Promise<Envelope<T | undefined>> {
  const response = await send({ ...init, token: currentToken });
  const payload = await readPayload(response);
  if (!response.ok) throw mapError(response.status, payload);
  if (payload === undefined) {
    if (response.status === 204 || response.status === 304) {
      return { data: undefined, status: response.status, retryAfterSec: retryAfterSeconds(response) };
    }
    throw new ParseError('Пустой ответ сервера.');
  }
  return {
    data: unwrapData<T>(payload),
    status: response.status,
    retryAfterSec: retryAfterSeconds(response),
  };
}

export const api = {
  createSession: () => request<Session>({ method: 'POST', path: '/api/sessions', body: {} }),
  products: () => request<Product[]>({ method: 'GET', path: '/api/products' }),
  sandbox: (signal?: AbortSignal) => request<Sandbox>({ method: 'GET', path: '/api/sandbox', signal }),
  cart: (signal?: AbortSignal) => request<Cart>({ method: 'GET', path: '/api/cart', signal }),
  setCartItem: (productId: string, body: SetCartItemBody) =>
    request<CartItem>({ method: 'PUT', path: `/api/cart/items/${productId}`, body }),
  removeCartItem: (productId: string) =>
    request({ method: 'DELETE', path: `/api/cart/items/${productId}` }),
  checkoutOptions: (signal?: AbortSignal) =>
    request<CheckoutOptions>({ method: 'GET', path: '/api/checkout/options', signal }),
  createQuote: (body: QuoteBody, signal?: AbortSignal) =>
    request<Quote>({ method: 'POST', path: '/api/quotes', body, signal }),
  quote: (quoteId: string) => request<Quote>({ method: 'GET', path: `/api/quotes/${quoteId}` }),
  createOrder: (body: CreateOrder, idempotencyKey: string, signal?: AbortSignal) =>
    request<Order>({ method: 'POST', path: '/api/orders', body, idempotencyKey, signal }),
  orders: () => request<Order[]>({ method: 'GET', path: '/api/orders' }),
  order: (orderId: string, signal?: AbortSignal) =>
    request<Order>({ method: 'GET', path: `/api/orders/${orderId}`, signal }),
  payments: (orderId: string, signal?: AbortSignal) =>
    request<Payment[]>({ method: 'GET', path: `/api/orders/${orderId}/payments`, signal }),
  createPayment: (orderId: string, idempotencyKey: string, signal?: AbortSignal) =>
    request<Payment>({
      method: 'POST',
      path: `/api/orders/${orderId}/payments`,
      body: {},
      idempotencyKey,
      signal,
    }),
  payment: (paymentId: string, signal?: AbortSignal) =>
    request<Payment>({ method: 'GET', path: `/api/payments/${paymentId}`, signal }),
  simulatePayment: (paymentId: string, scenario: Scenario, signal?: AbortSignal) =>
    request<Simulation>({
      method: 'POST',
      path: `/api/payments/${paymentId}/simulations`,
      body: { scenario },
      signal,
    }),
};
