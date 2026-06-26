const { getSupabaseAdmin } = require('../../ims-sync/lib/supabase-admin');

function normalizeRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    syncMode: row.sync_mode || 'dry-run',
    status: row.status || 'unknown',
    startedAt: row.started_at || null,
    finishedAt: row.finished_at || null,
    desiredCount: Number(row.desired_count || 0),
    actualCount: Number(row.actual_count || 0),
    additionsCount: Number(row.additions_count || 0),
    deletionsCount: Number(row.deletions_count || 0),
    changesCount: Number(row.changes_count || 0),
    unchangedCount: Number(row.unchanged_count || 0),
    failedCount: Number(row.failed_count || 0),
    errorSummary: row.error_summary || '',
  };
}

async function createRun({ syncMode = 'dry-run', supabaseClient } = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  const { data, error } = await supabase
    .from('carmore_sync_runs')
    .insert({ sync_mode: syncMode, status: 'running' })
    .select('*')
    .single();
  if (error) {
    const message = String(error.message || '');
    if (message.includes('carmore_sync_runs')) {
      return normalizeRun({ id: 'local-dry-run', sync_mode: syncMode, status: 'running' });
    }
    throw error;
  }
  return normalizeRun(data);
}

async function finishRun({ runId, status, summary, errorSummary = '', supabaseClient } = {}) {
  if (String(runId) === 'local-dry-run') {
    return normalizeRun({ id: runId, sync_mode: 'dry-run', status: status || 'success', finished_at: new Date().toISOString(), desired_count: summary?.desiredCount, actual_count: summary?.actualCount, additions_count: summary?.additionsCount, deletions_count: summary?.deletionsCount, changes_count: summary?.changesCount, unchanged_count: summary?.unchangedCount, failed_count: summary?.errorsCount, error_summary: errorSummary || summary?.results?.errors?.[0]?.error || null });
  }
  const supabase = supabaseClient || getSupabaseAdmin();
  const payload = {
    status: status || 'success',
    finished_at: new Date().toISOString(),
    desired_count: Number(summary?.desiredCount || 0),
    actual_count: Number(summary?.actualCount || 0),
    additions_count: Number(summary?.additionsCount || 0),
    deletions_count: Number(summary?.deletionsCount || 0),
    changes_count: Number(summary?.changesCount || 0),
    unchanged_count: Number(summary?.unchangedCount || 0),
    failed_count: Number(summary?.errorsCount || 0),
    error_summary: errorSummary || summary?.results?.errors?.[0]?.error || null,
  };
  const { data, error } = await supabase
    .from('carmore_sync_runs')
    .update(payload)
    .eq('id', String(runId))
    .select('*')
    .single();
  if (error) throw error;
  return normalizeRun(data);
}

module.exports = {
  createRun,
  finishRun,
  normalizeRun,
};
