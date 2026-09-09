import { Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { useShop } from '@/state/ShopProvider';

function CatalogSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-live="polite">
      <header className="page__intro">
        <p className="eyebrow">Каталог</p>
        <h1>Вещи для учебного стола</h1>
        <p className="lede">Открываем витрину…</p>
      </header>
      <ul className="catalog">
        {['a', 'b', 'c', 'd'].map((key) => (
          <li key={key} className="card product is-skeleton">
            <div className="product__visual" />
            <div className="skel skel--title" />
            <div className="skel skel--text" />
            <div className="skel skel--btn" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Layout() {
  const { ready, bootError, reload } = useShop();
  const location = useLocation();

  return (
    <>
      <a className="skip" href="#main">
        К содержанию
      </a>
      <Header />
      <main id="main" className="main">
        {bootError ? (
          <div className="page">
            <Notice tone="error">{bootError}</Notice>
            <Button onClick={reload}>Повторить</Button>
          </div>
        ) : ready ? (
          <div key={location.pathname} className="page-shell">
            <Outlet />
          </div>
        ) : (
          <CatalogSkeleton />
        )}
      </main>
    </>
  );
}
