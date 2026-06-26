'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { computeSearchDiff } = require('../computeSearchDiff')

test('computeSearchDiff detects missing and extra cars', () => {
  const partnerDto = {
    totalCount: 2,
    cars: [
      { carId: 'a', price: 100 },
      { carId: 'b', price: 200 },
    ],
  }

  const dbDto = {
    totalCount: 1,
    cars: [{ carId: 'b', price: 210 }],
  }

  const result = computeSearchDiff({ partnerDto, dbDto, normalizedSearch: { foo: 'bar' } })
  assert.deepEqual(result.diff.missingInDb, ['a'])
  assert.deepEqual(result.diff.extraInDb, [])
  assert.equal(result.diff.priceDiffs.length, 1)
})
