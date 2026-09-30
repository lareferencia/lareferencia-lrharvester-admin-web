import { Alert, Button, Stack, Typography } from '@mui/material'
import { createBrowserRouter, Link, useParams } from 'react-router-dom'
import type { ApiClient } from '../api/client'
import { RequireRole } from '../auth/RequireRole'
import { NetworkEditPage } from '../features/networks/NetworkEditPage'
import { NetworkListPage } from '../features/networks/NetworkListPage'
import { NetworkCreatePage } from '../features/networks/NetworkCreatePage'
import { RuntimePage } from '../features/runtime/RuntimePage'
import { DarkPage } from '../features/dark/DarkPage'
import { ConfigurationListPage } from '../features/configurations/ConfigurationListPage'
import { ConfigurationEditPage } from '../features/configurations/ConfigurationEditPage'
import { ApplicationActionsPage } from '../features/actions/ApplicationActionsPage'
import { DiagnosticsPage } from '../features/diagnostics/DiagnosticsPage'
import { AppLayout } from './AppLayout'
import { LoginPage } from './LoginPage'
import { UsersPage } from '../features/users/UsersPage'

const simplePage = (title: string, message: string) => <Stack spacing={2}><Typography variant="h4">{title}</Typography><Alert severity="warning">{message}</Alert><Button component={Link} to="/networks">Ir a fuentes</Button></Stack>

export function createRouter(client: ApiClient) {
  return createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    { path: '/', element: <RequireRole><AppLayout /></RequireRole>, children: [
      { index: true, element: <NetworkListPage client={client} /> },
      { path: 'networks', element: <NetworkListPage client={client} /> },
      { path: 'networks/new', element: <RequireRole role="ADMIN"><NetworkCreatePage client={client} /></RequireRole> },
      { path: 'networks/:id/edit', element: <RequireRole role="ADMIN"><NetworkEditPage client={client} /></RequireRole> },
      { path: 'networks/:id/diagnostics', element: <DiagnosticsRoute client={client} /> },
      { path: 'validators', element: <RequireRole role="ADMIN"><ConfigurationListPage client={client} kind="validator" /></RequireRole> },
      { path: 'validators/:id', element: <RequireRole role="ADMIN"><ConfigurationEditPage client={client} kind="validator" /></RequireRole> },
      { path: 'transformers', element: <RequireRole role="ADMIN"><ConfigurationListPage client={client} kind="transformer" /></RequireRole> },
      { path: 'transformers/:id', element: <RequireRole role="ADMIN"><ConfigurationEditPage client={client} kind="transformer" /></RequireRole> },
      { path: 'runtime', element: <RequireRole role="ADMIN"><RuntimePage client={client} /></RequireRole> },
      { path: 'dark', element: <RequireRole role="ADMIN"><DarkPage client={client} /></RequireRole> },
      { path: 'actions', element: <RequireRole role="ADMIN"><ApplicationActionsPage client={client} /></RequireRole> },
      { path: 'users', element: <RequireRole role="ADMIN"><UsersPage client={client} /></RequireRole> },
      { path: 'forbidden', element: simplePage('Acceso denegado', 'No tienes permisos para esta sección.') },
      { path: '*', element: simplePage('No encontrado', 'La página solicitada no existe.') },
    ] },
  ], { basename: '/admin' })
}

function DiagnosticsRoute({ client }: { client: ApiClient }) {
  const { id: rawId } = useParams()
  const id = Number(rawId)
  return Number.isSafeInteger(id) && id > 0 ? <DiagnosticsPage client={client} networkId={id} /> : simplePage('Fuente no encontrada', 'El identificador de fuente no es válido.')
}
