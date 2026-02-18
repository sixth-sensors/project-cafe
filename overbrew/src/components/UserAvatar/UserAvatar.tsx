import type { User } from 'firebase/auth'
import { logOut } from '../../firebase'
import './UserAvatar.css'

const UserAvatar = ({ user }: { user: User }) => {
  const handleSignOut = async () => {
    await logOut()
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
          src={user.photoURL ?? 'avatar.png'}
        />
      </button>
      <nav className="avatar-dropdown" id="avatar-dropdown" popover="auto">
        <ul>
          <li className="avatar-dropdown-email">{user.email}</li>
          <li>
            <a onClick={handleSignOut}>Sign Out</a>
          </li>
        </ul>
      </nav>
    </>
  )
}

export default UserAvatar
