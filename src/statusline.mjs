// claude-code-glm-statusline — Claude Code statusline for GLM Coding Plan subscribers
// MIT License — https://github.com/Darkycl/claude-code-glm-statusline
//
// Displays: directory | model | context usage (progress bar) | 5h quota | 7d quota | time

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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

function progressBar(pct, color) {
  const W = 10;
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

// ── Fetch GLM quota ──
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
    const limits = await fetchQuota();
    if (limits) {
      writeCache(limits);
      cache = { timestamp: Date.now(), limits };
    } else {
      cache = readCache(true);
    }
  }

  if (cache?.limits) {
    const limits = cache.limits;
    // limits[1] = 5-hour Token, limits[2] = weekly Token
    fivePct = Math.round(limits[1]?.percentage ?? 0);
    sevenPct = Math.round(limits[2]?.percentage ?? 0);
    fiveReset = limits[1]?.nextResetTime ?? null;
    weeklyReset = limits[2]?.nextResetTime ?? null;
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

process.stdout.write(
  `\u{1F4C1} ${GRAY}${dir}${R} | \u{1F9E0} ${CYAN}${model}${R} | \u{1F4CB}${CC}${ctxPct}%${R} ${progressBar(ctxPct, CC)} | \u23F35h ${FC}${fivePct}%${R}${fiveStr} | \u{1F4C5}7d ${SC}${sevenPct}%${R}${weeklyStr} | \u23F0${GRAY}${time}${R}\n`
);
