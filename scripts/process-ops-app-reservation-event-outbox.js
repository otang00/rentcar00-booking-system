#!/usr/bin/env node
'use strict'

const { createServerPrivilegedClient } = require('../server/supabase/createServerClient')
const { processOpsAppReservationEventOutbox } = require('../server/notifications/opsAppReservationEventOutbox')

async function main() {
  const limitArg = Number(process.env.OPS_APP_RESERVATION_EVENT_OUTBOX_LIMIT || process.argv[2] || 10)
  const supabaseClient = createServerPrivilegedClient()
  if (!supabaseClient) {
    throw new Error('supabase privileged client is not configured')
  }

  const summary = await processOpsAppReservationEventOutbox({
    supabaseClient,
    limit: limitArg,
  })

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error('[ops-app-reservation-event-outbox] process failed', {
    message: error?.message || 'unknown_error',
  })
  process.exitCode = 1
})
