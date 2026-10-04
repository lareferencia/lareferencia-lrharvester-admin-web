import { NetworkTagsField } from './NetworkTagsField'
import { uiText } from '../../i18n'
import SaveIcon from '@mui/icons-material/Save'
import { Alert, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ApiClient } from '../../api/client'
import { ApiError } from '../../api/problem-detail'
import { useTranslation } from 'react-i18next'
import { queryKeys } from '../../api/query-keys'

export function NetworkCreatePage({ client }: { client: ApiClient }) {
  const { t } = useTranslation(); const navigate = useNavigate(); const [form, setForm] = useState({ acronym: '', name: '', institutionName: '', institutionAcronym: '', originUrl: '' }); const [profileClass, setProfileClass] = useState('')
  const cache = useQueryClient()
  const [tags, setTags] = useState<string[]>([])
  const profiles = useQuery({ queryKey: queryKeys.attributeProfiles, queryFn: () => client.attributeProfiles() })
  useEffect(() => {
    if (profileClass || !profiles.data?.length) return
    const defaultProfile = profiles.data.find(profile => profile.typeId === 'lareferencia-repository') || profiles.data[0]
    setProfileClass(defaultProfile.className)
  }, [profileClass, profiles.data])
  const create = useMutation({ mutationFn: () => client.createNetwork({ ...form, tags, published: false, metadataPrefix: 'oai_dc', metadataStoreSchema: 'xoai', sets: [], attributes: profileClass ? { '@class': profileClass } : {}, properties: {}, scheduleCronExpression: null, prevalidatorId: null, validatorId: null, transformerId: null, secondaryTransformerId: null }), onSuccess: network => { void cache.invalidateQueries({ queryKey: ['network-tags'] }); void cache.invalidateQueries({ queryKey: ['network-summaries'] }); navigate(`/networks/${network.id}/edit`) } })
  const field = (name: keyof typeof form) => ({ value: form[name], onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm(previous => ({ ...previous, [name]: event.target.value })) })
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); create.mutate() }
  const createError = create.error as ApiError | null
  return <Stack spacing={3}><BoxHeader title={uiText('newSource')} /><Paper variant="outlined" sx={{ p: 3 }} component="form" onSubmit={submit}><Stack spacing={2}><TextField label={t('networks.acronym')} required inputProps={{ minLength: 2, maxLength: 10, pattern: '[A-Za-z0-9][A-Za-z0-9._-]*' }} {...field('acronym')} /><TextField label={t('networks.repository')} required inputProps={{ minLength: 2 }} {...field('name')} /><TextField label={t('networks.institution')} required inputProps={{ minLength: 2 }} {...field('institutionName')} /><TextField label={uiText('institutionAcronym')} {...field('institutionAcronym')} /><TextField label={t('networks.url')} type="url" required helperText={uiText('absoluteUrlExample')} {...field('originUrl')} />
    <NetworkTagsField client={client} value={tags} onChange={setTags} />
    {profiles.isLoading && <CircularProgress size={24} />}{profiles.isError && <Alert severity="warning">{uiText('profilesLoadError')}</Alert>}{profiles.data && <TextField select label={uiText('attributeProfile')} value={profileClass} onChange={event => setProfileClass(event.target.value)} helperText={uiText('defaultProfileHelp')}><MenuItem value="">{uiText('noProfile')}</MenuItem>{profiles.data.map(profile => <MenuItem key={profile.typeId} value={profile.className}>{t(`profileNames.${profile.typeId}`, { defaultValue: profile.name })}</MenuItem>)}</TextField>}
    {createError && <Alert severity="error">{createError.message}{createError.problem.code ? ` (${createError.problem.code})` : ''}</Alert>}<Stack direction="row" spacing={2}><Button component={Link} to="/networks">{t('common.cancel')}</Button><Button type="submit" variant="contained" startIcon={<SaveIcon />} disabled={create.isPending || profiles.isLoading}>{uiText('createSource')}</Button></Stack></Stack></Paper></Stack>
}
function BoxHeader({ title }: { title: string }) { return <Typography variant="h4">{title}</Typography> }
