#!/usr/bin/env node
// Cloudinary orphan cleanup — Node 18+ (uses built-in fetch)
'use strict';

const readline = require('readline');
const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// ── Read cloud_name + api_key from the CMS config ────────────────────────────

let cloudName = '', apiKey = '';
try {
  // cloud_name lives in gallery-widget.js; api_key lives in config.yml
  const widget = fs.readFileSync(path.join(ROOT, 'static/admin/gallery-widget.js'), 'utf8');
  cloudName = (widget.match(/cloudName:\s*['"]([^'"]+)['"]/) || [])[1] || '';
  const cfg = fs.readFileSync(path.join(ROOT, 'static/admin/config.yml'), 'utf8');
  apiKey    = (cfg.match(/api_key:\s*(\S+)/) || [])[1] || '';
} catch (_) {}

// ── Utilities ─────────────────────────────────────────────────────────────────

function ask(rl, q) {
  return new Promise(r => rl.question(q, r));
}

function httpsReq(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search,
        method: opts.method || 'GET', headers: opts.headers || {} },
      res => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
          catch (_) { resolve({ status: res.statusCode, body }); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function auth(key, secret) {
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
}

// ── Scan content/ for Cloudinary public IDs in use ───────────────────────────

function mdFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? mdFiles(full) : e.name.endsWith('.md') ? [full] : [];
  });
}

function usedPublicIds(files) {
  // Matches: .../upload/v{timestamp}/{public_id}.{ext}
  // Handles optional leading transformation segments before the version
  const re = /res\.cloudinary\.com\/[^/\s"']+\/image\/upload\/(?:[^/\s"']+\/)*v\d+\/([^"'\s?#]+)/g;
  const ids = new Set();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    re.lastIndex = 0;
    for (const m of src.matchAll(re)) {
      ids.add(m[1].replace(/\.[^./]+$/, '')); // strip extension → public_id
    }
  }
  return ids;
}

// ── Cloudinary Admin API ──────────────────────────────────────────────────────

async function fetchAllAssets(cloudName, apiKey, apiSecret) {
  const headers = { Authorization: auth(apiKey, apiSecret) };
  const assets  = [];
  let cursor    = null;

  do {
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image`
              + `?max_results=500${cursor ? `&next_cursor=${cursor}` : ''}`;
    const { status, body } = await httpsReq(url, { headers });
    if (status !== 200) {
      throw new Error(`Cloudinary API ${status}: ${JSON.stringify(body)}`);
    }
    assets.push(...body.resources);
    cursor = body.next_cursor || null;
  } while (cursor);

  return assets;
}

async function deleteAssets(cloudName, apiKey, apiSecret, publicIds) {
  const headers = { Authorization: auth(apiKey, apiSecret) };
  const BATCH   = 100;
  let deleted   = 0;

  for (let i = 0; i < publicIds.length; i += BATCH) {
    const batch = publicIds.slice(i, i + BATCH);
    const qs    = batch.map(id => `public_ids[]=${encodeURIComponent(id)}`).join('&');
    const url   = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?${qs}`;
    const { status, body } = await httpsReq(url, { method: 'DELETE', headers });
    if (status !== 200) {
      throw new Error(`Delete failed ${status}: ${JSON.stringify(body)}`);
    }
    deleted += Object.keys(body.deleted || {}).length;
    process.stdout.write(`  Deleted ${deleted} / ${publicIds.length}…\r`);
  }
  process.stdout.write('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const close = () => rl.close();

  console.log('\n┌─────────────────────────────────────┐');
  console.log('│   Cloudinary Orphan Cleanup         │');
  console.log('└─────────────────────────────────────┘\n');

  // Open the API-keys page so the user can copy their secret
  const consoleUrl = 'https://console.cloudinary.com/settings/api-keys';
  console.log(`Opening → ${consoleUrl}\n`);
  try { execSync(`open "${consoleUrl}"`); } catch (_) {}

  if (!cloudName) cloudName = (await ask(rl, 'Cloud name : ')).trim();
  else            console.log(`Cloud name : ${cloudName}  (from config.yml)`);

  if (!apiKey)    apiKey    = (await ask(rl, 'API key    : ')).trim();
  else            console.log(`API key    : ${apiKey}  (from config.yml)`);

  const apiSecret = (await ask(rl, 'API secret : ')).trim();
  console.log();

  // Scan markdown files
  process.stdout.write('Scanning content/…');
  const files = mdFiles(path.join(ROOT, 'content'));
  const used  = usedPublicIds(files);
  console.log(` ${used.size} Cloudinary image(s) referenced across ${files.length} file(s).`);

  // Fetch all Cloudinary assets
  process.stdout.write('Fetching Cloudinary assets…');
  let assets;
  try {
    assets = await fetchAllAssets(cloudName, apiKey, apiSecret);
  } catch (e) {
    console.log(`\nError: ${e.message}`);
    close(); return;
  }
  console.log(` ${assets.length} asset(s) found in Cloudinary.`);

  // Identify orphans
  const orphans = assets.filter(a => !used.has(a.public_id));

  if (orphans.length === 0) {
    console.log('\n✓ Nothing to clean up — all assets are in use.\n');
    close(); return;
  }

  const totalKB = (orphans.reduce((s, a) => s + (a.bytes || 0), 0) / 1024).toFixed(0);
  console.log(`\nOrphaned assets (${orphans.length}, ~${totalKB} KB):\n`);
  for (const a of orphans) {
    const kb = ((a.bytes || 0) / 1024).toFixed(0).padStart(6);
    console.log(`  ${kb} KB  ${a.public_id}`);
  }

  const answer = (await ask(rl, `\nDelete all ${orphans.length} orphan(s)? [y/N] `)).trim().toLowerCase();
  if (answer === 'y') {
    console.log();
    await deleteAssets(cloudName, apiKey, apiSecret, orphans.map(a => a.public_id));
    console.log(`✓ Done.\n`);
  } else {
    console.log('  Skipped.\n');
  }

  close();
}

main().catch(e => { console.error('\nFatal:', e.message); process.exit(1); });
