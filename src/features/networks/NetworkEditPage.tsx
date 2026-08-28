import SaveIcon from '@mui/icons-material/Save'
import { Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, Divider, FormControlLabel, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import type { AttributeProfile, Capabilities, NetworkActionConfiguration, NetworkRequest } from '../../api/types'
import { queryKeys } from '../../api/query-keys'

const networkFormSchema = z.object({
  acronym: z.string().min(2, 'Debe tener al menos 2 caracteres.').max(10, 'Máximo 10 caracteres.').regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Solo letras, números, punto, guion y guion bajo.'),
  name: z.string().min(2, 'Debe tener al menos 2 caracteres.'),
  institutionName: z.string().min(2, 'Debe tener al menos 2 caracteres.'),
  institutionAcronym: z.string(),
  originUrl: z.string().url('Debe ser una URL absoluta válida.'),
  metadataPrefix: z.string(),
  metadataStoreSchema: z.string(),
  scheduleCronExpression: z.string(),
  published: z.boolean(),
  sets: z.array(z.string()),
  prevalidatorId: z.string(),
  validatorId: z.string(),
  transformerId: z.string(),
  secondaryTransformerId: z.string(),
})

type NetworkForm = z.infer<typeof networkFormSchema>
const initialValues: NetworkForm = { acronym: '', name: '', institutionName: '', institutionAcronym: '', originUrl: '', metadataPrefix: 'oai_dc', metadataStoreSchema: 'xoai', scheduleCronExpression: '', published: false, sets: [], prevalidatorId: '', validatorId: '', transformerId: '', secondaryTransformerId: '' }

type TabName = 'general' | 'processing' | 'profile' | 'actions'

export function NetworkEditPage({ client }: { client: ApiClient }) {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const cache = useQueryClient()
  const [tab, setTab] = useState<TabName>('general')
  const [attributes, setAttributes] = useState<Record<string, unknown>>({})
  const [properties, setProperties] = useState<Record<string, boolean>>({})
  const network = useQuery({ queryKey: queryKeys.network(id), queryFn: () => client.network(id), enabled: Number.isSafeInteger(id) })
  const validators = useQuery({ queryKey: queryKeys.validators, queryFn: () => client.validators() })
  const transformers = useQuery({ queryKey: queryKeys.transformers, queryFn: () => client.transformers() })
  const profiles = useQuery({ queryKey: queryKeys.attributeProfiles, queryFn: () => client.attributeProfiles() })
  const capabilities = useQuery({ queryKey: queryKeys.capabilities, queryFn: () => client.capabilities() })
  const runtime = useQuery({ queryKey: queryKeys.networkRuntime(id), queryFn: () => client.networkRuntime(id), enabled: Number.isSafeInteger(id) })
  const networkActions = useQuery({ queryKey: queryKeys.networkActions(id), queryFn: () => client.networkActions(id), enabled: Number.isSafeInteger(id) })
  const form = useForm<NetworkForm>({ resolver: zodResolver(networkFormSchema), defaultValues: initialValues })

  useEffect(() => {
    if (!network.data) return
    form.reset({
      acronym: network.data.acronym, name: network.data.name, institutionName: network.data.institutionName,
      institutionAcronym: network.data.institutionAcronym || '', originUrl: network.data.originUrl,
      metadataPrefix: network.data.metadataPrefix || 'oai_dc', metadataStoreSchema: network.data.metadataStoreSchema || 'xoai',
      scheduleCronExpression: network.data.scheduleCronExpression || '', published: network.data.published,
      sets: network.data.sets || [], prevalidatorId: asSelectValue(network.data.prevalidatorId), validatorId: asSelectValue(network.data.validatorId),
      transformerId: asSelectValue(network.data.transformerId), secondaryTransformerId: asSelectValue(network.data.secondaryTransformerId),
    })
    setAttributes(network.data.attributes || {})
    setProperties(network.data.properties || {})
  }, [network.data, form])

  const profile = useMemo(() => profiles.data?.find(item => item.className === attributes['@class']), [profiles.data, attributes])
  const update = useMutation({
    mutationFn: (value: NetworkRequest) => client.updateNetwork(id, value),
    onSuccess: async (saved) => {
      await Promise.all([cache.invalidateQueries({ queryKey: queryKeys.network(id) }), cache.invalidateQueries({ queryKey: queryKeys.networkSummaries('') })])
      navigate(`/networks/${saved.id}`)
    },
  })

  if (network.isLoading || validators.isLoading || transformers.isLoading || profiles.isLoading || capabilities.isLoading) return <CircularProgress />
  if (network.isError || !network.data || validators.isError || transformers.isError || profiles.isError || capabilities.isError) return <Alert severity="error">No se pudo cargar la configuración necesaria para editar esta fuente.</Alert>
  const active = Boolean(runtime.data?.length)
  const onSubmit = (value: NetworkForm) => update.mutate({
    acronym: value.acronym, name: value.name.trim(), institutionName: value.institutionName.trim(), institutionAcronym: blankToNull(value.institutionAcronym),
    published: value.published, originUrl: value.originUrl.trim(), metadataPrefix: blankToNull(value.metadataPrefix), metadataStoreSchema: blankToNull(value.metadataStoreSchema),
    sets: value.sets.map(item => item.trim()).filter(Boolean), attributes, properties, scheduleCronExpression: blankToNull(value.scheduleCronExpression),
    prevalidatorId: asId(value.prevalidatorId), validatorId: asId(value.validatorId), transformerId: asId(value.transformerId), secondaryTransformerId: asId(value.secondaryTransformerId),
  })

  return <Stack spacing={3} component="form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
    <Box><Typography component={Link} to={`/networks/${id}`} color="primary">← {network.data.acronym}</Typography><Typography variant="h4">Editar fuente</Typography><Typography color="text.secondary">Los cambios se guardan de forma atómica, incluidas las asociaciones de procesamiento.</Typography></Box>
    {active && <Alert severity="warning">Hay procesos activos para esta fuente. La configuración no puede modificarse hasta que finalicen o se cancelen.</Alert>}
    {update.isError && <ApiProblemAlert error={update.error as ApiError} />}
    <Paper variant="outlined"><Tabs value={tab} onChange={(_, next: TabName) => setTab(next)} variant="scrollable" scrollButtons="auto"><Tab value="general" label="Principal" /><Tab value="processing" label="Procesamiento" /><Tab value="profile" label="Datos específicos" /><Tab value="actions" label="Acciones y programación" /></Tabs>
      <Box sx={{ p: 3 }}>
        {tab === 'general' && <GeneralFields form={form} capabilities={capabilities.data!} />}
        {tab === 'processing' && <ProcessingFields form={form} validators={validators.data!.items} transformers={transformers.data!.items} />}
        {tab === 'profile' && <ProfileFields profile={profile} attributes={attributes} setAttributes={setAttributes} />}
        {tab === 'actions' && <NetworkActionsEditor client={client} networkId={id} actions={networkActions.data || []} loading={networkActions.isLoading} disabled={active} />}
      </Box>
    </Paper>
    <Stack direction="row" spacing={2}><Button component={Link} to={`/networks/${id}`} disabled={update.isPending}>Cancelar</Button><Button type="submit" variant="contained" startIcon={<SaveIcon />} disabled={update.isPending || active || !profile}>Guardar cambios</Button></Stack>
  </Stack>
}

function NetworkActionsEditor({ client, networkId, actions, loading, disabled }: { client: ApiClient; networkId: number; actions: NetworkActionConfiguration[]; loading: boolean; disabled: boolean }) {
  const cache = useQueryClient()
  const updateAction = useMutation({ mutationFn: (action: NetworkActionConfiguration) => client.updateNetworkAction(networkId, action.actionKey, { enabled: action.enabled, scheduleEnabled: action.scheduleEnabled, configuration: action.configuration }), onSuccess: () => cache.invalidateQueries({ queryKey: queryKeys.networkActions(networkId) }) })
  if (loading) return <CircularProgress />
  return <Stack spacing={2}><Typography variant="h6">Acciones de esta fuente</Typography><Typography color="text.secondary">Aquí se decide qué puede ejecutarse manualmente, qué participa de la programación y los modificadores propios de cada acción. Las propiedades antiguas permanecen sin cambios como respaldo de migración.</Typography>
    {updateAction.isError && <ApiProblemAlert error={updateAction.error as ApiError} />}
    {actions.map(action => <Paper key={action.actionKey} variant="outlined" sx={{ p: 2 }}><Stack spacing={1}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontWeight={600}>{action.actionKey}</Typography><Typography variant="body2" color="text.secondary">Global: {action.globalState}</Typography></Stack><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><FormControlLabel control={<Checkbox checked={action.enabled} disabled={disabled || action.globalState !== 'ENABLED'} onChange={event => updateAction.mutate({ ...action, enabled: event.target.checked })} />} label="Permitir ejecución manual" /><FormControlLabel control={<Checkbox checked={action.scheduleEnabled} disabled={disabled || !action.enabled || action.globalState !== 'ENABLED'} onChange={event => updateAction.mutate({ ...action, scheduleEnabled: event.target.checked })} />} label="Ejecutar al dispararse la programación de la fuente" /></Stack>{Object.keys(action.schema.properties || {}).length > 0 && <ActionConfigurationForm action={action} disabled={disabled} saving={updateAction.isPending} onSave={configuration => updateAction.mutate({ ...action, configuration })} />}</Stack></Paper>)}
  </Stack>
}

function ActionConfigurationForm({ action, disabled, saving, onSave }: { action: NetworkActionConfiguration; disabled: boolean; saving: boolean; onSave: (configuration: Record<string, unknown>) => void }) {
  const [configuration, setConfiguration] = useState(action.effectiveConfiguration)
  return <Stack spacing={1} sx={{ pt: 1 }}><Typography variant="subtitle2">Opciones de ejecución</Typography><Form schema={action.schema} uiSchema={action.uiSchema} validator={validator} formData={configuration} disabled={disabled} onChange={event => setConfiguration((event.formData || {}) as Record<string, unknown>)} showErrorList={false}><span /></Form><Box><Button size="small" variant="outlined" disabled={disabled || saving} onClick={() => onSave(configuration)}>Guardar opciones</Button></Box></Stack>
}

function GeneralFields({ form, capabilities }: { form: UseFormReturn<NetworkForm>; capabilities: Capabilities }) {
  const { register, control, formState: { errors } } = form
  return <Stack spacing={2}><Typography variant="h6">Datos principales y origen de cosecha</Typography>
    <TextField label="Acrónimo" helperText="No se modifica para preservar la identidad de la fuente." {...register('acronym')} error={Boolean(errors.acronym)} InputProps={{ readOnly: true }} />
    <TextField label="Repositorio" {...register('name')} error={Boolean(errors.name)} helperText={errors.name?.message} required />
    <TextField label="Institución" {...register('institutionName')} error={Boolean(errors.institutionName)} helperText={errors.institutionName?.message} required />
    <TextField label="Acrónimo de institución" {...register('institutionAcronym')} />
    <FormControlLabel control={<Checkbox {...register('published')} />} label="Fuente publicada" />
    <Divider />
    <TextField label="URL OAI-PMH" {...register('originUrl')} error={Boolean(errors.originUrl)} helperText={errors.originUrl?.message} required />
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TextField select fullWidth label="Metadata prefix" {...register('metadataPrefix')}>{capabilities.metadataFormats.map(format => <MenuItem key={format} value={format}>{format}</MenuItem>)}</TextField>
      <TextField select fullWidth label="Formato de almacenamiento" {...register('metadataStoreSchema')}>{capabilities.metadataStoreSchemas.map(format => <MenuItem key={format} value={format}>{format}</MenuItem>)}</TextField>
    </Stack>
    <Controller control={control} name="sets" render={({ field }) => <Autocomplete multiple freeSolo options={[]} value={field.value} onChange={(_, value) => field.onChange(value)} renderInput={params => <TextField {...params} label="Sets OAI-PMH" helperText="Añade uno o más setSpec; deja vacío para cosechar todos." />} />} />
    <TextField label="Cron de cosecha" {...register('scheduleCronExpression')} helperText="Expresión cron de seis campos; déjalo vacío para no programar la fuente." />
  </Stack>
}

function ProcessingFields({ form, validators, transformers }: { form: UseFormReturn<NetworkForm>; validators: Array<{ id: number; name: string }>; transformers: Array<{ id: number; name: string }> }) {
  return <Stack spacing={2}><Typography variant="h6">Validadores y transformadores</Typography><Typography color="text.secondary">Estas cuatro relaciones se actualizan junto al resto de la fuente.</Typography>
    <IdSelect label="Prevalidador" name="prevalidatorId" form={form} items={validators} emptyLabel="Sin prevalidador" />
    <IdSelect label="Validador" name="validatorId" form={form} items={validators} emptyLabel="Sin validador" />
    <IdSelect label="Transformador principal" name="transformerId" form={form} items={transformers} emptyLabel="Sin transformador" />
    <IdSelect label="Transformador secundario" name="secondaryTransformerId" form={form} items={transformers} emptyLabel="Sin transformador" />
  </Stack>
}

function IdSelect({ label, name, form, items, emptyLabel }: { label: string; name: 'prevalidatorId' | 'validatorId' | 'transformerId' | 'secondaryTransformerId'; form: UseFormReturn<NetworkForm>; items: Array<{ id: number; name: string }>; emptyLabel: string }) {
  return <Controller name={name} control={form.control} render={({ field }) => <TextField select label={label} value={field.value} onChange={field.onChange}><MenuItem value="">{emptyLabel}</MenuItem>{items.map(item => <MenuItem key={item.id} value={String(item.id)}>{item.name}</MenuItem>)}</TextField>} />
}

function ProfileFields({ profile, attributes, setAttributes }: { profile: AttributeProfile | undefined; attributes: Record<string, unknown>; setAttributes: (next: Record<string, unknown>) => void }) {
  if (!profile) return <Alert severity="error">La fuente usa un perfil de atributos que no está publicado por esta instalación v5. No se puede guardar sin seleccionar o publicar el perfil correspondiente.</Alert>
  return <Stack spacing={2}><Typography variant="h6">{profile.name}</Typography><Typography color="text.secondary">Perfil {profile.typeId} · versión {profile.version}</Typography>
    <Form schema={profile.schema} uiSchema={profile.uiSchema} validator={validator} formData={attributes} onChange={event => setAttributes((event.formData || {}) as Record<string, unknown>)} onSubmit={event => setAttributes((event.formData || {}) as Record<string, unknown>)} showErrorList={false}><span /></Form>
  </Stack>
}

function ApiProblemAlert({ error }: { error: ApiError }) { return <Alert severity="error">{error.message}{error.problem.code ? ` (${error.problem.code})` : ''}{error.problem.traceId ? ` · traceId: ${error.problem.traceId}` : ''}</Alert> }
function asSelectValue(value: number | null) { return value === null ? '' : String(value) }
function asId(value: string) { return value ? Number(value) : null }
function blankToNull(value: string) { const trimmed = value.trim(); return trimmed || null }
