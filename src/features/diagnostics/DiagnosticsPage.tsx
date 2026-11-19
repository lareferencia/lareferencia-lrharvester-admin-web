import i18n, { uiText, uiLocale } from '../../i18n'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton, InputLabel, LinearProgress, MenuItem, Pagination, Paper, Select, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '../../api/client'
import { ApiError } from '../../api/problem-detail'
import type { DiagnosticFilter, DiagnosticRecord, DiagnosticRule, Snapshot } from '../../api/types'
import { queryKeys } from '../../api/query-keys'
import { useTranslation } from 'react-i18next'

export function DiagnosticsPage({ client, networkId }: { client: ApiClient; networkId: number }) {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const requested = params.get('snapshot')
  const id = Number(requested)
  const validId = requested === null || (Number.isSafeInteger(id) && id > 0)
  const network = useQuery({ queryKey: queryKeys.network(networkId), queryFn: () => client.network(networkId) })
  const snapshot = useQuery({
    enabled: validId,
    queryKey: ['diagnostic-snapshot', networkId, requested],
    queryFn: async () => {
      try {
        return requested === null ? await client.latestValidSnapshot(networkId) : await client.snapshot(id)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
  })
  if (network.isLoading || snapshot.isLoading) return <CircularProgress />
  if (network.isError || snapshot.isError) return <Alert severity="error">{t('networks.loadError')}</Alert>
  const current = snapshot.data
  if (!validId || !current || current.deleted || current.networkId !== networkId) {
    return <Stack spacing={2}>
      <Alert severity="info">{requested === null ? t('diagnostics.noSnapshot') : uiText('unavailableSnapshot')}</Alert>
      <Button component={Link} to="/networks">{t('diagnostics.back')}</Button>
    </Stack>
  }
  return <DiagnosticReport key={current.id} client={client} snapshot={current} acronym={network.data?.acronym} name={network.data?.name} />
}

function DiagnosticReport({ client, snapshot, acronym, name }: { client: ApiClient; snapshot: Snapshot; acronym?: string; name?: string }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const identifier = params.get('identifier') || ''
  const validity = params.get('validity') || 'all'
  const transformed = params.get('transformed') || 'all'
  const rule = params.get('rule') || ''
  const requestedPage = Number(params.get('page'))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 0
  const [historyPage, setHistoryPage] = useState(0)
  const [selectedRecord, setSelectedRecord] = useState<DiagnosticRecord | null>(null)
  const [selectedRule, setSelectedRule] = useState<DiagnosticRule | null>(null)
  const { id: snapshotId, networkId } = snapshot
  const history = useQuery({
    queryKey: queryKeys.networkSnapshots(networkId, historyPage),
    queryFn: () => client.networkSnapshots(networkId, historyPage),
  })
  const choices = (history.data?.items || []).filter(item => !item.deleted)
  if (!choices.some(item => item.id === snapshotId)) choices.unshift(snapshot)
  const filters = useMemo<DiagnosticFilter[]>(() => [
    ...(identifier.trim() ? [{ field: 'IDENTIFIER' as const, operator: 'CONTAINS' as const, value: identifier.trim() }] : []),
    ...(validity === 'all' ? [] : [{ field: 'VALID' as const, operator: 'EQ' as const, value: validity === 'valid' }]),
    ...(transformed === 'all' ? [] : [{ field: 'TRANSFORMED' as const, operator: 'EQ' as const, value: transformed === 'yes' }]),
    ...(rule ? [{ field: 'RULE_INVALID' as const, operator: 'EQ' as const, value: Number(rule) }] : []),
  ], [identifier, validity, transformed, rule])
  const filterKey = JSON.stringify(filters)
  const summary = useQuery({ queryKey: queryKeys.diagnosticSummary(snapshotId, filterKey), queryFn: () => client.diagnosticSummary(snapshotId, filters) })
  const records = useQuery({ queryKey: queryKeys.diagnosticRecords(snapshotId, `${filterKey}:${page}`), queryFn: () => client.diagnosticRecords(snapshotId, { filters, page, size: 25 }) })
  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set('snapshot', String(snapshotId))
    next.delete('page')
    if (value === '' || (key !== 'identifier' && value === 'all')) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }
  const selectSnapshot = (id: number) => {
    const next = new URLSearchParams(params)
    next.set('snapshot', String(id))
    next.delete('page')
    next.delete('rule')
    setParams(next)
  }
  const updatePage = (index: number) => {
    const next = new URLSearchParams(params)
    next.set('snapshot', String(snapshotId))
    next.set('page', String(index))
    setParams(next)
  }
  return <Stack spacing={3}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ md: 'center' }}>
      <Box><Typography variant="overline" color="text.secondary" fontWeight={800}>{t('diagnostics.title')}</Typography><Typography variant="h4">{acronym}</Typography><Typography color="text.secondary">{name} · {t('diagnostics.snapshot')} #{snapshotId} · {formatDate(snapshot.endTime || snapshot.startTime)}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1 }}><Chip size="small" label={`H: ${snapshot.size ?? '—'}`} /><Chip size="small" color="success" label={`V: ${snapshot.validSize ?? '—'}`} /><Chip size="small" color="warning" label={`T: ${snapshot.transformedSize ?? '—'}`} /></Stack></Box>
      <Button component={Link} to="/networks" variant="outlined">{t('diagnostics.back')}</Button>
    </Stack>
    <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}><FormControl size="small" sx={{ minWidth: 320 }}><InputLabel id="diagnostic-snapshot-label">{uiText('snapshot')}</InputLabel><Select labelId="diagnostic-snapshot-label" label={uiText('snapshot')} value={snapshotId} onChange={event => selectSnapshot(Number(event.target.value))}>{choices.map(item => <MenuItem key={item.id} value={item.id}>#{item.id} · {snapshotStatusLabel(item.status)} · {formatDate(item.endTime || item.startTime)}</MenuItem>)}</Select></FormControl><Chip label={snapshotStatusLabel(snapshot.status)} color={snapshot.status === 'VALID' ? 'success' : 'default'} /><Typography variant="body2" color="text.secondary">{uiText('diagnosticFilters')}</Typography></Stack></Paper>
    {history.isError && <Alert severity="warning">{uiText('historyError')}</Alert>}
    {history.data && history.data.totalPages > 1 && <Pagination page={historyPage + 1} count={history.data.totalPages} onChange={(_, value) => setHistoryPage(value - 1)} />}
    <HeaderFilters validity={validity} transformed={transformed} rule={rule} onValidity={value => updateFilter('validity', value)} onTransformed={value => updateFilter('transformed', value)} onRule={value => updateFilter('rule', value)} rules={summary.data?.rules || []} onReset={() => setParams({ snapshot: String(snapshotId) })} />
    {summary.isLoading ? <LinearProgress /> : summary.isError ? <Alert severity="warning">{uiText('summaryError')}</Alert> : summary.data && <Summary summary={summary.data} />}
    <IdentifierSearch key={location.key} identifier={identifier} onSearch={value => updateFilter('identifier', value)} />
    {summary.data && <Box sx={{ order: 3 }}><Rules rules={summary.data.rules} total={summary.data.size} onSelect={setSelectedRule} /></Box>}
    {summary.data && summary.data.rules.length === 0 && <Alert severity="info">{uiText('noDiagnosticDetails')}</Alert>}
    <Box sx={{ order: 5 }}>
      {records.isError
        ? <Alert severity="error" action={<Button onClick={() => void records.refetch()}>{uiText('retryRead')}</Button>}>{uiText('recordsReadError')}</Alert>
        : <Records records={records.data?.items || []} loading={records.isLoading} onSelect={setSelectedRecord} />}
    </Box>
    {records.data && <Pagination sx={{ order: 8, alignSelf: 'center' }} page={page + 1} count={Math.max(records.data.totalPages, 1)} onChange={(_, value) => updatePage(value - 1)} />}
    <RecordDialog key={selectedRecord?.id} client={client} record={selectedRecord} onClose={() => setSelectedRecord(null)} rules={summary.data?.rules || []} />
    <OccurrencesDialog client={client} snapshotId={snapshotId} rule={selectedRule} filters={filters} onClose={() => setSelectedRule(null)} />
  </Stack>
}

function IdentifierSearch({ identifier, onSearch }: { identifier: string; onSearch: (value: string) => void }) {
  const [draft, setDraft] = useState(identifier)
  return <Stack component="form" direction="row" spacing={1} sx={{ order: 4 }}
    onSubmit={event => { event.preventDefault(); onSearch(draft.trim()) }}>
    <TextField size="small" label={uiText('searchIdentifier')} value={draft} onChange={event => setDraft(event.target.value)} />
    <Button type="submit" startIcon={<SearchIcon />}>{uiText('applySearch')}</Button>
  </Stack>
}

function HeaderFilters({ validity, transformed, rule, onValidity, onTransformed, onRule, rules, onReset }: { validity: string; transformed: string; rule: string; onValidity: (value: string) => void; onTransformed: (value: string) => void; onRule: (value: string) => void; rules: DiagnosticRule[]; onReset: () => void }) {

  return <Paper variant="outlined" sx={{ p: 1.5, order: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }}><FormControl size="small" sx={{ minWidth: 155 }}><InputLabel id="diagnostic-validity-label">{uiText('validity')}</InputLabel><Select labelId="diagnostic-validity-label" label={uiText('validity')} value={validity} onChange={event => onValidity(event.target.value)}><MenuItem value="all">{uiText('all')}</MenuItem><MenuItem value="valid">{uiText('validRecords')}</MenuItem><MenuItem value="invalid">{uiText('invalidRecords')}</MenuItem></Select></FormControl><FormControl size="small" sx={{ minWidth: 180 }}><InputLabel id="diagnostic-transformation-label">{uiText('transformation')}</InputLabel><Select labelId="diagnostic-transformation-label" label={uiText('transformation')} value={transformed} onChange={event => onTransformed(event.target.value)}><MenuItem value="all">{uiText('all')}</MenuItem><MenuItem value="yes">{uiText('transformedRecords')}</MenuItem><MenuItem value="no">{uiText('untransformed')}</MenuItem></Select></FormControl><FormControl size="small" sx={{ minWidth: 240 }}><InputLabel id="diagnostic-failedRule-label">{uiText('failedRule')}</InputLabel><Select labelId="diagnostic-failedRule-label" label={uiText('failedRule')} value={rule} onChange={event => onRule(event.target.value)}><MenuItem value="">{uiText('allRules')}</MenuItem>{rules.map(item => <MenuItem key={item.ruleId} value={String(item.ruleId)}>{item.name}</MenuItem>)}</Select></FormControl><Tooltip title={uiText('resetFilters')}><IconButton onClick={onReset}><RestartAltIcon /></IconButton></Tooltip></Stack></Paper>
}

function Summary({ summary }: { summary: { size: number; validSize: number; transformedSize: number } }) {
  const invalid = Math.max(0, summary.size - summary.validSize)
  return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>{[[uiText('records'), summary.size, 'primary'], [uiText('validRecords'), summary.validSize, 'success'], [uiText('invalidRecords'), invalid, 'error'], [uiText('transformedRecords'), summary.transformedSize, 'warning']].map(([label, value, color]) => <Paper key={String(label)} variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h4" color={`${color}.main`}>{value}</Typography>{color === 'success' && <LinearProgress color="success" variant="determinate" value={summary.size ? summary.validSize * 100 / summary.size : 0} sx={{ mt: 1 }} />}</Paper>)}</Stack>
}

function Rules({ rules, total, onSelect }: { rules: DiagnosticRule[]; total: number; onSelect: (rule: DiagnosticRule) => void }) {
  const [sort, setSort] = useState('mandatory')
  const orderedRules = [...rules].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'quantifier' ? (a.quantifier || '').localeCompare(b.quantifier || '') : Number(Boolean(b.mandatory)) - Number(Boolean(a.mandatory)))
  return <Paper variant="outlined" sx={{ overflow: 'hidden' }}><Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}><Typography fontWeight={750}>{uiText('ruleCompliance')}</Typography><FormControl size="small" sx={{ minWidth: 210 }}><InputLabel id="diagnostic-sortRules-label">{uiText('sortRules')}</InputLabel><Select labelId="diagnostic-sortRules-label" label={uiText('sortRules')} value={sort} onChange={event => setSort(event.target.value)}><MenuItem value="mandatory">{uiText('mandatoryFirst')}</MenuItem><MenuItem value="quantifier">{uiText('byQuantifier')}</MenuItem><MenuItem value="name">{uiText('byName')}</MenuItem></Select></FormControl></Box><Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>{uiText('rule')}</TableCell><TableCell>{uiText('type')}</TableCell><TableCell align="right">{uiText('validRecords')}</TableCell><TableCell align="right">{uiText('failures')}</TableCell><TableCell align="right">{uiText('success')}</TableCell><TableCell align="right">{uiText('failure')}</TableCell><TableCell /></TableRow></TableHead><TableBody>{orderedRules.map(rule => { const valid = rule.validCount; const invalid = rule.invalidCount; return <TableRow key={rule.ruleId} hover><TableCell><Typography fontWeight={700}>{rule.name}</Typography><Typography variant="caption" color="text.secondary">{rule.description || uiText('noDescription')}</Typography></TableCell><TableCell>{rule.mandatory ? <Chip size="small" color="warning" label={uiText('mandatory')} /> : rule.mandatory === false ? uiText('optional') : uiText('unknownMandatory')}</TableCell><TableCell align="right">{valid ?? '—'}</TableCell><TableCell align="right"><Typography color={invalid !== null && invalid > 0 ? 'error.main' : 'text.primary'}>{invalid ?? '—'}</Typography></TableCell><TableCell align="right">{total && valid !== null ? `${(valid * 100 / total).toFixed(1)}%` : '—'}</TableCell><TableCell align="right">{total && invalid !== null ? `${(invalid * 100 / total).toFixed(1)}%` : '—'}</TableCell><TableCell align="right"><Button size="small" onClick={() => onSelect(rule)}>{uiText('occurrences')}</Button></TableCell></TableRow> })}</TableBody></Table></Box></Paper>
}

function Records({ records, loading, onSelect }: { records: DiagnosticRecord[]; loading: boolean; onSelect: (record: DiagnosticRecord) => void }) {
  return <Paper variant="outlined" sx={{ overflow: 'hidden' }}><Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}><Typography fontWeight={750}>{uiText('records')}</Typography></Box>{loading ? <LinearProgress /> : <Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>{uiText('identifier')}</TableCell><TableCell>{uiText('status')}</TableCell><TableCell>{uiText('transformation')}</TableCell><TableCell>{uiText('failedRules')}</TableCell><TableCell /></TableRow></TableHead><TableBody>{records.map(record => <TableRow key={record.id} hover><TableCell sx={{ maxWidth: 520, wordBreak: 'break-all' }}>{record.identifier}</TableCell><TableCell><Chip size="small" color={record.valid === null ? 'default' : record.valid ? 'success' : 'error'} label={record.valid === null ? uiText('unevaluated') : record.valid ? uiText('validated') : uiText('invalid')} /></TableCell><TableCell>{record.transformed ? <Chip size="small" color="warning" label={uiText('transformed')} /> : '—'}</TableCell><TableCell>{record.invalidRuleIds.length}</TableCell><TableCell align="right"><Button size="small" startIcon={<DescriptionOutlinedIcon />} onClick={() => onSelect(record)}>{uiText('detail')}</Button></TableCell></TableRow>)}{records.length === 0 && <TableRow><TableCell colSpan={5} align="center">{uiText('noFilteredRecords')}</TableCell></TableRow>}</TableBody></Table></Box>}</Paper>
}

