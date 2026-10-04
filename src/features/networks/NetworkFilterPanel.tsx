import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Alert, Autocomplete, Button, Chip, Collapse, InputAdornment, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import FilterListIcon from '@mui/icons-material/FilterList'
import type { ApiClient } from '../../api/client'

const sortFields = ['acronym', 'tags', 'latestSnapshot', 'lastValidSnapshot', 'snapshotStatus', 'indexStatus', 'attention', 'name', 'institutionName', 'id', 'published']
const harvestStates = ['valid', 'error', 'running', 'stopped', 'finished', 'none', 'INITIALIZED', 'INDEXING', 'INDEXING_FINISHED_ERROR', 'INDEXING_FINISHED_VALID', 'UNKNOWN', 'EMPTY_INCREMENTAL']
const indexStates = ['INDEXED', 'FAILED', 'UNKNOWN']
const filterKeys = ['q', 'tag', 'tagMode', 'acronym', 'name', 'institutionName', 'published', 'snapshotStatus', 'indexStatus', 'harvestState', 'indexState', 'validHarvest', 'indexer', 'failuresOnly']
type Changes = Record<string, string[]>

export function NetworkFilterPanel({ client, params, onChange }: { client: ApiClient; params: URLSearchParams; onChange: (changes: Changes) => void }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(() => ['acronym', 'harvestState', 'indexState', 'validHarvest', 'indexer', 'snapshotStatus', 'indexStatus'].some(key => params.has(key)))
  const tags = useQuery({ queryKey: ['network-tags'], queryFn: () => client.networkTags() })
  const indexers = useQuery({ queryKey: ['network-indexers'], queryFn: () => client.networkIndexers(), staleTime: 60_000 })
  const [sort = 'acronym', direction = 'asc'] = (params.get('sort') || 'acronym,asc').split(',')
  const set = (key: string, values: string[]) => onChange({ [key]: values })
  const failures = params.get('failuresOnly') === 'true'
  const tagMode = params.get('tagMode') === 'any' ? 'any' : 'all'
  const clear = () => onChange(Object.fromEntries([...filterKeys.map(key => [key, []]), ['sort', ['acronym,asc']]]))
  const active = filterKeys.flatMap(key => params.getAll(key).filter(value => value && !(key === 'failuresOnly' && value !== 'true') && !(key === 'tagMode' && params.getAll('tag').length < 2)).map(value => ({ key, value })))
  const label = (key: string, value: string) => {
    if (key === 'failuresOnly') return t('networkFilters.failures')
    if (key === 'harvestState') return `${t('networkFilters.harvest')}: ${t(`networkFilters.harvests.${value}`, { defaultValue: value })}`
    if (key === 'indexState' || key === 'indexStatus') return `${t('networkFilters.indexing')}: ${t(`networkFilters.indexes.${value}`, { defaultValue: value })}`
    if (key === 'validHarvest') return t(`networkFilters.validities.${value}`, { defaultValue: value })
    if (key === 'indexer') return `${t('networkFilters.indexer')}: ${t(`actions.workerNames.${value}`, { defaultValue: value })}`
    if (key === 'tagMode') return t(value === 'any' ? 'networks.tagAny' : 'networks.tagAll')
    if (key === 'tag') return `${t('networks.tags')}: ${value}`
    if (key === 'acronym') return `${t('networks.acronym')}: ${value}`
    return `${key === 'q' ? t('common.search') : key}: ${value}`
  }
  return <Paper variant="outlined" sx={{ p: 1.5 }}><Stack spacing={1.5}>
    <Typography variant="subtitle2">{t('networkFilters.title')}</Typography>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
      <TextField size="small" placeholder={t('networks.search')} value={params.get('q') || ''} onChange={event => set('q', event.target.value ? [event.target.value] : [])} sx={{ flex: 1 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      <TextField size="small" select label={t('networkFilters.sort')} value={sort} onChange={event => set('sort', [`${event.target.value},${event.target.value === 'latestSnapshot' || event.target.value === 'lastValidSnapshot' ? 'desc' : 'asc'}`])} sx={{ minWidth: 210 }}>
        {sortFields.map(field => <MenuItem key={field} value={field}>{t(`networkFilters.sorts.${field}`)}</MenuItem>)}
      </TextField>
      <TextField size="small" select label={t('networkFilters.direction')} value={direction} onChange={event => set('sort', [`${sort},${event.target.value}`])} sx={{ minWidth: 140 }}>
        <MenuItem value="asc">{t('networkFilters.asc')}</MenuItem><MenuItem value="desc">{t('networkFilters.desc')}</MenuItem>
      </TextField>
    </Stack>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }}>
      <Autocomplete multiple size="small" options={tags.data || []} value={params.getAll('tag')} sx={{ flex: 1, minWidth: 180 }} onChange={(_, values) => set('tag', values)} renderInput={props => <TextField {...props} label={t('networks.tags')} helperText={tags.isError ? t('networks.tagsLoadError') : undefined} />} />
      {params.getAll('tag').length > 1 && <TextField size="small" select label={t('networks.tagMatch')} value={tagMode} onChange={event => set('tagMode', [event.target.value])}><MenuItem value="all">{t('networks.tagAll')}</MenuItem><MenuItem value="any">{t('networks.tagAny')}</MenuItem></TextField>}
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        <Button size="small" variant={failures ? 'contained' : 'outlined'} color="error" onClick={() => set('failuresOnly', failures ? [] : ['true'])}>{t('networkFilters.failures')}</Button>
        <Tooltip title={t('networkFilters.attentionHelp')}><Button size="small" variant={sort === 'attention' ? 'contained' : 'outlined'} onClick={() => set('sort', ['attention,asc'])}>{t('networkFilters.attention')}</Button></Tooltip>
        <Button size="small" startIcon={<FilterListIcon />} aria-expanded={expanded} aria-controls="network-advanced-filters" onClick={() => setExpanded(value => !value)}>{t(expanded ? 'networkFilters.less' : 'networkFilters.more')}</Button>
        <Button size="small" onClick={clear}>{t('networkFilters.clear')}</Button>
      </Stack>
    </Stack>
    {sort === 'tags' && <Typography variant="caption" color="text.secondary">{t('networkFilters.tagsSortHelp')}</Typography>}
    <Collapse in={expanded} id="network-advanced-filters">
      <Stack spacing={1.25}>
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1.25}>
          <TextField size="small" label={t('networks.acronym')} value={params.get('acronym') || ''} onChange={event => set('acronym', event.target.value ? [event.target.value] : [])} sx={{ flex: '1 1 140px' }} />
          <TextField size="small" select label={t('networkFilters.harvest')} value={params.getAll('harvestState')} SelectProps={{ multiple: true }} onChange={event => set('harvestState', typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)} sx={{ flex: '1 1 210px' }}>
            {harvestStates.map(value => <MenuItem key={value} value={value}>{t(`networkFilters.harvests.${value}`)}</MenuItem>)}
          </TextField>
          <TextField size="small" select label={t('networkFilters.indexing')} value={params.getAll('indexState')} SelectProps={{ multiple: true }} onChange={event => set('indexState', typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)} sx={{ flex: '1 1 140px' }}>
            {indexStates.map(value => <MenuItem key={value} value={value}>{t(`networkFilters.indexes.${value}`)}</MenuItem>)}
          </TextField>
          <TextField size="small" select label={t('networkFilters.valid')} value={params.get('validHarvest') || ''} onChange={event => set('validHarvest', event.target.value ? [event.target.value] : [])} sx={{ flex: '1 1 200px' }}>
            <MenuItem value="">{t('networkFilters.any')}</MenuItem>{['latest', 'previous', 'none', 'any'].map(value => <MenuItem key={value} value={value}>{t(`networkFilters.validities.${value}`)}</MenuItem>)}
          </TextField>
          <TextField size="small" select label={t('networkFilters.indexer')} value={params.get('indexer') || ''} onChange={event => set('indexer', event.target.value ? [event.target.value] : [])} helperText={indexers.isError ? t('networkFilters.indexersError') : undefined} sx={{ flex: '1 1 180px' }}>
            <MenuItem value="">{t('networkFilters.allIndexers')}</MenuItem>{[...new Set([...(indexers.data || []), ...(params.get('indexer') ? [params.get('indexer')!] : [])])].sort().map(value => <MenuItem key={value} value={value}>{t(`actions.workerNames.${value}`, { defaultValue: value })}</MenuItem>)}
          </TextField>
        </Stack>
        <Typography variant="caption" color="text.secondary">{t('networkFilters.scope')}</Typography>
      </Stack>
    </Collapse>
    {active.length > 0 && <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">{active.map(({ key, value }) => <Chip key={`${key}:${value}`} size="small" label={label(key, value)} onDelete={() => set(key, params.getAll(key).filter(item => item !== value))} />)}</Stack>}
  </Stack></Paper>
}
