import { useState } from 'react'
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, List, ListItemButton, ListItemIcon, ListItemText, Paper, Stack, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { NetworkGrant } from '../../api/types'

type Props = {
  repositories: NetworkGrant[]
  assignedRepositories: NetworkGrant[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  loading: boolean
  loadError: boolean
  onRetry: () => void
  disabled: boolean
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()

export function RepositoryAccessPicker({ repositories, assignedRepositories, selectedIds, onChange, loading, loadError, onRetry, disabled }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [assignedOnly, setAssignedOnly] = useState(false)
  // Keep existing grants visible even when a repository is absent from the inventory.
  const inventory = new Map([...assignedRepositories, ...repositories].map(repository => [repository.id, repository]))
  const options = [...inventory.values()].sort((a, b) => a.acronym.localeCompare(b.acronym) || a.name.localeCompare(b.name))
  const selected = new Set(selectedIds)
  const query = normalize(search)
  const visible = options.filter(repository => (!assignedOnly || selected.has(repository.id)) && normalize(`${repository.acronym} ${repository.name}`).includes(query))
  const toggle = (id: number) => onChange(selected.has(id) ? selectedIds.filter(value => value !== id) : [...selectedIds, id])

  return <Stack spacing={1.5}>
    <Typography variant="subtitle1">{t('users.repositories')}</Typography>
    <TextField fullWidth size="small" label={t('users.repositorySearch')} value={search} onChange={event => setSearch(event.target.value)} />
    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap">
      <FormControlLabel control={<Checkbox checked={assignedOnly} onChange={event => setAssignedOnly(event.target.checked)} />} label={t('users.assignedOnly')} />
      <Typography variant="body2" aria-live="polite">{t('users.selectedRepositories', { count: selectedIds.length })}</Typography>
    </Stack>
    {loading && <Typography role="status">{t('common.loading')}</Typography>}
    {loadError && <Alert severity="error" action={<Button onClick={onRetry}>{t('users.retryRepositories')}</Button>}>{t('users.repositoriesLoadError')}</Alert>}
    <Paper variant="outlined" sx={{ maxHeight: 280, overflow: 'auto' }}>
      <List dense aria-label={t('users.repositories')}>
        {visible.map(repository => <ListItemButton key={repository.id} disabled={disabled || loading || loadError} onClick={() => toggle(repository.id)} role="checkbox" aria-checked={selected.has(repository.id)} aria-label={`${repository.acronym} — ${repository.name}`}>
          <ListItemIcon sx={{ minWidth: 36 }}><Checkbox checked={selected.has(repository.id)} tabIndex={-1} disableRipple inputProps={{ 'aria-hidden': true }} sx={{ pointerEvents: 'none' }} /></ListItemIcon>
          <ListItemText primary={repository.acronym} secondary={repository.name} />
        </ListItemButton>)}
        {!loading && !loadError && visible.length === 0 && <Typography color="text.secondary" sx={{ p: 2 }}>{t('users.noRepositoriesMatch')}</Typography>}
      </List>
    </Paper>
    <Typography variant="body2" color="text.secondary">{t('users.repositorySelectionHelp')}</Typography>
    {selectedIds.length > 0 && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {selectedIds.map(id => <Chip key={id} label={inventory.get(id)?.acronym ?? String(id)} title={inventory.get(id)?.name} onDelete={disabled || loading || loadError ? undefined : () => toggle(id)} />)}
    </Box>}
  </Stack>
}
