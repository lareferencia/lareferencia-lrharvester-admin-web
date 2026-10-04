import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../../api/client'
import { NetworkListPage } from './NetworkListPage'
import i18n from '../../i18n'

vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { roles: ['READER'] } }) }))
vi.mock('react-i18next', async importOriginal => ({ ...await importOriginal<typeof import('react-i18next')>(), useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }) }))
vi.mock('./IndexingResults', () => ({ SnapshotIndexingIndicator: () => null }))
vi.mock('./NetworkTransferDialog', () => ({ NetworkTransferDialog: () => null }))
vi.mock('./NetworkBatchCommandDialog', () => ({ NetworkBatchCommandDialog: () => null }))
beforeEach(async () => { await i18n.changeLanguage('es') })
afterEach(cleanup)

describe('Network tag filters', () => {
  it('restores URL filters, hides row tags, and resets pagination on search', async () => {
    const networkSummaries = vi.fn(async () => ({ page: 2, size: 25, totalElements: 1, totalPages: 3, items: [{
      id: 1, name: 'Repository', acronym: 'REPO', institutionName: 'Institution', tags: ['piloto'],
      latestSnapshot: null, lastValidSnapshotId: null,
      runtime: { runningCount: 0, queuedCount: 0, scheduledCount: 0, running: [], queued: [], scheduled: [] },
    }] }))
    const client = { networkSummaries, networkTags: vi.fn(async () => ['piloto', 'pais:ar']), capabilities: vi.fn(async () => ({ actions: [] })) } as unknown as ApiClient
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={['/networks?page=2&tag=pais:ar&tagMode=any&q=repo']}><NetworkListPage client={client} /></MemoryRouter></QueryClientProvider>)
    await screen.findByText('Repository')
    const restored = networkSummaries.mock.calls[0] as unknown as [URLSearchParams]
    expect(restored[0].getAll('tag')).toEqual(['pais:ar'])
    expect(restored[0].get('tagMode')).toBe('any')
    expect(restored[0].get('page')).toBe('2')
    expect(screen.queryByText('piloto')).toBeNull()
    fireEvent.change(screen.getByPlaceholderText('networks.search'), { target: { value: 'updated' } })
    await waitFor(() => {
      const calls = networkSummaries.mock.calls as unknown as [URLSearchParams][]
      expect(calls.at(-1)![0].getAll('tag')).toEqual(['pais:ar'])
      expect(calls.at(-1)![0].get('page')).toBe('0')
      expect(calls.at(-1)![0].get('q')).toBe('updated')
    })
  })
})


describe('Validation snapshot lifecycle', () => {
  it.each([
    ['VALIDATING', 'Validando'],
    ['VALIDATION_FINISHED_ERROR', 'Error de validación'],
    ['VALIDATION_STOPPED', 'Validación detenida'],
    ['VALID', 'Validado'],
  ])('shows %s with its translated label', async (status, label) => {
    const client = {
      networkSummaries: vi.fn(async () => ({ page: 0, size: 25, totalElements: 1, totalPages: 1, items: [{
        id: 1, name: 'Repository', acronym: 'REPO', institutionName: 'Institution', tags: [],
        latestSnapshot: { id: 2, networkId: 1, status, indexStatus: 'UNKNOWN', size: 100, validSize: 90, transformedSize: 20, startTime: '2026-01-01T00:00:00Z', endTime: '2026-01-01T01:00:00Z', deleted: false },
        lastValidSnapshotId: status === 'VALID' ? 2 : 1, lastValidSnapshotAt: '2026-01-01T01:00:00Z',
        runtime: { runningCount: 0, queuedCount: 0, scheduledCount: 0, running: [], queued: [], scheduled: [] },
      }] })),
      networkTags: vi.fn(async () => []), capabilities: vi.fn(async () => ({ actions: [] })),
    } as unknown as ApiClient
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={cache}><MemoryRouter><NetworkListPage client={client} /></MemoryRouter></QueryClientProvider>)
    expect(await screen.findByText(label)).toBeInTheDocument()
  })
})
