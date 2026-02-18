import { Navigate, Outlet } from 'react-router-dom'
import Spinner from '../Spinner/Spinner'
import { useAuth } from '../../hooks/useAuth'

const ProtectedRoute = () => {
  const { user, loading } = useAuth()

  if (loading) return <Spinner />

  return user ? <Outlet /> : <Navigate replace to="/login" />
}

export default ProtectedRoute
