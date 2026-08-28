import LogoutIcon from '@mui/icons-material/Logout'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined'
import TransformOutlinedIcon from '@mui/icons-material/TransformOutlined'
import { Avatar, Box, Button, Container, Divider, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Stack, Toolbar, Tooltip, Typography } from '@mui/material'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

const drawerWidth = 252
const collapsedDrawerWidth = 72
const navigation = [
  { label: 'Fuentes', to: '/networks', icon: <DashboardOutlinedIcon /> },
  { label: 'Validadores', to: '/validators', icon: <FactCheckOutlinedIcon /> },
  { label: 'Transformadores', to: '/transformers', icon: <TransformOutlinedIcon /> },
  { label: 'Acciones', to: '/actions', icon: <BoltOutlinedIcon /> },
  { label: 'Runtime', to: '/runtime', icon: <MemoryOutlinedIcon /> },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [expanded, setExpanded] = useState(false)
  const currentWidth = expanded ? drawerWidth : collapsedDrawerWidth
  return <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.default' }}>
    <Drawer variant="permanent" onMouseLeave={() => setExpanded(false)} sx={{ width: currentWidth, flexShrink: 0, transition: 'width 180ms ease', '& .MuiDrawer-paper': { width: currentWidth, transition: 'width 180ms ease', overflowX: 'hidden', boxSizing: 'border-box', bgcolor: 'primary.dark', color: 'common.white', border: 0, px: 1.5 } }}>
      <Toolbar sx={{ minHeight: '84px !important', px: '10px !important' }}><Stack direction="row" spacing={1.2} alignItems="center"><Avatar sx={{ bgcolor: 'secondary.main', color: 'primary.dark', width: 38, height: 38, flexShrink: 0 }}><AccountTreeOutlinedIcon /></Avatar><Box sx={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0, overflow: 'hidden', whiteSpace: 'nowrap', transition: 'opacity 140ms ease' }}><Typography fontWeight={800} lineHeight={1.1}>LA Referencia</Typography><Typography variant="caption" sx={{ opacity: 0.68 }}>Administración del cosechador</Typography></Box></Stack></Toolbar>
      <Typography variant="overline" sx={{ px: 1.2, pt: 2, pb: 0.5, height: 32, overflow: 'hidden', color: 'rgba(255,255,255,.5)', fontWeight: 800, letterSpacing: '.12em', opacity: expanded ? 1 : 0, transition: 'opacity 140ms ease' }}>Operación</Typography>
      <List disablePadding>{navigation.map(item => { const active = location.pathname === item.to || (item.to !== '/networks' && location.pathname.startsWith(item.to)); return <Tooltip key={item.to} title={expanded ? '' : item.label} placement="right"><ListItemButton component={Link} to={item.to} selected={active} onMouseEnter={() => setExpanded(true)} sx={{ borderRadius: 2, mb: 0.5, color: 'rgba(255,255,255,.78)', '&:hover': { bgcolor: 'rgba(255,255,255,.10)', color: 'common.white' }, '&.Mui-selected': { bgcolor: 'rgba(255,255,255,.16)', color: 'common.white' }, '&.Mui-selected:hover': { bgcolor: 'rgba(255,255,255,.20)' } }}><ListItemIcon sx={{ color: 'inherit', minWidth: 38 }}>{item.icon}</ListItemIcon><ListItemText primary={item.label} sx={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0, overflow: 'hidden', whiteSpace: 'nowrap', transition: 'opacity 140ms ease' }} primaryTypographyProps={{ fontWeight: 650 }} /></ListItemButton></Tooltip> })}</List>
      <Box sx={{ mt: 'auto', mb: 2 }}><Divider sx={{ borderColor: 'rgba(255,255,255,.14)', mb: 2 }} /><Stack direction="row" spacing={1.1} alignItems="center" sx={{ px: 1 }}><Avatar sx={{ width: 31, height: 31, bgcolor: 'rgba(255,255,255,.14)', fontSize: 13, flexShrink: 0 }}>{user?.displayName?.slice(0, 1).toUpperCase()}</Avatar><Box sx={{ minWidth: 0, flex: 1, opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0, overflow: 'hidden', whiteSpace: 'nowrap', transition: 'opacity 140ms ease' }}><Typography variant="body2" noWrap fontWeight={700}>{user?.displayName}</Typography><Typography variant="caption" sx={{ opacity: 0.58 }}>{user?.roles.join(' · ')}</Typography></Box></Stack><Tooltip title={expanded ? '' : 'Cerrar sesión'} placement="right"><Button color="inherit" fullWidth sx={{ justifyContent: expanded ? 'flex-start' : 'center', minWidth: 0, px: expanded ? 2 : 0, mt: 1.5, color: 'rgba(255,255,255,.72)' }} onClick={logout} startIcon={<LogoutIcon sx={{ mr: expanded ? 0 : '-4px' }} />}>{expanded && 'Cerrar sesión'}</Button></Tooltip></Box>
    </Drawer>
    <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}><Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 }, px: { xs: 2.5, md: 4 } }}><Outlet /></Container></Box>
  </Box>
}
