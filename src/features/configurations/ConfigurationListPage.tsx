import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DownloadIcon from '@mui/icons-material/Download'
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import type { ConfigurationExport, NamedConfiguration, Usage } from '../../api/types'
import { useAuth } from '../../auth/AuthProvider'
import { queryKeys } from '../../api/query-keys'
import { useTranslation } from 'react-i18next'

type Kind = 'validator' | 'transformer'
export function ConfigurationListPage({ client, kind }: { client: ApiClient; kind: Kind }) {
  const auth = useAuth(); const cache = useQueryClient(); const navigate = useNavigate()
  const { t } = useTranslation()
  const label = kind === 'validator' ? t('nav.validators') : t('nav.transformers')
  const singular = t(`configuration.${kind}`)
  const canManage = auth.user?.roles.includes('ADMIN') ?? false
  const [candidate, setCandidate] = useState<NamedConfiguration | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const list = useQuery({ queryKey: kind === 'validator' ? queryKeys.validators : queryKeys.transformers, queryFn: () => kind === 'validator' ? client.validators() : client.transformers() })
  const usage = useQuery({ queryKey: ['usage', kind, candidate?.id], queryFn: () => kind === 'validator' ? client.validatorUsage(candidate!.id) : client.transformerUsage(candidate!.id), enabled: Boolean(candidate) })
  const invalidate = () => cache.invalidateQueries({ queryKey: kind === 'validator' ? queryKeys.validators : queryKeys.transformers })
  const clone = useMutation({ mutationFn: (id: number) => kind === 'validator' ? client.cloneValidator(id) : client.cloneTransformer(id), onSuccess: saved => { invalidate(); navigate(`/${kind}s/${saved.id}`) } })
  const remove = useMutation({ mutationFn: (id: number) => kind === 'validator' ? client.deleteValidator(id) : client.deleteTransformer(id), onSuccess: () => { invalidate(); setCandidate(null) } })
  const importConfiguration = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    try { const value = JSON.parse(await file.text()) as ConfigurationExport; if (value.format !== 'lareferencia-harvester-configuration') throw new Error('Formato de exportación no reconocido'); if (value.kind !== kind) throw new Error('El tipo de configuración no coincide')
      const saved = kind === 'validator' ? await client.importValidator(value) : await client.importTransformer(value); invalidate(); navigate(`/${kind}s/${saved.id}`)
    } catch (error) { setImportError(error instanceof Error ? error.message : 'No se pudo importar la configuración') }
  }
  const exportConfiguration = async (id: number) => { try { const value = kind === 'validator' ? await client.exportValidator(id) : await client.exportTransformer(id); const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${kind}-${id}.json`; link.click(); URL.revokeObjectURL(link.href) } catch (error) { setImportError(error instanceof Error ? error.message : 'No se pudo exportar la configuración') } }

  return <Stack spacing={3}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
      <div><Typography variant="h4">{label}</Typography><Typography color="text.secondary">{t('configuration.reusable')}</Typography></div>
      {canManage && <Stack direction="row" spacing={1}><Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>{t('configuration.import')}<input hidden type="file" accept="application/json,.json" onChange={importConfiguration} /></Button><Button component={Link} to={`/${kind}s/new`} variant="contained" startIcon={<AddIcon />}>{t('configuration.create', { kind: singular.toLowerCase() })}</Button></Stack>}
    </Stack>
    {importError && <Alert severity="error" onClose={() => setImportError(null)}>{importError}</Alert>}{list.isLoading ? <CircularProgress /> : list.isError ? <Alert severity="error">{t('configuration.loadError')}</Alert> : <Paper variant="outlined"><Table><TableHead><TableRow><TableCell>{t('configuration.name')}</TableCell><TableCell>{t('configuration.description')}</TableCell>{canManage && <TableCell align="right">{t('common.actions')}</TableCell>}</TableRow></TableHead><TableBody>
      {list.data?.items.map(item => <TableRow key={item.id} hover><TableCell>{canManage ? <Link to={`/${kind}s/${item.id}`}>{item.name}</Link> : item.name}</TableCell><TableCell>{item.description || '—'}</TableCell>{canManage && <TableCell align="right"><Button size="small" onClick={() => void exportConfiguration(item.id)} startIcon={<DownloadIcon />}>{t('configuration.export')}</Button><Button size="small" onClick={() => clone.mutate(item.id)} startIcon={<ContentCopyIcon />}>{t('configuration.clone')}</Button><Button size="small" color="error" onClick={() => setCandidate(item)} startIcon={<DeleteIcon />}>{t('common.delete')}</Button></TableCell>}</TableRow>)}
      {!list.data?.items.length && <TableRow><TableCell colSpan={4}>{t('configuration.noItems')}</TableCell></TableRow>}
    </TableBody></Table></Paper>}
    <DeleteDialog candidate={candidate} usage={usage.data} loading={usage.isLoading} error={usage.error as ApiError | null} pending={remove.isPending} onCancel={() => setCandidate(null)} onDelete={() => candidate && remove.mutate(candidate.id)} />
  </Stack>
}

function DeleteDialog({ candidate, usage, loading, error, pending, onCancel, onDelete }: { candidate: NamedConfiguration | null; usage?: Usage; loading: boolean; error: ApiError | null; pending: boolean; onCancel: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  return <Dialog open={Boolean(candidate)} onClose={onCancel} fullWidth maxWidth="sm"><DialogTitle>{t('configuration.deleteTitle', { name: candidate?.name })}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{loading && <CircularProgress size={24} />}{error && <Alert severity="error">{error.message}</Alert>}{usage?.used ? <Alert severity="warning">{usage.networks.length} {t('common.source')}</Alert> : <Typography>{t('configuration.deleteWarning')}</Typography>}</Stack></DialogContent><DialogActions><Button onClick={onCancel}>{t('common.cancel')}</Button><Button color="error" variant="contained" disabled={loading || Boolean(usage?.used) || Boolean(error) || pending} onClick={onDelete}>{t('common.delete')}</Button></DialogActions></Dialog>
}
