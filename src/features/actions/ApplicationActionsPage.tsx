import RefreshIcon from '@mui/icons-material/Refresh'
import SettingsIcon from '@mui/icons-material/Settings'
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import type { ApplicationAction, ApplicationActionState, ApplicationActionUsage } from '../../api/types'
import { queryKeys } from '../../api/query-keys'
import { useAuth } from '../../auth/AuthProvider'

const stateLabel: Record<ApplicationActionState, string> = { ENABLED: 'Habilitada', DISABLED: 'Deshabilitada', UNAVAILABLE: 'No disponible', INVALID_CONFIGURATION: 'Configuración inválida' }
const stateColor: Record<ApplicationActionState, 'success' | 'default' | 'warning' | 'error'> = { ENABLED: 'success', DISABLED: 'default', UNAVAILABLE: 'warning', INVALID_CONFIGURATION: 'error' }

export function ApplicationActionsPage({ client }: { client: ApiClient }) {
  const cache = useQueryClient(); const { user } = useAuth(); const canEdit = Boolean(user?.roles.includes('ADMIN'))
  const query = useQuery({ queryKey: queryKeys.applicationActions, queryFn: () => client.applicationActions() })
  const [search, setSearch] = useState(''); const [state, setState] = useState('ALL'); const [confirm, setConfirm] = useState<{ action: ApplicationAction; usage: ApplicationActionUsage } | null>(null); const [editing, setEditing] = useState<ApplicationAction | null>(null)
  const update = useMutation({ mutationFn: ({ action, enabled, configuration }: { action: ApplicationAction; enabled: boolean; configuration: Record<string, unknown> }) => client.updateApplicationAction(action.actionKey, enabled, configuration), onSuccess: () => { cache.invalidateQueries({ queryKey: queryKeys.applicationActions }); cache.invalidateQueries({ queryKey: queryKeys.capabilities }); setConfirm(null); setEditing(null) } })
  const refresh = useMutation({ mutationFn: () => client.refreshApplicationActions(), onSuccess: () => { cache.invalidateQueries({ queryKey: queryKeys.applicationActions }); cache.invalidateQueries({ queryKey: queryKeys.capabilities }) } })
  const filtered = useMemo(() => (query.data || []).filter(action => (state === 'ALL' || action.state === state) && `${action.actionKey} ${action.definition.name || ''}`.toLowerCase().includes(search.toLowerCase())), [query.data, search, state])
  const toggle = async (action: ApplicationAction, enabled: boolean) => {
    if (!enabled) { setConfirm({ action, usage: await client.applicationActionUsage(action.actionKey) }); return }
    update.mutate({ action, enabled, configuration: action.configuration })
  }
  if (query.isLoading) return <CircularProgress />
  if (query.isError) return <Alert severity="error">No se pudo cargar el catálogo de acciones.</Alert>
  return <Stack spacing={3}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}><Box><Typography variant="h4">Acciones de la aplicación</Typography><Typography color="text.secondary">Motor activo: {query.data?.[0]?.engineType || 'sin acciones descubiertas'}</Typography></Box>{canEdit && <Button startIcon={<RefreshIcon />} variant="outlined" disabled={refresh.isPending} onClick={() => refresh.mutate()}>Refrescar catálogo</Button>}</Stack>
    {(update.isError || refresh.isError) && <Alert severity="error">{((update.error || refresh.error) as ApiError).message}</Alert>}
    {refresh.data && <Alert severity="success">Catálogo actualizado: {refresh.data.created} nuevas, {refresh.data.updated} actualizadas, {refresh.data.unavailable} no disponibles.</Alert>}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField label="Buscar" value={search} onChange={event => setSearch(event.target.value)} fullWidth /><TextField select label="Estado" value={state} onChange={event => setState(event.target.value)} sx={{ minWidth: 220 }}><MenuItem value="ALL">Todos</MenuItem>{Object.entries(stateLabel).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField></Stack>
    <Paper variant="outlined"><Table><TableHead><TableRow><TableCell>Acción</TableCell><TableCell>Clave</TableCell><TableCell>Estado</TableCell><TableCell>Última detección</TableCell><TableCell align="right">Configuración</TableCell><TableCell align="right">Habilitada</TableCell></TableRow></TableHead><TableBody>{filtered.map(action => <TableRow key={action.actionKey}><TableCell><Typography fontWeight={600}>{action.definition.name || action.actionKey}</Typography><Typography variant="body2" color="text.secondary">{action.definition.description}</Typography></TableCell><TableCell><code>{action.actionKey}</code></TableCell><TableCell><Chip size="small" label={stateLabel[action.state]} color={stateColor[action.state]} /></TableCell><TableCell>{formatDate(action.lastSeenAt)}</TableCell><TableCell align="right"><Button size="small" startIcon={<SettingsIcon />} onClick={() => setEditing(action)}>Defaults</Button></TableCell><TableCell align="right"><FormControlLabel label="" control={<Switch checked={action.enabled} disabled={!canEdit || !action.available || update.isPending} onChange={event => void toggle(action, event.target.checked)} />} /></TableCell></TableRow>)}</TableBody></Table></Paper>
    <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} maxWidth="sm" fullWidth><DialogTitle>Deshabilitar {confirm?.action.actionKey}</DialogTitle><DialogContent><Alert severity="warning" sx={{ mb: 2 }}>Se bloquearán las ejecuciones nuevas. Los procesos activos o en cola continuarán.</Alert><Typography>{confirm?.usage.networkCount || 0} fuentes y {confirm?.usage.scheduleCount || 0} schedules están afectados.</Typography>{confirm?.usage.networks.map(network => <Typography key={network.id} variant="body2">• {network.acronym}: {network.relations.join(', ')}</Typography>)}</DialogContent><DialogActions><Button onClick={() => setConfirm(null)}>Cancelar</Button><Button color="error" variant="contained" onClick={() => confirm && update.mutate({ action: confirm.action, enabled: false, configuration: confirm.action.configuration })}>Deshabilitar</Button></DialogActions></Dialog>
    {editing && <ConfigurationDialog action={editing} canEdit={canEdit} saving={update.isPending} onClose={() => setEditing(null)} onSave={configuration => update.mutate({ action: editing, enabled: editing.enabled, configuration })} />}
  </Stack>
}

function ConfigurationDialog({ action, canEdit, saving, onClose, onSave }: { action: ApplicationAction; canEdit: boolean; saving: boolean; onClose: () => void; onSave: (value: Record<string, unknown>) => void }) {
  const [configuration, setConfiguration] = useState(action.configuration); const hasSchema = Boolean(action.schema.properties && Object.keys(action.schema.properties as object).length)
  return <Dialog open onClose={onClose} maxWidth="md" fullWidth><DialogTitle>Defaults de {action.actionKey}</DialogTitle><DialogContent>{hasSchema ? <Form schema={action.schema} uiSchema={action.uiSchema} validator={validator} formData={configuration} liveValidate showErrorList={false} readonly={!canEdit} onChange={event => setConfiguration((event.formData || {}) as Record<string, unknown>)}><span /></Form> : <Alert severity="info">Esta acción no publica un esquema. La única configuración válida es un objeto vacío.</Alert>}</DialogContent><DialogActions><Button onClick={onClose}>Cerrar</Button>{canEdit && <Button variant="contained" disabled={saving} onClick={() => onSave(hasSchema ? configuration : {})}>Guardar</Button>}</DialogActions></Dialog>
}

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—' }
