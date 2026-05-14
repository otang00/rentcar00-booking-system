'use strict'

const { normalizePhoneNumber } = require('./phoneOtp')

async function findMemberProfileByPhone({ supabaseClient, phone } = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const normalizedPhone = normalizePhoneNumber(phone)
  if (!/^01\d{8,9}$/.test(normalizedPhone)) {
    return null
  }

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, phone, name, email, profile_status')
    .eq('phone', normalizedPhone)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

function getMemberPhoneBlockMessage(purpose) {
  if (purpose === 'guest_lookup') {
    return '회원 예약은 로그인 후 예약내역에서 확인해 주세요.'
  }

  return '이미 가입된 휴대폰 번호입니다. 로그인 후 진행해 주세요.'
}

module.exports = {
  findMemberProfileByPhone,
  getMemberPhoneBlockMessage,
}
