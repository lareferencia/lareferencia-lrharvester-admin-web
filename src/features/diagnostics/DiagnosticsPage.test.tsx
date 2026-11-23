import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../../api/client'
import { ApiError } from '../../api/problem-detail'
import type { DiagnosticRule, Snapshot } from '../../api/types'
import { uiText } from '../../i18n'
import { DiagnosticsPage } from './DiagnosticsPage'

afterEach(cleanup)
const snapshot: Snapshot = { id: 6, networkId: 33, status: 'VALID', deleted: false, indexStatus: '', startTime: null, endTime: null, size: 4, validSize: 2, transformedSize: 1 }
const rule: DiagnosticRule = { ruleId: 5, name: 'Idioma', description: null, quantifier: null, mandatory: null, validCount: 2, invalidCount: 2 }
const record = {
  id: 'row', identifier: 'oai:test', snapshotId: 6, valid: false, transformed: false,
  validRuleIds: [], invalidRuleIds: ['5'], validOccurrencesByRuleId: {}, invalidOccurrencesByRuleId: {},
}
function fixture() {
  return {
    network: vi.fn().mockResolvedValue({ name: 'Red de prueba', acronym: 'NET' }),
    latestValidSnapshot: vi.fn().mockResolvedValue(snapshot),
    snapshot: vi.fn().mockResolvedValue(snapshot),
    networkSnapshots: vi.fn().mockResolvedValue({ items: [snapshot], totalPages: 1 }),
    diagnosticRecords: vi.fn().mockResolvedValue({ items: [record], totalPages: 1 }),
    diagnosticSummary: vi.fn().mockResolvedValue({ size: 4, validSize: 2, transformedSize: 1, rules: [rule] }),
    diagnosticOccurrences: vi.fn().mockResolvedValue({ valid: [], invalid: [] }),
    diagnosticMetadata: vi.fn().mockResolvedValue('<metadata/>'),
  }
}
function open(client: ReturnType<typeof fixture>, search = '') {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={['/networks/33/diagnostics' + search]}>
    <DiagnosticsPage client={client as unknown as ApiClient} networkId={33} />
  </MemoryRouter></QueryClientProvider>)
}
describe('Historical diagnostics in Admin', () => {
  it.each([{ networkId: 1 }, { deleted: true }])('rejects an unavailable snapshot before querying its report (%j)', async change => {
    const client = fixture()
    client.snapshot.mockResolvedValue({ ...snapshot, ...change })
    open(client, '?snapshot=6')
    expect(await screen.findByText(uiText('unavailableSnapshot'))).toBeVisible()
    expect(client.diagnosticRecords).not.toHaveBeenCalled()
    expect(client.diagnosticSummary).not.toHaveBeenCalled()
  })
  it('handles a network with no valid snapshots', async () => {
    const client = fixture()
    client.latestValidSnapshot.mockRejectedValue(new ApiError({ status: 404 }, 404))
    open(client)
    expect(await screen.findByRole('alert')).toHaveTextContent(/snapshot/i)
    expect(client.diagnosticRecords).not.toHaveBeenCalled()
  })
  it('opens the latest valid snapshot outside the first 100 and pages through history', async () => {
    const client = fixture()
    const recent = Array.from({ length: 100 }, (_, i) => ({ ...snapshot, id: 110 - i, status: 'HARVESTING' }))
    client.networkSnapshots.mockImplementation(async (_, page) => ({ items: page === 0 ? recent : [snapshot], totalPages: 2 }))
    open(client)
    expect(await screen.findByText(record.identifier)).toBeVisible()
    expect(client.latestValidSnapshot).toHaveBeenCalledWith(33)
    expect(client.diagnosticSummary).toHaveBeenCalledWith(6, [])
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }))
    await waitFor(() => expect(client.networkSnapshots).toHaveBeenCalledWith(33, 1))
  })
  it('distinguishes a failed page from a successful empty page and retries the same filters', async () => {
    const client = fixture()
    client.diagnosticRecords.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue({ items: [], totalPages: 0 })
    open(client, '?snapshot=6&identifier=abc&page=2')
    expect(await screen.findByText(uiText('recordsReadError'))).toBeVisible()
    expect(screen.queryByText(uiText('noFilteredRecords'))).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: uiText('retryRead') }))
    expect(await screen.findByText(uiText('noFilteredRecords'))).toBeVisible()
    expect(client.diagnosticRecords.mock.calls).toEqual(Array(2).fill([6, { filters: [{ field: 'IDENTIFIER', operator: 'CONTAINS', value: 'abc' }], page: 2, size: 25 }]))
  })
  it('loads published XML only after the tab opens and resets the tab when the record is reopened', async () => {
    const client = fixture()
    open(client)
    const detail = await screen.findByRole('button', { name: uiText('detail') })
    fireEvent.click(detail)
    expect(client.diagnosticMetadata).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('tab', { name: uiText('transformedXml') }))
    expect(await screen.findByText('<metadata/>')).toBeVisible()
    expect(client.diagnosticMetadata).toHaveBeenCalledWith(6, record.identifier)
    fireEvent.click(screen.getByRole('button', { name: uiText('close') }))
    fireEvent.click(detail)
    expect(screen.getByRole('tab', { name: uiText('transformedXml') })).toHaveAttribute('aria-selected', 'false')
  })
  it.each([
    [false, 'captureDisabled'], [null, 'captureUnknown'], [true, 'noOccurrences'],
  ] as const)('explains empty frequencies with capture %s', async (capture, key) => {
    const client = fixture()
    client.diagnosticSummary.mockResolvedValue({ size: 4, rules: [{ ...rule, occurrenceCaptureEnabled: capture }] })
    open(client)
    fireEvent.click(await screen.findByRole('button', { name: uiText('occurrences') }))
    expect(await within(screen.getByRole('dialog')).findByText(uiText(key))).toBeVisible()
    expect(client.diagnosticOccurrences).toHaveBeenCalledTimes(capture === false ? 0 : 1)
  })
  it('submits the identifier once and resets the record page', async () => {
    const client = fixture()
    open(client, '?snapshot=6&page=1')
    const input = await screen.findByLabelText(uiText('searchIdentifier'))
    await screen.findByText(record.identifier)
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'all' } })
    expect(client.diagnosticRecords).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: uiText('applySearch') }))
    await waitFor(() => expect(client.diagnosticRecords).toHaveBeenLastCalledWith(6, {
      filters: [{ field: 'IDENTIFIER', operator: 'CONTAINS', value: 'all' }], page: 0, size: 25,
    }))
  })
})
