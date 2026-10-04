import i18n from '../../i18n'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../../api/client'
import type { Network, NetworkRequest } from '../../api/types'
import { NetworkEditPage } from './NetworkEditPage'

vi.mock('react-i18next', async importOriginal => ({ ...await importOriginal<typeof import('react-i18next')>(), useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }) }))

beforeEach(async () => { await i18n.changeLanguage('es') })
afterEach(cleanup)

async function openEditor(sets: string[] = [], formats: Partial<Pick<Network, 'metadataPrefix' | 'metadataStoreSchema'>> = {}) {
  let saved: Network = {
    id: 1, acronym: 'PA', name: 'Panamá', institutionName: 'SENACYT', institutionAcronym: null,
    published: false, originUrl: 'https://oai.lareferencia.info/request', metadataPrefix: 'oai_dc',
    metadataStoreSchema: 'xoai', sets, attributes: {}, properties: {}, scheduleCronExpression: null,
    prevalidatorId: null, validatorId: null, transformerId: null, secondaryTransformerId: null,
    ...formats,
  }
  const updateNetwork = vi.fn(async (_id: number, request: NetworkRequest) => {
    saved = { id: 1, ...request }
    return saved
  })
  const client = {
    network: vi.fn(async () => saved), updateNetwork, networkTags: vi.fn(async () => ['piloto']),
    validators: vi.fn(async () => ({ items: [] })), transformers: vi.fn(async () => ({ items: [] })),
    attributeProfiles: vi.fn(async () => []),
    capabilities: vi.fn(async () => ({ metadataFormats: ['oai_dc', 'datacite'], metadataStoreSchemas: ['xoai', 'oai_dc'] })),
    applicationActions: vi.fn(async () => []), networkRuntime: vi.fn(async () => []), networkActions: vi.fn(async () => []),
  } as unknown as ApiClient
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={['/networks/1/edit']}><Routes><Route path="/networks/:id/edit" element={<NetworkEditPage client={client} />} /></Routes></MemoryRouter></QueryClientProvider>)
  await screen.findByDisplayValue('Panamá')
  return { updateNetwork }
}

function typeSet(value: string) {
  const input = screen.getByRole('combobox', { name: 'networks.sets' })
  act(() => input.focus())
  fireEvent.change(input, { target: { value } })
  return input
}

function clickButton(name: string) {
  const button = screen.getByRole('button', { name })
  act(() => button.focus())
  fireEvent.click(button)
}

describe('NetworkEditPage set persistence', () => {
  it('sends the typed set when saving without pressing Enter and keeps it after refetch', async () => {
    const { updateNetwork } = await openEditor()
    typeSet('PA')
    clickButton('networks.saveChanges')
    await waitFor(() => expect(updateNetwork).toHaveBeenCalledWith(1, expect.objectContaining({ sets: ['PA'] })))
    await screen.findByText('Los cambios de la fuente se guardaron correctamente.')
    expect(screen.getByText('PA', { selector: '.MuiChip-label' }).textContent).toBe('PA')
  })

  it('keeps the typed set when switching tabs before saving', async () => {
    const { updateNetwork } = await openEditor()
    typeSet('PA')
    const tab = screen.getByRole('tab', { name: 'networks.processing' })
    act(() => tab.focus())
    fireEvent.click(tab)
    clickButton('networks.saveChanges')
    await waitFor(() => expect(updateNetwork).toHaveBeenCalledWith(1, expect.objectContaining({ sets: ['PA'] })))
  })

  it('preserves existing sets when adding another set without Enter', async () => {
    const { updateNetwork } = await openEditor(['PA'])
    typeSet(' UY ')
    clickButton('networks.saveChanges')
    await waitFor(() => expect(updateNetwork).toHaveBeenCalledWith(1, expect.objectContaining({ sets: ['PA', 'UY'] })))
  })

  it('allows clearing the set filter intentionally', async () => {
    const { updateNetwork } = await openEditor(['PA'])
    fireEvent.click(screen.getByTestId('CancelIcon'))
    clickButton('networks.saveChanges')
    await waitFor(() => expect(updateNetwork).toHaveBeenCalledWith(1, expect.objectContaining({ sets: [] })))
  })

  it('still allows confirming with Enter without adding the set twice', async () => {
    const { updateNetwork } = await openEditor()
    fireEvent.keyDown(typeSet('PA'), { key: 'Enter' })
    clickButton('networks.saveChanges')
    await waitFor(() => expect(updateNetwork).toHaveBeenCalledWith(1, expect.objectContaining({ sets: ['PA'] })))
  })
})

