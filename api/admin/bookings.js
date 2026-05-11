'use strict'

const { createServerPrivilegedClient } = require('../../server/supabase/createServerClient')
const { getAccessTokenFromRequest } = require('../../server/auth/getAccessTokenFromRequest')
const { getUserFromAccessToken } = require('../../server/auth/getUserFromAccessToken')
const { assertAdminUser } = require('../../server/auth/adminAccess')
const { serializeBookingOrder } = require('../../server/booking-core/guestBookingUtils')
const { fetchBookingOrderByConfirmationToken } = require('../../server/booking-core/bookingConfirmationService')
const { cancelBookingOrder, completeRefundForBookingOrder } = require('../../server/booking-core/guestBookingService')
const { createBookingConfirmToken } = require('../../server/security/bookingConfirmToken')

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

function toAdminBookingItem(order, fallbackCarNumberById = new Map()) {
  const item = serializeBookingOrder(order)
  const fallbackCarNumber = fallbackCarNumberById.get(Number(order?.car_id)) || ''
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
    .map((row) => Number(row.car_id))
    .filter(Number.isFinite)

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

  return new Map((Array.isArray(data) ? data : []).map((row) => [Number(row.id), String(row.car_number || '')]))
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

  const [fallbackCarNumberById, latestImsSync, latestZzimcarSync] = await Promise.all([
    fetchFallbackCarNumbers({ supabaseClient, rows: data }),
    fetchLatestImsReservationSync({ supabaseClient }),
    fetchLatestZzimcarSync({ supabaseClient }),
  ])

  const [imsSyncErrors, zzimcarSyncErrors] = await Promise.all([
    fetchLatestImsReservationSyncErrors({ supabaseClient, syncRunId: latestImsSync?.id }),
    fetchLatestZzimcarSyncErrors({ supabaseClient, latestSync: latestZzimcarSync }),
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

  return res.status(200).json({ booking: result.booking })
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
      booking: result.booking || null,
    })
  }

  return res.status(200).json({
    booking: result.booking,
    mapping: result.mapping || null,
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
      booking: result.booking || null,
    })
  }

  return res.status(200).json({
    booking: result.booking,
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

    if (req.method === 'POST' && action === 'cancel') {
      return handleCancel(req, res, supabaseClient)
    }

    if (req.method === 'POST' && action === 'refund-complete') {
      return handleRefundComplete(req, res, supabaseClient)
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
