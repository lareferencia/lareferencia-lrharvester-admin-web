import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import type { ApiClient } from '../api/client'
import { ApiError } from '../api/problem-detail'
import { AuthProvider } from '../auth/AuthProvider'
import { createRouter } from './router'

const theme = createTheme({ palette: { primary: { main: '#005a9c' }, secondary: { main: '#f5a623' } } })
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: (count, error) => error instanceof ApiError && error.status === 401 ? false : count < 2 } } })

export function App({ client }: { client: ApiClient }) {
  return <ThemeProvider theme={theme}><CssBaseline /><QueryClientProvider client={queryClient}><AuthProvider client={client}><RouterProvider router={createRouter(client)} /></AuthProvider></QueryClientProvider></ThemeProvider>
}
