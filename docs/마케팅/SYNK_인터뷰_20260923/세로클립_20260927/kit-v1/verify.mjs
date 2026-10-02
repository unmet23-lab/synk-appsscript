#!/usr/bin/env node
/**
 * 키트판 인물 클립 검사 — 편마다 `hyperframes check`(오류 0)와 시점 스냅샷·확인 시트를 만든다. 렌더는 하지 않는다.
 * 쓰는 법(이 폴더에서): node verify.mjs [A B-synk ...]   (없으면 clips/_build.json의 모든 폴더)
 * 시점: 0초(표지) · 이름표 · 말자막 셋 이상 · 강조(크레용 밑줄) · 펀치인 정점 둘 · 전환 가운데 · 끝 장 들어온 뒤 · 마지막
 * 결과: clips/<폴더>/snapshots/contact-sheet-*.jpg(저장소에 남김), snapshots/*.png(제외), clips/_verify.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HF = ['--yes', 'hyperframes@0.8.104'];
const built = JSON.parse(fs.readFileSync(path.join(HERE, 'clips', '_build.json'), 'utf8'));
const folders = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(built);
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const r2 = (x) => Math.round(x * 100) / 100;

const outFile = path.join(HERE, 'clips', '_verify.json');
const all = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};

for (const f of folders) {
  const b = built[f]; if (!b) { console.error('빌드 기록 없음:', f); continue; }
  const dir = path.join(HERE, 'clips', f);
  // 1) check
  let chk;
  try {
    chk = JSON.parse(execFileSync(npx, [...HF, 'check', '--json'], { cwd: dir, encoding: 'utf8', shell: true, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch (e) {
    chk = e.stdout ? JSON.parse(e.stdout) : { ok: false, error: String(e) };
  }
  const sum = Object.fromEntries(['lint', 'runtime', 'layout', 'motion', 'contrast'].map((k) => [k, chk[k] ? { e: chk[k].errorCount, w: chk[k].warningCount, i: chk[k].infoCount } : null]));
  const findings = ['lint', 'runtime', 'layout', 'motion', 'contrast'].flatMap((k) => (chk[k]?.findings || []).map((x) => `${k}:${x.severity || ''}:${x.code || x.rule || x.type || ''}:${(x.selector || x.message || '').toString().slice(0, 80)}`));

  // 2) 시점 고르기
  const caps = b.s1;                                   // [in, out]
  const pick = (i) => caps[Math.min(caps.length - 1, Math.max(0, i))];
  const capMid = (c) => r2(c[0] + Math.min(0.9, (c[1] - c[0]) * 0.7));
  const n = caps.length;
  const times = new Set([
    0,                                                 // 표지
    0.9,                                               // 칩·이름표가 들어온 뒤
    capMid(pick(1)), capMid(pick(Math.floor(n / 4))), capMid(pick(Math.floor(n / 2))),
    capMid(pick(Math.floor((3 * n) / 4))), capMid(pick(n - 2)),            // 말자막 다섯 자리
    r2(b.keyT + 0.7),                                  // 강조 낱말 + 크레용 밑줄
    ...b.punches.slice(1, 3).map((t) => r2(t + 0.08)),  // 펀치인 정점
    r2(b.T + 0.3),                                     // 전환 가운데
    r2(b.T + 0.75),                                    // 끝 장이 막 들어옴
    r2(b.T + 1.4),                                     // 끝 장 제목·행동이 다 들어옴
    r2(b.total - 0.1),                                 // 마지막
  ]);
  if (b.s2.length) times.add(r2(b.s2[0] + 0.6));       // 끝 장 위 말자막
  const at = [...times].filter((t) => t >= 0 && t < b.total).sort((x, y) => x - y);
  const snapDir = path.join(dir, 'snapshots');
  for (const p of fs.existsSync(snapDir) ? fs.readdirSync(snapDir) : []) if (/\.(png|jpg)$/.test(p)) fs.rmSync(path.join(snapDir, p));
  execFileSync(npx, [...HF, 'snapshot', '--at', at.join(','), '--no-end', '--describe', 'false'], { cwd: dir, shell: true, stdio: 'ignore' });
  const sheets = fs.readdirSync(snapDir).filter((p) => p.startsWith('contact-sheet'));

  all[f] = { checkedAt: '2026-10-02', ok: chk.ok, summary: sum, contrast: chk.contrast ? `${chk.contrast.passed}/${chk.contrast.checked}` : null, findings, snapshotTimes: at, sheets };
  console.log(f, chk.ok ? '통과' : '실패', JSON.stringify(sum), all[f].contrast, '시점', at.join(','), sheets.join(' '));
}
fs.writeFileSync(outFile, JSON.stringify(all, null, 1) + '\n');
