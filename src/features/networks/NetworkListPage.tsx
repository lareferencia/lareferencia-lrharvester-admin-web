import { uiText, uiLocale } from '../../i18n'
import BoltIcon from '@mui/icons-material/Bolt'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import ScheduleIcon from '@mui/icons-material/Schedule'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import { useMemo, useState, type MouseEvent } from 'react'
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Menu, MenuItem, Pagination, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import type { CapabilityAction, CommandRequest, CommandReceipt, NetworkSummary } from '../../api/types'
import { queryKeys } from '../../api/query-keys'
import { SnapshotIndexingIndicator } from './IndexingResults'
import { useAuth } from '../../auth/AuthProvider'
import { useTranslation } from 'react-i18next'
import AddIcon from '@mui/icons-material/Add'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { NetworkTransferDialog } from './NetworkTransferDialog'
import { NetworkFilterPanel } from './NetworkFilterPanel'
import { NetworkBatchCommandDialog } from './NetworkBatchCommandDialog'

export function NetworkListPage({ client }: { client: ApiClient }) {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(0, Number(searchParams.get('page')) || 0)
  const setPage = (value: number) => setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('page', String(value)); return next })
  const [notice, setNotice] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [batchOpen, setBatchOpen] = useState(false)
  const params = useMemo(() => { const next = new URLSearchParams(searchParams); next.set('page', String(page)); next.set('size', '25'); if (!next.has('sort')) next.set('sort', 'acronym,asc'); return next }, [searchParams, page])
  const query = useQuery({ queryKey: queryKeys.networkSummaries(params.toString()), queryFn: () => client.networkSummaries(params), placeholderData: previous => previous, refetchInterval: 10_000 })
  const capabilities = useQuery({ queryKey: queryKeys.capabilities, queryFn: () => client.capabilities() })
  const { user } = useAuth()
  const canOperate = user?.roles.includes('ADMIN') === true
  const exportSources = useMutation({
    mutationFn: () => client.exportNetworksXlsx(),
    onSuccess: file => {
      const url = URL.createObjectURL(file); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'fuentes.xlsx'; anchor.click(); URL.revokeObjectURL(url)
      setNotice(t('networks.exportSuccess'))
    },
  })

  const total = query.data?.totalElements ?? 0
  const activeNetworks = query.data?.items.filter(network => network.runtime.runningCount > 0 || network.runtime.queuedCount > 0).length ?? 0
  const visibleNetworks = query.data?.items || []
  const selectedNetworks = visibleNetworks.filter(network => selectedIds.includes(network.id))
  const allVisibleSelected = visibleNetworks.length > 0 && selectedNetworks.length === visibleNetworks.length
  const toggleNetwork = (id: number) => setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const clearSelection = () => setSelectedIds([])
  return <Stack spacing={3}>
    <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.5 }, color: 'common.white', overflow: 'hidden', position: 'relative', background: 'linear-gradient(125deg, #173c5c 0%, #245b78 62%, #207a64 140%)', '&:before': { content: '""', position: 'absolute', width: 330, height: 330, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.07)', right: -90, top: -150 } }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={3} justifyContent="space-between" alignItems={{ md: 'flex-end' }}><Box sx={{ position: 'relative' }}><Typography variant="overline" sx={{ opacity: .7, fontWeight: 800, letterSpacing: '.12em' }}>{t('networks.center')}</Typography><Typography variant="h4" sx={{ color: 'inherit', mt: .25 }}>{t('networks.title')}</Typography><Typography sx={{ opacity: .82, mt: .8 }}>{t('networks.subtitle')}</Typography></Box><Stack direction="row" spacing={1.2} sx={{ position: 'relative' }}><Metric label={t('networks.sources')} value={total} /><Metric label={t('networkFilters.activeVisible')} value={activeNetworks} accent /></Stack></Stack></Paper>
    {canOperate && <Paper variant="outlined" sx={{ px: 1.25, py: 1, bgcolor: 'background.paper' }}><Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Button component={Link} to="/networks/new" variant="contained" startIcon={<AddIcon />}>{t('networks.newSource')}</Button><Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => setTransferOpen(true)}>{t('networks.importSources')}</Button><Button variant="outlined" startIcon={<DownloadOutlinedIcon />} disabled={exportSources.isPending} onClick={() => exportSources.mutate()}>{t('networks.exportSources')}</Button></Stack>{exportSources.isError && <Alert severity="error" sx={{ mt: 1 }}>{(exportSources.error as ApiError).message}</Alert>}</Paper>}
    {notice && <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert>}
    <NetworkFilterPanel client={client} params={searchParams} onChange={changes => {
      clearSelection()
      setSearchParams(previous => { const next = new URLSearchParams(previous); Object.entries(changes).forEach(([key, values]) => { next.delete(key); values.forEach(value => next.append(key, value)) }); next.set('page', '0'); return next })
    }} />
    {canOperate && selectedNetworks.length > 0 && <Paper variant="outlined" sx={{ px: 1.5, py: 1, borderColor: 'primary.light', bgcolor: 'primary.50' }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }} justifyContent="space-between"><Typography fontWeight={700}>{t('networks.batchSelected', { count: selectedNetworks.length })}</Typography><Stack direction="row" spacing={1}><Button size="small" onClick={clearSelection}>{t('networks.batchClear')}</Button><Button size="small" variant="contained" startIcon={<BoltIcon />} onClick={() => setBatchOpen(true)}>{t('networks.batchExecute')}</Button></Stack></Stack></Paper>}
    {query.isError && <Alert severity="error">{t('networks.loadError')}</Alert>}
    {query.isLoading ? <CircularProgress /> : <Paper variant="outlined" sx={{ overflow: 'hidden' }}><Box sx={{ px: 2.5, py: 1.8, borderBottom: '1px solid', borderColor: 'divider' }}><Typography fontWeight={750}>{t('networks.inventory')}</Typography><Typography variant="body2" color="text.secondary">{t('networks.results', { count: total })} · {t('networks.refresh')}</Typography></Box><Box sx={{ overflowX: 'auto' }}><Table><TableHead><TableRow>
      {canOperate && <TableCell padding="checkbox"><Checkbox checked={allVisibleSelected} indeterminate={selectedNetworks.length > 0 && !allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? [] : visibleNetworks.map(network => network.id))} inputProps={{ 'aria-label': t('networks.batchSelectVisible') }} /></TableCell>}<TableCell>ID</TableCell><TableCell>{t('networks.acronym')}</TableCell><TableCell>{t('networks.repository')}</TableCell><TableCell>{t('networks.institution')}</TableCell><TableCell>{t('networks.latestSnapshot')}</TableCell><TableCell align="center" sx={{ width: 96, px: 1 }}>{t('indexing.column')}</TableCell><TableCell>{t('common.state')}</TableCell><TableCell align="right">{t('common.actions')}</TableCell><TableCell align="center" sx={{ width: 46 }} />
    </TableRow></TableHead><TableBody>{query.data?.items.length === 0 && <TableRow><TableCell colSpan={canOperate ? 10 : 9} align="center">{t('networkFilters.noResults')}</TableCell></TableRow>}{query.data?.items.map(network => <NetworkRow key={network.id} network={network} client={client} actions={capabilities.data?.actions || []} canOperate={canOperate} selected={selectedIds.includes(network.id)} onSelect={() => toggleNetwork(network.id)} onAccepted={receipt => setNotice(`${network.acronym}: ${uiText('commandAccepted', { command: receipt.command, requestId: receipt.requestId, message: receipt.message || '' })}`)} />)}</TableBody></Table></Box></Paper>}
    {query.data && <Pagination page={page + 1} count={Math.max(1, query.data.totalPages)} onChange={(_, value) => { clearSelection(); setPage(value - 1) }} />}
    <NetworkTransferDialog open={transferOpen} client={client} onClose={() => setTransferOpen(false)} onImported={setNotice} />
    <NetworkBatchCommandDialog open={batchOpen} client={client} networks={selectedNetworks} actions={capabilities.data?.actions || []} onClose={() => setBatchOpen(false)} onCompleted={message => { setBatchOpen(false); clearSelection(); setNotice(message) }} />
  </Stack>
}

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <Box sx={{ minWidth: 88, px: 1.6, py: 1.1, borderRadius: 2, bgcolor: accent ? 'rgba(213,154,42,.92)' : 'rgba(255,255,255,.12)', color: accent ? 'primary.dark' : 'inherit', backdropFilter: 'blur(8px)' }}><Typography variant="h6" lineHeight={1} fontWeight={800}>{value}</Typography><Typography variant="caption" fontWeight={700} sx={{ opacity: .78 }}>{label}</Typography></Box>
}

