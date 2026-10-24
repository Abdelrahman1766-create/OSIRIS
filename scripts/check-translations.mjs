import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const languages = ['en', 'ar', 'ru']
const flatten = (value, prefix = '') => Object.entries(value).flatMap(([key, item]) => {
  const path = prefix ? `${prefix}.${key}` : key
  return typeof item === 'string' ? [[path, item]] : flatten(item, path)
})
const locales = Object.fromEntries(languages.map((language) => [
  language,
  new Map(flatten(JSON.parse(readFileSync(join('src', 'locales', language, 'translation.json'), 'utf8')))),
]))
const baseline = new Set(locales.en.keys())
let failed = false

for (const language of languages) {
  const keys = new Set(locales[language].keys())
  const missing = [...baseline].filter((key) => !keys.has(key))
  const extra = [...keys].filter((key) => !baseline.has(key))
  const empty = [...locales[language]].filter(([, value]) => !value.trim()).map(([key]) => key)
  if (missing.length || extra.length || empty.length) {
    failed = true
    console.error(`${language}: missing=${missing.join(', ') || 'none'}; extra=${extra.join(', ') || 'none'}; empty=${empty.join(', ') || 'none'}`)
  } else {
    console.log(`${language}: ${keys.size} translation keys aligned`)
  }
}

const placeholders = (value) => new Set([...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]))
for (const key of baseline) {
  const expected = [...placeholders(locales.en.get(key))].sort().join(',')
  for (const language of languages.slice(1)) {
    const actual = [...placeholders(locales[language].get(key) || '')].sort().join(',')
    if (expected !== actual) {
      failed = true
      console.error(`${language}: interpolation mismatch for ${key}; expected [${expected}], got [${actual}]`)
    }
  }
}

const sourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(entry.name) ? [path] : []
})
for (const path of sourceFiles('src')) {
  const source = readFileSync(path, 'utf8')
  for (const match of source.matchAll(/\bt\(\s*(['"])([^'"]+)\1/g)) {
    if (!baseline.has(match[2])) {
      failed = true
      console.error(`${path}: translation key ${match[2]} is missing from en`)
    }
  }
}

if (failed) process.exitCode = 1
