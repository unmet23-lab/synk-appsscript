'use strict';
// 읽기 전용 문서 조회 공통부. Git의 제외 규칙을 존중하고 확인 실패를 빈 성공으로 바꾸지 않는다.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function inventory(root) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  for (const key of Object.keys(env)) if (/^GIT_/i.test(key) && key !== 'GIT_OPTIONAL_LOCKS') delete env[key];
  const read = (args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', root, 'ls-files', '-z', ...args], {
    env, encoding: 'utf8', timeout: 10000, maxBuffer: 16 * 1024 * 1024, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).split('\0').filter(Boolean);
  try {
    const tracked = new Set(read(['--cached']));
    return { files: [...new Set([...tracked, ...read(['--others', '--exclude-standard'])])].sort(), tracked, errors: [] };
  } catch {
    return { files: [], tracked: new Set(), errors: [{ kind: 'git-inventory-unavailable' }] };
  }
}

function safeRead(root, relative, maxBytes = 4 * 1024 * 1024) {
  if (!relative || path.isAbsolute(relative) || /[\x00-\x1f]/.test(relative) || relative.split(/[\\/]/).includes('..')) throw new Error('unsafe-path');
  const full = path.resolve(root, relative);
  const actual = fs.realpathSync(full);
  const normalized = (p) => process.platform === 'win32' ? p.toLowerCase() : p;
  if (normalized(actual) !== normalized(full) || !fs.statSync(full).isFile()) throw new Error('not-regular-file');
  if (fs.statSync(full).size > maxBytes) throw new Error('document-too-large');
  return fs.readFileSync(full, 'utf8');
}

// 길이와 줄 위치 보존. 닫히지 않은 펜스도 끝까지 예시이며 선언이 아니다.
function maskCode(text) {
  let fence = null;
  return String(text).split(/(?<=\n)/).map((line) => {
    const quote = line.match(/^ {0,3}((?:> ?)+)/);
    const depth = quote ? (quote[1].match(/>/g) || []).length : 0;
    const body = quote ? line.slice(quote[0].length) : line;
    // 인용문 컨테이너가 끝나면 닫히지 않은 내부 펜스도 끝난다.
    if (fence && depth < fence.depth && line.trim()) fence = null;
    const marker = body.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence.marker[0] && marker[1].length >= fence.marker.length && /^ {0,3}(?:`+|~+)\s*$/.test(body)) fence = null;
      return line.replace(/[^\r\n]/g, ' ');
    }
    if (marker) { fence = { marker: marker[1], depth }; return line.replace(/[^\r\n]/g, ' '); }
    if (/^(?: {4}|\t)/.test(body)) return line.replace(/[^\r\n]/g, ' ');
    return line.replace(/(`+)([^\r\n]*?)\1/g, (m) => ' '.repeat(m.length));
  }).join('');
}

// 일반 Markdown 파일 링크만. 이미지·외부 URL·코드 예시·앵커만 있는 링크는 제외한다.
function localLinks(text, from) {
  const clean = maskCode(text).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\r\n]/g, ' '));
  const links = [];
  const re = /(?<![!\\])\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+"[^"\n]*")?\s*\)/g;
  function add(raw, index) {
    let href = raw.replace(/^<|>$/g, '');
    if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) return;
    try { href = decodeURIComponent(href.split(/[?#]/)[0]); } catch { return; }
    if (!href || /[\x00-\x1f]/.test(href)) return;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), href.replace(/\\/g, '/')));
    if (target === '..' || target.startsWith('../')) return;
    links.push({ from, target, line: clean.slice(0, index).split('\n').length });
  }
  for (const m of clean.matchAll(re)) add(m[1], m.index);
  const normalizeLabel = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const definitions = new Map();
  const definition = /^ {0,3}\[([^\]\n]+)\]:\s*(<[^>\n]+>|[^\s]+)(?:[^\n]*)$/gm;
  for (const m of clean.matchAll(definition)) {
    const key = normalizeLabel(m[1]);
    if (!definitions.has(key)) definitions.set(key, m[2]);
  }
  // 참조 정의 자체·이미지·이미 읽은 인라인 링크는 참조형 링크 사용으로 세지 않는다.
  const referenceText = clean.replace(definition, (m) => ' '.repeat(m.length))
    .replace(/!?\[[^\]\n]*\]\([^\n]*?\)/g, (m) => ' '.repeat(m.length))
    .replace(/!\[[^\]\n]*\](?:\[[^\]\n]*\])?/g, (m) => ' '.repeat(m.length));
  for (const m of referenceText.matchAll(/(?<![!\\])\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/g)) {
    const raw = definitions.get(normalizeLabel(m[2] || m[1]));
    if (raw) add(raw, m.index);
  }
  return links;
}

module.exports = { inventory, safeRead, maskCode, localLinks };
