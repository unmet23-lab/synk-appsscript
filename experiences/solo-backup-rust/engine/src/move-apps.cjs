'use strict';
// 옮겨 오기 v2 (STAGE1_DESIGN.md 4.6b): the fixed table, the allow-list filters (run on the old PC to make the kit and
// once more on the new PC — the kit carries no originals), the check for text shaped like a key, the 「다시 깔 것」 list
// and the 「다시 로그인할 곳」 checklist.
// Pure functions; move-kit.cjs collects, move-settings below puts back through the host.
const path = require('node:path').win32;
const crypto = require('node:crypto');
const TABLE = require('./move-apps.json');
const plan = require('./move-plan.cjs');

/**
 * A name whose value is a secret or a command environment (review M16, GPT GA2): in any dotted part of the name, one of
 * SECRET_IN appears anywhere (`tokenValue`, `TOKENValue`, `githubToken`), a word (split at camelCase, `_`, `-`) is one
 * of SECRET_WORDS, or the last word is `key` (`apiKey`, `licenseKey`, `key`). A few editor names that only hold
 * colours are not secrets.
 */
const SECRET_IN = ['token', 'secret', 'password', 'passwd', 'passphrase', 'credential', 'cookie', 'authorization', 'bearer', 'apikey', 'privatekey', 'accesskey'];
const SECRET_WORDS = new Set(['auth', 'pwd', 'env', 'environment', 'headers', 'header']);
const SAFE_NAMES = new Set(['tokencolorcustomizations', 'semantictokencolorcustomizations', 'semantictokencolors', 'tokencolors']);
const words = k => String(k).replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map(w => w.toLowerCase());
function secretPart(part) {
  const w = words(part); if (!w.length) return false;
  const joined = w.join('');
  if (SAFE_NAMES.has(joined)) return false;
  return SECRET_IN.some(s => joined.includes(s)) || w.some(x => SECRET_WORDS.has(x)) || w[w.length - 1] === 'key';
}
const secretName = k => String(k).split('.').some(secretPart);
/** Inside settings a filter lets through, a name that points at a program, command, proxy or secret is still dropped. */
const RISKY = /(?:path|paths|exec|executable|command|commands|commandline|shell|shellargs|args|env|proxy|token|key|keys|secret|password|server|serverpath|browser|codeactionsonsave)$/i;
const RISKY_START = /^(?:exec|command|shell|env|proxy|secret|password|server)/i;
// A secret-looking name is risky as well: its value was blanked in the kit and must not come back empty (GPT GA2).
const risky = name => String(name).split('.').some(part => RISKY.test(part) || RISKY_START.test(part)) || secretName(name);

/** JSON with comments and trailing commas (VS Code, Windows Terminal) → value. Throws on anything else. Comments and
 *  trailing commas are taken out only outside strings (GPT GA1: `",}"` stays as it is). */
function parseJsonc(text) {
  let out = '', i = 0, inString = false;
  const s = String(text).replace(/^\uFEFF/, '');
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (inString) { out += c; if (c === '\\') { out += d ?? ''; i += 2; continue; } if (c === '"') inString = false; i++; continue; }
    if (c === '"') { inString = true; out += c; i++; continue; }
    if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const end = s.indexOf('*/', i + 2); i = end < 0 ? s.length : end + 2; continue; }
    out += c; i++;
  }
  // Trailing commas: the last comma outside a string before a closing bracket, with only white space between.
  const parts = []; let comma = -1, str = false;
  for (let j = 0; j < out.length; j++) {
    const c = out[j];
    if (str) { parts.push(c); if (c === '\\') { parts.push(out[++j] ?? ''); continue; } if (c === '"') str = false; continue; }
    if (c === '"') { str = true; comma = -1; parts.push(c); continue; }
    if ((c === '}' || c === ']') && comma >= 0) parts[comma] = '';
    if (c === ',') comma = parts.length; else if (!/\s/.test(c)) comma = -1;
    parts.push(c);
  }
  return JSON.parse(parts.join(''));
}
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Text shaped like a key, whatever name it sits under (Fable 5.2 설계 검토 D5): provider key prefixes, a JWT, a private key
 * block, a password inside an address, a bearer or basic credential. Files carried as they are (instructions, prompts,
 * snippets, bookmarks) are left out of the kit when one shows; a filter's output is checked the same way. Not a guarantee
 * — free text can hold a secret of any shape — so the design says what is left.
 */
