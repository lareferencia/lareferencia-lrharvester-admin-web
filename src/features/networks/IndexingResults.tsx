import { Fragment, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Alert, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material'
import type { ApiClient } from '../../api/client'
import type { IndexingResult, Snapshot } from '../../api/types'
import { queryKeys } from '../../api/query-keys'

function IndexingResultRow({ worker, result }: { worker: string; result: IndexingResult }) {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const name = t(`actions.workerNames.${worker}`, { defaultValue: worker })
  const finishedAt = new Intl.DateTimeFormat(i18n.resolvedLanguage || 'es', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(result.finishedAt))
  return <Fragment>
    <TableRow sx={{ '& > td': { borderBottom: result.error || expanded ? 0 : undefined } }}>
      <TableCell sx={{ overflowWrap: 'anywhere' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.5}>
          <Stack sx={{ minWidth: 0 }}><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{name}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>{finishedAt}</Typography></Stack>
          <IconButton size="small" aria-label={t('indexing.showDetails', { worker: name })} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}>
            <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
          </IconButton>
        </Stack>
      </TableCell>
      <TableCell sx={{ px: 1 }}><Chip size="small" color={result.status === 'INDEXED' ? 'success' : 'error'} icon={result.status === 'INDEXED' ? <CheckCircleOutlineIcon /> : <HighlightOffIcon />} label={t(result.status === 'INDEXED' ? 'indexing.ok' : 'indexing.failure')} /></TableCell>
      <TableCell sx={{ overflowWrap: 'anywhere', display: { xs: 'none', sm: 'table-cell' } }}>{finishedAt}</TableCell>
    </TableRow>
    {result.error && <TableRow><TableCell colSpan={3} sx={{ pt: 0 }}>
      <Typography variant="body2" color="error.main" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', borderLeft: '2px solid', borderColor: 'error.main', pl: 1 }}>{result.error}</Typography>
    </TableCell></TableRow>}
    <TableRow><TableCell colSpan={3} sx={{ py: 0, borderBottom: expanded ? undefined : 0 }}>
      <Collapse in={expanded} timeout="auto" unmountOnExit id={detailsId}>
        <Stack spacing={0.5} sx={{ pb: 1.5, overflowWrap: 'anywhere' }}>
          <Typography variant="body2"><strong>{t('indexing.bean')}:</strong> {worker}</Typography>
          <Typography variant="body2"><strong>{t('indexing.action')}:</strong> {result.actionName ? t(`networks.actionNames.${result.actionName}`, { defaultValue: result.actionName }) : '—'}</Typography>
          {result.actionName && <Typography variant="caption" color="text.secondary">{result.actionName}</Typography>}
        </Stack>
      </Collapse>
    </TableCell></TableRow>
  </Fragment>
}

export function IndexingResults({ results }: { results?: Record<string, IndexingResult> }) {
  const { t } = useTranslation()
  const entries = Object.entries(results ?? {}).sort(([left], [right]) => left.localeCompare(right))
  if (!entries.length) return <Typography color="text.secondary">{t('indexing.empty')}</Typography>
  return <TableContainer><Table size="small" aria-label={t('indexing.title')} sx={{ tableLayout: 'fixed' }}>
    <TableHead><TableRow>
      <TableCell sx={{ width: { xs: '65%', sm: '40%' } }}>{t('indexing.worker')}</TableCell>
      <TableCell sx={{ width: { xs: '35%', sm: '25%' }, px: 1 }}>{t('indexing.state')}</TableCell>
      <TableCell sx={{ width: '35%', display: { xs: 'none', sm: 'table-cell' } }}>{t('indexing.finished')}</TableCell>
    </TableRow></TableHead>
    <TableBody>{entries.map(([worker, result]) => <IndexingResultRow key={worker} worker={worker} result={result} />)}</TableBody>
  </Table></TableContainer>
}

export function SnapshotIndexingIndicator({ snapshot }: { snapshot: Snapshot | null }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const titleId = useId()
  if (!snapshot) return <Typography variant="body2" color="text.secondary">—</Typography>
  const successful = snapshot.indexStatus === 'INDEXED'
  const failed = snapshot.indexStatus === 'FAILED'
  const label = t(successful ? 'indexing.ok' : failed ? 'indexing.failure' : 'indexing.unknown')
  const hasResults = Object.keys(snapshot.indexingResults ?? {}).length > 0
  return <>
    <Tooltip title={t('indexing.openResults', { id: snapshot.id })}>
      <Chip component="button" type="button" size="small" clickable label={label}
        color={successful ? 'success' : failed ? 'error' : 'default'}
        icon={successful ? <CheckCircleOutlineIcon /> : failed ? <HighlightOffIcon /> : undefined}
        aria-label={t('indexing.indicatorLabel', { id: snapshot.id, state: label })}
        aria-haspopup="dialog" onClick={() => setOpen(true)} sx={{ minWidth: 54 }} />
    </Tooltip>
    {open && <Dialog open onClose={() => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby={titleId}>
      <DialogTitle id={titleId}>{t('indexing.title')} · {t('indexing.snapshot')} #{snapshot.id}</DialogTitle>
      <DialogContent dividers>
        {!hasResults && (successful || failed) && <Alert severity="info" sx={{ mb: 2 }}>{t('indexing.legacyOnly')}</Alert>}
        <IndexingResults results={snapshot.indexingResults} />
      </DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>{t('common.close')}</Button></DialogActions>
    </Dialog>}
  </>
}

export function NetworkIndexingResults({ client, networkId }: { client: ApiClient; networkId: number }) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const snapshots = useQuery({ queryKey: queryKeys.networkSnapshots(networkId), queryFn: () => client.networkSnapshots(networkId), refetchInterval: 10_000 })
  const selected = snapshots.data?.items.find(snapshot => snapshot.id === selectedId) ?? snapshots.data?.items[0]
  return <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}>
    <Typography variant="h6">{t('indexing.title')}</Typography>
    {snapshots.isLoading ? <CircularProgress size={22} /> : snapshots.isError ? <Alert severity="error">{t('indexing.unavailable')}</Alert> : selected ? <Stack direction="row" spacing={2} alignItems="center">
      <TextField select size="small" label={t('indexing.snapshot')} value={selected.id} onChange={event => setSelectedId(Number(event.target.value))} sx={{ minWidth: 140, maxWidth: 280 }}>
        {snapshots.data?.items.map(snapshot => <MenuItem key={snapshot.id} value={snapshot.id}>#{snapshot.id}</MenuItem>)}
      </TextField>
      <SnapshotIndexingIndicator key={selected.id} snapshot={selected} />
    </Stack> : <Typography color="text.secondary">{t('indexing.noSnapshots')}</Typography>}
  </Stack></Paper>
}
