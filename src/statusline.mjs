// Claude Code statusline — GLM platform quota + token usage
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import os from "os";

// ── Read Claude Code stdin ──
let input;
try {
  input = JSON.parse(readFileSync(0, "utf-8"));
} catch {
  process.exit(1);
}

// ── ANSI colors ──
const R = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BRED = "\x1b[1;31m";
const CYAN = "\x1b[36m";
const GRAY = "\x1b[90m";
const MAGENTA = "\x1b[35m";

function progressBar(pct, color) {
  const W = 18;
  const filled = (pct * W / 100) | 0;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(W - filled);
  return `${color}${bar}${R}`;
}

function ctxColor(pct) {
  if (pct >= 85) return BRED;
  if (pct >= 65) return RED;
  if (pct >= 45) return YELLOW;
  return GREEN;
}

function quotaColor(pct) {
  if (pct >= 80) return BRED;
  if (pct >= 60) return RED;
  if (pct >= 40) return YELLOW;
  return GREEN;
}

// ── Extract basic info ──
const model =
  input.model?.display_name || input.model?.id || "unknown";
const dir =
  input.workspace?.current_dir?.split(/[\\/]/).pop() ||
  input.cwd?.split(/[\\/]/).pop() || ".";
const ctxPct = Math.round(input.context_window?.used_percentage ?? 0);

// ── GLM quota cache ──
const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(__dirname, "quota_cache.json");
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function readCache(allowStale = false) {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const data = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
    if (!allowStale && Date.now() - data.timestamp > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(limits) {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), limits }));
  } catch { /* ignore */ }
}

// ── Fetch GLM quota (with top-level await) ──
async function fetchQuota() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "";
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN || "";
  if (!baseUrl || !authToken) return null;

  try {
    const parsed = new URL(baseUrl);
    const url = `https://${parsed.host}/api/monitor/usage/quota/limit`;
    const res = await fetch(url, {
      headers: {
        Authorization: authToken,
        "Accept-Language": "en-US,en",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.limits || json.limits || null;
  } catch {
    return null;
  }
}

// ── Token usage scanner (incremental) ──
const TOKEN_CACHE = join(__dirname, "token_cache.json");
const PROJECTS_DIR = join(__dirname, "projects");
const TOKEN_TTL = 5 * 60 * 1000; // 5 minutes

function collectJsonlFiles(dir) {
  const files = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(full);
      } else if (entry.isDirectory()) {
        // subagents/ directories
        files.push(...collectJsonlFiles(full));
      }
    }
  } catch { /* ignore */ }
  return files;
}

function scanTokenUsage() {
  let cache = null;
  try {
    if (existsSync(TOKEN_CACHE)) {
      cache = JSON.parse(readFileSync(TOKEN_CACHE, "utf-8"));
    }
  } catch { /* ignore */ }

  // Return cached if fresh
  if (cache && Date.now() - cache.timestamp < TOKEN_TTL) {
    return { total_input: cache.total_input, total_output: cache.total_output };
  }

  // Build file list
  let allFiles = [];
  try {
    for (const proj of readdirSync(PROJECTS_DIR, { withFileTypes: true })) {
      if (proj.isDirectory()) {
        allFiles.push(...collectJsonlFiles(join(PROJECTS_DIR, proj.name)));
      }
    }
  } catch { /* projects dir missing */ }

  // Start from previous totals + mtimes for incremental
  let total_input = cache?.total_input || 0;
  let total_output = cache?.total_output || 0;
  const prevMtimes = cache?.file_mtimes || {};
  const newMtimes = {};

  for (const fpath of allFiles) {
    const mtime = statSync(fpath).mtimeMs;
    const rel = relative(PROJECTS_DIR, fpath);
    newMtimes[rel] = mtime;

    // Only parse if file is new or modified since last scan
    if (prevMtimes[rel] && prevMtimes[rel] >= mtime) continue;

    try {
      const content = readFileSync(fpath, "utf-8");
      // If file was previously scanned, subtract old partial contribution
      // (simplified: just re-scan the whole file on change)
      for (const line of content.split("\n")) {
        if (!line.includes('"assistant"')) continue;
        try {
          const rec = JSON.parse(line);
          if (rec.type === "assistant" && rec.message?.usage) {
            const u = rec.message.usage;
            total_input += u.input_tokens || 0;
            total_output += u.output_tokens || 0;
          }
        } catch { /* malformed line */ }
      }
    } catch { /* read error */ }
  }

  const result = { timestamp: Date.now(), total_input, total_output, file_mtimes: newMtimes };
  try { writeFileSync(TOKEN_CACHE, JSON.stringify(result)); } catch { /* ignore */ }
  return { total_input, total_output };
}