const SECRET_SHAPES = [
  /\bsk-[A-Za-z0-9_-]{16,}/, /\bgh[pousr]_[A-Za-z0-9]{20,}/, /\bgithub_pat_[A-Za-z0-9_]{20,}/, /\bglpat-[A-Za-z0-9_-]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/, /\bAIza[0-9A-Za-z_-]{30,}/, /\bxox[abposr]-[A-Za-z0-9-]{10,}/, /\bhf_[A-Za-z0-9]{20,}/, /\bnpm_[A-Za-z0-9]{30,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i,
  // An Authorization value, and a bearer or basic credential: a run that is not a plain word (카본 끝판 A1 — 「basic
  // configuration」 and 「Bearer authentication」 are English, not keys), i.e. it has a capital, digit, `+` or `/` after
  // its first character.
  /\bauthorization["']?\s*[:=]\s*["']?[A-Za-z]+\s+[^\s"']{8,}/i,
  // No end boundary, and only no letter or digit just before (마지막 끝판 카본 A1): a period or an emphasis mark around a
  // credential (`_Basic …_`, `… YWRt=.`) must not hide it.
  /(?<![A-Za-z0-9])(?:[Bb]earer|BEARER)\s+(?=[A-Za-z0-9._~+\/-]{16,})[A-Za-z0-9._~+\/-][a-z._~-]*[A-Z0-9+\/]/,
  /(?<![A-Za-z0-9])(?:[Bb]asic|BASIC)\s+(?=[A-Za-z0-9+\/]{12,})[A-Za-z0-9+\/][a-z]*[A-Z0-9+\/]/,
];
const looksSecret = text => SECRET_SHAPES.some(re => re.test(text));
/** The kit's rule version: a kit made with older rules carries originals, so a new PC does not put its app files anywhere. */
const RULES = 2;

// ---- Filters (4.6b 고정 표): what goes back in place. Each returns { bytes, dropped } or null (nothing to put back).
const GIT_KEEP = new Set(['user.name', 'user.email', 'init.defaultbranch', 'core.autocrlf', 'core.eol', 'core.longpaths', 'core.quotepath',
  'pull.rebase', 'pull.ff', 'push.default', 'push.autosetupremote', 'fetch.prune', 'merge.conflictstyle', 'color.ui', 'credential.helper']);
/** One git config value as git reads it (카본 끝판 A3): quotes and `\"` · `\\` escapes, a comment only outside quotes,
 *  outer white space dropped. null for what this filter does not carry: an open quote, a line that goes on (`\` at
 *  the end), another escape or a control character. */
function gitValue(raw) {
  let out = '', pending = '', quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\') { const d = raw[i + 1]; if (d !== '"' && d !== '\\') return null; out += pending + d; pending = ''; i++; continue; }
    if (c === '"') { quoted = !quoted; out += pending; pending = ''; continue; }
    if (!quoted && (c === '#' || c === ';')) break;
    if (!quoted && (c === ' ' || c === '\t')) { if (out) pending += c; continue; }
    out += pending + c; pending = '';
  }
  return quoted || /[\x00-\x1f\x7f]/.test(out) ? null : out;
}
const gitQuote = v => /^\s|\s$|[#;"\\]/.test(v) ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : v;
/** How one line of a value ends, as git reads it: whether it goes on to the next line (a `\` that ends the line outside
 *  a comment) and whether a quote is still open there. The next line goes on in that quote (GPT 다시 검수 -j GA1). */
function gitLine(raw, quoted = false) {
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\') { if (i === raw.length - 1) return { goesOn: true, quoted }; i++; continue; }
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === '#' || c === ';')) return { goesOn: false, quoted };
  }
  return { goesOn: false, quoted };
}
function gitconfig(text) {
  let section = null, sub = false, dropped = 0, goesOn = null; const kept = new Map();
  for (const raw of String(text).split(/\r?\n/)) {
    // The lines a value goes on to belong to that value (dropped with it), never a setting of their own (마지막 끝판 카본 C1).
    if (goesOn) { const l = gitLine(raw, goesOn.quoted); goesOn = l.goesOn ? l : null; continue; }
    const line = raw.replace(/^\s+/, '');
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const h = /^\[\s*([A-Za-z0-9.-]+)(\s+"(?:[^"\\]|\\.)*")?\s*\]/.exec(line);
    if (h) { section = h[1].toLowerCase(); sub = !!h[2]; continue; }
    // A header this filter cannot read ends the section before it: what follows never counts as that section.
    if (line.startsWith('[')) { section = null; dropped++; continue; }
    const kv = /^([A-Za-z][A-Za-z0-9-]*)\s*(?:=\s*(.*))?$/.exec(line);
    const first = kv?.[2] !== undefined ? gitLine(kv[2]) : null;
    if (first?.goesOn) { goesOn = first; dropped++; continue; }
    if (!kv || !section) { dropped++; continue; }
    const name = `${section}.${kv[1].toLowerCase()}`, value = kv[2] === undefined ? 'true' : gitValue(kv[2]);
    const ok = value !== null && !sub && GIT_KEEP.has(name) && (name !== 'credential.helper' || /^(?:manager|manager-core)$/.test(value)) && !/[`$|;&]/.test(value);
    if (ok) kept.set(name, value); else dropped++;
  }
  if (!kept.size) return null;
  const bySection = new Map();
  for (const [name, value] of kept) { const [s, k] = name.split('.'); if (!bySection.has(s)) bySection.set(s, []); bySection.get(s).push(`\t${k} = ${gitQuote(value)}`); }
  const out = [...bySection].map(([s, lines]) => `[${s}]\n${lines.join('\n')}`).join('\n') + '\n';
  return { bytes: Buffer.from(out), dropped };
}
const EDITOR_KEEP = /^(?:editor|workbench|files|window|search|explorer|diffEditor|breadcrumbs)\./;
function vscodeSettings(text) {
  const value = parseJsonc(text); if (!isObject(value)) return null;
  const out = {}; let dropped = 0;
  for (const [k, v] of Object.entries(value)) {
    if (/^\[.+\]$/.test(k) && isObject(v)) {
      const inner = Object.fromEntries(Object.entries(v).filter(([n]) => EDITOR_KEEP.test(n) && n.startsWith('editor.') && !risky(n)));
      dropped += Object.keys(v).length - Object.keys(inner).length;
      if (Object.keys(inner).length) out[k] = inner; continue;
    }
    if (EDITOR_KEEP.test(k) && !risky(k)) out[k] = v; else dropped++;
  }
  return Object.keys(out).length ? { bytes: Buffer.from(JSON.stringify(out, null, 2)), dropped } : null;
}
const KEY_RISK = /terminal|task|runCommands|sendSequence|shell|debug|launch|remote/i;
function vscodeKeys(text) {
  const value = parseJsonc(text); if (!Array.isArray(value)) return null;
  const kept = value.filter(e => isObject(e) && typeof e.command === 'string' && !KEY_RISK.test(JSON.stringify(e)));
  return kept.length ? { bytes: Buffer.from(JSON.stringify(kept, null, 2)), dropped: value.length - kept.length } : null;
}
const WT_TOP = new Set(['$schema', 'theme', 'themes', 'schemes', 'copyOnSelect', 'copyFormatting', 'initialCols', 'initialRows', 'launchMode', 'alwaysShowTabs',
  'showTabsInTitlebar', 'useAcrylicInTabRow', 'tabWidthMode', 'confirmCloseAllTabs', 'wordDelimiters', 'alwaysOnTop', 'centerOnLaunch', 'focusFollowMouse',
  'snapToGridOnResize', 'showTerminalTitleInTitlebar', 'tabSwitcherMode', 'language', 'disableAnimations', 'newTabPosition', 'trimBlockSelection', 'trimPaste']);
const WT_LOOK = new Set(['font', 'fontFace', 'fontSize', 'fontWeight', 'colorScheme', 'opacity', 'useAcrylic', 'cursorShape', 'cursorHeight', 'padding',
  'scrollbarState', 'antialiasingMode', 'historySize', 'snapOnInput', 'altGrAliasing', 'closeOnExit', 'intenseTextStyle', 'adjustIndistinguishableColors', 'bellStyle',
  'suppressApplicationTitle', 'tabColor', 'unfocusedAppearance', 'hidden', 'name', 'guid', 'source']);
const WT_ACTION_RISK = new Set(['sendinput', 'wt', 'newtab', 'splitpane', 'newwindow', 'multipleactions', 'openwindowsterminal']);
/** Windows Terminal's two built-in profiles (Windows PowerShell, Command Prompt): its own defaults give their command,
 *  so their look comes back like a `source` profile's (카본 끝판 A9). */
const WT_BUILT_IN = new Set(['{61c54bbd-c2c6-5271-96e7-009a87ff44bf}', '{0caa0dad-35be-5f56-a8ff-afceeeaa6101}']);
const WT_IDENTITY = ['name', 'guid', 'source', 'hidden'];
/** A profile's look; its `unfocusedAppearance` is filtered the same way (카본 끝판 A6 — no image or shader path inside). */
const look = profile => Object.fromEntries(Object.entries(profile).filter(([k]) => WT_LOOK.has(k)).map(([k, v]) => k === 'unfocusedAppearance'
  ? [k, isObject(v) ? Object.fromEntries(Object.entries(v).filter(([n]) => WT_LOOK.has(n) && n !== 'unfocusedAppearance' && !WT_IDENTITY.includes(n))) : null]
  : [k, v]).filter(([k, v]) => !(k === 'unfocusedAppearance' && (!v || !Object.keys(v).length))));
function terminalSettings(text) {
  const value = parseJsonc(text); if (!isObject(value)) return null;
  const out = {}; let dropped = 0; const droppedProfiles = [];
  const actionOk = a => {
    if (!isObject(a)) return false;
    const c = a.command, action = typeof c === 'string' ? c : isObject(c) ? c.action : undefined;
    return typeof action === 'string' && !WT_ACTION_RISK.has(action.toLowerCase()) && !JSON.stringify(a).includes('commandline');
  };
  // A key bound by id (Windows Terminal 1.19 +) comes back only for an action that comes back, or one of Windows
  // Terminal's own (`Terminal.…`): a key left on a dropped action would take the key away from its default (카본 끝판 A5).
  const keptIds = new Set((Array.isArray(value.actions) ? value.actions : []).filter(actionOk).map(a => a.id).filter(id => typeof id === 'string'));
  const boundOk = a => isObject(a) && a.command === undefined && typeof a.id === 'string' && a.keys !== undefined && (keptIds.has(a.id) || /^Terminal\.[A-Za-z0-9.]+$/.test(a.id));
  for (const [k, v] of Object.entries(value)) {
    if (WT_TOP.has(k)) { out[k] = v; continue; }
    if (k === 'profiles') {
      const list = Array.isArray(v) ? v : Array.isArray(v?.list) ? v.list : [];
      const kept = [];
      for (const p of list) {
        if (!isObject(p)) continue;
        // Only Windows' own profiles (`source`, or the two built in) come back, with their look; one with a command
        // of its own does not.
        if ((typeof p.source === 'string' && p.commandline === undefined) || WT_BUILT_IN.has(String(p.guid).toLowerCase())) kept.push(look(p)); else { droppedProfiles.push(String(p.name || p.guid || '?')); dropped++; }
      }
      const defaults = isObject(v) && isObject(v.defaults) ? Object.fromEntries(Object.entries(look(v.defaults)).filter(([n]) => !WT_IDENTITY.includes(n))) : {};
      if (kept.length || Object.keys(defaults).length) out.profiles = { ...(Object.keys(defaults).length ? { defaults } : {}), list: kept };
      continue;
    }
    if (k === 'actions' || k === 'keybindings') {
      const list = Array.isArray(v) ? v : [];
      const kept = list.filter(a => boundOk(a) || actionOk(a));
      dropped += list.length - kept.length; if (kept.length) out[k] = kept; continue;
    }
    if (k === 'defaultProfile') { out.defaultProfile = v; continue; }
    dropped++;
  }
  if (out.defaultProfile && !(out.profiles?.list || []).some(p => String(p.guid).toLowerCase() === String(out.defaultProfile).toLowerCase())) delete out.defaultProfile;
  // Nothing of the person's own left (카본 끝판 A7): no file to put back.
  if (!Object.keys(out).some(k => k !== '$schema')) return null;
  return { bytes: Buffer.from(JSON.stringify(out, null, 2)), dropped, droppedProfiles };
}
const CLAUDE_KEEP = new Set(['model', 'theme', 'outputStyle', 'language', 'alwaysThinkingEnabled', 'cleanupPeriodDays', 'includeCoAuthoredBy', 'spinnerTipsEnabled']);
function claudeSettings(text) {
  const value = parseJsonc(text); if (!isObject(value)) return null;
  const out = {}; let dropped = 0;
  for (const [k, v] of Object.entries(value)) {
    if (CLAUDE_KEEP.has(k) && typeof v !== 'object') out[k] = v;
    else if (k === 'permissions' && isObject(v) && Array.isArray(v.deny)) {
      const deny = v.deny.filter(x => typeof x === 'string');
      if (deny.length) out.permissions = { deny }; // an empty list is nothing to put back (카본 끝판 A7)
      dropped += Object.keys(v).length - 1;
    }
    else dropped++;
  }
  return Object.keys(out).length ? { bytes: Buffer.from(JSON.stringify(out, null, 2)), dropped } : null;
}
/** Obsidian's vault list with each vault moved to where 4.6 put its folder; a vault whose folder is not there is left out. */
function obsidianVaults(text, { mapPath }) {
  const value = parseJsonc(text); if (!isObject(value) || !isObject(value.vaults)) return null;
  const vaults = {}; let dropped = 0;
  for (const [id, v] of Object.entries(value.vaults)) {
    const target = isObject(v) && typeof v.path === 'string' ? mapPath(v.path) : null;
    if (target && /^[0-9a-f]{1,64}$/i.test(id)) vaults[id] = { path: target, ts: Number.isFinite(v.ts) ? v.ts : Date.now() }; else dropped++;
  }
  return Object.keys(vaults).length ? { bytes: Buffer.from(JSON.stringify({ vaults }, null, 2)), dropped } : null;
}
/** Obsidian on the old PC: each vault's place and time only; the new PC moves the place (`obsidianVaults`). */
function obsidianPick(text) {
  const value = parseJsonc(text); if (!isObject(value) || !isObject(value.vaults)) return null;
  const vaults = {};
  for (const [id, v] of Object.entries(value.vaults)) if (/^[0-9a-f]{1,64}$/i.test(id) && isObject(v) && typeof v.path === 'string' && /^[A-Za-z]:\\/.test(v.path)) vaults[id] = { path: v.path, ts: Number.isFinite(v.ts) ? v.ts : 0 };
  return Object.keys(vaults).length ? Buffer.from(JSON.stringify({ vaults })) : null;
}
/** VS Code / Cursor `extensions.json`: the extension ids only (shown with their install command, never installed here). */
function extensionList(text) {
  const value = parseJsonc(text); if (!Array.isArray(value)) return [];
  return [...new Set(value.map(e => e?.identifier?.id).filter(id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9.-]*$/.test(id)))].slice(0, 500);
}
const FILTERS = { gitconfig: t => gitconfig(t), 'vscode-settings': vscodeSettings, 'vscode-keys': vscodeKeys, 'terminal-settings': terminalSettings, 'claude-settings': claudeSettings, 'obsidian-vaults': obsidianVaults };
/**
 * What one table file puts into the kit on the old PC (Fable D1 · D2): a filter's output, never the original — the
 * allow-list is the line secrets do not cross, and `secretName` only a second net inside it. `{ data, dropped,
 * droppedProfiles }`, `{ left: why }` (kept out, and said so on the new PC) or null (nothing to keep).
 */
function keep(entry, bytes) {
  const text = bytes.toString('utf8');
  if (entry.filter === 'copy' || entry.filter === 'side') return looksSecret(text) ? { left: 'secret-looking' } : { data: bytes };
  try {
    if (entry.filter === 'extension-list') { const ids = extensionList(text); return ids.length ? { data: Buffer.from(JSON.stringify(ids.map(id => ({ identifier: { id } })))) } : null; }
    if (entry.filter === 'obsidian-vaults') { const data = obsidianPick(text); return data ? { data } : null; }
    const f = FILTERS[entry.filter]; if (!f || entry.filter === 'obsidian-vaults') return null;
    const out = f(text, {}); if (!out?.bytes) return null;
    if (looksSecret(out.bytes.toString('utf8'))) return { left: 'secret-looking' };
    return { data: out.bytes, dropped: out.dropped || 0, droppedProfiles: out.droppedProfiles || [] };
  } catch { return { left: 'unreadable' }; }
}
/**
 * What a kit file becomes on the new PC: the same filter and the same check once more (Fable D7 — the kit came from
 * another, maybe older or broken, PC). `{ bytes, dropped }`, `{ side: true, bytes }` (only aside), `{ list }`,
 * `{ left: why }` or null.
 */
function filtered(entry, bytes, context = {}) {
  const text = bytes.toString('utf8');
  if (entry.filter === 'copy' || entry.filter === 'side') return looksSecret(text) ? { left: 'secret-looking' } : entry.filter === 'side' ? { side: true, bytes } : { bytes, dropped: 0 };
  if (entry.filter === 'extension-list') { try { return { list: extensionList(text) }; } catch { return null; } }
  const f = FILTERS[entry.filter]; if (!f) return null;
  try {
    const out = f(text, context); if (!out?.bytes) return null;
    return looksSecret(out.bytes.toString('utf8')) ? { left: 'secret-looking' } : out;
  } catch { return null; }
}

// ---- 다시 깔 것 · 다시 로그인할 곳
const skipId = id => TABLE.skip.some(p => new RegExp(p).test(id));
const validId = id => typeof id === 'string' && id.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9.+_-]*$/.test(id);
/**
 * The 「다시 깔 것」 list (4.6b): table programs found on the old PC (chosen unless already here), other winget ids
 * (not chosen; their name comes from `winget show` on this PC), and what winget does not have (official site when known).
 */
const TAIL_WORDS = new Set(['version', 'ver', 'bit', 'x64', 'x86', 'arm64', 'amd64', 'user', 'machine', 'lts', 'stable', 'setup', 'dc']);
/** Whether an installed program's name is the table name with at most a version, bitness or edition after it (GPT GA6:
 *  「git」 is not GitHub CLI, 「claude」 is not Claude Code, 「notion」 is not Notion Calendar). Both are lower case. */
function nameFits(installed, m) {
  if (!installed.startsWith(m)) return false;
  const tail = installed.slice(m.length);
  if (/^[a-z가-힣]/.test(tail) && /[a-z가-힣]$/.test(m)) return false;
  return tail.replace(/\([^)]*\)/g, ' ').split(/[^a-z0-9가-힣]+/).filter(Boolean).every(w => /^v?\d/.test(w) || TAIL_WORDS.has(w));
}
function reinstallList(kit, installedHere = []) {
  const here = new Set(installedHere), old = kit?.programs || {};
  const wingetIds = [...new Set((old.winget || []).map(p => p?.id).filter(validId))].filter(id => !skipId(id));
  const names = (old.installed || []).map(p => String(p?.name || '').toLowerCase()).filter(Boolean);
  const table = [], others = [], manual = [];
  for (const p of TABLE.programs) {
    const found = wingetIds.includes(p.id) || names.some(n => p.names.some(m => nameFits(n, m)));
    if (found) table.push({ id: p.id, name: p.name, scope: p.scope, site: p.site, license: p.license, installed: here.has(p.id), chosen: !here.has(p.id), command: `winget install --id ${p.id} -e` });
  }
  for (const id of wingetIds) if (!TABLE.programs.some(p => p.id === id)) others.push({ id, installed: here.has(id), chosen: false, command: `winget install --id ${id} -e` });
  // The same match as the table's (카본 끝판 A2): 「Notion Calendar」 or 「TortoiseGit」 is not a table program, so it stays
  // in the list of what winget does not have instead of falling out of every list.
  const matched = n => TABLE.programs.some(p => p.names.some(m => nameFits(n, m)));
  for (const m of TABLE.manual) if (names.some(n => m.names.some(x => n.includes(x)))) manual.push({ name: m.name, site: m.site, ...(m.command ? { command: m.command } : {}) });
  const unlisted = [...new Set((old.installed || []).filter(p => p?.name && !matched(String(p.name).toLowerCase()) && !TABLE.manual.some(m => m.names.some(x => String(p.name).toLowerCase().includes(x)))).map(p => `${p.name}`))].slice(0, 300);
  for (const name of unlisted) manual.push({ name, site: null });
  return { table, others, manual, machine: table.filter(p => p.chosen && p.scope === 'machine').map(p => p.id), user: table.filter(p => p.chosen && p.scope === 'user').map(p => p.id) };
}
/** The 「다시 로그인할 곳」 checklist: the table apps and programs the old PC had, then the three that always show. */
function checklist(kit) {
  // A table program found by its installed name counts as well, as it does for 「다시 깔 것」 (카본 끝판 A8).
  const names = (kit?.programs?.installed || []).map(p => String(p?.name || '').toLowerCase()).filter(Boolean);
  const ids = new Set([...(kit?.programs?.winget || []).map(p => p?.id),
    ...TABLE.programs.filter(p => names.some(n => p.names.some(m => nameFits(n, m)))).map(p => p.id)]);
  const apps = new Set((kit?.apps || []).map(a => a.app));
  const out = [];
  for (const s of TABLE.settings) if (s.signIn && (apps.has(s.app) || ids.has(s.program))) out.push({ id: `app:${s.app}`, text: `${s.name}: ${s.signIn}` });
  for (const s of TABLE.signIn) if (s.match.some(id => ids.has(id))) out.push({ id: `program:${s.match[0]}`, text: s.text });
  for (const a of TABLE.always) out.push({ id: a.id, text: a.text });
  return out;
}
module.exports = { TABLE, RULES, looksSecret, keep, obsidianPick, nameFits, parseJsonc, filtered, gitconfig, vscodeSettings, vscodeKeys, terminalSettings, claudeSettings, obsidianVaults, extensionList, reinstallList, checklist, validId, secretName, risky, plan };
