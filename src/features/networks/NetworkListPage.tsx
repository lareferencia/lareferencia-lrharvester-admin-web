import { useMemo, useState } from 'react'
import { Alert, Box, Chip, CircularProgress, Pagination, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '../../api/client'
import { queryKeys } from '../../api/query-keys'

export function NetworkListPage({ client }: { client: ApiClient }) {
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const params = useMemo(() => new URLSearchParams({ page: String(page), size: '25', sort: 'acronym,asc', ...(q ? { q } : {}) }), [page, q])
  const query = useQuery({ queryKey: queryKeys.networkSummaries(params.toString()), queryFn: () => client.networkSummaries(params), placeholderData: previous => previous })
  return <Stack spacing={3}>
    <Box><Typography variant="h4">Redes</Typography><Typography color="text.secondary">Estado operativo y último resultado de cosecha.</Typography></Box>
    <TextField label="Buscar por acrónimo, red o institución" value={q} onChange={event => { setPage(0); setQ(event.target.value) }} fullWidth />
    {query.isError && <Alert severity="error">No se pudieron cargar las redes.</Alert>}
    {query.isLoading ? <CircularProgress /> : <Paper variant="outlined"><Table><TableHead><TableRow>
      <TableCell>Acrónimo</TableCell><TableCell>Red / Institución</TableCell><TableCell>Publicada</TableCell><TableCell>Último snapshot</TableCell><TableCell>Runtime</TableCell>
    </TableRow></TableHead><TableBody>{query.data?.items.map(network => <TableRow key={network.id} hover>
      <TableCell><Link to={`/networks/${network.id}`}>{network.acronym}</Link></TableCell>
      <TableCell><Typography>{network.name}</Typography><Typography variant="body2" color="text.secondary">{network.institutionName}</Typography></TableCell>
      <TableCell><Chip size="small" color={network.published ? 'success' : 'default'} label={network.published ? 'Sí' : 'No'} /></TableCell>
      <TableCell>{network.latestSnapshot ? <><Chip size="small" label={network.latestSnapshot.status} /> <Typography variant="body2">{formatDate(network.latestSnapshot.endTime || network.latestSnapshot.startTime)}</Typography></> : 'Sin snapshots'}</TableCell>
      <TableCell>{network.runtime.runningCount > 0 ? `${network.runtime.runningCount} en ejecución` : 'Sin actividad'}</TableCell>
    </TableRow>)}</TableBody></Table></Paper>}
    {query.data && <Pagination page={page + 1} count={Math.max(1, query.data.totalPages)} onChange={(_, value) => setPage(value - 1)} />}
  </Stack>
}

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—' }
