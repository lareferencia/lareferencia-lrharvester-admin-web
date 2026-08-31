import SaveIcon from '@mui/icons-material/Save'
import { Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import type { ApplicationAction, AttributeProfile, Capabilities, MetadataCleanupPreview, NetworkActionConfiguration, NetworkRequest } from '../../api/types'
import { queryKeys } from '../../api/query-keys'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const cache = useQueryClient()
  const [tab, setTab] = useState<TabName>('general')
  const [attributes, setAttributes] = useState<Record<string, unknown>>({})
  const defaultProfileAppliedFor = useRef<number | null>(null)
  const [properties, setProperties] = useState<Record<string, boolean>>({})
  const [saveSuccess, setSaveSuccess] = useState(false)
  const network = useQuery({ queryKey: queryKeys.network(id), queryFn: () => client.network(id), enabled: Number.isSafeInteger(id) })
  const validators = useQuery({ queryKey: queryKeys.validators, queryFn: () => client.validators() })
  const transformers = useQuery({ queryKey: queryKeys.transformers, queryFn: () => client.transformers() })
  const profiles = useQuery({ queryKey: queryKeys.attributeProfiles, queryFn: () => client.attributeProfiles() })
  const capabilities = useQuery({ queryKey: queryKeys.capabilities, queryFn: () => client.capabilities() })
  const applicationActions = useQuery({ queryKey: queryKeys.applicationActions, queryFn: () => client.applicationActions() })
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

  useEffect(() => {
    if (!network.data || !profiles.data || defaultProfileAppliedFor.current === id) return
    defaultProfileAppliedFor.current = id
    if (network.data.attributes?.['@class']) return
    const defaultProfile = profiles.data.find(item => item.typeId === 'lareferencia-repository') || profiles.data[0]
    if (defaultProfile) setAttributes(previous => previous['@class'] ? previous : { ...previous, '@class': defaultProfile.className })
  }, [id, network.data, profiles.data])

  const profile = useMemo(() => profiles.data?.find(item => item.className === attributes['@class']), [profiles.data, attributes])
  const hasUnknownProfile = Boolean(attributes['@class']) && !profile
  const update = useMutation({
    mutationFn: (value: NetworkRequest) => client.updateNetwork(id, value),
    onSuccess: async (saved) => {
      setSaveSuccess(true)
      await Promise.all([cache.invalidateQueries({ queryKey: queryKeys.network(id) }), cache.invalidateQueries({ queryKey: queryKeys.networkSummaries('') })])
    },
  })

  if (network.isLoading || validators.isLoading || transformers.isLoading || profiles.isLoading || capabilities.isLoading) return <CircularProgress />
  if (network.isError || !network.data || validators.isError || transformers.isError || profiles.isError || capabilities.isError) return <Alert severity="error">{t('networks.loadError')}</Alert>
  const active = Boolean(runtime.data?.length)
  const onSubmit = (value: NetworkForm) => update.mutate({
    acronym: value.acronym, name: value.name.trim(), institutionName: value.institutionName.trim(), institutionAcronym: blankToNull(value.institutionAcronym),
    published: value.published, originUrl: value.originUrl.trim(), metadataPrefix: blankToNull(value.metadataPrefix), metadataStoreSchema: blankToNull(value.metadataStoreSchema),
    sets: value.sets.map(item => item.trim()).filter(Boolean), attributes, properties, scheduleCronExpression: blankToNull(value.scheduleCronExpression),
    prevalidatorId: asId(value.prevalidatorId), validatorId: asId(value.validatorId), transformerId: asId(value.transformerId), secondaryTransformerId: asId(value.secondaryTransformerId),
  })

  return <Stack spacing={3} component="form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
    <Box><Typography component={Link} to="/networks" color="primary">← {network.data.acronym}</Typography><Typography variant="h4">{t('networks.edit')}</Typography><Typography color="text.secondary">{t('networks.editDescription')}</Typography></Box>
    {active && <Alert severity="warning">Hay procesos activos para esta fuente. La configuración no puede modificarse hasta que finalicen o se cancelen.</Alert>}
    {saveSuccess && <Alert severity="success" onClose={() => setSaveSuccess(false)}>Los cambios de la fuente se guardaron correctamente.</Alert>}
    {update.isError && <ApiProblemAlert error={update.error as ApiError} />}
    <Paper variant="outlined"><Tabs value={tab} onChange={(_, next: TabName) => setTab(next)} variant="scrollable" scrollButtons="auto"><Tab value="general" label={t('networks.main')} /><Tab value="processing" label={t('networks.processing')} /><Tab value="profile" label={t('networks.profile')} /><Tab value="actions" label={t('networks.actionSchedule')} /></Tabs>
      <Box sx={{ p: 3 }}>
        {tab === 'general' && <GeneralFields form={form} capabilities={capabilities.data!} />}
        {tab === 'processing' && <ProcessingFields form={form} validators={validators.data!.items} transformers={transformers.data!.items} />}
        {tab === 'profile' && <ProfileFields profile={profile} profiles={profiles.data!} attributes={attributes} setAttributes={setAttributes} />}
        {tab === 'actions' && <NetworkActionsEditor client={client} networkId={id} actions={networkActions.data || []} catalog={applicationActions.data || []} loading={networkActions.isLoading} disabled={active} />}
      </Box>
    </Paper>
    <Stack direction="row" spacing={2}><Button component={Link} to="/networks" disabled={update.isPending}>{t('common.cancel')}</Button><Button type="submit" variant="contained" startIcon={<SaveIcon />} disabled={update.isPending || active || hasUnknownProfile}>{t('networks.saveChanges')}</Button></Stack>
  </Stack>
}

