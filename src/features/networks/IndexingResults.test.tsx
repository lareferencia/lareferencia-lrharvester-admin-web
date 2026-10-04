import i18n from '../../i18n'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../../api/client'
import type { Snapshot } from '../../api/types'
import { IndexingResults, NetworkIndexingResults } from './IndexingResults'

beforeEach(async () => { await i18n.changeLanguage('es') })
afterEach(cleanup)

describe('Indexing results', () => {
  it('shows each worker result independently, with the failed attempt reason', () => {
    render(<IndexingResults results={{
      frontendIndexerWorker: { status: 'INDEXED', actionName: 'FRONTEND_INDEXING_ACTION', finishedAt: '2026-10-04T08:00:00Z', error: null },
      xoaiIndexerWorker: { status: 'FAILED', actionName: 'XOAI_INDEXING_ACTION', finishedAt: '2026-10-04T08:01:00Z', error: 'Solr commit failed' },
    }} />)
    const frontend = screen.getByText(i18n.t('actions.workerNames.frontendIndexerWorker')).closest('tr')!
    const xoai = screen.getByText(i18n.t('actions.workerNames.xoaiIndexerWorker')).closest('tr')!
    expect(within(frontend).getByText(i18n.t('indexing.ok'))).toBeInTheDocument()
    expect(within(xoai).getByText(i18n.t('indexing.failure'))).toBeInTheDocument()
    expect(screen.getByText('Solr commit failed')).toBeInTheDocument()
  })

  it('does not invent results for historical snapshots', () => {
    render(<IndexingResults />)
    expect(screen.getByText('No hay resultados de indexación registrados para este snapshot.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('localizes indexing states in English', async () => {
    await i18n.changeLanguage('en')
    render(<IndexingResults results={{ semanticIndexerWorker: { status: 'FAILED', actionName: null, finishedAt: '2026-10-04T08:00:00Z', error: 'Embedding generation failed' } }} />)
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Indexing results' })).toBeInTheDocument()
  })

  it('distinguishes an API error from an empty result map', async () => {
    const client = { networkSnapshots: vi.fn().mockRejectedValue(new Error('Unavailable')) } as unknown as ApiClient
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={cache}><NetworkIndexingResults client={client} networkId={1} /></QueryClientProvider>)
    expect(await screen.findByText('No se pudieron cargar los resultados de indexación.')).toBeInTheDocument()
    expect(screen.queryByText('No hay resultados de indexación registrados para este snapshot.')).not.toBeInTheDocument()
  })

  it('shows the selected snapshot results without mixing different snapshots', async () => {
    const base = { networkId: 1, status: 'VALID', indexStatus: 'INDEXED', startTime: null, endTime: null, size: 1, validSize: 1, transformedSize: 1, deleted: false }
    const items: Snapshot[] = [
      { ...base, id: 2, indexingResults: { currentIndexer: { status: 'INDEXED', actionName: null, finishedAt: '2026-10-04T08:00:00Z', error: null } } },
      { ...base, id: 1, indexingResults: { previousIndexer: { status: 'FAILED', actionName: null, finishedAt: '2026-10-03T08:00:00Z', error: 'Previous failure' } } },
    ]
    const client = { networkSnapshots: vi.fn().mockResolvedValue({ items }) } as unknown as ApiClient
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={cache}><NetworkIndexingResults client={client} networkId={1} /></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('indexing.indicatorLabel', { id: 2, state: i18n.t('indexing.ok') }) }))
    expect(await screen.findByText('currentIndexer')).toBeInTheDocument()
    expect(screen.queryByText('previousIndexer')).not.toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: i18n.t('common.close') }))
    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: '#1' }))
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('indexing.indicatorLabel', { id: 1, state: i18n.t('indexing.ok') }) }))
    expect(await screen.findByText('previousIndexer')).toBeInTheDocument()
    expect(screen.queryByText('currentIndexer')).not.toBeInTheDocument()
  })
})