function RecordDialog({ client, record, rules, onClose }: { client: ApiClient; record: DiagnosticRecord | null; rules: DiagnosticRule[]; onClose: () => void }) {
  const [xmlSearch, setXmlSearch] = useState('')
  const [tab, setTab] = useState<'validation' | 'xml'>('validation')
  const xml = useQuery({ enabled: Boolean(record) && tab === 'xml', queryKey: ['diagnostic-metadata', record?.snapshotId, record?.identifier], queryFn: () => client.diagnosticMetadata(record!.snapshotId, record!.identifier) })
  const recordStatus = record?.valid === null ? uiText('unevaluated') : record?.valid ? uiText('validated') : uiText('invalid')
  const oaiUrl = record?.origin && record.metadataPrefix ? `${record.origin}${record.origin.includes('?') ? '&' : '?'}verb=GetRecord&metadataPrefix=${encodeURIComponent(record.metadataPrefix)}&identifier=${encodeURIComponent(record.identifier)}` : null
  return <Dialog open={Boolean(record)} onClose={onClose} fullWidth maxWidth="lg" PaperProps={{ sx: { borderRadius: 3 } }}><DialogTitle sx={{ pb: 1 }}>{uiText('validationDetails')}</DialogTitle><DialogContent dividers>{record && <Stack spacing={2.25}><Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50', borderColor: 'primary.100' }}><Stack spacing={1.5}><Box><Typography variant="overline" color="text.secondary" fontWeight={800}>{uiText('oaiIdentifier')}</Typography><Typography sx={{ wordBreak: 'break-all' }} fontWeight={700}>{record.identifier}</Typography></Box><Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Chip color={record.valid === null ? 'default' : record.valid ? 'success' : 'error'} label={recordStatus} />{record.transformed && <Chip color="warning" label={uiText('transformed')} />}{record.setSpec && <Chip variant="outlined" label={`Set: ${record.setSpec}`} />}{record.metadataPrefix && <Chip variant="outlined" label={record.metadataPrefix} />}</Stack><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '120px minmax(0, 1fr) auto' }, gap: 1, alignItems: 'center', pt: .5 }}><Typography variant="caption" color="text.secondary">{uiText('internalId')}</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{record.id}</Typography>{oaiUrl && <Button component="a" href={oaiUrl} target="_blank" rel="noreferrer" size="small" variant="contained" startIcon={<OpenInNewOutlinedIcon />}>{uiText('openOai')}</Button>}{record.origin && <><Typography variant="caption" color="text.secondary">{uiText('origin')}</Typography><Typography variant="body2" sx={{ wordBreak: 'break-all', gridColumn: { sm: 'span 2' } }}>{record.origin}</Typography></>}</Box></Stack></Paper><Tabs value={tab} onChange={(_, value: 'validation' | 'xml') => setTab(value)} sx={{ borderBottom: 1, borderColor: 'divider' }}><Tab value="validation" label={uiText('validationCount', { count: record.validRuleIds.length + record.invalidRuleIds.length })} /><Tab value="xml" label={uiText('transformedXml')} /></Tabs>{tab === 'validation' && <ValidationDetails record={record} rules={rules} />}{tab === 'xml' && <Stack spacing={1.25}>{xml.isLoading ? <CircularProgress size={22} /> : xml.isError ? <Alert severity="warning">{uiText('xmlUnavailable')}</Alert> : <><TextField size="small" label={uiText('searchXml')} value={xmlSearch} onChange={event => setXmlSearch(event.target.value)} /><XmlCode xml={xml.data || ''} search={xmlSearch} /></>}</Stack>}</Stack>}</DialogContent><DialogActions sx={{ px: 3, py: 1.5 }}>{tab === 'xml' && xml.data && <><Tooltip title={uiText('copyXml')}><IconButton onClick={() => void navigator.clipboard.writeText(xml.data)}><ContentCopyOutlinedIcon /></IconButton></Tooltip><Button startIcon={<DownloadOutlinedIcon />} onClick={() => { const blob = new Blob([xml.data!], { type: 'application/xml' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${record?.identifier || 'metadata'}.xml`; anchor.click(); URL.revokeObjectURL(url) }}>{uiText('downloadXml')}</Button></>}<Button onClick={onClose}>{uiText('close')}</Button></DialogActions></Dialog>
}

function ValidationDetails({ record, rules }: { record: DiagnosticRecord; rules: DiagnosticRule[] }) {
  const { t } = useTranslation()
  const byId = new Map(rules.map(rule => [String(rule.ruleId), rule]))
  const renderRule = (id: string, valid: boolean) => { const rule = byId.get(id); const validOccurrences = record.validOccurrencesByRuleId[id] || []; const invalidOccurrences = record.invalidOccurrencesByRuleId[id] || []; const accent = valid ? 'success.main' : rule?.mandatory ? 'error.main' : 'warning.main'; return <Paper key={`${valid ? 'valid' : 'invalid'}-${id}`} variant="outlined" sx={{ p: 1.75, borderLeft: 4, borderLeftColor: accent, bgcolor: valid ? 'success.50' : rule?.mandatory ? 'error.50' : 'warning.50' }}><Stack spacing={1}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Box><Typography fontWeight={750}>{rule?.name || uiText('ruleNumber', { id })}</Typography>{rule?.description && <Typography variant="body2" color="text.secondary">{rule.description}</Typography>}</Box><Chip size="small" color={valid ? 'success' : rule?.mandatory ? 'error' : 'warning'} label={valid ? uiText('approved') : rule?.mandatory ? uiText('mandatoryFailed') : rule?.mandatory === false ? uiText('optionalFailed') : uiText('failedRule')} /></Stack><Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap"><Chip size="small" variant="outlined" label={rule?.mandatory ? uiText('mandatory') : rule?.mandatory === false ? uiText('optional') : uiText('unknownMandatory')} /><Chip size="small" variant="outlined" label={uiText('quantifierValue', { value: rule?.quantifier ? t(`configurationEditor.quantifiers.${rule.quantifier}`, { defaultValue: rule.quantifier }) : '—' })} /></Stack>{!validOccurrences.length && !invalidOccurrences.length && <Typography variant="body2">{emptyValuesMessage(rule)}</Typography>}{validOccurrences.length > 0 && <OccurrenceValues title={uiText('validOccurrences')} values={validOccurrences} color="success.main" symbol="✓" />}{invalidOccurrences.length > 0 && <OccurrenceValues title={uiText('invalidOccurrences')} values={invalidOccurrences} color="error.main" symbol="⚠" />}</Stack></Paper> }
  if (record.validRuleIds.length + record.invalidRuleIds.length === 0) return <Alert severity="info">{uiText('noRuleDetails')}</Alert>
  return <Stack spacing={1.25}>{record.invalidRuleIds.map(id => renderRule(id, false))}{record.validRuleIds.map(id => renderRule(id, true))}</Stack>
}

function occurrenceLabel(value: string) {
  return value === 'no_occurrences_found' ? uiText('missingField') : value
}

function emptyValuesMessage(rule?: DiagnosticRule | null) {
  if (rule?.occurrenceCaptureEnabled === false) return uiText('captureDisabled')
  if (rule?.occurrenceCaptureEnabled === true) return uiText('noOccurrences')
  return uiText('captureUnknown')
}

function OccurrenceValues({ title, values, color, symbol }: { title: string; values: string[]; color: string; symbol: string }) { return <Box sx={{ px: 1.25, py: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.6)' }}><Typography variant="caption" fontWeight={800} color={color}>{title}</Typography>{values.map((value, index) => <Typography key={`${title}-${index}`} variant="body2" sx={{ mt: .35, wordBreak: 'break-word' }}>{symbol} {occurrenceLabel(value)}</Typography>)}</Box> }

function XmlCode({ xml, search }: { xml: string; search: string }) {
  const lines = formatXml(xml).split('\n')
  const needle = search.trim().toLocaleLowerCase()
  return <Box component="pre" sx={{ m: 0, p: 2.25, overflow: 'auto', maxHeight: 450, bgcolor: '#10263a', color: '#e8f0f5', borderRadius: 2, fontSize: 12, lineHeight: 1.65, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{lines.map((line, index) => <Box component="span" key={index} sx={{ display: 'block', borderRadius: .5, px: .5, mx: -.5, bgcolor: needle && line.toLocaleLowerCase().includes(needle) ? 'rgba(250, 204, 21, .25)' : 'transparent' }}>{highlightXmlLine(line)}</Box>)}</Box>
}

function highlightXmlLine(line: string) { return line.split(/(<[^>]+>)/g).map((part, index) => part.startsWith('</') ? <Box component="span" key={index} sx={{ color: '#93c5fd' }}>{part}</Box> : part.startsWith('<') ? <Box component="span" key={index} sx={{ color: '#7dd3fc' }}>{part}</Box> : <Box component="span" key={index} sx={{ color: '#e5edf3' }}>{part}</Box>) }
function formatXml(xml: string) { let padding = 0; return xml.replace(/>\s*</g, '><').replace(/(>)(<)(\/?)/g, '$1\n$2$3').split('\n').map(line => { if (line.match(/^<\//)) padding = Math.max(0, padding - 1); const value = `${'  '.repeat(padding)}${line}`; if (line.match(/^<[^!?/][^>]*[^/]>/) && !line.includes('</')) padding++; return value }).join('\n') }

function OccurrencesDialog({ client, snapshotId, rule, filters, onClose }: { client: ApiClient; snapshotId: number; rule: DiagnosticRule | null; filters: DiagnosticFilter[]; onClose: () => void }) {
  const query = useQuery({ enabled: Boolean(rule) && rule?.occurrenceCaptureEnabled !== false, queryKey: queryKeys.diagnosticOccurrences(snapshotId, rule?.ruleId || 0, JSON.stringify(filters)), queryFn: () => client.diagnosticOccurrences(snapshotId, rule!.ruleId, filters) })
  return <Dialog open={Boolean(rule)} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>{uiText('occurrencesTitle')} {rule?.name}</DialogTitle><DialogContent dividers>{query.isLoading ? <CircularProgress /> : query.isError ? <Alert severity="warning">{uiText('occurrenceReadError')}</Alert> : !query.data?.valid.length && !query.data?.invalid.length ? <Alert severity="info">{emptyValuesMessage(rule)}</Alert> : <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}><OccurrenceList title={uiText('validValues')} items={query.data?.valid || []} /><OccurrenceList title={uiText('invalidValues')} items={query.data?.invalid || []} /></Stack>}</DialogContent><DialogActions><Button onClick={onClose}>{uiText('close')}</Button></DialogActions></Dialog>
}

function OccurrenceList({ title, items }: { title: string; items: Array<{ value: string; count: number }> }) { return <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>{items.length ? <Table size="small"><TableHead><TableRow><TableCell>{uiText('value')}</TableCell><TableCell align="right">{uiText('count')}</TableCell></TableRow></TableHead><TableBody>{items.map(item => <TableRow key={item.value}><TableCell sx={{ wordBreak: 'break-word' }}>{occurrenceLabel(item.value)}</TableCell><TableCell align="right">{item.count}</TableCell></TableRow>)}</TableBody></Table> : <Typography color="text.secondary">{uiText('noOccurrences')}</Typography>}</Box> }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat(uiLocale(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : uiText('noDate') }
function snapshotStatusLabel(status?: string) { return status ? i18n.t(`ui.${status}`, { defaultValue: status }) : '—' }
