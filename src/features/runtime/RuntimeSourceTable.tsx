import { Fragment, useEffect, useId, useState } from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Box, Button, Chip, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { TaskExecution } from '../../api/types'

const isActive = (task: TaskExecution) => ['DISPATCHED', 'RUNNING', 'CANCEL_REQUESTED'].includes(task.state)
const sourceOf = (task: TaskExecution) => task.networkAcronym || task.contextId
type SourceWork = { context: string; source: string; owner?: TaskExecution; pending: TaskExecution[] }
type SourceFilter = 'all' | 'active' | 'waiting'

export function RuntimeSourceTable({ executions }: { executions: TaskExecution[] }) {
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<SourceFilter>('all')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const contexts = new Map<string, SourceWork>()
  const laneOwners = new Map<number, TaskExecution>()
  executions.forEach(task => {
    const active = isActive(task)
    if (!active && task.state !== 'QUEUED') return
    let source = contexts.get(task.contextId)
    if (!source) {
      source = { context: task.contextId, source: sourceOf(task), pending: [] }
      contexts.set(task.contextId, source)
    }
    if (active) {
      source.owner = task
      if (task.serialLaneId != null && task.serialLaneId >= 0) laneOwners.set(task.serialLaneId, task)
    } else {
      // The snapshot preserves admission order within each source.
      source.pending.push(task)
    }
  })
  const needle = search.trim().toLocaleLowerCase(i18n.language)
  const sources = [...contexts.values()]
    .filter(source => (!needle || `${source.source} ${source.context}`.toLocaleLowerCase(i18n.language).includes(needle))
      && (filter !== 'active' || Boolean(source.owner)) && (filter !== 'waiting' || source.pending.length > 0))
    .sort((a, b) => a.source.localeCompare(b.source, i18n.language, { numeric: true }) || a.context.localeCompare(b.context))
  const currentPage = Math.min(page, Math.max(0, Math.ceil(sources.length / pageSize) - 1))
  useEffect(() => { if (page !== currentPage) setPage(currentPage) }, [page, currentPage])
  return <>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ p: 2 }}>
      <Box><Typography variant="subtitle1" fontWeight={600}>{t('runtime.queues.contexts')}</Typography><Typography variant="caption" color="text.secondary">{t('runtime.queues.contextHelp')}</Typography></Box>
      <Typography variant="caption" color="text.secondary" sx={{ alignSelf: { sm: 'center' } }}>{t('runtime.queues.sourceCount', { shown: sources.length, total: contexts.size })}</Typography>
    </Stack>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ px: 2, pb: 1 }}>
      <TextField size="small" label={t('runtime.queues.searchSource')} value={search} sx={{ flex: 1 }}
        onChange={event => { setSearch(event.target.value); setPage(0) }} />
      <TextField select size="small" label={t('runtime.queues.sourceFilter')} value={filter} sx={{ minWidth: { sm: 220 } }}
        onChange={event => { setFilter(event.target.value as SourceFilter); setPage(0) }}>
        {(['all', 'active', 'waiting'] as const).map(value => <MenuItem key={value} value={value}>{t(`runtime.queues.sourceFilters.${value}`)}</MenuItem>)}
      </TextField>
    </Stack>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pb: 2 }}>{t('runtime.queues.sourceFilterHelp')}</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', md: 'none' }, px: 2, pb: 1 }}>{t('runtime.queues.tableScrollHelp')}</Typography>
    <TableContainer>
      <Table size="small" aria-label={t('runtime.queues.contexts')} sx={{ minWidth: 720, tableLayout: 'fixed' }}>
        <TableHead><TableRow>
          <TableCell sx={{ width: 48 }}><Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>{t('runtime.queues.details')}</Box></TableCell>
          <TableCell sx={{ width: '15%' }}>{t('common.source')}</TableCell>
          <TableCell sx={{ width: '36%' }}>{t('runtime.queues.now')}</TableCell>
          <TableCell align="right" sx={{ width: 110 }}>{t('runtime.queues.pendingSteps')}</TableCell>
          <TableCell>{t('runtime.queues.waitReason')}</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {sources.length === 0 && <TableRow><TableCell colSpan={5} sx={{ py: 3, color: 'text.secondary' }}>{t(contexts.size === 0 ? 'runtime.queues.empty' : 'runtime.queues.noMatchingSources')}</TableCell></TableRow>}
          {sources.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(source => <SourceRow key={source.context} source={source} laneOwners={laneOwners} />)}
        </TableBody>
      </Table>
    </TableContainer>
    <TablePagination component="div" count={sources.length} page={currentPage} rowsPerPage={pageSize} rowsPerPageOptions={[10, 25, 50]}
      labelRowsPerPage={t('runtime.queues.sourcesPerPage')}
      labelDisplayedRows={({ from, to, count }) => t('runtime.queues.pageRange', { from, to, total: count })}
      getItemAriaLabel={type => t(`runtime.queues.pagination.${type}`)}
      onPageChange={(_, nextPage) => setPage(nextPage)}
      onRowsPerPageChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}
      sx={{ '& .MuiTablePagination-toolbar': { px: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }, '& .MuiTablePagination-spacer': { display: { xs: 'none', sm: 'block' } } }} />
  </>
}

