import fs from 'node:fs'

const file = process.argv[2] || 'data/pricing-reset/ims-source-group-price-reset-20260529.json'
const payload = JSON.parse(fs.readFileSync(file, 'utf8'))
const optionConfig = {
  basic: { hour1: 0.12, week1: 5.5, week2: 7.5, month1: 9.0 },
  semi_premium: { hour1: 0.12, week1: 5.5, week2: 8.0, month1: 11.0 },
  premium: { hour1: 0.14, week1: 6.5, week2: 9.0, month1: 14.0 },
}
function ceil1000(v) { return Math.ceil(Number(v || 0) / 1000) * 1000 }
function round1000(v) { return Math.round(Number(v || 0) / 1000) * 1000 }
function tolerance(expected, actual) { return Math.abs(Number(expected) - Number(actual)) <= 1000 }
const errors = []
const warnings = []
if (payload.basis !== 'cars.source_group_id') errors.push(`invalid basis: ${payload.basis}`)
if (payload.group_count !== 36) errors.push(`invalid group_count: ${payload.group_count}`)
if (!Array.isArray(payload.rows) || payload.rows.length !== 36) errors.push(`rows length is ${payload.rows?.length}`)
const seen = new Set()
for (const row of payload.rows || []) {
  if (seen.has(row.source_group_id)) errors.push(`duplicate source_group_id: ${row.source_group_id}`)
  seen.add(row.source_group_id)
  const option = optionConfig[row.pricing_option_type]
  if (!option) {
    errors.push(`${row.source_group_id}: invalid pricing_option_type ${row.pricing_option_type}`)
    continue
  }
  const expectedWeekday = ceil1000(row.base_24h_price * row.weekday_rate_percent / 100)
  const expectedWeekend = ceil1000(row.base_24h_price * row.weekend_rate_percent / 100)
  if (row.weekday_rate_percent !== 90) errors.push(`${row.source_group_id}: weekday percent ${row.weekday_rate_percent}`)
  if (row.weekend_rate_percent !== 115) errors.push(`${row.source_group_id}: weekend percent ${row.weekend_rate_percent}`)
  if (row.weekday_24h_price !== expectedWeekday) errors.push(`${row.source_group_id}: weekday_24h ${row.weekday_24h_price} != ${expectedWeekday}`)
  if (row.weekend_24h_price !== expectedWeekend) errors.push(`${row.source_group_id}: weekend_24h ${row.weekend_24h_price} != ${expectedWeekend}`)
  const d = row.derived_prices || {}
  const expected = {
    hour_1_price: ceil1000(row.base_24h_price * option.hour1),
    week_1_price: Math.round(row.base_24h_price * option.week1),
    week_2_price: Math.round(row.base_24h_price * option.week2),
    month_1_price: Math.round(row.base_24h_price * option.month1),
  }
  for (const [key, value] of Object.entries(expected)) {
    if (!tolerance(value, d[key])) warnings.push(`${row.source_group_id}: ${key} ${d[key]} differs from formula ${value}`)
  }
}
console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings, groupCount: payload.rows?.length || 0 }, null, 2))
if (errors.length > 0) process.exit(1)
