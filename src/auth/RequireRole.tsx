import { Navigate, useLocation } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { Alert, Box, Button, Stack } from '@mui/material'
import { useAuth } from './AuthProvider'

export function RequireRole({ children, role }: PropsWithChildren<{ role?: 'ADMIN' | 'READER' }>) {
  const { user, logout } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate replace to="/login" state={{ from: location.pathname }} />
  if (!role && !user.roles.some(value => value === 'ADMIN' || value === 'READER'))
    return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}><Stack spacing={2}>
      <Alert severity="warning">Esta cuenta no tiene acceso al Admin. Para entrar aquí necesitas el rol ADMIN o READER.</Alert>
      <Button href="/dashboard/">Ir al Dashboard</Button>
      <Button onClick={() => { void logout() }}>Cerrar sesión</Button>
    </Stack></Box>
  if (role && !user.roles.includes(role) && !user.roles.includes('ADMIN')) return <Navigate replace to="/forbidden" />
  return <>{children}</>
}
