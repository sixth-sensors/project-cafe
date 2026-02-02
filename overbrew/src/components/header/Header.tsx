import './Header.css'
import Logo from '../logo/Logo'

export default function Header() {
  return (
    <header className="header">
      <a className="header-logo" href="/">
        <Logo
          width={150}
          beanColor="var(--dark-brown)"
          textColor="var(--cream)"
        />
      </a>
      <nav className="header-nav">
        <ul className="header-nav-list">
          <li>
            <a href="#" className="header-nav-link">
              Home
            </a>
          </li>
        </ul>
      </nav>
    </header>
  )
}
