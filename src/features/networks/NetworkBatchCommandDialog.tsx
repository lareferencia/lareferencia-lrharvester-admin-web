import { useMemo, useState } from 'react'
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, List, ListItem, ListItemText, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import type { CapabilityAction, CommandRequest, NetworkSummary } from '../../api/types'

type Props = {
  open: boolean
  client: ApiClient
  networks: NetworkSummary[]
  actions: CapabilityAction[]
  onClose: () => void
  onCompleted: (message: string) => void
}

export function NetworkBatchCommandDialog({ open, client, networks, actions, onClose, onCompleted }: Props) {
  const { t } = useTranslation()
  const cache = useQueryClient()
  const orderedActions = useMemo(() => [...actions].sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)), [actions])
  const [actionName, setActionName] = useState('')
  const selectedAction = orderedActions.find(action => action.name === actionName)
  const [incremental, setIncremental] = useState(false)
  const execute = useMutation({
    mutationFn: (command: CommandRequest) => client.batchCommand(networks.map(network => network.id), command),
    onSuccess: receipt => {
      const accepted = receipt.children.filter(child => child.result === 'ACCEPTED').length
      const rejected = receipt.children.length - accepted
      void cache.invalidateQueries({ queryKey: ['network-summaries'] })
      void cache.invalidateQueries({ queryKey: ['runtime'] })
      onCompleted(t('networks.batchCompleted', { accepted, rejected }))
    },
  })

  const close = () => { if (!execute.isPending) { execute.reset(); onClose() } }
  const submit = () => { if (actionName) execute.mutate({ type: 'RUN_ACTION', actionName, incremental: selectedAction?.incremental ? incremental : false }) }
  const rejected = execute.data?.children.filter(child => child.result === 'REJECTED') || []

  return <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
    <DialogTitle>{t('networks.batchTitle', { count: networks.length })}</DialogTitle>
    <DialogContent dividers>
      {execute.isSuccess ? <Stack spacing={2}>
        <Alert severity={rejected.length ? 'warning' : 'success'}>{t('networks.batchCompleted', { accepted: execute.data.children.length - rejected.length, rejected: rejected.length })}</Alert>
        {rejected.length > 0 && <Box><Typography fontWeight={700} sx={{ mb: .5 }}>{t('networks.batchRejected')}</Typography><List dense disablePadding>{rejected.map(receipt => { const network = networks.find(item => item.id === receipt.networkId); return <ListItem key={receipt.requestId} disableGutters><ListItemText primary={network?.acronym || `#${receipt.networkId}`} secondary={receipt.message || t('networks.batchRejected')} /></ListItem> })}</List></Box>}
      </Stack> : <Stack spacing={2}>
        <Typography>{t('networks.batchDescription', { count: networks.length })}</Typography>
        <TextField select label={t('common.action')} value={actionName} onChange={event => { setActionName(event.target.value); setIncremental(false) }} fullWidth>
          <MenuItem value="">{t('networks.batchChooseAction')}</MenuItem>
          {orderedActions.map(action => <MenuItem key={action.name} value={action.name}>{action.description || action.name}</MenuItem>)}
        </TextField>
        {selectedAction?.incremental && <FormControlLabel control={<Checkbox checked={incremental} onChange={event => setIncremental(event.target.checked)} />} label={t('networks.batchIncremental')} />}
        <Box sx={{ maxHeight: 180, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1.5, px: 1.5 }}><List dense>{networks.map(network => <ListItem key={network.id} disableGutters><ListItemText primary={network.acronym} secondary={network.name} /></ListItem>)}</List></Box>
        {execute.isError && <Alert severity="error">{(execute.error as ApiError).message}</Alert>}
      </Stack>}
    </DialogContent>
    <DialogActions>
      <Button onClick={close} disabled={execute.isPending}>{execute.isSuccess ? t('common.close') : t('common.cancel')}</Button>
      {!execute.isSuccess && <Button variant="contained" onClick={submit} disabled={!actionName || execute.isPending}>{t('networks.batchExecute')}</Button>}
    </DialogActions>
  </Dialog>
}
