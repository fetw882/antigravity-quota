#!/usr/bin/env node
/**
 * Antigravity Quota Checker
 *
 * Usage:
 *   node check-quota.js [options]
 *
 * Options:
 *   --watch     Refresh every 5 minutes and show deltas
 *   --table     Output ASCII table (default for non-JSON)
 *   --json      Output JSON
 *   --tz ZONE   Timezone for reset times (default: local or TZ env)
 *   --help      Show help
 *
 * Examples:
 *   node check-quota.js
 *   node check-quota.js --watch
 *   node check-quota.js --json
 *   TZ=America/New_York node check-quota.js
 */

const fs = require('fs');
const path = require('path');

// OAuth credentials (Antigravity public client)
const CLIENT_ID = Buffer.from(
  'MTA3MTAwNjA2MDU5MS10bWhzc2luMmgyMWxjcmUyMzV2dG9sb2poNGc0MDNlcC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbQ==',
  'base64'
).toString();
const CLIENT_SECRET = Buffer.from(
  'R09DU1BYLUs1OEZXUjQ4NkxkTEoxbUxCOHNYQzR6NnFEQWY=',
  'base64'
).toString();
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ENDPOINT = 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels';

const TARGET_MODELS = [
  'claude-opus-4-5-thinking',
  'claude-sonnet-4-5-thinking',
  'claude-sonnet-4-5',
  'gemini-3-pro-high',
  'gemini-3-flash',
];

const MODEL_LABELS = {
  'claude-opus-4-5-thinking': 'Claude Opus',
  'claude-sonnet-4-5-thinking': 'Claude Sonnet T',
  'claude-sonnet-4-5': 'Claude Sonnet',
  'gemini-3-pro-high': 'Gemini Pro',
  'gemini-3-flash': 'Gemini Flash',
};

const args = process.argv.slice(2);
const watchMode = args.includes('--watch');
const tableMode = args.includes('--table') || !args.includes('--json');
const jsonMode = args.includes('--json');
const helpMode = args.includes('--help') || args.includes('-h');
const tzIndex = args.indexOf('--tz');
const timezone = tzIndex !== -1
  ? args[tzIndex + 1]
  : (process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone);

const REFRESH_MS = 5 * 60 * 1000;
const BAN_REGEX = /banned|suspended|disabled/i;

function showHelp() {
  console.log(`Antigravity Quota Checker

Usage:
  node check-quota.js [options]

Options:
  --watch     Refresh every 5 minutes and show deltas
  --table     Output ASCII table (default for non-JSON)
  --json      Output JSON
  --tz ZONE   Timezone for reset times (default: local or TZ env)
  --help      Show help

Examples:
  node check-quota.js
  node check-quota.js --watch
  node check-quota.js --json
  TZ=America/New_York node check-quota.js
`);
}

async function refreshToken(refreshTokenValue) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshTokenValue,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const ban = detectBan(text);
    const err = new Error(`Token refresh failed: ${response.status}`);
    err._banDetected = ban;
    err._raw = text;
    throw err;
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchQuota(accessToken, projectId) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'antigravity/0.3.0',
    },
    body: JSON.stringify({ project: projectId }),
  });

  if (!response.ok) {
    const text = await response.text();
    const ban = detectBan(text);
    const err = new Error(`Quota fetch failed: ${response.status}`);
    err._banDetected = ban;
    err._raw = text;
    throw err;
  }

  const data = await response.json();
  return data;
}

function detectBan(text) {
  if (!text) return false;
  return BAN_REGEX.test(text);
}

