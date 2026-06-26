#!/usr/bin/env node
const path = require('path');
const { loadEnvFile } = require('../pricing/lib/loadEnvFile');
const { reconcileZzimcarDisableTimes } = require('./lib/reconcile-zzimcar-disable-times');
const projectRoot = path.resolve(__dirname, '../..');
loadEnvFile(path.join(projectRoot, '.env'));

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

async function runZzimcarReconcileSync(options = {}) {
  const shouldSave = options.shouldSave === true || process.env.ZZIMCAR_SYNC_SAVE === 'true';
  return reconcileZzimcarDisableTimes({ shouldSave });
}

async function main() {
  const args = parseArgs();
  const summary = await runZzimcarReconcileSync({ shouldSave: args.save === true });
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[zzimcar-reconcile-sync] failed');
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  runZzimcarReconcileSync,
};
