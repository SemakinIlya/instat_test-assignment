import type { PickupPointId } from '@/api';

const PREFIX = 'orbit-shop.';

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

export type CheckoutDraft = {
  name: string;
  email: string;
  phone: string;
  deliveryMethod: 'pickup' | 'courier';
  pickupPointId: PickupPointId;
  city: string;
  street: string;
  house: string;
  apartment: string;
  paymentMethod: 'card' | 'cash_on_delivery';
};

export const emptyDraft = (): CheckoutDraft => ({
  name: '',
  email: '',
  phone: '',
  deliveryMethod: 'pickup',
  pickupPointId: 'point-center',
  city: 'Учебный',
  street: '',
  house: '',
  apartment: '',
  paymentMethod: 'card',
});

export type IdempotentRecord = {
  fingerprint: string;
  key: string;
};

export function idempotencyKey(storageKey: string, fingerprint: string): string {
  const saved = readJson<IdempotentRecord | null>(storageKey, null);
  if (saved && saved.fingerprint === fingerprint) return saved.key;
  const key = crypto.randomUUID();
  writeJson(storageKey, { fingerprint, key } satisfies IdempotentRecord);
  return key;
}

export function clearCheckoutSession(): void {
  removeItem('orderId');
  removeItem('orderKey');
}
