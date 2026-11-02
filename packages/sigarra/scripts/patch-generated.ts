// Patches the Fern-generated SDK after `fern generate`.
//
// Headers.ts: the fallback Headers class declares its iterators as
// IterableIterator, but current DOM/Node typings require HeadersIterator (which
// adds the disposable iterator members), so the generated file fails to
// typecheck. Runtime behaviour is identical; only the declared return types change.
//
// Retries: Fern retries every request twice by default, POSTs included, which can
// replay non-idempotent calls such as the login or `finances.generateMbReference`.
// Retries are made opt-in: the default becomes 0, while an explicit `maxRetries`
// (per request or in the client options) is still honoured.
import { readFileSync, writeFileSync } from 'node:fs'

const generated = (path: string) => new URL(`../src/generated/${path}`, import.meta.url)

// Replaces every occurrence of each `[from, to]` pair in a generated file.
// Fails loudly if a `from` string is missing, so a Fern upgrade that changes the
// generated code cannot silently drop a patch. Already-patched files are accepted
// when `to` is present, which keeps the script idempotent.
function patch(path: string, replacements: [from: string, to: string][]) {
  const file = generated(path)
  const original = readFileSync(file, 'utf8')
  let patched = original

  for (const [from, to] of replacements) {
    if (patched.includes(from)) {
      patched = patched.replaceAll(from, to)
    } else if (!patched.includes(to)) {
      console.error(`Expected ${JSON.stringify(from)} not found in ${path}; revisit this patch`)
      process.exit(1)
    }
  }

  if (patched !== original) {
    writeFileSync(file, patched)
    console.log(`Patched ${path}`)
  }
}

patch('core/fetcher/Headers.ts', [
  ['IterableIterator<[string, string]>', 'HeadersIterator<[string, string]>'],
  ['IterableIterator<string>', 'HeadersIterator<string>'],
])

patch('core/fetcher/requestWithRetries.ts', [['const DEFAULT_MAX_RETRIES = 2;', 'const DEFAULT_MAX_RETRIES = 0;']])

patch('BaseClient.ts', [
  [
    'The default number of times to retry the request. Defaults to 2.',
    'The default number of times to retry the request. Defaults to 0.',
  ],
  [
    'The number of times to retry the request. Defaults to 2.',
    'The number of times to retry the request. Defaults to 0.',
  ],
])

patch('core/fetcher/makePassthroughRequest.ts', [
  [
    'Default number of times to retry the request. Defaults to 2.',
    'Default number of times to retry the request. Defaults to 0.',
  ],
])
