'use strict'

const SHORT_HOURLY_RATE = 0.12
const SHORT_BUCKET_WEIGHTS = [
  { maxDays: 2, weight: 1.0 },
  { maxDays: 4, weight: 0.9 },
  { maxDays: 6, weight: 0.85 },
]
const WEEK1_DAILY_INCREMENT_RATE = 0.5
const WEEK2_DAILY_INCREMENT_RATE = 0.35

function getTotalHours(startAt, endAt) {
  const diffMs = endAt.getTime() - startAt.getTime()
  return diffMs / (1000 * 60 * 60)
}

function getBucket(totalHours) {
  if (totalHours <= 1) return 'hour_1'
  if (totalHours < 24) return 'hours_under_24'
  if (totalHours < 24 * 7) return 'days_under_7'
  if (totalHours <= 24 * 14) return 'days_7_14'
  if (totalHours <= 24 * 30) return 'days_15_30'
  return 'over_30_days'
}

function getDayNameInSeoul(date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Seoul',
  }).format(date)
}

function isWeekendInSeoul(date) {
  const day = getDayNameInSeoul(date)
  return day === 'Sat' || day === 'Sun'
}

function addHours(date, hours) {
  return new Date(date.getTime() + (hours * 60 * 60 * 1000))
}

function toNumber(value) {
  return Number(value || 0)
}

function getShortBucketWeight(days) {
  return SHORT_BUCKET_WEIGHTS.find((item) => days <= item.maxDays)?.weight || SHORT_BUCKET_WEIGHTS[SHORT_BUCKET_WEIGHTS.length - 1].weight
}

function countDayTypes(startAt, days) {
  let weekdayDays = 0
  let weekendDays = 0

  for (let index = 0; index < days; index += 1) {
    const dayPoint = addHours(startAt, index * 24)
    if (isWeekendInSeoul(dayPoint)) {
      weekendDays += 1
    } else {
      weekdayDays += 1
    }
  }

  return {
    weekdayDays,
    weekendDays,
  }
}

function calculateShortRentalPrice({ policy = {}, startAt, days } = {}) {
  if (days <= 0) {
    return {
      weekdayDays: 0,
      weekendDays: 0,
      discountPrice: 0,
    }
  }

  const weekdayDaily = toNumber(policy.weekday_24h_price)
  const weekendDaily = toNumber(policy.weekend_24h_price)
  const bucketWeight = getShortBucketWeight(days)
  const dayCounts = countDayTypes(startAt, days)
  const discountPrice = (dayCounts.weekdayDays * weekdayDaily * bucketWeight) + (dayCounts.weekendDays * weekendDaily * bucketWeight)

  return {
    ...dayCounts,
    discountPrice,
  }
}

function calculateWeek1To2AnchorPrice({ policy = {}, days } = {}) {
  const base24h = toNumber(policy.base24h)
  const anchor7 = toNumber(policy.week_1_price)
  const anchor14 = toNumber(policy.week_2_price)
  return Math.min(anchor14, anchor7 + ((days - 7) * base24h * WEEK1_DAILY_INCREMENT_RATE))
}

function calculateWeek2ToMonthAnchorPrice({ policy = {}, days } = {}) {
  const base24h = toNumber(policy.base24h)
  const anchor14 = toNumber(policy.week_2_price)
  const anchor30 = toNumber(policy.month_1_price)
  return Math.min(anchor30, anchor14 + ((days - 14) * base24h * WEEK2_DAILY_INCREMENT_RATE))
}

function calculateWholeDaysPrice({ policy = {}, startAt, days } = {}) {
  if (days <= 0) return 0
  if (days < 7) return calculateShortRentalPrice({ policy, startAt, days }).discountPrice
  if (days <= 14) return calculateWeek1To2AnchorPrice({ policy, days })
  if (days <= 30) return calculateWeek2ToMonthAnchorPrice({ policy, days })
  throw new Error('search window exceeds 30 days')
}

function calculateNextDayCapPrice({ policy = {}, startAt, days, partialPrice } = {}) {
  return Math.min(partialPrice, calculateWholeDaysPrice({ policy, startAt, days: days + 1 }))
}

function calculateDiscountPrice({ policy = {}, startAt, totalHours } = {}) {
  const days = Math.floor(totalHours / 24)
  const hours = Math.ceil(totalHours - (days * 24))
  const fullDaysPrice = calculateWholeDaysPrice({ policy, startAt, days })

  if (hours <= 0) {
    return fullDaysPrice
  }

  const hourlyBase = toNumber(policy.hour_1_price)
  return calculateNextDayCapPrice({
    policy,
    startAt,
    days,
    partialPrice: fullDaysPrice + (hours * hourlyBase),
  })
}

function calculateGroupPrice({ policy, searchWindow, deliveryPrice = 0 } = {}) {
  if (!policy) {
    throw new Error('price policy is required')
  }

  if (!searchWindow?.startAt || !searchWindow?.endAt) {
    throw new Error('search window is required')
  }

  const startAt = new Date(searchWindow.startAt)
  const endAt = new Date(searchWindow.endAt)
  const totalHours = getTotalHours(startAt, endAt)
  if (!(totalHours > 0)) {
    throw new Error('invalid search window')
  }

  const durationBucket = getBucket(totalHours)
  if (durationBucket === 'over_30_days') {
    throw new Error('search window exceeds 30 days')
  }

  const base24h = toNumber(policy.base24h)
  const billableDays = Math.max(1, Math.ceil(totalHours / 24))
  const dayCounts = countDayTypes(startAt, Math.floor(totalHours / 24))

  return {
    price: base24h * billableDays,
    discountPrice: calculateDiscountPrice({ policy, startAt, totalHours }),
    deliveryPrice: Number(deliveryPrice || 0),
    baseDailyPrice: base24h,
    appliedPolicyId: policy.price_policy_id || policy.id || null,
    appliedPolicyName: policy.policy_name || null,
    imsGroupId: Number(policy.ims_group_id || 0),
    durationBucket,
    billableDays,
    weekdayDays: dayCounts.weekdayDays,
    weekendDays: dayCounts.weekendDays,
  }
}

module.exports = {
  calculateGroupPrice,
  calculateNextDayCapPrice,
  calculateShortRentalPrice,
  calculateWeek1To2AnchorPrice,
  calculateWeek2ToMonthAnchorPrice,
  getBucket,
  isWeekendInSeoul,
}
