import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteIcon from '@mui/icons-material/Delete'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SaveIcon from '@mui/icons-material/Save'
import { Alert, Box, Button, Checkbox, CircularProgress, Drawer, FormControlLabel, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material'
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
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [rules, setRules] = useState<Rule[]>([]); const [ruleErrors, setRuleErrors] = useState<Record<number, string>>({}); const [selectedRule, setSelectedRule] = useState<number | null>(null)
  useEffect(() => { if (detail.data) { setName(detail.data.name); setDescription(detail.data.description || ''); setRules(detail.data.rules) } }, [detail.data])
  const save = useMutation({ mutationFn: () => {
    // typeId is the public identity. Never round-trip a legacy Java class name.
    const payload = { name: name.trim(), description: description.trim() || null,
      rules: rules.map(({ className: _legacyClassName, ...rule }) => rule) }
    return isNew ? (kind === 'validator' ? client.createValidator(payload) : client.createTransformer(payload)) : (kind === 'validator' ? client.updateValidator(id, payload) : client.updateTransformer(id, payload))
  }, onSuccess: saved => { cache.invalidateQueries({ queryKey: kind === 'validator' ? queryKeys.validators : queryKeys.transformers }); cache.invalidateQueries({ queryKey: kind === 'validator' ? queryKeys.validator(saved.id) : queryKeys.transformer(saved.id) }); navigate(`/${kind}s/${saved.id}`) } })
  const updateRule = (index: number, patch: Partial<Rule>) => setRules(current => current.map((rule, position) => position === index ? { ...rule, ...patch } : rule))
  const removeRule = (index: number) => { setRules(current => current.filter((_, position) => position !== index)); setSelectedRule(null) }
  const moveRule = (index: number, direction: -1 | 1) => setRules(current => {
    const target = index + direction; if (target < 0 || target >= current.length) return current
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]]
    return kind === 'transformer' ? next.map((rule, position) => ({ ...rule, runOrder: position })) : next
  })
  const addRule = () => { const ruleType = types.data?.[0]; const nextIndex = rules.length; setRules(current => [...current, { ...blankRule(ruleType?.typeId), runOrder: current.length, configuration: defaultConfiguration(ruleType) }]); setSelectedRule(nextIndex) }
  const submit = () => {
    const errors: Record<number, string> = {}; rules.forEach((rule, index) => { if (!rule.typeId || !rule.name.trim()) errors[index] = 'Selecciona un tipo y escribe un nombre.' })
    setRuleErrors(errors); if (!name.trim() || Object.keys(errors).length) return; save.mutate()
  }
  if (!isNew && detail.isLoading || types.isLoading) return <CircularProgress />
  if ((!isNew && (detail.isError || !detail.data)) || types.isError) return <Alert severity="error">No se pudo cargar la configuración.</Alert>
  return <Stack spacing={3}><Box><Typography component={Link} to={`/${kind}s`} color="primary">← {kind === 'validator' ? 'Validadores' : 'Transformadores'}</Typography><Typography variant="h4">{isNew ? `Crear ${title[kind]}` : `Editar ${title[kind]}`}</Typography></Box>
    {save.isError && <Alert severity="error">{(save.error as ApiError).message}</Alert>}
    <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}><TextField label="Nombre" value={name} onChange={event => setName(event.target.value)} required /><TextField label="Descripción" value={description} onChange={event => setDescription(event.target.value)} multiline minRows={2} /></Stack></Paper>
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ px: 2.5, py: 1.7, borderBottom: 1, borderColor: 'divider' }}><Box><Typography variant="h6">Reglas</Typography><Typography variant="body2" color="text.secondary">{rules.length} regla{rules.length === 1 ? '' : 's'} · edita una regla por vez.</Typography></Box><Button startIcon={<AddIcon />} variant="outlined" onClick={addRule}>Añadir regla</Button></Stack><Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>Nombre</TableCell><TableCell>Tipo</TableCell>{kind === 'validator' ? <><TableCell>Obligatoria</TableCell><TableCell>Cuantificador</TableCell></> : <TableCell>Orden</TableCell>}<TableCell align="right">Acciones</TableCell></TableRow></TableHead><TableBody>{rules.map((rule, index) => { const ruleType = types.data?.find(type => type.typeId === rule.typeId); return <TableRow key={rule.id ?? `new-${index}`} hover selected={selectedRule === index}><TableCell>{index + 1}</TableCell><TableCell><Typography fontWeight={700}>{rule.name || 'Sin nombre'}</Typography>{ruleErrors[index] && <Typography variant="caption" color="error">Configuración incompleta</Typography>}</TableCell><TableCell>{ruleType?.name || 'Tipo no disponible'}</TableCell>{kind === 'validator' ? <><TableCell>{rule.mandatory ? 'Sí' : 'No'}</TableCell><TableCell>{quantifierLabel(rule.quantifier)}</TableCell></> : <TableCell>{rule.runOrder ?? index}</TableCell>}<TableCell align="right"><Tooltip title="Subir"><span><IconButton size="small" disabled={index === 0} onClick={() => moveRule(index, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton></span></Tooltip><Tooltip title="Bajar"><span><IconButton size="small" disabled={index === rules.length - 1} onClick={() => moveRule(index, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton></span></Tooltip><Tooltip title="Editar regla"><IconButton size="small" color="primary" onClick={() => setSelectedRule(index)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Eliminar regla"><IconButton size="small" color="error" onClick={() => removeRule(index)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></TableCell></TableRow> })}{!rules.length && <TableRow><TableCell colSpan={kind === 'validator' ? 6 : 5} align="center">Aún no hay reglas. Añade la primera regla para configurarla.</TableCell></TableRow>}</TableBody></Table></Box></Paper>
    <Stack direction="row" spacing={2}><Button component={Link} to={`/${kind}s`}>Cancelar</Button><Button variant="contained" startIcon={<SaveIcon />} disabled={save.isPending || !name.trim()} onClick={submit}>Guardar</Button></Stack>
    <Drawer anchor="right" open={selectedRule !== null} onClose={() => setSelectedRule(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 620 }, p: 3 } }}>{selectedRule !== null && rules[selectedRule] && <Stack spacing={2}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6">{rules[selectedRule].name || 'Nueva regla'}</Typography><Typography variant="body2" color="text.secondary">Configuración individual de la regla {selectedRule + 1}</Typography></Box><Button onClick={() => setSelectedRule(null)}>Cerrar</Button></Stack><RuleEditor rule={rules[selectedRule]} index={selectedRule} kind={kind} types={types.data!} error={ruleErrors[selectedRule]} onChange={updateRule} onDelete={() => removeRule(selectedRule)} /></Stack>}</Drawer>
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

function quantifierLabel(value: string | null | undefined) {
  return ({ ZERO_ONLY: 'Exactamente cero', ONE_ONLY: 'Exactamente uno', ZERO_OR_MORE: 'Cero o más', ONE_OR_MORE: 'Uno o más', ALL: 'Todos' } as Record<string, string>)[value || ''] || '—'
}
