import { useState } from 'react'
import { Link } from 'react-router-dom'
import Input from '../../components/Input/Input'
import './Signup.css'

const Signup = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    // TODO
  }

  return (
    <main className="signup">
      <h1>Sign Up</h1>
      <form className="signup-form" onSubmit={handleSubmit}>
        <Input
          id="email"
          label="Email"
          name="email"
          onChange={setEmail}
          required
          type="email"
          value={email}
        />
        <Input
          id="password"
          isPassword
          label="Password"
          name="password"
          onChange={setPassword}
          required
          value={password}
        />
        <Input
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
