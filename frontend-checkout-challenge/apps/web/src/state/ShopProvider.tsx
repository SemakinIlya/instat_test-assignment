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
import { api, reportError, type Cart, type Product } from '@/api';
import { emptyDraft, readJson, removeItem as removeStored, writeJson, type CheckoutDraft } from '@/lib/storage';
import { qtyByProductId } from '@/lib/lookup';
import { bootShop, resetBoot } from './boot';

type ShopState = {
  ready: boolean;
  bootError: string | null;
  cart: Cart | null;
  products: Product[];
  draft: CheckoutDraft;
  activeOrderId: string | null;
  mutating: Record<string, boolean>;
  reload: () => void;
  refreshCart: () => Promise<Cart | undefined>;
  addOne: (productId: string) => Promise<void>;
  setQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  patchDraft: (patch: Partial<CheckoutDraft>) => void;
  setActiveOrderId: (id: string | null) => void;
};

const ShopContext = createContext<ShopState | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<CheckoutDraft>(() => readJson('draft', emptyDraft()));
  const [activeOrderId, setActiveOrderIdState] = useState<string | null>(() =>
    readJson<string | null>('orderId', null),
  );
  const [mutating, setMutating] = useState<Record<string, boolean>>({});
  const [bootTick, setBootTick] = useState(0);
  const cartEpoch = useRef(0);
  const cartRef = useRef<Cart | null>(null);
  cartRef.current = cart;

  const applyCart = useCallback((next: Cart, epoch: number) => {
    if (epoch !== cartEpoch.current) return;
    setCart(next);
  }, []);

  const refreshCart = useCallback(async () => {
    const epoch = ++cartEpoch.current;
    const { data } = await api.cart();
    applyCart(data, epoch);
    return epoch === cartEpoch.current ? data : undefined;
  }, [applyCart]);

  const withProductLock = useCallback(async (productId: string, action: () => Promise<void>) => {
    setMutating((current) => ({ ...current, [productId]: true }));
    try {
      await action();
    } finally {
      setMutating((current) => {
        if (!current[productId]) return current;
        const next: Record<string, boolean> = {};
        for (const key in current) {
          if (key !== productId) next[key] = current[key];
        }
        return next;
      });
    }
  }, []);

  const addOne = useCallback(
    async (productId: string) => {
      await withProductLock(productId, async () => {
        const quantity = (qtyByProductId(cartRef.current?.items ?? [])[productId] ?? 0) + 1;
        await api.setCartItem(productId, { quantity });
        await refreshCart();
      });
    },
    [refreshCart, withProductLock],
  );

  const setQuantity = useCallback(
    async (productId: string, quantity: number) => {
      await withProductLock(productId, async () => {
        if (quantity < 1) {
          await api.removeCartItem(productId);
        } else {
          await api.setCartItem(productId, { quantity });
        }
        await refreshCart();
      });
    },
    [refreshCart, withProductLock],
  );

  const removeItem = useCallback(
    async (productId: string) => {
      await withProductLock(productId, async () => {
        await api.removeCartItem(productId);
        await refreshCart();
      });
    },
    [refreshCart, withProductLock],
  );

  const patchDraft = useCallback((patch: Partial<CheckoutDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      writeJson('draft', next);
      return next;
    });
  }, []);

  const setActiveOrderId = useCallback((id: string | null) => {
    setActiveOrderIdState(id);
    if (id) writeJson('orderId', id);
    else removeStored('orderId');
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setBootError(null);
    void bootShop()
      .then((result) => {
        if (cancelled) return;
        cartEpoch.current += 1;
        setCart(result.cart);
        setProducts(result.products);
        setActiveOrderId(result.openOrderId);
        setReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        reportError(error, setBootError);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bootTick, setActiveOrderId]);

  const value = useMemo<ShopState>(
    () => ({
      ready,
      bootError,
      cart,
      products,
      draft,
      activeOrderId,
      mutating,
      reload: () => {
        resetBoot();
        setBootTick((n) => n + 1);
      },
      refreshCart,
      addOne,
      setQuantity,
      removeItem,
      patchDraft,
      setActiveOrderId,
    }),
    [
      ready,
      bootError,
      cart,
      products,
      draft,
      activeOrderId,
      mutating,
      refreshCart,
      addOne,
      setQuantity,
      removeItem,
      patchDraft,
      setActiveOrderId,
    ],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopState {
  const value = useContext(ShopContext);
  if (!value) throw new Error('useShop must be used within ShopProvider');
  return value;
}
