import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, it } from 'vitest'
import { TranslatableString } from '@rjsf/utils'
import i18n, { languages, uiText } from './index'
import { formTranslations } from './form-translations'
import { translateFormString, translateFormErrors } from './forms'
import { localizeProfileUiSchema, localizeSchema } from './schema'
import '../features/configurations/configuration-editor-i18n'

function flatten(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof item === 'string' ? [[path, item]] : Object.entries(flatten(item as Record<string, unknown>, path))
  }))
}
const bundles = Object.fromEntries(languages.map(({ code }) => [code, flatten(i18n.getResourceBundle(code, 'translation'))]))
const placeholders = (text: string) => [...text.matchAll(/{{\s*([^{}]+)\s*}}|%(\d+)/g)].map(match => match[1] || match[2]).sort()
afterEach(async () => { await i18n.changeLanguage('es') })

describe('Admin UI translation coverage', () => {
  it('has the same nonempty keys and interpolation parameters in ES, EN and PT', () => {
    for (const language of ['en', 'pt']) {
      expect(Object.keys(bundles[language]).sort()).toEqual(Object.keys(bundles.es).sort())
      for (const [key, text] of Object.entries(bundles.es)) {
        expect(bundles[language][key].trim(), `${language}.${key}`).not.toBe('')
        expect(placeholders(bundles[language][key]), `${language}.${key}`).toEqual(placeholders(text))
      }
    }
  })

  it('resolves every static t and uiText call without fallback', () => {
    const failures: string[] = []
    function scan(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name)
        if (entry.isDirectory()) { scan(file); continue }
        if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue
        const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
        function visit(node: ts.Node) {
          if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['t', 'uiText'].includes(node.expression.text)) {
            const key = node.arguments[0]
            if (key && ts.isStringLiteral(key) && !key.text.endsWith('.')) {
              const path = node.expression.text === 'uiText' ? `ui.${key.text}` : key.text
              for (const { code } of languages) if (!i18n.getResource(code, 'translation', path)) failures.push(`${file}: ${code}.${path}`)
            }
          }
          ts.forEachChild(node, visit)
        }
        visit(source)
      }
    }
    scan(join(import.meta.dirname, '..'))
    expect(failures).toEqual([])
  })

  it.each(['es', 'en', 'pt'])('uses current i18next plural forms in %s', async language => {
    await i18n.changeLanguage(language)
    expect(i18n.t('networks.results', { count: 1 })).toBe(language === 'en' ? '1 result' : '1 resultado')
    expect(i18n.t('networks.results', { count: 2 })).toBe(language === 'en' ? '2 results' : '2 resultados')
    expect(i18n.t('configurationEditor.ruleCount', { count: 2 })).toBe(({ es: '2 reglas', en: '2 rules', pt: '2 regras' } as Record<string, string>)[language])
  })

  it('translates every RJSF control and preserves parameter text', async () => {
    const keys = Object.keys(TranslatableString).sort()
    for (const { code } of languages) expect(Object.keys(formTranslations[code].strings).sort()).toEqual(keys)
    await i18n.changeLanguage('pt')
    expect(translateFormString(TranslatableString.AddItemButton)).toBe('Adicionar item')
    expect(translateFormString(TranslatableString.TitleOptionPrefix, ['%2', '7'])).toBe('%2 opção 7')
    expect(translateFormErrors([{ name: 'minLength', params: { limit: 3 }, property: '.name', stack: '' }])[0].message).toBe('Deve ter pelo menos 3 caracteres.')
  })

  it('changes pure helpers and schema labels with language without altering stored enum values', async () => {
    const schema = { type: 'object', properties: { source_type: { type: 'string', title: 'Tipo de fonte', enum: ['Repositório', 'Revista'] }, tags: { type: 'array', items: { type: 'string', enum: ['Social Sciences'] } } } }
    const uiSchema = { source_type: { 'ui:widget': 'select' }, '@class': { 'ui:widget': 'hidden' } }
    await i18n.changeLanguage('en')
    expect(uiText('createSource')).toBe('Create source')
    const localized = localizeSchema(schema, 'profileFields')
    expect(localized.properties).toMatchObject({ source_type: { title: 'Source type', enum: ['Repositório', 'Revista'] } })
    expect(localizeProfileUiSchema(schema, uiSchema)).toMatchObject({ source_type: { 'ui:widget': 'select', 'ui:enumNames': ['Repository', 'Journal'] }, tags: { items: { 'ui:enumNames': ['Social sciences'] } }, '@class': { 'ui:widget': 'hidden' } })
    expect(schema.properties.source_type.title).toBe('Tipo de fonte')
    await i18n.changeLanguage('pt')
    expect(uiText('createSource')).toBe('Criar fonte')
  })

  it.skipIf(!existsSync(join(import.meta.dirname, '../../../lareferencia-lrharvester-app/config/i18n')))('keeps the server rule catalogs complete in all three languages', () => {
    const directory = join(import.meta.dirname, '../../../lareferencia-lrharvester-app/config/i18n')
    const catalogs = ['messages.properties', 'messages_en.properties', 'messages_pt.properties'].map(file =>
      Object.fromEntries(readFileSync(join(directory, file), 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#') && line.includes('=')).map(line => {
        const equals = line.indexOf('=')
        return [line.slice(0, equals), line.slice(equals + 1)]
      })))
    for (const catalog of catalogs) {
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(catalogs[0]).sort())
      expect(Object.values(catalog).every(value => value.trim())).toBe(true)
    }
  })

  it.skipIf(!existsSync(join(import.meta.dirname, '../../../lareferencia-lrharvester-app/config/attribute-profiles')))('has translated titles for all shipped profile fields and preserves select values', async () => {
    const directory = join(import.meta.dirname, '../../../lareferencia-lrharvester-app/config/attribute-profiles')
    for (const file of readdirSync(directory)) {
      const profile = JSON.parse(readFileSync(join(directory, file), 'utf8'))
      for (const { code } of languages) {
        expect(i18n.getResource(code, 'translation', `profileNames.${profile.typeId}`), `${code}.${profile.typeId}`).toBeTruthy()
        for (const name of Object.keys(profile.schema.properties).filter(name => name !== '@class')) {
          expect(i18n.getResource(code, 'translation', `profileFields.${name}`), `${code}.${profile.typeId}.${name}`).toBeTruthy()
        }
      }
    }
  })
})
