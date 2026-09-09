import { NavLink, Outlet, useMatch } from 'react-router-dom';

export function Layout() {
  const canvas = useMatch('/spaces/:spaceId');
  return (
    <div className={canvas ? 'app app--canvas' : 'app'}>
      <a className="skip" href="#main">
        К содержимому
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <NavLink to="/spaces" className="brand">
            <span className="brand__mark" aria-hidden="true" />
            <span>
              <span className="brand__name">Канвас</span>
              <span className="brand__place">текст → генератор → результат</span>
            </span>
          </NavLink>
          <nav className="nav" aria-label="Разделы">
            <NavLink to="/spaces" className="nav__link">
              Пространства
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className="main">
        <Outlet />
      </main>
    </div>
  );
}
