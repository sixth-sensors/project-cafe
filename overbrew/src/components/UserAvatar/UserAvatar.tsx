import { useRef } from 'react'
import { Link } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { logOut } from '../../firebase'
import avatarFallback from '/avatar.png'
import './UserAvatar.css'

const UserAvatar = ({ user }: { user: User }) => {
  const popoverRef = useRef<HTMLElement>(null)

  const handleSignOut = async () => {
    await logOut()
  }

  const closePopover = () => {
    popoverRef.current?.hidePopover()
  }

  return (
    <>
      <button
        aria-label="User menu"
        className="avatar-btn"
        popoverTarget="avatar-dropdown"
        type="button"
      >
        <img
          alt={user.displayName ?? 'Profile picture'}
          className="avatar"
          referrerPolicy="no-referrer"
          src={user.photoURL ?? avatarFallback}
        />
      </button>
      <nav
        className="avatar-dropdown"
        id="avatar-dropdown"
        popover="auto"
        ref={popoverRef}
      >
        <ul>
          <li className="avatar-dropdown-email">{user.email}</li>
          <li>
            <Link onClick={closePopover} to="/account">
              Account
            </Link>
          </li>
          <li>
            <a onClick={handleSignOut}>Sign Out</a>
          </li>
        </ul>
      </nav>
    </>
  )
}

export default UserAvatar
