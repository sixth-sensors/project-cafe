import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Input from '../../components/Input/Input'
import { signInWithEmail } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import './Login.css'

interface FieldErrors {
  email?: string
  password?: string
}

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)

  const { user } = useAuth()

  const handleSubmit = async (e: React.SubmitEvent) => {
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

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      await signInWithEmail(email, password)
    } catch (error) {
      console.error('Login failed:', error)
      if (error instanceof Error) {
        setError(error.message || 'An error occurred during login.')
      }
    }
  }

  useEffect(() => {
    if (user) {
      console.log('User logged in:', user)
    }
  }, [user])

  return (
    <main className="login">
      <h1>Login</h1>
      <form className="login-form" onSubmit={handleSubmit}>
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
        {error ? <p className="error">{error}</p> : null}
        <button type="submit">Login</button>
        <p className="auth-link">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
        <p className="auth-link">
          Forgot your password?{' '}
          <Link to="/password-reset">Reset your password.</Link>
        </p>
      </form>
    </main>
  )
}

export default Login
