// 검수 입력·배포 후보의 내용 계약. 모델 호출이나 배포는 하지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import 자식 from 'node:child_process';
import { spawnSync } from 'node:child_process';

// Windows에서 경로 한 칸이 재분석 지점(정션 · 볼륨 마운트 지점 · 클라우드 파일 따위)인지 묻는다. fsutil은 그 지점을 열기만 하고 따라가지 않는다.
// 답은 셋이다: true(끝 부호 0 — 재분석 지점), false(끝 부호 1이고 표준 출력의
// 오류 번호 자리에 `4390:` — 재분석 지점이 아님), null(그 밖 — 실행 실패 · 시간 초과 · 없는 경로 · 다른 오류). 글은 언어마다 달라 번호만 본다.
// 프로세스 안에서 true · false만 기억한다. null은 기억하지 않는다.
const 재분석기억 = new Map();
function 재분석지점(대상) {
  if (재분석기억.has(대상)) return 재분석기억.get(대상);
  const r = 자식.spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'fsutil.exe'), ['reparsepoint', 'query', 대상], { windowsHide: true, encoding: 'latin1', timeout: 15_000 });
  const 답 = r.error || r.status === null ? null : r.status === 0 ? true : r.status === 1 && /(^|\s)4390:/.test(r.stdout || '') ? false : null;
  if (답 !== null) 재분석기억.set(대상, 답);
  return 답;
}
// 부모 폴더 목록에서 한 칸의 항목을 찾는다(글자 그대로, 없으면 대소문자만 다른 것). 목록 읽기는 그 칸을 열지 않고, libuv는 목록에 보이는
// 재분석 속성을 링크(isSymbolicLink)로 표시한다 — 정션 · 심볼릭 링크 · 볼륨 마운트 지점이 그렇다. 못 찾으면(없음, 8.3 짧은 이름, 끝 점) null.
function 목록항목(부모, 이름) {
  let 목록;
  try { 목록 = fs.readdirSync(부모, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return null; throw e; }
  const 작게 = 이름.toLowerCase();
  return 목록.find(e => e.name === 이름) ?? 목록.find(e => e.name.toLowerCase() === 작게) ?? null;
}

export const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const sort = v => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v;
export const 정규해시 = v => sha256(JSON.stringify(sort(v)));
export function 안전경로(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(p => !p || p === '.' || p === '..') || relative.includes(':')) throw new Error(`검수 상대 경로가 아니다: ${relative}`);
  const f = path.resolve(root, relative);
  // 후보 안의 symlink/junction을 따라 저장소 밖 파일을 읽지 않는다. 뿌리에서 아래로 칸마다 lstat만 본다.
  // existsSync · stat은 링크를 따라가므로, 링크인지 알기 전에 그 너머(공유 폴더 따위)에 먼저 닿는다.
  // 없는 칸이나 파일인 중간 칸에서는 걷기를 끝낸다 — 그 아래에는 열 것이 없다.
  // Windows의 볼륨 마운트 지점은 lstat(libuv)이 따라가 보통 폴더로 보고한다. 그래서 Windows에서는 칸마다 재분석 속성을 lstat보다 먼저 본다
  // (경로 글자 비교와 볼륨 번호 비교만으로는 놓친다).
  // 먼저 부모 폴더 목록의 그 항목을 본다(목록항목). 목록에 그 이름이 없을 때만 fsutil에 묻는다(재분석지점). 바쁜 PC에서 fsutil 한 번이 2초 가까이
  // 걸려, 칸마다 부르면 모든 배포 문의 판정이 몇십 분으로 는다.
  // 재분석 지점이면 lstat 없이 멈춘다. 모르면 lstat으로 있는지만 보고, 없으면 걷기를 끝내고 있으면 멈춘다.
  // 볼륨 번호(dev)가 뿌리와 다른 칸도 막는다(Linux의 다른 파일 시스템도). 뿌리 자신은 따라가 본다 — 뿌리나 그 위의 링크는 검수 도구와 git이 함께 도는 작업본 자리라 보지 않는다.
  const 뿌리 = path.resolve(root), 볼륨 = fs.statSync(뿌리, { throwIfNoEntry: false })?.dev, 창 = process.platform === 'win32';
  const 있나 = q => { try { return fs.lstatSync(q); } catch (e) { if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return null; throw e; } };
  let p = 뿌리;
  for (const 칸 of relative.split('/')) {
    const 부모 = p;
    p = path.join(p, 칸);
    let 표지 = false;
    if (창) { const 항목 = 목록항목(부모, 칸); 표지 = 항목 ? 항목.isSymbolicLink() : 재분석지점(p); }
    if (표지 === true) throw new Error(`검수 경로에 연결 파일이 있다: ${relative}`);
    const st = 있나(p);
    if (!st) break;
    if (표지 === null) throw new Error(`검수 경로의 재분석 지점을 확인하지 못했다: ${relative}`);
    if (st.isSymbolicLink() || 볼륨 !== undefined && st.dev !== 볼륨) throw new Error(`검수 경로에 연결 파일이 있다: ${relative}`);
    if (!st.isDirectory()) break;
  }
  return f;
}
function git(cwd, args, buffer = false) {
  const r = spawnSync('git', args, { cwd, windowsHide: true, maxBuffer: 1 << 28, ...(buffer ? {} : { encoding: 'utf8' }) });
  if (r.status !== 0) throw new Error(`검수 git 읽기 실패: ${args[0]}`);
  return r.stdout;
}
/** 파일상태와 같은 꼴로 바이트를 맞춘다 — 글(utf8)은 CRLF → LF, 이진은 그대로. 해시는 맞춘 바이트의 sha256이다. */
export function 맞춘내용(b) {
  const text = !b.subarray(0, 8000).includes(0) && Buffer.from(b.toString('utf8')).equals(b);
  return text ? { 바이트: Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n'), 'utf8'), 해시꼴: 'utf8-lf' } : { 바이트: b, 해시꼴: 'bytes' };
}
/** 내용(Map)을 주면 맞춘 바이트를 해시 이름으로 담는다 — 다시 검수가 앞 판과 지금 판의 diff를 만든다. */
export function 파일상태(root, relative, { rev = null, 역할 = '소스', 내용 = null } = {}) {
  let b, mode;
  if (rev) {
    const tree = git(root, ['ls-tree', rev, '--', relative]).trim();
    if (!tree) return { 경로: relative, sha256: null, 모드: null, 역할 };
    mode = tree.split(' ')[0];
    if (!['100644', '100755'].includes(mode)) throw new Error(`검수할 수 없는 git 모드: ${relative} ${mode}`);
    b = git(root, ['show', `${rev}:${relative}`], true);
  } else {
    const f = 안전경로(root, relative);
    if (!fs.existsSync(f)) return { 경로: relative, sha256: null, 모드: null, 역할 };
    if (!fs.statSync(f).isFile()) throw new Error(`검수 대상이 파일이 아니다: ${relative}`);
    b = fs.readFileSync(f);
    const stage = git(root, ['ls-files', '--stage', '--', relative]).trim();
    mode = stage ? stage.split(' ')[0] : process.platform !== 'win32' && (fs.statSync(f).mode & 0o111) ? '100755' : '100644';
    if (process.platform !== 'win32') mode = fs.statSync(f).mode & 0o111 ? '100755' : '100644';
  }
  const m = 맞춘내용(b), h = sha256(m.바이트);
  if (내용) 내용.set(h, m.바이트);
  return { 경로: relative, sha256: h, 모드: mode, 역할, 해시꼴: m.해시꼴 };
}
export function 소스스냅샷(설정, files, { 내용 = null } = {}) {
  const paths = new Map();
  for (const f of files) { paths.set(f.경로, '소스'); if (f.옛경로) paths.set(f.옛경로, '소스'); }
  for (const p of 설정.곁 || []) paths.set(p.replace(/:\d+-\d+$/, '').replace(/\\/g, '/'), '의존');
  for (const p of 설정.시험 || []) if (!/[*?]/.test(p)) paths.set(p.replace(/\\/g, '/'), '시험');
  return [...paths].sort(([a], [b]) => a.localeCompare(b)).map(([p, 역할]) => 파일상태(설정.저장소, p, { rev: 설정.끝 === '작업본' ? null : 설정.끝.커밋, 역할, 내용 }));
}
export function 후보읽기(folder) {
  if (!folder) return null;
  const root = path.resolve(folder), raw = JSON.parse(fs.readFileSync(path.join(root, '후보.json'), 'utf8').replace(/^\uFEFF/, ''));
  if (raw.판 !== 1 || !['synk.im', 'apps-script'].includes(raw.종류) || !Array.isArray(raw.항목) || !raw.항목.length) throw new Error('배포 후보 manifest 판·종류·항목이 잘못됐다');
  const seen = new Set();
  const 항목 = raw.항목.map(x => {
    const f = 안전경로(root, x.경로);
    if (seen.has(x.경로)) throw new Error(`배포 후보 경로 중복: ${x.경로}`);
    seen.add(x.경로);
    if (!['새', '바꿈', '토큰', '지움'].includes(x.종류)) throw new Error(`배포 후보 종류 오류: ${x.경로}`);
    if (x.종류 === '지움') {
      if (x.sha256 !== null || x.모드 !== null || fs.existsSync(f)) throw new Error(`삭제 후보에 내용이 남았다: ${x.경로}`);
    } else {
      if (!/^[a-f0-9]{64}$/.test(x.sha256 || '') || !['100644', '100755'].includes(x.모드)) throw new Error(`배포 후보 해시·모드 오류: ${x.경로}`);
      if (sha256(fs.readFileSync(f)) !== x.sha256) throw new Error(`배포 후보 내용 불일치: ${x.경로}`);
    }
    return { 경로: x.경로, sha256: x.sha256, 모드: x.모드, 종류: x.종류 };
  }).sort((a, b) => a.경로.localeCompare(b.경로));
  const manifest = { 판: 1, 종류: raw.종류, 항목 };
  return { ...manifest, manifestSha256: 정규해시(manifest) };
}
const 블롭번호 = b => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
/** 공개 도구가 후보 곁에 남긴 앞 공개본(`.앞판/<경로>`, 후보.json의 앞판 = 경로 → git blob 번호). 번호가 맞는 것만 돌려준다 — 없거나 어긋나면 그 파일은 통째로 검수한다.
 *  증명 칸(위 · 항목)은 배포 증명에 묶여, 공개 도구가 그 공개 커밋에 정말 그 판이 있는지 대조한다. */
export function 후보앞판읽기(folder) {
  const 판 = new Map(), 항목 = {};
  if (!folder) return { 판, 증명: null };
  const root = path.resolve(folder), raw = JSON.parse(fs.readFileSync(path.join(root, '후보.json'), 'utf8').replace(/^﻿/, ''));
  for (const [경로, 번호] of Object.entries(raw.앞판 || {})) {
    let b;
    try { b = fs.readFileSync(안전경로(root, `.앞판/${경로}`)); } catch { continue; }
    if (블롭번호(b) === 번호) { 판.set(경로, b); 항목[경로] = 번호; }
  }
  return { 판, 증명: 판.size ? { 위: raw.위 ?? null, 항목 } : null };
}
// 검수 정책 판. 정책과 함께 입력 해시에 봉인되므로 사슬은 처음 준비한 판으로 끝까지 판정한다.
// 1: Claude 백엔드에 아르곤 · GPT 둘을 적은 옛 판 — 필수는 GPT 하나로 본다(실제필수).
// 2: Claude 백엔드의 필수 검수는 GPT 하나다. 막히면 아르곤 → Fable.
// 5: GPT 작성의 다시 검수는 GPT만 보고, Claude는 첫 판 · 끝 판과 자기가 낸 지적만 본다(끝판정책).
// 6: 카본 작성 화면을 받는다. Claude 백엔드에서 아르곤이 낸 지적을 다시 볼 때 아르곤이 막히면 GPT가 먼저 본다(대신할검수자).
// 7: GPT 작성 백엔드의 GPT 자리를 GPT가 막혔을 때 아르곤(카본)이 대신한다(GPT자리대체정책).
// 8: 판 6 · 7에 있던 그록 차례를 뺀 판이다. 아르곤이 낸 지적을 다시 볼 때도 판 5처럼 아르곤 → Fable이다.
//    그록이 검수에서 빠진(11-22) 뒤로는 판 6 · 7 사슬도 그록 없이 판정한다.
// 3 · 4는 작업 한정 사용자지정 판이었고, 그 작업이 모두 끝나 받지 않는다.
export const 정책판 = 8;
export function 정책만들기(o, files, { 판 = 정책판 } = {}) {
  if (![1, 2, 5, 6, 7, 8].includes(판)) throw new Error(`모르는 검수 정책 판: ${판}`);
  if (o.사용자지정 || o.담당예외 != null) throw new Error('작업 한정 사용자지정 · 담당예외는 그 작업이 끝나 받지 않는다 — 일반 정책으로 준비한다');
  const candidate = 후보읽기(o.배포후보);
  const 기준이미지만 = candidate?.종류 === 'synk.im' && candidate.항목.every(f => /^\.github\/site-check\/baseline\/.+\.(?:json|png|jpe?g|webp)$/i.test(f.경로));
  if (candidate && o.종류 !== (candidate.종류 === 'synk.im' && !기준이미지만 ? '화면' : '백엔드')) throw new Error(`배포 후보 ${candidate.종류}에 맞는 검수 종류가 아니다`);
  const 작성자 = o.작성자 || 'Claude', 구독 = o.GPT구독 || '유지';
  if (!['Claude', 'GPT', '카본'].includes(작성자)) throw new Error('--작성자는 Claude|GPT|카본');
  if (작성자 === '카본' && (판 < 6 || o.종류 !== '화면')) throw new Error('카본 작성자는 현재 판의 화면 구현에만 쓴다');
  if (작성자 === 'GPT' && o.종류 === '화면') throw new Error('GPT 세션의 화면 구현은 카본, Claude 세션은 Claude 담당이다 — GPT 작성 화면 정책은 없다');
  if (!['유지', '종료'].includes(구독)) throw new Error('--GPT구독은 유지|종료');
  if (구독 === '종료' && (!o.사유?.trim() || 작성자 !== 'Claude')) throw new Error('GPT 구독 종료는 Claude 작업에서 --사유와 함께 명시한다');
  // 화면 Fable 생략: 그림·글·색만 바꾼 화면처럼 Fable이 볼 것이 적은 일은 아르곤만 받는다 — 까닭을 정책에 남긴다.
  // 아르곤이 한도·로그인으로 막히거나 아르곤 P0·P1을 고치면 Fable이 다시 들어온다(검수묶음.mjs 처음고리판정·사슬판정·집계하기).
  const 페이블생략 = o.페이블생략 == null ? null : String(o.페이블생략).trim();
  if (페이블생략 !== null && (o.종류 !== '화면' || !페이블생략)) throw new Error('--페이블생략은 화면 검수에서 까닭과 함께만 쓴다');
  const 필수 = o.종류 === '화면' ? (페이블생략 ? ['아르곤'] : ['아르곤', 'Fable']) : 작성자 === 'GPT' ? ['GPT', 'Claude'] : 구독 === '종료' ? ['아르곤'] : 판 === 1 ? ['아르곤', 'GPT'] : ['GPT'];
  let 예외 = null;
  if (o.예외) {
    if (!['내부', '아주작은수정', '콘텐츠'].includes(o.예외) || !o.대상?.trim() || !o.사유?.trim()) throw new Error('검수 예외에는 --예외 내부|아주작은수정|콘텐츠 --대상 --사유가 필요하다');
    const candidates = candidate?.항목 || [];
    const targets = o.대상.split(',').map(s => s.trim().replace(/\\/g, '/').replace(/\/$/, ''));
    const all = [...files, ...candidates];
    if (!all.length || targets.some(p => !p || !all.some(f => f.경로 === p || f.경로.startsWith(p + '/'))) || !all.every(f => targets.some(p => f.경로 === p || f.경로.startsWith(p + '/')))) throw new Error('검수 예외 대상이 실제 변경·배포 후보 경로 전체와 맞지 않는다');
    if (o.예외 === '내부' && o.종류 !== '화면') throw new Error('내부 예외는 유호·운영자만 보는 내부 화면에만 쓴다');
    if (o.예외 === '콘텐츠' && all.some(f => /\.(?:[cm]?js|jsx|tsx?|css|html?|json|ya?ml|py|sql|sh|ps1)$/i.test(f.경로))) throw new Error('콘텐츠 예외에 코드·설정 파일이 섞였다');
    if (o.예외 === '아주작은수정' && (files.length !== 1 || files.some(f => f.상태 !== 'M' || (f.더함 || 0) + (f.뺌 || 0) > 4))) throw new Error('아주 작은 수정 예외는 기존 파일 하나의 변경 네 줄 이내만 지원한다');
    if (o.예외 === '아주작은수정' && candidates.some(f => f.종류 === '지움' || f.경로 !== files[0].경로 || sha256(fs.readFileSync(안전경로(o.저장소, f.경로))) !== f.sha256)) throw new Error('아주 작은 수정의 배포 후보는 검토 대상 원천 파일 그대로여야 한다');
    예외 = { 종류: o.예외, 대상: o.대상.trim(), 사유: o.사유.trim() };
  }
  return { 판, 작성자, 종류: o.종류, GPT구독: 구독, ...(구독 === '종료' ? { 구독사유: o.사유.trim() } : {}), 필수, 예외, ...(페이블생략 ? { 페이블생략 } : {}) };
}
/** Claude 백엔드의 검수 순서 — 앞 검수자가 한도·로그인으로 막혔을 때만 다음으로 넘어간다(GPT → 아르곤 → Fable, GPT 구독 종료면 아르곤 → Fable).
 *  화면(아르곤 → Fable 최종)과 GPT 작성(GPT·Claude 두 자리 — 대신은 GPT자리대체정책 · 대신할검수자가 맡는다)은 null. */
export function 대체순서(정책) {
  if (정책.종류 === '화면' || 정책.작성자 === 'GPT') return null;
  return 정책.GPT구독 === '종료' ? ['아르곤', 'Fable'] : ['GPT', '아르곤', 'Fable'];
}
/** GPT 작성 백엔드의 GPT 자리를 아르곤(카본)이 대신할 수 있는 정책인가(판 7부터).
 *  GPT가 한도·로그인으로 막힌 증거(막힘증거)가 있을 때만 아르곤이 그 자리를 채운다. Claude 자리는 대신이 없고 아르곤 다음 차례도 없다.
 *  GPT가 한도로만 막혔으면 대신하지 않고 GPT 몫을 생략으로 친다(한도생략증거). */
export const GPT자리대체정책 = 정책 => Boolean(정책 && 정책.판 >= 7 && 정책.작성자 === 'GPT' && 정책.종류 === '백엔드');
/** GPT 검수 생략의 증거가 되는 유일한 문장. 검수묶음.mjs의 GPT골라부르기가 모든 계정을 한 번에 읽은 사진에서
 *  Pro 계정이 모두 주간이나 5시간 100%였을 때(그 호출에서 한도 오류를 낸 계정 포함)만 이 문장으로 시작하는 오류를 던진다.
 *  그런 고리는 GPT 몫을 「생략(한도 없음)」으로 치고 카본 · Fable이 대신 보지 않는다(운영 원칙 「한도」). 로그인 막힘은 한도가 아니라 대신할검수자 차례로 간다. */
export const GPT한도생략문장 = 'GPT quota — 몫이 남은 Pro 계정이 없다(모두 주간이나 5시간 100%)';
/** 한도 생략으로 칠 수 있는 막힘 증거인가 — 허용 목록이다. 종류가 한도이고 원문이 GPT한도생략문장으로 시작할 때만 참이다.
 *  한 계정만 보고 남은 한도 기록(codex의 날 한도 글, 보내기 전 몫 0의 JSON)과 옛 90% 문턱이 남긴 글(「주간 90% 아래인 Pro 계정이 없다」)은
 *  종류는 한도여도 생략 증거가 아니다 — 다른 계정에 몫이 남았을 수 있어 대신 차례를 탄다. */
export const 한도생략증거 = 증거 => Boolean(증거 && 증거.종류 === '한도' && String(증거.원문 || '').startsWith(GPT한도생략문장));
/** 지금 규칙으로 꼭 받아야 하는 검수자(대체는 빼고). 옛 판 1의 [아르곤, GPT]도 [GPT]로 본다. */
export const 실제필수 = 정책 => (대체순서(정책) ? [대체순서(정책)[0]] : 정책.필수);
export const 필수글 = 정책 => {
  const 순서 = 대체순서(정책);
  if (정책.페이블생략) return `아르곤(Fable 생략 — ${정책.페이블생략} · 아르곤이 한도·로그인으로 막히거나 아르곤 P0·P1을 고치면 Fable)`;
  if (GPT자리대체정책(정책)) return 'GPT · Claude(GPT가 한도로 막히면 GPT 몫은 생략 · 로그인으로 막힌 증거가 있을 때만 카본(아르곤)이 GPT 자리를 대신 · Claude 자리는 대신 없음)';
  if (순서?.[0] === 'GPT') return `GPT(한도가 없으면 생략 · 로그인으로 막히면 ${순서.slice(1).join(' → ')})`;
  return 순서 ? `${순서[0]}(한도·로그인으로 막히면 ${순서.slice(1).join(' → ')})` : 정책.필수.join(' · ');
};
export function 응답검사(answer, expected, { final = false } = {}) {
  const errors = [];
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return ['응답이 객체가 아니다'];
  if (!Array.isArray(answer.findings)) errors.push('findings 목록 없음');
  else for (const f of answer.findings) if (!f || !['P0', 'P1', 'P2', 'P3'].includes(f.grade) || ['location', 'quote', 'problem', 'fix'].some(k => typeof f[k] !== 'string') || !f.location?.trim() || !f.problem?.trim()) errors.push('지적 schema 오류');
  const c = answer.coverage;
  if (!c || typeof c.reviewed !== 'string' || !c.reviewed.trim() || typeof c.limitations !== 'string' || typeof c.complete !== 'boolean' || !Array.isArray(c.missing) || c.missing.some(x => typeof x !== 'string')) errors.push('coverage schema 오류');
  else if (!c.complete || c.missing.length) errors.push(`검토 누락: ${c.missing.join(', ') || c.limitations || '미완료'}`);
  if (!Array.isArray(answer.seen) || answer.seen.some(x => typeof x !== 'string')) errors.push('seen 목록 없음');
  else if (expected) {
    const norm = s => s.trim().replace(/^\[|\]$/g, '').toLowerCase();
    const got = answer.seen.map(norm), want = expected.항목.map(norm);
    if (new Set(got).size !== got.length || got.length !== want.length || want.some(x => !got.includes(x))) errors.push('seen이 요구 항목 집합과 다르다');
  }
  // 다시 검수 묶음: 다시 볼 지적([Q…])마다 풀었는지를 한 번씩 답한다
  if (expected?.대상) {
    const t = answer.targets;
    if (!Array.isArray(t) || t.some(x => !x || typeof x.id !== 'string' || typeof x.resolved !== 'boolean' || typeof x.note !== 'string')) errors.push('targets schema 오류');
    else {
      const got = t.map(x => x.id.trim().replace(/^\[|\]$/g, ''));
      if (new Set(got).size !== got.length || got.length !== expected.대상.length || expected.대상.some(x => !got.includes(x))) errors.push('targets가 다시 볼 지적 집합과 다르다');
    }
  }
  if (expected && answer.endMarker !== expected.표식) errors.push('끝 표식 불일치');
  if (final && (!expected?.검토입력해시 || answer.reviewInputHash !== expected.검토입력해시)) errors.push('최종 검토 입력 해시 불일치');
  return errors;
}
// 일반 오류·응답 속 단어는 막힘으로 간주하지 않는다. 실행기가 받은 실패 원문을 보존한다.
export function 막힘증거(누구, raw, usage = null) {
  const 도구 = 누구 === 'GPT' ? 'codex' : 'agy';
  if (usage?.주간 === 0) return { 종류: '한도', 도구, 원문: JSON.stringify(usage) };
  const text = String(raw || '');
  const quota = 누구 === 'GPT' ? /(?:hit your usage limit|usage limit.*(?:reached|exceeded)|no Pro account.*(?:available|remaining)|Pro 계정.*(?:없|한도)|주간.*한계)/i
    : /(?:RESOURCE_EXHAUSTED|QUOTA_EXHAUSTED|quota.*(?:exceeded|exhausted)|limit remaining 0|429.*(?:quota|rate))/i;
  const login = /(?:not logged in|login required|authentication (?:failed|required)|unauthenticated|invalid credential|로그인이 필요)/i;
  return quota.test(text) || login.test(text) ? { 종류: quota.test(text) ? '한도' : '로그인', 도구, 원문: text } : null;
}
/** 다시 검수(고친 diff만) 증명 — 앞 고리 후보 해시·지금 후보 해시·diff 해시·대상 지적·묶음 입력 SHA를 한 해시에 묶는다. */
export function 다시증명(body) {
  const 검토입력해시 = 정규해시(body);
  return { ...body, 검토입력해시, 표식: `END_OF_FINAL_REVIEW_${검토입력해시}` };
}
/** 앞 판과 지금 판(파일 스냅샷·배포 후보)에서 내용·모드가 달라진 경로. */
export function 바뀐경로들(앞판, 지금판, 앞후보 = null, 지금후보 = null) {
  const 앞 = new Map(앞판.map(f => [f.경로, f]));
  const 소스 = 지금판.filter(f => { const a = 앞.get(f.경로); return !a || a.sha256 !== f.sha256 || a.모드 !== f.모드; }).map(f => f.경로).sort();
  const 후보앞 = new Map((앞후보?.항목 || []).map(x => [x.경로, x])), 후보지금 = new Map((지금후보?.항목 || []).map(x => [x.경로, x]));
  const 후보 = [...new Set([...후보앞.keys(), ...후보지금.keys()])].filter(k => 정규해시(후보앞.get(k) ?? null) !== 정규해시(후보지금.get(k) ?? null)).sort();
  return { 소스, 후보 };
}
/** GPT 작성 작업의 Claude를 첫 판·끝 판과 자기 지적으로 줄인 정책인가(판 5부터). */
export const 끝판정책 = 정책 => 정책.판 >= 5 && 정책.작성자 === 'GPT';
/** 다시 검수자: 그 지적을 낸 검수자. GPT 작성은 GPT(판 5부터 Claude는 끝 판과 자기 지적만, 옛 판은 둘 다), 화면은 Fable이 끝 상태를 본다, 대상이 없으면 정책의 첫 검수자.
 *  화면 Fable 생략 묶음은 다시 볼 지적이 없으면 아르곤만 — 고친 P0·P1이 있으면 화면을 보는 Fable이 함께 본다.
 *  판 7 GPT 작성도 다시 검수자는 그대로 GPT(끝 판과 Claude 지적이면 Claude도)다 — GPT가 막혔을 때만 대신할검수자가 아르곤을 부르고,
 *  아르곤이 낸 지적은 아르곤의 재확인 답으로 판정한다(다시고리판정의 판정자). */
export function 다시검수자들(정책, 대상, { 끝판 = false } = {}) {
  if (끝판정책(정책)) return 끝판 || 대상.some(t => t.출처 === 'Claude') ? ['GPT', 'Claude'] : ['GPT'];
  if (정책.작성자 === 'GPT') return [...정책.필수];
  const 낸 = ['아르곤', 'GPT', 'Fable'].filter(w => 대상.some(t => t.출처 === w));
  if (정책.종류 === '화면') return 정책.페이블생략 && !낸.length ? ['아르곤'] : [...new Set([...낸, 'Fable'])];
  return 낸.length ? 낸 : [대체순서(정책)[0]];
}
/** 그 검수자가 한도·로그인으로 막혔을 때 대신하는 차례(자신 포함). GPT 작성은 판 6까지 대신이 없고, 판 7부터는 GPT만 아르곤이 대신한다 —
 *  Claude는 대신이 없고 아르곤 다음 차례도 없다. 화면과 판 5 · 8은 GPT → 아르곤 → Fable의 자기 뒤 차례다.
 *  판 6 · 7 Claude 백엔드는 대체 순서 안에서 Fable 앞의 검수자를 모두 거친다 — 아르곤이 낸 지적을 다시 볼 때 아르곤이 막히면 GPT가 먼저다
 *  (아르곤 → GPT → Fable). 이 차례는 그 판으로 봉인한 사슬에만 남는다. */
export function 대신할검수자(정책, 누구) {
  if (GPT자리대체정책(정책)) return 누구 === 'GPT' ? ['GPT', '아르곤'] : [누구];
  if (정책.작성자 === 'GPT') return [누구];
  const 순서 = (정책.판 === 6 || 정책.판 === 7) && 대체순서(정책);
  if (순서) {
    const i = 순서.indexOf(누구);
    return i < 0 ? [누구] : 누구 === 'Fable' ? ['Fable'] : [누구, ...순서.filter(w => w !== 누구 && w !== 'Fable'), 'Fable'];
  }
  const 차례 = ['GPT', '아르곤', 'Fable'], i = 차례.indexOf(누구);
  return i < 0 ? [누구] : 차례.slice(i);
}
/** 머리: 그 스냅샷이 선 커밋(끝 커밋, 작업본이면 그때 HEAD) — 증명에 묶어 합침 고리가 둘의 바탕을 증명 밖 칸에서 읽지 않게 한다. 옛 증명에는 없다. */
export function 입력증명({ 정책, 파일, 배포후보 = null, 항목 = [], 자료해시 = null, 보조파일 = [], 후보앞판 = null, 머리 = null, 생성물 = null }) {
  // 생성물(2026-11-21): 명세 · 대본 해시와 재현 결과 — 없는 묶음은 칸 자체가 없어 앞 증명의 해시가 그대로다.
  const body = { 정책, 파일, 배포후보, 항목, 자료해시, 보조파일, ...(후보앞판 ? { 후보앞판 } : {}), ...(머리 ? { 머리 } : {}), ...(생성물 ? { 생성물 } : {}) };
  const 검토입력해시 = 정규해시(body);
  return { ...body, 검토입력해시, 표식: `END_OF_FINAL_REVIEW_${검토입력해시}`, 항목 };
}

// ── 합침 고리 ─────────────────────────────────────────────
// 앞 검수 뒤 이 세션의 고침 없이 origin/master에 먼저 오른 커밋을 합쳐 바이트만 바뀐 판은 검수자를 다시 부르지 않고
// 기계 대조로 사슬을 잇는다(검수묶음.mjs 다시 --합침만). 경계: 배포 바이트 = (origin/master에 있는 커밋들) ⊕ (이 사슬이 검수한 고침) —
// 첫 준비의 바탕 아래 남의 변경을 이 사슬 검수자가 보지 않는 것과 같은 경계를 사슬 중간에 오른 origin 커밋까지 넓힌다.
// 이 세션의 손 고침(작업본 · 안 올린 커밋 · 충돌 풀이 · 검수한 고침과 같은 커밋에 섞여 올라간 덧고침)은 한 줄이라도 거절한다.
export const 원격참조 = 'refs/remotes/origin/master';
const 판열쇠 = x => (x?.sha256 == null ? null : `${x.모드}\u0000${x.sha256}`);
const 글바이트 = b => !b.subarray(0, 8000).includes(0);
/** git merge-file -p <a> <y> <t> — 종료 0만 깨끗한 합침, 1~127은 충돌 수, 그 밖은 실행 오류. */
export function git합침(a, y, t) {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-merge-'));
  try {
    for (const [n, b] of [['a', a], ['y', y], ['t', t]]) fs.writeFileSync(path.join(임시, n), b);
    const r = spawnSync('git', ['merge-file', '-p', 'a', 'y', 't'], { cwd: 임시, windowsHide: true, maxBuffer: 1 << 28 });
    if (r.error) throw r.error;
    if (r.status === 0) return { 결과: r.stdout, 충돌: false };
    if (r.status > 0 && r.status < 128) return { 결과: null, 충돌: true };
    throw new Error(`git merge-file 실패(${r.status}): ${String(r.stderr || '').trim().slice(0, 300)}`);
  } finally { fs.rmSync(임시, { recursive: true, force: true, maxRetries: 3 }); }
}
/** 세 방향 합침 ⊕(a, y, t) — 판은 { sha256, 모드, 바이트 }(없는 판은 sha256 null). 같은 쪽 규칙이 먼저고, 셋 다 있는 글(NUL 없음)만 git merge-file로 바이트를 합친다.
 *  이진 · 있음/없음이 엇갈린 셋 · 모드 셋이 다 다름 · 줄 충돌은 충돌이다. 돌려주는 판에는 바이트가 있다(없는 판은 null). */
export function 판합침(a, y, t, { 합치기 = git합침 } = {}) {
  const ka = 판열쇠(a), ky = 판열쇠(y), kt = 판열쇠(t);
  if (ka === kt) return { 판: a, 충돌: false };
  if (ka === ky) return { 판: t, 충돌: false };
  if (kt === ky) return { 판: a, 충돌: false };
  if (!a.바이트 || !y.바이트 || !t.바이트 || ![a, y, t].every(x => 글바이트(x.바이트))) return { 판: null, 충돌: true };
  const 모드 = a.모드 === t.모드 ? a.모드 : a.모드 === y.모드 ? t.모드 : t.모드 === y.모드 ? a.모드 : null;
  if (!모드) return { 판: null, 충돌: true };
  const 바이트 = a.바이트.equals(t.바이트) ? a.바이트 : a.바이트.equals(y.바이트) ? t.바이트 : t.바이트.equals(y.바이트) ? a.바이트 : null;
  if (바이트) return { 판: { sha256: sha256(바이트), 모드, 바이트 }, 충돌: false };
  const r = 합치기(a.바이트, y.바이트, t.바이트);
  return r.충돌 ? { 판: null, 충돌: true } : { 판: { sha256: sha256(r.결과), 모드, 바이트: r.결과 }, 충돌: false };
}
function 깃(cwd, args, { buffer = false, input = undefined, 허용 = [0] } = {}) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd, windowsHide: true, maxBuffer: 1 << 29, input, ...(buffer ? {} : { encoding: 'utf8' }) });
  if (r.error) throw r.error;
  if (!허용.includes(r.status)) throw new Error(`합침 대조 git ${args[0]} 실패(${r.status}): ${String(r.stderr || '').trim().slice(0, 300)}`);
  return r;
}
const 줄들 = s => String(s).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
// 사슬 중간의 합침은 몇 시간 · 며칠 안의 origin 커밋이다 — 바탕이 너무 멀면 새로 준비하는 편이 맞고, 기록도 커진다
export const 합침커밋상한 = 3000;
/** 날 바이트를 맞춘 꼴 판으로 — 소스 스냅샷 해시와 같은 꼴(utf8 글은 CRLF → LF). 배포 후보도 이 꼴로 견준다: 날 바이트는 배포 도구가 따로 origin/master와 대조한다. */
export const 맞춘판 = (b, 모드) => { if (b == null) return { sha256: null, 모드: null, 바이트: null }; const m = 맞춘내용(b).바이트; return { sha256: sha256(m), 모드, 바이트: m }; };
/** 여러 rev의 항목 판을 `git cat-file --batch` 한 번으로 — Map(rev → Map(열쇠 → 판)). 모드는 그 트리 항목의 모드(%(objectmode)), 없는 경로는 빈 판. */
function 판들읽기(cwd, revs, 항목) {
  const 결과 = new Map(revs.map(rev => [rev, new Map(항목.map(x => [x.열쇠, 맞춘판(null)]))]));
  const 줄 = revs.flatMap(rev => 항목.map(x => ({ rev, x })));
  if (!줄.length) return 결과;
  if (줄.some(({ x }) => /[\r\n]/.test(x.경로))) throw new Error('합침 대조할 수 없는 경로(줄바꿈)');
  const out = 깃(cwd, ['cat-file', '--batch=%(objectmode) %(objectname) %(objecttype) %(objectsize)'], { buffer: true, input: 줄.map(({ rev, x }) => `${rev}:${x.경로}`).join('\n') + '\n' }).stdout;
  let i = 0;
  for (const { rev, x } of 줄) {
    const 끝 = out.indexOf(10, i);
    if (끝 < 0) throw new Error(`합침 대조 blob 읽기가 끊겼다: ${x.경로}`);
    const 머리 = out.subarray(i, 끝).toString('utf8');
    if (머리 === `${rev}:${x.경로} missing`) { i = 끝 + 1; continue; }
    const m = /^(\d{6}) ([0-9a-f]+) (\w+) (\d+)$/.exec(머리);
    if (!m) throw new Error(`합침 대조 blob 읽기 실패: ${x.경로} (${rev.slice(0, 9)}) — ${머리.slice(0, 80)}`);
    if (m[3] !== 'blob' || !['100644', '100755'].includes(m[1])) throw new Error(`합침 대조할 수 없는 git 모드: ${x.경로} ${m[1]} ${m[3]} (${rev.slice(0, 9)})`);
    const n = Number(m[4]);
    결과.get(rev).set(x.열쇠, 맞춘판(Buffer.from(out.subarray(끝 + 1, 끝 + 1 + n)), m[1]));
    i = 끝 + 1 + n + 1;
  }
  return 결과;
}
const 덩이로 = (xs, n = 60) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const 커밋이름 = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
/** git rev-list 출력(커밋 이름만 — 자유 글 없음)을 줄마다 읽어 꼴을 본다. */
const 커밋줄들 = (cwd, args) => 줄들(깃(cwd, ['rev-list', ...args]).stdout).map(줄 => {
  const xs = 줄.split(' ');
  if (!xs.every(x => 커밋이름.test(x))) throw new Error(`합침 대조 커밋 목록을 읽지 못했다: ${줄.slice(0, 90)}`);
  return xs;
});
/** Y..O 커밋을 오래된 것부터 — [{ 커밋, 부모[] }]와, 경로 묶음을 바꾼 커밋 집합을 주는 닿음(경로들). 모두 `rev-list` 출력(커밋 이름뿐)에서만 읽는다 —
 *  커밋 제목의 제어 문자나 다음 커밋 이름과 같은 파일 이름으로 경계를 속이지 못하게, 경로는 git의 경로 거름(pathspec)이 고른다. */
