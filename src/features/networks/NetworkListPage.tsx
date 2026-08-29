import BoltIcon from '@mui/icons-material/Bolt'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import ScheduleIcon from '@mui/icons-material/Schedule'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import { useMemo, useState, type MouseEvent } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Menu, MenuItem, Pagination, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import type { CapabilityAction, CommandRequest, CommandReceipt, NetworkSummary } from '../../api/types'
import { queryKeys } from '../../api/query-keys'
import { useAuth } from '../../auth/AuthProvider'
import { useTranslation } from 'react-i18next'
import AddIcon from '@mui/icons-material/Add'

export function NetworkListPage({ client }: { client: ApiClient }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const params = useMemo(() => new URLSearchParams({ page: String(page), size: '25', sort: 'acronym,asc', ...(q ? { q } : {}) }), [page, q])
  const query = useQuery({ queryKey: queryKeys.networkSummaries(params.toString()), queryFn: () => client.networkSummaries(params), placeholderData: previous => previous, refetchInterval: 10_000 })
  const capabilities = useQuery({ queryKey: queryKeys.capabilities, queryFn: () => client.capabilities() })
  const { user } = useAuth()
  const canOperate = user?.roles.includes('ADMIN') === true

  const total = query.data?.totalElements ?? 0
  const activeNetworks = query.data?.items.filter(network => network.runtime.runningCount > 0 || network.runtime.queuedCount > 0).length ?? 0
  return <Stack spacing={3}>
    <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.5 }, color: 'common.white', overflow: 'hidden', position: 'relative', background: 'linear-gradient(125deg, #173c5c 0%, #245b78 62%, #207a64 140%)', '&:before': { content: '""', position: 'absolute', width: 330, height: 330, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.07)', right: -90, top: -150 } }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={3} justifyContent="space-between" alignItems={{ md: 'flex-end' }}><Box sx={{ position: 'relative' }}><Typography variant="overline" sx={{ opacity: .7, fontWeight: 800, letterSpacing: '.12em' }}>{t('networks.center')}</Typography><Typography variant="h4" sx={{ color: 'inherit', mt: .25 }}>{t('networks.title')}</Typography><Typography sx={{ opacity: .82, mt: .8 }}>{t('networks.subtitle')}</Typography></Box><Stack direction="row" spacing={1.2} sx={{ position: 'relative' }}><Metric label={t('networks.sources')} value={total} /><Metric label={t('networks.active')} value={activeNetworks} accent />{canOperate && <Button component={Link} to="/networks/new" variant="contained" color="secondary" startIcon={<AddIcon />}>Nueva fuente</Button>}</Stack></Stack></Paper>
    {notice && <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert>}
    <Paper variant="outlined" sx={{ p: 1.25 }}><TextField placeholder={t('networks.search')} value={q} onChange={event => { setPage(0); setQ(event.target.value) }} fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }} /></Paper>
    {query.isError && <Alert severity="error">{t('networks.loadError')}</Alert>}
    {query.isLoading ? <CircularProgress /> : <Paper variant="outlined" sx={{ overflow: 'hidden' }}><Box sx={{ px: 2.5, py: 1.8, borderBottom: '1px solid', borderColor: 'divider' }}><Typography fontWeight={750}>{t('networks.inventory')}</Typography><Typography variant="body2" color="text.secondary">{t('networks.results', { count: total })} · {t('networks.refresh')}</Typography></Box><Box sx={{ overflowX: 'auto' }}><Table><TableHead><TableRow>
      <TableCell>ID</TableCell><TableCell>{t('networks.acronym')}</TableCell><TableCell>{t('networks.repository')}</TableCell><TableCell>{t('networks.institution')}</TableCell><TableCell>{t('networks.latestSnapshot')}</TableCell><TableCell>{t('common.state')}</TableCell><TableCell align="right">{t('common.actions')}</TableCell><TableCell align="center" sx={{ width: 46 }} />
    </TableRow></TableHead><TableBody>{query.data?.items.map(network => <NetworkRow key={network.id} network={network} client={client} actions={capabilities.data?.actions || []} canOperate={canOperate} onAccepted={receipt => setNotice(`${network.acronym}: ${receipt.command} aceptado (${receipt.requestId}). ${receipt.message || ''}`)} />)}</TableBody></Table></Box></Paper>}
    {query.data && <Pagination page={page + 1} count={Math.max(1, query.data.totalPages)} onChange={(_, value) => setPage(value - 1)} />}
  </Stack>
}

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <Box sx={{ minWidth: 88, px: 1.6, py: 1.1, borderRadius: 2, bgcolor: accent ? 'rgba(213,154,42,.92)' : 'rgba(255,255,255,.12)', color: accent ? 'primary.dark' : 'inherit', backdropFilter: 'blur(8px)' }}><Typography variant="h6" lineHeight={1} fontWeight={800}>{value}</Typography><Typography variant="caption" fontWeight={700} sx={{ opacity: .78 }}>{label}</Typography></Box>
}

