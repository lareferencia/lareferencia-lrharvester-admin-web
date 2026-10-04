import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../../api/client'
import type { TaskExecution, TaskManagerSettings } from '../../api/types'
import { queryKeys } from '../../api/query-keys'
import i18n from '../../i18n'
import { RuntimeQueuePanel } from './RuntimeQueuePanel'
import { TaskManagerConfigurationPanel } from './TaskManagerConfigurationPanel'

beforeEach(async () => { await i18n.changeLanguage('es') })
afterEach(cleanup)

const settings: TaskManagerSettings = { concurrentTasks: 4, maxQueuedTasks: 32, resultRetentionSeconds: 3600, maxRetainedResults: 1000, shutdownTimeoutSeconds: 30 }
function task(id: string, source: string, overrides: Partial<TaskExecution> = {}): TaskExecution {
  return { executionId: id, groupId: source, contextId: source, serialLaneId: null,
    workerName: 'harvestingWorker', networkId: 1, networkAcronym: source, state: 'RUNNING', waitingReason: null,
    admittedAt: '2026-10-03T10:00:00Z', startedAt: null, finishedAt: null, failure: null, ...overrides }
}

function openPanel(kind: 'queue' | 'configuration', tasks: TaskExecution[] = [], applied = settings) {
  const response = { configuration: applied, persisted: true, updatedAt: null, updatedBy: null }
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  cache.setQueryData(queryKeys.runtimeExecutions, tasks)
  cache.setQueryData(queryKeys.runtimeConfiguration, response)
  const updateRuntimeConfiguration = vi.fn(async (configuration: TaskManagerSettings) => ({ ...response, configuration }))
  const client = { runtimeExecutions: vi.fn(async () => tasks), runtimeConfiguration: vi.fn(async () => response), updateRuntimeConfiguration } as unknown as ApiClient
  render(<QueryClientProvider client={cache}>{kind === 'queue' ? <RuntimeQueuePanel client={client} /> : <TaskManagerConfigurationPanel client={client} />}</QueryClientProvider>)
  return { updateRuntimeConfiguration }
}

describe('Runtime queue presentation', () => {
  it('counts reserved and cancelling tasks as occupied slots, excluding completed tasks', () => {
    openPanel('queue', [task('a', 'PA'), task('b', 'UY', { state: 'DISPATCHED' }),
      task('c', 'CR', { state: 'CANCEL_REQUESTED' }), task('d', 'PA', { state: 'QUEUED', waitingReason: 'CONTEXT_BUSY' }),
      task('old', 'BR', { state: 'COMPLETED', serialLaneId: 99 })])
    expect(screen.getByRole('progressbar', { name: 'Plazas de ejecución ocupadas' }).getAttribute('aria-valuetext')).toBe('3 / 4')
    expect(screen.getByRole('progressbar', { name: 'Tareas en espera' }).getAttribute('aria-valuetext')).toBe('1 / 32')
    expect(screen.queryByRole('button', { name: /Detalle técnico/ })).toBeNull()
    expect(screen.queryByText('BR')).toBeNull()
    expect(screen.getByText('Orden de la fuente: 1')).toBeTruthy()
  })

  it('explains the blocking source and puts lane IDs in a closed diagnostic section', async () => {
    openPanel('queue', [task('a', 'PA', { serialLaneId: 1, workerName: 'frontendIndexerWorker' }),
      task('b', 'UY', { serialLaneId: 1, state: 'QUEUED', waitingReason: 'LANE_BUSY', workerName: 'frontendIndexerWorker' }),
      task('c', 'UY', { serialLaneId: 1, state: 'QUEUED', waitingReason: 'CONTEXT_ORDER', workerName: 'xoaiIndexerWorker' }),
      task('old', 'BR', { serialLaneId: 99, state: 'COMPLETED' })])
    expect(screen.getByText('Recurso ocupado por PA')).toBeTruthy()
    expect(screen.queryByRole('table', { name: /Detalle técnico de recursos/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar detalle de UY' }))
    expect(screen.getByText(/El recurso está ocupado por Indexación del buscador de PA/)).toBeTruthy()
    const details = screen.getByRole('button', { name: /Detalle técnico de recursos/ })
    expect(details.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(details)
    const table = await screen.findByRole('table', { name: /Detalle técnico de recursos/ })
    const row = within(table).getAllByRole('row')[1]
    expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['1', 'Indexación del buscador · PAEn ejecución', '2', '1'])
    expect(within(table).queryByText('99')).toBeNull()
  })

  it('preserves admission order and shows an unknown task name without losing it', () => {
    openPanel('queue', [task('a', 'PA', { state: 'QUEUED', waitingReason: 'GLOBAL_CAPACITY', workerName: 'validationWorker' }),
      task('b', 'PA', { state: 'QUEUED', waitingReason: 'CONTEXT_ORDER', workerName: 'customStep' })], { ...settings, maxQueuedTasks: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar detalle de PA' }))
    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['Validación y transformación', 'customStep'])
    expect(screen.getByText('Sobre el nuevo límite')).toBeTruthy()
  })
})

describe('Runtime configuration effects', () => {
  it('previews a lower limit and submits all settings, including collapsed fields', async () => {
    const { updateRuntimeConfiguration } = openPanel('configuration')
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Tareas simultáneas' }), { target: { value: '2' } })
    expect(screen.getByText(/Al aplicar: hasta 2 tareas simultáneas y 32 tareas en espera/)).toBeTruthy()
    expect(screen.getByText(/Estás reduciendo un límite/)).toBeTruthy()
    expect(screen.getByText('Valor aplicado: 4')).toBeTruthy()
    expect(screen.queryByRole('spinbutton', { name: /Duración del historial/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y aplicar' }))
    await waitFor(() => expect(updateRuntimeConfiguration).toHaveBeenCalledWith({ ...settings, concurrentTasks: 2 }))
  })

  it('explains zero waiting capacity and prevents invalid values being saved', () => {
    openPanel('configuration')
    expect(screen.getByText(/Con 0, solo se acepta trabajo que pueda empezar inmediatamente/)).toBeTruthy()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Máximo de tareas en espera' }), { target: { value: '-1' } })
    expect(screen.getByRole('button', { name: 'Guardar y aplicar' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/Introduce un entero entre 0/)).toBeTruthy()
  })

  it('explains temporary retention and shutdown inside the advanced section', async () => {
    openPanel('configuration')
    fireEvent.click(screen.getByRole('button', { name: 'Historial reciente y apagado' }))
    await screen.findByRole('spinbutton', { name: 'Duración del historial reciente (segundos)' })
    expect(screen.getByText(/no elimina snapshots, metadatos ni sus logs/)).toBeTruthy()
    expect(screen.getByText(/se retiran los más antiguos aunque no haya vencido/)).toBeTruthy()
    expect(screen.getByText(/Con 0 no hay espera adicional/)).toBeTruthy()
  })

  it.each(['en', 'pt'])('provides explanations in %s', async language => {
    await i18n.changeLanguage(language)
    openPanel('configuration')
    expect(screen.getByText(i18n.t('runtime.configuration.executionHelp'))).toBeTruthy()
    expect(screen.queryByText(/runtime\.configuration\./)).toBeNull()
  })
})
