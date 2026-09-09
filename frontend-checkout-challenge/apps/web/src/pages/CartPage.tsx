import { Link, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { QtyStepper } from '@/components/QtyStepper';
import { formatMoney } from '@/lib/money';
import { stockByProductId } from '@/lib/lookup';
import { useActionError } from '@/lib/use-action';
import { useShop } from '@/state/ShopProvider';

export function CartPage() {
  const { cart, products, setQuantity, removeItem, mutating } = useShop();
  const { error, run } = useActionError();
  const navigate = useNavigate();
  const stock = useMemo(() => stockByProductId(products), [products]);

  if (!cart) return null;

  return (
    <div className="page">
      <header className="page__intro">
        <p className="eyebrow">Корзина</p>
        <h1>Ваш набор</h1>
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {cart.items.length === 0 ? (
        <Notice tone="info">
          Корзина пуста.{' '}
          <Link to="/" className="text-link">
            Вернуться на витрину
          </Link>
        </Notice>
      ) : (
        <>
          <ul className="cart-list">
            {cart.items.map((item) => {
              const titleId = `line-${item.productId}`;
              const busy = Boolean(mutating[item.productId]);
              return (
                <li key={item.productId} className={`card cart-line${busy ? ' is-busy' : ''}`}>
                  <div className="cart-line__main">
                    <h2 id={titleId} className="cart-line__title">
                      {item.title}
                    </h2>
                    <p className="muted">{formatMoney(item.unitPrice)} за штуку</p>
                    <p className="cart-line__sum">{formatMoney(item.lineTotal)}</p>
                    <QtyStepper
                      labelledBy={titleId}
                      value={item.quantity}
                      max={stock[item.productId] ?? 1}
                      disabled={busy}
                      onChange={(value) => void run(() => setQuantity(item.productId, value))}
                    />
                  </div>
                  <Button
                    variant="text"
                    disabled={busy}
                    onClick={() => void run(() => removeItem(item.productId))}
                  >
                    Удалить
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className="cart-total card">
            <div>
              <p className="muted">Товары</p>
              <p className="cart-total__value">{formatMoney(cart.subtotal)}</p>
            </div>
            <Button onClick={() => navigate('/checkout')}>Перейти к оформлению</Button>
          </div>
        </>
      )}
    </div>
  );
}
