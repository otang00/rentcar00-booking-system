'use strict'

const { createServerPrivilegedClient } = require('../../server/supabase/createServerClient')
const { getAccessTokenFromRequest } = require('../../server/auth/getAccessTokenFromRequest')
const { getUserFromAccessToken } = require('../../server/auth/getUserFromAccessToken')
const { assertAdminUser } = require('../../server/auth/adminAccess')
const { serializeBookingOrder } = require('../../server/booking-core/guestBookingUtils')
const { fetchBookingOrderByConfirmationToken } = require('../../server/booking-core/bookingConfirmationService')
const { cancelBookingOrder, completeRefundForBookingOrder } = require('../../server/booking-core/guestBookingService')
const { createBookingConfirmToken } = require('../../server/security/bookingConfirmToken')
const { buildSearchWindow } = require('../../server/search-db/helpers/buildSearchWindow')

const TAB_STATUS_MAP = {
  active: ['confirmed'],
  cancelled: ['cancelled'],
}

function normalizeTab(value) {
  const normalized = String(value || 'active').trim().toLowerCase()
  return TAB_STATUS_MAP[normalized] ? normalized : 'active'
}

function normalizeQueryField(value) {
  const normalized = String(value || 'carNumber').trim()
  return ['carNumber', 'reservationNumber', 'customerName'].includes(normalized)
    ? normalized
    : 'carNumber'
}

function normalizePage(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return parsed
}

function formatSeoulDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value
    return acc
  }, {})

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

function normalizeLocalDateTime(value) {
  const normalized = String(value || '').trim().replace('T', ' ')
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized) ? normalized : ''
}

function buildChangeSearch({ order, deliveryDateTime, returnDateTime } = {}) {
  return {
    deliveryDateTime,
    returnDateTime,
    pickupOption: order?.pickup_method || 'pickup',
    driverAge: 26,
    order: 'lower',
  }
}

function buildUpdatedDisplaySnapshot({ order, car } = {}) {
  const existingSnapshot = order?.pricing_snapshot || {}
  return {
    ...existingSnapshot,
    carName: car?.display_name || car?.name || existingSnapshot.carName || '',
    carNumber: car?.car_number || existingSnapshot.carNumber || '',
  }
}

async function fetchCarForChange({ supabaseClient, order, sourceCarId } = {}) {
  let query = supabaseClient
    .from('cars')
    .select('*')
    .eq('active', true)

  if (sourceCarId) {
    query = query.eq('source_car_id', Number(sourceCarId)).eq('ims_can_general_rental', true)
  } else {
    query = query.eq('id', order.car_id)
  }

  const { data, error } = await query.limit(1).maybeSingle()
  if (error) throw error
  return data || null
}

async function fetchChangeConflicts({ supabaseClient, order, car, pickupAt, returnAt } = {}) {
  const [{ data: bookingRows, error: bookingError }, { data: imsRows, error: imsError }] = await Promise.all([
    supabaseClient
      .from('booking_orders')
      .select('id, public_reservation_code')
      .eq('car_id', car.id)
      .eq('booking_status', 'confirmed')
      .neq('id', order.id)
      .lt('pickup_at', returnAt)
      .gt('return_at', pickupAt),
    supabaseClient
      .from('ims_sync_reservations')
      .select('id, reservation_no, ims_reservation_id')
      .eq('car_id', String(car.source_car_id || ''))
      .lt('start_at', returnAt)
      .gt('end_at', pickupAt),
  ])

  if (bookingError) throw bookingError
  if (imsError) throw imsError

  return {
    bookingOrders: Array.isArray(bookingRows) ? bookingRows : [],
    imsReservations: Array.isArray(imsRows) ? imsRows : [],
  }
}

function serializeChangeCarCandidate({ car, conflicts } = {}) {
  return {
    id: car?.id || null,
    sourceCarId: car?.source_car_id || null,
    sourceGroupId: car?.source_group_id || null,
    carNumber: car?.car_number || '',
    carName: car?.display_name || car?.name || '',
    available: !conflicts || (conflicts.bookingOrders.length === 0 && conflicts.imsReservations.length === 0),
    conflicts: conflicts
      ? {
        bookingOrders: conflicts.bookingOrders.length,
        imsReservations: conflicts.imsReservations.length,
      }
      : { bookingOrders: 0, imsReservations: 0 },
  }
}