function formatTime(isoString) {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const hoursUntilReset = (date - now) / (1000 * 60 * 60);

    if (hoursUntilReset > 8) {
      return date.toLocaleDateString('en-US', {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return date.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return new Date(isoString).toLocaleTimeString();
  }
}

function formatQuota(models) {
  const results = [];

  for (const modelId of TARGET_MODELS) {
    const model = models[modelId];
    if (model?.quotaInfo) {
      const fraction = model.quotaInfo.remainingFraction ?? 0;
      const pct = Number((fraction * 100).toFixed(1));
      results.push({
        model: modelId,
        modelLabel: MODEL_LABELS[modelId] || modelId,
        quota: pct,
        quotaStr: `${pct.toFixed(1)}%`,
        reset: formatTime(model.quotaInfo.resetTime),
        resetTime: model.quotaInfo.resetTime,
      });
    }
  }

  return results;
}

function findAuthProfiles() {
  const possiblePaths = [
    path.join(process.env.HOME, '.openclaw/agents/main/agent/auth-profiles.json'),
    path.join(process.env.HOME, '.openclaw/agent/auth-profiles.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

function pad(str, len) {
  const s = String(str);
  if (s.length >= len) return s;
  return s + ' '.repeat(len - s.length);
}

function renderTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(
      String(h).length,
      ...rows.map(r => String(r[i] ?? '').length)
    )
  );

  const line = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const headerRow = '| ' + headers.map((h, i) => pad(h, widths[i])).join(' | ') + ' |';

  const bodyRows = rows.map(r =>
    '| ' + r.map((c, i) => pad(c ?? '', widths[i])).join(' | ') + ' |'
  );

  return [line, headerRow, line, ...bodyRows, line].join('\n');
}

function formatDelta(curr, prev) {
  if (curr == null || prev == null) return '-';
  const delta = curr - prev;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}`;
}

function clearScreen() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[H');
  }
}

async function collectQuota(accounts, prevMap) {
  const results = [];
  const errors = [];

  for (const account of accounts) {
    try {
      const accessToken = await refreshToken(account.refresh);
      const data = await fetchQuota(accessToken, account.projectId);
      const banDetected = detectBan(JSON.stringify(data));

      if (banDetected) {
        results.push({
          email: account.email,
          projectId: account.projectId,
          status: 'BANNED',
          quotas: [],
        });
        continue;
      }

      if (data.models) {
        const quotas = formatQuota(data.models);
        results.push({
          email: account.email,
          projectId: account.projectId,
          status: 'OK',
          quotas,
        });
      } else {
        results.push({
          email: account.email,
          projectId: account.projectId,
          status: 'NO_MODELS',
          quotas: [],
        });
      }
    } catch (err) {
      const banDetected = Boolean(err._banDetected);
      results.push({
        email: account.email,
        projectId: account.projectId,
        status: banDetected ? 'BANNED' : 'ERROR',
        quotas: [],
      });
      errors.push({ email: account.email, message: err.message, raw: err._raw });
    }
  }

  const rows = [];
  const deltaRows = [];
  const sortedResults = results.map(r => {
    const opus = r.quotas.find(q => q.model === 'claude-opus-4-5-thinking');
    return { ...r, opus };
  }).sort((a, b) => (b.opus?.quota ?? -1) - (a.opus?.quota ?? -1));

  for (const account of sortedResults) {
    const models = TARGET_MODELS.map(id => {
      return account.quotas.find(q => q.model === id) || null;
    });

    if (models.every(m => m === null)) {
      rows.push([
        account.email,
        account.status,
        '-',
        '-',
        '-',
      ]);
      continue;
    }

    models.forEach((model, idx) => {
      const key = `${account.email}::${model?.model || TARGET_MODELS[idx]}`;
      const prev = prevMap.get(key);
      const delta = model ? formatDelta(model.quota, prev) : '-';
      if (model) prevMap.set(key, model.quota);

      rows.push([
        idx === 0 ? account.email : '',
        idx === 0 ? account.status : '',
        model ? model.modelLabel : (MODEL_LABELS[TARGET_MODELS[idx]] || TARGET_MODELS[idx]),
        model ? model.quotaStr : '-',
        delta,
        model ? model.reset : '-',
      ]);
    });
  }

  return { results: sortedResults, rows, errors };
}

async function main() {
  if (helpMode) {
    showHelp();
    process.exit(0);
  }

  const profilesPath = findAuthProfiles();
  if (!profilesPath) {
    console.error('No Antigravity auth profiles found.');
    console.error('Expected at: ~/.openclaw/agents/main/agent/auth-profiles.json');
    console.error('Run `clawdbot configure` to add accounts.');
    process.exit(1);
  }

  let profiles;
  try {
    profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to read auth profiles: ${err.message}`);
    process.exit(1);
  }

  const accounts = Object.entries(profiles.profiles || {})
    .filter(([key]) => key.startsWith('google-antigravity:'))
    .map(([key, value]) => ({
      email: key.replace('google-antigravity:', ''),
      refresh: value.refresh,
      projectId: value.projectId,
    }));

  if (accounts.length === 0) {
    console.error('No Antigravity accounts found in auth profiles.');
    console.error('Run `clawdbot configure` to add accounts.');
    process.exit(1);
  }

  const prevMap = new Map();

  const runOnce = async () => {
    const timestamp = new Date().toISOString();
    const { results, rows, errors } = await collectQuota(accounts, prevMap);

    if (jsonMode) {
      console.log(JSON.stringify({
        timestamp,
        timezone,
        accounts: results.map(r => ({
          email: r.email,
          projectId: r.projectId,
          status: r.status,
          quotas: Object.fromEntries(r.quotas.map(q => [q.model, {
            remaining: q.quota,
            reset: q.resetTime,
          }]))
        })),
        errors,
      }, null, 2));
      return;
    }

    if (tableMode) {
      if (watchMode) clearScreen();
      console.log(`Antigravity Quota Check - ${timestamp}`);
      console.log(`Timezone: ${timezone}`);
      console.log(`Accounts: ${accounts.length}`);
      console.log(`Delta: change since previous refresh`);
      console.log('');

      const headers = ['Account', 'Status', 'Model', 'Remaining', 'Delta', 'Reset'];
      console.log(renderTable(headers, rows));

      if (errors.length > 0) {
        console.log('');
        console.log('Errors:');
        for (const e of errors) {
          console.log(`- ${e.email}: ${e.message}`);
        }
      }
    }
  };

  await runOnce();

  if (watchMode) {
    setInterval(runOnce, REFRESH_MS);
  }
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