function NetworkRow({ network, client, actions, canOperate, selected, onSelect, onAccepted }: { network: NetworkSummary; client: ApiClient; actions: CapabilityAction[]; canOperate: boolean; selected: boolean; onSelect: () => void; onAccepted: (receipt: CommandReceipt) => void }) {
  const cache = useQueryClient()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmation, setConfirmation] = useState<CommandRequest | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historySnapshotId, setHistorySnapshotId] = useState<number | null>(null)
  const command = useMutation({
    mutationFn: (request: CommandRequest) => client.command(network.id, request),
    onSuccess: receipt => {
      onAccepted(receipt)
      void cache.invalidateQueries({ queryKey: ['network-summaries'] })
      void cache.invalidateQueries({ queryKey: queryKeys.networkRuntime(network.id) })
      void cache.invalidateQueries({ queryKey: queryKeys.runtime })
    },
  })
  const run = (request: CommandRequest) => { setAnchor(null); command.mutate(request) }
  const requestConfirmation = (request: CommandRequest) => { setAnchor(null); setConfirmation(request) }
  const active = network.runtime.runningCount > 0 || network.runtime.queuedCount > 0
  const orderedActions = [...actions].sort((left, right) => (left.order ?? 9999) - (right.order ?? 9999))

  return <TableRow hover sx={{ '& > *': { py: 1.45 }, ...(active ? { '& > *': { bgcolor: 'rgba(32, 122, 100, .045)' } } : {}) }}>
    {canOperate && <TableCell padding="checkbox"><Checkbox checked={selected} onChange={onSelect} inputProps={{ 'aria-label': uiText('selectSource', { source: network.acronym }) }} /></TableCell>}
    <TableCell><Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'text.secondary', fontWeight: 700 }}>#{network.id}</Typography></TableCell><TableCell><Typography fontWeight={800} color="primary.dark">{network.acronym}</Typography></TableCell>
    <TableCell><Typography>{network.name}</Typography></TableCell>
    <TableCell><Typography>{network.institutionName}</Typography><Typography variant="body2" color="text.secondary">{network.institutionAcronym || '—'}</Typography></TableCell>
    <TableCell sx={{ minWidth: 185 }}>{network.latestSnapshot ? <SnapshotCell snapshot={network.latestSnapshot} lastValidSnapshotId={network.lastValidSnapshotId} lastValidSnapshotAt={network.lastValidSnapshotAt} onOpenPrevious={() => { setHistorySnapshotId(network.lastValidSnapshotId); setHistoryOpen(true) }} /> : <Typography variant="body2" color="text.secondary">{uiText('noSnapshots')}</Typography>}</TableCell>
    <TableCell align="center" sx={{ px: 1 }}><SnapshotIndexingIndicator key={network.latestSnapshot?.id} snapshot={network.latestSnapshot} /></TableCell>
    <TableCell><RuntimeBadge network={network} /></TableCell>
    <TableCell align="right">
      {command.isError && <Tooltip title={(command.error as ApiError).message}><CancelOutlinedIcon color="error" fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} /></Tooltip>}
      <NetworkToolbar network={network} actions={orderedActions} canOperate={canOperate} pending={command.isPending} active={active} anchor={anchor} onOpenActions={event => setAnchor(event.currentTarget)} onCloseActions={() => setAnchor(null)} onRun={requestConfirmation} onCancel={() => setConfirmCancel(true)} onHistory={() => { setHistorySnapshotId(null); setHistoryOpen(true) }} />
      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)}><DialogTitle>{uiText('cancelOperationsFor')} {network.acronym}</DialogTitle><DialogContent><Typography>{uiText('cancelSourceHelp')}</Typography></DialogContent><DialogActions><IconButton aria-label={uiText('close')} onClick={() => setConfirmCancel(false)}><CancelOutlinedIcon /></IconButton><Tooltip title={uiText('cancelOperations')}><span><IconButton color="error" disabled={command.isPending} onClick={() => { setConfirmCancel(false); run({ type: 'CANCEL_ALL' }) }}><CancelOutlinedIcon /></IconButton></span></Tooltip></DialogActions></Dialog>
      <CommandConfirmation open={confirmation} acronym={network.acronym} pending={command.isPending} onClose={() => setConfirmation(null)} onConfirm={() => { if (confirmation) { setConfirmation(null); run(confirmation) } }} />
      {historyOpen && <HarvestHistoryDialog client={client} network={network} open initialSnapshotId={historySnapshotId} onClose={() => setHistoryOpen(false)} />}
    </TableCell><TableCell align="center" sx={{ width: 46, px: 0.15 }}>
      {canOperate && <Tooltip title={uiText('editConfiguration')}><IconButton aria-label={uiText('editConfiguration')} component={Link} to={`/networks/${network.id}/edit`} sx={{ p: 0.5, minWidth: 32, minHeight: 32 }}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>}
    </TableCell>
  </TableRow>
}

