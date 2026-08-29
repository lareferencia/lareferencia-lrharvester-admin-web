import { useState, type FormEvent } from 'react'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { Alert, Avatar, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useTranslation } from 'react-i18next'

export function LoginPage() {
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation()
  const { t } = useTranslation()
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setPending(true); setError(null); try { await login({ username, password }); navigate((location.state as { from?: string } | null)?.from || '/networks', { replace: true }) } catch { setError(t('login.invalid')) } finally { setPending(false) } }
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, background: 'radial-gradient(circle at 15% 15%, #377293 0, transparent 32%), linear-gradient(135deg, #102d45 0%, #173c5c 48%, #1b6659 145%)' }}><Paper component="form" onSubmit={submit} elevation={0} sx={{ p: { xs: 3, sm: 4.5 }, width: '100%', maxWidth: 430, border: '1px solid rgba(255,255,255,.42)', boxShadow: '0 24px 70px rgba(4, 20, 33, .32)' }}><Stack spacing={2.4}>
    <Stack direction="row" spacing={1.5} alignItems="center"><Avatar sx={{ bgcolor: 'secondary.main', color: 'primary.dark', width: 44, height: 44 }}><AccountTreeOutlinedIcon /></Avatar><Box><Typography variant="h5">{t('login.title')}</Typography><Typography color="text.secondary" variant="body2">{t('login.subtitle')}</Typography></Box></Stack>
    <Typography color="text.secondary">{t('login.description')}</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    <TextField required label={t('login.username')} autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} />
    <TextField required label={t('login.password')} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
    <Button type="submit" variant="contained" size="large" disabled={pending} startIcon={<LockOutlinedIcon />}>{t('login.submit')}</Button>
  </Stack></Paper></Box>
}
