import { useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Divider, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ApiClient } from '../../api/client'
import type { TaskExecution } from '../../api/types'
import { queryKeys } from '../../api/query-keys'

const isActive = (execution: TaskExecution) => ['DISPATCHED', 'RUNNING', 'CANCEL_REQUESTED'].includes(execution.state)
const laneOf = (execution: TaskExecution) => execution.serialLaneId != null && execution.serialLaneId >= 0 ? execution.serialLaneId : null
const sourceOf = (execution: TaskExecution) => execution.networkAcronym || execution.contextId

export function RuntimeQueuePanel({ client }: { client: ApiClient }) {
  const { t, i18n } = useTranslation()
  const executions = useQuery({ queryKey: queryKeys.runtimeExecutions, queryFn: () => client.runtimeExecutions(), refetchInterval: 10_000 })
  const configuration = useQuery({ queryKey: queryKeys.runtimeConfiguration, queryFn: () => client.runtimeConfiguration(), refetchInterval: 10_000, refetchOnWindowFocus: false })
  const all = executions.data || []
  const live = all.filter(execution => isActive(execution) || execution.state === 'QUEUED')
  const active = live.filter(isActive)
  const queued = live.filter(execution => execution.state === 'QUEUED')
  // Terminal snapshots provide observed, currently free lanes. No configured lane inventory is inferred.
  const lanes = [...new Set(all.map(laneOf).filter((lane): lane is number => lane != null))].sort((a, b) => a - b)
  const contexts = new Map<string, TaskExecution[]>()
  live.forEach(execution => {
    const own = contexts.get(execution.contextId) || []
    own.push(execution)
    contexts.set(execution.contextId, own)
  })
  const orderedContexts = [...contexts.entries()].sort(([idA, a], [idB, b]) =>
    b.filter(e => e.state === 'QUEUED').length - a.filter(e => e.state === 'QUEUED').length || idA.localeCompare(idB, i18n.language))
  const settings = configuration.data?.configuration
  const available = executions.data !== undefined
  return <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ p: 2 }}>
      <Box><Typography variant="h6">{t('runtime.queues.title')}</Typography><Typography variant="body2" color="text.secondary">{t('runtime.queues.subtitle')}</Typography></Box>
      {available && <Typography variant="caption" color="text.secondary" sx={{ alignSelf: { sm: 'center' }, whiteSpace: 'nowrap' }}>{t('runtime.queues.updated', { time: new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(executions.dataUpdatedAt)) })}</Typography>}
    </Stack>
    {executions.isError && <Alert severity={available ? 'warning' : 'error'} sx={{ mx: 2, mb: 2 }}>{t(available ? 'runtime.queues.stale' : 'runtime.queues.loadError')} <Button size="small" onClick={() => void executions.refetch()}>{t('runtime.configuration.retry')}</Button></Alert>}
    {configuration.isError && <Alert severity="warning" sx={{ mx: 2, mb: 2 }}>{t('runtime.queues.limitsError')}</Alert>}
    {!available && executions.isLoading && <Box sx={{ p: 2 }}><CircularProgress size={24} /></Box>}
    {available && <>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ px: 2, pb: 2 }}>
        <CapacityBar label={t('runtime.queues.active')} value={active.length} max={settings?.concurrentTasks} />
        <CapacityBar label={t('runtime.queues.pending')} value={queued.length} max={settings?.maxQueuedTasks} />
      </Stack>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 2, pb: 2 }}>{t('runtime.queues.activeHelp')}</Typography>
      <Divider />
      <Box sx={{ px: 2, pt: 2 }}><Typography variant="subtitle1" fontWeight={600}>{t('runtime.queues.lanes')}</Typography><Typography variant="caption" color="text.secondary">{t('runtime.queues.laneHelp')}</Typography></Box>
      {lanes.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{t('runtime.queues.noLanes')}</Typography>}
      {lanes.length > 0 && <TableContainer><Table size="small" aria-label={t('runtime.queues.lanes')}>
        <TableHead><TableRow><TableCell>{t('runtime.queues.lane')}</TableCell><TableCell>{t('runtime.queues.occupancy')}</TableCell><TableCell>{t('runtime.queues.worker')}</TableCell><TableCell align="right">{t('runtime.queues.pending')}</TableCell></TableRow></TableHead>
        <TableBody>{lanes.map(lane => {
          const owner = active.find(execution => laneOf(execution) === lane)
          const waiting = queued.filter(execution => laneOf(execution) === lane).length
          return <TableRow key={lane}><TableCell sx={{ width: 80 }}>{lane}</TableCell><TableCell sx={{ width: 190 }}>{owner ? <ExecutionState execution={owner} /> : <Chip size="small" variant="outlined" label={t('runtime.queues.free')} />} <Typography variant="caption" color="text.secondary">{owner ? '1 / 1' : '0 / 1'}</Typography></TableCell><TableCell>{owner ? `${owner.workerName} · ${sourceOf(owner)}` : '—'}</TableCell><TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{waiting}</TableCell></TableRow>
        })}</TableBody>
      </Table></TableContainer>}
      {live.some(execution => laneOf(execution) == null) && <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>{t('runtime.queues.withoutLane', { active: active.filter(e => laneOf(e) == null).length, queued: queued.filter(e => laneOf(e) == null).length })}</Typography>}
      <Divider sx={{ mt: 1 }} />
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1} sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={600}>{t('runtime.queues.contexts')}</Typography><Typography variant="caption" color="text.secondary">{t('runtime.queues.contextHelp')}</Typography></Stack>
      {orderedContexts.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>{t('runtime.queues.empty')}</Typography>}
      {orderedContexts.map(([context, own]) => <ContextQueue key={context} context={context} executions={own} />)}
    </>}
  </Paper>
}

