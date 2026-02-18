import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { resetPassword, updateUserProfile } from '../../firebase'
import Input from '../../components/Input/Input'
import avatarFallback from '/avatar.png'
import './Account.css'

const Account = () => {
  const { user } = useAuth()

  const [photoURL, setPhotoURL] = useState(user?.photoURL ?? '')
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoSuccess, setPhotoSuccess] = useState(false)

  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const handlePhotoSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault()
    setPhotoError(null)
    setPhotoSuccess(false)
    if (!user) return
    try {
      await updateUserProfile(user, user.displayName ?? '', photoURL)
      setPhotoSuccess(true)
    } catch (error) {
      if (error instanceof Error) {
        setPhotoError(error.message)
      }
    }
  }

  const handlePasswordReset = async () => {
    setResetError(null)
    setResetSent(false)
    if (!user?.email) return
    try {
      await resetPassword(user.email)
      setResetSent(true)
    } catch (err) {
      if (err instanceof Error) setResetError(err.message)
    }
  }

  return (
    <main className="account">
      <h1>Account</h1>
      <section className="account-section">
        <h2>Profile picture</h2>
        <div className="account-avatar-preview">
          <img
            alt={user?.displayName ?? 'Profile picture'}
            referrerPolicy="no-referrer"
            src={user?.photoURL ?? avatarFallback}
          />
        </div>
        <form className="account-form" onSubmit={handlePhotoSubmit}>
          <Input
            id="photo-url"
            label="Photo URL"
            name="photo-url"
            onChange={(v) => {
              setPhotoURL(v)
              setPhotoSuccess(false)
            }}
            placeholder="https://example.com/photo.jpg"
            type="url"
            value={photoURL}
          />
          {photoError ? <p className="account-error">{photoError}</p> : null}
          {photoSuccess ? (
            <p className="account-success">Profile picture updated.</p>
          ) : null}
          <button type="submit">Save</button>
        </form>
      </section>

      <section className="account-section">
        <h2>Email</h2>
        <p className="account-email">{user?.email}</p>
      </section>

      <section className="account-section">
        <h2>Password</h2>
        <p>
          A reset link will be sent to <strong>{user?.email}</strong>.
        </p>
        {resetError ? <p className="account-error">{resetError}</p> : null}
        {resetSent ? (
          <p className="account-success">
            Password reset email sent - check your inbox.
          </p>
        ) : null}
        <button onClick={handlePasswordReset} type="button">
          Reset Password
        </button>
      </section>
    </main>
  )
}

export default Account
