import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton, InputAdornment, InputLabel, LinearProgress, MenuItem, Pagination, Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '../../api/client'
import type { DiagnosticFilter, DiagnosticRecord, DiagnosticRule } from '../../api/types'
import { queryKeys } from '../../api/query-keys'

export function DiagnosticsPage({ client, networkId }: { client: ApiClient; networkId: number }) {
  const [params, setParams] = useSearchParams()
  const [identifier, setIdentifier] = useState(params.get('identifier') || '')
  const [validity, setValidity] = useState(params.get('validity') || 'all')
  const [transformed, setTransformed] = useState(params.get('transformed') || 'all')
  const [rule, setRule] = useState(params.get('rule') || '')
  const [page, setPage] = useState(Number(params.get('page') || '0'))
  const [selectedRecord, setSelectedRecord] = useState<DiagnosticRecord | null>(null)
  const [selectedRule, setSelectedRule] = useState<DiagnosticRule | null>(null)
  const snapshots = useQuery({ queryKey: queryKeys.networkSnapshots(networkId), queryFn: () => client.networkSnapshots(networkId) })
  const network = useQuery({ queryKey: queryKeys.network(networkId), queryFn: () => client.network(networkId) })
  const requestedSnapshot = Number(params.get('snapshot') || '')
  const snapshotId = requestedSnapshot || snapshots.data?.items.find(item => item.status === 'VALID' && !item.deleted)?.id || 0
  const filters = useMemo<DiagnosticFilter[]>(() => [
    ...(identifier.trim() ? [{ field: 'IDENTIFIER' as const, operator: 'CONTAINS' as const, value: identifier.trim() }] : []),
    ...(validity === 'all' ? [] : [{ field: 'VALID' as const, operator: 'EQ' as const, value: validity === 'valid' }]),
    ...(transformed === 'all' ? [] : [{ field: 'TRANSFORMED' as const, operator: 'EQ' as const, value: transformed === 'yes' }]),
    ...(rule ? [{ field: 'RULE_INVALID' as const, operator: 'EQ' as const, value: Number(rule) }] : []),
  ], [identifier, validity, transformed, rule])
  const filterKey = JSON.stringify(filters)
  const summary = useQuery({ enabled: Boolean(snapshotId), queryKey: queryKeys.diagnosticSummary(snapshotId, filterKey), queryFn: () => client.diagnosticSummary(snapshotId, filters) })
  const records = useQuery({ enabled: Boolean(snapshotId), queryKey: queryKeys.diagnosticRecords(snapshotId, `${filterKey}:${page}`), queryFn: () => client.diagnosticRecords(snapshotId, { filters, page, size: 25 }) })
  const selectSnapshot = (id: number) => { setPage(0); setParams(previous => { previous.set('snapshot', String(id)); previous.delete('page'); return previous }) }
  const reset = () => { setIdentifier(''); setValidity('all'); setTransformed('all'); setRule(''); setPage(0); setParams({ snapshot: String(snapshotId) }) }
  const updatePage = (next: number) => { setPage(next); setParams(previous => { previous.set('snapshot', String(snapshotId)); previous.set('page', String(next)); return previous }) }

  if (snapshots.isLoading || network.isLoading) return <CircularProgress />
  if (snapshots.isError || network.isError) return <Alert severity="error">No se pudo cargar el diagnóstico de la fuente.</Alert>
  if (!snapshotId) return <Stack spacing={2}><Alert severity="info">Esta fuente todavía no tiene un snapshot válido con información de diagnóstico.</Alert><Button component={Link} to="/networks">Volver a fuentes</Button></Stack>

  const currentSnapshot = snapshots.data?.items.find(item => item.id === snapshotId)
  return <Stack spacing={2.5}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ md: 'center' }}>
      <Box><Typography variant="overline" color="text.secondary" fontWeight={800}>Diagnóstico de fuente</Typography><Typography variant="h4">{network.data?.acronym}</Typography><Typography color="text.secondary">{network.data?.name} · snapshot #{snapshotId}</Typography></Box>
      <Button component={Link} to={`/networks/${networkId}`} variant="outlined">Volver al detalle</Button>
    </Stack>
    <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}><FormControl size="small" sx={{ minWidth: 320 }}><InputLabel>Snapshot</InputLabel><Select label="Snapshot" value={snapshotId} onChange={event => selectSnapshot(Number(event.target.value))}>{snapshots.data?.items.filter(item => !item.deleted).map(item => <MenuItem key={item.id} value={item.id}>#{item.id} · {item.status} · {formatDate(item.endTime || item.startTime)}</MenuItem>)}</Select></FormControl><Chip label={currentSnapshot?.status || '—'} color={currentSnapshot?.status === 'VALID' ? 'success' : 'default'} /><Typography variant="body2" color="text.secondary">Los filtros afectan el resumen, las reglas y los registros.</Typography></Stack></Paper>
    {summary.isLoading ? <LinearProgress /> : summary.isError ? <Alert severity="warning">No se pudo leer el resumen. Puede que este snapshot no tenga información de validación disponible.</Alert> : summary.data && <Summary summary={summary.data} />}
    <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} alignItems={{ lg: 'center' }}><TextField size="small" label="Buscar identificador" value={identifier} onChange={event => { setIdentifier(event.target.value); setPage(0) }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ minWidth: { lg: 280 } }} /><FormControl size="small" sx={{ minWidth: 155 }}><InputLabel>Validez</InputLabel><Select label="Validez" value={validity} onChange={event => { setValidity(event.target.value); setPage(0) }}><MenuItem value="all">Todos</MenuItem><MenuItem value="valid">Válidos</MenuItem><MenuItem value="invalid">Inválidos</MenuItem></Select></FormControl><FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Transformación</InputLabel><Select label="Transformación" value={transformed} onChange={event => { setTransformed(event.target.value); setPage(0) }}><MenuItem value="all">Todos</MenuItem><MenuItem value="yes">Transformados</MenuItem><MenuItem value="no">Sin transformar</MenuItem></Select></FormControl><FormControl size="small" sx={{ minWidth: 240 }}><InputLabel>Regla fallida</InputLabel><Select label="Regla fallida" value={rule} onChange={event => { setRule(event.target.value); setPage(0) }}><MenuItem value="">Todas</MenuItem>{summary.data?.rules.map(item => <MenuItem key={item.ruleId} value={String(item.ruleId)}>{item.name}</MenuItem>)}</Select></FormControl><Tooltip title="Restablecer filtros"><IconButton onClick={reset}><RestartAltIcon /></IconButton></Tooltip></Stack></Paper>
    {summary.data && <Rules rules={summary.data.rules} total={summary.data.size} onSelect={setSelectedRule} />}
    <Records records={records.data?.items || []} loading={records.isLoading} onSelect={setSelectedRecord} />
    {records.data && <Pagination page={page + 1} count={Math.max(records.data.totalPages, 1)} onChange={(_, value) => updatePage(value - 1)} />}
    <RecordDialog client={client} record={selectedRecord} onClose={() => setSelectedRecord(null)} rules={summary.data?.rules || []} />
    <OccurrencesDialog client={client} snapshotId={snapshotId} rule={selectedRule} filters={filters} onClose={() => setSelectedRule(null)} />
  </Stack>
}

