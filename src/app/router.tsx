import { Alert, Button, Stack, Typography } from '@mui/material'
import { createBrowserRouter, Link, useParams } from 'react-router-dom'
import type { ApiClient } from '../api/client'
import { RequireRole } from '../auth/RequireRole'
import { NetworkEditPage } from '../features/networks/NetworkEditPage'
import { NetworkListPage } from '../features/networks/NetworkListPage'
import { NetworkCreatePage } from '../features/networks/NetworkCreatePage'
import { RuntimePage } from '../features/runtime/RuntimePage'
import { ConfigurationListPage } from '../features/configurations/ConfigurationListPage'
import { ConfigurationEditPage } from '../features/configurations/ConfigurationEditPage'
import { ApplicationActionsPage } from '../features/actions/ApplicationActionsPage'
import { DiagnosticsPage } from '../features/diagnostics/DiagnosticsPage'
import { AppLayout } from './AppLayout'
import { LoginPage } from './LoginPage'

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
      { path: 'validators', element: <ConfigurationListPage client={client} kind="validator" /> },
      { path: 'validators/:id', element: <RequireRole role="ADMIN"><ConfigurationEditPage client={client} kind="validator" /></RequireRole> },
      { path: 'transformers', element: <ConfigurationListPage client={client} kind="transformer" /> },
      { path: 'transformers/:id', element: <RequireRole role="ADMIN"><ConfigurationEditPage client={client} kind="transformer" /></RequireRole> },
      { path: 'runtime', element: <RuntimePage client={client} /> },
      { path: 'actions', element: <ApplicationActionsPage client={client} /> },
      { path: 'forbidden', element: simplePage('Acceso denegado', 'No tienes permisos para esta sección.') },
      { path: '*', element: simplePage('No encontrado', 'La página solicitada no existe.') },
    ] },
  ])
}

function DiagnosticsRoute({ client }: { client: ApiClient }) {
  const { id: rawId } = useParams()
  const id = Number(rawId)
  return Number.isSafeInteger(id) && id > 0 ? <DiagnosticsPage client={client} networkId={id} /> : simplePage('Fuente no encontrada', 'El identificador de fuente no es válido.')
}
