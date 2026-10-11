import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ApiClient } from '../../api/client'
import type { DarkAuthentication } from '../../api/types'
import i18n from '../../i18n'
import { DarkAuthenticationPanel } from './DarkAuthenticationPanel'

beforeEach(async () => { await i18n.changeLanguage('es') })
afterEach(cleanup)

const pending: DarkAuthentication = {
  mode: 'dark2', registrationStatus: 'pending_registration', credentialId: 'key-1', keyId: 'fingerprint-1',
  publicKey: 'ssh-ed25519 public-material dark-minter', publicKeyBase64: 'public-material', authorityId: 'authority-1',
  baseUrl: 'https://minter.example.org', storageRoot: '/server/keys', generatedAt: null, generatedBy: null,
  confirmedAt: null, confirmedBy: null, error: null,
}

function openPanel(value = pending, editing = false) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } })
  cache.setQueryData(['dark-authentication'], value)
  const generateDarkCredentials = vi.fn(async () => ({ ...pending, credentialId: 'key-2', keyId: 'fingerprint-2' }))
  const resumeDarkAuthentication = vi.fn(async () => ({ ...value, registrationStatus: 'enabled' as const }))
  const client = { darkAuthentication: vi.fn(async () => value), generateDarkCredentials, resumeDarkAuthentication } as unknown as ApiClient
  render(<QueryClientProvider client={cache}><DarkAuthenticationPanel client={client} configurationEditing={editing} /></QueryClientProvider>)
  return { generateDarkCredentials, resumeDarkAuthentication }
}

it('requires confirmation before regenerating the current pair', async () => {
  const { generateDarkCredentials } = openPanel()
  fireEvent.click(screen.getByRole('button', { name: 'Regenerar claves' }))
  expect(generateDarkCredentials).not.toHaveBeenCalled()
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText(/hasta que el administrador del minter registre/)).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
  await waitFor(() => expect(generateDarkCredentials).toHaveBeenCalledWith('key-1'))
})

it('confirms registration for the displayed fingerprint, authority and destination', async () => {
  const { resumeDarkAuthentication } = openPanel()
  expect(screen.getByText(/Pendiente de registro/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar registro y reanudar' }))
  expect(resumeDarkAuthentication).not.toHaveBeenCalled()
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('fingerprint-1')).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
  await waitFor(() => expect(resumeDarkAuthentication).toHaveBeenCalledWith(pending))
})

it('blocks lifecycle actions while global configuration has unsaved edits', () => {
  openPanel(pending, true)
  expect(screen.getByRole('button', { name: 'Regenerar claves' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Confirmar registro y reanudar' })).toBeDisabled()
  expect(screen.getByText(/Guarda los cambios de configuración/)).toBeInTheDocument()
})


it('warns about HTTP without blocking generation or resuming', () => {
  openPanel({ ...pending, baseUrl: 'http://minter.example.org:8001' })
  expect(screen.getByRole('button', { name: 'Regenerar claves' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Confirmar registro y reanudar' })).toBeEnabled()
})


it('shows the server key directory without allowing it to be edited', () => {
  openPanel()
  expect(screen.queryByDisplayValue('/server/keys')).not.toBeInTheDocument()
  expect(screen.getByText(/directorio keys del almacenamiento/)).toBeInTheDocument()
})

it('allows key generation before receiving the authority and blocks activation', () => {
  openPanel({ ...pending, authorityId: '' })
  expect(screen.getByRole('button', { name: 'Regenerar claves' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Confirmar registro y reanudar' })).toBeDisabled()
})
