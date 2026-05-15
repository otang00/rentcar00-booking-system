'use strict'

const {
  filterActiveGuestLookupOrders,
  serializeBookingOrder,
  canGuestCancelBooking,
  resolveCancelSyncStatus,
  resolveCancelledPaymentStatus,
} = require('./guestBookingUtils')
const {
  normalizeCustomerPhone,
  normalizeCustomerBirth,
  hashLookupValue,
  createPublicReservationCode,
  createPaymentReferenceId,
} = require('./bookingIdentity')
const { buildSearchWindow } = require('../search-db/helpers/buildSearchWindow')

const PAYMENT_REFERENCE_UNIQUE_INDEX = 'uq_booking_orders_payment_reference'

function isPaymentReferenceUniqueViolation(error) {
  if (!error) return false

  const details = [
    error.code,
    error.message,
    error.details,
    error.hint,
    error.constraint,
  ].map((value) => String(value || '')).join(' ')

  return error.code === '23505' || details.includes(PAYMENT_REFERENCE_UNIQUE_INDEX)
}

async function fetchCarBySourceCarId({ supabaseClient, sourceCarId } = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const { data, error } = await supabaseClient
    .from('cars')
    .select('*')
    .eq('source_car_id', sourceCarId)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

async function generateUniqueReservationCode({ supabaseClient, now = new Date() } = {}) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = createPublicReservationCode(now)
    const { data, error } = await supabaseClient
      .from('booking_orders')
      .select('id')
      .eq('public_reservation_code', code)
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return code
    }
  }

  throw new Error('reservation_code_generation_failed')
}

