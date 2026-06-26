'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createServerPrivilegedClient,
  createServerPublicClient,
  resolveSupabaseUrl,
  resolveSupabasePrivilegedKey,
  resolveSupabasePublicKey,
} = require('../createServerClient')

test('resolveSupabaseUrl prefers explicit url', () => {
  const env = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PROJECT_REF: 'ignored',
  }
  assert.equal(resolveSupabaseUrl(env), 'https://example.supabase.co')
})

test('resolveSupabasePrivilegedKey uses only privileged candidates', () => {
  const env = {
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_SERVICE_KEY: 'service-key',
    SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  }
  assert.equal(resolveSupabasePrivilegedKey(env), 'service-key')
})

test('resolveSupabasePublicKey uses only public candidates', () => {
  const env = {
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    SUPABASE_ANON_KEY: 'anon-key',
  }
  assert.equal(resolveSupabasePublicKey(env), 'publishable-key')
})

test('server clients return null when config missing', () => {
  assert.equal(createServerPrivilegedClient({ url: '', key: '' }), null)
  assert.equal(createServerPublicClient({ url: '', key: '' }), null)
})