function Summary({ summary }: { summary: { size: number; validSize: number; transformedSize: number } }) {
  const invalid = Math.max(0, summary.size - summary.validSize)
  return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>{[['Registros', summary.size, 'primary'], ['Válidos', summary.validSize, 'success'], ['Inválidos', invalid, 'error'], ['Transformados', summary.transformedSize, 'warning']].map(([label, value, color]) => <Paper key={String(label)} variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h4" color={`${color}.main`}>{value}</Typography>{label === 'Válidos' && <LinearProgress color="success" variant="determinate" value={summary.size ? summary.validSize * 100 / summary.size : 0} sx={{ mt: 1 }} />}</Paper>)}</Stack>
}

function Rules({ rules, total, onSelect }: { rules: DiagnosticRule[]; total: number; onSelect: (rule: DiagnosticRule) => void }) {
  return <Paper variant="outlined" sx={{ overflow: 'hidden' }}><Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}><Typography fontWeight={750}>Cumplimiento de reglas</Typography></Box><Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>Regla</TableCell><TableCell>Tipo</TableCell><TableCell align="right">Válidos</TableCell><TableCell align="right">Fallos</TableCell><TableCell align="right">Cumplimiento</TableCell><TableCell /></TableRow></TableHead><TableBody>{rules.map(rule => { const valid = rule.validCount || 0; return <TableRow key={rule.ruleId} hover><TableCell><Typography fontWeight={700}>{rule.name}</Typography><Typography variant="caption" color="text.secondary">{rule.description || 'Sin descripción'}</Typography></TableCell><TableCell>{rule.mandatory ? <Chip size="small" color="warning" label="Obligatoria" /> : 'Opcional'}</TableCell><TableCell align="right">{valid}</TableCell><TableCell align="right"><Typography color={(rule.invalidCount || 0) > 0 ? 'error.main' : 'text.primary'}>{rule.invalidCount || 0}</Typography></TableCell><TableCell align="right">{total ? `${(valid * 100 / total).toFixed(1)}%` : '—'}</TableCell><TableCell align="right"><Button size="small" onClick={() => onSelect(rule)}>Ocurrencias</Button></TableCell></TableRow> })}</TableBody></Table></Box></Paper>
}

function Records({ records, loading, onSelect }: { records: DiagnosticRecord[]; loading: boolean; onSelect: (record: DiagnosticRecord) => void }) {
  return <Paper variant="outlined" sx={{ overflow: 'hidden' }}><Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}><Typography fontWeight={750}>Registros</Typography></Box>{loading ? <LinearProgress /> : <Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>Identificador</TableCell><TableCell>Estado</TableCell><TableCell>Transformación</TableCell><TableCell>Reglas fallidas</TableCell><TableCell /></TableRow></TableHead><TableBody>{records.map(record => <TableRow key={record.id} hover><TableCell sx={{ maxWidth: 520, wordBreak: 'break-all' }}>{record.identifier}</TableCell><TableCell><Chip size="small" color={record.valid ? 'success' : 'error'} label={record.valid ? 'Válido' : 'Inválido'} /></TableCell><TableCell>{record.transformed ? <Chip size="small" color="warning" label="Transformado" /> : '—'}</TableCell><TableCell>{record.invalidRuleIds.length}</TableCell><TableCell align="right"><Button size="small" startIcon={<DescriptionOutlinedIcon />} onClick={() => onSelect(record)}>Detalle</Button></TableCell></TableRow>)}{records.length === 0 && <TableRow><TableCell colSpan={5} align="center">No hay registros para estos filtros.</TableCell></TableRow>}</TableBody></Table></Box>}</Paper>
}

