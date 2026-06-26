'use strict'

function resolveProfileStatus({ existingProfile, authUser } = {}) {
  if (existingProfile?.profile_status === 'blocked' || existingProfile?.profile_status === 'withdrawn') {
    return existingProfile.profile_status
  }

  const phoneVerified = Boolean(existingProfile?.phone_verified || authUser?.user_metadata?.phone_verified)
  const profileFields = {
    name: existingProfile?.name || authUser?.user_metadata?.name || authUser?.user_metadata?.full_name,
    birthDate: existingProfile?.birth_date || authUser?.user_metadata?.birth_date,
    phone: existingProfile?.phone || authUser?.user_metadata?.phone || authUser?.phone,
    postalCode: existingProfile?.postal_code || authUser?.user_metadata?.postal_code,
    addressMain: existingProfile?.address_main || authUser?.user_metadata?.address_main,
    addressDetail: existingProfile?.address_detail || authUser?.user_metadata?.address_detail,
  }
  const hasRequiredProfile = Object.values(profileFields).every(Boolean)

  if (!hasRequiredProfile) {
    return 'incomplete'
  }

  if (!phoneVerified) {
    return 'phone_unverified'
  }

  if (phoneVerified) {
    return 'active'
  }

  return existingProfile?.profile_status || 'incomplete'
}

async function ensureProfileForUser({ supabaseClient, authUser } = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  if (!authUser?.id) {
    throw new Error('auth user is required')
  }

  const { data: existingProfile } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle()

  const userMetadata = authUser.user_metadata || {}
  const payload = {
    id: authUser.id,
    email: authUser.email || existingProfile?.email || null,
    name: existingProfile?.name || userMetadata.name || userMetadata.full_name || null,
    birth_date: existingProfile?.birth_date || userMetadata.birth_date || null,
    phone: existingProfile?.phone || authUser.phone || userMetadata.phone || null,
    phone_verified: Boolean(existingProfile?.phone_verified || userMetadata.phone_verified),
    phone_verified_at: existingProfile?.phone_verified_at || userMetadata.phone_verified_at || null,
    postal_code: existingProfile?.postal_code || userMetadata.postal_code || null,
    address_main: existingProfile?.address_main || userMetadata.address_main || null,
    address_detail: existingProfile?.address_detail || userMetadata.address_detail || null,
    marketing_agree: existingProfile?.marketing_agree ?? Boolean(userMetadata.marketing_agree),
    profile_status: resolveProfileStatus({ existingProfile, authUser }),
  }

  const { data, error } = await supabaseClient
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

function serializeProfile(profile = {}) {
  return {
    id: profile.id || null,
    email: profile.email || null,
    authPhone: profile.phone || null,
    name: profile.name || null,
    birthDate: profile.birth_date || null,
    phone: profile.phone || null,
    phoneVerified: Boolean(profile.phone_verified),
    phoneVerifiedAt: profile.phone_verified_at || null,
    postalCode: profile.postal_code || null,
    addressMain: profile.address_main || null,
    addressDetail: profile.address_detail || null,
    profileStatus: profile.profile_status || null,
    marketingAgree: Boolean(profile.marketing_agree),
    createdAt: profile.created_at || null,
    updatedAt: profile.updated_at || null,
  }
}

module.exports = {
  ensureProfileForUser,
  serializeProfile,
}
