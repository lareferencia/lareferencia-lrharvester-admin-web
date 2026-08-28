import { Alert, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '../../api/client'
import { queryKeys } from '../../api/query-keys'

export function RuntimePage({ client }: { client: ApiClient }) {
  const query = useQuery({ queryKey: queryKeys.runtime, queryFn: () => client.runtime(), refetchInterval: 10_000 })
  if (query.isLoading) return <CircularProgress />
  if (query.isError || !query.data) return <Alert severity="error">No se pudo obtener el estado del motor.</Alert>
  return <Stack spacing={3}><Typography variant="h4">Runtime</Typography>
    <Paper variant="outlined" sx={{ p: 2 }}><Typography>Motor: <strong>{query.data.engineType}</strong> · {query.data.runningCount} procesos en ejecución · {query.data.queuedCount} en cola</Typography></Paper>
    <Paper variant="outlined"><Table><TableHead><TableRow><TableCell>Fuente</TableCell><TableCell>Acción</TableCell><TableCell>Estado</TableCell><TableCell>Motor</TableCell><TableCell>Cancelación</TableCell></TableRow></TableHead>
      <TableBody>{query.data.processes.map(process => <TableRow key={process.processId}><TableCell>{process.networkAcronym}</TableCell><TableCell>{process.actionType}</TableCell><TableCell><Chip size="small" label={process.status} /></TableCell><TableCell>{process.engineType}</TableCell><TableCell>{process.cancellationScope}</TableCell></TableRow>)}</TableBody>
    </Table></Paper></Stack>
}
