'use strict'

async function getUserFromAccessToken({ supabaseClient, accessToken } = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  if (!accessToken) {
    return null
  }

  const { data, error } = await supabaseClient.auth.getUser(accessToken)
  if (error) {
    return null
  }

  return data?.user || null
}

module.exports = {
  getUserFromAccessToken,
}