function NetworkActionsEditor({ client, networkId, actions, catalog, loading, disabled }: { client: ApiClient; networkId: number; actions: NetworkActionConfiguration[]; catalog: ApplicationAction[]; loading: boolean; disabled: boolean }) {
  const { t } = useTranslation()
  const cache = useQueryClient()
  const [actionSaved, setActionSaved] = useState(false)
  const updateAction = useMutation({ mutationFn: (action: NetworkActionConfiguration) => client.updateNetworkAction(networkId, action.actionKey, { enabled: action.enabled, scheduleEnabled: action.scheduleEnabled, configuration: action.configuration }), onSuccess: () => { setActionSaved(true); return cache.invalidateQueries({ queryKey: queryKeys.networkActions(networkId) }) } })
  const catalogOrder = new Map(catalog.map(action => [action.actionKey, action.order ?? Number.MAX_SAFE_INTEGER]))
  const orderedActions = [...actions].sort((left, right) => (catalogOrder.get(left.actionKey) ?? left.order ?? Number.MAX_SAFE_INTEGER) - (catalogOrder.get(right.actionKey) ?? right.order ?? Number.MAX_SAFE_INTEGER) || left.actionKey.localeCompare(right.actionKey))
  if (loading) return <CircularProgress />
  return <Stack spacing={2}><Typography variant="h6">{t('networks.actionsOfSource')}</Typography><Typography color="text.secondary">{t('networks.processingRelations')}</Typography>
    {actionSaved && <Alert severity="success" onClose={() => setActionSaved(false)}>La configuración de la acción se guardó correctamente.</Alert>}
    {updateAction.isError && <ApiProblemAlert error={updateAction.error as ApiError} />}
    {orderedActions.map(action => { const definition = catalog.find(item => item.actionKey === action.actionKey)?.definition; const actionLabel = t(`networks.actionNames.${action.actionKey}`, { defaultValue: definition?.description || definition?.name || action.actionKey }); return <Paper key={action.actionKey} variant="outlined" sx={{ p: 2 }}><Stack spacing={1}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography fontWeight={600}>{actionLabel}</Typography><Typography variant="caption" color="text.secondary"><code>{action.actionKey}</code></Typography></Box><Typography variant="body2" color="text.secondary">{action.globalState}</Typography></Stack><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><FormControlLabel control={<Checkbox checked={action.enabled} disabled={disabled || action.globalState !== 'ENABLED'} onChange={event => updateAction.mutate({ ...action, enabled: event.target.checked })} />} label={t('networks.manual')} /><FormControlLabel control={<Checkbox checked={action.scheduleEnabled} disabled={disabled || !action.enabled || action.globalState !== 'ENABLED'} onChange={event => updateAction.mutate({ ...action, enabled: action.enabled, scheduleEnabled: event.target.checked })} />} label={t('networks.scheduled')} /></Stack>{Object.keys(action.schema.properties || {}).length > 0 && <ActionConfigurationForm action={action} disabled={disabled} saving={updateAction.isPending} onSave={configuration => updateAction.mutate({ ...action, configuration })} />}</Stack></Paper> })}
    <MetadataCleanupPreviewPanel client={client} networkId={networkId} disabled={disabled} />
  </Stack>
}

