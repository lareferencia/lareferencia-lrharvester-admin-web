import { Accordion, AccordionDetails, AccordionSummary, Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Chip, Divider, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useState, type ReactNode } from 'react'
import type { ApiClient } from '../../api/client'
import type { DarkAuthentication } from '../../api/types'
import { ApiError } from '../../api/problem-detail'
import { uiText } from '../../i18n'

export function DarkAuthenticationPanel({ client, configurationEditing, authorityField }: { client: ApiClient; configurationEditing: boolean; authorityField?: ReactNode }) {
  const cache = useQueryClient()
  const status = useQuery({ queryKey: ['dark-authentication'], queryFn: () => client.darkAuthentication(), refetchInterval: 10_000 })
  const [confirmation, setConfirmation] = useState<{ action: 'generate' | 'resume'; value: DarkAuthentication } | null>(null)
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ['dark-authentication'] })
    void cache.invalidateQueries({ queryKey: ['dark-configuration'] })
  }
  const action = useMutation({
    mutationFn: (request: NonNullable<typeof confirmation>) => request.action === 'generate'
      ? client.generateDarkCredentials(request.value.credentialId) : client.resumeDarkAuthentication(request.value),
    onSuccess: value => { cache.setQueryData(['dark-authentication'], value); setConfirmation(null); refresh() },
    onError: refresh,
  })
  const copy = useMutation({ mutationFn: () => navigator.clipboard.writeText(status.data!.publicKey!) })
  if (status.isLoading) return <Typography>{uiText('darkAuthTitle')}…</Typography>
  if (!status.data || status.isError) return <Alert severity="error">{uiText('darkAuthError')}</Alert>
  const value = status.data
  const blocked = configurationEditing || action.isPending
  const stateText = value.mode === 'legacy' ? 'darkAuthLegacy' : ({ not_configured: 'darkAuthNotConfigured', pending_registration: 'darkAuthPending', enabled: 'darkAuthEnabled', unavailable: 'darkAuthUnavailable' } as const)[value.registrationStatus]
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${value.publicKey}\n`], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'dark-minter.pub'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (value.mode !== 'dark2') return <>{authorityField}</>
  return <Stack spacing={2}>
    <Divider />
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="subtitle1" fontWeight={700}>{uiText('darkPublicKeyStep')}</Typography><Chip size="small" label={uiText(stateText)} color={value.registrationStatus === 'enabled' ? 'success' : value.registrationStatus === 'unavailable' ? 'error' : 'default'} /></Stack>
    <Typography variant="body2" color="text.secondary">{uiText('darkPublicKeyHelp')}</Typography>
    {configurationEditing && <Alert severity="info">{uiText('darkAuthSavedConfig')}</Alert>}
    {value.publicKey && <>
      <TextField multiline fullWidth label={uiText('darkPublicKey')} value={value.publicKey} slotProps={{ input: { readOnly: true } }} />
      <Stack direction="row" spacing={1}><Button onClick={() => copy.mutate()}>{uiText('darkCopyKey')}</Button><Button onClick={download}>{uiText('darkDownloadKey')}</Button></Stack>
      {copy.isSuccess && <Typography variant="caption" color="text.secondary">{uiText('darkKeyCopied')}</Typography>}
      {copy.isError && <Alert severity="error">{uiText('darkCopyError')}</Alert>}
      <Accordion disableGutters elevation={0}><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2">{uiText('darkKeyDetails')}</Typography></AccordionSummary><AccordionDetails><Stack spacing={1}><Typography variant="body2">{uiText('darkPrivateKeyHelp')}</Typography><Typography variant="caption">{uiText('darkKeyFingerprint')}</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere', fontFamily: 'monospace' }}>{value.keyId}</Typography></Stack></AccordionDetails></Accordion>
    </>}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <Button variant="outlined" color={value.credentialId ? 'warning' : 'primary'} disabled={blocked || value.mode !== 'dark2'} onClick={() => { action.reset(); setConfirmation({ action: 'generate', value }) }}>{uiText(value.credentialId ? 'darkRegenerateKeys' : 'darkGenerateKeys')}</Button>
    </Stack>
    <Typography variant="caption" color="text.secondary">{uiText('darkKeyStorageHelp')}</Typography>
    <Divider />
    <Typography variant="subtitle1" fontWeight={700}>{uiText('darkAuthorityStep')}</Typography>
    {authorityField}
    {!authorityField && <Typography variant="body2">{uiText('authorityId')}: {value.authorityId || '—'}</Typography>}
    <Typography variant="body2" color="text.secondary">{uiText('darkKeyRegistrationHelp')}</Typography>
    <Stack direction="row">
      {value.credentialId && value.registrationStatus === 'pending_registration' && <Button variant="contained" disabled={blocked || !value.publicKey || !value.keyId || !value.authorityId?.trim() || !value.baseUrl} onClick={() => { action.reset(); setConfirmation({ action: 'resume', value }) }}>{uiText('darkResume')}</Button>}
    </Stack>
    {(action.isError && !confirmation) && <Alert severity="error">{uiText('darkAuthError')} {errorDetail(action.error)}</Alert>}
    <Dialog open={Boolean(confirmation)} onClose={() => { if (!action.isPending) setConfirmation(null) }} fullWidth maxWidth="sm">
      <DialogTitle>{uiText(confirmation?.action === 'resume' ? 'darkResume' : confirmation?.value.credentialId ? 'darkRegenerateKeys' : 'darkGenerateKeys')}</DialogTitle>
      <DialogContent><Stack spacing={2}>
        <Typography>{uiText(confirmation?.action === 'resume' ? 'darkResumeWarning' : 'darkGenerateWarning')}</Typography>
        {confirmation?.action === 'resume' && <><Typography sx={{ overflowWrap: 'anywhere' }}>{confirmation.value.authorityId}<br />{confirmation.value.baseUrl}</Typography><Typography sx={{ overflowWrap: 'anywhere' }}>{confirmation.value.keyId}</Typography></>}
        {action.isError && <Alert severity="error">{uiText('darkAuthError')} {errorDetail(action.error)}</Alert>}
      </Stack></DialogContent>
      <DialogActions><Button disabled={action.isPending} onClick={() => setConfirmation(null)}>{uiText('cancel')}</Button><Button variant="contained" disabled={action.isPending} onClick={() => confirmation && action.mutate(confirmation)}>{uiText('confirm')}</Button></DialogActions>
    </Dialog>
  </Stack>
}

function errorDetail(error: Error | null) {
  return error instanceof ApiError ? error.problem.detail : undefined
}
