import { useState, type FormEvent } from 'react'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export function LoginPage() {
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation()
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setPending(true); setError(null); try { await login({ username, password }); navigate((location.state as { from?: string } | null)?.from || '/networks', { replace: true }) } catch { setError('Las credenciales no son válidas o la API no está disponible.') } finally { setPending(false) } }
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'grey.100', p: 2 }}><Paper component="form" onSubmit={submit} sx={{ p: 4, width: '100%', maxWidth: 420 }}><Stack spacing={2}>
    <Typography variant="h4">Cosechador</Typography><Typography color="text.secondary">Administración v5 de LA Referencia</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    <TextField required label="Usuario" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} />
    <TextField required label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
    <Button type="submit" variant="contained" disabled={pending}>Ingresar</Button>
  </Stack></Paper></Box>
}
