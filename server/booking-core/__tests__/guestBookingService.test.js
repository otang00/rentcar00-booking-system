'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { createGuestBooking } = require('../guestBookingService')

function readPr4Migration() {
  return fs.readFileSync(
    path.join(__dirname, '../../../supabase/migrations/20260515160000_add_booking_creation_advisory_lock.sql'),
    'utf8',
  )
}

function createBookingOrder(overrides = {}) {
  return {
    id: 'booking-1',
    public_reservation_code: 'R202605150001',
    customer_name: '홍길동',
    customer_phone: '01012345678',
    customer_phone_last4: '5678',
    pickup_at: '2026-05-20T01:00:00.000Z',
    return_at: '2026-05-21T01:00:00.000Z',
    pickup_method: 'pickup',
    quoted_total_amount: 100000,
    pricing_snapshot: { carName: '테스트 차량', customerBirth: '19900101' },
    booking_status: 'confirmed',
    payment_status: 'paid',
    sync_status: 'not_required',
    manual_review_required: false,
    created_at: '2026-05-15T00:00:00.000Z',
    updated_at: '2026-05-15T00:00:00.000Z',
    ...overrides,
  }
}

function createQueryResult(resultFactory) {
  const state = {
    table: '',
    filters: [],
  }

  const builder = {
    select() { return builder },
    eq(column, value) {
      state.filters.push({ column, value })
      return builder
    },
    order() { return builder },
    limit() { return builder },
    maybeSingle() {
      return Promise.resolve(resultFactory({ ...state, terminal: 'maybeSingle' }))
    },
  }

  return { builder, state }
}

function createFakeSupabase({ rpcResult, rpcError = null, existingOrder = null } = {}) {
  const calls = []

  return {
    calls,
    rpc(functionName, args) {
      calls.push({ type: 'rpc', functionName, args })
      return Promise.resolve({ data: rpcResult, error: rpcError })
    },
    from(table) {
      const query = createQueryResult((state) => {
        calls.push({ type: 'from', table, ...state })

        if (table === 'booking_orders') {
          const paymentProviderFilter = state.filters.some((filter) => filter.column === 'payment_provider')
          if (paymentProviderFilter) {
            return { data: existingOrder, error: null }
          }
          return { data: null, error: null }
        }

        return { data: null, error: null }
      })
      return query.builder
    },
  }
}

function baseBookingInput(overrides = {}) {
  return {
    carId: 101,
    deliveryDateTime: '2026-05-20 10:00',
    returnDateTime: '2026-05-21 10:00',
    customerName: '홍길동',
    customerPhone: '01012345678',
    customerBirth: '19900101',
    pickupOption: 'pickup',
    quotedTotalAmount: 100000,
    rentalAmount: 90000,
    insuranceAmount: 10000,
    deliveryAmount: 0,
    finalAmount: 100000,
    paymentMethod: 'card',
    ...overrides,
  }
}

async function callCreateGuestBooking(supabaseClient, overrides = {}) {
  return createGuestBooking({
    supabaseClient,
    bookingInput: baseBookingInput(overrides.bookingInput),
    requestedBy: 'guest_web',
    paymentProvider: 'nhn_kcp',
    paymentReferenceId: 'TNO-1',
    now: new Date('2026-05-15T00:00:00.000Z'),
    ...overrides.options,
  })
}

test('createGuestBooking creates booking through RPC transaction payload', async () => {
  const bookingOrder = createBookingOrder()
  const supabaseClient = createFakeSupabase({
    rpcResult: {
      ok: true,
      status: 201,
      deduped: false,
      booking_order: bookingOrder,
    },
  })

  const result = await callCreateGuestBooking(supabaseClient)

  assert.equal(result.ok, true)
  assert.equal(result.status, 201)
  assert.equal(result.deduped, false)
  assert.equal(result.booking.id, bookingOrder.id)

  const rpcCall = supabaseClient.calls.find((call) => call.type === 'rpc')
  assert.equal(rpcCall.functionName, 'create_booking_order_after_payment_v1')
  assert.equal(rpcCall.args.payload.source_car_id, 101)
  assert.equal(rpcCall.args.payload.payment_provider, 'nhn_kcp')
  assert.equal(rpcCall.args.payload.payment_reference_id, 'TNO-1')
  assert.equal(rpcCall.args.payload.customer_phone_last4, '5678')
  assert.equal(rpcCall.args.payload.pickup_at, '2026-05-20T01:00:00.000Z')
  assert.equal(rpcCall.args.payload.return_at, '2026-05-21T01:00:00.000Z')
})

test('createGuestBooking returns rollback failure when lookup key insert fails inside RPC', async () => {
  const supabaseClient = createFakeSupabase({
    rpcResult: {
      ok: false,
      status: 500,
      code: 'booking_transaction_failed',
      message: '예약 생성 저장 중 오류가 발생했습니다.',
    },
  })

  const result = await callCreateGuestBooking(supabaseClient)

  assert.equal(result.ok, false)
  assert.equal(result.status, 500)
  assert.equal(result.code, 'booking_transaction_failed')
  assert.equal(supabaseClient.calls.filter((call) => call.type === 'rpc').length, 1)
})

test('createGuestBooking returns rollback failure when event insert fails inside RPC', async () => {
  const supabaseClient = createFakeSupabase({
    rpcResult: {
      ok: false,
      status: 500,
      code: 'booking_transaction_failed',
      message: '예약 생성 저장 중 오류가 발생했습니다.',
    },
  })

  const result = await callCreateGuestBooking(supabaseClient)

  assert.equal(result.ok, false)
  assert.equal(result.status, 500)
  assert.equal(result.code, 'booking_transaction_failed')
})