function RecordDialog({ client, record, rules, onClose }: { client: ApiClient; record: DiagnosticRecord | null; rules: DiagnosticRule[]; onClose: () => void }) {
  const xml = useQuery({ enabled: Boolean(record), queryKey: ['diagnostic-metadata', record?.snapshotId, record?.identifier], queryFn: () => client.diagnosticMetadata(record!.snapshotId, record!.identifier) })
  const ruleName = (id: string) => rules.find(rule => String(rule.ruleId) === id)?.name || `Regla #${id}`
  return <Dialog open={Boolean(record)} onClose={onClose} fullWidth maxWidth="lg"><DialogTitle>Detalle de validación</DialogTitle><DialogContent dividers>{record && <Stack spacing={2}><Typography sx={{ wordBreak: 'break-all' }}>{record.identifier}</Typography><Stack direction="row" spacing={1}><Chip color={record.valid ? 'success' : 'error'} label={record.valid ? 'Válido' : 'Inválido'} />{record.transformed && <Chip color="warning" label="Transformado" />}</Stack><Divider /><Typography fontWeight={700}>Reglas con fallo</Typography>{record.invalidRuleIds.length ? record.invalidRuleIds.map(id => <Alert key={id} severity="error">{ruleName(id)}</Alert>) : <Typography color="text.secondary">No hay reglas fallidas.</Typography>}<Typography fontWeight={700}>XML publicado</Typography>{xml.isLoading ? <CircularProgress size={22} /> : xml.isError ? <Alert severity="warning">El XML no está disponible para este registro.</Alert> : <Box component="pre" sx={{ m: 0, p: 2, overflow: 'auto', maxHeight: 360, bgcolor: 'grey.100', borderRadius: 1, fontSize: 12 }}>{xml.data}</Box>}</Stack>}</DialogContent><DialogActions>{xml.data && <Tooltip title="Copiar XML"><IconButton onClick={() => void navigator.clipboard.writeText(xml.data)}><ContentCopyOutlinedIcon /></IconButton></Tooltip>}<Button onClick={onClose}>Cerrar</Button></DialogActions></Dialog>
}

function OccurrencesDialog({ client, snapshotId, rule, filters, onClose }: { client: ApiClient; snapshotId: number; rule: DiagnosticRule | null; filters: DiagnosticFilter[]; onClose: () => void }) {
  const query = useQuery({ enabled: Boolean(rule), queryKey: queryKeys.diagnosticOccurrences(snapshotId, rule?.ruleId || 0, JSON.stringify(filters)), queryFn: () => client.diagnosticOccurrences(snapshotId, rule!.ruleId, filters) })
  return <Dialog open={Boolean(rule)} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>Ocurrencias: {rule?.name}</DialogTitle><DialogContent dividers>{query.isLoading ? <CircularProgress /> : query.isError ? <Alert severity="warning">No hay ocurrencias detalladas disponibles para esta regla. Se registran únicamente cuando el diagnóstico detallado estaba activado al validar el snapshot.</Alert> : <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}><OccurrenceList title="Válidas" items={query.data?.valid || []} /><OccurrenceList title="Inválidas" items={query.data?.invalid || []} /></Stack>}</DialogContent><DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions></Dialog>
}

function OccurrenceList({ title, items }: { title: string; items: Array<{ value: string; count: number }> }) { return <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>{items.length ? <Table size="small"><TableHead><TableRow><TableCell>Valor</TableCell><TableCell align="right">Cantidad</TableCell></TableRow></TableHead><TableBody>{items.map(item => <TableRow key={item.value}><TableCell sx={{ wordBreak: 'break-word' }}>{item.value}</TableCell><TableCell align="right">{item.count}</TableCell></TableRow>)}</TableBody></Table> : <Typography color="text.secondary">Sin ocurrencias.</Typography>}</Box> }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Sin fecha' }
