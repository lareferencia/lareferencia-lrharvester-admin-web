import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '../../api/client'
import type { ManagedUser, NetworkGrant, ServiceAccount } from '../../api/types'
import { useTranslation } from 'react-i18next'
import { RepositoryAccessPicker } from './RepositoryAccessPicker'

export function UsersPage({ client }: { client: ApiClient }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const users = useQuery({ queryKey: ['users'], queryFn: () => client.users() })
  const accounts = useQuery({ queryKey: ['service-accounts'], queryFn: () => client.serviceAccounts() })
  const networkQuery = useQuery({
    queryKey: ['network-summaries', 'access-list'],
    queryFn: async () => {
      const repositories: NetworkGrant[] = []
      let page = 0
      let totalPages = 1
      do {
        const result = await client.networkSummaries(new URLSearchParams({ page: String(page), size: '200', sort: 'acronym,asc' }))
        repositories.push(...result.items)
        totalPages = result.totalPages
        page += 1
      } while (page < totalPages)
      return repositories
    },
  })
  const availableNetworks = networkQuery.data ?? []
  const [dialog, setDialog] = useState<'user' | 'service' | null>(null)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [editingService, setEditingService] = useState<ServiceAccount | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'READER' | 'DASHBOARD'>('DASHBOARD')
  const [networkIds, setNetworkIds] = useState<number[]>([])
  const [enabled, setEnabled] = useState(true)
  const [serviceName, setServiceName] = useState('')
  const [serviceEnabled, setServiceEnabled] = useState(true)
  const [tokenAccountId, setTokenAccountId] = useState<number | null>(null)
  const [tokenValue, setTokenValue] = useState('')
  const [error, setError] = useState('')
  const label = (key: string, fallback: string) => t(key, { defaultValue: fallback })
  const refresh = async () => Promise.all([qc.invalidateQueries({ queryKey: ['users'] }), qc.invalidateQueries({ queryKey: ['service-accounts'] }), qc.invalidateQueries({ queryKey: ['network-summaries'] })])
  const showError = (cause: unknown) => setError(cause instanceof Error ? cause.message : 'Error')
  const userMutation = useMutation({
    mutationFn: () => editing
      ? client.updateUser(editing.username, { role, enabled, networkIds: role !== 'ADMIN' ? networkIds : [], ...(password ? { password } : {}) })
      : client.createUser({ username, password, role, networkIds: role !== 'ADMIN' ? networkIds : [] }),
    onSuccess: async () => { await refresh(); setDialog(null); setPassword('') }, onError: showError,
  })
  const deleteUser = useMutation({ mutationFn: (name: string) => client.deleteUser(name), onSuccess: () => void refresh(), onError: showError })
  const serviceMutation = useMutation({
    mutationFn: () => editingService
      ? client.updateServiceAccount(editingService.id, { enabled: serviceEnabled, networkIds })
      : client.createServiceAccount(serviceName, networkIds),
    onSuccess: async () => { await refresh(); setDialog(null) }, onError: showError,
  })
  const deleteService = useMutation({ mutationFn: (id: number) => client.deleteServiceAccount(id), onSuccess: () => void refresh(), onError: showError })
  const issueToken = useMutation({
    mutationFn: (id: number) => client.issueToken(id, new Date(Date.now() + 90 * 86400000).toISOString()),
    onSuccess: async (result, accountId) => { setTokenAccountId(accountId); setTokenValue(result.value); await qc.invalidateQueries({ queryKey: ['tokens', accountId] }) }, onError: showError,
  })
  const tokenQuery = useQuery({ queryKey: ['tokens', tokenAccountId], queryFn: () => client.tokens(tokenAccountId!), enabled: tokenAccountId !== null })
  const revokeToken = useMutation({
    mutationFn: ({ accountId, tokenId }: { accountId: number; tokenId: number }) => client.revokeToken(accountId, tokenId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tokens', tokenAccountId] }), onError: showError,
  })
  const networkPicker = <RepositoryAccessPicker
    key={`${dialog}-${editing?.id ?? editingService?.id ?? 'new'}`}
    repositories={availableNetworks}
    assignedRepositories={dialog === 'user' ? editing?.networks ?? [] : editingService?.networks ?? []}
    selectedIds={networkIds}
    onChange={setNetworkIds}
    loading={networkQuery.isPending}
    loadError={networkQuery.isError}
    onRetry={() => void networkQuery.refetch()}
    disabled={userMutation.isPending || serviceMutation.isPending}
  />
  const edit = (user: ManagedUser) => { setEditing(user); setRole(user.role); setEnabled(user.enabled); setNetworkIds(user.networks.map(n => n.id)); setPassword(''); setError(''); setDialog('user') }
  const newUser = () => { setEditing(null); setUsername(''); setPassword(''); setRole('DASHBOARD'); setNetworkIds([]); setEnabled(true); setError(''); setDialog('user') }

  return <Stack spacing={3}>
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h4">{label('users.title', 'Usuarios y accesos')}</Typography><Button variant="contained" onClick={newUser}>{label('users.new', 'Crear usuario')}</Button></Stack>
    <Typography color="text.secondary">{label('users.accessHelp', 'Los usuarios Dashboard, lectores y cuentas técnicas solo consultan los repositorios asignados. Los permisos se muestran por acrónimo.')}</Typography>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    {tokenValue && <Alert severity="success" onClose={() => setTokenValue('')}>{label('users.copyToken', 'Copia ahora este token; solo se muestra una vez:')} <strong>{tokenValue}</strong></Alert>}
    <Paper variant="outlined"><Table><TableHead><TableRow><TableCell>{label('users.username', 'Usuario')}</TableCell><TableCell>{label('users.roles', 'Rol')}</TableCell><TableCell>{label('users.repositories', 'Repositorios')}</TableCell><TableCell>{label('users.status', 'Estado')}</TableCell><TableCell align="right">{label('users.actions', 'Acciones')}</TableCell></TableRow></TableHead>
      <TableBody>{users.data?.map(user => <TableRow key={user.id}><TableCell>{user.username}</TableCell><TableCell>{user.role}</TableCell>
        <TableCell>{user.role === 'ADMIN' ? label('users.allNetworks', 'Todos') : user.networks.map(n => n.acronym).join(', ') || '—'}</TableCell><TableCell>{user.enabled ? label('users.enabled', 'Activo') : label('users.disabled', 'Desactivado')}</TableCell>
        <TableCell align="right"><Button onClick={() => edit(user)}>{label('users.edit', 'Editar')}</Button><Button color="error" onClick={() => { if (window.confirm(label('users.confirmDelete', '¿Eliminar este usuario?'))) deleteUser.mutate(user.username) }}>{t('common.delete')}</Button></TableCell></TableRow>)}</TableBody>
    </Table></Paper>

    <Stack direction="row" justifyContent="space-between" alignItems="center"><Stack><Typography variant="h5">{label('users.serviceAccounts', 'Cuentas técnicas')}</Typography><Typography variant="body2" color="text.secondary">{label('users.serviceHelp', 'Identidades separadas para scripts; sus tokens permiten solo lectura.')}</Typography></Stack>
      <Button variant="outlined" onClick={() => { setEditingService(null); setServiceName(''); setServiceEnabled(true); setNetworkIds([]); setError(''); setDialog('service') }}>{label('users.newService', 'Crear cuenta técnica')}</Button></Stack>
    <Paper variant="outlined"><Table><TableHead><TableRow><TableCell>{label('users.account', 'Cuenta')}</TableCell><TableCell>{label('users.repositories', 'Repositorios')}</TableCell><TableCell>{label('users.status', 'Estado')}</TableCell><TableCell align="right">{label('users.actions', 'Acciones')}</TableCell></TableRow></TableHead>
      <TableBody>{accounts.data?.map(account => <TableRow key={account.id}><TableCell>{account.name}</TableCell><TableCell>{account.networks.map(n => n.acronym).join(', ')}</TableCell><TableCell>{account.enabled ? label('users.enabled', 'Activa') : label('users.disabled', 'Desactivada')}</TableCell>
        <TableCell align="right"><Button onClick={() => { setEditingService(account); setServiceName(account.name); setServiceEnabled(account.enabled); setNetworkIds(account.networks.map(n => n.id)); setError(''); setDialog('service') }}>{label('users.edit', 'Editar')}</Button><Button onClick={() => { setTokenAccountId(account.id); setTokenValue('') }}>{label('users.tokens', 'Tokens')}</Button><Button disabled={!account.enabled} onClick={() => { setTokenAccountId(account.id); issueToken.mutate(account.id) }}>{label('users.issueToken', 'Emitir token 90 días')}</Button>
          <Button color="error" onClick={() => { if (window.confirm(label('users.confirmDeleteAccount', '¿Eliminar cuenta y revocar sus tokens?'))) deleteService.mutate(account.id) }}>{t('common.delete')}</Button></TableCell></TableRow>)}</TableBody>
    </Table></Paper>

    {tokenAccountId !== null && <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1}>
      <Stack direction="row" justifyContent="space-between"><Typography variant="h6">{label('users.tokens', 'Tokens')}</Typography><Button onClick={() => setTokenAccountId(null)}>{t('common.close', { defaultValue: 'Cerrar' })}</Button></Stack>
      {tokenQuery.data?.map(token => <Stack key={token.id} direction="row" alignItems="center" spacing={2}><Typography variant="body2">{token.prefix} · {new Date(token.expiresAt).toLocaleString()}</Typography>
        <Typography variant="body2">{token.revokedAt ? label('users.revoked', 'Revocado') : token.lastUsedAt ? label('users.used', 'Usado') : label('users.unused', 'Sin uso')}</Typography>
        {!token.revokedAt && <Button color="error" onClick={() => revokeToken.mutate({ accountId: tokenAccountId, tokenId: token.id })}>{label('users.revoke', 'Revocar')}</Button>}</Stack>)}
    </Stack></Paper>}

    <Dialog open={dialog === 'user'} onClose={() => setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>{editing ? label('users.edit', 'Editar usuario') : label('users.new', 'Crear usuario')}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{!editing && <TextField label={label('users.username', 'Usuario')} value={username} onChange={event => setUsername(event.target.value)} />}
        <FormControl fullWidth><InputLabel id="user-role-label">{label('users.roles', 'Rol')}</InputLabel><Select labelId="user-role-label" value={role} label={label('users.roles', 'Rol')} onChange={event => setRole(event.target.value as 'ADMIN' | 'READER' | 'DASHBOARD')}>
          <MenuItem value="ADMIN">{label('users.admin', 'Administrador global')}</MenuItem><MenuItem value="READER">{label('users.reader', 'Lector')}</MenuItem><MenuItem value="DASHBOARD">{label('users.dashboard', 'Dashboard')}</MenuItem></Select></FormControl>
        {role !== 'ADMIN' && networkPicker}
        <TextField required={!editing} inputProps={{ minLength: 12, maxLength: 200 }} helperText={label('users.passwordRule', 'Mínimo 12 caracteres. En edición, déjalo vacío para conservar la contraseña.')} label={editing ? label('users.newPassword', 'Nueva contraseña') : label('users.password', 'Contraseña')} type="password" value={password} onChange={event => setPassword(event.target.value)} />
        {editing && <FormControl fullWidth><InputLabel id="user-enabled-label">{label('users.status', 'Estado')}</InputLabel><Select labelId="user-enabled-label" value={enabled ? 'true' : 'false'} label={label('users.status', 'Estado')} onChange={event => setEnabled(event.target.value === 'true')}><MenuItem value="true">{label('users.enabled', 'Activo')}</MenuItem><MenuItem value="false">{label('users.disabled', 'Desactivado')}</MenuItem></Select></FormControl>}
      </Stack></DialogContent><DialogActions><Button onClick={() => setDialog(null)}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={() => userMutation.mutate()} disabled={(role !== 'ADMIN' && (networkQuery.isPending || networkQuery.isError)) || (!editing && (!username.trim() || password.length < 12)) || (!!editing && !!password && password.length < 12) || userMutation.isPending}>{t('common.save')}</Button></DialogActions>
    </Dialog>

    <Dialog open={dialog === 'service'} onClose={() => setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>{editingService ? label('users.edit', 'Editar cuenta técnica') : label('users.newService', 'Crear cuenta técnica')}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      {!editingService && <TextField label={label('users.account', 'Nombre')} value={serviceName} onChange={event => setServiceName(event.target.value)} />}{networkPicker}
      {editingService && <FormControl fullWidth><InputLabel id="service-enabled-label">{label('users.status', 'Estado')}</InputLabel><Select labelId="service-enabled-label" value={serviceEnabled ? 'true' : 'false'} label={label('users.status', 'Estado')} onChange={event => setServiceEnabled(event.target.value === 'true')}><MenuItem value="true">{label('users.enabled', 'Activa')}</MenuItem><MenuItem value="false">{label('users.disabled', 'Desactivada')}</MenuItem></Select></FormControl>}
    </Stack></DialogContent><DialogActions><Button onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button variant="contained" onClick={() => serviceMutation.mutate()} disabled={(!editingService && !serviceName.trim()) || !networkIds.length || networkQuery.isPending || networkQuery.isError || serviceMutation.isPending}>{t('common.save')}</Button></DialogActions></Dialog>
  </Stack>
}
