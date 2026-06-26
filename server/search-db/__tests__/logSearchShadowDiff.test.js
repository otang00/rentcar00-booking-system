'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

const { logSearchShadowDiff } = require('../logSearchShadowDiff')

test('logSearchShadowDiff appends JSON line file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shadow-log-'))
  const filePath = path.join(tmpDir, 'log.jsonl')

  const supabaseClient = {
    from() {
      return {
        async insert() {
          return { error: null }
        },
      }
    },
  }

  await logSearchShadowDiff({
    payload: {
      searchHash: 'abc',
      searchParams: { foo: 'bar' },
      partner: {},
      db: {},
      diff: {},
      executionMeta: {},
    },
    supabaseClient,
    filePath,
  })

  const content = await fs.readFile(filePath, 'utf8')
  assert.equal(content.includes('"search_hash":"abc"'), true)
})
