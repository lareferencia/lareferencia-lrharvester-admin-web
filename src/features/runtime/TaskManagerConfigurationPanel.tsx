import { useEffect, useState } from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material'
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
  const fieldValid = (field: typeof fields[number]) => /^\d+$/.test(values[field.key]) && Number.isSafeInteger(Number(values[field.key])) && Number(values[field.key]) >= field.min && Number(values[field.key]) <= field.max
  const valid = fields.every(fieldValid)
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
  const renderField = (field: typeof fields[number]) => <Stack key={field.key} spacing={1} sx={{ flex: '1 1 0', minWidth: 0 }}>
    <TextField type="number" size="small" fullWidth
      label={t(`runtime.configuration.fields.${field.key}`)} value={values[field.key]} disabled={save.isPending}
      error={!fieldValid(field)}
      helperText={!fieldValid(field) ? t('runtime.configuration.integerRange', { min: field.min, max: field.max }) : values[field.key] !== String(response.configuration[field.key]) ? t('runtime.configuration.current', { value: response.configuration[field.key] }) : undefined}
      slotProps={{ htmlInput: { min: field.min, max: field.max, step: 1 } }}
      onChange={event => { setEditing(true); setSaved(false); save.reset(); setValues(previous => ({ ...previous, [field.key]: event.target.value })) }} />
    <Typography variant="body2" color="text.secondary">{t(`runtime.configuration.fieldHelp.${field.key}`)}</Typography>
  </Stack>
  return <Stack component="form" spacing={2} onSubmit={event => {
    event.preventDefault()
    if (valid && dirty && !save.isPending) save.mutate(Object.fromEntries(fields.map(field => [field.key, Number(values[field.key])])) as TaskManagerSettings)
  }}>
    <Typography variant="body2" color="text.secondary">{t('runtime.configuration.help')}</Typography>
    <Typography variant="body2" color="text.secondary">{t(response.persisted ? 'runtime.configuration.persisted' : 'runtime.configuration.properties')}</Typography>
    <Box><Typography variant="subtitle1" fontWeight={600}>{t('runtime.configuration.executionTitle')}</Typography><Typography variant="body2" color="text.secondary">{t('runtime.configuration.executionHelp')}</Typography></Box>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>{fields.slice(0, 2).map(renderField)}</Stack>
    {valid && <Alert severity="info">{t('runtime.configuration.preview', { active: Number(values.concurrentTasks), queued: Number(values.maxQueuedTasks) })}</Alert>}
    {valid && dirty && (Number(values.concurrentTasks) < response.configuration.concurrentTasks || Number(values.maxQueuedTasks) < response.configuration.maxQueuedTasks) && <Alert severity="warning">{t('runtime.configuration.reduced')}</Alert>}
    <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }} slotProps={{ transition: { unmountOnExit: true } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography fontWeight={600}>{t('runtime.configuration.advancedTitle')}</Typography></AccordionSummary>
      <AccordionDetails><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('runtime.configuration.advancedHelp')}</Typography><Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>{fields.slice(2).map(renderField)}</Stack></AccordionDetails>
    </Accordion>
    {!valid && <Alert severity="warning">{t('runtime.configuration.invalid')}</Alert>}
    {save.isError && <Alert severity="error">{t('runtime.configuration.saveError')} {save.error.message}</Alert>}
    {saved && <Alert severity="success">{t('runtime.configuration.saved')}</Alert>}
    {response.updatedAt && <Typography variant="caption" color="text.secondary">{t('runtime.configuration.updated', {
      user: response.updatedBy || '—', date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(response.updatedAt)),
    })}</Typography>}
    <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={!valid || !dirty || save.isPending}>{t('runtime.configuration.apply')}</Button>
  </Stack>
}
