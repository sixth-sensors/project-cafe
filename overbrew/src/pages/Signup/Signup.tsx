import { useState } from 'react'
import { Link } from 'react-router-dom'
import Input from '../../components/Input/Input'
import { registerWithEmail } from '../../firebase'
import './Signup.css'

interface FieldErrors {
  email?: string
  password?: string
  confirmPassword?: string
}

const Signup = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const errors: FieldErrors = {}

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      errors.email = 'Please enter a valid email address.'
    }

    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.'
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      await registerWithEmail(email, password)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || 'An error occurred during sign up.')
      }
    }
  }

  return (
    <main className="signup">
      <h1>Sign Up</h1>
      <form className="signup-form" onSubmit={handleSubmit}>
        <Input
          error={fieldErrors.email}
          id="email"
          label="Email"
          name="email"
          onChange={setEmail}
          required
          value={email}
        />
        <Input
          error={fieldErrors.password}
          id="password"
          isPassword
          label="Password"
          name="password"
          onChange={setPassword}
          required
          value={password}
        />
        <Input
          error={fieldErrors.confirmPassword}
          id="confirm-password"
          isPassword
          label="Confirm Password"
          name="confirm-password"
          onChange={setConfirmPassword}
          required
          value={confirmPassword}
        />
        {error ? <p className="error">{error}</p> : null}
        <button type="submit">Sign Up</button>
        <p className="auth-link">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </main>
  )
}

export default Signup
