import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import type { Rule, RuleType } from '../../api/types'
import { queryKeys } from '../../api/query-keys'

type Kind = 'validator' | 'transformer'
const title: Record<Kind, string> = { validator: 'validador', transformer: 'transformador' }
const blankRule = (typeId = ''): Rule => ({ typeId, name: '', description: '', mandatory: false, quantifier: 'ONE_OR_MORE', runOrder: 0, configuration: {} })

export function ConfigurationEditPage({ client, kind }: { client: ApiClient; kind: Kind }) {
  const rawId = useParams().id; const isNew = rawId === 'new'; const id = Number(rawId); const cache = useQueryClient(); const navigate = useNavigate()
  const detail = useQuery({ queryKey: kind === 'validator' ? queryKeys.validator(id) : queryKeys.transformer(id), queryFn: () => kind === 'validator' ? client.validator(id) : client.transformer(id), enabled: !isNew && Number.isSafeInteger(id) })
  const types = useQuery({ queryKey: queryKeys.ruleTypes(kind), queryFn: () => client.ruleTypes(kind) })
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [rules, setRules] = useState<Rule[]>([]); const [ruleErrors, setRuleErrors] = useState<Record<number, string>>({})
  useEffect(() => { if (detail.data) { setName(detail.data.name); setDescription(detail.data.description || ''); setRules(detail.data.rules) } }, [detail.data])
  const save = useMutation({ mutationFn: () => {
    // typeId is the public identity. Never round-trip a legacy Java class name.
    const payload = { name: name.trim(), description: description.trim() || null,
      rules: rules.map(({ className: _legacyClassName, ...rule }) => rule) }
    return isNew ? (kind === 'validator' ? client.createValidator(payload) : client.createTransformer(payload)) : (kind === 'validator' ? client.updateValidator(id, payload) : client.updateTransformer(id, payload))
  }, onSuccess: saved => { cache.invalidateQueries({ queryKey: kind === 'validator' ? queryKeys.validators : queryKeys.transformers }); cache.invalidateQueries({ queryKey: kind === 'validator' ? queryKeys.validator(saved.id) : queryKeys.transformer(saved.id) }); navigate(`/${kind}s/${saved.id}`) } })
  const updateRule = (index: number, patch: Partial<Rule>) => setRules(current => current.map((rule, position) => position === index ? { ...rule, ...patch } : rule))
  const submit = () => {
    const errors: Record<number, string> = {}; rules.forEach((rule, index) => { if (!rule.typeId || !rule.name.trim()) errors[index] = 'Selecciona un tipo y escribe un nombre.' })
    setRuleErrors(errors); if (!name.trim() || Object.keys(errors).length) return; save.mutate()
  }
  if (!isNew && detail.isLoading || types.isLoading) return <CircularProgress />
  if ((!isNew && (detail.isError || !detail.data)) || types.isError) return <Alert severity="error">No se pudo cargar la configuración.</Alert>
  return <Stack spacing={3}><Box><Typography component={Link} to={`/${kind}s`} color="primary">← {kind === 'validator' ? 'Validadores' : 'Transformadores'}</Typography><Typography variant="h4">{isNew ? `Crear ${title[kind]}` : `Editar ${title[kind]}`}</Typography></Box>
    {save.isError && <Alert severity="error">{(save.error as ApiError).message}</Alert>}
    <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}><TextField label="Nombre" value={name} onChange={event => setName(event.target.value)} required /><TextField label="Descripción" value={description} onChange={event => setDescription(event.target.value)} multiline minRows={2} />
      <Typography variant="h6">Reglas</Typography>{rules.map((rule, index) => <RuleEditor key={rule.id ?? `new-${index}`} rule={rule} index={index} kind={kind} types={types.data!} error={ruleErrors[index]} onChange={updateRule} onDelete={() => setRules(current => current.filter((_, position) => position !== index))} />)}
      <Button startIcon={<AddIcon />} onClick={() => { const ruleType = types.data?.[0]; setRules(current => [...current, { ...blankRule(ruleType?.typeId), configuration: defaultConfiguration(ruleType) }]) }}>Añadir regla</Button></Stack></Paper>
    <Stack direction="row" spacing={2}><Button component={Link} to={`/${kind}s`}>Cancelar</Button><Button variant="contained" startIcon={<SaveIcon />} disabled={save.isPending || !name.trim()} onClick={submit}>Guardar</Button></Stack>
  </Stack>
}

function RuleEditor({ rule, index, kind, types, error, onChange, onDelete }: { rule: Rule; index: number; kind: Kind; types: RuleType[]; error?: string; onChange: (index: number, patch: Partial<Rule>) => void; onDelete: () => void }) {
  const ruleType = types.find(type => type.typeId === rule.typeId)
  const selectType = (typeId: string) => {
    const nextType = types.find(type => type.typeId === typeId)
    onChange(index, { typeId, className: undefined, configuration: defaultConfiguration(nextType) })
  }
  return <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}><Stack spacing={2}><Stack direction="row" justifyContent="space-between"><Typography variant="subtitle1">Regla {index + 1}</Typography><Button color="error" size="small" startIcon={<DeleteIcon />} onClick={onDelete}>Quitar</Button></Stack><TextField select label="Tipo" value={rule.typeId} onChange={event => selectType(event.target.value)}>{types.map(type => <MenuItem key={type.typeId} value={type.typeId}>{type.name}</MenuItem>)}</TextField><TextField label="Nombre" value={rule.name} onChange={event => onChange(index, { name: event.target.value })} required /><TextField label="Descripción" value={rule.description || ''} onChange={event => onChange(index, { description: event.target.value })} />
    {kind === 'validator' ? <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><FormControlLabel control={<Checkbox checked={Boolean(rule.mandatory)} onChange={event => onChange(index, { mandatory: event.target.checked })} />} label="Obligatoria" /><TextField select fullWidth label="Cuantificador" value={rule.quantifier || 'ONE_OR_MORE'} onChange={event => onChange(index, { quantifier: event.target.value })}><MenuItem value="ZERO_ONLY">Exactamente cero</MenuItem><MenuItem value="ONE_ONLY">Exactamente uno</MenuItem><MenuItem value="ZERO_OR_MORE">Cero o más</MenuItem><MenuItem value="ONE_OR_MORE">Uno o más</MenuItem><MenuItem value="ALL">Todos</MenuItem></TextField></Stack> : <TextField label="Orden" type="number" value={rule.runOrder || 0} onChange={event => onChange(index, { runOrder: Number(event.target.value) })} />}
    {error && <Alert severity="error">{error}</Alert>}
    {ruleType ? <><Typography variant="subtitle2">Configuración específica: {ruleType.name}</Typography>{ruleType.help && <Alert severity="info">{ruleType.help}</Alert>}<Form schema={ruleType.schema} uiSchema={ruleType.uiSchema} validator={validator} formData={rule.configuration} liveValidate showErrorList={false} onChange={event => onChange(index, { configuration: (event.formData || {}) as Record<string, unknown> })}><span /></Form></> : <Alert severity="warning">El tipo de esta regla no está disponible en el motor actual. Selecciona uno de los tipos publicados para continuar.</Alert>}
  </Stack></Paper>
}

function defaultConfiguration(type: RuleType | undefined): Record<string, unknown> {
  const properties = type?.schema.properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {}
  return Object.fromEntries(Object.entries(properties as Record<string, unknown>).flatMap(([key, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const defaultValue = (value as Record<string, unknown>).default
    return defaultValue === undefined ? [] : [[key, defaultValue]]
  }))
}
