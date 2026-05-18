import { createClient } from '@supabase/supabase-js'

// Browser-side Supabase Auth uses Vite build-time public envs.
// These values are intentionally embedded in the frontend bundle and must be
// present before `vite build`; privileged server keys must never be used here.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabaseClientMissingEnv = [
  ['VITE_SUPABASE_URL', supabaseUrl],
  ['VITE_SUPABASE_ANON_KEY', supabaseAnonKey],
]
  .filter(([, value]) => !value)
  .map(([name]) => name)

export const isSupabaseClientReady = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseClientReady
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
