const { createClient } = require('@supabase/supabase-js');

function resolveSupabaseUrl(env = process.env) {
  if (env.SUPABASE_URL && String(env.SUPABASE_URL).trim()) {
    return String(env.SUPABASE_URL).trim();
  }

  if (env.SUPABASE_PROJECT_REF && String(env.SUPABASE_PROJECT_REF).trim()) {
    return `https://${String(env.SUPABASE_PROJECT_REF).trim()}.supabase.co`;
  }

  return '';
}

function hasSupabaseConfig() {
  return Boolean(resolveSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseAdmin() {
  const url = resolveSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL or SUPABASE_PROJECT_REF is required');
  }

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

module.exports = {
  getSupabaseAdmin,
  hasSupabaseConfig,
  resolveSupabaseUrl,
};