function MetadataCleanupPreviewPanel({ client, networkId, disabled }: { client: ApiClient; networkId: number; disabled: boolean }) {
  const { t } = useTranslation()
  const [result, setResult] = useState<MetadataCleanupPreview | null>(null)
  const preview = useMutation({ mutationFn: () => client.previewMetadataCleanup(networkId), onSuccess: setResult })
  return <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}><Stack spacing={1}><Typography variant="subtitle1">{t('networks.metadataMaintenance')}</Typography><Typography variant="body2" color="text.secondary">{t('networks.metadataMaintenanceDescription')}</Typography><Box><Button size="small" variant="outlined" disabled={disabled || preview.isPending} onClick={() => preview.mutate()}>{t('networks.analyzeMetadata')}</Button></Box>{preview.isError && <ApiProblemAlert error={preview.error as ApiError} />}{result && <Alert severity="info">{t('networks.metadataPreviewResult', { snapshots: result.protectedSnapshotIds.join(', '), scanned: result.metadataEntriesScanned, candidates: result.orphanCandidates })}</Alert>}</Stack></Paper>
}

function ActionConfigurationForm({ action, disabled, saving, onSave }: { action: NetworkActionConfiguration; disabled: boolean; saving: boolean; onSave: (configuration: Record<string, unknown>) => void }) {
  const [configuration, setConfiguration] = useState(action.effectiveConfiguration)
  return <Stack spacing={1} sx={{ pt: 1 }}><Typography variant="subtitle2">Opciones de ejecución</Typography><Form schema={action.schema} uiSchema={action.uiSchema} validator={validator} formData={configuration} disabled={disabled} onChange={event => setConfiguration((event.formData || {}) as Record<string, unknown>)} showErrorList={false}><span /></Form><Box><Button size="small" variant="outlined" disabled={disabled || saving} onClick={() => onSave(configuration)}>Guardar opciones</Button></Box></Stack>
}

function GeneralFields({ form, capabilities }: { form: UseFormReturn<NetworkForm>; capabilities: Capabilities }) {
  const { register, control, formState: { errors } } = form
  const { t } = useTranslation()
  const cronValue = form.watch('scheduleCronExpression')
  return <Stack spacing={2}><Typography variant="h6">{t('networks.principalData')}</Typography>
    <TextField label={t('networks.acronym')} helperText={t('networks.acronymHelp')} {...register('acronym')} error={Boolean(errors.acronym)} InputProps={{ readOnly: true }} />
    <TextField label={t('networks.repository')} {...register('name')} error={Boolean(errors.name)} helperText={errors.name?.message} required />
    <TextField label={t('networks.institution')} {...register('institutionName')} error={Boolean(errors.institutionName)} helperText={errors.institutionName?.message} required />
    <TextField label="Acrónimo de institución" {...register('institutionAcronym')} />
    <FormControlLabel control={<Checkbox {...register('published')} />} label={t('networks.published')} />
    <Divider />
    <TextField label={t('networks.url')} {...register('originUrl')} error={Boolean(errors.originUrl)} helperText={errors.originUrl?.message} required />
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TextField select fullWidth label={t('networks.metadataPrefix')} {...register('metadataPrefix')}>{capabilities.metadataFormats.map(format => <MenuItem key={format} value={format}>{format}</MenuItem>)}</TextField>
      <TextField select fullWidth label={t('networks.storageFormat')} {...register('metadataStoreSchema')}>{capabilities.metadataStoreSchemas.map(format => <MenuItem key={format} value={format}>{format}</MenuItem>)}</TextField>
    </Stack>
    <Controller control={control} name="sets" render={({ field }) => <Autocomplete multiple freeSolo options={[]} value={field.value} onChange={(_, value) => field.onChange(value)} renderInput={params => <TextField {...params} label={t('networks.sets')} helperText={t('networks.allSets')} />} />} />
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}><TextField fullWidth label={t('networks.cron')} {...register('scheduleCronExpression')} helperText={cronValue ? undefined : t('networks.noSchedule')} /><CronEditor value={cronValue} onChange={value => form.setValue('scheduleCronExpression', value, { shouldDirty: true })} /></Stack>
  </Stack>
}

function CronEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [parts, setParts] = useState<string[]>(['0', '0', '2', '*', '*', '?'])
  const openEditor = () => { setParts(value.trim() ? value.trim().split(/\s+/).slice(0, 6) : ['0', '0', '2', '*', '*', '?']); setOpen(true) }
  const preset = (expression: string) => { setParts(expression ? expression.split(' ') : ['', '', '', '', '', '']) }
  const apply = () => { onChange(parts.every(part => !part.trim()) ? '' : parts.join(' ').trim()); setOpen(false) }
  const labels = ['Segundo', 'Minuto', 'Hora', 'Día del mes', 'Mes', 'Día de semana']
  return <><Button variant="outlined" sx={{ whiteSpace: 'nowrap', mt: { sm: 0.8 } }} onClick={openEditor}>Editor cron</Button><Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Programación Quartz</DialogTitle><DialogContent dividers><Stack spacing={2}><Typography variant="body2" color="text.secondary">Selecciona un ejemplo o ajusta la expresión Quartz de seis campos.</Typography><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button size="small" onClick={() => preset('')}>Nunca</Button><Button size="small" onClick={() => preset('0 0 2 ? * MON')}>Una vez por semana</Button><Button size="small" onClick={() => preset('0 0 2 1 * ?')}>Una vez por mes</Button></Stack><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{parts.every(part => !part) ? 'Sin programación' : parts.join(' ')}</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1 }}>{labels.map((label, index) => <TextField key={label} label={label} size="small" value={parts[index] || ''} onChange={event => setParts(current => current.map((part, partIndex) => partIndex === index ? event.target.value : part))} />)}</Box></Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Cancelar</Button><Button variant="contained" onClick={apply}>Aplicar</Button></DialogActions></Dialog></>
}

function ProcessingFields({ form, validators, transformers }: { form: UseFormReturn<NetworkForm>; validators: Array<{ id: number; name: string }>; transformers: Array<{ id: number; name: string }> }) {
  const { t } = useTranslation()
  return <Stack spacing={2}><Typography variant="h6">{t('networks.validators')}</Typography><Typography color="text.secondary">{t('networks.processingRelations')}</Typography>
    <IdSelect label="Prevalidador" name="prevalidatorId" form={form} items={validators} emptyLabel={t('networks.noPrevalidator')} />
    <IdSelect label="Validador" name="validatorId" form={form} items={validators} emptyLabel={t('networks.noValidator')} />
    <IdSelect label="Transformador principal" name="transformerId" form={form} items={transformers} emptyLabel={t('networks.noTransformer')} />
    <IdSelect label="Transformador secundario" name="secondaryTransformerId" form={form} items={transformers} emptyLabel={t('networks.noTransformer')} />
  </Stack>
}

function IdSelect({ label, name, form, items, emptyLabel }: { label: string; name: 'prevalidatorId' | 'validatorId' | 'transformerId' | 'secondaryTransformerId'; form: UseFormReturn<NetworkForm>; items: Array<{ id: number; name: string }>; emptyLabel: string }) {
  return <Controller name={name} control={form.control} render={({ field }) => <TextField select label={label} value={field.value} onChange={field.onChange}><MenuItem value="">{emptyLabel}</MenuItem>{items.map(item => <MenuItem key={item.id} value={String(item.id)}>{item.name}</MenuItem>)}</TextField>} />
}