async function fetchChangeCarCandidates({ supabaseClient, order, searchWindow, q, limit = 12 } = {}) {
  const queryText = String(q || '').trim().toLowerCase()
  if (queryText.length < 2) return []

  const { data, error } = await supabaseClient
    .from('cars')
    .select('id, source_car_id, source_group_id, display_name, name, car_number, active, ims_can_general_rental')
    .eq('active', true)
    .eq('ims_can_general_rental', true)
    .order('car_number', { ascending: true })
    .limit(120)

  if (error) throw error

  const matched = (Array.isArray(data) ? data : [])
    .filter((car) => {
      const haystack = [car.source_car_id, car.car_number, car.display_name, car.name]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')
      return haystack.includes(queryText)
    })
    .slice(0, Math.min(Math.max(Number(limit || 12), 1), 20))

  const rows = []
  for (const car of matched) {
    const conflicts = await fetchChangeConflicts({
      supabaseClient,
      order,
      car,
      pickupAt: searchWindow.startIso,
      returnAt: searchWindow.endIso,
    })
    rows.push(serializeChangeCarCandidate({ car, conflicts }))
  }

  return rows
}

function readSearchValue(item, field) {
  if (field === 'reservationNumber') return String(item.publicReservationCode || '')
  if (field === 'customerName') return String(item.customerName || '')
  if (field === 'carNumber') return String(item.pricingSnapshot?.carNumber || '')
  return ''
}

function matchesSearch(item, field, query) {
  const target = readSearchValue(item, field).trim().toLowerCase()
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) return true
  if (!target) return false

  if (field === 'reservationNumber') {
    return target === normalizedQuery
  }

  return target.includes(normalizedQuery)
}

function createDetailPath(item) {
  if (!item?.id || !item?.publicReservationCode) return ''
  const { token } = createBookingConfirmToken({
    bookingOrderId: item.id,
    reservationCode: item.publicReservationCode,
  })
  return `/admin/booking-confirm?token=${encodeURIComponent(token)}`
}

function toAdminBookingDetail(booking, rawBooking = {}) {
  const rawPhone = String(rawBooking?.customer_phone || '').trim()
  const rawBirth = String(rawBooking?.customer_birth || rawBooking?.pricing_snapshot?.customerBirth || '').trim()

  return {
    ...booking,
    customerPhone: rawPhone || booking?.customerPhone || null,
    customerBirth: rawBirth || booking?.customerBirth || null,
    customerPhoneRaw: rawPhone || null,
    customerBirthRaw: rawBirth || null,
  }
}

function toAdminBookingItem(order, fallbackCarNumberById = new Map()) {
  const item = serializeBookingOrder(order)
  const fallbackCarNumber = fallbackCarNumberById.get(String(order?.car_id || '').trim()) || ''
  return {
    id: item.id,
    reservationNumber: item.publicReservationCode,
    carNumber: item.pricingSnapshot?.carNumber || fallbackCarNumber,
    carName: item.pricingSnapshot?.carName || '',
    customerName: item.customerName || '',
    pickupAt: item.pickupAt || null,
    returnAt: item.returnAt || null,
    bookingStatus: item.bookingStatus || '',
    paymentStatus: item.paymentStatus || '',
    quotedTotalAmount: item.quotedTotalAmount ?? 0,
    createdAt: item.createdAt || null,
    detailPath: createDetailPath(item),
  }
}

