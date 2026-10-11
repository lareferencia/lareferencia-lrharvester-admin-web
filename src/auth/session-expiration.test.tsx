import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, Navigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api/client'
import { AuthProvider, useAuth } from './AuthProvider'
import { RequireRole } from './RequireRole'
vi.mock('../i18n', () => ({ uiText: (key: string) => key }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function LoginDestination() {
  const location = useLocation()
  return <div>Login return: {(location.state as { from: string }).from}</div>
}

function SessionRoutes() {
  const { user } = useAuth()
  const location = useLocation()
  if (user && location.pathname === '/login') return <Navigate replace to={(location.state as { from: string }).from} />
  return <Routes>
    <Route path="/networks" element={<RequireRole><div>Protected page</div></RequireRole>} />
    <Route path="/login" element={<LoginDestination />} />
  </Routes>
}

describe('Session expiration', () => {
  it.each(['json', 'text', 'download', 'malformed-json'] as const)('redirects after a background %s request returns 401', async kind => {
    const fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/me')) return new Response(JSON.stringify({ username: 'admin', roles: ['ADMIN'] }))
      if (url.endsWith('/auth/csrf')) return new Response(JSON.stringify({ token: 'csrf' }))
      return new Response(kind === 'malformed-json' ? '{broken' : '', {
        status: 401, headers: kind === 'malformed-json' ? { 'Content-Type': 'application/json' } : {},
      })
    })
    vi.stubGlobal('fetch', fetch)
    const client = new ApiClient('/api/v5')
    render(<AuthProvider client={client}><MemoryRouter initialEntries={['/networks?tag=test#details']}><SessionRoutes /></MemoryRouter></AuthProvider>)
    await screen.findByText('Protected page')
    await act(async () => {
      const request = kind === 'download' ? client.exportNetworksXlsx()
        : kind === 'text' ? client.diagnosticMetadata(1, 'record') : client.runtime()
      await request.catch(() => undefined)
    })
    expect(screen.getByText('Login return: /networks?tag=test#details')).toBeTruthy()
  })
})