function ProfileFields({ profile, profiles, attributes, setAttributes }: { profile: AttributeProfile | undefined; profiles: AttributeProfile[]; attributes: Record<string, unknown>; setAttributes: (next: Record<string, unknown>) => void }) {
  const { t, i18n } = useTranslation()
  const translatedSchema = useMemo(() => {
    if (!profile) return undefined
    const labels: Record<string, Record<string, string>> = {
      es: { institution_type: 'Tipo de institución', institution_url: 'URL de la institución', repository_type: 'Tipo de repositorio', source_type: 'Tipo de fuente', repository_url: 'URL del repositorio', source_url: 'URL de la fuente', oai_url: 'URL OAI', contact_email: 'Correo electrónico', country: 'País', city: 'Ciudad', phone: 'Teléfono', telephone: 'Teléfono', software: 'Software', repository_id: 'Identificador del repositorio', responsible: 'Responsable', lastname_firstname_responsible: 'Apellido y nombre del responsable', responsible_position: 'Cargo del responsable', responsible_charge: 'Cargo del responsable', journal_title: 'Título de la revista', doi: 'DOI', issn: 'ISSN', issn_l: 'ISSN-L', ark_naan: 'NAAN para ARK', stats_source_id: 'ID de la fuente de estadísticas', oai_identifier_prefix: 'Prefijo del identificador OAI', sector: 'Barrio/sector', state: 'Estado (UF)', address: 'Dirección', postal_code: 'Código postal', content_type: 'Tipo de contenido', language: 'Idioma', internalNotes: 'Notas internas' },
      en: { institution_type: 'Institution type', institution_url: 'Institution URL', repository_type: 'Repository type', source_type: 'Source type', repository_url: 'Repository URL', source_url: 'Source URL', oai_url: 'OAI URL', contact_email: 'Contact email', country: 'Country', city: 'City', phone: 'Phone', telephone: 'Telephone', software: 'Software', repository_id: 'Repository identifier', responsible: 'Responsible', lastname_firstname_responsible: 'Responsible full name', responsible_position: 'Responsible position', responsible_charge: 'Responsible position', journal_title: 'Journal title', doi: 'DOI', issn: 'ISSN', issn_l: 'ISSN-L', ark_naan: 'ARK NAAN', stats_source_id: 'Statistics source ID', oai_identifier_prefix: 'OAI identifier prefix', sector: 'Sector', state: 'State', address: 'Address', postal_code: 'Postal code', content_type: 'Content type', language: 'Language', internalNotes: 'Internal notes' },
      pt: { institution_type: 'Natureza da instituição', institution_url: 'URL da instituição', repository_type: 'Tipo de repositório', source_type: 'Tipo de fonte', repository_url: 'URL do repositório', source_url: 'URL da fonte', oai_url: 'URL OAI', contact_email: 'E-mail', country: 'País', city: 'Cidade', phone: 'Telefone', telephone: 'Telefone', software: 'Software', repository_id: 'Identificador do repositório', responsible: 'Responsável', lastname_firstname_responsible: 'Nome completo do responsável', responsible_position: 'Cargo do responsável', responsible_charge: 'Cargo do responsável', journal_title: 'Título da revista', doi: 'DOI', issn: 'ISSN', issn_l: 'ISSN-L', ark_naan: 'NAAN para ARK', stats_source_id: 'ID da fonte de estatísticas', oai_identifier_prefix: 'Prefixo OAI', sector: 'Bairro/setor', state: 'Estado (UF)', address: 'Endereço', postal_code: 'Código postal', content_type: 'Tipo de conteúdo', language: 'Idioma', internalNotes: 'Notas internas' }
    }
    const language = i18n.language.slice(0, 2) as 'es' | 'en' | 'pt'
    const map = labels[language] ?? labels.es
    const schema = { ...profile.schema, properties: { ...(profile.schema.properties as Record<string, Record<string, unknown>> ?? {}) } }
    Object.entries(schema.properties).forEach(([key, definition]) => { if (map[key]) schema.properties[key] = { ...definition, title: map[key] } })
    return schema
  }, [profile, i18n.language])
  const currentClass = typeof attributes['@class'] === 'string' ? attributes['@class'] : ''
  const selectProfile = (className: string) => setAttributes(className
    ? { ...attributes, '@class': className }
    : Object.fromEntries(Object.entries(attributes).filter(([key]) => key !== '@class')))
  return <Stack spacing={2}>
    <TextField select label="Perfil de datos específicos" value={currentClass} onChange={event => selectProfile(event.target.value)} helperText="El perfil define los campos que se mostrarán; cambiarlo no elimina los datos existentes.">
      <MenuItem value="">Sin perfil</MenuItem>
      {profiles.map(item => <MenuItem key={item.typeId} value={item.className}>{item.name} · {item.typeId}</MenuItem>)}
    </TextField>
    {!profile && currentClass && <Alert severity="warning">{t('networks.profileUnavailable')} Los datos se conservarán hasta que selecciones un perfil publicado.</Alert>}
    {!profile && !currentClass && <Alert severity="info">Esta fuente no tiene perfil de datos específicos. Puedes continuar editando sus datos generales o seleccionar uno.</Alert>}
    {profile && <><Typography variant="h6">{profile.name}</Typography><Typography color="text.secondary">Perfil {profile.typeId} · versión {profile.version}</Typography>
    <Form schema={translatedSchema!} uiSchema={profile.uiSchema} validator={validator} formData={attributes} onChange={event => setAttributes((event.formData || {}) as Record<string, unknown>)} onSubmit={event => setAttributes((event.formData || {}) as Record<string, unknown>)} showErrorList={false}><span /></Form>
    </>}
  </Stack>
}

function ApiProblemAlert({ error }: { error: ApiError }) { return <Alert severity="error">{error.message}{error.problem.code ? ` (${error.problem.code})` : ''}{error.problem.traceId ? ` · traceId: ${error.problem.traceId}` : ''}</Alert> }
function asSelectValue(value: number | null) { return value === null ? '' : String(value) }
function asId(value: string) { return value ? Number(value) : null }
function blankToNull(value: string) { const trimmed = value.trim(); return trimmed || null }
