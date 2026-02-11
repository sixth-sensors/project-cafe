import { Link } from 'react-router-dom'
import './Header.css'
import Logo from '../Logo/Logo'

const Header = () => {
  return (
    <header className="header">
      <Link className="header-logo" to="/">
        <Logo
          beanColor="var(--dark-brown)"
          textColor="var(--cream)"
          width={150}
        />
      </Link>
      <nav className="header-nav">
        <ul className="header-nav-list">
          <li>
            <Link className="header-nav-link" to="/">
              Home
            </Link>
          </li>
          <li>
            <Link className="header-nav-link" to="/login">
              Login
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  )
}

export default Header
