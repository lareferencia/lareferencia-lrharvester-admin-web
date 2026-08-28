import { useState } from 'react'
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import { queryKeys } from '../../api/query-keys'
import { useAuth } from '../../auth/AuthProvider'

export function NetworkDetailPage({ client }: { client: ApiClient }) {
  const id = Number(useParams().id)
  const { user } = useAuth()
  const cache = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const [actionName, setActionName] = useState('')
  const [incremental, setIncremental] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const network = useQuery({ queryKey: queryKeys.network(id), queryFn: () => client.network(id), enabled: Number.isSafeInteger(id) })
  const runtime = useQuery({ queryKey: queryKeys.networkRuntime(id), queryFn: () => client.networkRuntime(id), enabled: Number.isSafeInteger(id), refetchInterval: 10_000 })
  const capabilities = useQuery({ queryKey: queryKeys.capabilities, queryFn: () => client.capabilities() })
  const command = useMutation({ mutationFn: (request: Parameters<ApiClient['command']>[1]) => client.command(id, request), onSuccess: receipt => {
    setNotice(`${receipt.command}: solicitud aceptada (${receipt.requestId}). ${receipt.message || ''}`)
    cache.invalidateQueries({ queryKey: queryKeys.networkRuntime(id) })
    cache.invalidateQueries({ queryKey: queryKeys.runtime })
    cache.invalidateQueries({ queryKey: queryKeys.networkSummaries('') })
  } })
  if (network.isLoading) return <CircularProgress />
  if (network.isError || !network.data) return <Alert severity="error">La fuente solicitada no existe o no está disponible.</Alert>
  const canOperate = user?.roles.includes('ADMIN')
  return <Stack spacing={3}>
    <Box><Typography component={Link} to="/networks" color="primary">← Fuentes</Typography><Typography variant="h4">{network.data.acronym}</Typography><Typography color="text.secondary">{network.data.name} · {network.data.institutionName}</Typography></Box>
    {notice && <Alert severity="success">{notice}</Alert>}
    {command.isError && <Alert severity="error">{(command.error as ApiError).message}</Alert>}
    <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}>
      <Typography variant="h6">Operación</Typography>
      <Typography>URL OAI-PMH: {network.data.originUrl}</Typography>
      <Typography>Cron: {network.data.scheduleCronExpression || 'Sin programación'}</Typography>
      <Divider />
      <Typography variant="subtitle1">Procesos activos</Typography>
      {runtime.isLoading ? <CircularProgress size={20} /> : runtime.data?.length ? runtime.data.map(process => <Chip key={process.processId} label={`${process.actionType}: ${process.status} (${process.engineType})`} />) : <Typography color="text.secondary">No hay procesos activos.</Typography>}
      {canOperate && <NetworkOperations actions={capabilities.data?.actions || []} actionName={actionName} incremental={incremental} pending={command.isPending} onActionName={setActionName} onIncremental={setIncremental} onRun={() => command.mutate({ type: 'RUN_ACTION', actionName, incremental })} onRunEnabled={() => command.mutate('RUN_ENABLED_ACTIONS')} onReschedule={() => command.mutate('RESCHEDULE')} onCancel={() => setConfirmCancel(true)} />}
    </Stack></Paper>
    <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)}><DialogTitle>Cancelar operaciones de {network.data.acronym}</DialogTitle><DialogContent><Typography>Se cancelarán y retirarán de cola todas las acciones de esta fuente. En el ejecutor legacy el alcance de cancelación es toda la fuente.</Typography></DialogContent><DialogActions><Button onClick={() => setConfirmCancel(false)}>Volver</Button><Button color="error" variant="contained" disabled={command.isPending} onClick={() => { setConfirmCancel(false); command.mutate('CANCEL_ALL') }}>Cancelar operaciones</Button></DialogActions></Dialog>
  </Stack>
}

function NetworkOperations({ actions, actionName, incremental, pending, onActionName, onIncremental, onRun, onRunEnabled, onReschedule, onCancel }: { actions: Array<{ name: string; description: string; incremental: boolean; displayOrder: number | null }>; actionName: string; incremental: boolean; pending: boolean; onActionName: (name: string) => void; onIncremental: (next: boolean) => void; onRun: () => void; onRunEnabled: () => void; onReschedule: () => void; onCancel: () => void }) {
  const selected = actions.find(action => action.name === actionName)
  const ordered = [...actions].sort((left, right) => (left.displayOrder ?? 9999) - (right.displayOrder ?? 9999))
  return <><Divider /><Typography variant="subtitle1">Acciones del cosechador</Typography><Typography color="text.secondary">Los comandos se aceptan de forma asíncrona; el estado se consulta en la lista de procesos activos.</Typography>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}><TextField select label="Acción" value={actionName} onChange={event => { const name = event.target.value; onActionName(name); onIncremental(false) }} sx={{ minWidth: 320 }}><MenuItem value="">Selecciona una acción</MenuItem>{ordered.map(action => <MenuItem key={action.name} value={action.name}>{action.description || action.name} ({action.name})</MenuItem>)}</TextField>{selected?.incremental && <FormControlLabel control={<Checkbox checked={incremental} onChange={event => onIncremental(event.target.checked)} />} label="Ejecución incremental" />}<Button variant="contained" disabled={!actionName || pending} onClick={onRun}>Ejecutar acción</Button></Stack>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><Button variant="outlined" disabled={pending} onClick={onRunEnabled}>Ejecutar acciones habilitadas</Button><Button variant="outlined" disabled={pending} onClick={onReschedule}>Reprogramar fuente</Button><Button color="error" variant="outlined" disabled={pending} onClick={onCancel}>Cancelar todo</Button><Button variant="outlined" component={Link} to={location.pathname + '/edit'} disabled={pending}>Editar configuración</Button></Stack>
  </>
}