async function findBookingOrderByGuestLookup({
  supabaseClient,
  customerName,
  customerPhone,
  customerBirth,
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const normalizedPhone = normalizeCustomerPhone(customerPhone)
  const normalizedBirth = normalizeCustomerBirth(customerBirth)
  const phoneHash = hashLookupValue(`phone:${normalizedPhone}`)
  const birthHash = hashLookupValue(`birth:${normalizedBirth}`)

  const { data: orders, error: orderError } = await supabaseClient
    .from('booking_orders')
    .select('*')
    .eq('customer_name', String(customerName || '').trim())
    .eq('customer_phone_last4', normalizedPhone.slice(-4))
    .order('created_at', { ascending: false })

  if (orderError) {
    throw orderError
  }

  const matchedOrders = Array.isArray(orders) ? orders : []
  if (matchedOrders.length === 0) {
    return { order: null, blockedReason: null }
  }

  const bookingOrderIds = matchedOrders.map((order) => order.id).filter(Boolean)
  const { data: lookupKeys, error: lookupError } = await supabaseClient
    .from('booking_lookup_keys')
    .select('booking_order_id, lookup_type, lookup_value_hash')
    .in('booking_order_id', bookingOrderIds)
    .in('lookup_type', ['customer_phone', 'customer_birth'])

  if (lookupError) {
    throw lookupError
  }

  const keyIndex = (Array.isArray(lookupKeys) ? lookupKeys : []).reduce((acc, item) => {
    if (!acc[item.booking_order_id]) {
      acc[item.booking_order_id] = {}
    }
    acc[item.booking_order_id][item.lookup_type] = item.lookup_value_hash
    return acc
  }, {})

  const exactMatches = matchedOrders.filter((order) => {
    const keys = keyIndex[order.id] || {}
    return keys.customer_phone === phoneHash && keys.customer_birth === birthHash
  })

  if (exactMatches.length === 0) {
    return { order: null, blockedReason: null }
  }

  const guestOrder = exactMatches.find((order) => !order.user_id) || null
  if (guestOrder) {
    return { order: guestOrder, blockedReason: null }
  }

  return { order: null, blockedReason: 'member_booking_only' }
}

async function findGuestBookingOrdersByLookup({
  supabaseClient,
  customerName,
  customerPhone,
  customerBirth,
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const normalizedPhone = normalizeCustomerPhone(customerPhone)
  const normalizedBirth = normalizeCustomerBirth(customerBirth)
  const phoneHash = hashLookupValue(`phone:${normalizedPhone}`)
  const birthHash = hashLookupValue(`birth:${normalizedBirth}`)

  const { data: orders, error: orderError } = await supabaseClient
    .from('booking_orders')
    .select('*')
    .eq('customer_name', String(customerName || '').trim())
    .eq('customer_phone_last4', normalizedPhone.slice(-4))
    .order('created_at', { ascending: false })

  if (orderError) {
    throw orderError
  }

  const matchedOrders = Array.isArray(orders) ? orders : []
  if (matchedOrders.length === 0) {
    return {
      exactMatches: [],
      guestOrders: [],
      memberOrders: [],
      blockedReason: null,
    }
  }

  const bookingOrderIds = matchedOrders.map((order) => order.id).filter(Boolean)
  const { data: lookupKeys, error: lookupError } = await supabaseClient
    .from('booking_lookup_keys')
    .select('booking_order_id, lookup_type, lookup_value_hash')
    .in('booking_order_id', bookingOrderIds)
    .in('lookup_type', ['customer_phone', 'customer_birth'])

  if (lookupError) {
    throw lookupError
  }

  const keyIndex = (Array.isArray(lookupKeys) ? lookupKeys : []).reduce((acc, item) => {
    if (!acc[item.booking_order_id]) {
      acc[item.booking_order_id] = {}
    }
    acc[item.booking_order_id][item.lookup_type] = item.lookup_value_hash
    return acc
  }, {})

  const exactMatches = matchedOrders.filter((order) => {
    const keys = keyIndex[order.id] || {}
    return keys.customer_phone === phoneHash && keys.customer_birth === birthHash
  })

  const guestOrders = exactMatches.filter((order) => !order.user_id)
  const memberOrders = exactMatches.filter((order) => Boolean(order.user_id))

  return {
    exactMatches,
    guestOrders,
    memberOrders,
    blockedReason: guestOrders.length === 0 && memberOrders.length > 0 ? 'member_booking_only' : null,
  }
}

async function findGuestBookingOrdersByPhone({
  supabaseClient,
  customerPhone,
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const normalizedPhone = normalizeCustomerPhone(customerPhone)
  const phoneHash = hashLookupValue(`phone:${normalizedPhone}`)

  const { data: orders, error: orderError } = await supabaseClient
    .from('booking_orders')
    .select('*')
    .eq('customer_phone_last4', normalizedPhone.slice(-4))
    .order('created_at', { ascending: false })

  if (orderError) {
    throw orderError
  }

  const matchedOrders = Array.isArray(orders) ? orders : []
  if (matchedOrders.length === 0) {
    return {
      exactMatches: [],
      guestOrders: [],
      memberOrders: [],
    }
  }

  const bookingOrderIds = matchedOrders.map((order) => order.id).filter(Boolean)
  const { data: lookupKeys, error: lookupError } = await supabaseClient
    .from('booking_lookup_keys')
    .select('booking_order_id, lookup_type, lookup_value_hash')
    .in('booking_order_id', bookingOrderIds)
    .eq('lookup_type', 'customer_phone')

  if (lookupError) {
    throw lookupError
  }

  const keyIndex = (Array.isArray(lookupKeys) ? lookupKeys : []).reduce((acc, item) => {
    acc[item.booking_order_id] = item.lookup_value_hash
    return acc
  }, {})

  const exactMatches = matchedOrders.filter((order) => keyIndex[order.id] === phoneHash)
  const guestOrders = exactMatches.filter((order) => !order.user_id)
  const memberOrders = exactMatches.filter((order) => Boolean(order.user_id))

  return {
    exactMatches,
    guestOrders,
    memberOrders,
  }
}

async function fetchBookingOrderByGuestLookup(params = {}) {
  const result = await findBookingOrderByGuestLookup(params)
  return result.order || null
}

async function fetchBookingOrderByCompletionToken({
  supabaseClient,
  bookingOrderId,
  reservationCode,
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const normalizedBookingOrderId = String(bookingOrderId || '').trim()
  const normalizedReservationCode = String(reservationCode || '').trim().toUpperCase()
  if (!normalizedBookingOrderId || !normalizedReservationCode) {
    return null
  }

  const { data, error } = await supabaseClient
    .from('booking_orders')
    .select('*')
    .eq('id', normalizedBookingOrderId)
    .eq('public_reservation_code', normalizedReservationCode)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? serializeBookingOrder(data) : null
}

async function createGuestBooking({
  supabaseClient,
  bookingInput,
  requestedBy = 'guest',
  authUserId = null,
  now = new Date(),
  paymentProvider = 'surrogate_web',
  paymentReferenceId = null,
  bookingStatus = 'confirmed',
  paymentStatus = 'paid',
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const searchWindow = buildSearchWindow({
    deliveryDateTime: bookingInput.deliveryDateTime,
    returnDateTime: bookingInput.returnDateTime,
  })
  const pickupAtIso = searchWindow.startIso
  const returnAtIso = searchWindow.endIso

  const reservationCode = await generateUniqueReservationCode({ supabaseClient, now })
  const resolvedPaymentProvider = String(paymentProvider || 'surrogate_web').trim() || 'surrogate_web'
  const resolvedPaymentReferenceId = String(paymentReferenceId || '').trim() || createPaymentReferenceId(now)
  const customerPhone = normalizeCustomerPhone(bookingInput.customerPhone)
  const customerBirth = normalizeCustomerBirth(bookingInput.customerBirth)
  const phoneLast4 = customerPhone.slice(-4)

  const pickupLocationSnapshot = {
    pickupOption: bookingInput.pickupOption,
    deliveryAddress: bookingInput.deliveryAddress || '',
    deliveryAddressDetail: bookingInput.deliveryAddressDetail || '',
  }
  const returnLocationSnapshot = {
    pickupOption: bookingInput.pickupOption,
    deliveryAddress: bookingInput.deliveryAddress || '',
    deliveryAddressDetail: bookingInput.deliveryAddressDetail || '',
  }

  const rpcPayload = {
    source_car_id: Number(bookingInput.carId),
    auth_user_id: authUserId || null,
    requested_by: requestedBy,
    public_reservation_code: reservationCode,
    payment_provider: resolvedPaymentProvider,
    payment_reference_id: resolvedPaymentReferenceId,
    booking_status: String(bookingStatus || 'confirmed').trim() || 'confirmed',
    payment_status: String(paymentStatus || 'paid').trim() || 'paid',
    customer_name: bookingInput.customerName,
    customer_phone: customerPhone,
    customer_phone_last4: phoneLast4,
    customer_birth: customerBirth,
    customer_birth_last4: customerBirth.slice(-4),
    lookup_phone_hash: hashLookupValue(`phone:${customerPhone}`),
    lookup_birth_hash: hashLookupValue(`birth:${customerBirth}`),
    pickup_at: pickupAtIso,
    return_at: returnAtIso,
    pickup_method: bookingInput.pickupOption,
    pickup_location_snapshot: pickupLocationSnapshot,
    return_location_snapshot: returnLocationSnapshot,
    quoted_total_amount: bookingInput.quotedTotalAmount,
    rental_amount: bookingInput.rentalAmount,
    insurance_amount: bookingInput.insuranceAmount,
    delivery_amount: bookingInput.deliveryAmount,
    final_amount: bookingInput.finalAmount,
    payment_method: bookingInput.paymentMethod || null,
  }

  const { data: rpcResult, error: rpcError } = await supabaseClient
    .rpc('create_booking_order_after_payment_v1', { payload: rpcPayload })

  if (rpcError) {
    if (isPaymentReferenceUniqueViolation(rpcError)) {
      const existingOrder = await fetchBookingOrderByPaymentReference({
        supabaseClient,
        paymentProvider: resolvedPaymentProvider,
        paymentReferenceId: resolvedPaymentReferenceId,
      })

      if (existingOrder) {
        return {
          ok: true,
          status: 200,
          booking: serializeBookingOrder(existingOrder),
          deduped: true,
        }
      }
    }

    throw rpcError
  }

  if (!rpcResult || rpcResult.ok === false) {
    return {
      ok: false,
      code: rpcResult?.code || 'booking_create_failed',
      status: rpcResult?.status || 500,
      message: rpcResult?.message || '예약 생성에 실패했습니다.',
      conflicts: rpcResult?.conflicts || null,
    }
  }

  return {
    ok: true,
    status: rpcResult.status || (rpcResult.deduped ? 200 : 201),
    booking: serializeBookingOrder(rpcResult.booking_order || {}),
    deduped: Boolean(rpcResult.deduped),
  }
}

async function fetchBookingOrderByPaymentReference({
  supabaseClient,
  paymentProvider,
  paymentReferenceId,
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const normalizedProvider = String(paymentProvider || '').trim()
  const normalizedReferenceId = String(paymentReferenceId || '').trim()

  if (!normalizedProvider || !normalizedReferenceId) {
    return null
  }

  const { data, error } = await supabaseClient
    .from('booking_orders')
    .select('*')
    .eq('payment_provider', normalizedProvider)
    .eq('payment_reference_id', normalizedReferenceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

async function fetchBookingOrderByMemberReservationCode({
  supabaseClient,
  authUserId,
  reservationCode,
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  if (!authUserId || !reservationCode) {
    return null
  }

  const { data, error } = await supabaseClient
    .from('booking_orders')
    .select('*')
    .eq('user_id', authUserId)
    .eq('public_reservation_code', String(reservationCode || '').trim().toUpperCase())
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

async function fetchActiveReservationMapping({ supabaseClient, bookingOrderId } = {}) {
  if (!supabaseClient || !bookingOrderId) {
    return null
  }

  const { data, error } = await supabaseClient
    .from('reservation_mappings')
    .select('*')
    .eq('booking_order_id', bookingOrderId)
    .neq('mapping_status', 'closed')
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

async function lookupGuestBooking({
  supabaseClient,
  customerPhone,
} = {}) {
  const lookupResult = await findGuestBookingOrdersByPhone({
    supabaseClient,
    customerPhone,
  })

  return {
    bookings: filterActiveGuestLookupOrders(lookupResult.guestOrders).map((order) => serializeBookingOrder(order)),
  }
}

async function cancelBookingOrder({
  supabaseClient,
  order,
  requestedBy = 'guest',
  eventType = 'guest_cancelled',
  reason = '',
  allowStartedCancel = false,
  allowedBookingStatuses,
  now = new Date(),
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  if (!order?.id) {
    return {
      ok: false,
      code: 'booking_not_found',
      status: 404,
      message: '예약 정보를 찾을 수 없습니다.',
    }
  }

  const cancelCheck = canGuestCancelBooking(order, now, {
    allowStartedBooking: allowStartedCancel,
    allowedBookingStatuses,
  })
  if (!cancelCheck.ok) {
    return {
      ok: false,
      code: cancelCheck.reason,
      status: 409,
      message: cancelCheck.message,
      booking: serializeBookingOrder(order),
    }
  }

  const activeMapping = await fetchActiveReservationMapping({
    supabaseClient,
    bookingOrderId: order.id,
  })
  const nextSyncStatus = resolveCancelSyncStatus({
    order,
    hasActiveMapping: Boolean(activeMapping),
  })
  const nextPaymentStatus = resolveCancelledPaymentStatus(order)
  const cancelledAt = now.toISOString()

  const { data: updatedOrder, error: updateError } = await supabaseClient
    .from('booking_orders')
    .update({
      booking_status: 'cancelled',
      payment_status: nextPaymentStatus,
      sync_status: nextSyncStatus,
      cancelled_at: cancelledAt,
    })
    .eq('id', order.id)
    .select('*')
    .single()

  if (updateError) {
    throw updateError
  }

  if (activeMapping && nextSyncStatus === 'cancel_sync_pending') {
    const { error: mappingError } = await supabaseClient
      .from('reservation_mappings')
      .update({
        mapping_status: 'cancel_pending',
        last_sync_attempt_at: cancelledAt,
      })
      .eq('id', activeMapping.id)

    if (mappingError) {
      throw mappingError
    }
  }

  const { error: eventError } = await supabaseClient
    .from('reservation_status_events')
    .insert({
      booking_order_id: order.id,
      event_type: eventType,
      event_payload: {
        requestedBy,
        reason: String(reason || '').trim() || null,
        previousBookingStatus: order.booking_status || null,
        previousPaymentStatus: order.payment_status || null,
        previousSyncStatus: order.sync_status || null,
        allowStartedCancel: Boolean(allowStartedCancel),
        nextPaymentStatus,
        nextSyncStatus,
        hasActiveMapping: Boolean(activeMapping),
      },
    })

  if (eventError) {
    throw eventError
  }

  return {
    ok: true,
    status: 200,
    booking: serializeBookingOrder(updatedOrder),
    mapping: activeMapping
      ? {
        externalSystem: activeMapping.external_system || null,
        externalReservationId: activeMapping.external_reservation_id || null,
        imsReservationId: activeMapping.ims_reservation_id || null,
        mappingStatus: 'cancel_pending',
      }
      : null,
  }
}

async function completeRefundForBookingOrder({
  supabaseClient,
  order,
  requestedBy = 'admin',
  eventType = 'refund_completed',
  note = '',
  now = new Date(),
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  if (!order?.id) {
    return {
      ok: false,
      code: 'booking_not_found',
      status: 404,
      message: '예약 정보를 찾을 수 없습니다.',
    }
  }

  if (String(order.booking_status || '') !== 'cancelled') {
    return {
      ok: false,
      code: 'refund_not_allowed_status',
      status: 409,
      message: '취소된 예약만 환불 완료 처리할 수 있습니다.',
      booking: serializeBookingOrder(order),
    }
  }

  if (String(order.payment_status || '') !== 'refund_pending') {
    return {
      ok: false,
      code: 'refund_not_allowed_payment_status',
      status: 409,
      message: '환불 처리 중인 예약만 환불 완료 처리할 수 있습니다.',
      booking: serializeBookingOrder(order),
    }
  }

  const refundedAt = now.toISOString()
  const { data: updatedOrder, error: updateError } = await supabaseClient
    .from('booking_orders')
    .update({
      payment_status: 'refunded',
      updated_at: refundedAt,
    })
    .eq('id', order.id)
    .eq('payment_status', 'refund_pending')
    .select('*')
    .single()

  if (updateError) {
    throw updateError
  }

  const { error: eventError } = await supabaseClient
    .from('reservation_status_events')
    .insert({
      booking_order_id: order.id,
      event_type: eventType,
      event_payload: {
        requestedBy,
        note: String(note || '').trim() || null,
        previousBookingStatus: order.booking_status || null,
        previousPaymentStatus: order.payment_status || null,
        nextBookingStatus: 'cancelled',
        nextPaymentStatus: 'refunded',
      },
    })

  if (eventError) {
    throw eventError
  }

  return {
    ok: true,
    status: 200,
    booking: serializeBookingOrder(updatedOrder),
  }
}

async function cancelGuestBooking({
  supabaseClient,
  customerPhone,
  reservationCode,
  requestedBy = 'guest',
  reason = '',
  now = new Date(),
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const lookupResult = await findGuestBookingOrdersByPhone({
    supabaseClient,
    customerPhone,
  })

  const normalizedReservationCode = String(reservationCode || '').trim().toUpperCase()
  const order = lookupResult.guestOrders.find((item) => String(item.public_reservation_code || '').trim().toUpperCase() === normalizedReservationCode) || null
  if (!order) {
    return {
      ok: false,
      code: 'booking_not_found',
      status: 404,
      message: '일치하는 예약을 찾을 수 없습니다.',
    }
  }

  return cancelBookingOrder({
    supabaseClient,
    order,
    requestedBy,
    eventType: 'guest_cancelled',
    reason,
    now,
  })
}

async function cancelMemberBooking({
  supabaseClient,
  authUserId,
  reservationCode,
  requestedBy = 'member',
  reason = '',
  now = new Date(),
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const order = await fetchBookingOrderByMemberReservationCode({
    supabaseClient,
    authUserId,
    reservationCode,
  })

  if (!order) {
    return {
      ok: false,
      code: 'booking_not_found',
      status: 404,
      message: '예약 정보를 찾지 못했습니다.',
    }
  }

  return cancelBookingOrder({
    supabaseClient,
    order,
    requestedBy,
    eventType: 'member_cancelled',
    reason,
    now,
  })
}

async function attachGuestBookingsToMember({
  supabaseClient,
  authUserId,
  customerPhone,
  requestedBy = 'signup',
  now = new Date(),
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const normalizedPhone = normalizeCustomerPhone(customerPhone)
  if (!authUserId || !/^01\d{8,9}$/.test(normalizedPhone)) {
    return { updatedCount: 0, bookings: [] }
  }

  const nowIso = now.toISOString()
  const { data: candidateOrders, error: candidateError } = await supabaseClient
    .from('booking_orders')
    .select('*')
    .is('user_id', null)
    .eq('customer_phone_last4', normalizedPhone.slice(-4))
    .gt('return_at', nowIso)
    .order('created_at', { ascending: false })

  if (candidateError) {
    throw candidateError
  }

  const candidates = (Array.isArray(candidateOrders) ? candidateOrders : [])
    .filter((order) => !['cancelled', 'completed'].includes(String(order?.booking_status || '')))
  if (candidates.length === 0) {
    return { updatedCount: 0, bookings: [] }
  }

  const bookingOrderIds = candidates.map((order) => order.id).filter(Boolean)
  const { data: lookupKeys, error: lookupError } = await supabaseClient
    .from('booking_lookup_keys')
    .select('booking_order_id, lookup_value_hash')
    .in('booking_order_id', bookingOrderIds)
    .eq('lookup_type', 'customer_phone')

  if (lookupError) {
    throw lookupError
  }

  const phoneHash = hashLookupValue(`phone:${normalizedPhone}`)
  const matchedIds = (Array.isArray(lookupKeys) ? lookupKeys : [])
    .filter((item) => item.lookup_value_hash === phoneHash)
    .map((item) => item.booking_order_id)

  const matchedOrders = candidates.filter((order) => matchedIds.includes(order.id))
    .filter((order) => !order.cancelled_at && !order.completed_at)

  if (matchedOrders.length === 0) {
    return { updatedCount: 0, bookings: [] }
  }

  const matchedOrderIds = matchedOrders.map((order) => order.id)
  const { data: updatedOrders, error: updateError } = await supabaseClient
    .from('booking_orders')
    .update({
      user_id: authUserId,
      updated_at: nowIso,
    })
    .in('id', matchedOrderIds)
    .is('user_id', null)
    .select('*')

  if (updateError) {
    throw updateError
  }

  const normalizedUpdatedOrders = Array.isArray(updatedOrders) ? updatedOrders : []
  if (normalizedUpdatedOrders.length > 0) {
    const events = normalizedUpdatedOrders.map((order) => ({
      booking_order_id: order.id,
      event_type: 'guest_booking_attached_to_member',
      event_payload: {
        requestedBy,
        authUserId,
        customerPhone: normalizedPhone,
      },
    }))

    const { error: eventError } = await supabaseClient
      .from('reservation_status_events')
      .insert(events)

    if (eventError) {
      throw eventError
    }
  }

  return {
    updatedCount: normalizedUpdatedOrders.length,
    bookings: normalizedUpdatedOrders.map((order) => serializeBookingOrder(order)),
  }
}

module.exports = {
  fetchCarBySourceCarId,
  findBookingOrderByGuestLookup,
  findGuestBookingOrdersByLookup,
  findGuestBookingOrdersByPhone,
  fetchBookingOrderByGuestLookup,
  fetchBookingOrderByCompletionToken,
  fetchBookingOrderByMemberReservationCode,
  fetchBookingOrderByPaymentReference,
  fetchActiveReservationMapping,
  createGuestBooking,
  lookupGuestBooking,
  cancelBookingOrder,
  completeRefundForBookingOrder,
  cancelGuestBooking,
  cancelMemberBooking,
  attachGuestBookingsToMember,
}
