import { uiText } from '../i18n'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { Alert, Box, Button, Stack } from '@mui/material'
import { useAuth } from './AuthProvider'

export function RequireRole({ children, role }: PropsWithChildren<{ role?: 'ADMIN' | 'READER' }>) {
  useTranslation()
  const { user, logout } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate replace to="/login" state={{ from: location.pathname }} />
  if (!role && !user.roles.some(value => value === 'ADMIN' || value === 'READER'))
    return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}><Stack spacing={2}>
      <Alert severity="warning">{uiText('adminAccessHelp')}</Alert>
      <Button href="/dashboard/">{uiText('goDashboard')}</Button>
      <Button onClick={() => { void logout() }}>{uiText('logout')}</Button>
    </Stack></Box>
  if (role && !user.roles.includes(role) && !user.roles.includes('ADMIN')) return <Navigate replace to="/forbidden" />
  return <>{children}</>
}