function CommandConfirmation({ open, acronym, pending, onClose, onConfirm }: { open: CommandRequest | null; acronym: string; pending: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!open) return null
  const message = open.type === 'RUN_ENABLED_ACTIONS'
    ? uiText('runEnabledHelp')
    : open.type === 'RUN_ACTION'
      ? uiText('runActionHelp', { action: open.actionName || '', mode: open.incremental ? uiText('incrementalMode') : '' })
      : uiText('rescheduleHelp')
  const title = open.type === 'RESCHEDULE' ? uiText('rescheduleFor', { source: acronym }) : uiText('runActionFor', { source: acronym })
  return <Dialog open onClose={onClose}><DialogTitle>{title}</DialogTitle><DialogContent><Typography>{message}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{uiText('asyncListHelp')}</Typography></DialogContent><DialogActions><Button onClick={onClose} disabled={pending}>{uiText('cancel')}</Button><Button variant="contained" onClick={onConfirm} disabled={pending}>{uiText('confirm')}</Button></DialogActions></Dialog>
}

function RuntimeBadge({ network }: { network: NetworkSummary }) {
  const { runningCount, queuedCount, scheduledCount, running, queued } = network.runtime
  const stopped = ['HARVESTING_STOPPED', 'VALIDATION_STOPPED'].includes(network.latestSnapshot?.status || '')
  if (runningCount === 0 && queuedCount === 0 && scheduledCount === 0) {
    return stopped
      ? <Tooltip title={uiText('stoppedHelp')}><Chip size="small" color="warning" icon={<WarningAmberIcon />} label={uiText('stopped')} /></Tooltip>
      : <Chip size="small" label={uiText('inactive')} />
  }
  return <Stack direction="row" spacing={0.35} useFlexGap flexWrap="wrap" sx={{ whiteSpace: 'nowrap' }}>
    {runningCount > 0 && <Tooltip title={<ProcessList title={uiText('runningProcesses')} values={running} empty={uiText('noProcessDetails')} />}><Chip size="small" color="warning" icon={<CircularProgress size={13} color="inherit" />} label={runningCount} /></Tooltip>}
    {queuedCount > 0 && <Tooltip title={<ProcessList title={uiText('waitingProcesses')} values={queued} empty={uiText('waitingProcessHelp')} />}><Chip size="small" color="info" icon={<PauseCircleOutlineIcon />} label={queuedCount} /></Tooltip>}
    {scheduledCount > 0 && <Tooltip title={uiText('scheduledHelp')}><Chip size="small" icon={<ScheduleIcon />} label={scheduledCount} /></Tooltip>}
  </Stack>
}