async function fetchFallbackCarNumbers({ supabaseClient, rows } = {}) {
  const missingCarIds = (Array.isArray(rows) ? rows : [])
    .filter((row) => !(row?.pricing_snapshot?.carNumber) && row?.car_id)
    .map((row) => String(row.car_id).trim())
    .filter(Boolean)

  const uniqueCarIds = [...new Set(missingCarIds)]
  if (uniqueCarIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabaseClient
    .from('cars')
    .select('id, car_number')
    .in('id', uniqueCarIds)

  if (error) {
    throw error
  }

  return new Map((Array.isArray(data) ? data : []).map((row) => [String(row.id), String(row.car_number || '')]))
}

async function fetchLatestImsReservationSync({ supabaseClient } = {}) {
  const { data, error } = await supabaseClient
    .from('reservation_sync_runs')
    .select('id, sync_type, status, started_at, finished_at, fetched_count, upserted_count, failed_count, error_summary')
    .eq('sync_type', 'ims_reservations')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return {
    id: data.id,
    syncType: data.sync_type,
    status: data.status || 'unknown',
    startedAt: data.started_at || null,
    finishedAt: data.finished_at || null,
    updatedAt: data.finished_at || data.started_at || null,
    fetchedCount: Number(data.fetched_count || 0),
    upsertedCount: Number(data.upserted_count || 0),
    failedCount: Number(data.failed_count || 0),
    errorSummary: data.error_summary || '',
  }
}

async function fetchLatestImsReservationSyncErrors({ supabaseClient, syncRunId } = {}) {
  if (!syncRunId) return []

  const { data, error } = await supabaseClient
    .from('reservation_sync_errors')
    .select('id, ims_reservation_id, stage, error_code, error_message, created_at')
    .eq('sync_run_id', syncRunId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    throw error
  }

  return Array.isArray(data)
    ? data.map((row) => ({
      id: row.id,
      imsReservationId: row.ims_reservation_id || '',
      stage: row.stage || '',
      errorCode: row.error_code || '',
      errorMessage: row.error_message || '',
      createdAt: row.created_at || null,
    }))
    : []
}

async function fetchLatestZzimcarSync({ supabaseClient } = {}) {
  const { data, error } = await supabaseClient
    .from('zzimcar_sync_runs')
    .select('id, sync_mode, status, started_at, finished_at, desired_count, actual_count, additions_count, deletions_count, changes_count, unchanged_count, failed_count, error_summary')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    const message = String(error.message || '')
    if (message.includes('zzimcar_sync_runs')) {
      return null
    }
    throw error
  }

  if (!data) {
    return null
  }

  return {
    id: data.id,
    syncMode: data.sync_mode || 'dry-run',
    status: data.status || 'unknown',
    startedAt: data.started_at || null,
    finishedAt: data.finished_at || null,
    updatedAt: data.finished_at || data.started_at || null,
    desiredCount: Number(data.desired_count || 0),
    actualCount: Number(data.actual_count || 0),
    additionsCount: Number(data.additions_count || 0),
    deletionsCount: Number(data.deletions_count || 0),
    changesCount: Number(data.changes_count || 0),
    unchangedCount: Number(data.unchanged_count || 0),
    failedCount: Number(data.failed_count || 0),
    errorSummary: data.error_summary || '',
  }
}

async function fetchLatestZzimcarSyncErrors({ supabaseClient, latestSync } = {}) {
  if (!latestSync?.startedAt) return []
  if (Number(latestSync.failedCount || 0) <= 0) return []

  let query = supabaseClient
    .from('zzimcar_disable_time_sync_mappings')
    .select('ims_reservation_id, car_number, sync_status, last_error, updated_at')
    .in('sync_status', ['sync_failed', 'delete_failed'])
    .gte('updated_at', latestSync.startedAt)

  if (latestSync.finishedAt) {
    query = query.lte('updated_at', latestSync.finishedAt)
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(5)

  if (error) {
    const message = String(error.message || '')
    if (message.includes('zzimcar_disable_time_sync_mappings')) {
      return []
    }
    throw error
  }

  return Array.isArray(data)
    ? data.map((row) => ({
      imsReservationId: row.ims_reservation_id || '',
      carNumber: row.car_number || '',
      syncStatus: row.sync_status || '',
      errorMessage: row.last_error || '',
      updatedAt: row.updated_at || null,
    }))
    : []
}

async function fetchLatestCarmoreSync({ supabaseClient } = {}) {
  const { data, error } = await supabaseClient
    .from('carmore_sync_runs')
    .select('id, sync_mode, status, started_at, finished_at, desired_count, actual_count, additions_count, deletions_count, changes_count, unchanged_count, failed_count, error_summary')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    const message = String(error.message || '')
    if (message.includes('carmore_sync_runs')) {
      return null
    }
    throw error
  }

  if (!data) {
    return null
  }

  return {
    id: data.id,
    syncMode: data.sync_mode || 'dry-run',
    status: data.status || 'unknown',
    startedAt: data.started_at || null,
    finishedAt: data.finished_at || null,
    updatedAt: data.finished_at || data.started_at || null,
    desiredCount: Number(data.desired_count || 0),
    actualCount: Number(data.actual_count || 0),
    additionsCount: Number(data.additions_count || 0),
    deletionsCount: Number(data.deletions_count || 0),
    changesCount: Number(data.changes_count || 0),
    unchangedCount: Number(data.unchanged_count || 0),
    failedCount: Number(data.failed_count || 0),
    errorSummary: data.error_summary || '',
  }
}

