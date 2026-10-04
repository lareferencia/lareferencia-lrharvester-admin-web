import { Autocomplete, TextField } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ApiClient } from '../../api/client'
export function NetworkTagsField({ client, value, onChange }: { client: ApiClient; value: string[]; onChange: (tags: string[]) => void }) {
  const { t } = useTranslation()
  const query = useQuery({ queryKey: ['network-tags'], queryFn: () => client.networkTags() })
  return <Autocomplete multiple freeSolo autoSelect openOnFocus filterSelectedOptions handleHomeEndKeys options={query.data || []} value={value}
    onChange={(_, next) => onChange([...new Set(next.map(tag => tag.trim().normalize('NFC').toLowerCase()).filter(Boolean))])}
    renderInput={params => <TextField {...params} label={t('networks.tags')} helperText={query.isError ? t('networks.tagsLoadError') : t('networks.tagsHelp')} />} />
}
