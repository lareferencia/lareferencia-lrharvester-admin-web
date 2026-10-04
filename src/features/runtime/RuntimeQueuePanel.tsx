import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, Divider, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ApiClient } from '../../api/client'
import type { TaskExecution } from '../../api/types'
import { queryKeys } from '../../api/query-keys'
import { RuntimeSourceTable } from './RuntimeSourceTable'

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
  const lanes = [...new Set(live.map(laneOf).filter((lane): lane is number => lane != null))].sort((a, b) => a - b)
  const settings = configuration.data?.configuration
  const available = executions.data !== undefined
  const reasons = [
    { label: 'sourceWait', count: queued.filter(e => ['CONTEXT_ORDER', 'CONTEXT_BUSY'].includes(e.waitingReason || '')).length },
    { label: 'resourceWait', count: queued.filter(e => e.waitingReason === 'LANE_BUSY').length },
    { label: 'capacityWait', count: queued.filter(e => e.waitingReason === 'GLOBAL_CAPACITY').length },
  ]
  return <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ p: 2 }}>
      <Box><Typography variant="h6">{t('runtime.queues.title')}</Typography><Typography variant="body2" color="text.secondary">{t('runtime.queues.subtitle')}</Typography></Box>
      {available && <Typography variant="caption" color="text.secondary" sx={{ alignSelf: { sm: 'center' }, whiteSpace: 'nowrap' }}>{t('runtime.queues.updated', { time: new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(executions.dataUpdatedAt)) })}</Typography>}
    </Stack>
    {executions.isError && <Alert severity={available ? 'warning' : 'error'} sx={{ mx: 2, mb: 2 }}>{t(available ? 'runtime.queues.stale' : 'runtime.queues.loadError')} <Button size="small" onClick={() => void executions.refetch()}>{t('runtime.configuration.retry')}</Button></Alert>}
    {configuration.isError && <Alert severity="warning" sx={{ mx: 2, mb: 2 }}>{t('runtime.queues.limitsError')}</Alert>}
    {!available && executions.isLoading && <Box sx={{ p: 2 }}><CircularProgress size={24} /></Box>}
    {available && <>
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>{t('runtime.queues.overview')}</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ px: 2, pb: 2 }}>
        <CapacityBar label={t('runtime.queues.active')} value={active.length} max={settings?.concurrentTasks} help={t('runtime.queues.activeHelp')} />
        <CapacityBar label={t('runtime.queues.pending')} value={queued.length} max={settings?.maxQueuedTasks} help={t('runtime.queues.pendingHelp')} />
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{ px: 2, pb: 2, flexWrap: 'wrap' }}>
        {(['RUNNING', 'DISPATCHED', 'CANCEL_REQUESTED'] as const).map(state => {
          const count = active.filter(e => e.state === state).length
          return count > 0 && <Chip key={state} size="small" variant="outlined" label={`${t(`runtime.queues.states.${state}`)}: ${count}`} />
        })}
        {queued.length > 0 && <Typography variant="body2" sx={{ alignSelf: 'center' }}>{t('runtime.queues.reasonsTitle')}:</Typography>}
        {reasons.filter(reason => reason.count > 0).map(reason => <Chip key={reason.label} size="small" variant="outlined" label={`${t(`runtime.queues.${reason.label}`)}: ${reason.count}`} />)}
      </Stack>
      <Alert severity="info" sx={{ mx: 2, mb: 2 }}>{t('runtime.queues.schedulingHelp')}</Alert>
      <Divider />
      <RuntimeSourceTable executions={live} />
      {lanes.length > 0 && <Accordion disableGutters elevation={0} sx={{ borderTop: 1, borderColor: 'divider', '&:before': { display: 'none' } }} slotProps={{ transition: { unmountOnExit: true } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2" fontWeight={600}>{t('runtime.queues.laneDetails')}</Typography></AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('runtime.queues.laneHelp')}</Typography>
          <TableContainer><Table size="small" aria-label={t('runtime.queues.laneDetails')}>
            <TableHead><TableRow><TableCell>{t('runtime.queues.lane')}</TableCell><TableCell>{t('runtime.queues.worker')}</TableCell><TableCell align="right">{t('runtime.queues.laneScheduled')}</TableCell><TableCell align="right">{t('runtime.queues.laneBlocked')}</TableCell></TableRow></TableHead>
            <TableBody>{lanes.map(lane => {
              const owner = active.find(execution => laneOf(execution) === lane)
              const pending = queued.filter(execution => laneOf(execution) === lane)
              return <TableRow key={lane}><TableCell>{lane}</TableCell><TableCell>{owner ? <Stack spacing={0.5}><Typography variant="body2">{t(`runtime.queues.workerNames.${owner.workerName}`, { defaultValue: owner.workerName })} · {sourceOf(owner)}</Typography><Box><ExecutionState execution={owner} /></Box></Stack> : t('runtime.queues.free')}</TableCell><TableCell align="right">{pending.length}</TableCell><TableCell align="right">{pending.filter(e => e.waitingReason === 'LANE_BUSY').length}</TableCell></TableRow>
            })}</TableBody>
          </Table></TableContainer>
        </AccordionDetails>
      </Accordion>}
    </>}
  </Paper>
}

function CapacityBar({ label, value, max, help }: { label: string; value: number; max: number | undefined; help: string }) {
  const { t } = useTranslation()
  const over = max !== undefined && value > max
  const full = max !== undefined && max > 0 && value >= max
  const percentage = max === undefined || max === 0 ? 0 : Math.min(100, value / max * 100)
  return <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
    <Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="body2" fontWeight={600}>{label}</Typography><Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{value} / {max ?? '—'}</Typography></Stack>
    <LinearProgress variant="determinate" value={over ? 100 : percentage} color={over || full ? 'warning' : 'primary'} aria-label={label} aria-valuetext={`${value} / ${max ?? '—'}`} sx={{ height: 6, borderRadius: 1, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { transition: 'none' } }} />
    <Typography variant="caption" color={over ? 'warning.main' : 'text.secondary'}>{t(max === undefined ? 'runtime.queues.unknownLimit' : over ? 'runtime.queues.overLimit' : max === 0 ? 'runtime.queues.noQueue' : full ? 'runtime.queues.full' : 'runtime.queues.percent', { percent: Math.round(percentage) })}</Typography>
    <Typography variant="body2" color="text.secondary">{help}</Typography>
  </Stack>
}

function ExecutionState({ execution }: { execution: TaskExecution }) {
  const { t } = useTranslation()
  return <Chip size="small" variant="outlined" color={execution.state === 'CANCEL_REQUESTED' ? 'warning' : 'primary'} label={t(`runtime.queues.states.${execution.state}`)} />
}