function ProcessList({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return <Box sx={{ p: 0.25, maxWidth: 360 }}><Typography variant="caption" display="block" sx={{ fontWeight: 700 }}>{title}</Typography>{values.length ? values.map(value => <Typography key={value} variant="caption" display="block">{value}</Typography>) : <Typography variant="caption">{empty}</Typography>}</Box>
}

function NetworkToolbar({ network, actions, canOperate, pending, active, anchor, onOpenActions, onCloseActions, onRun, onCancel, onHistory }: { network: NetworkSummary; actions: CapabilityAction[]; canOperate: boolean; pending: boolean; active: boolean; anchor: HTMLElement | null; onOpenActions: (event: MouseEvent<HTMLElement>) => void; onCloseActions: () => void; onRun: (request: CommandRequest) => void; onCancel: () => void; onHistory: () => void }) {
  const disabled = pending || !canOperate
  return <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 23px)', gridAutoRows: 24, justifyContent: 'end', columnGap: 0.15, '& .MuiIconButton-root': { p: 0.15, minWidth: 23, minHeight: 23 }, '& svg': { fontSize: 17 } }}>
    {canOperate && <><Tooltip title={uiText('runEnabledActions')}><span><IconButton aria-label={uiText('runEnabledActions')} color="primary" disabled={disabled} onClick={() => onRun({ type: 'RUN_ENABLED_ACTIONS' })}><PlayCircleOutlineIcon /></IconButton></span></Tooltip>
      <Tooltip title={uiText('runAction')}><span><IconButton aria-label={uiText('runAction')} color="primary" disabled={disabled || actions.length === 0} onClick={onOpenActions}><BoltIcon /></IconButton></span></Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={onCloseActions}>{actions.map(action => <ActionMenuItems key={action.name} action={action} onRun={onRun} />)}</Menu>
      <Tooltip title={uiText('reschedule')}><span><IconButton aria-label={uiText('reschedule')} disabled={disabled} onClick={() => onRun({ type: 'RESCHEDULE' })}><EventRepeatIcon /></IconButton></span></Tooltip>
      <Tooltip title={active ? uiText('cancelActive') : uiText('noActionsToCancel')}><span><IconButton aria-label={uiText('cancelActions')} color="error" disabled={disabled || !active} onClick={onCancel}><CancelOutlinedIcon /></IconButton></span></Tooltip></>}
    <Tooltip title={uiText('harvestHistoryHelp')}><IconButton aria-label={uiText('historyLogs')} onClick={onHistory}><HistoryOutlinedIcon /></IconButton></Tooltip>
    <Tooltip title={network.lastValidSnapshotId ? uiText('openLatestDiagnostics') : uiText('noValidSnapshot')}><span><IconButton aria-label={uiText('openDiagnostics')} component={network.lastValidSnapshotId ? Link : 'button'} to={network.lastValidSnapshotId ? `/networks/${network.id}/diagnostics?snapshot=${network.lastValidSnapshotId}` : undefined} disabled={!network.lastValidSnapshotId}><MedicalServicesOutlinedIcon /></IconButton></span></Tooltip>
  </Box>
}

