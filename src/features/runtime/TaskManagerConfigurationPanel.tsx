import { useEffect, useState } from 'react'
import { Alert, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ApiClient } from '../../api/client'
import type { TaskManagerConfiguration, TaskManagerSettings } from '../../api/types'
import { queryKeys } from '../../api/query-keys'

const fields = [
  { key: 'concurrentTasks', min: 1, max: 2147483647 },
  { key: 'maxQueuedTasks', min: 0, max: 2147483647 },
  { key: 'resultRetentionSeconds', min: 1, max: Number.MAX_SAFE_INTEGER },
  { key: 'maxRetainedResults', min: 1, max: 2147483647 },
  { key: 'shutdownTimeoutSeconds', min: 0, max: Number.MAX_SAFE_INTEGER },
] as const

export function TaskManagerConfigurationPanel({ client }: { client: ApiClient }) {
  const { t } = useTranslation()
  const query = useQuery({ queryKey: queryKeys.runtimeConfiguration, queryFn: () => client.runtimeConfiguration(), refetchOnWindowFocus: false })
  return <Paper variant="outlined" sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>{t('runtime.configuration.title')}</Typography>
    {query.isLoading && <CircularProgress size={24} />}
    {query.isError && <Alert severity="error">{t('runtime.configuration.loadError')} <Button onClick={() => void query.refetch()}>{t('runtime.configuration.retry')}</Button></Alert>}
    {query.data && <ConfigurationForm client={client} response={query.data} />}
  </Paper>
}

function ConfigurationForm({ client, response }: { client: ApiClient; response: TaskManagerConfiguration }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(field => [field.key, String(response.configuration[field.key])])) as Record<keyof TaskManagerSettings, string>)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setValues(Object.fromEntries(fields.map(field => [field.key, String(response.configuration[field.key])])) as Record<keyof TaskManagerSettings, string>)
  }, [response.configuration, editing])
  const valid = fields.every(field => /^\d+$/.test(values[field.key]) && Number.isSafeInteger(Number(values[field.key])) && Number(values[field.key]) >= field.min && Number(values[field.key]) <= field.max)
  const dirty = fields.some(field => values[field.key] !== String(response.configuration[field.key]))
  const save = useMutation({
    mutationFn: (value: TaskManagerSettings) => client.updateRuntimeConfiguration(value),
    onSuccess: result => {
      // Update in place; retain the save message until the next edit.
      setSaved(true)
      setEditing(false)
      queryClient.setQueryData(queryKeys.runtimeConfiguration, result)
      void queryClient.invalidateQueries({ queryKey: queryKeys.runtime })
    },
  })
  return <Stack component="form" spacing={2} onSubmit={event => {
    event.preventDefault()
    if (valid && dirty && !save.isPending) save.mutate(Object.fromEntries(fields.map(field => [field.key, Number(values[field.key])])) as TaskManagerSettings)
  }}>
    <Typography variant="body2" color="text.secondary">{t('runtime.configuration.help')}</Typography>
    <Typography variant="body2" color="text.secondary">{t(response.persisted ? 'runtime.configuration.persisted' : 'runtime.configuration.properties')}</Typography>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {fields.map(field => <TextField key={field.key} type="number" size="small" sx={{ minWidth: 210, flex: '1 1 210px' }}
        label={t(`runtime.configuration.fields.${field.key}`)} value={values[field.key]} disabled={save.isPending}
        slotProps={{ htmlInput: { min: field.min, max: field.max, step: 1 } }}
        onChange={event => { setEditing(true); setSaved(false); save.reset(); setValues(previous => ({ ...previous, [field.key]: event.target.value })) }} />)}
    </Stack>
    {!valid && <Alert severity="warning">{t('runtime.configuration.invalid')}</Alert>}
    {save.isError && <Alert severity="error">{t('runtime.configuration.saveError')} {save.error.message}</Alert>}
    {saved && <Alert severity="success">{t('runtime.configuration.saved')}</Alert>}
    {response.updatedAt && <Typography variant="caption" color="text.secondary">{t('runtime.configuration.updated', {
      user: response.updatedBy || '—', date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(response.updatedAt)),
    })}</Typography>}
    <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={!valid || !dirty || save.isPending}>{t('runtime.configuration.apply')}</Button>
  </Stack>
}
