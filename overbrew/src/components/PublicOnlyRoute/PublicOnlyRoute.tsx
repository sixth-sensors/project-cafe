import { Navigate, Outlet } from 'react-router-dom'
import Spinner from '../Spinner/Spinner'
import { useAuth } from '../../hooks/useAuth'

const PublicOnlyRoute = () => {
  const { user, loading } = useAuth()

  if (loading) return <Spinner />

  return user ? <Navigate replace to="/" /> : <Outlet />
}

export default PublicOnlyRoute
