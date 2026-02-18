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
        className="avatar-btn"
        popoverTarget="avatar-dropdown"
        aria-label="User menu"
      >
        <img
          className="avatar"
          src={user.photoURL ?? 'avatar.png'}
          alt={user.displayName ?? 'Profile picture'}
          referrerPolicy="no-referrer"
        />
      </button>
      <nav id="avatar-dropdown" className="avatar-dropdown" popover="auto">
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