async function fetchLatestCarmoreSyncErrors({ supabaseClient, latestSync } = {}) {
  if (!latestSync?.startedAt) return []
  if (Number(latestSync.failedCount || 0) <= 0) return []

  let query = supabaseClient
    .from('carmore_holiday_sync_mappings')
    .select('ims_reservation_id, car_number, sync_status, last_error, updated_at')
    .in('sync_status', ['sync_failed', 'delete_failed'])
    .gte('updated_at', latestSync.startedAt)

  if (latestSync.finishedAt) {
    query = query.lte('updated_at', latestSync.finishedAt)
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(5)

  if (error) {
    const message = String(error.message || '')
    if (message.includes('carmore_holiday_sync_mappings')) {
      return []
    }
    throw error
  }

  return Array.isArray(data)
    ? data.map((row) => ({
      imsReservationId: row.ims_reservation_id || '',
      carNumber: row.car_number || '',
      syncStatus: row.sync_status || '',
      errorMessage: row.last_error || '',
      updatedAt: row.updated_at || null,
    }))
    : []
}

async function handleList(req, res, supabaseClient) {
  const tab = normalizeTab(req.query?.tab)
  const q = String(req.query?.q || '').trim()
  const qField = normalizeQueryField(req.query?.qField)
  const page = normalizePage(req.query?.page, 1)
  const pageSize = Math.min(normalizePage(req.query?.pageSize, 20), 100)

  const statuses = TAB_STATUS_MAP[tab]
  const { data, error } = await supabaseClient
    .from('booking_orders')
    .select('*')
    .in('booking_status', statuses)
    .order('pickup_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const [fallbackCarNumberById, latestImsSync, latestZzimcarSync, latestCarmoreSync] = await Promise.all([
    fetchFallbackCarNumbers({ supabaseClient, rows: data }),
    fetchLatestImsReservationSync({ supabaseClient }),
    fetchLatestZzimcarSync({ supabaseClient }),
    fetchLatestCarmoreSync({ supabaseClient }),
  ])

  const [imsSyncErrors, zzimcarSyncErrors, carmoreSyncErrors] = await Promise.all([
    fetchLatestImsReservationSyncErrors({ supabaseClient, syncRunId: latestImsSync?.id }),
    fetchLatestZzimcarSyncErrors({ supabaseClient, latestSync: latestZzimcarSync }),
    fetchLatestCarmoreSyncErrors({ supabaseClient, latestSync: latestCarmoreSync }),
  ])

  const items = (Array.isArray(data) ? data : [])
    .map((row) => toAdminBookingItem(row, fallbackCarNumberById))
    .filter((item) => matchesSearch({
      publicReservationCode: item.reservationNumber,
      customerName: item.customerName,
      pricingSnapshot: {
        carNumber: item.carNumber,
      },
    }, qField, q))

  const start = (page - 1) * pageSize
  const pagedItems = items.slice(start, start + pageSize)

  return res.status(200).json({
    items: pagedItems,
    page,
    pageSize,
    total: items.length,
    filters: {
      tab,
      q,
      qField,
    },
    imsSync: latestImsSync,
    imsSyncErrors,
    zzimcarSync: latestZzimcarSync,
    zzimcarSyncErrors,
    carmoreSync: latestCarmoreSync,
    carmoreSyncErrors,
  })
}

