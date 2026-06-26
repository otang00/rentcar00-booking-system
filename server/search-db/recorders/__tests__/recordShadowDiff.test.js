'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { recordShadowDiff } = require('../recordShadowDiff')

function buildDto(prefix) {
  return {
    totalCount: 1,
    company: { name: `${prefix}-company` },
    cars: [{ carId: `${prefix}-car`, price: 100 }],
  }
}

test('recordShadowDiff skips when inputs missing', async () => {
  const result = await recordShadowDiff({ partnerDto: null, dbDto: null, normalizedSearch: null })
  assert.equal(result.logged, false)
})

test('recordShadowDiff logs diff payload', async () => {
  let captured = null
  const supabaseClient = {
    from() {
      return {
        async insert(record) {
          captured = record
          return { error: null }
        },
      }
    },
  }

  const result = await recordShadowDiff({
    partnerDto: buildDto('partner'),
    dbDto: buildDto('db'),
    normalizedSearch: { driverAge: 26 },
    supabaseClient,
  })

  assert.equal(result.logged, true)
  assert.ok(captured)
  assert.equal(captured.diff.resultCountDelta, 0)
})
