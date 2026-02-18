import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Input from '../../components/Input/Input'
import { signInWithEmail } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import './Login.css'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { user } = useAuth()

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault()
    setError(null)
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
          id="email"
          name="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Input
          id="password"
          name="password"
          label="Password"
          value={password}
          onChange={setPassword}
          isPassword
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">Login</button>
        <p className="auth-link">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </main>
  )
}

export default Login
