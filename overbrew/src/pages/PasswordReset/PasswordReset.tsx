import { useState } from 'react'
import { Link } from 'react-router-dom'
import Input from '../../components/Input/Input'
import { resetPassword } from '../../firebase'
import './PasswordReset.css'

interface FieldErrors {
  email?: string
}

const PasswordReset = () => {
  const [email, setEmail] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault()
    setError(null)

    const errors: FieldErrors = {}

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      errors.email = 'Please enter a valid email address.'
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      await resetPassword(email)
      setSuccess(true)
    } catch (error) {
      console.error('Password reset failed:', error)
      if (error instanceof Error) {
        setError(error.message || 'An error occurred during password reset.')
      }
    }
  }

  return (
    <main className="password-reset">
      <h1>Reset Your Password</h1>
      {success ? (
        <p className="success">
          Check your inbox - if there is an account associated with {email}, you
          should receive a password reset email shortly.
        </p>
      ) : (
        <>
          <p>
            Forgotten your password? Enter your email below and we&apos;ll send
            you a password reset email.
          </p>
          <form className="password-reset-form" onSubmit={handleSubmit}>
            <Input
              error={fieldErrors.email}
              id="email"
              label="Email"
              name="email"
              onChange={setEmail}
              required
              value={email}
            />
            {error ? <p className="error">{error}</p> : null}
            <button type="submit">Reset Password</button>
            <p className="auth-link">
              Don&apos;t have an account? <Link to="/signup">Sign up</Link>
            </p>
          </form>
        </>
      )}
    </main>
  )
}

export default PasswordReset
