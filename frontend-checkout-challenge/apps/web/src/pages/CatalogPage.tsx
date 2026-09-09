import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { formatMoney } from '@/lib/money';
import { qtyByProductId } from '@/lib/lookup';
import { useActionError } from '@/lib/use-action';
import { useShop } from '@/state/ShopProvider';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';

export function CatalogPage() {
  const { products, cart, addOne, mutating } = useShop();
  const { error, run } = useActionError();
  const qty = useMemo(() => qtyByProductId(cart?.items ?? []), [cart]);

  return (
    <div className="page">
      <header className="page__intro">
        <p className="eyebrow">Каталог</p>
        <h1>Вещи для учебного стола</h1>
        <p className="lede">
          Четыре позиции из демо-склада. Остаток ограничивает одну корзину и не списывается у других
          покупателей.
        </p>
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <ul className="catalog">
        {products.map((product) => {
          const inCart = qty[product.id] ?? 0;
          const available = product.stock > 0;
          const canAdd = available && inCart < product.stock;
          return (
            <li key={product.id} className={`card product${mutating[product.id] ? ' is-busy' : ''}`}>
              <div
                className={`product__visual product__visual--${product.id}`}
                aria-hidden="true"
              />
              <div className="product__top">
                <h2 className="product__title">{product.title}</h2>
                <p className="product__price">{formatMoney(product.price)}</p>
              </div>
              <p className="product__desc">{product.description}</p>
              <p className="product__stock">
                {available ? `В наличии: ${product.stock} шт.` : 'Нет в наличии'}
                {inCart ? ` · в корзине ${inCart}` : ''}
              </p>
              <div className="product__actions">
                <Button
                  disabled={!canAdd || Boolean(mutating[product.id])}
                  onClick={() => void run(() => addOne(product.id))}
                >
                  {!available ? 'Недоступно' : canAdd ? 'В корзину' : 'Больше нельзя'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {cart && cart.quantity > 0 ? (
        <p className="page__next">
          <Link to="/cart" className="text-link">
            Перейти в корзину · {cart.quantity} шт., {formatMoney(cart.subtotal)}
          </Link>
        </p>
      ) : (
        <p className="page__next" />
      )}
    </div>
  );
}
