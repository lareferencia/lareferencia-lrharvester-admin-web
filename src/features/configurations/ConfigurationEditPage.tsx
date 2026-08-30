import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteIcon from '@mui/icons-material/Delete'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SaveIcon from '@mui/icons-material/Save'
import { Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Drawer, FormControlLabel, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './configuration-editor-i18n'
import type { ApiClient } from '../../api/client'
import type { ApiError } from '../../api/problem-detail'
import type { Rule, RuleType } from '../../api/types'
import { queryKeys } from '../../api/query-keys'

type Kind = 'validator' | 'transformer'
const blankRule = (typeId = ''): Rule => ({ typeId, name: '', description: '', mandatory: false, quantifier: 'ONE_OR_MORE', runOrder: 0, configuration: {} })

export function ConfigurationEditPage({ client, kind }: { client: ApiClient; kind: Kind }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.split('-')[0]
  const kindLabel = t(`configuration.${kind}`)
  const rawId = useParams().id; const isNew = rawId === 'new'; const id = Number(rawId); const cache = useQueryClient(); const navigate = useNavigate()
  const detail = useQuery({ queryKey: kind === 'validator' ? queryKeys.validator(id) : queryKeys.transformer(id), queryFn: () => kind === 'validator' ? client.validator(id) : client.transformer(id), enabled: !isNew && Number.isSafeInteger(id) })
  const types = useQuery({ queryKey: queryKeys.ruleTypes(kind, locale), queryFn: () => client.ruleTypes(kind, locale) })
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [rules, setRules] = useState<Rule[]>([]); const [ruleErrors, setRuleErrors] = useState<Record<number, string>>({}); const [selectedRule, setSelectedRule] = useState<number | null>(null); const [ruleNotice, setRuleNotice] = useState<string | null>(null); const [configurationNotice, setConfigurationNotice] = useState<string | null>(null); const [pendingDeletion, setPendingDeletion] = useState<number | null>(null)
  useEffect(() => { if (detail.data) { setName(detail.data.name); setDescription(detail.data.description || ''); setRules(detail.data.rules) } }, [detail.data])
  const save = useMutation({ mutationFn: () => {
    // typeId is the public identity. Never round-trip a legacy Java class name.
    const payload = { name: name.trim(), description: description.trim() || null,
      rules: rules.map(({ className: _legacyClassName, ...rule }) => rule) }
    if (isNew) return kind === 'validator' ? client.createValidator(payload) : client.createTransformer(payload)
    const metadata = { name: payload.name, description: payload.description }
    return kind === 'validator' ? client.updateValidatorMetadata(id, metadata) : client.updateTransformerMetadata(id, metadata)
  }, onSuccess: saved => { cache.invalidateQueries({ queryKey: kind === 'validator' ? queryKeys.validators : queryKeys.transformers }); cache.invalidateQueries({ queryKey: kind === 'validator' ? queryKeys.validator(saved.id) : queryKeys.transformer(saved.id) }); if (isNew) navigate(`/${kind}s/${saved.id}`); else setConfigurationNotice(t('configurationEditor.savedConfiguration', { kind: kindLabel })) } })
  const updateRule = (index: number, patch: Partial<Rule>) => setRules(current => current.map((rule, position) => position === index ? { ...rule, ...patch } : rule))
  const saveRule = useMutation({ mutationFn: ({ index, rule }: { index: number; rule: Rule }) => client.saveConfigurationRule(kind, id, rule), onSuccess: (saved, variables) => { updateRule(variables.index, saved); setRuleNotice(t('configurationEditor.savedRule', { name: saved.name })); cache.invalidateQueries({ queryKey: kind === 'validator' ? queryKeys.validator(id) : queryKeys.transformer(id) }) } })
  const deleteRule = useMutation({ mutationFn: (ruleId: number) => client.deleteConfigurationRule(kind, id, ruleId), onSuccess: () => { const index = pendingDeletion; if (index !== null) setRules(current => current.filter((_, position) => position !== index)); setSelectedRule(null); setPendingDeletion(null); setRuleNotice(t('configurationEditor.deletedRule')); cache.invalidateQueries({ queryKey: kind === 'validator' ? queryKeys.validator(id) : queryKeys.transformer(id) }) } })
  const reorderRules = useMutation({ mutationFn: (ruleIds: number[]) => client.reorderConfigurationRules(kind, id, ruleIds), onSuccess: saved => { setRules(saved); setRuleNotice(t('configurationEditor.reorderedRules')); cache.invalidateQueries({ queryKey: kind === 'validator' ? queryKeys.validator(id) : queryKeys.transformer(id) }) } })
  const requestRemoveRule = (index: number) => {
    const rule = rules[index]
    if (isNew || !rule.id) { setRules(current => current.filter((_, position) => position !== index)); setSelectedRule(null); return }
    setPendingDeletion(index)
  }
  const moveRule = (index: number, direction: -1 | 1) => {
    const target = index + direction; if (target < 0 || target >= rules.length) return
    const swapped = [...rules]; [swapped[index], swapped[target]] = [swapped[target], swapped[index]]
    const next = kind === 'transformer' ? swapped.map((rule, position) => ({ ...rule, runOrder: position })) : swapped
    setRules(next)
    if (!isNew && next.every(rule => rule.id)) reorderRules.mutate(next.map(rule => rule.id!))
  }
  // Kept as an alias for the compact table action; persisted rules ask for confirmation.
  const removeRule = requestRemoveRule
  const addRule = () => { const ruleType = types.data?.[0]; const nextIndex = rules.length; setRules(current => [...current, { ...blankRule(ruleType?.typeId), runOrder: current.length, configuration: defaultConfiguration(ruleType) }]); setSelectedRule(nextIndex) }
  const submit = () => {
    const errors: Record<number, string> = {}; if (isNew) rules.forEach((rule, index) => { if (!rule.typeId || !rule.name.trim()) errors[index] = t('configurationEditor.incompleteRule') })
    setRuleErrors(errors); if (!name.trim() || Object.keys(errors).length) return; save.mutate()
  }
  if (!isNew && detail.isLoading || types.isLoading) return <CircularProgress />
  if ((!isNew && (detail.isError || !detail.data)) || types.isError) return <Alert severity="error">{t('configurationEditor.loadError')}</Alert>
  return <Stack spacing={3}><Box><Typography component={Link} to={`/${kind}s`} color="primary">← {kind === 'validator' ? t('configurationEditor.backValidators') : t('configurationEditor.backTransformers')}</Typography><Typography variant="h4">{isNew ? t("configurationEditor.create", { kind: kindLabel }) : t("configurationEditor.edit", { kind: kindLabel })}</Typography></Box>
    {save.isError && <Alert severity="error">{(save.error as ApiError).message}</Alert>}
    {saveRule.isError && <Alert severity="error" onClose={() => saveRule.reset()}>{(saveRule.error as ApiError).message}</Alert>}
    {ruleNotice && <Alert severity="success" onClose={() => setRuleNotice(null)}>{ruleNotice}</Alert>}
    {configurationNotice && <Alert severity="success" onClose={() => setConfigurationNotice(null)}>{configurationNotice}</Alert>}
    {deleteRule.isError && <Alert severity="error" onClose={() => deleteRule.reset()}>{(deleteRule.error as ApiError).message}</Alert>}
    {reorderRules.isError && <Alert severity="error" onClose={() => reorderRules.reset()}>{(reorderRules.error as ApiError).message}</Alert>}
    <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}><Typography variant="h6">{t('configurationEditor.configurationData')}</Typography><Typography variant="body2" color="text.secondary">{t('configurationEditor.metadataHint')}</Typography><TextField label={t("configurationEditor.name")} value={name} onChange={event => setName(event.target.value)} required /><TextField label={t("configurationEditor.description")} value={description} onChange={event => setDescription(event.target.value)} multiline minRows={2} /></Stack></Paper>
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ px: 2.5, py: 1.7, borderBottom: 1, borderColor: 'divider' }}><Box><Typography variant="h6">{t('configurationEditor.rules')}</Typography><Typography variant="body2" color="text.secondary">{t('configurationEditor.ruleCount', { count: rules.length })} · {t('configurationEditor.editOneRule')}</Typography></Box><Button startIcon={<AddIcon />} variant="outlined" onClick={addRule}>{t('configurationEditor.addRule')}</Button></Stack><Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>{t('configurationEditor.name')}</TableCell><TableCell>{t('configurationEditor.type')}</TableCell>{kind === 'validator' ? <><TableCell>{t('configurationEditor.mandatory')}</TableCell><TableCell>{t('configurationEditor.quantifier')}</TableCell></> : <TableCell>{t('configurationEditor.order')}</TableCell>}<TableCell align="right">{t('configurationEditor.actions')}</TableCell></TableRow></TableHead><TableBody>{rules.map((rule, index) => { const ruleType = types.data?.find(type => type.typeId === rule.typeId); return <TableRow key={rule.id ?? `new-${index}`} hover selected={selectedRule === index}><TableCell>{index + 1}</TableCell><TableCell><Typography fontWeight={700}>{rule.name || t('configurationEditor.unnamed')}</Typography>{ruleErrors[index] && <Typography variant="caption" color="error">{t('configurationEditor.incomplete')}</Typography>}</TableCell><TableCell>{ruleType?.name || t('configurationEditor.unavailableType')}</TableCell>{kind === 'validator' ? <><TableCell>{rule.mandatory ? t('configurationEditor.yes') : t('configurationEditor.no')}</TableCell><TableCell>{t("configurationEditor.quantifiers." + (rule.quantifier || ""), { defaultValue: "—" })}</TableCell></> : <TableCell>{rule.runOrder ?? index}</TableCell>}<TableCell align="right"><Tooltip title={t('configurationEditor.moveUp')}><span><IconButton size="small" disabled={index === 0} onClick={() => moveRule(index, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton></span></Tooltip><Tooltip title={t('configurationEditor.moveDown')}><span><IconButton size="small" disabled={index === rules.length - 1} onClick={() => moveRule(index, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton></span></Tooltip><Tooltip title={t('configurationEditor.editRule')}><IconButton size="small" color="primary" onClick={() => setSelectedRule(index)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip><Tooltip title={t('configurationEditor.deleteRule')}><IconButton size="small" color="error" onClick={() => removeRule(index)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></TableCell></TableRow> })}{!rules.length && <TableRow><TableCell colSpan={kind === 'validator' ? 6 : 5} align="center">{t('configurationEditor.noRules')}</TableCell></TableRow>}</TableBody></Table></Box></Paper>
    <Stack direction="row" spacing={2}><Button component={Link} to={`/${kind}s`}>{t('configurationEditor.cancel')}</Button><Button variant="contained" startIcon={<SaveIcon />} disabled={save.isPending || !name.trim()} onClick={submit}>{isNew ? t("configurationEditor.create", { kind: kindLabel }) : t("configurationEditor.saveConfiguration")}</Button></Stack>
    <Drawer anchor="right" open={selectedRule !== null} onClose={() => setSelectedRule(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 620 }, p: 3 } }}>{selectedRule !== null && rules[selectedRule] && <Stack spacing={2}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6">{rules[selectedRule].name || t('configurationEditor.newRule')}</Typography><Typography variant="body2" color="text.secondary">{t('configurationEditor.individualRule', { number: selectedRule + 1 })}</Typography></Box><Button onClick={() => setSelectedRule(null)}>{t('configurationEditor.close')}</Button></Stack><RuleEditor rule={rules[selectedRule]} index={selectedRule} kind={kind} types={types.data!} error={ruleErrors[selectedRule]} onChange={updateRule} onDelete={() => requestRemoveRule(selectedRule)} onSave={!isNew ? () => saveRule.mutate({ index: selectedRule, rule: rules[selectedRule] }) : undefined} saving={saveRule.isPending} /></Stack>}</Drawer>
    <Dialog open={pendingDeletion !== null} onClose={() => !deleteRule.isPending && setPendingDeletion(null)}><DialogTitle>{t('configurationEditor.deleteTitle')}</DialogTitle><DialogContent><DialogContentText>{t('configurationEditor.deleteWarning', { kind: kindLabel })}</DialogContentText></DialogContent><DialogActions><Button disabled={deleteRule.isPending} onClick={() => setPendingDeletion(null)}>{t('configurationEditor.cancel')}</Button><Button color="error" variant="contained" disabled={deleteRule.isPending || pendingDeletion === null} onClick={() => { const ruleId = pendingDeletion === null ? undefined : rules[pendingDeletion]?.id; if (ruleId) deleteRule.mutate(ruleId) }}>{t('common.delete')}</Button></DialogActions></Dialog>
  </Stack>
}

function RuleEditor({ rule, index, kind, types, error, onChange, onDelete, onSave, saving }: { rule: Rule; index: number; kind: Kind; types: RuleType[]; error?: string; onChange: (index: number, patch: Partial<Rule>) => void; onDelete: () => void; onSave?: () => void; saving: boolean }) {
  const { t } = useTranslation()
  const ruleType = types.find(type => type.typeId === rule.typeId)
  const selectType = (typeId: string) => {
    const nextType = types.find(type => type.typeId === typeId)
    onChange(index, { typeId, className: undefined, configuration: defaultConfiguration(nextType) })
  }
  return <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}><Stack spacing={2}><Stack direction="row" justifyContent="space-between"><Typography variant="subtitle1">{t("configurationEditor.rules")} {index + 1}</Typography><Button color="error" size="small" startIcon={<DeleteIcon />} onClick={onDelete}>{t("configurationEditor.remove")}</Button></Stack><TextField select label={t("configurationEditor.type")} value={rule.typeId} onChange={event => selectType(event.target.value)}>{types.map(type => <MenuItem key={type.typeId} value={type.typeId}>{type.name}</MenuItem>)}</TextField><TextField label={t("configurationEditor.name")} value={rule.name} onChange={event => onChange(index, { name: event.target.value })} required /><TextField label={t("configurationEditor.description")} value={rule.description || ''} onChange={event => onChange(index, { description: event.target.value })} />
    {kind === 'validator' && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><FormControlLabel control={<Checkbox checked={Boolean(rule.mandatory)} onChange={event => onChange(index, { mandatory: event.target.checked })} />} label={t("configurationEditor.mandatory")} /><TextField select fullWidth label={t("configurationEditor.quantifier")} value={rule.quantifier || 'ONE_OR_MORE'} onChange={event => onChange(index, { quantifier: event.target.value })}><MenuItem value="ZERO_ONLY">{t("configurationEditor.quantifiers.ZERO_ONLY")}</MenuItem><MenuItem value="ONE_ONLY">{t("configurationEditor.quantifiers.ONE_ONLY")}</MenuItem><MenuItem value="ZERO_OR_MORE">{t("configurationEditor.quantifiers.ZERO_OR_MORE")}</MenuItem><MenuItem value="ONE_OR_MORE">{t("configurationEditor.quantifiers.ONE_OR_MORE")}</MenuItem><MenuItem value="ALL">{t("configurationEditor.quantifiers.ALL")}</MenuItem></TextField></Stack>}
    {error && <Alert severity="error">{error}</Alert>}
    {ruleType ? <><Typography variant="subtitle2">{t("configurationEditor.specificConfiguration", { name: ruleType.name })}</Typography>{ruleType.help && <Alert severity="info">{ruleType.help}</Alert>}<Form schema={ruleType.schema} uiSchema={ruleType.uiSchema} validator={validator} formData={rule.configuration} liveValidate showErrorList={false} onChange={event => onChange(index, { configuration: (event.formData || {}) as Record<string, unknown> })}><span /></Form></> : <Alert severity="warning">{t("configurationEditor.typeUnavailable")}</Alert>}
    {onSave ? <Button variant="contained" startIcon={<SaveIcon />} disabled={saving || !rule.typeId || !rule.name.trim()} onClick={onSave}>{t("configurationEditor.saveRule")}</Button> : <Alert severity="info">{t("configurationEditor.saveFirst", { kind: t(`configuration.`) })}</Alert>}
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
