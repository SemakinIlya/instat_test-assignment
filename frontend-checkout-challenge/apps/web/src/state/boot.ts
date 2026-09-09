import { api, isApiClientError, setAccessToken, type Cart, type Product } from '@/api';
import { clearCheckoutSession, readJson, writeJson } from '@/lib/storage';

export type BootResult = {
  cart: Cart;
  products: Product[];
  openOrderId: string | null;
};

let inflight: Promise<BootResult> | null = null;

export function resetBoot(): void {
  inflight = null;
}

async function restoreOrCreate(): Promise<BootResult> {
  const savedToken = readJson<string | null>('token', null);
  if (savedToken) {
    setAccessToken(savedToken);
    try {
      const [cartRes, productRes, orderRes] = await Promise.all([
        api.cart(),
        api.products(),
        api.orders(),
      ]);
      const orders = orderRes.data;
      let openId: string | null = null;
      for (let i = 0; i < orders.length; i++) {
        if (orders[i].status === 'awaiting_payment') {
          openId = orders[i].id;
          break;
        }
      }
      if (openId) writeJson('orderId', openId);
      return {
        cart: cartRes.data,
        products: productRes.data,
        openOrderId: openId ?? readJson<string | null>('orderId', null),
      };
    } catch (error) {
      if (!isApiClientError(error) || error.status !== 401) throw error;
      setAccessToken(null);
    }
  }
  const session = await api.createSession();
  setAccessToken(session.data.token);
  writeJson('token', session.data.token);
  writeJson('sessionId', session.data.id);
  clearCheckoutSession();
  const productRes = await api.products();
  return { cart: session.data.cart, products: productRes.data, openOrderId: null };
}

/** Dedupes Strict Mode double-mount (one session). */
export function bootShop(): Promise<BootResult> {
  if (!inflight) inflight = restoreOrCreate();
  return inflight;
}