function formatTokens(n) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + "K";
  return (n / 1_000_000).toFixed(1) + "M";
}

// ── Format remaining time ──
function formatRemaining(resetTimestamp) {
  if (!resetTimestamp) return "";
  const diff = resetTimestamp - Date.now();
  if (diff <= 0) return "0m";
  const totalMin = Math.floor(diff / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return `${h}h${m}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d${rh}h`;
}

// ── Resolve quota percentages and reset times ──
let fivePct = Math.round(input.rate_limits?.five_hour?.used_percentage ?? 0);
let sevenPct = Math.round(input.rate_limits?.seven_day?.used_percentage ?? 0);
let fiveReset = null;
let weeklyReset = null;

// GLM platform fallback when stdin rate_limits are zero
if (fivePct === 0 && sevenPct === 0) {
  let cache = readCache();
  if (!cache) {
    // Cache expired — fetch fresh data
    const limits = await fetchQuota();
    if (limits) {
      writeCache(limits);
      cache = { timestamp: Date.now(), limits };
    } else {
      cache = readCache(true); // fallback to stale
    }
  }

  if (cache?.limits) {
    // Match by type + unit code (3=hours, 6=weeks) — plan-agnostic
    const tokenLimits = cache.limits.filter(l => l.type === "TOKENS_LIMIT");
    const fiveHour = tokenLimits.find(l => l.unit === 3) || tokenLimits[0] || null;
    const weekly = tokenLimits.find(l => l.unit === 6) || tokenLimits[1] || null;

    if (fiveHour) {
      fivePct = Math.round(fiveHour.percentage ?? 0);
      fiveReset = fiveHour.nextResetTime ?? null;
    }
    if (weekly) {
      sevenPct = Math.round(weekly.percentage ?? 0);
      weeklyReset = weekly.nextResetTime ?? null;
    }
  }
}

// ── Build output ──
const CC = ctxColor(ctxPct);
const FC = quotaColor(fivePct);
const SC = quotaColor(sevenPct);
const now = new Date();
const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

const fiveRemain = formatRemaining(fiveReset);
const weeklyRemain = formatRemaining(weeklyReset);

const fiveStr = fiveRemain ? ` ${FC}${fiveRemain}${R}` : "";
const weeklyStr = weeklyRemain ? ` ${SC}${weeklyRemain}${R}` : "";

// \u2500\u2500 System RAM \u2500\u2500
const totalGB = (os.totalmem() / (1024 ** 3)).toFixed(0);
const freeGB = (os.freemem() / (1024 ** 3));
const usedGB = totalGB - freeGB;
const ramPct = Math.round(((totalGB - freeGB) / totalGB) * 100);
const RC = quotaColor(ramPct);
const ramStr = ` | \u{1F4BE}${RC}${usedGB.toFixed(0)}/${totalGB}GB(${ramPct}%)${R}`;

// \u2500\u2500 Token usage \u2500\u2500
const tokens = scanTokenUsage();
const TC = MAGENTA;
const tokenStr = ` | \u{1F4CA}${TC}${formatTokens(tokens.total_input)}\u2191 ${formatTokens(tokens.total_output)}\u2193${R}`;

process.stdout.write(
  `\u{1F4C1} ${GRAY}${dir}${R} | \u{1F9E0} ${CYAN}${model}${R} | \u{1F4CB}${CC}${ctxPct}%${R} ${progressBar(ctxPct, CC)} | \u23F0${GRAY}${time}${R}\n` +
  `  \u23F35h ${FC}${fivePct}%${R}${fiveStr} | \u{1F4C5}7d ${SC}${sevenPct}%${R}${weeklyStr}${ramStr}${tokenStr}\n`
);
