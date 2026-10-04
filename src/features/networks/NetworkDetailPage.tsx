import { uiText } from '../../i18n'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import { queryKeys } from '../../api/query-keys'
import { useAuth } from '../../auth/AuthProvider'
import { NetworkIndexingResults } from './IndexingResults'

export function NetworkDetailPage({ client }: { client: ApiClient }) {
  const { t } = useTranslation()
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
    setNotice(uiText('commandAccepted', { command: receipt.command, requestId: receipt.requestId, message: receipt.message || '' }))
    cache.invalidateQueries({ queryKey: queryKeys.networkRuntime(id) })
    cache.invalidateQueries({ queryKey: queryKeys.runtime })
    cache.invalidateQueries({ queryKey: queryKeys.networkSummaries('') })
  } })
  if (network.isLoading) return <CircularProgress />
  if (network.isError || !network.data) return <Alert severity="error">{uiText('sourceUnavailable')}</Alert>
  const canOperate = user?.roles.includes('ADMIN')
  return <Stack spacing={3}>
    <Box><Typography component={Link} to="/networks" color="primary">{uiText('backSources')}</Typography><Typography variant="h4">{network.data.acronym}</Typography><Typography color="text.secondary">{network.data.name} · {network.data.institutionName}</Typography></Box>
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">{network.data.tags?.map(tag => <Chip key={tag} size="small" label={tag} component={Link} clickable to={`/networks?${new URLSearchParams({ tag })}`} />)}</Stack>
    {notice && <Alert severity="success">{notice}</Alert>}
    {command.isError && <Alert severity="error">{(command.error as ApiError).message}</Alert>}
    <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}>
      <Typography variant="h6">{uiText('operation')}</Typography>
      <Typography>{uiText('oaiUrlLabel')} {network.data.originUrl}</Typography>
      <Typography>{uiText('cronLabel')} {network.data.scheduleCronExpression || uiText('noSchedule')}</Typography>
      <Divider />
      <Typography variant="subtitle1">{uiText('activeProcesses')}</Typography>
      {runtime.isLoading ? <CircularProgress size={20} /> : runtime.data?.length ? runtime.data.map(process => <Chip key={process.processId} label={`${t(`networks.actionNames.${process.actionType}`, { defaultValue: process.actionType })}: ${t(`ui.${process.status}`, { defaultValue: process.status })} (${process.engineType})`} />) : <Typography color="text.secondary">{uiText('noActiveProcesses')}</Typography>}
      {canOperate && <NetworkOperations actions={capabilities.data?.actions || []} actionName={actionName} incremental={incremental} pending={command.isPending} onActionName={setActionName} onIncremental={setIncremental} onRun={() => command.mutate({ type: 'RUN_ACTION', actionName, incremental })} onRunEnabled={() => command.mutate('RUN_ENABLED_ACTIONS')} onReschedule={() => command.mutate('RESCHEDULE')} onCancel={() => setConfirmCancel(true)} />}
    </Stack></Paper>
    <NetworkIndexingResults client={client} networkId={id} />
    <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)}><DialogTitle>{uiText('cancelOperationsFor')} {network.data.acronym}</DialogTitle><DialogContent><Typography>{uiText('cancelLegacyHelp')}</Typography></DialogContent><DialogActions><Button onClick={() => setConfirmCancel(false)}>{uiText('back')}</Button><Button color="error" variant="contained" disabled={command.isPending} onClick={() => { setConfirmCancel(false); command.mutate('CANCEL_ALL') }}>{uiText('cancelOperations')}</Button></DialogActions></Dialog>
  </Stack>
}

function NetworkOperations({ actions, actionName, incremental, pending, onActionName, onIncremental, onRun, onRunEnabled, onReschedule, onCancel }: { actions: Array<{ name: string; description: string; incremental: boolean; order: number | null }>; actionName: string; incremental: boolean; pending: boolean; onActionName: (name: string) => void; onIncremental: (next: boolean) => void; onRun: () => void; onRunEnabled: () => void; onReschedule: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const selected = actions.find(action => action.name === actionName)
  const ordered = [...actions].sort((left, right) => (left.order ?? 9999) - (right.order ?? 9999))
  return <><Divider /><Typography variant="subtitle1">{uiText('harvesterActions')}</Typography><Typography color="text.secondary">{uiText('asyncCommandsHelp')}</Typography>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}><TextField select label={uiText('action')} value={actionName} onChange={event => { const name = event.target.value; onActionName(name); onIncremental(false) }} sx={{ minWidth: 320 }}><MenuItem value="">{uiText('selectAction')}</MenuItem>{ordered.map(action => <MenuItem key={action.name} value={action.name}>{t(`networks.actionNames.${action.name}`, { defaultValue: action.description || action.name })} ({action.name})</MenuItem>)}</TextField>{selected?.incremental && <FormControlLabel control={<Checkbox checked={incremental} onChange={event => onIncremental(event.target.checked)} />} label={uiText('incrementalExecution')} />}<Button variant="contained" disabled={!actionName || pending} onClick={onRun}>{uiText('runAction')}</Button></Stack>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><Button variant="outlined" disabled={pending} onClick={onRunEnabled}>{uiText('runEnabledActions')}</Button><Button variant="outlined" disabled={pending} onClick={onReschedule}>{uiText('rescheduleSource')}</Button><Button color="error" variant="outlined" disabled={pending} onClick={onCancel}>{uiText('cancelAll')}</Button><Button variant="outlined" component={Link} to={location.pathname + '/edit'} disabled={pending}>{uiText('editConfiguration')}</Button></Stack>
  </>
}