describe('NetworkEditPage metadata format selectors', () => {
  it.each([null, ''])('shows and saves defaults when stored formats are %s', async value => {
    const { updateNetwork } = await openEditor([], { metadataPrefix: value, metadataStoreSchema: value })
    expect(screen.getByRole('combobox', { name: 'networks.metadataPrefix' }).textContent).toBe('oai_dc')
    expect(screen.getByRole('combobox', { name: 'networks.storageFormat' }).textContent).toBe('xoai')
    clickButton('networks.saveChanges')
    await waitFor(() => expect(updateNetwork).toHaveBeenCalledWith(1, expect.objectContaining({ metadataPrefix: 'oai_dc', metadataStoreSchema: 'xoai' })))
  })

  it('shows the saved formats instead of defaults', async () => {
    await openEditor([], { metadataPrefix: 'datacite', metadataStoreSchema: 'oai_dc' })
    expect(screen.getByRole('combobox', { name: 'networks.metadataPrefix' }).textContent).toBe('datacite')
    expect(screen.getByRole('combobox', { name: 'networks.storageFormat' }).textContent).toBe('oai_dc')
  })

  it('saves new selections and keeps them visible after reloading the source', async () => {
    const { updateNetwork } = await openEditor()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'networks.metadataPrefix' }))
    fireEvent.click(await screen.findByRole('option', { name: 'datacite' }))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'networks.storageFormat' }))
    fireEvent.click(await screen.findByRole('option', { name: 'oai_dc' }))
    clickButton('networks.saveChanges')
    await waitFor(() => expect(updateNetwork).toHaveBeenCalledWith(1, expect.objectContaining({ metadataPrefix: 'datacite', metadataStoreSchema: 'oai_dc' })))
    await screen.findByText('Los cambios de la fuente se guardaron correctamente.')
    expect(screen.getByRole('combobox', { name: 'networks.metadataPrefix' }).textContent).toBe('datacite')
    expect(screen.getByRole('combobox', { name: 'networks.storageFormat' }).textContent).toBe('oai_dc')
  })
})


describe('Network tags', () => {
  it('opens existing tags on focus and saves the selected suggestion', async () => {
    const { updateNetwork } = await openEditor()
    const input = screen.getByRole('combobox', { name: 'networks.tags' })
    act(() => input.focus())
    fireEvent.click(await screen.findByRole('option', { name: 'piloto' }))
    clickButton('networks.saveChanges')
    await waitFor(() => expect(updateNetwork).toHaveBeenCalledWith(1, expect.objectContaining({ tags: ['piloto'] })))
  })

  it('commits a typed tag on blur and normalizes it before saving', async () => {
    const { updateNetwork } = await openEditor()
    const input = screen.getByRole('combobox', { name: 'networks.tags' })
    act(() => input.focus())
    fireEvent.change(input, { target: { value: ' Pais:AR ' } })
    clickButton('networks.saveChanges')
    await waitFor(() => expect(updateNetwork).toHaveBeenCalledWith(1, expect.objectContaining({ tags: ['pais:ar'] })))
    expect(await screen.findByText('pais:ar', { selector: '.MuiChip-label' })).toBeTruthy()
  })
})
