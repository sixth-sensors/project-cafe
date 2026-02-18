import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Logo from '../Logo/Logo'
import UserAvatar from '../UserAvatar/UserAvatar'
import './Header.css'

const Header = () => {
  const { user } = useAuth()

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
            {user ? (
              <UserAvatar user={user} />
            ) : (
              <Link className="header-nav-link" to="/login">
                Login
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </header>
  )
}

export default Header
