import { Link, NavLink } from 'react-router-dom';
import { useShop } from '@/state/ShopProvider';

export function Header() {
  const { cart, activeOrderId } = useShop();
  const count = cart?.quantity ?? 0;

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <span>
            <span className="brand__name">Лавка «Орбита»</span>
            <span className="brand__place">г. Учебный</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Разделы магазина">
          <NavLink to="/" end className="nav__link">
            Витрина
          </NavLink>
          <NavLink to="/cart" className="nav__link">
            Корзина
            <span className={`nav__count${count ? ' is-on' : ''}`} aria-hidden={!count}>
              {count || 0}
            </span>
          </NavLink>
          {activeOrderId ? (
            <NavLink to={`/orders/${activeOrderId}`} className="nav__link">
              Заказ
            </NavLink>
          ) : (
            <span className="nav__link nav__link--ghost" aria-hidden="true">
              Заказ
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
