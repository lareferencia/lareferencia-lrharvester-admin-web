import { useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import { queryKeys } from '../../api/query-keys'
import { useAuth } from '../../auth/AuthProvider'

export function NetworkDetailPage({ client }: { client: ApiClient }) {
  const id = Number(useParams().id)
  const { user } = useAuth()
  const cache = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const network = useQuery({ queryKey: queryKeys.network(id), queryFn: () => client.network(id), enabled: Number.isSafeInteger(id) })
  const runtime = useQuery({ queryKey: queryKeys.networkRuntime(id), queryFn: () => client.networkRuntime(id), enabled: Number.isSafeInteger(id), refetchInterval: 10_000 })
  const reschedule = useMutation({ mutationFn: () => client.command(id, 'RESCHEDULE'), onSuccess: receipt => { setNotice(`Solicitud aceptada: ${receipt.requestId}`); cache.invalidateQueries({ queryKey: queryKeys.networkRuntime(id) }) } })
  if (network.isLoading) return <CircularProgress />
  if (network.isError || !network.data) return <Alert severity="error">La red solicitada no existe o no está disponible.</Alert>
  const canOperate = user?.roles.includes('ADMIN')
  return <Stack spacing={3}>
    <Box><Typography component={Link} to="/networks" color="primary">← Redes</Typography><Typography variant="h4">{network.data.acronym}</Typography><Typography color="text.secondary">{network.data.name} · {network.data.institutionName}</Typography></Box>
    {notice && <Alert severity="success">{notice}</Alert>}
    {reschedule.isError && <Alert severity="error">{(reschedule.error as ApiError).message}</Alert>}
    <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}>
      <Typography variant="h6">Operación</Typography>
      <Typography>URL OAI-PMH: {network.data.originUrl}</Typography>
      <Typography>Cron: {network.data.scheduleCronExpression || 'Sin programación'}</Typography>
      <Divider />
      <Typography variant="subtitle1">Procesos activos</Typography>
      {runtime.isLoading ? <CircularProgress size={20} /> : runtime.data?.length ? runtime.data.map(process => <Chip key={process.processId} label={`${process.actionType}: ${process.status} (${process.engineType})`} />) : <Typography color="text.secondary">No hay procesos activos.</Typography>}
      {canOperate && <Button variant="contained" sx={{ alignSelf: 'start' }} disabled={reschedule.isPending} onClick={() => reschedule.mutate()}>Reprogramar red</Button>}
    </Stack></Paper>
  </Stack>
}
