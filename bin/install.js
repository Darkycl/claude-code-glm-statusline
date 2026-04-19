#!/usr/bin/env node
// claude-code-glm-statusline — Install script
// Copies statusline.mjs to ~/.claude/ and configures settings.json

const { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } = require("fs");
const { join, dirname } = require("path");
const { homedir } = require("os");

const CLAUDE_DIR = join(homedir(), ".claude");
const SETTINGS_FILE = join(CLAUDE_DIR, "settings.json");
const SCRIPT_DEST = join(CLAUDE_DIR, "statusline.mjs");
const SCRIPT_SRC = join(__dirname, "..", "src", "statusline.mjs");

// ── Colors ──
const R = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";

function log(msg) { console.log(`${CYAN}[glm-statusline]${R} ${msg}`); }
function success(msg) { console.log(`${GREEN}[glm-statusline]${R} ${msg}`); }
function warn(msg) { console.log(`${YELLOW}[glm-statusline]${R} ${msg}`); }

// ── Ensure ~/.claude exists ──
if (!existsSync(CLAUDE_DIR)) {
  mkdirSync(CLAUDE_DIR, { recursive: true });
  log(`Created ${CLAUDE_DIR}`);
}

// ── Copy statusline.mjs ──
copyFileSync(SCRIPT_SRC, SCRIPT_DEST);
success(`Copied statusline.mjs to ${SCRIPT_DEST}`);

// ── Build command path (use forward slashes for settings.json) ──
const commandPath = SCRIPT_DEST.replace(/\\/g, "/");
const command = `node ${commandPath}`;

// ── Update settings.json ──
let settings = {};
if (existsSync(SETTINGS_FILE)) {
  try {
    settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
  } catch {
    warn("Could not parse existing settings.json — creating new one");
    settings = {};
  }
}

const prevCommand = settings.statusLine?.command;
settings.statusLine = { type: "command", command };

writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
success(`Updated ${SETTINGS_FILE}`);

if (prevCommand && prevCommand !== command) {
  log(`Previous command: ${prevCommand}`);
  log(`New command:      ${command}`);
}

// ── Check environment ──
console.log("");
if (!process.env.ANTHROPIC_BASE_URL) {
  warn("ANTHROPIC_BASE_URL is not set.");
  log("Make sure to configure it in your ~/.claude/settings.json env section:");
  console.log(`
  "env": {
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "<your-api-token>"
  }
`);
} else if (!process.env.ANTHROPIC_BASE_URL.includes("bigmodel.cn")) {
  warn(`ANTHROPIC_BASE_URL is set to ${process.env.ANTHROPIC_BASE_URL}`);
  log("This statusline is designed for GLM (Zhipu AI) platform. Quota display may not work with other providers.");
} else {
  success("ANTHROPIC_BASE_URL is configured correctly.");
}

// ── Done ──
console.log("");
console.log(`${BOLD}Installation complete!${R}`);
log("Restart Claude Code to see the statusline in action.");