function 범위커밋들(cwd, Y, O) {
  const 차례 = 커밋줄들(cwd, ['--topo-order', '--reverse', '--parents', `${Y}..${O}`]).map(([커밋, ...부모]) => ({ 커밋, 부모 }));
  const 닿음 = 경로묶음 => {
    const s = new Set();
    for (const 덩이 of 덩이로([...new Set(경로묶음)])) for (const [c] of 커밋줄들(cwd, ['--full-history', `${Y}..${O}`, '--', ...덩이.map(p => `:(literal)${p}`)])) s.add(c);
    return s;
  };
  return { 차례, 닿음 };
}
/** 보이는 기록용 커밋 제목 — 판정에는 쓰지 않는다. 제어 문자는 빈칸으로. */
function 커밋제목들(cwd, 커밋들) {
  const 제목 = new Map();
  for (const 덩이 of 덩이로(커밋들, 100)) for (const 줄 of 깃(cwd, ['log', '-z', '--no-walk=unsorted', '--format=%H %s', ...덩이]).stdout.split('\0')) {
    const m = /^([0-9a-f]{40}(?:[0-9a-f]{24})?) ([\s\S]*)$/.exec(줄);
    if (m) 제목.set(m[1], m[2].replace(/[\u0000-\u001f\u007f]/g, ' ').trim());
  }
  return 제목;
}
/** 합침 대조 — 앞 검수 판 A(항목마다 앞 = { sha256, 모드, 바이트 }), 지금 판 S(지금 = { sha256, 모드 }), 앞 고리 머리 H, origin 판 O로
 *  둘의 바탕 Y = merge-base(H, O)를 잡고 세 모양 가운데 하나로 기대 판 E를 정해 S와 견준다. 항목 = [{ 열쇠, 갈래: '소스', 경로, 앞, 지금 }] — 배포 후보는 바이트가 바뀌면 합침만을 받지 않아 항목에 없다.
 *  O는 만들 때 merge-base(지금 머리, origin/master), 다시 대조할 때는 기록한 값(origin/master의 조상인지 본다).
 *   · 앞 판 그대로 — A = Y(이 사슬 고침이 이미 Y 아래): E = O
 *   · 안 올림 — O에 이 사슬 고침이 한 줄도 없다(M = A⊕O가 깨끗하고, 고침이 있는 항목마다 M에서 고침을 되돌리면 정확히 O): E = M
 *   · 올림 — O에 이 사슬 고침이 있다: Y..O에서 그 고침을 처음 들인, 그 고침만 담은 부모 하나인 커밋(나르개)이 있어야 한다 —
 *     부모 C^에는 이 사슬 고침이 한 줄도 없고(안 올림과 같은 되돌리기 대조) 모든 항목에서 C = A⊕C^. 고침 일부를 덧고침과 함께 먼저 올리고
 *     나머지를 따로 올린 꼴은 나르개가 없다. E = O
 *  구조 문제(H · O · Y를 못 읽음, O가 origin/master에 없음, 바탕이 여럿 · 없음)는 던지고, 판정은 { 모양, 다름, 충돌, 나르개 }로 돌려준다. */
