import LogoutIcon from '@mui/icons-material/Logout'
import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export function AppLayout() {
  const { user, logout } = useAuth()
  return <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
    <AppBar position="static"><Toolbar>
      <Typography variant="h6" component={Link} to="/networks" color="inherit" sx={{ textDecoration: 'none', flexGrow: 1 }}>
        LA Referencia · Cosechador
      </Typography>
      <Button color="inherit" component={Link} to="/runtime">Runtime</Button>
      <Typography variant="body2" sx={{ ml: 2, mr: 1 }}>{user?.displayName}</Typography>
      <Button color="inherit" onClick={logout} startIcon={<LogoutIcon />}>Salir</Button>
    </Toolbar></AppBar>
    <Container maxWidth="xl" sx={{ py: 4 }}><Outlet /></Container>
  </Box>
}
