#!/usr/bin/env node
/**
 * 인물 세로 클립 · SNS 키트판 만들기 — 공용 틀(template.html) + 편별 자료(clips.json) → clips/<키>[-<테마>]/ HyperFrames 프로젝트
 * 2026-10-01 창업자 인터뷰 세로 클립 6편(A~F)을 키트로 다시 만들며 썼다. 다음 인터뷰도 같은 틀을 쓰도록 만들었다(나중에 tools/로 옮겨도 된다).
 *
 * 쓰는 법(이 폴더에서):
 *   python make_clean_clips.py            # 먼저: 글자 없는 깨끗한 세로 원본 → media/<키>.mp4·.wav, data/<키>.json
 *   node build.mjs                        # clips.json의 모든 편 × 각 편의 themes
 *   node build.mjs B --theme synk         # 한 편을 다른 계정 테마로(→ clips/B-synk/)
 *   node build.mjs A --no-assets          # index.html만 다시 쓰기(키트 사본·미디어 연결은 건너뜀)
 *
 * 편마다 읽는 것: clips.json(훅 제목·끝 장·전환·테마), data/<키>.json(길이·문장 시작·하드 컷), v2 ASS(말자막 조각 시각과 노랑 강조)
 * 쓰는 것: clips/<폴더>/index.html, package.json, hyperframes.json, meta.json, assets/media/(미디어 연결), assets/synk-kit/(키트 사본)
 * 테마: 기본 테마(clips.json defaultTheme)는 clips/<키>, 다른 테마는 clips/<키>-<테마>.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..', '..');
const CFG = JSON.parse(fs.readFileSync(path.join(HERE, 'clips.json'), 'utf8'));
const TEMPLATE = fs.readFileSync(path.join(HERE, 'template.html'), 'utf8');
const HF_VERSION = '0.8.104';

const args = process.argv.slice(2);
const opt = { theme: null, assets: true, keys: [] };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--theme') opt.theme = args[++i];
  else if (args[i] === '--no-assets') opt.assets = false;
  else opt.keys.push(args[i]);
}
const keys = opt.keys.length ? opt.keys : Object.keys(CFG.clips);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r3 = (x) => Math.round(x * 1000) / 1000;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ── ASS 말자막 → [{in, out, html}] ─────────────────────────────────────────
// 노랑({\c&H4DD8FF&})은 <em>, 흰색({\c&HFFFFFF&})은 끝. 글자 크기 같은 다른 태그는 버린다. \N은 띄어쓰기로.
function parseAss(file) {
  const t = (s) => { const [h, m, sec] = s.split(':'); return +h * 3600 + +m * 60 + +sec; };
  const out = { caps: [], title: null };
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('Dialogue:')) continue;
    const f = line.slice(9).split(',');
    const [, start, end, style] = f; const text = f.slice(9).join(',');
    if (style === 'Title') out.title = { start: t(start), end: t(end), text };
    if (style !== 'Cap') continue;
    const segs = []; let yellow = false;
    for (const part of text.replace(/\\N/g, ' ').split(/(\{[^}]*\})/)) {
      if (!part) continue;
      if (part.startsWith('{')) {
        if (/\\c&H4DD8FF&/i.test(part)) yellow = true;
        else if (/\\c&HFFFFFF&/i.test(part)) yellow = false;
        continue;
      }
      segs.push({ s: part, y: yellow });
    }
    // 노랑 낱말 사이의 띄어쓰기는 강조 안으로 넣어 한 덩어리로
    for (let i = 1; i < segs.length - 1; i++) if (!segs[i].y && /^\s+$/.test(segs[i].s) && segs[i - 1].y && segs[i + 1].y) segs[i].y = true;
    let html = '', open = false;
    for (const sg of segs) {
      if (sg.y && !open) { html += '<em>'; open = true; }
      if (!sg.y && open) { html += '</em>'; open = false; }
      html += esc(sg.s);
    }
    if (open) html += '</em>';
    const plain = segs.map((s) => s.s).join('').trim();
    out.caps.push({ in: t(start), out: t(end), html: html.trim(), words: plain.split(/\s+/).length, em: segs.some((s) => s.y) });
  }
  return out;
}

function capTags(caps, indent) {
  return caps.map((c, i) => `${indent}<p class="kv-cap" id="${c.id}" data-in="${r3(c.in)}"${c.outAt != null ? ` data-out="${r3(c.outAt)}"` : ''} data-st="${c.st}">${c.html}</p>`).join('\n');
}

const markLine = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<span class="k-mark">$1</span>');

function buildOne(key, themeName) {
  const clip = CFG.clips[key];
  const theme = CFG.themes[themeName];
  if (!clip || !theme) throw new Error(`없는 편이나 테마: ${key} ${themeName}`);
  const dataFile = path.join(HERE, 'data', `${key}.json`);
  if (!fs.existsSync(dataFile)) throw new Error(`data/${key}.json이 없다. 먼저 python make_clean_clips.py ${key}`);
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const ass = parseAss(path.resolve(HERE, clip.ass));
  const T = data.end_start, total = data.total_sec;

  // 말자막: 끝 장 앞(1 장면)과 끝 장 위(2 장면, D의 「감사합니다」)로 나눈다
  const s1 = [], s2 = [];
  ass.caps.forEach((c, i) => {
    const next = ass.caps[i + 1];
    const dur = c.out - c.in;
    // 낱말 간격: 조각 길이의 70%에 낱말을 고르게 펼친다(말하는 속도에 가깝게, 0.07~0.45초)
    const st = r3(clamp((dur * 0.7) / Math.max(1, c.words), 0.07, 0.45));
    const onEnd = c.in >= T - 0.05;
    const item = { ...c, st, id: `${onEnd ? 'e' : 'c'}${String(i + 1).padStart(2, '0')}` };
    if (onEnd) {
      item.in = Math.max(c.in, T + 0.45);           // 끝 장이 다 들어온 뒤에 낱말이 나온다
      item.outAt = null;                              // 끝까지 남긴다
      s2.push(item);
    } else {
      let o = Math.min(c.out, next ? next.in : c.out, T) - 0.1;   // 다음 조각 직전에 사라진다(같은 자리에서 겹치지 않게)
      item.outAt = Math.max(c.in + 0.35, o);
      s1.push(item);
    }
  });

  // 제목 둘째 줄과 같은 말(노랑 강조)이 처음 들리는 순간
  const keyCap = ass.caps.find((c) => c.em && c.in < T);
  const keyT = keyCap ? r3(keyCap.in) : 0.8;

  // 펀치인 박자: 본편 자막의 문장 시작 + 강조 순간. 1.2초 안에 겹치지 않게, 처음 0.6초와 끝 장 직전은 뺀다
  const cand = [...data.sentences, keyT].filter((t) => t >= 0.6 && t <= T - 0.9).sort((a, b) => a - b);
  const punches = [];
  for (const t of cand) if (!punches.length || t - punches[punches.length - 1] >= 1.2) punches.push(r3(t));

  // 키트 템포(1.5초 안에 화면 변화 한 번, 첫 3초는 1초)를 지키려고, 변화가 없는 틈 가운데에 펀치인을 하나 더 둔다
  const changes = () => {
    const ev = [0, 0.1, 0.38, keyT, ...punches, ...data.shots.map((x) => x.t)];
    for (const c of s1) { for (let i = 0; i < c.words; i++) ev.push(c.in + i * c.st); ev.push(c.outAt); }
    return ev.filter((t) => t <= T).sort((a, b) => a - b);
  };
  const fillP = [];
  for (let guard = 0; guard < 40; guard++) {
    const ev = changes();
    const gap = ev.slice(1).map((t, i) => [ev[i], t - ev[i]]).find(([a, g]) => g > (a < 3 ? 1.0 : 1.5));   // 첫 3초는 1초
    if (!gap) break;
    const t = r3(gap[0] + gap[1] / 2);
    if (punches.some((p) => Math.abs(p - t) < 0.8)) break;
    punches.push(t); fillP.push(t); punches.sort((a, b) => a - b);
  }

  // 끝 장
  const end = { ...theme.end, ...((clip.end && clip.end[themeName]) || {}) };
  if (!end.lines) throw new Error(`${key}/${themeName}: 끝 장 문구(lines)가 없다`);
  const hasEndCap = s2.length > 0;
  const logo = '<img class="k-logo end-logo" src="assets/synk-kit/assets/logo-synk-paper.webp" alt="synk">';
  const endLogoTop = hasEndCap ? `            ${logo}\n` : '';
  const endFoot = hasEndCap ? '' : `          <div class="k-foot"><img class="k-logo" src="assets/synk-kit/assets/logo-synk-paper.webp" alt="synk">${theme.handle ? `<span class="k-handle">${esc(theme.handle)}</span>` : ''}</div>\n`;
  const sticker = end.sticker ? `              <img class="k-sticker" data-deco src="assets/synk-kit/assets/${end.sticker}.webp" alt="" style="--s:190px;--r:8deg;right:60px;bottom:-14px">\n` : '';
  const cta = end.cta ? `            <div class="end-cta"><span class="k-cta">${end.cta.pre ? esc(end.cta.pre) + ' ' : ''}<span class="kw">${esc(end.cta.kw)}</span>${end.cta.post ? esc(end.cta.post) : ''}</span></div>\n` : '';

  const dataJson = {
    key, theme: themeName, endStart: T, total, keyT, punches, transition: clip.transition || 'paper',
    nameOut: CFG.nameOutSec ?? 4.0,
  };
  const folder = themeName === CFG.defaultTheme ? key : `${key}-${themeName}`;
  const outDir = path.join(HERE, 'clips', folder);
  fs.mkdirSync(outDir, { recursive: true });

  const fill = {
    TITLE: `SYNK 창업자 인터뷰 세로 ${key} · SNS 키트판 · ${themeName}`,
    KEY: key, ACC: theme.acc, TOTAL: r3(total), END_START: r3(T), AUDIO_SEC: r3(data.v2_sec),
    HOOK_SIZE: clip.hookSize || 76, CHIP: esc(theme.chip), SPEAKER: esc(CFG.speaker.name), ROLE: esc(CFG.speaker.role),
    HOOK1: esc(clip.hook[0]), HOOK2: esc(clip.hook[1]),
    CAPTIONS_S1: capTags(s1, '        '),
    TRANSITION: dataJson.transition,
    HEAD_L: esc(theme.head[0]), HEAD_R: esc(theme.head[1]),
    END_LOGO_TOP: endLogoTop, END_IN_CLASS: hasEndCap ? ' top' : '', END_LABEL: esc(end.label), END_SIZE: end.size || 'm',
    END_LINES: end.lines.map((l) => `<span class="ln">${markLine(l)}</span>`).join(''),
    END_STICKER: sticker, END_CTA: cta, END_FOOT: endFoot,
    CAPTIONS_S2: s2.length ? capTags(s2, '          ') : '',
    DATA_JSON: JSON.stringify(dataJson),
  };
  let html = TEMPLATE;
  for (const [k, v] of Object.entries(fill)) html = html.split(`{{${k}}}`).join(String(v));
  const left = html.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (left) throw new Error(`채우지 못한 자리: ${left.join(', ')}`);
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  // HyperFrames 프로젝트 파일(모션견본과 같은 판 고정)
  const pkg = { name: `synk-interview-${key.toLowerCase()}-${themeName}`, private: true, type: 'module',
    scripts: Object.fromEntries(['dev:preview', 'check:check', 'render:render', 'publish:publish'].map((s) => { const [n, c] = s.split(':'); return [n, `npx --yes hyperframes@${HF_VERSION} ${c}`]; })) };
  fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'hyperframes.json'), JSON.stringify({
    $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json',
    registry: 'https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry',
    paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' },
    media: { autoProxy: true }, authoringSkill: 'general-video',
  }, null, 2) + '\n');
  const metaPath = path.join(outDir, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : { createdAt: '2026-10-01T00:00:00.000Z' };
  fs.writeFileSync(metaPath, JSON.stringify({ id: `인터뷰세로_${folder}`, name: `인터뷰세로_${folder}`, createdAt: meta.createdAt }, null, 2) + '\n');

  if (opt.assets) {
    // 미디어: media/ → assets/media/ (하드 링크, 안 되면 복사). 렌더 서버가 프로젝트 밖을 못 읽어서 프로젝트 안에 둔다
    const mdir = path.join(outDir, 'assets', 'media');
    fs.mkdirSync(mdir, { recursive: true });
    for (const ext of ['mp4', 'wav']) {
      const src = path.join(HERE, 'media', `${key}.${ext}`), dst = path.join(mdir, `${key}.${ext}`);
      if (!fs.existsSync(src)) throw new Error(`media/${key}.${ext}가 없다. 먼저 python make_clean_clips.py ${key}`);
      const same = fs.existsSync(dst) && fs.statSync(dst).size === fs.statSync(src).size && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs;
      if (same) continue;
      try { fs.rmSync(dst, { force: true }); fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); }
    }
    // 키트 사본(kit.css·motion.js·서체·자산)
    execFileSync(process.execPath, [path.join(REPO, 'tools', 'SNS키트_영상연결.js'), outDir], { stdio: 'ignore' });
  }
  console.log(`${folder}: ${r3(total)}초(말 ${r3(T)} + 끝 장 ${r3(total - T)}) · 자막 ${s1.length}+${s2.length} · 강조 ${keyT}s · 펀치인 ${punches.join(', ')}${fillP.length ? ` (틈 채움 ${fillP.join(', ')})` : ''} · 전환 ${dataJson.transition}`);
  return { folder, total, T, keyT, punches, fillPunches: fillP, s1: s1.map((c) => [r3(c.in), r3(c.outAt)]), s2: s2.map((c) => r3(c.in)) };
}

const result = {};
for (const key of keys) {
  const clip = CFG.clips[key];
  if (!clip) { console.error('없는 편:', key); process.exit(2); }
  const themes = opt.theme ? [opt.theme] : (clip.themes || [CFG.defaultTheme]);
  for (const th of themes) { const r = buildOne(key, th); result[r.folder] = r; }
}
const bj = path.join(HERE, 'clips', '_build.json');
const prev = fs.existsSync(bj) ? JSON.parse(fs.readFileSync(bj, 'utf8')) : {};
fs.writeFileSync(bj, JSON.stringify({ ...prev, ...result }, null, 1) + '\n');