export function 합침대조({ 저장소, 앞머리, 지금머리 = null, origin = null, 항목, 합치기 = git합침 }) {
  const 바탕하나 = (a, b, 말) => {
    if (!a || !b) throw new Error(`${말}을 git에서 읽지 못했다: 기록 없음`);
    const r = 깃(저장소, ['merge-base', '--all', a, b], { 허용: [0, 1, 128] }), xs = 줄들(r.stdout);
    if (r.status === 128) throw new Error(`${말}을 git에서 읽지 못했다: ${String(r.stderr || '').trim().split('\n')[0].slice(0, 160)}`);
    if (xs.length !== 1) throw new Error(`${말}의 바탕이 ${xs.length ? '여럿이다(교차 합침)' : '없다'} — 합침만으로 잇지 못한다`);
    return xs[0];
  };
  // O: 만들 때는 지금 머리가 서 있는 가장 새 origin 커밋, 다시 대조할 때는 기록한 값이 아직 origin/master의 조상인지
  let O;
  if (origin) {
    const r = 깃(저장소, ['merge-base', '--is-ancestor', origin, 원격참조], { 허용: [0, 1, 128] });
    if (r.status !== 0) throw new Error(r.status === 1 ? `origin 판 ${String(origin).slice(0, 9)}가 origin/master에 없다` : `기록한 origin 판 · origin/master 원격 참조를 git에서 읽지 못했다: ${String(r.stderr || '').trim().split('\n')[0].slice(0, 160)}`);
    O = origin;
  } else O = 바탕하나(지금머리, 원격참조, '지금 머리와 origin/master');
  const Y = 바탕하나(앞머리, O, '앞 고리 머리와 origin 판');
  const 범위 = 범위커밋들(저장소, Y, O);
  if (범위.차례.length > 합침커밋상한) throw new Error(`앞 고리 머리와 origin 판 사이 커밋이 ${범위.차례.length}개라 합침 대조를 하지 않는다 — 새로 준비한다`);
  // 감사용 기록: 항목 경로를 바꾼 Y..O 커밋, 오래된 것부터 — 나르개 후보도 여기서 고른다. 제목은 보이기만 하고 판정에는 쓰지 않는다
  const 항목닿음 = 항목.length ? 범위.닿음(항목.map(x => x.경로)) : new Set();
  const 고른 = 범위.차례.filter(c => 항목닿음.has(c.커밋));
  const 제목 = 고른.length ? 커밋제목들(저장소, 고른.map(c => c.커밋)) : new Map();
  const 커밋들 = 고른.map(c => ({ 커밋: c.커밋, 제목: 제목.get(c.커밋) ?? '' }));
  const 판 = 판들읽기(저장소, [Y, O], 항목), Y판 = 판.get(Y), O판 = 판.get(O);
  const 고침 = 항목.filter(x => 판열쇠(x.앞) !== 판열쇠(Y판.get(x.열쇠)));
  // X에 이 사슬 고침이 한 줄도 없는가 — A⊕X가 모든 항목에서 깨끗하고, 고침이 있는 항목마다 그 합침에서 고침을 되돌리면 정확히 X.
  // 같은 고침이 X에 이미 있으면 합침은 깨끗해도 되돌린 결과가 X와 달라 드러난다.
  const 고침없는판 = X판 => {
    const M = new Map(), 충돌 = [];
    for (const x of 항목) { const r = 판합침(x.앞, Y판.get(x.열쇠), X판.get(x.열쇠), { 합치기 }); if (r.충돌) 충돌.push(x.열쇠); else M.set(x.열쇠, r.판); }
    const 없음 = !충돌.length && 고침.every(x => { const r = 판합침(M.get(x.열쇠), x.앞, Y판.get(x.열쇠), { 합치기 }); return !r.충돌 && 판열쇠(r.판) === 판열쇠(X판.get(x.열쇠)); });
    return { 없음, M, 충돌 };
  };
  let 모양, 기대, 나르개 = null, 충돌 = [];
  if (!고침.length) { 모양 = '앞 판 그대로'; 기대 = O판; }
  else {
    const o = 고침없는판(O판);
    충돌 = o.충돌;
    if (o.없음) { 모양 = '안 올림'; 기대 = o.M; }
    else {
      모양 = '올림'; 기대 = O판;
      // 나르개 후보: 이 사슬 고침이 있는 경로를 바꾼, 부모가 하나인 Y..O 커밋 — 그 커밋과 부모 판을 한 번에 읽는다.
      // 부모에 이 사슬 고침이 한 줄도 없고(처음 들인 커밋) 모든 항목에서 C = A⊕C^여야 한다(덧고침 · 나눠 올림이면 없다).
      const 고침닿음 = 범위.닿음(고침.map(x => x.경로));
      const 후보들 = 고른.filter(c => c.부모.length === 1 && 고침닿음.has(c.커밋));
      const 후보판 = 후보들.length ? 판들읽기(저장소, [...new Set(후보들.flatMap(c => [c.커밋, c.부모[0]]))], 항목) : new Map();
      for (const c of 후보들) {
        const C판 = 후보판.get(c.커밋), P판 = 후보판.get(c.부모[0]), p = 고침없는판(P판);
        if (p.없음 && 항목.every(x => 판열쇠(p.M.get(x.열쇠)) === 판열쇠(C판.get(x.열쇠)))) { 나르개 = c.커밋; break; }
      }
    }
  }
  const 다름 = 항목.filter(x => 판열쇠(x.지금) !== 판열쇠(기대.get(x.열쇠))).map(x => x.열쇠);
  const 짧게 = x => (x?.sha256 == null ? null : { sha256: x.sha256, 모드: x.모드 });
  const 경로 = 항목.filter(x => 판열쇠(x.앞) !== 판열쇠(x.지금) || 고침.includes(x)).map(x => ({ 열쇠: x.열쇠, 앞: 짧게(x.앞), 바탕: 짧게(Y판.get(x.열쇠)), origin: 짧게(O판.get(x.열쇠)), 기대: 짧게(기대.get(x.열쇠)), 지금: 짧게(x.지금) }));
  return { 모양, origin: O, 바탕: Y, 앞머리, 나르개, 다름, 충돌: 모양 === '안 올림' ? [] : 충돌, 고침: 고침.map(x => x.열쇠), 경로, 커밋들 };
}
/** 합침 대조가 통과인지 — 거절 까닭 목록(빈 목록이면 통과). */
export function 합침거절(r) {
  const 까닭 = [];
  const 말 = 열쇠들 => 열쇠들.map(k => k.replace(/^소스:/, '').replace(/^후보:/, '배포 후보 ')).join(', ');
  if (r.모양 === '올림' && !r.나르개) 까닭.push(`앞 검수 판의 고침이 origin에 있는데 그 고침만 담은 커밋을 찾지 못했다 — 덧고침이 같이 올라갔거나 나눠 올렸다${r.충돌.length ? `(origin과 합치면 충돌: ${말(r.충돌)})` : ''}`);
  if (r.다름.length) 까닭.push(`지금 판이 ${r.모양 === '안 올림' ? '앞 검수 판 ⊕ origin 판의 깨끗한 합침' : 'origin 판'}과 다르다(손 고침 · 충돌 풀이 · 앞 검수에 없던 고침): ${말(r.다름)}`);
  return 까닭;
}
/** 합침 고리 증명 — 다시증명과 같은 꼴에 합침 기록을 묶는다(검수자 · 대상 · 묶음 없음). */
export function 합침증명(body) {
  if (!body?.합침 || body.대상?.length || body.검수자들?.length || body.항목?.length) throw new Error('합침 고리 증명에는 합침 기록만 있고 검수자 · 대상 · 묶음이 없다');
  return 다시증명(body);
}
