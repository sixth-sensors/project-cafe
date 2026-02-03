import './Header.css'
import Logo from '../logo/Logo'

const Header = () => {
  return (
    <header className="header">
      <a className="header-logo" href="/">
        <Logo
          beanColor="var(--dark-brown)"
          textColor="var(--cream)"
          width={150}
        />
      </a>
      <nav className="header-nav">
        <ul className="header-nav-list">
          <li>
            <a className="header-nav-link" href="/">
              Home
            </a>
          </li>
          <li>
            <a className="header-nav-link" href="/login">
              Login
            </a>
          </li>
        </ul>
      </nav>
    </header>
  )
}

export default Header
