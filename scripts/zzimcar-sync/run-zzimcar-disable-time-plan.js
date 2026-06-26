#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  normalizeCarNumber,
  buildDisableTimeCreatePayload,
  planDisableTimeCreate,
} = require('./lib/disable-time');

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

function loadJsonFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function main() {
  const args = parseArgs();
  if (!args.input) {
    throw new Error('--input is required');
  }

  const data = loadJsonFile(args.input);
  const existingRows = Array.isArray(data.existingRows) ? data.existingRows : [];
  const targetWindow = data.targetWindow || {};
  const vehiclePid = data.vehiclePid;
  const carNumber = normalizeCarNumber(data.carNumber || '');

  const plan = planDisableTimeCreate({ existingRows, targetWindow });
  const payload = plan.shouldCreate
    ? buildDisableTimeCreatePayload({
      vehiclePid,
      startDtime: targetWindow.startDtime,
      endDtime: targetWindow.endDtime,
    })
    : null;

  console.log(JSON.stringify({
    carNumber,
    vehiclePid: vehiclePid != null ? String(vehiclePid) : null,
    existingRowsCount: existingRows.length,
    targetWindow,
    plan,
    payload,
  }, null, 2));
}

main();