function NetworkRow({ network, client, actions, canOperate, onAccepted }: { network: NetworkSummary; client: ApiClient; actions: CapabilityAction[]; canOperate: boolean; onAccepted: (receipt: CommandReceipt) => void }) {
  const cache = useQueryClient()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmation, setConfirmation] = useState<CommandRequest | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
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
    <TableCell><Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'text.secondary', fontWeight: 700 }}>#{network.id}</Typography></TableCell><TableCell><Typography fontWeight={800} color="primary.dark">{network.acronym}</Typography></TableCell>
    <TableCell><Typography>{network.name}</Typography></TableCell>
    <TableCell><Typography>{network.institutionName}</Typography><Typography variant="body2" color="text.secondary">{network.institutionAcronym || '—'}</Typography></TableCell>
    <TableCell sx={{ minWidth: 185 }}>{network.latestSnapshot ? <SnapshotCell snapshot={network.latestSnapshot} /> : <Typography variant="body2" color="text.secondary">Sin snapshots</Typography>}</TableCell>
    <TableCell><RuntimeBadge network={network} /></TableCell>
    <TableCell align="right">
      {command.isError && <Tooltip title={(command.error as ApiError).message}><CancelOutlinedIcon color="error" fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} /></Tooltip>}
      <NetworkToolbar network={network} actions={orderedActions} canOperate={canOperate} pending={command.isPending} active={active} anchor={anchor} onOpenActions={event => setAnchor(event.currentTarget)} onCloseActions={() => setAnchor(null)} onRun={requestConfirmation} onCancel={() => setConfirmCancel(true)} onHistory={() => setHistoryOpen(true)} />
      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)}><DialogTitle>Cancelar operaciones de {network.acronym}</DialogTitle><DialogContent><Typography>Se cancelarán todas las acciones activas o en cola para esta fuente.</Typography></DialogContent><DialogActions><IconButton aria-label="Cerrar" onClick={() => setConfirmCancel(false)}><CancelOutlinedIcon /></IconButton><Tooltip title="Cancelar operaciones"><span><IconButton color="error" disabled={command.isPending} onClick={() => { setConfirmCancel(false); run({ type: 'CANCEL_ALL' }) }}><CancelOutlinedIcon /></IconButton></span></Tooltip></DialogActions></Dialog>
      <CommandConfirmation open={confirmation} acronym={network.acronym} pending={command.isPending} onClose={() => setConfirmation(null)} onConfirm={() => { if (confirmation) { setConfirmation(null); run(confirmation) } }} />
      <HarvestHistoryDialog client={client} network={network} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </TableCell><TableCell align="center" sx={{ width: 46, px: 0.15 }}>
      {canOperate && <Tooltip title="Editar configuración"><IconButton aria-label="Editar configuración" component={Link} to={`/networks/${network.id}/edit`} sx={{ p: 0.5, minWidth: 32, minHeight: 32 }}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>}
    </TableCell>
  </TableRow>
}