test('createGuestBooking does not create booking when availability fails inside RPC', async () => {
  const supabaseClient = createFakeSupabase({
    rpcResult: {
      ok: false,
      status: 409,
      code: 'booking_unavailable',
      message: '방금 다른 예약과 겹쳐 해당 차량 예약이 불가합니다. 다시 검색해 주세요.',
      conflicts: { bookingOrders: 1, imsReservations: 0 },
    },
  })

  const result = await callCreateGuestBooking(supabaseClient)

  assert.equal(result.ok, false)
  assert.equal(result.status, 409)
  assert.equal(result.code, 'booking_unavailable')
  assert.deepEqual(result.conflicts, { bookingOrders: 1, imsReservations: 0 })
})

test('createGuestBooking does not create booking for inactive or missing car', async () => {
  const supabaseClient = createFakeSupabase({
    rpcResult: {
      ok: false,
      status: 404,
      code: 'car_not_found',
      message: '예약 차량 정보를 찾을 수 없습니다.',
    },
  })

  const result = await callCreateGuestBooking(supabaseClient)

  assert.equal(result.ok, false)
  assert.equal(result.status, 404)
  assert.equal(result.code, 'car_not_found')
})

test('createGuestBooking rejects invalid pickup and return period before RPC', async () => {
  const supabaseClient = createFakeSupabase({ rpcResult: { ok: true } })

  await assert.rejects(
    () => callCreateGuestBooking(supabaseClient, {
      bookingInput: {
        deliveryDateTime: '2026-05-21 10:00',
        returnDateTime: '2026-05-20 10:00',
      },
    }),
    /invalid search window/,
  )

  assert.equal(supabaseClient.calls.filter((call) => call.type === 'rpc').length, 0)
})

test('createGuestBooking returns existing booking when payment reference is deduped by RPC', async () => {
  const existingOrder = createBookingOrder({ id: 'booking-existing' })
  const supabaseClient = createFakeSupabase({
    rpcResult: {
      ok: true,
      status: 200,
      deduped: true,
      booking_order: existingOrder,
    },
  })

  const result = await callCreateGuestBooking(supabaseClient)

  assert.equal(result.ok, true)
  assert.equal(result.status, 200)
  assert.equal(result.deduped, true)
  assert.equal(result.booking.id, existingOrder.id)
})

test('createGuestBooking returns existing booking when RPC reports payment reference unique violation', async () => {
  const existingOrder = createBookingOrder({ id: 'booking-existing' })
  const supabaseClient = createFakeSupabase({
    rpcError: {
      code: '23505',
      message: 'duplicate key value violates unique constraint "uq_booking_orders_payment_reference"',
    },
    existingOrder,
  })

  const result = await callCreateGuestBooking(supabaseClient)

  assert.equal(result.ok, true)
  assert.equal(result.status, 200)
  assert.equal(result.deduped, true)
  assert.equal(result.booking.id, existingOrder.id)

})

test('PR4 RPC uses vehicle-scoped transaction advisory lock before overlap checks', () => {
  const sql = readPr4Migration()

  const carLookupIndex = sql.indexOf('where source_car_id = v_source_car_id')
  const paymentDedupeIndex = sql.indexOf('where payment_provider = v_payment_provider')
  const lockIndex = sql.indexOf("perform pg_advisory_xact_lock(")
  const bookingOverlapIndex = sql.indexOf('from public.booking_orders\n  where car_id = v_car.id')
  const imsOverlapIndex = sql.indexOf('from public.ims_sync_reservations')

  assert.ok(carLookupIndex > -1)
  assert.ok(paymentDedupeIndex > carLookupIndex)
  assert.ok(lockIndex > paymentDedupeIndex)
  assert.ok(bookingOverlapIndex > lockIndex)
  assert.ok(imsOverlapIndex > bookingOverlapIndex)
  assert.match(sql, /pg_advisory_xact_lock\(\s*hashtextextended\('rentcar00:booking:car:' \|\| v_car\.id::text, 0\)/)
})

test('PR4 RPC rechecks confirmed booking and IMS overlaps with end-exclusive boundaries after lock', () => {
  const sql = readPr4Migration()
  const afterLock = sql.slice(sql.indexOf('perform pg_advisory_xact_lock('))

  assert.match(afterLock, /from public\.booking_orders\s+where car_id = v_car\.id\s+and booking_status = 'confirmed'\s+and pickup_at < v_return_at\s+and return_at > v_pickup_at/)
  assert.match(afterLock, /from public\.ims_sync_reservations\s+where car_id = v_car\.source_car_id::text\s+and start_at < v_return_at\s+and end_at > v_pickup_at/)
  assert.doesNotMatch(afterLock, /booking_status\s+in\s*\(/i)
})

test('PR4 RPC keeps scope narrow without exclusion constraint, extension, ledger, or non-transaction lock', () => {
  const sql = readPr4Migration()

  assert.doesNotMatch(sql, /create\s+extension/i)
  assert.doesNotMatch(sql, /btree_gist/i)
  assert.doesNotMatch(sql, /exclude\s+using/i)
  assert.doesNotMatch(sql, /ledger/i)
  assert.doesNotMatch(sql, /pg_advisory_lock\s*\(/)
})