async function handleConfirmTarget(req, res, supabaseClient) {
  const token = String(req.query?.token || '').trim()
  if (!token) {
    return res.status(400).json({ error: 'missing_token', message: '예약 확인 토큰이 필요합니다.' })
  }

  const result = await fetchBookingOrderByConfirmationToken({ supabaseClient, token })
  if (!result.ok) {
    return res.status(result.status || 400).json({
      error: result.code || 'booking_lookup_failed',
      message: result.message,
    })
  }

  return res.status(200).json({ booking: toAdminBookingDetail(result.booking, result.rawBooking) })
}

async function handleCancel(req, res, supabaseClient) {
  const token = String(req.body?.token || '').trim()
  const reason = String(req.body?.reason || '').trim()
  if (!token) {
    return res.status(400).json({ error: 'missing_token', message: '예약 토큰이 필요합니다.' })
  }

  const lookup = await fetchBookingOrderByConfirmationToken({ supabaseClient, token })
  if (!lookup.ok) {
    return res.status(lookup.status || 400).json({
      error: lookup.code || 'admin_cancel_lookup_failed',
      message: lookup.message || '예약 정보를 찾지 못했습니다.',
    })
  }

  const pickupAt = lookup.rawBooking?.pickup_at ? new Date(lookup.rawBooking.pickup_at) : null
  const started = pickupAt && !Number.isNaN(pickupAt.getTime()) ? pickupAt <= new Date() : false

  const result = await cancelBookingOrder({
    supabaseClient,
    order: lookup.rawBooking,
    requestedBy: 'admin_web',
    eventType: started ? 'admin_cancelled_after_start' : 'admin_cancelled',
    reason,
    allowStartedCancel: true,
    allowedBookingStatuses: ['confirmed'],
  })

  if (!result.ok) {
    return res.status(result.status || 400).json({
      error: result.code || 'admin_cancel_failed',
      message: result.message || '예약 취소에 실패했습니다.',
      booking: result.booking ? toAdminBookingDetail(result.booking, lookup.rawBooking) : null,
    })
  }

  return res.status(200).json({
    booking: toAdminBookingDetail(result.booking, lookup.rawBooking),
    mapping: result.mapping || null,
  })
}

async function handleChangeCarCandidates(req, res, supabaseClient) {
  const token = String(req.query?.token || '').trim()
  const q = String(req.query?.q || '').trim()

  if (!token) {
    return res.status(400).json({ error: 'missing_token', message: '예약 토큰이 필요합니다.' })
  }

  const lookup = await fetchBookingOrderByConfirmationToken({ supabaseClient, token })
  if (!lookup.ok) {
    return res.status(lookup.status || 400).json({
      error: lookup.code || 'admin_change_lookup_failed',
      message: lookup.message || '예약 정보를 찾지 못했습니다.',
    })
  }

  const order = lookup.rawBooking
  if (String(order.booking_status || '') !== 'confirmed') {
    return res.status(409).json({
      error: 'booking_change_not_allowed_status',
      message: '예약 확정 상태에서만 변경할 수 있습니다.',
    })
  }

  const deliveryDateTime = normalizeLocalDateTime(req.query?.deliveryDateTime) || formatSeoulDateTime(order.pickup_at)
  const returnDateTime = normalizeLocalDateTime(req.query?.returnDateTime) || formatSeoulDateTime(order.return_at)
  let searchWindow
  try {
    searchWindow = buildSearchWindow(buildChangeSearch({ order, deliveryDateTime, returnDateTime }))
  } catch {
    return res.status(400).json({ error: 'invalid_change_window', message: '변경할 대여/반납 기간을 확인해 주세요.' })
  }

  const items = await fetchChangeCarCandidates({
    supabaseClient,
    order,
    searchWindow,
    q,
  })

  return res.status(200).json({ items })
}