function CommandConfirmation({ open, acronym, pending, onClose, onConfirm }: { open: CommandRequest | null; acronym: string; pending: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!open) return null
  const message = open.type === 'RUN_ENABLED_ACTIONS'
    ? 'Se enviarán al motor todas las acciones configuradas y habilitadas para esta fuente.'
    : open.type === 'RUN_ACTION'
      ? `Se enviará la acción ${open.actionName || ''}${open.incremental ? ' en modo incremental' : ''} al motor.`
      : 'Se recalcularán y registrarán las tareas programadas para esta fuente.'
  const title = open.type === 'RESCHEDULE' ? `Reprogramar ${acronym}` : `Ejecutar acción en ${acronym}`
  return <Dialog open onClose={onClose}><DialogTitle>{title}</DialogTitle><DialogContent><Typography>{message}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>La solicitud se ejecutará de forma asíncrona y el estado aparecerá en esta lista.</Typography></DialogContent><DialogActions><Button onClick={onClose} disabled={pending}>Cancelar</Button><Button variant="contained" onClick={onConfirm} disabled={pending}>Confirmar</Button></DialogActions></Dialog>
}

function RuntimeBadge({ network }: { network: NetworkSummary }) {
  const { runningCount, queuedCount, scheduledCount, running, queued } = network.runtime
  const stopped = network.latestSnapshot?.status === 'HARVESTING_STOPPED'
  if (runningCount === 0 && queuedCount === 0 && scheduledCount === 0) {
    return stopped
      ? <Tooltip title="La última cosecha se interrumpió; no hay una operación esperando ni en ejecución."><Chip size="small" color="warning" icon={<WarningAmberIcon />} label="Detenida" /></Tooltip>
      : <Chip size="small" label="Inactiva" />
  }
  return <Stack direction="row" spacing={0.35} useFlexGap flexWrap="wrap" sx={{ whiteSpace: 'nowrap' }}>
    {runningCount > 0 && <Tooltip title={<ProcessList title="Procesos en ejecución" values={running} empty="El motor no informó el detalle del proceso." />}><Chip size="small" color="warning" icon={<CircularProgress size={13} color="inherit" />} label={runningCount} /></Tooltip>}
    {queuedCount > 0 && <Tooltip title={<ProcessList title="Procesos en espera" values={queued} empty="La acción espera un worker o el fin de otra operación de la misma fuente." />}><Chip size="small" color="info" icon={<PauseCircleOutlineIcon />} label={queuedCount} /></Tooltip>}
    {scheduledCount > 0 && <Tooltip title="Hay una o más acciones registradas para la próxima ejecución programada."><Chip size="small" icon={<ScheduleIcon />} label={scheduledCount} /></Tooltip>}
  </Stack>
}