function HarvestHistoryDialog({ client, network, open, initialSnapshotId, onClose }: { client: ApiClient; network: NetworkSummary; open: boolean; initialSnapshotId: number | null; onClose: () => void }) {
  const { t } = useTranslation()
  const [snapshotId, setSnapshotId] = useState<number | null>(initialSnapshotId)
  const snapshots = useQuery({ enabled: open, queryKey: queryKeys.networkSnapshots(network.id), queryFn: () => client.networkSnapshots(network.id), refetchInterval: open ? 10_000 : false })
  const selectedId = snapshotId || snapshots.data?.items.find(item => item.id === network.latestSnapshot?.id)?.id || snapshots.data?.items[0]?.id || null
  const logs = useQuery({ enabled: open && selectedId !== null, queryKey: queryKeys.snapshotLogs(selectedId || 0), queryFn: () => client.snapshotLogs(selectedId!) })
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg"><DialogTitle>{uiText('harvestHistory')} {network.acronym}</DialogTitle><DialogContent dividers>{snapshots.isLoading ? <CircularProgress /> : snapshots.isError ? <Alert severity="error">{uiText('historyError')}</Alert> : <Stack spacing={2}><Box sx={{ maxHeight: 250, overflow: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>ID</TableCell><TableCell>{uiText('status')}</TableCell><TableCell align="center" sx={{ width: 96, px: 1 }}>{t('indexing.column')}</TableCell><TableCell>{uiText('start')}</TableCell><TableCell>{uiText('end')}</TableCell><TableCell align="right">{uiText('harvested')}</TableCell><TableCell align="right">{uiText('validRecords')}</TableCell><TableCell align="right">{uiText('transformedRecords')}</TableCell><TableCell /></TableRow></TableHead><TableBody>{snapshots.data?.items.map(snapshot => <TableRow key={snapshot.id} hover selected={snapshot.id === selectedId}><TableCell>#{snapshot.id}</TableCell><TableCell><Chip size="small" label={shortSnapshotStatus(snapshot.status).label} color={shortSnapshotStatus(snapshot.status).color} /></TableCell><TableCell align="center" sx={{ px: 1 }}><SnapshotIndexingIndicator snapshot={snapshot} /></TableCell><TableCell>{formatDate(snapshot.startTime)}</TableCell><TableCell>{formatDate(snapshot.endTime)}</TableCell><TableCell align="right">{snapshot.size ?? '—'}</TableCell><TableCell align="right">{snapshot.validSize ?? '—'}</TableCell><TableCell align="right">{snapshot.transformedSize ?? '—'}</TableCell><TableCell align="right"><Button size="small" disabled={snapshot.deleted} onClick={() => setSnapshotId(snapshot.id)}>{uiText('log')}</Button></TableCell></TableRow>)}</TableBody></Table></Box><Typography fontWeight={750}>{uiText('snapshotLog')} {selectedId ? `#${selectedId}` : ''}</Typography>{logs.isLoading ? <CircularProgress size={22} /> : logs.isError ? <Alert severity="info">{uiText('noSnapshotLog')}</Alert> : <Box sx={{ maxHeight: 280, overflow: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>{uiText('hour')}</TableCell><TableCell>{uiText('message')}</TableCell></TableRow></TableHead><TableBody>{logs.data?.items.map((entry, index) => <TableRow key={`${entry.timestamp}-${index}`}><TableCell sx={{ whiteSpace: 'nowrap' }}>{entry.timestamp}</TableCell><TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{entry.message}</TableCell></TableRow>)}{logs.data?.items.length === 0 && <TableRow><TableCell colSpan={2} align="center">{uiText('emptyLog')}</TableCell></TableRow>}</TableBody></Table></Box>}</Stack>}</DialogContent><DialogActions><Button onClick={onClose}>{uiText('close')}</Button></DialogActions></Dialog>
}

