import { Alert, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '../../api/client'
import { queryKeys } from '../../api/query-keys'
import { useTranslation } from 'react-i18next'
import { RuntimeQueuePanel } from './RuntimeQueuePanel'
import { TaskManagerConfigurationPanel } from './TaskManagerConfigurationPanel'

export function RuntimePage({ client }: { client: ApiClient }) {
  const { t } = useTranslation()
  const query = useQuery({ queryKey: queryKeys.runtime, queryFn: () => client.runtime(), refetchInterval: 10_000 })
  if (query.isLoading) return <CircularProgress />
  if (!query.data) return <Alert severity="error">{t('runtime.loadError')}</Alert>
  return <Stack spacing={3}><Typography variant="h4">{t('runtime.title')}</Typography>
    {query.isError && <Alert severity="warning">{t('runtime.queues.stale')}</Alert>}
    {query.data.engineType === 'legacy'
      ? <Typography variant="body2" color="text.secondary">{t('common.engine')}: Legacy · TaskManager</Typography>
      : <Paper variant="outlined" sx={{ p: 2 }}><Typography>{t('runtime.summary', { engine: query.data.engineType, running: query.data.runningCount, queued: query.data.queuedCount })}</Typography></Paper>}
    {query.data.engineType === 'legacy' && <RuntimeQueuePanel client={client} />}
    {query.data.engineType === 'legacy' && <TaskManagerConfigurationPanel client={client} />}
    {query.data.engineType !== 'legacy' && <Paper variant="outlined"><TableContainer><Table><TableHead><TableRow><TableCell>{t('common.source')}</TableCell><TableCell>{t('common.action')}</TableCell><TableCell>{t('runtime.status')}</TableCell><TableCell>{t('common.engine')}</TableCell><TableCell>{t('runtime.cancellation')}</TableCell></TableRow></TableHead>
      <TableBody>{query.data.processes.map(process => <TableRow key={process.processId}><TableCell>{process.networkAcronym}</TableCell><TableCell>{t(`networks.actionNames.${process.actionType}`, { defaultValue: process.actionType })}</TableCell><TableCell><Chip size="small" label={t(`ui.${process.status}`, { defaultValue: process.status })} /></TableCell><TableCell>{process.engineType}</TableCell><TableCell>{t(`ui.${process.cancellationScope}`, { defaultValue: process.cancellationScope })}</TableCell></TableRow>)}</TableBody>
    </Table></TableContainer></Paper>}</Stack>
}
