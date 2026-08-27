import { Navigate, useLocation } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { useAuth } from './AuthProvider'

export function RequireRole({ children, role }: PropsWithChildren<{ role?: 'ADMIN' | 'VIEWER' }>) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate replace to="/login" state={{ from: location.pathname }} />
  if (role && !user.roles.includes(role) && !user.roles.includes('ADMIN')) return <Navigate replace to="/forbidden" />
  return <>{children}</>
}
