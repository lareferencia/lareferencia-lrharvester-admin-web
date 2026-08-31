import { Alert, Box, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ApiClient } from '../../api/client'
import { queryKeys } from '../../api/query-keys'

const stateColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = { PUBLISHED: 'success', ERROR: 'error', RESERVED: 'warning', UPDATE: 'warning', DRAFT: 'info', TOMBSTONE: 'default' }

export function DarkPage({ client }: { client: ApiClient }) {
  const { t } = useTranslation()
  const [state, setState] = useState('')
  const [q, setQ] = useState('')
  const [naan, setNaan] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(50)
  const params = useMemo(() => { const value = new URLSearchParams({ page: String(page), size: String(size) }); if (state) value.set('state', state); if (naan) value.set('arkNaan', naan); if (q.trim()) value.set('q', q.trim()); return value }, [state, naan, q, page, size])
  const summary = useQuery({ queryKey: queryKeys.darkSummary(naan || undefined), queryFn: () => client.darkSummary(naan || undefined), refetchInterval: 10_000 })
  const records = useQuery({ queryKey: queryKeys.darkRecords(params.toString()), queryFn: () => client.darkRecords(params), refetchInterval: 10_000 })
  if (summary.isLoading || records.isLoading) return <CircularProgress />
  if (summary.isError || records.isError || !summary.data || !records.data) return <Alert severity="error">{t('dark.loadError')}</Alert>
  const stateCount = (key: string) => summary.data.states.find(item => item.state === key)?.count ?? 0
  const naanStates = ['RESERVED', 'DRAFT', 'UPDATE', 'PUBLISHED', 'TOMBSTONE', 'ERROR']
  const naanStateCount = (naan: string, stateName: string) => (summary.data.naanStates ?? []).find(item => item.arkNaan === naan && item.state === stateName)?.count ?? 0
  return <Stack spacing={3}>
    <Box><Typography variant="h4" fontWeight={800}>{t('dark.title')}</Typography><Typography color="text.secondary">{t('dark.subtitle')}</Typography></Box>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
      <Paper variant="outlined" sx={{ p: 2, minWidth: 145 }}><Typography variant="caption">{t('dark.total')}</Typography><Typography variant="h5" fontWeight={800}>{summary.data.total}</Typography></Paper>
      <Paper variant="outlined" sx={{ p: 2, minWidth: 145 }}><Typography variant="caption">{t('dark.published')}</Typography><Typography variant="h5" color="success.main" fontWeight={800}>{stateCount('PUBLISHED')}</Typography></Paper>
      <Paper variant="outlined" sx={{ p: 2, minWidth: 145 }}><Typography variant="caption">{t('dark.pending')}</Typography><Typography variant="h5" color="warning.main" fontWeight={800}>{stateCount('RESERVED') + stateCount('DRAFT') + stateCount('UPDATE')}</Typography></Paper>
      <Paper variant="outlined" sx={{ p: 2, minWidth: 145 }}><Typography variant="caption">{t('dark.errors')}</Typography><Typography variant="h5" color="error.main" fontWeight={800}>{stateCount('ERROR')}</Typography></Paper>
    </Stack>
    <Paper variant="outlined" sx={{ overflow: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>{t('dark.naan')}</TableCell>{naanStates.map(item => <TableCell key={item} align="right">{t(`dark.states.${item}`)}</TableCell>)}<TableCell align="right">{t('dark.total')}</TableCell></TableRow></TableHead><TableBody>{summary.data.naans.map(item => <TableRow key={item.arkNaan} hover><TableCell sx={{ fontWeight: 700 }}>{item.arkNaan}</TableCell>{naanStates.map(stateName => <TableCell key={stateName} align="right">{naanStateCount(item.arkNaan, stateName)}</TableCell>)}<TableCell align="right" sx={{ fontWeight: 700 }}>{item.total}</TableCell></TableRow>)}</TableBody></Table></Paper>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField size="small" fullWidth label={t('dark.search')} value={q} onChange={event => { setQ(event.target.value); setPage(0) }} /><FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>{t('dark.naan')}</InputLabel><Select label={t('dark.naan')} value={naan} onChange={event => { setNaan(event.target.value); setPage(0) }}><MenuItem value="">{t('common.all')}</MenuItem>{summary.data.naans.map(item => <MenuItem key={item.arkNaan} value={item.arkNaan}>{item.arkNaan} ({item.total})</MenuItem>)}</Select></FormControl><FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>{t('common.state')}</InputLabel><Select label={t('common.state')} value={state} onChange={event => { setState(event.target.value); setPage(0) }}><MenuItem value="">{t('common.all')}</MenuItem>{['RESERVED', 'DRAFT', 'UPDATE', 'PUBLISHED', 'TOMBSTONE', 'ERROR'].map(item => <MenuItem key={item} value={item}>{t(`dark.states.${item}`)}</MenuItem>)}</Select></FormControl></Stack>
    <Paper variant="outlined" sx={{ overflow: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>{t('dark.naan')}</TableCell><TableCell>{t('dark.oaiId')}</TableCell><TableCell>{t('dark.ark')}</TableCell><TableCell>{t('common.state')}</TableCell><TableCell>{t('dark.updated')}</TableCell><TableCell>{t('dark.error')}</TableCell></TableRow></TableHead><TableBody>{records.data.items.map(record => <TableRow key={`${record.arkNaan}:${record.oaiId}`} hover><TableCell>{record.arkNaan}</TableCell><TableCell sx={{ minWidth: 260 }}>{record.oaiId}</TableCell><TableCell>{record.ark ?? '—'}</TableCell><TableCell><Chip size="small" color={stateColors[record.state] ?? 'default'} label={t(`dark.states.${record.state}`)} /></TableCell><TableCell>{new Date(record.updatedAt).toLocaleString()}</TableCell><TableCell sx={{ maxWidth: 360, color: record.lastError ? 'error.main' : 'text.secondary' }}>{record.lastError ?? '—'}</TableCell></TableRow>)}</TableBody></Table>{records.data.items.length === 0 && <Typography sx={{ p: 3 }} color="text.secondary">{t('dark.empty')}</Typography>}<TablePagination component="div" count={records.data.totalElements} page={page} rowsPerPage={size} onPageChange={(_, nextPage) => setPage(nextPage)} onRowsPerPageChange={event => { setSize(Number(event.target.value)); setPage(0) }} rowsPerPageOptions={[25, 50, 100]} /></Paper>
  </Stack>
}
