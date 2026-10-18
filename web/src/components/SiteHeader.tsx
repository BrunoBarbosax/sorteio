import { NavLink, Link } from 'react-router-dom';
import Logo from './Logo';

/** Cabecalho fixo do site publico. */
export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="brand">
          <Logo size={40} />
          <span>
            GORJETA <span style={{ color: 'var(--gold)' }}>77</span> LUKAS
          </span>
        </Link>
        <nav className="site-nav">
          <NavLink to="/" end>
            Inicio
          </NavLink>
          <NavLink to="/#resultados">Resultados</NavLink>
          <NavLink to="/privacidade">Privacidade</NavLink>
        </nav>
      </div>
    </header>
  );
}
