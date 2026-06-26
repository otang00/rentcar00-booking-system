#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const {
  normalizeCarNumber,
  buildDisableTimeCreatePayload,
  buildDisableTimeListPath,
  planDisableTimeCreate,
} = require('./lib/disable-time');

const ZZIMCAR_LOGIN_URL = 'https://admin.zzimcar.com/login';
const ZZIMCAR_VEHICLE_URL = 'https://admin.zzimcar.com/vehicle/vehicle';

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8'));
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runAppleScript(source) {
  return execFileSync('osascript', ['-e', source], { encoding: 'utf8' }).trim();
}

function safariEval(js) {
  const source = `tell application "Safari"\n  do JavaScript ${JSON.stringify(js)} in front document\nend tell`;
  return runAppleScript(source);
}

function safariState() {
  const js = `JSON.stringify({ url: location.href, title: document.title, readyState: document.readyState, hasLogin: !!document.querySelector('#exampleInputEmail'), hasVehicleTable: !!document.querySelector('#vehicleTable') })`;
  return JSON.parse(safariEval(js) || '{}');
}

function openSafari(url) {
  execSync(`open -a Safari ${JSON.stringify(url)}`);
}

function ensureSafariAt(url) {
  openSafari(url);
  sleep(1000);
  return safariState();
}

function ensureLoggedIn() {
  let state = safariState();
  if (!state.url || !String(state.url).startsWith('https://admin.zzimcar.com')) {
    state = ensureSafariAt(ZZIMCAR_LOGIN_URL);
  }

  if (!state.hasLogin) {
    return { alreadyLoggedIn: true, state };
  }

  const username = String(process.env.ZZIMCAR_ID || '').trim();
  const password = String(process.env.ZZIMCAR_PASSWORD || '').trim();
  if (!username) throw new Error('ZZIMCAR_ID is required');
  if (!password) throw new Error('ZZIMCAR_PASSWORD is required');

  safariEval(`(() => {
    const id = document.querySelector('#exampleInputEmail');
    const pw = document.querySelector('#exampleInputPassword');
    const btn = document.querySelector('button[type="submit"]');
    if (!id || !pw || !btn) return JSON.stringify({ ok:false, reason:'login_form_not_found' });
    id.value = ${JSON.stringify(username)};
    id.dispatchEvent(new Event('input', { bubbles:true }));
    pw.value = ${JSON.stringify(password)};
    pw.dispatchEvent(new Event('input', { bubbles:true }));
    btn.click();
    return JSON.stringify({ ok:true });
  })()`);
  sleep(2000);
  state = safariState();
  if (state.hasLogin) {
    throw new Error('Zzimcar login failed or still on login page');
  }

  return { alreadyLoggedIn: false, state };
}

function ensureVehiclePage() {
  const state = ensureSafariAt(ZZIMCAR_VEHICLE_URL);
  if (!state.hasVehicleTable) {
    throw new Error('Vehicle table not found on Zzimcar vehicle page');
  }
  return state;
}

function findVehicleRowByCarNumber(carNumber) {
  const normalized = normalizeCarNumber(carNumber);
  safariEval(`(() => {
    const target = ${JSON.stringify(normalized)};
    if (window.$ && window.$.fn && window.$.fn.DataTable) {
      const table = window.$('#vehicleTable').DataTable();
      table.search(target).draw();
    }
    return JSON.stringify({ ok:true, searched: target });
  })()`);
  sleep(700);

  const result = JSON.parse(safariEval(`(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, '').trim().toUpperCase();
    const rows = Array.from(document.querySelectorAll('#vehicleTable tbody tr'));
    const target = ${JSON.stringify(normalized)};
    const row = rows.find((tr) => {
      const link = tr.querySelector('td a.link');
      return normalize(link ? link.innerText : '') === target;
    });
    if (!row) return JSON.stringify({ ok:false, reason:'vehicle_row_not_found', target, visibleRows: rows.length });
    const link = row.querySelector('td a.link');
    return JSON.stringify({ ok:true, target, vehiclePid: row.dataset.pid || null, carNumber: link ? link.innerText.trim() : '', rowHtml: row.outerHTML });
  })()`) || '{}');

  if (!result.ok) {
    throw new Error(`Vehicle row not found for ${carNumber}`);
  }

  return result;
}

function fetchDisableTimes(vehiclePid) {
  const raw = safariEval(`(() => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', ${JSON.stringify(buildDisableTimeListPath(String(vehiclePid)))}, false);
    xhr.send(null);
    return JSON.stringify({ status: xhr.status, body: xhr.responseText });
  })()`);
  const parsed = JSON.parse(raw || '{}');
  if (parsed.status < 200 || parsed.status >= 300) {
    throw new Error(`Disable time fetch failed for vehiclePid=${vehiclePid} status=${parsed.status}`);
  }
  return JSON.parse(parsed.body || '[]');
}

function createDisableTime(payload) {
  const raw = safariEval(`(() => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', '/vehicle/disable_time', false);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
    xhr.send(JSON.stringify(${JSON.stringify(payload)}));
    return JSON.stringify({ status: xhr.status, body: xhr.responseText });
  })()`);
  const parsed = JSON.parse(raw || '{}');
  if (parsed.status < 200 || parsed.status >= 300) {
    throw new Error(`Disable time create failed for vehiclePid=${payload.vehiclePid} status=${parsed.status}`);
  }
  return JSON.parse(parsed.body || '{}');
}

function toTargetEntries(input) {
  const entries = Array.isArray(input) ? input : Array.isArray(input.entries) ? input.entries : [];
  return entries.map((entry) => ({
    carNumber: normalizeCarNumber(entry.carNumber),
    targetWindow: {
      startDtime: String(entry.startDtime || ''),
      endDtime: String(entry.endDtime || ''),
    },
  }));
}

function main() {
  const args = parseArgs();
  if (!args.input) {
    throw new Error('--input is required');
  }

  const shouldSave = args.save === true || process.env.ZZIMCAR_SYNC_SAVE === 'true';
  const input = readJson(args.input);
  const entries = toTargetEntries(input);

  ensureLoggedIn();
  ensureVehiclePage();

  const results = [];
  for (const entry of entries) {
    const row = findVehicleRowByCarNumber(entry.carNumber);
    const existingRows = fetchDisableTimes(row.vehiclePid);
    const plan = planDisableTimeCreate({ existingRows, targetWindow: entry.targetWindow });
    const payload = plan.shouldCreate
      ? buildDisableTimeCreatePayload({
        vehiclePid: row.vehiclePid,
        startDtime: entry.targetWindow.startDtime,
        endDtime: entry.targetWindow.endDtime,
      })
      : null;

    let createResult = null;
    if (payload && shouldSave) {
      createResult = createDisableTime(payload);
    }

    results.push({
      carNumber: entry.carNumber,
      vehiclePid: row.vehiclePid,
      targetWindow: entry.targetWindow,
      existingRowsCount: existingRows.length,
      plan,
      payload,
      applied: Boolean(payload && shouldSave),
      createResult,
    });
  }

  console.log(JSON.stringify({
    mode: shouldSave ? 'save' : 'dry-run',
    entriesCount: entries.length,
    results,
  }, null, 2));
}

main();
