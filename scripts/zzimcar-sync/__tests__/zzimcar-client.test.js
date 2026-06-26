const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLoginFormBody,
  extractSessionCookie,
  formatKstDateTime,
  parseVehiclePagingResponse,
} = require('../lib/zzimcar-client');

test('buildLoginFormBody builds x-www-form-urlencoded body', () => {
  assert.equal(
    buildLoginFormBody({ username: 'abc', password: '1234' }),
    'username=abc&password=1234',
  );
});

test('extractSessionCookie returns session cookie string', () => {
  const header = 'SESSION=abc123; Path=/; Secure; HttpOnly; SameSite=Lax';
  assert.equal(extractSessionCookie(header), 'SESSION=abc123');
});

test('parseVehiclePagingResponse returns exact normalized match', () => {
  const result = parseVehiclePagingResponse({
    recordsTotal: 10,
    recordsFiltered: 1,
    data: [
      { pid: 22360, carNum: '101하9257' },
      { pid: 22361, carNum: '201하0001' },
    ],
  }, '101하 9257');

  assert.equal(result.recordsTotal, 10);
  assert.equal(result.recordsFiltered, 1);
  assert.equal(result.matches.length, 1);
  assert.equal(result.match.pid, 22360);
});

test('formatKstDateTime formats ISO to Asia/Seoul second precision', () => {
  assert.equal(formatKstDateTime('2026-05-01T01:00:00.000Z'), '2026-05-01 10:00:00');
});