function ProcessList({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return <Box sx={{ p: 0.25, maxWidth: 360 }}><Typography variant="caption" display="block" sx={{ fontWeight: 700 }}>{title}</Typography>{values.length ? values.map(value => <Typography key={value} variant="caption" display="block">{value}</Typography>) : <Typography variant="caption">{empty}</Typography>}</Box>
}

function NetworkToolbar({ network, actions, canOperate, pending, active, anchor, onOpenActions, onCloseActions, onRun, onCancel, onHistory }: { network: NetworkSummary; actions: CapabilityAction[]; canOperate: boolean; pending: boolean; active: boolean; anchor: HTMLElement | null; onOpenActions: (event: MouseEvent<HTMLElement>) => void; onCloseActions: () => void; onRun: (request: CommandRequest) => void; onCancel: () => void; onHistory: () => void }) {
  const disabled = pending || !canOperate
  return <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 23px)', gridAutoRows: 24, justifyContent: 'end', columnGap: 0.15, '& .MuiIconButton-root': { p: 0.15, minWidth: 23, minHeight: 23 }, '& svg': { fontSize: 17 } }}>
    {canOperate && <><Tooltip title="Ejecutar acciones habilitadas"><span><IconButton aria-label="Ejecutar acciones habilitadas" color="primary" disabled={disabled} onClick={() => onRun({ type: 'RUN_ENABLED_ACTIONS' })}><PlayCircleOutlineIcon /></IconButton></span></Tooltip>
      <Tooltip title="Ejecutar acción"><span><IconButton aria-label="Ejecutar acción" color="primary" disabled={disabled || actions.length === 0} onClick={onOpenActions}><BoltIcon /></IconButton></span></Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={onCloseActions}>{actions.map(action => <ActionMenuItems key={action.name} action={action} onRun={onRun} />)}</Menu>
      <Tooltip title="Reprogramar"><span><IconButton aria-label="Reprogramar" disabled={disabled} onClick={() => onRun({ type: 'RESCHEDULE' })}><EventRepeatIcon /></IconButton></span></Tooltip>
      <Tooltip title={active ? 'Cancelar acciones activas o en cola' : 'No hay acciones activas para cancelar'}><span><IconButton aria-label="Cancelar acciones" color="error" disabled={disabled || !active} onClick={onCancel}><CancelOutlinedIcon /></IconButton></span></Tooltip></>}
    <Tooltip title="Historial y bitácoras de cosecha"><IconButton aria-label="Historial y bitácoras" onClick={onHistory}><HistoryOutlinedIcon /></IconButton></Tooltip>
    <Tooltip title={network.lastValidSnapshotId ? 'Abrir diagnóstico del último snapshot válido' : 'No hay snapshot válido para diagnosticar'}><span><IconButton aria-label="Abrir diagnóstico" component={network.lastValidSnapshotId ? Link : 'button'} to={network.lastValidSnapshotId ? `/networks/${network.id}/diagnostics?snapshot=${network.lastValidSnapshotId}` : undefined} disabled={!network.lastValidSnapshotId}><MedicalServicesOutlinedIcon /></IconButton></span></Tooltip>
  </Box>
}

function HarvestHistoryDialog({ client, network, open, onClose }: { client: ApiClient; network: NetworkSummary; open: boolean; onClose: () => void }) {
  const [snapshotId, setSnapshotId] = useState<number | null>(null)
  const snapshots = useQuery({ enabled: open, queryKey: queryKeys.networkSnapshots(network.id), queryFn: () => client.networkSnapshots(network.id) })
  const selectedId = snapshotId || snapshots.data?.items.find(item => item.id === network.latestSnapshot?.id)?.id || snapshots.data?.items[0]?.id || null
  const logs = useQuery({ enabled: open && selectedId !== null, queryKey: queryKeys.snapshotLogs(selectedId || 0), queryFn: () => client.snapshotLogs(selectedId!) })
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg"><DialogTitle>Historial de cosechas · {network.acronym}</DialogTitle><DialogContent dividers>{snapshots.isLoading ? <CircularProgress /> : snapshots.isError ? <Alert severity="error">No se pudo cargar el historial de snapshots.</Alert> : <Stack spacing={2}><Box sx={{ maxHeight: 250, overflow: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>ID</TableCell><TableCell>Estado</TableCell><TableCell>Inicio</TableCell><TableCell>Fin</TableCell><TableCell align="right">H</TableCell><TableCell align="right">V</TableCell><TableCell align="right">T</TableCell><TableCell /></TableRow></TableHead><TableBody>{snapshots.data?.items.map(snapshot => <TableRow key={snapshot.id} hover selected={snapshot.id === selectedId}><TableCell>#{snapshot.id}</TableCell><TableCell><Chip size="small" label={shortSnapshotStatus(snapshot.status).label} color={shortSnapshotStatus(snapshot.status).color} /></TableCell><TableCell>{formatDate(snapshot.startTime)}</TableCell><TableCell>{formatDate(snapshot.endTime)}</TableCell><TableCell align="right">{snapshot.size ?? '—'}</TableCell><TableCell align="right">{snapshot.validSize ?? '—'}</TableCell><TableCell align="right">{snapshot.transformedSize ?? '—'}</TableCell><TableCell align="right"><Button size="small" disabled={snapshot.deleted} onClick={() => setSnapshotId(snapshot.id)}>Bitácora</Button></TableCell></TableRow>)}</TableBody></Table></Box><Typography fontWeight={750}>Bitácora del snapshot {selectedId ? `#${selectedId}` : ''}</Typography>{logs.isLoading ? <CircularProgress size={22} /> : logs.isError ? <Alert severity="info">No hay una bitácora disponible para este snapshot.</Alert> : <Box sx={{ maxHeight: 280, overflow: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>Hora</TableCell><TableCell>Mensaje</TableCell></TableRow></TableHead><TableBody>{logs.data?.items.map((entry, index) => <TableRow key={`${entry.timestamp}-${index}`}><TableCell sx={{ whiteSpace: 'nowrap' }}>{entry.timestamp}</TableCell><TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{entry.message}</TableCell></TableRow>)}{logs.data?.items.length === 0 && <TableRow><TableCell colSpan={2} align="center">La bitácora no contiene entradas.</TableCell></TableRow>}</TableBody></Table></Box>}</Stack>}</DialogContent><DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions></Dialog>
}