function SourceRow({ source, laneOwners }: { source: SourceWork; laneOwners: Map<number, TaskExecution> }) {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [showAllSteps, setShowAllSteps] = useState(false)
  const detailsId = useId()
  const { owner, pending } = source
  const head = pending[0]
  const reason = head?.waitingReason
  const blocker = reason === 'LANE_BUSY' && head.serialLaneId != null ? laneOwners.get(head.serialLaneId) : undefined
  const workerLabel = (task: TaskExecution) => t(`runtime.queues.workerNames.${task.workerName}`, { defaultValue: task.workerName })
  const shortReason = reason ? blocker
    ? t('runtime.queues.resourceOwner', { source: sourceOf(blocker) })
    : t(`runtime.queues.shortReasons.${reason}`, { defaultValue: reason }) : '—'
  const reasonHelp = reason ? blocker
    ? t('runtime.queues.blockedBy', { worker: workerLabel(blocker), source: sourceOf(blocker) })
    : t(`runtime.queues.reasons.${reason}`, { defaultValue: reason }) : undefined
  const timestamp = (value: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  const visible = showAllSteps ? pending : pending.slice(0, 10)
  return <Fragment>
    <TableRow hover sx={{ '& > td, & > th': { borderBottom: expanded ? 0 : undefined } }}>
      <TableCell sx={{ px: 1 }}><IconButton size="small" aria-label={t(expanded ? 'runtime.queues.hideSourceDetails' : 'runtime.queues.showSourceDetails', { source: source.source })}
        aria-expanded={expanded} aria-controls={expanded ? detailsId : undefined} onClick={() => { setExpanded(!expanded); setShowAllSteps(false) }}>
        <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
      </IconButton></TableCell>
      <TableCell component="th" scope="row"><Tooltip title={source.context}><Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{source.source}</Typography></Tooltip></TableCell>
      <TableCell>{owner ? <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip title={owner.workerName}><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{workerLabel(owner)}</Typography></Tooltip>
        <Chip size="small" variant="outlined" color={owner.state === 'CANCEL_REQUESTED' ? 'warning' : 'primary'} label={t(`runtime.queues.states.${owner.state}`)} />
      </Stack> : <Typography variant="body2" color="text.secondary">—</Typography>}</TableCell>
      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{pending.length}</TableCell>
      <TableCell><Tooltip title={reasonHelp || ''}><Typography variant="body2" color={blocker ? 'warning.main' : 'text.secondary'} sx={{ overflowWrap: 'anywhere' }}>{shortReason}</Typography></Tooltip></TableCell>
    </TableRow>
    {expanded && <TableRow><TableCell colSpan={5} sx={{ bgcolor: 'action.hover', px: 3, py: 2 }}>
      <Box id={detailsId} role="region" aria-label={t('runtime.queues.sourceDetails', { source: source.source })}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="subtitle2">{t('runtime.queues.now')}</Typography>
            {owner ? <Stack spacing={0.75} sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{workerLabel(owner)}</Typography>
              <Typography variant="caption" color="text.secondary">{t('runtime.queues.admittedAt', { time: timestamp(owner.admittedAt) })}</Typography>
              {owner.startedAt && <Typography variant="caption" color="text.secondary">{t('runtime.queues.startedAt', { time: timestamp(owner.startedAt) })}</Typography>}
              {owner.waitingReason === 'EXECUTOR_UNAVAILABLE' && <Typography variant="body2" color="text.secondary">{t('runtime.queues.reasons.EXECUTOR_UNAVAILABLE')}</Typography>}
            </Stack> : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('runtime.queues.noActive')}</Typography>}
          </Box>
          <Box sx={{ flex: 2, minWidth: 0 }}><Typography variant="subtitle2">{t('runtime.queues.next')}</Typography>
            {pending.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('runtime.queues.noPending')}</Typography> : <>
              <Stack component="ol" spacing={0.5} sx={{ pl: 2.5, my: 1 }}>{visible.map(task => <Box component="li" key={task.executionId}><Tooltip title={task.workerName}><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{workerLabel(task)}</Typography></Tooltip></Box>)}</Stack>
              {pending.length > 10 && <Button size="small" onClick={() => setShowAllSteps(!showAllSteps)}>{t(showAllSteps ? 'runtime.queues.less' : 'runtime.queues.more', { count: pending.length - 10 })}</Button>}
              {reasonHelp && <Typography variant="body2" color="text.secondary">{reasonHelp}</Typography>}
              <Typography variant="caption" color="text.secondary">{t('runtime.queues.waitingSince', { time: timestamp(head.admittedAt) })}</Typography>
            </>}
          </Box>
        </Stack>
      </Box>
    </TableCell></TableRow>}
  </Fragment>
}