async function handleChange(req, res, supabaseClient) {
  const token = String(req.body?.token || '').trim()
  const changeType = String(req.body?.changeType || '').trim()
  const reason = String(req.body?.reason || '').trim()
  const sourceCarId = req.body?.sourceCarId == null || req.body.sourceCarId === '' ? null : Number(req.body.sourceCarId)

  if (!token) {
    return res.status(400).json({ error: 'missing_token', message: '예약 토큰이 필요합니다.' })
  }

  if (!['date', 'car', 'date_car'].includes(changeType)) {
    return res.status(400).json({ error: 'invalid_change_type', message: '변경 유형을 확인해 주세요.' })
  }

  if (sourceCarId != null && (!Number.isInteger(sourceCarId) || sourceCarId <= 0)) {
    return res.status(400).json({ error: 'invalid_source_car_id', message: '변경할 차량 정보를 확인해 주세요.' })
  }

  if (['car', 'date_car'].includes(changeType) && !sourceCarId) {
    return res.status(400).json({ error: 'missing_source_car_id', message: '변경할 차량 ID를 입력해 주세요.' })
  }

  const lookup = await fetchBookingOrderByConfirmationToken({ supabaseClient, token })
  if (!lookup.ok) {
    return res.status(lookup.status || 400).json({
      error: lookup.code || 'admin_change_lookup_failed',
      message: lookup.message || '예약 정보를 찾지 못했습니다.',
    })
  }

  const order = lookup.rawBooking
  if (String(order.booking_status || '') !== 'confirmed') {
    return res.status(409).json({
      error: 'booking_change_not_allowed_status',
      message: '예약 확정 상태에서만 변경할 수 있습니다.',
      booking: toAdminBookingDetail(lookup.booking, lookup.rawBooking),
    })
  }

  const started = order.pickup_at ? new Date(order.pickup_at) <= new Date() : false
  if (started) {
    return res.status(409).json({
      error: 'started_booking_change_requires_force',
      message: '이미 시작된 예약은 1차 변경 기능에서 변경할 수 없습니다.',
      booking: toAdminBookingDetail(lookup.booking, lookup.rawBooking),
    })
  }

  const deliveryDateTime = normalizeLocalDateTime(req.body?.deliveryDateTime) || formatSeoulDateTime(order.pickup_at)
  const returnDateTime = normalizeLocalDateTime(req.body?.returnDateTime) || formatSeoulDateTime(order.return_at)
  if (!deliveryDateTime || !returnDateTime) {
    return res.status(400).json({ error: 'invalid_change_datetime', message: '변경할 대여/반납 일시를 확인해 주세요.' })
  }

  const search = buildChangeSearch({ order, deliveryDateTime, returnDateTime })
  let searchWindow
  try {
    searchWindow = buildSearchWindow(search)
  } catch {
    return res.status(400).json({ error: 'invalid_change_window', message: '변경할 대여/반납 기간을 확인해 주세요.' })
  }

  const car = await fetchCarForChange({
    supabaseClient,
    order,
    sourceCarId: changeType === 'date' ? null : sourceCarId,
  })
  if (!car) {
    return res.status(404).json({ error: 'change_car_not_found', message: '변경할 차량을 찾지 못했습니다.' })
  }

  const conflicts = await fetchChangeConflicts({
    supabaseClient,
    order,
    car,
    pickupAt: searchWindow.startIso,
    returnAt: searchWindow.endIso,
  })
  if (conflicts.bookingOrders.length > 0 || conflicts.imsReservations.length > 0) {
    return res.status(409).json({
      error: 'booking_change_unavailable',
      message: '변경할 차량/기간이 다른 예약과 겹칩니다.',
      conflicts: {
        bookingOrders: conflicts.bookingOrders.length,
        imsReservations: conflicts.imsReservations.length,
      },
    })
  }

  const nextSnapshot = buildUpdatedDisplaySnapshot({ order, car })
  const keptAmount = Number(order.quoted_total_amount || 0)
  const changedAt = new Date().toISOString()

  const updatePayload = {
    car_id: car.id,
    pickup_at: searchWindow.startIso,
    return_at: searchWindow.endIso,
    pricing_snapshot: nextSnapshot,
    updated_at: changedAt,
  }

  const { data: updatedOrder, error: updateError } = await supabaseClient
    .from('booking_orders')
    .update(updatePayload)
    .eq('id', order.id)
    .eq('booking_status', 'confirmed')
    .select('*')
    .single()

  if (updateError) throw updateError

  const { error: eventError } = await supabaseClient
    .from('reservation_status_events')
    .insert({
      booking_order_id: order.id,
      event_type: 'admin_booking_changed',
      event_payload: {
        requestedBy: 'admin_web',
        changeType,
        reason: reason || null,
        previous: {
          carId: order.car_id,
          carName: order.pricing_snapshot?.carName || null,
          carNumber: order.pricing_snapshot?.carNumber || null,
          pickupAt: order.pickup_at,
          returnAt: order.return_at,
          amount: keptAmount,
        },
        next: {
          carId: car.id,
          sourceCarId: car.source_car_id || null,
          carName: nextSnapshot.carName || null,
          carNumber: nextSnapshot.carNumber || null,
          pickupAt: searchWindow.startIso,
          returnAt: searchWindow.endIso,
          amount: keptAmount,
        },
        amountPolicy: 'kept_original_booking_amount',
      },
    })

  if (eventError) throw eventError

  return res.status(200).json({
    booking: toAdminBookingDetail(serializeBookingOrder(updatedOrder), updatedOrder),
    change: {
      type: changeType,
      keptAmount,
      amountPolicy: 'kept_original_booking_amount',
    },
  })
}

