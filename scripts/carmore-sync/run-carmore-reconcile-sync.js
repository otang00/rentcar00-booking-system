#!/usr/bin/env node
const path = require('path');
const { loadEnvFile } = require('../pricing/lib/loadEnvFile');
const { reconcileCarmoreHolidays } = require('./lib/reconcile-carmore-holidays');

const projectRoot = path.resolve(__dirname, '../..');
loadEnvFile(path.join(projectRoot, '.env'));

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i += 1; }
  }
  return args;
}

async function runCarmoreReconcileSync(options = {}) {
  const shouldSave = options.shouldSave === true || process.env.CARMORE_SYNC_SAVE === 'true';
  return reconcileCarmoreHolidays({
    shouldSave,
    limit: options.limit || process.env.CARMORE_SYNC_LIMIT || 0,
    onlyImsReservationId: options.onlyImsReservationId || process.env.CARMORE_SYNC_ONLY_IMS_RESERVATION_ID || '',
  });
}

async function main() {
  const args = parseArgs();
  const summary = await runCarmoreReconcileSync({
    shouldSave: args.save === true,
    limit: args.limit || 0,
    onlyImsReservationId: args.imsReservationId || args.onlyImsReservationId || '',
  });
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[carmore-reconcile-sync] failed');
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  runCarmoreReconcileSync,
};
