#!/usr/bin/env node
/**
 * 제2의 나 · T-A v2 — 판_03 정문 창업 동아리 부스 그림 한 장 굽기 (2026-11-02).
 * T-A 1회차 GPT 시험관 둘이 판_03(태오 얼굴을 화면 가득)을 「연애 게임 시작 · 여성용」으로 읽어, 선배 둘(남 · 여)이 허리 위 중간 거리로
 * 함께 선 부스 그림으로 바꾼다. 굽기 방식은 T-C 그대로 — `../T-C/굽기.cjs`(GPT 이미지 2.5 · `tools/codex계정.js exec` · 구독 · 현금 0).
 * 지시문 = T-C 공통 머리말 + `지시문/부스.md` + T-C 공통 계절 · 규칙. 참고 그림은 승인 실사 campus-real 윗부분(사람 없는 건물 · 나무 · 빛)만.
 * bake3(예비) 주간 사용량이 90% 이상이면 굽지 않고 멈춘다(종료 4).
 *
 *   node experiences/drama/qa/제2의나-20261102/T-A/그림.mjs [이름=booth]
 *   → 공용 작업본 .tmp/me2-20261102/T-A/그림/판/<이름>_<시각>.png (+ 판/_기록/), 지시문 · 참고는 그림/지시문 · 그림/참고
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 공용 = 공용작업본(뿌리);
const 밖 = path.join(process.env.ME2_TA_OUT || path.join(공용, '.tmp', 'me2-20261102', 'T-A'), '그림');
const 이름 = process.argv[2] || 'booth';
const TC = path.join(여기, '..', 'T-C');

// 1) bake3 주간 사용량
const 계정 = spawnSync(process.execPath, [path.join(뿌리, 'tools', 'codex계정.js')], { cwd: 뿌리, encoding: 'utf8', timeout: 120000 });
const 줄 = (계정.stdout || '').split('\n').find((l) => /^bake3/.test(l)) || '';
const 몫 = Number((/주간 (\d+)%/.exec(줄) || [])[1]);
console.log('[그림] ' + (줄.trim() || 'bake3 줄을 못 읽었다'));
if (!Number.isFinite(몫) || 몫 >= 90) { console.error(`[그림] bake3 주간 ${Number.isFinite(몫) ? 몫 + '%' : '모름'} — 90% 이상이거나 못 읽어 굽지 않는다`); process.exit(4); }

// 2) 참고 — 승인 실사 campus-real 윗부분(학생 · 태오 얼굴이 들어오지 않는 건물 · 나무 · 가로등 · 빛)
const 참고 = path.join(밖, '참고', 'campus-light.png');
fs.mkdirSync(path.dirname(참고), { recursive: true });
const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").crop((430, 0, 1280, 345)).save(sys.argv[2])',
  path.join(공용, '.tmp', 'drama-art-20261030', '받음', 'campus-real.png'), 참고], { encoding: 'utf8' });
if (r.status !== 0) throw new Error('참고 자르기 실패: ' + r.stderr);

// 3) 지시문 조립
const 읽기 = (f) => fs.readFileSync(f, 'utf8').trim();
const 글 = [path.join(TC, '지시문', '_공통_머리.md'), path.join(여기, '지시문', '부스.md'), path.join(TC, '지시문', '_공통_계절.md'), path.join(TC, '지시문', '_공통_규칙.md')].map(읽기).join('\n\n') + '\n';
const 지시문 = path.join(밖, '지시문', `${이름}.txt`);
fs.mkdirSync(path.dirname(지시문), { recursive: true });
fs.writeFileSync(지시문, 글);
console.log(`[그림] 지시문 ${지시문} (${글.length}자) · 참고 ${참고}`);

// 4) 굽기(T-C 굽기.cjs, 나올 곳만 T-A 그림 폴더로)
const 굽 = spawnSync(process.execPath, [path.join(TC, '굽기.cjs'), 지시문, 이름, 참고], { cwd: 뿌리, stdio: 'inherit', env: { ...process.env, ME2_TC_OUT: 밖 } });
process.exit(굽.status ?? 1);
