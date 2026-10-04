import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../api/client'
import { NetworkCreatePage } from '../features/networks/NetworkCreatePage'
import { UsersPage } from '../features/users/UsersPage'
import i18n from './index'

beforeEach(async () => { await i18n.changeLanguage('es') })
afterEach(cleanup)
function show(page: 'source' | 'users') {
  const client = {
    attributeProfiles: vi.fn(async () => [{ typeId: 'ibict-repository', className: 'ibict', name: 'IBICT Repositórios e Bibliotecas' }]),
    users: vi.fn(async () => [{ id: 1, username: 'reader', role: 'READER', enabled: true, networks: [] }]),
    serviceAccounts: vi.fn(async () => []),
    networkSummaries: vi.fn(async () => ({ items: [], totalPages: 1 })),
  } as unknown as ApiClient
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  render(<QueryClientProvider client={cache}><MemoryRouter>{page === 'source' ? <NetworkCreatePage client={client} /> : <UsersPage client={client} />}</MemoryRouter></QueryClientProvider>)
  return client
}

describe('Changing the interface language', () => {
  it('updates labels and default profile names without losing form values', async () => {
    const client = show('source')
    await screen.findByText('Repositorios y bibliotecas IBICT')
    fireEvent.change(screen.getByLabelText(/^Acrónimo\s*\*?$/), { target: { value: 'TEST' } })
    await act(async () => { await i18n.changeLanguage('en') })
    expect(screen.getByRole('button', { name: 'Create source' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Acronym/)).toHaveValue('TEST')
    expect(screen.getByRole('combobox', { name: 'Attribute profile' })).toHaveTextContent('IBICT repositories and libraries')
    await act(async () => { await i18n.changeLanguage('pt') })
    expect(screen.getByRole('button', { name: 'Criar fonte' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Perfil de dados específicos' })).toHaveTextContent('Repositórios e bibliotecas IBICT')
    expect(client.attributeProfiles).toHaveBeenCalledTimes(1)
  })

  it('updates service account controls, user roles and the open password dialog', async () => {
    show('users')
    await screen.findByRole('cell', { name: 'Lector' })
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    expect(screen.getByText('Entre 12 y 200 caracteres. En edición, déjalo vacío para conservar la contraseña.')).toBeInTheDocument()
    await act(async () => { await i18n.changeLanguage('en') })
    expect(screen.getByText('Reader', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('Between 12 and 200 characters. When editing, leave blank to keep the password.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument()
    await act(async () => { await i18n.changeLanguage('pt') })
    expect(screen.getByText('Leitor', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('Entre 12 e 200 caracteres. Ao editar, deixe em branco para manter a senha.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Senha/)).toBeInTheDocument()
  })
})
