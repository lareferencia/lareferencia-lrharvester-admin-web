import { TranslatableString, type RJSFValidationError } from '@rjsf/utils'
import i18n from './index'
import { formTranslations } from './form-translations'

const stringKeys = new Map(Object.entries(TranslatableString).map(([key, value]) => [value, key as keyof typeof formTranslations.es.strings]))

export function translateFormString(value: TranslatableString, params: string[] = []): string {
  const key = stringKeys.get(value)
  const template = key ? i18n.t(`form.strings.${key}`) : value
  return template.replace(/%(\d+)/g, (match, index: string) => params[Number(index) - 1] ?? match)
}

export function translateFormErrors(errors: RJSFValidationError[]): RJSFValidationError[] {
  return errors.map(error => {
    const key = error.name === 'type' ? String(error.params?.type) : error.name
    const message = String(i18n.t(`form.errors.${key}`, { ...error.params, defaultValue: i18n.t('form.errors.generic') }))
    return { ...error, message, stack: `${error.property} ${message}`.trim() }
  })
}
