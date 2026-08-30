import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import type { NetworkImportMode, NetworkImportValidation } from '../../api/types'
import { queryKeys } from '../../api/query-keys'

export function NetworkTransferDialog({ open, client, onClose, onImported }: { open: boolean; client: ApiClient; onClose: () => void; onImported: (message: string) => void }) {
  const { t } = useTranslation()
  const cache = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<NetworkImportMode>('UPSERT')
  const [validation, setValidation] = useState<NetworkImportValidation | null>(null)
  const validate = useMutation({ mutationFn: () => client.validateNetworkImport(file!, mode), onSuccess: setValidation })
  const execute = useMutation({
    mutationFn: () => client.importNetworksXlsx(file!, mode),
    onSuccess: result => {
      void cache.invalidateQueries({ queryKey: ['network-summaries'] })
      onImported(t('networks.importSuccess', { created: result.created, updated: result.updated }))
      close()
    },
  })
  const chooseFile = (selected: File | null) => { setFile(selected); setValidation(null); validate.reset(); execute.reset() }
  const close = () => { if (!validate.isPending && !execute.isPending) { setFile(null); setValidation(null); validate.reset(); execute.reset(); onClose() } }
  const canImport = validation !== null && validation.invalidRows === 0 && validation.validRows > 0 && !execute.isPending
  return <Dialog open={open} onClose={close} fullWidth maxWidth="md"><DialogTitle>{t('networks.importSources')}</DialogTitle><DialogContent dividers><Stack spacing={2.25}>
    <Typography color="text.secondary">{t('networks.importDescription')}</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
      <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />}>{t('networks.selectXlsx')}<input hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => chooseFile(event.target.files?.[0] || null)} /></Button>
      <Typography variant="body2" color={file ? 'text.primary' : 'text.secondary'}>{file?.name || t('networks.noFile')}</Typography>
      <TextField select size="small" label={t('networks.importMode')} value={mode} onChange={event => { setMode(event.target.value as NetworkImportMode); setValidation(null) }} sx={{ minWidth: 190 }}>
        <MenuItem value="UPSERT">{t('networks.importModes.UPSERT')}</MenuItem><MenuItem value="CREATE_ONLY">{t('networks.importModes.CREATE_ONLY')}</MenuItem><MenuItem value="UPDATE_ONLY">{t('networks.importModes.UPDATE_ONLY')}</MenuItem>
      </TextField>
      <Button variant="contained" disabled={!file || validate.isPending || execute.isPending} onClick={() => validate.mutate()}>{validate.isPending ? <CircularProgress size={18} color="inherit" /> : t('networks.validateImport')}</Button>
    </Stack>
    {validate.isError && <Alert severity="error">{(validate.error as ApiError).message}</Alert>}
    {execute.isError && <Alert severity="error">{(execute.error as ApiError).message}</Alert>}
    {validation && <ValidationResult validation={validation} />}
  </Stack></DialogContent><DialogActions><Button onClick={close} disabled={validate.isPending || execute.isPending}>{t('common.cancel')}</Button><Button variant="contained" disabled={!canImport} onClick={() => execute.mutate()}>{execute.isPending ? <CircularProgress size={18} color="inherit" /> : t('networks.applyImport')}</Button></DialogActions></Dialog>
}

function ValidationResult({ validation }: { validation: NetworkImportValidation }) {
  const { t } = useTranslation()
  const valid = validation.invalidRows === 0
  return <Stack spacing={1.25}><Alert severity={valid ? 'success' : 'warning'}>{t(valid ? 'networks.importValid' : 'networks.importInvalid', { valid: validation.validRows, invalid: validation.invalidRows, total: validation.totalRows })}</Alert>
    <Table size="small"><TableHead><TableRow><TableCell>{t('networks.importRow')}</TableCell><TableCell>{t('networks.acronym')}</TableCell><TableCell>{t('networks.importOperation')}</TableCell><TableCell>{t('networks.importIssues')}</TableCell></TableRow></TableHead><TableBody>{validation.rows.map(row => <TableRow key={row.row}><TableCell>{row.row}</TableCell><TableCell>{row.acronym || '—'}</TableCell><TableCell>{row.operation === 'CREATE' ? t('networks.createOperation') : t('networks.updateOperation')}</TableCell><TableCell>{[...row.errors, ...row.warnings].length ? [...row.errors, ...row.warnings].map((issue, index) => <Typography key={index} variant="body2" color={row.errors.includes(issue) ? 'error.main' : 'warning.main'}>{issue}</Typography>) : <Typography variant="body2" color="success.main">{t('networks.importOk')}</Typography>}</TableCell></TableRow>)}</TableBody></Table>
  </Stack>
}
