import { Navigate } from 'react-router-dom'
import { isAuthenticated, hasRole } from '../utils/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: string[]
  redirectTo?: string
}

export default function ProtectedRoute({
  children,
  requiredRoles,
  redirectTo = '/admin/login',
}: ProtectedRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to={redirectTo} replace />
  }

  if (requiredRoles && !hasRole(requiredRoles)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}


