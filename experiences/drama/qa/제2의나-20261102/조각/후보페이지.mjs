#!/usr/bin/env node
/**
 * 「제2의 나」 얼굴 조각 후보 페이지 빌더 (2026-11-03) — 유호님이 시즌 1 몫 12~16을 고르는 아티팩트.
 * 조각마다 기준 사진(빈 식당 웃는 자연 사진) · 지역 · 성별 · 얼굴형 · 실존 대조 한 줄(`실존대조.mjs 표`가 쓴 대조.json)을 보이고,
 * 고른 것은 페이지 db(`picks/yuho` — ids · 쓴 때)에 남는다. 다음 세션은 ArtifactData로 그 문서를 읽어 조각표를 굳힌다.
 * 그림은 긴 변 900px JPEG로 줄여 data: URI로 싣고(아티팩트 CSP), 서체는 tools/lib/브랜드폰트.js로 SUIT를 심는다.
 *
 *   node experiences/drama/qa/제2의나-20261102/조각/후보페이지.mjs <조각id=그림>… → .tmp/me2-20261102/piece-check/후보.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 조각표 } from './지시문조립.mjs';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 폰트 = require(path.join(뿌리, 'tools', 'lib', '브랜드폰트.js'));
const 밖 = path.join(공용작업본(뿌리), '.tmp', 'me2-20261102', 'piece-check');

const 쌍 = process.argv.slice(2).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), path.resolve(x.slice(i + 1))]; });
const 대조 = fs.existsSync(path.join(밖, '대조.json')) ? Object.fromEntries(JSON.parse(fs.readFileSync(path.join(밖, '대조.json'), 'utf8')).map((r) => [r.id, r])) : {};
const 작게 = (그림) => {
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', `import sys,cv2,numpy as np
im=cv2.imdecode(np.fromfile(sys.argv[1],np.uint8),1);h,w=im.shape[:2];s=900/max(h,w)
im=cv2.resize(im,(int(w*s),int(h*s)),interpolation=cv2.INTER_AREA) if s<1 else im
sys.stdout.buffer.write(cv2.imencode('.jpg',im,[cv2.IMWRITE_JPEG_QUALITY,84])[1].tobytes())`, 그림], { maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`그림 줄이기 실패: ${그림}`);
  return `data:image/jpeg;base64,${r.stdout.toString('base64')}`;
};
const 지역묶음 = (지역) => 지역.replace(/\(.*\)/, '');
const 조각들 = 쌍.map(([id, 그림]) => {
  const c = 조각표.find((x) => x.id === id);
  if (!c) throw new Error(`조각표에 없는 id: ${id}`);
  const d = 대조[id];
  return { id, 지역: c.지역, 묶음: 지역묶음(c.지역), 성별: c.성별, 얼굴형: c.얼굴형, 다시: c.다시 || null, 그림: 작게(그림),
    대조: d ? { 판정: d.판정, 렌즈: d.렌즈 ? `${d.렌즈.판정} · 공인 카드 최고 ${d.렌즈.공인최고 ?? '-'}` : '안 돌림', gemini: d.gemini || '-', gpt: d.gpt || '-', 메모: d.메모 || '' } : null };
});

const 틀 = fs.readFileSync(path.join(여기, '후보페이지.html'), 'utf8');
let html = 틀.replace('/*__조각__*/[]', JSON.stringify(조각들));
html = 폰트.심기(html).html;
fs.mkdirSync(밖, { recursive: true });
fs.writeFileSync(path.join(밖, '후보.html'), html);
console.log(`[후보 페이지] ${조각들.length}조각 · ${(Buffer.byteLength(html) / 1e6).toFixed(1)}MB → ${path.join(밖, '후보.html')}`);