function ActionMenuItems({ action, onRun }: { action: CapabilityAction; onRun: (request: CommandRequest) => void }) {
  const { t } = useTranslation()
  const label = t(`networks.actionNames.${action.name}`, { defaultValue: action.description || action.name })
  return <MenuItem><Box component="span" onClick={() => onRun({ type: 'RUN_ACTION', actionName: action.name })} sx={{ cursor: 'pointer' }}>{label}</Box>{action.incremental && <><Box component="span" sx={{ mx: 0.75, color: 'text.disabled' }}>|</Box><Box component="span" onClick={() => onRun({ type: 'RUN_ACTION', actionName: action.name, incremental: true })} sx={{ cursor: 'pointer', color: 'primary.main', fontSize: '0.85em' }}>{uiText('incremental')}</Box></>}</MenuItem>
}

function SnapshotCell({ snapshot, lastValidSnapshotId, lastValidSnapshotAt, onOpenPrevious }: { snapshot: NonNullable<NetworkSummary['latestSnapshot']>; lastValidSnapshotId: number | null; lastValidSnapshotAt: string | null; onOpenPrevious: () => void }) {
  const { t } = useTranslation()
  const { label, color } = shortSnapshotStatus(snapshot.status)
  const hasPreviousValid = lastValidSnapshotId !== null && lastValidSnapshotId !== snapshot.id
  const numbers = new Intl.NumberFormat(uiLocale())
  const counts = [
    { abbreviation: 'H', label: uiText('harvested'), value: snapshot.size },
    { abbreviation: 'V', label: uiText('validRecords'), value: snapshot.validSize },
    { abbreviation: 'T', label: uiText('transformedRecords'), value: snapshot.transformedSize },
  ]
  return <Stack spacing={0.5} alignItems="flex-start">
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip size="small" color={color} label={label} sx={{ height: 22 }} />
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.25, whiteSpace: 'nowrap' }}>{formatDate(snapshot.endTime || snapshot.startTime)}</Typography>
    </Stack>
    <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
      {counts.map(count => <Tooltip key={count.abbreviation} title={`${count.abbreviation}: ${count.label}`}><Typography tabIndex={0} aria-label={`${count.label}: ${count.value == null ? '—' : numbers.format(count.value)}`} variant="caption" color="text.secondary" sx={{ lineHeight: 1.25, whiteSpace: 'nowrap' }}>
        {count.abbreviation}: <Box component="span" sx={{ fontWeight: 700, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{count.value == null ? '—' : numbers.format(count.value)}</Box>
      </Typography></Tooltip>)}
    </Stack>
    {hasPreviousValid ? <Button size="small" color="success" onClick={onOpenPrevious} startIcon={<CheckCircleOutlineIcon />} aria-label={t('networks.openPreviousValid', { id: lastValidSnapshotId })} sx={{ p: 0, minWidth: 0, fontSize: '0.7rem', lineHeight: 1.5, textTransform: 'none', textAlign: 'left', '& .MuiButton-startIcon': { ml: 0, mr: 0.5 }, '& .MuiButton-startIcon > *': { fontSize: 14 } }}>
      {t('networks.previousValid', { date: lastValidSnapshotAt ? formatDate(lastValidSnapshotAt) : `#${lastValidSnapshotId}` })}
    </Button> : lastValidSnapshotId === null && snapshot.status !== 'VALID' ? <Stack direction="row" spacing={0.5} alignItems="center">
      <WarningAmberIcon color="warning" sx={{ fontSize: 14 }} /><Typography variant="caption" color="warning.dark" sx={{ fontSize: '0.7rem', lineHeight: 1.5 }}>{t('networks.noPreviousValid')}</Typography>
    </Stack> : null}
  </Stack>
}

function shortSnapshotStatus(status: string): { label: string; color: 'default' | 'success' | 'warning' | 'error' | 'info' } {
  switch (status) {
    case 'VALIDATING': return { label: uiText('VALIDATING'), color: 'info' }
    case 'VALIDATION_FINISHED_ERROR': return { label: uiText('VALIDATION_FINISHED_ERROR'), color: 'error' }
    case 'VALIDATION_STOPPED': return { label: uiText('VALIDATION_STOPPED'), color: 'warning' }
    case 'VALID': return { label: uiText('validated'), color: 'success' }
    case 'HARVESTING': return { label: uiText('harvesting'), color: 'info' }
    case 'RETRYING': return { label: uiText('retrying'), color: 'warning' }
    case 'HARVESTING_FINISHED_VALID': return { label: uiText('harvestEnded'), color: 'success' }
    case 'HARVESTING_FINISHED_ERROR': return { label: uiText('harvestError'), color: 'error' }
    case 'HARVESTING_STOPPED': return { label: uiText('stopped'), color: 'warning' }
    case 'INDEXING': return { label: uiText('indexing'), color: 'info' }
    case 'INDEXING_FINISHED_ERROR': return { label: uiText('indexError'), color: 'error' }
    case 'INDEXING_FINISHED_VALID': return { label: uiText('indexFinished'), color: 'success' }
    case 'EMPTY_INCREMENTAL': return { label: uiText('unchanged'), color: 'default' }
    case 'INITIALIZED': return { label: uiText('waiting'), color: 'default' }
    default: return { label: status.replaceAll('_', ' '), color: 'default' }
  }
}

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat(uiLocale(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—' }