function ActionMenuItems({ action, onRun }: { action: CapabilityAction; onRun: (request: CommandRequest) => void }) {
  const label = action.description || action.name
  return <MenuItem><Box component="span" onClick={() => onRun({ type: 'RUN_ACTION', actionName: action.name })} sx={{ cursor: 'pointer' }}>{label}</Box>{action.incremental && <><Box component="span" sx={{ mx: 0.75, color: 'text.disabled' }}>|</Box><Box component="span" onClick={() => onRun({ type: 'RUN_ACTION', actionName: action.name, incremental: true })} sx={{ cursor: 'pointer', color: 'primary.main', fontSize: '0.85em' }}>incremental</Box></>}</MenuItem>
}

function SnapshotCell({ snapshot }: { snapshot: NonNullable<NetworkSummary['latestSnapshot']> }) {
  const { label, color } = shortSnapshotStatus(snapshot.status)
  return <Stack spacing={0.15} alignItems="flex-start"><Chip size="small" color={color} label={label} /><Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.25 }}>{formatDate(snapshot.endTime || snapshot.startTime)}</Typography><Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'text.secondary', whiteSpace: 'nowrap', lineHeight: 1.25 }}>H: {snapshot.size ?? '—'} | V: {snapshot.validSize ?? '—'} | T: {snapshot.transformedSize ?? '—'}</Typography></Stack>
}

function shortSnapshotStatus(status: string): { label: string; color: 'default' | 'success' | 'warning' | 'error' | 'info' } {
  switch (status) {
    case 'VALID': return { label: 'Validado', color: 'success' }
    case 'HARVESTING': return { label: 'Cosechando', color: 'info' }
    case 'RETRYING': return { label: 'Reintentando', color: 'warning' }
    case 'HARVESTING_FINISHED_VALID': return { label: 'Cosecha terminada', color: 'success' }
    case 'HARVESTING_FINISHED_ERROR': return { label: 'Error cosecha', color: 'error' }
    case 'HARVESTING_STOPPED': return { label: 'Detenida', color: 'warning' }
    case 'INDEXING': return { label: 'Indexando', color: 'info' }
    case 'INDEXING_FINISHED_ERROR': return { label: 'Error índice', color: 'error' }
    case 'INDEXING_FINISHED_VALID': return { label: 'Indexación terminada', color: 'success' }
    case 'EMPTY_INCREMENTAL': return { label: 'Sin cambios', color: 'default' }
    case 'INITIALIZED': return { label: 'En espera', color: 'default' }
    default: return { label: status.replaceAll('_', ' '), color: 'default' }
  }
}

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—' }
