import { Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Spinner from '../Spinner/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/api'

const ProtectedRoute = () => {
  const { user, loading } = useAuth()
  const [isAuthorised, setIsAuthorised] = useState<boolean | null>(null)
  const [authChecking, setAuthChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      if (!user) {
        setAuthChecking(false)
        return
      }
      try {
        const response = await apiFetch('/auth/verify', user)
        setIsAuthorised(response.ok)
      } catch (error) {
        console.error('Failed to verify authorization:', error)
        setIsAuthorised(false)
      } finally {
        setAuthChecking(false)
      }
    }

    if (!loading) {
      checkAuth()
    }
  }, [user, loading])

  if (loading || authChecking) return <Spinner />

  if (!user) return <Navigate replace to="/login" />

  if (isAuthorised === false) {
    return (
      <div
        style={{
          display: 'flex',
          height: 'calc(100vh - var(--header-height))',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '20px',
        }}
      >
        <h2>
          You are not authorised to connect to this machine. Contact your
          administrator to be added to the whitelist.
        </h2>
      </div>
    )
  }

  return <Outlet />
}

export default ProtectedRoute
