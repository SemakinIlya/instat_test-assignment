import type { CheckoutOptions, Delivery } from '@/api';
import type { CheckoutDraft } from './storage';

export function deliveryFromDraft(draft: CheckoutDraft): Delivery | null {
  if (draft.deliveryMethod === 'pickup') {
    return { method: 'pickup', pickupPointId: draft.pickupPointId };
  }
  const city = draft.city.trim();
  const street = draft.street.trim();
  const house = draft.house.trim();
  const apartment = draft.apartment.trim();
  if (city.length < 2 || street.length < 2 || house.length < 1) return null;
  return {
    method: 'courier',
    address: apartment ? { city, street, house, apartment } : { city, street, house },
  };
}

export function sameDelivery(a: Delivery, b: Delivery): boolean {
  if (a.method !== b.method) return false;
  if (a.method === 'pickup' && b.method === 'pickup') return a.pickupPointId === b.pickupPointId;
  if (a.method === 'courier' && b.method === 'courier') {
    return (
      a.address.city === b.address.city &&
      a.address.street === b.address.street &&
      a.address.house === b.address.house &&
      (a.address.apartment ?? '') === (b.address.apartment ?? '')
    );
  }
  return false;
}

export function formatDelivery(delivery: Delivery, titles: Record<string, string>): string {
  if (delivery.method === 'pickup') {
    const title = titles[delivery.pickupPointId] ?? delivery.pickupPointId;
    return `Самовывоз · ${title}`;
  }
  const { city, street, house, apartment } = delivery.address;
  return `Курьер · ${city}, ${street}, ${house}${apartment ? `, кв. ${apartment}` : ''}`;
}

export function pickupTitles(options: CheckoutOptions | null): Record<string, string> {
  const titles: Record<string, string> = {};
  if (!options) return titles;
  for (let i = 0; i < options.deliveryMethods.length; i++) {
    const method = options.deliveryMethods[i];
    if (method.id !== 'pickup') continue;
    const points = method.pickupPoints;
    for (let j = 0; j < points.length; j++) titles[points[j].id] = points[j].title;
    break;
  }
  return titles;
}

export const PAYMENT_DONE = new Set(['succeeded', 'failed', 'cancelled']);