function CapacityBar({ label, value, max }: { label: string; value: number; max: number | undefined }) {
  const { t } = useTranslation()
  const over = max !== undefined && value > max
  const full = max !== undefined && max > 0 && value >= max
  const percentage = max === undefined || max === 0 ? 0 : Math.min(100, value / max * 100)
  return <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
    <Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="body2" fontWeight={600}>{label}</Typography><Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{value} / {max ?? '—'}</Typography></Stack>
    <LinearProgress variant="determinate" value={over ? 100 : percentage} color={over || full ? 'warning' : 'primary'} aria-label={label} aria-valuetext={`${value} / ${max ?? '—'}`} sx={{ height: 6, borderRadius: 1, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { transition: 'none' } }} />
    <Typography variant="caption" color={over ? 'warning.main' : 'text.secondary'}>{t(max === undefined ? 'runtime.queues.unknownLimit' : over ? 'runtime.queues.overLimit' : max === 0 ? 'runtime.queues.noQueue' : full ? 'runtime.queues.full' : 'runtime.queues.percent', { percent: Math.round(percentage) })}</Typography>
  </Stack>
}

function ExecutionState({ execution }: { execution: TaskExecution }) {
  const { t } = useTranslation()
  return <Chip size="small" variant="outlined" color={execution.state === 'CANCEL_REQUESTED' ? 'warning' : 'primary'} label={t(`runtime.queues.states.${execution.state}`)} />
}

function ContextQueue({ context, executions }: { context: string; executions: TaskExecution[] }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const owner = executions.find(isActive)
  // Snapshot live entries preserve coordinator admission order, including FIFO across separate plans.
  const pending = executions.filter(execution => execution.state === 'QUEUED')
  const visible = expanded ? pending : pending.slice(0, 3)
  const reason = pending[0]?.waitingReason
  return <Box sx={{ px: 2, pb: 2, '&:not(:last-child)': { borderBottom: 1, borderColor: 'divider', mb: 2 } }}>
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
      <Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={600}>{sourceOf(executions[0])}</Typography><Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{context}</Typography></Box>
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{t('runtime.queues.waiting', { count: pending.length })}</Typography>
    </Stack>
    <Stack direction="row" alignItems="center" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {owner && <Tooltip title={`${owner.workerName} · ${t(`runtime.queues.states.${owner.state}`)}`}><Chip size="small" variant="outlined" color={owner.state === 'CANCEL_REQUESTED' ? 'warning' : 'primary'} label={`${owner.workerName} · ${t(`runtime.queues.states.${owner.state}`)}`} sx={{ maxWidth: '100%' }} /></Tooltip>}
      {visible.map((execution, index) => <Stack direction="row" alignItems="center" spacing={1} key={execution.executionId} sx={{ maxWidth: '100%', minWidth: 0 }}>
        {(owner || index > 0) && <Typography color="text.secondary" aria-hidden>→</Typography>}
        <Tooltip title={execution.workerName}><Chip size="small" variant="outlined" label={execution.workerName} sx={{ maxWidth: '100%' }} /></Tooltip>
      </Stack>)}
      {pending.length > 3 && <Button size="small" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{t(expanded ? 'runtime.queues.less' : 'runtime.queues.more', { count: pending.length - 3 })}</Button>}
    </Stack>
    {reason && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>{t(`runtime.queues.reasons.${reason}`, { defaultValue: reason })}</Typography>}
    {owner?.waitingReason === 'EXECUTOR_UNAVAILABLE' && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>{t('runtime.queues.reasons.EXECUTOR_UNAVAILABLE')}</Typography>}
  </Box>
}