async function handleRefundComplete(req, res, supabaseClient) {
  const token = String(req.body?.token || '').trim()
  const note = String(req.body?.note || '').trim()
  if (!token) {
    return res.status(400).json({ error: 'missing_token', message: '예약 토큰이 필요합니다.' })
  }

  const lookup = await fetchBookingOrderByConfirmationToken({ supabaseClient, token })
  if (!lookup.ok) {
    return res.status(lookup.status || 400).json({
      error: lookup.code || 'admin_refund_lookup_failed',
      message: lookup.message || '예약 정보를 찾지 못했습니다.',
    })
  }

  const result = await completeRefundForBookingOrder({
    supabaseClient,
    order: lookup.rawBooking,
    requestedBy: 'admin_web',
    eventType: 'admin_refund_completed',
    note,
  })

  if (!result.ok) {
    return res.status(result.status || 400).json({
      error: result.code || 'admin_refund_complete_failed',
      message: result.message || '환불 완료 처리에 실패했습니다.',
      booking: result.booking ? toAdminBookingDetail(result.booking, lookup.rawBooking) : null,
    })
  }

  return res.status(200).json({
    booking: toAdminBookingDetail(result.booking, lookup.rawBooking),
  })
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const supabaseClient = createServerPrivilegedClient()
  if (!supabaseClient) {
    return res.status(500).json({ error: 'supabase_client_unavailable' })
  }

  const accessToken = getAccessTokenFromRequest(req)
  if (!accessToken) {
    return res.status(401).json({ error: 'missing_access_token', message: '로그인이 필요합니다.' })
  }

  try {
    const authUser = await getUserFromAccessToken({ supabaseClient, accessToken })
    if (!authUser) {
      return res.status(401).json({ error: 'invalid_access_token', message: '로그인이 필요합니다.' })
    }

    const access = assertAdminUser(authUser)
    if (!access.ok) {
      return res.status(access.status).json({ error: access.code, message: access.message })
    }

    const action = String(req.query?.action || '').trim().toLowerCase()

    if (req.method === 'GET' && action === 'confirm-target') {
      return handleConfirmTarget(req, res, supabaseClient)
    }

    if (req.method === 'GET' && action === 'change-car-candidates') {
      return handleChangeCarCandidates(req, res, supabaseClient)
    }

    if (req.method === 'POST' && action === 'cancel') {
      return handleCancel(req, res, supabaseClient)
    }

    if (req.method === 'POST' && action === 'refund-complete') {
      return handleRefundComplete(req, res, supabaseClient)
    }

    if (req.method === 'POST' && action === 'change') {
      return handleChange(req, res, supabaseClient)
    }

    if (req.method === 'GET' && !action) {
      return handleList(req, res, supabaseClient)
    }

    return res.status(404).json({ error: 'not_found' })
  } catch (error) {
    return res.status(500).json({
      error: 'admin_bookings_failed',
      message: error?.message || 'admin_bookings_failed',
    })
  }
}
