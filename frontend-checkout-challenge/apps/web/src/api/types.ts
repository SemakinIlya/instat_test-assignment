import type { Static } from '@sinclair/typebox';
import {
  CheckoutOptionsSchema,
  QuoteBody as QuoteBodySchema,
  SandboxSchema,
  SessionSchema,
  SetCartItemBody as SetCartItemBodySchema,
} from '@checkout/contracts';
import type {
  Cart,
  CreateOrder,
  Customer,
  Delivery,
  Order,
  Payment,
  Product,
  Quote,
  Scenario,
  Simulation,
} from '@checkout/contracts';

export type {
  Cart,
  CreateOrder,
  Customer,
  Delivery,
  Order,
  Payment,
  Product,
  Quote,
  Scenario,
  Simulation,
};

export type CartItem = Cart['items'][number];
export type PaymentMethod = Order['paymentMethod'];
export type PickupPointId = Extract<Delivery, { method: 'pickup' }>['pickupPointId'];

export type Session = Static<typeof SessionSchema>;
export type CheckoutOptions = Static<typeof CheckoutOptionsSchema>;
export type Sandbox = Static<typeof SandboxSchema>;
export type SandboxCard = Sandbox['cards'][number];
export type QuoteBody = Static<typeof QuoteBodySchema>;
export type SetCartItemBody = Static<typeof SetCartItemBodySchema>;
