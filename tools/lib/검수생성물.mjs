// 검수 도구의 「생성물」 칸(설계 주인 11-20 저녁 · 결정 표 「WORLD 선택 공개 2단계의 생성물 검수」).
// 배포 후보 가운데 묶음 · 지도처럼 빌더가 지은 파일은 본문이 수 MB라 검수자가 본문 대신 원천 쪽 증거를 본다. 도구가 명세에 적힌 원천 커밋을
// 임시 사본으로 꺼내 되돌림 대본 · 준비 대본 · 빌더 명령을 차례로 돌려 다시 짓고, sha256이 후보와 하나라도 다르면 준비를 멈춘다(검수가 서지
// 않으니 공개도 막힌다). 명세와 대본은 해시로 증명에 묶여, 검수 뒤 바뀌면 집계 · 공개가 미충족으로 막는다.
// 검수자가 보는 것: 재현 결과와 단계 기록, 명세 전문, 대본 본문, 원천 차이(항목의 라이브 바탕 커밋 → 되돌린 뒤의 후보 원천), 되돌림 목록의
// 커밋별 차이.
// 묶음 대조(설계 주인 11-21 답): 라이브가 바탕에서 다시 지어지지 않는 묶음은 바이트를 다 읽히는 대신, 라이브에서 무엇이 사라지는지를 기계로
// 드러낸다. 항목의 대조가 「모듈」이면 모듈 표지로 경로별로 맞춰 같은 코드(acorn 구문 나무가 묶인 이름만 다름 · 증명에 짝)는 증명으로, 바뀐 모듈은
// 라이브와 같은 코드를 짓는 커밋 → 후보 원천의 원천 차이로, 후보에만 있는 모듈은 묶음 안 글(원천은 출처 줄)로, 그 밖은 명세 까닭 파일의 까닭과
// 정리한 글 차이로 싣는다.
// 「문자열」이면(압축돼 표지가 없는 묶음) 문자열 상수와 속성 이름 집합을 견주고 라이브에만 있는 값마다 까닭을 요구한다.
// 원칙(설계 주인 11-21): 도구는 「같다」나 「덮었다」 쪽으로 틀리면 안 된다. 실제 자료에 있는 꼴은 제대로 다루고, 다루지 못하는 꼴은 지원하지 않고
// 감지해서 「다름」이나 「멈춤」으로 닫는다 — 계산된 문자열 열쇠 · __proto__ 줄여 쓰기 · 선언과 함께 내보냄 · 탈출이 든 태그 틀 글자 · 되돌림 목록의
// 병합 커밋 · 링크인 잇기 원본 · UTF-8이 아닌 원천 · git과 대소문자가 다른 명세 경로가 그렇다(acorn이 읽지 못하는 꼴은 acorn이 멈춘다).
// 위협 모델(설계 주인 11-21 물음 3): 명세 · 대본 · 빌더는 해시로 묶인 우리 대본이다. 도구는 실수를 막지 악의를 막지 않는다. 사본 격리(잇기 내용
// 지문 · 입력 사본 · 링크 마디 확인)는 대본이 실수로 사본 밖을 건드리는 일을 잡는다. 빌더가 일부러 도구를 속이는 경우는 범위 밖이다.
// 한계: ① 반사실 빌드는 원천을 덮은 뒤 준비 대본을 다시 돌린다. 준비 대본이 원천경로 안의 값을 원천경로 밖 파일에 옮겨 쓰면 그 파일도 후보 값이
// 된다 — 그 값이 원천 차이에 이미 있고 대본이 해시로 묶였다(GPT -c GD14). ② 이름이 바뀐 함수 · 클래스의 .name은 직접 읽기(X.name · 그 클래스 안
// this.constructor.name · new.target.name)만 「다름」으로 잡는다. 간접 읽기는 잡지 못하고 꺼진 판 화면 대조가 받친다. 함수 원문도 직접 읽기(X.toString)만
// 「다름」으로 잡는다(GPT -d GD12 — String(X) · 틀 글자 안 X 같은 간접 읽기는 한계).
// 쓰는 범위(결정 11-25 · Fable 설계 검토 11-24): 생성물 칸은 두 등급이다. 모든 항목이 바탕 재현 같음인 명세는 연다 — 후보가 검수받은 원천
// 커밋의 결정적 빌드이고, 라이브 대비 변화는 원천 차이와 반사실 빌드가 다 말한다. 바탕 재현이 안 되는 항목을 근사 대조(모듈 · 문자열 · 까닭 파일 ·
// 본문 차이)로 보는 길은 아래 근사 허용 목록의 명세(sha256)에만 쓴다 — WORLD 선택 공개 2단계 (2-2) spec-2-2r 하나로 얼렸고 다시 열지 않는다.
// 그 밖의 명세는 한 항목이라도 바탕 재현이 안 되면 준비가 멈추고(생성물근사확인) 검수 확인도 막는다. 바탕 재현이 깨지면 근사로 돌아가지 않고 빌드
// 환경을 맞춘다(바탕 커밋의 빌드환경.json과 견준다). 라이브에 없는 생성물(새 파일)은 바탕 재현이 없으니 이 칸에 넣지 않고 보통 후보 파일로 본문을
// 검수한다. 근사 길에서 남은 (ㄷ) 11건(GD2~GD6 · GE1~GE6)은 얼림으로 닫았다. 시험 실행 표지로 근사 허용을 건너뛰고 지은 증명에는
// 「허용 목록 건너뜀」 표시가 남고, 검수 확인은 표지가 꺼져 있든 켜져 있든 그 증명을 막는다 — 시험 환경에서 지은 검수가 공개를 통과하지 못한다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const 생성물판 = 1;
/** 근사 대조를 쓰는 명세의 sha256 허용 목록(위 「쓰는 범위」 · 결정 11-25 — spec-2-2r 하나로 얼렸다. 해시를 더하지 않는다). 시험은 합성 명세를
 *  쓰므로 node 시험 실행(NODE_TEST_CONTEXT)에서 SYNK_생성물_시험=1일 때만 건너뛴다(시험 표지). 시험 표지로 지은 증명에는 허용목록건너뜀 표시가 남고
 *  검수 확인이 늘 막는다. */
export const 생성물근사허용명세 = Object.freeze({
  '86edce6fbddb931a048d07d6ca414a75ca48ed43854d15d8192b63b14fcc3e12': 'WORLD 선택 공개 2단계 (2-2) 계정 · 생활 묶음 · 생활 css(spec-2-2r)',
});
export const 생성물시험표지 = () => Boolean(process.env.NODE_TEST_CONTEXT && process.env.SYNK_생성물_시험 === '1');
export const 생성물근사인가 = s => 생성물시험표지() || Object.hasOwn(생성물근사허용명세, String(s));
/** 바탕 재현이 안 된 항목 — 근사 길(본문 차이 · 모듈 · 문자열 · JSON 구조 대조)로 내려가는 항목이다. 재현 결과 · 증명 항목 어느 쪽이든 받는다. */
export const 근사항목들 = 항목들 => (Array.isArray(항목들) ? 항목들 : []).filter(it => it?.바탕재현 !== true);
/** 준비가 재현 뒤 부른다(결정 11-25): 근사 허용 밖 명세는 모든 항목이 바탕 재현 같음이어야 선다. 하나라도 내려가면 준비를 멈춘다. */
export function 생성물근사확인(정보, 재현) {
  const 아래 = 근사항목들(재현?.결과);
  if (!아래.length || 생성물근사인가(정보.sha256)) return;
  throw new Error(`생성물 명세(${path.basename(정보.경로)} · sha256 ${String(정보.sha256).slice(0, 12)}): 바탕 재현이 안 된 항목이 있다 — ${아래.map(r => `${r.경로}(${까닭꼴(r.바탕까닭) ?? '바탕 재현 없음'})`).join(' · ')}. `
    + '근사 대조는 spec-2-2r에만 쓴다(결정 11-25). 근사로 돌아가지 않고 빌드 환경을 바탕을 지은 때와 맞춘다(바탕 커밋의 빌드환경.json과 견준다). '
    + '라이브에 없는 새 생성물은 이 칸에서 빼고 보통 후보 파일로 검수한다. 준비를 멈춘다');
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const 슬래시 = p => String(p).replace(/\\/g, '/');
const 기본시간 = 20 * 60 * 1000;
const 메일 = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const 커밋꼴 = s => typeof s === 'string' && /^[0-9a-f]{7,64}$/i.test(s);
/** 저장소(또는 사본) 안의 상대 경로인가 — 절대 경로 · 드라이브 · `..` · 빈 마디 · 역슬래시는 받지 않는다.
 *  역슬래시(GPT GB1): Windows는 `\`도 마디로 읽지만 아래 안인가는 `/`로만 견준다 — `deps\old.bin`이 잇기 `deps` 안이 아닌 것처럼 보이지 않게. */
export function 상대경로인가(p) {
  if (typeof p !== 'string' || !p || p.trim() !== p || p.includes('\\') || path.isAbsolute(p) || /^[a-zA-Z]:/.test(p)) return false;
  return p.split('/').every(s => s && s !== '.' && s !== '..');
}
const 안인가 = (p, 위) => p === 위 || p.startsWith(`${위}/`);
/** 파일 시스템 기준 안인가(GPT GB1) — Windows는 대소문자를 가리지 않는다(`Deps/x`도 잇기 `deps` 안이다). */
const 파일안인가 = (p, 위) => (process.platform === 'win32' ? 안인가(p.toLowerCase(), 위.toLowerCase()) : 안인가(p, 위));
/** 원천경로 안(원천뺌 밖)인가 — 원천 차이가 싣는 자리. 그 밖의 꺼냄 파일은 빌드 입력이다(Opus F3). */
const 원천안 = (rel, 원천경로, 원천뺌) => 원천경로.some(p => 안인가(rel, p)) && !원천뺌.some(x => 안인가(rel, x));
const 경로열쇠 = p => { const r = 슬래시(path.resolve(p)); return process.platform === 'win32' ? r.toLowerCase() : r; };
const 절대인가 = v => path.win32.isAbsolute(v) || path.posix.isAbsolute(v) || /^[a-zA-Z]:([\\/]|$)/.test(v);
/** 빌더 목록의 꼴 — [사본 안 대본 경로, 인자…] 또는 { 명령, 실패해도, 까닭 }.
 *  인자(Opus F6): 「..」 마디는 받지 않고, 절대 경로는 명세의 입력 칸에 적은 파일만 따로 인자로 받는다(--a=절대 경로 꼴은 입력 사본으로 바꿔 끼울 수 없어
 *  받지 않는다 · GPT -d GD1) — 명세를 잘못 적어 사본 밖(공용 작업본 등)을
 *  읽거나 덮지 않게. 입력 파일은 해시로 증명에 묶이고 짓는 동안 바뀌면 멈춘다. */
function 빌더읽기(목록, 이름, 틀림, 입력열쇠 = new Set()) {
  if (!Array.isArray(목록) || !목록.length) 틀림(`${이름}가 없다`);
  return 목록.map(x => {
    const b = Array.isArray(x) ? { 명령: x, 실패해도: false, 까닭: null } : { 명령: x?.명령, 실패해도: x?.실패해도 === true, 까닭: x?.까닭 ?? null, 칸: x && typeof x === 'object' ? Object.keys(x) : [] };
    if (!Array.isArray(b.명령) || !b.명령.length || !상대경로인가(b.명령[0]) || !b.명령.every(a => typeof a === 'string')) 틀림(`${이름}는 [사본 안 대본 경로, 인자…] 또는 { 명령, 실패해도, 까닭 } 목록이다`);
    if (b.칸 && !b.칸.every(k => ['명령', '실패해도', '까닭'].includes(k))) 틀림(`${이름} 칸은 명령 · 실패해도 · 까닭이다`);
    if (b.실패해도 && !(typeof b.까닭 === 'string' && b.까닭.trim())) 틀림(`실패해도 되는 빌더는 까닭을 적는다: ${b.명령.join(' ')}`);
    for (const a of b.명령.slice(1)) for (const v of [a, ...(a.includes('=') ? [a.slice(a.indexOf('=') + 1)] : [])]) {
      if (슬래시(v).split('/').includes('..')) 틀림(`${이름} 인자에 ..를 쓰지 않는다(사본 밖을 가리킬 수 있다): ${a}`);
      // --a=<절대 경로> 꼴은 받지 않는다 — 빌더에 넘길 때 입력 사본으로 바꿔 끼우는 것은 인자 전체가 경로일 때뿐이라, 이 꼴은 원본을 넘기게 된다(GPT -d GD1).
      if (v !== a && 절대인가(v)) 틀림(`${이름} 인자의 절대 경로는 따로 인자로 적는다(--a=경로 꼴은 입력 사본으로 바꿔 끼울 수 없어 받지 않는다): ${a}`);
      if (절대인가(v) && !입력열쇠.has(경로열쇠(v))) 틀림(`${이름} 인자의 절대 경로는 명세의 입력 칸에 적은 파일만 받는다(사본 밖에 쓰거나 읽지 않게): ${a}`);
    }
    delete b.칸;
    return b;
  });
}

/** 명세를 읽고 꼴을 본다. 대본 경로는 명세 파일의 폴더 기준이다. 돌려주는 것: { 경로, sha256, 원문, 명세(채운 꼴), 대본[] }. */
export function 생성물명세읽기(파일) {
  const 경로 = path.resolve(파일);
  const 원문 = fs.readFileSync(경로);
  // 쓰는 범위(결정 11-25): 어느 명세든 읽는다. 근사 허용 밖 명세는 재현 뒤 모든 항목이 바탕 재현 같음일 때만 선다(생성물근사확인 · 검수 확인).
  let 명세;
  try { 명세 = JSON.parse(원문.toString('utf8')); } catch (e) { throw new Error(`생성물 명세를 읽지 못했다: ${경로} — ${e.message}`); }
  const 틀림 = m => { throw new Error(`생성물 명세(${path.basename(경로)}): ${m}`); };
  if (!명세 || typeof 명세 !== 'object' || Array.isArray(명세)) 틀림('JSON 객체가 아니다');
  const 아는칸 = new Set(['판', '설명', '원천저장소', '원천', '꺼냄', '잇기', '되돌림', '준비', '빌더', '원천뺌', '항목', '입력']);
  for (const k of Object.keys(명세)) if (!아는칸.has(k)) 틀림(`모르는 칸 ${k}`);
  if (명세.판 !== 생성물판) 틀림(`판은 ${생성물판}이다`);
  // 원천저장소(선택): 원천 · 바탕 커밋이 검수 저장소가 아닌 다른 git 저장소에 있을 때 그 절대 경로
  if (명세.원천저장소 != null && !(typeof 명세.원천저장소 === 'string' && path.isAbsolute(명세.원천저장소))) 틀림('원천저장소는 절대 경로다');
  if (!커밋꼴(명세.원천)) 틀림('원천은 커밋 해시다');
  if (!Array.isArray(명세.꺼냄) || !명세.꺼냄.length || !명세.꺼냄.every(상대경로인가)) 틀림('꺼냄은 저장소 안 상대 경로 목록이다');
  if (명세.잇기 != null && !Array.isArray(명세.잇기)) 틀림('잇기는 목록이다');
  const 잇기 = (명세.잇기 ?? []).map(x => (typeof x === 'string' ? { 경로: x, 원본: null } : x));
  if (!잇기.every(x => x && typeof x === 'object' && 상대경로인가(x.경로) && Object.keys(x).every(k => ['경로', '원본'].includes(k))
    && (x.원본 == null || typeof x.원본 === 'string' && path.isAbsolute(x.원본)))) 틀림('잇기는 상대 경로 또는 { 경로, 원본(절대 경로) } 목록이다');
  for (const [n, a] of 잇기.entries()) for (const b of 잇기.slice(n + 1)) if (파일안인가(a.경로, b.경로) || 파일안인가(b.경로, a.경로)) 틀림(`잇기가 서로 겹친다: ${a.경로} · ${b.경로} — 사본을 같은 상대 자리에 뜨므로 한쪽이 다른 쪽 안에 들 수 없다`);
  const 되돌림 = 명세.되돌림 ?? null;
  if (되돌림 !== null && (typeof 되돌림 !== 'object' || Array.isArray(되돌림) || typeof 되돌림.대본 !== 'string' || !되돌림.대본
    || !Object.keys(되돌림).every(k => ['대본', '목록'].includes(k)) || !Array.isArray(되돌림.목록 ?? []) || !(되돌림.목록 ?? []).every(커밋꼴))) 틀림('되돌림은 { 대본, 목록: [커밋] }이다');
  const 준비 = 명세.준비 ?? [];
  if (!Array.isArray(준비) || !준비.every(x => typeof x === 'string' && x)) 틀림('준비는 대본 경로 목록이다');
  // 대본은 .cjs · .mjs만 받는다 — .js는 가까운 package.json의 type에 따라 실행 방식이 바뀌는데 그 파일은 증명 밖이다(GPT -c GD17).
  for (const p of [...(되돌림 ? [되돌림.대본] : []), ...준비]) if (!/\.(?:cjs|mjs)$/i.test(p)) 틀림(`대본은 .cjs나 .mjs다(.js는 package.json의 type에 따라 실행 방식이 바뀐다): ${p}`);
  // 입력(선택 · Opus F3 · F6): 빌더 인자로 넘기는 사본 밖 파일의 절대 경로. 대본처럼 sha256을 증명에 묶고 글을 검수 자료에 싣는다.
  if (명세.입력 != null && !(Array.isArray(명세.입력) && 명세.입력.every(x => typeof x === 'string' && path.isAbsolute(x)))) 틀림('입력은 사본 밖 파일의 절대 경로 목록이다');
  const 입력 = [...new Map((명세.입력 ?? []).map(x => [경로열쇠(x), path.resolve(x)])).values()];
  const 빌더 = 빌더읽기(명세.빌더, '빌더', 틀림, new Set(입력.map(경로열쇠)));
  const 원천뺌 = 명세.원천뺌 ?? [];
  if (!Array.isArray(원천뺌) || !원천뺌.every(상대경로인가)) 틀림('원천뺌은 저장소 안 상대 경로 목록이다');
  if (!Array.isArray(명세.항목) || !명세.항목.length) 틀림('항목이 없다');
  const 본경로 = new Set();
  const 항목 = 명세.항목.map(it => {
    if (!it || typeof it !== 'object' || Array.isArray(it)) 틀림('항목이 객체가 아니다');
    for (const k of Object.keys(it)) if (!['경로', '만든곳', '바탕', '원천경로', '대조', '짝커밋', '짝빌더', '짝만든곳', '까닭', '머리곳', '머리바꿈'].includes(k)) 틀림(`항목의 모르는 칸 ${k}`);
    // 머리곳(설계 검토 F3 · GPT 다시 검수 GC3): 문자열 대조 항목의 머리 입력 목록을 읽을 중간 묶음 — 빌드가 사본에서 짓는 파일(짓기 전에 지운다).
    // 마지막 빌더가 묶음 머리의 입력 이름을 바꿔 쓰면(공개 빌더의 recording-tracks.mjs) 그 전에 지은 중간 묶음의 머리가 실제 입력이다. 도구가 검증할 수 없는 이름 짝(입력바꿈)은 받지 않는다.
    // 대소문자만 다른 두 경로는 Windows에서 같은 파일이다 — 최종 묶음을 머리곳으로 읽게 된다(GPT -d GD6).
    if (it.머리곳 != null && (it.대조 !== '문자열' || !상대경로인가(it.머리곳) || it.머리곳.toLowerCase() === it.만든곳.toLowerCase())) 틀림(`머리곳은 문자열 대조 항목의 사본 안 상대 경로(만든곳과 다른 중간 묶음)다: ${it.경로}`);
    // 머리바꿈(설계 주인 11-21 물음 1 (가) · GPT -c C1 · GE10): 마지막 빌더가 머리곳 글에 하는 글 바꿈 쌍 — 차례대로 replaceAll한다. 도구는
    // 「후보 바이트 = 머리곳에 바꿈을 적용한 바이트」를 본다. 맞지 않으면 그 항목은 문자열 대조 대신 본문 차이로 간다.
    if (it.머리바꿈 != null && (!it.머리곳 || !Array.isArray(it.머리바꿈) || !it.머리바꿈.every(x => Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && x[0] && typeof x[1] === 'string'))) 틀림(`머리바꿈은 머리곳이 있는 항목의 [바꿀 글, 새 글] 쌍 목록이다: ${it.경로}`);
    if (!상대경로인가(it.경로) || 본경로.has(it.경로)) 틀림(`항목 경로가 상대 경로가 아니거나 겹친다: ${it.경로}`);
    본경로.add(it.경로);
    if (!상대경로인가(it.만든곳)) 틀림(`만든곳은 사본 안 상대 경로다: ${it.경로}`);
    if (!커밋꼴(it.바탕)) 틀림(`바탕은 커밋 해시다: ${it.경로}`);
    if (!Array.isArray(it.원천경로) || !it.원천경로.length || !it.원천경로.every(상대경로인가)) 틀림(`원천경로는 저장소 안 상대 경로 목록이다: ${it.경로}`);
    for (const p of it.원천경로) for (const l of 잇기) if (파일안인가(p, l.경로) || 파일안인가(l.경로, p)) 틀림(`원천경로와 잇기가 겹친다: ${p} · ${l.경로}`);
    // 원천경로는 꺼냄 안이어야 후보 원천(되돌린 사본)에 있다 — 꺼냄 밖이면 원천 차이가 그 파일을 지운 것으로 보인다(Opus F3).
    for (const p of it.원천경로) if (!명세.꺼냄.some(x => 안인가(p, x))) 틀림(`원천경로가 꺼냄 밖이다: ${p}`);
    // 묶음 대조(설계 주인 11-21): 바탕 재현이 안 될 때 본문 차이 대신 쓰는 길. 짝커밋은 라이브 모듈과 같은 코드를 지을지 볼 커밋(모듈 대조만),
    // 까닭은 명세 폴더 기준 JSON — 모듈: { 모듈: { 경로: 까닭 } } · 문자열: { 글: { 값: 까닭 }, 이름: { 값: 까닭 } }.
    if (it.대조 != null && !['모듈', '문자열'].includes(it.대조)) 틀림(`대조는 모듈 또는 문자열이다: ${it.경로}`);
    if (it.짝커밋 != null && (it.대조 !== '모듈' || !Array.isArray(it.짝커밋) || !it.짝커밋.every(커밋꼴))) 틀림(`짝커밋은 모듈 대조 항목의 커밋 해시 목록이다: ${it.경로}`);
    if (it.까닭 != null && (it.대조 == null || typeof it.까닭 !== 'string' || !it.까닭)) 틀림(`까닭은 대조 항목의 까닭 파일 경로다: ${it.경로}`);
    // 짝빌더(선택): 짝커밋에서는 준비 대본 없이 이 빌더만 돌려 짝만든곳(없으면 만든곳)을 읽는다 — 옛 커밋에서 공개 빌드 전체가 서지 않을 때
    if ((it.짝빌더 != null || it.짝만든곳 != null) && it.대조 !== '모듈') 틀림(`짝빌더 · 짝만든곳은 모듈 대조 항목에만 쓴다: ${it.경로}`);
    if (it.짝만든곳 != null && !상대경로인가(it.짝만든곳)) 틀림(`짝만든곳은 사본 안 상대 경로다: ${it.경로}`);
    // 만든곳은 짓기 전에 사본에서 지운다 — 잇기(원본 폴더로 이은 곳) 안이면 원본을 지우게 되므로 받지 않는다(GPT GB5).
    for (const p of [it.만든곳, it.짝만든곳, it.머리곳].filter(x => typeof x === 'string')) for (const l of 잇기) if (파일안인가(p, l.경로)) 틀림(`만든곳이 잇기 안에 있다: ${p} · ${l.경로}`);
    const 짝빌더 = it.짝빌더 == null ? null : 빌더읽기(it.짝빌더, `짝빌더(${it.경로})`, 틀림, new Set(입력.map(경로열쇠)));
    return { 경로: it.경로, 만든곳: it.만든곳, 바탕: it.바탕, 원천경로: [...it.원천경로],
      ...(it.대조 ? { 대조: it.대조, 짝커밋: [...(it.짝커밋 ?? [])], 짝빌더, 짝만든곳: it.짝만든곳 ?? it.만든곳, 까닭: it.까닭 ?? null, ...(it.머리곳 ? { 머리곳: it.머리곳, 머리바꿈: (it.머리바꿈 ?? []).map(([a, b]) => [a, b]) } : {}) } : {}) };
  });
  const 폴더 = path.dirname(경로);
  const 대본 = [...(되돌림 ? [{ 역할: '되돌림', 경로: path.resolve(폴더, 되돌림.대본) }] : []), ...준비.map(p => ({ 역할: '준비', 경로: path.resolve(폴더, p) })),
    ...항목.filter(it => it.까닭).map(it => ({ 역할: '까닭', 경로: path.resolve(폴더, it.까닭), 항목: it.경로 })), ...입력.map(p => ({ 역할: '입력', 경로: p }))]
    .map(d => {
      let b;
      try { b = fs.readFileSync(d.경로); } catch (e) { 틀림(`${d.역할 === '입력' ? '입력 파일' : `${d.역할} 대본`}을 읽지 못했다: ${d.경로} — ${e.code || e.message}`); }
      // 바이트(숨은 칸): 대본 고정(GPT GB4)이 해시한 바로 그 바이트를 임시 폴더에 써서 돌린다.
      return Object.defineProperty({ ...d, sha256: sha(b), 글: b.toString('utf8') }, '바이트', { value: b });
    });
  // 까닭 파일의 꼴 — 모듈: { 모듈: { 경로: 까닭 글 } }. 문자열(설계 주인 11-21): { 무리: { 이름: { 꼴, 까닭, 파일: [경로], 커밋? } }, 글: { 값: 무리 이름 },
  // 이름: { 값: 무리 이름 }, 숫자: { 값: 무리 이름 }, 정규식: { 값: 무리 이름 } } — 값마다 무리를 대고, 도구가 그 값이 무리의 파일에 있는지(소속)를 확인한다.
  // 숫자 칸의 값은 숫자를 값으로 쓴 글(1e3 · 1000 · 1_000 → "1000")이고, 정규식 칸의 값은 /…/깃발 글 그대로다(설계 검토 F2).
  const 까닭 = new Map(), 무리꼴 = ['옮겨감', '안 쓰임', '커밋이 뺌', '손 판'];
  const 객체인가 = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  for (const d of 대본.filter(x => x.역할 === '까닭')) {
    const it = 항목.find(x => x.경로 === d.항목);
    let j;
    try { j = JSON.parse(d.글); } catch (e) { 틀림(`까닭 파일을 읽지 못했다: ${d.경로} — ${e.message}`); }
    const 칸 = it.대조 === '모듈' ? ['모듈'] : ['무리', ...값칸];
    if (!객체인가(j) || !Object.keys(j).every(k => 칸.includes(k))) 틀림(`까닭 파일의 칸은 ${칸.join(' · ')}이다: ${d.경로}`);
    if (it.대조 === '모듈') {
      const m = j.모듈 ?? {};
      if (!객체인가(m) || !Object.values(m).every(v => typeof v === 'string' && v.trim())) 틀림(`까닭 파일의 모듈은 { 경로: 까닭 글 }이다: ${d.경로}`);
    } else {
      const 무리 = j.무리;
      if (!객체인가(무리) || !Object.keys(무리).length) 틀림(`문자열 까닭 파일은 무리가 있어야 한다: ${d.경로}`);
      for (const [이름, g] of Object.entries(무리)) {
        if (!객체인가(g) || !Object.keys(g).every(k => ['꼴', '까닭', '파일', '커밋'].includes(k))) 틀림(`무리 ${이름}의 칸은 꼴 · 까닭 · 파일 · 커밋이다: ${d.경로}`);
        if (!무리꼴.includes(g.꼴)) 틀림(`무리 ${이름}의 꼴은 ${무리꼴.join(' · ')}이다: ${d.경로}`);
        if (!(typeof g.까닭 === 'string' && g.까닭.trim())) 틀림(`무리 ${이름}에 까닭 글이 없다: ${d.경로}`);
        if (!Array.isArray(g.파일) || !g.파일.length || !g.파일.every(상대경로인가)) 틀림(`무리 ${이름}의 파일은 저장소 안 상대 경로 목록이다: ${d.경로}`);
        if ((g.꼴 === '커밋이 뺌') !== (g.커밋 != null) || (g.커밋 != null && !커밋꼴(g.커밋))) 틀림(`무리 ${이름}: 커밋이 뺌 무리만 커밋(해시)을 적는다: ${d.경로}`);
      }
      for (const k of 값칸) {
        const m = j[k] ?? {};
        if (!객체인가(m) || !Object.values(m).every(v => typeof v === 'string' && Object.hasOwn(무리, v))) 틀림(`까닭 파일의 ${k}는 { 값: 무리 이름 }이다(없는 무리를 댔다): ${d.경로}`);
      }
    }
    까닭.set(it.경로, j);
  }
  return { 경로, sha256: sha(원문), 원문: 원문.toString('utf8'), 명세: { ...명세, 잇기, 되돌림, 준비, 빌더, 원천뺌, 항목, 입력 }, 대본, 까닭,
    ...(생성물시험표지() ? { 허용건너뜀: true } : {}) };   // 시험 표지가 켜진 채 읽은 명세 — 증명에 표시가 남아 검수 확인이 막는다(설계 주인 11-22)
}

/** 증명에 묶는 해시 — 명세 파일과 대본 파일. 집계 · 공개 때 다시 읽어 견준다(생성물해시다시). */
export function 생성물해시(정보) {
  return { 명세: { 경로: 슬래시(정보.경로), sha256: 정보.sha256 }, 대본: 정보.대본.map(d => ({ 역할: d.역할, 경로: 슬래시(d.경로), sha256: d.sha256 })) };
}
export function 생성물해시다시(명세파일) {
  try { return 생성물해시(생성물명세읽기(명세파일)); } catch (e) { return { 오류: e.message }; }
}
/** 증명(입력증명)의 생성물 칸 — 해시와 재현 결과. 바탕재현이 참이 아닌 항목은 검수 묶음에 본문 차이(라이브 → 후보)가 실린다. */
/** 바탕 까닭의 꼴 — 증명에는 꼴만 싣는다(까닭 글의 실패 문구에는 임시 폴더 경로가 들어 같은 판 다시 뜨기마다 달라진다 · GPT -c GD19). */
export const 까닭꼴 = s => (s == null ? null : s === '같음' || s === '라이브에 없음' || s === '만든 파일 없음' ? s
  : s.startsWith('바탕 빌드 실패') ? '바탕 빌드 실패' : s.startsWith('라이브와 다름') ? (s.includes('0 아닌 종료') ? '라이브와 다름(0 아닌 종료 단계 있음)' : '라이브와 다름')
    : s.includes('지어지지 않는다') ? '반사실 빌드 실패' : s.includes('출력을 바꾼다') ? (s.startsWith('원천경로 밖') ? '반사실 다름(원천경로 밖 입력)' : '반사실 다름(입력 지도 밖 입력)') : '그 밖');
export function 생성물증명({ 정보, 재현 }) {
  // JSON 구조 차이(설계 주인 11-21): 묶음에 싣는 차이마다 앞 · 뒤 sha256 · 연산 sha256 · 완전. 처음 고리 판정이 완전과 묶음에 실렸는지를 본다.
  const JSON차이 = (재현.JSON차이 || []).map(x => ({ 앞: x.앞, 경로: x.경로, ...(x.모듈 ? { 모듈: true, 원천sha256: x.원천sha256 } : {}), 앞sha256: x.앞sha256, 뒤sha256: x.뒤sha256,
    꼴: x.꼴, 연산수: x.연산수, 연산sha256: x.연산sha256, 완전: x.완전 }));
  return { 판: 생성물판, ...생성물해시(정보), 원천: 재현.원천,
    항목: 재현.결과.map(r => ({ 경로: r.경로, 만든곳: r.만든곳, 바탕: r.바탕, 후보sha256: r.후보sha256, 재현sha256: r.재현sha256,
      라이브sha256: r.라이브sha256, 바탕재현sha256: r.바탕재현sha256, 바탕재현: r.바탕재현, 바탕까닭꼴: 까닭꼴(r.바탕까닭),
      ...(r.입력반사실 ? { 입력반사실: r.입력반사실 } : {}), ...(r.대조 ? { 대조: r.대조 } : {}), ...(r.대조못함 ? { 대조못함: r.대조못함 } : {}) })),
    ...(JSON차이.length ? { JSON차이 } : {}), ...(정보.허용건너뜀 ? { 허용목록건너뜀: true } : {}) };
}

// core.quotePath를 끈다(GPT -e F1) — 켜진 저장소에서는 git show · diff 머리줄의 한글 · 특수 글자 경로가 따옴표 · 8진 탈출로 나와 실제 경로와 맞지 않는다.
function git(저장소, args, { env = null, input = undefined, 버퍼 = false } = {}) {
  const r = spawnSync('git', ['-C', 저장소, '-c', 'core.autocrlf=false', '-c', 'core.quotePath=false', ...args], { env: env ? { ...process.env, ...env } : process.env, input, maxBuffer: 1 << 30, windowsHide: true });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`git ${args.slice(0, 2).join(' ')} 실패(${r.status}): ${String(r.stderr || '').trim().slice(0, 400)}`);
  return 버퍼 ? r.stdout : r.stdout.toString('utf8');
}
// git --name-status -z 출력(상태 NUL 경로 NUL …)을 [상태, 경로] 짝으로 — 줄 출력은 core.quotePath가 켜진 저장소에서 한글 · 특수 글자 경로를
// 따옴표와 8진 탈출로 감싸 실제 경로와 맞지 않는다(GPT -e GD7). 이 모듈의 다른 경로 읽기도 -z를 쓴다.
// 상태 칸이 git 상태 글자가 아니면 멈춘다(GPT -e F1) — 이름 바꿈(R · C)처럼 경로가 둘인 줄이 섞이면 짝이 한 칸씩 밀려 경로를 상태로 읽는다.
export const 이름상태 = 글 => {
  const xs = 글.split('\0'), 짝 = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const s = xs[i].trim();
    if (!/^[ADMTUXB]$/.test(s)) throw new Error(`git 이름 상태가 아니다: ${JSON.stringify(s.slice(0, 40))} — 이름 바꿈 없이(--no-renames) 상태 · 경로 짝으로 읽어야 한다(도구가 다루지 않는 꼴)`);
    짝.push([s, xs[i + 1]]);
  }
  return 짝;
};
/** git 차이 머리줄 단언(GPT -e F1): 머리말(「diff --git」부터 첫 「@@」 앞)의 경로가 따옴표 꼴이면 멈춘다 — core.quotePath를 끄고 읽어도 그런
 *  머리가 나오면 증거의 경로가 실제와 맞지 않는다. 덩이 안의 「--- "…」 같은 내용 줄은 보지 않는다. */
export function 차이머리확인(글, 곳) {
  let 머리 = false;
  for (const l of String(글).split('\n')) {
    if (l.startsWith('diff --git ')) {
      머리 = true;
      if (!l.startsWith('diff --git a/')) throw new Error(`${곳}: git 차이 머리줄이 따옴표 꼴이다(${l.slice(0, 80)}) — core.quotePath를 끈 채 읽어야 한다(도구가 다루지 않는 꼴)`);
      continue;
    }
    if (머리 && l.startsWith('@@')) { 머리 = false; continue; }
    if (머리 && /^(?:--- |\+\+\+ |rename from |rename to |copy from |copy to )"/.test(l)) throw new Error(`${곳}: git 차이 머리줄이 따옴표 꼴이다(${l.slice(0, 80)}) — core.quotePath를 끈 채 읽어야 한다(도구가 다루지 않는 꼴)`);
  }
  return 글;
}
/** 명세 경로의 철자 확인 — 커밋 트리에 대소문자만 다른 경로가 있고 같은 철자는 없으면 멈춘다(Windows 파일 시스템은 대소문자를 가리지 않아
 *  후보 원천은 읽히고 git 판은 빠진다 · GPT -c GD12). 아예 없는 경로는 여기서 보지 않는다(다른 확인이 맡는다). */
function 철자확인(저장소, 커밋, 경로들) {
  const 정확 = new Set(), 작게 = new Set();
  for (const p of git(저장소, ['ls-tree', '-r', '-t', '--name-only', '-z', 커밋]).split('\0').filter(Boolean)) { 정확.add(p); 작게.add(p.toLowerCase()); }
  const 틀림 = [...new Set(경로들)].filter(p => !정확.has(p) && 작게.has(p.toLowerCase()));
  if (틀림.length) throw new Error(`명세 경로의 대소문자가 커밋 ${커밋.slice(0, 10)}의 git 경로와 다르다: ${틀림.slice(0, 5).join(' · ')} — git과 같은 철자로 적는다(도구가 다루지 않는 꼴이라 멈춘다)`);
}
function 커밋확인(저장소, 값) {
  try { return git(저장소, ['rev-parse', '--verify', '--quiet', `${값}^{commit}`]).trim(); } catch { throw new Error(`저장소에 없는 커밋이다: ${값}`); }
}
/** 커밋의 경로들을 임시 색인으로 폴더에 꺼낸다(git이 체크아웃하는 바이트 그대로 · 작업본 색인과 HEAD는 건드리지 않는다). 꺼낸 파일 수.
 *  블롭(Map)을 주면 꺼낸 파일마다 git 블롭 번호를 채운다(빌드 입력 지도에 쓴다 — 파일을 다 읽지 않고 두 사본을 견준다). */
function 꺼내기(저장소, 커밋, 경로들, 폴더, 임시, { 빈것허용 = false, 블롭 = null } = {}) {
  fs.mkdirSync(폴더, { recursive: true });
  const 색인 = path.join(임시, `index-${crypto.randomBytes(6).toString('hex')}`), env = { GIT_INDEX_FILE: 색인 };
  try {
    git(저장소, ['read-tree', 커밋], { env });
    const 목록 = git(저장소, ['ls-files', '-z', '--', ...경로들], { env, 버퍼: true });
    const 수 = 목록.toString('utf8').split('\0').filter(Boolean).length;
    if (!수) { if (빈것허용) return 0; throw new Error(`${커밋.slice(0, 10)}에 꺼낼 파일이 없다: ${경로들.join(', ')}`); }
    git(저장소, ['checkout-index', '-z', '--stdin', `--prefix=${슬래시(폴더)}/`], { env, input: 목록 });
    if (블롭) for (const 줄 of git(저장소, ['ls-files', '-s', '-z', '--', ...경로들], { env, 버퍼: true }).toString('utf8').split('\0')) {
      const m = /^\d+ ([0-9a-f]+) \d+\t(.+)$/s.exec(줄);
      if (m) 블롭.set(m[2], m[1]);
    }
    return 수;
  } finally { fs.rmSync(색인, { force: true }); }
}
const 블롭번호 = b => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
/** 꺼냄 아래 보통 파일(링크는 건너뜀) — 사본 상대 경로 → 「크기:고친 때」. */
function 목록재기(사본, 꺼냄) {
  const m = new Map();
  const 걷기 = rel => {
    let st;
    try { st = fs.lstatSync(path.join(사본, rel)); } catch { return; }
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) { for (const n of fs.readdirSync(path.join(사본, rel))) 걷기(`${rel}/${n}`); return; }
    if (st.isFile()) m.set(rel, `${st.size}:${st.mtimeMs}`);
  };
  for (const p of 꺼냄) 걷기(슬래시(p));
  return m;
}
/** 빌드 입력 지도(Opus F3 · F4) — 빌더가 돌기 직전(되돌림 · 준비 뒤) 꺼냄 아래 파일마다 git 블롭 번호. 두 사본의 지도가 다른 경로가 두 빌드의
 *  입력 차이다. 늘 실제 바이트로 낸다(GPT GB6 — 크기 · 고친 때가 같다고 꺼낸 때의 번호를 쓰면, 고친 때를 지킨 채 바꾼 파일을 놓친다). */
function 입력지도(사본, 꺼냄) {
  const m = new Map();
  for (const rel of 목록재기(사본, 꺼냄).keys()) m.set(rel, 블롭번호(fs.readFileSync(path.join(사본, rel))));
  return m;
}
/** 두 입력 지도가 다른 경로(정렬) — 거름(rel)이 참인 것만. */
const 지도차이 = (a, b, 거름) => [...new Set([...a.keys(), ...b.keys()])].filter(rel => a.get(rel) !== b.get(rel) && 거름(rel)).sort();
/** 명세의 입력 파일이 명세를 읽을 때와 같은지 — 짓기 앞뒤로 본다(Opus F6). */
function 입력확인(정보, 때) {
  for (const d of 정보.대본.filter(x => x.역할 === '입력')) {
    let s = null;
    try { s = sha(fs.readFileSync(d.경로)); } catch { /* 없음 */ }
    if (s !== d.sha256) throw new Error(`${때} 입력 파일이 명세를 읽을 때와 다르다: ${d.경로} — 짓는 동안 바뀌었거나 사라졌다`);
  }
}
const 링크인가 = p => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };
const 같은경로 = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
/** 경로가 링크를 거치는가 — 실제 경로(realpath)가 적은 경로와 다르면 어느 마디가 링크다. 없는 경로는 거치지 않는 것으로 본다. */
const 링크거침 = p => { let r; try { r = fs.realpathSync.native(p); } catch { return false; } return !같은경로(r, path.resolve(p)); };
/** 뿌리 안 상대 경로의 마디 가운데 링크(junction · 심볼릭)인 첫 마디(없으면 null) — 쓰기 · 지우기가 링크를 따라 뿌리 밖으로 가지 않게(GPT GB1 · GB2). */
function 링크마디(뿌리, rel) {
  let 곳 = 뿌리;
  for (const s of 슬래시(rel).split('/').filter(Boolean)) {
    곳 = path.join(곳, s);
    if (링크인가(곳)) return 슬래시(path.relative(뿌리, 곳));
    if (!fs.existsSync(곳)) return null;
  }
  return null;
}
// 잇기 사본(GPT 다시 검수 GA1 · GB3): 생성물재현마다 이은 폴더의 원본을 임시 폴더에 한 번 떠 두고, 빌드는 원본 대신 그 사본에 잇는다.
// 대본 · 빌더가 이은 폴더에 써도 공용 원본(다른 세션 · 작업본이 쓰는 node_modules 등)은 바뀌지 않는다. 사본은 이 준비의 빌드끼리 나눠 쓰므로
// 빌드가 사본에 쓴 것은 짓기 뒤(단계가 실패해도) 지문으로 잡아 준비 전체를 멈춘다 — 바탕 · 짝 · 반사실 빌드의 보통 실패로 삼키지 않는다.
// 원본 안의 링크는 사본에서도 원본 밖을 가리켜 쓰기를 막지 못하므로 받지 않는다.
const 잇기원본 = (저장소, l) => (l.원본 ? path.resolve(l.원본) : path.join(저장소, l.경로));
// 사본은 저장소와 같은 상대 자리(임시/잇기/<경로>)에 뜬다 — Node는 모듈을 실제 자리의 조상 폴더마다 node_modules로 찾으므로, 사본 이름이
// node_modules가 아니거나 끌어올린 의존성(뿌리 node_modules)이 곁에 없으면 꾸러미 안의 require(예: esbuild의 @esbuild/win32-x64)가 깨진다.
const 잇기사본자리 = (임시, l) => path.join(임시, '잇기', l.경로);
/** 폴더 안의 모든 항목(파일 · 폴더 · 링크, 링크는 따라가지 않는다)의 절대 경로. 폴더가 없으면 빈 목록. */
function 폴더안(뿌리) {
  const 모음 = [];
  const 걷기 = abs => { for (const e of fs.readdirSync(abs, { withFileTypes: true })) { const p = path.join(abs, e.name); 모음.push(p); if (e.isDirectory() && !e.isSymbolicLink()) 걷기(p); } };
  if (fs.existsSync(뿌리)) 걷기(뿌리);
  return 모음;
}
function 링크찾기(뿌리) {
  const 찾음 = [];
  const 걷기 = abs => { for (const e of fs.readdirSync(abs, { withFileTypes: true })) { const p = path.join(abs, e.name); if (e.isSymbolicLink()) 찾음.push(슬래시(path.relative(뿌리, p))); else if (e.isDirectory()) 걷기(p); } };
  걷기(뿌리);
  return 찾음;
}
function 잇기뜨기(임시, 저장소, 잇기들, 알리기) {
  for (const l of 잇기들) {
    const 원본 = 잇기원본(저장소, l);
    if (!fs.existsSync(원본) || !fs.statSync(원본).isDirectory()) throw new Error(`잇기 원본이 없거나 폴더가 아니다: ${원본}`);
    // 원본 자체가 링크이거나 위 마디가 링크면 사본이 링크를 떠 와 공유 폴더에 쓰게 된다 — 지원하지 않고 멈춘다(설계 주인 11-21 · GPT -c GD1).
    if (링크인가(원본) || 링크거침(원본)) throw new Error(`잇기 원본이 링크이거나 링크를 거친다: ${원본} — 실제 폴더 경로를 적는다(도구가 다루지 않는 꼴이라 멈춘다)`);
    const 링크들 = 링크찾기(원본);
    if (링크들.length) throw new Error(`잇기 원본 안에 링크가 있다: ${원본} — ${링크들.slice(0, 3).join(', ')}${링크들.length > 3 ? ' …' : ''}. 링크는 사본에서도 원본 밖을 가리켜 쓰기를 막지 못하므로 받지 않는다`);
    const 앞 = 폴더지문(원본), 곳 = 잇기사본자리(임시, l);
    fs.mkdirSync(path.dirname(곳), { recursive: true });
    fs.cpSync(원본, 곳, { recursive: true, preserveTimestamps: true, errorOnExist: true, force: false });
    if (폴더지문(원본) !== 앞) throw new Error(`잇기 원본이 사본을 뜨는 동안 바뀌었다: ${원본} — 다른 일이 그 폴더를 고치는 중이다. 끝난 뒤 다시 준비한다`);
    // 뜨는 사이 원본에 링크가 생겼으면 사본에도 링크가 떠진다 — 사본을 다시 훑어 링크가 있으면 멈춘다(GPT -d GD4).
    const 사본링크 = 링크찾기(곳);
    if (사본링크.length) throw new Error(`잇기 사본 안에 링크가 있다: ${l.경로} — ${사본링크.slice(0, 3).join(', ')}. 뜨는 사이 원본에 링크가 생겼다 — 끝난 뒤 다시 준비한다`);
    // 사본의 내용 지문(파일 바이트 포함) — 빌드마다 짓기 뒤에 이것과 견준다. 크기 · 고친 때를 지킨 채 내용만 바꿔도 잡는다(GPT -c GD6).
    잇기기준.set(`${임시}\0${l.경로}`, 폴더지문(곳, { 내용: true }));
    알리기(`생성물: 잇기 ${l.경로}의 원본을 임시 사본으로 떴다 — 빌드는 원본 대신 이 사본에 잇는다`);
  }
}
function 잇기하기(사본, 임시, 잇기들, 만든링크) {
  for (const l of 잇기들) {
    const 이을곳 = 잇기사본자리(임시, l), 곳 = path.join(사본, l.경로);
    if (!fs.existsSync(이을곳)) throw new Error(`잇기 사본이 없다: ${l.경로} — 잇기뜨기가 먼저 돌아야 한다`);
    if (fs.existsSync(곳) || 링크인가(곳)) throw new Error(`잇기 자리에 꺼낸 파일이 있다: ${l.경로}`);
    const 마디 = 링크마디(사본, path.dirname(l.경로));
    if (마디) throw new Error(`잇기 자리의 위 마디가 링크다: ${l.경로}(${마디})`);
    fs.mkdirSync(path.dirname(곳), { recursive: true });
    fs.symlinkSync(이을곳, 곳, process.platform === 'win32' ? 'junction' : 'dir');
    만든링크.push(곳);
  }
}
/** 이은 폴더(junction)는 원본을 따라 지우지 않게 링크만 먼저 걷는다. 하나라도 못 걷으면 던진다 — 그때는 임시 폴더를 지우지 않는다. */
function 링크걷기(만든링크) {
  for (const p of [...만든링크].reverse()) {
    if (!링크인가(p)) continue;
    // 빌더가 위 폴더를 링크로 바꿨으면 이 자리는 사본 밖을 가리킨다 — 걷지 않고 멈춘다(임시 폴더를 남긴다 · GPT -c GD3).
    if (링크거침(path.dirname(p))) throw new Error(`잇기 자리의 위 마디가 링크로 바뀌었다: ${p} — 걷으면 사본 밖을 건드릴 수 있어 멈춘다`);
    try { fs.unlinkSync(p); } catch { try { fs.rmdirSync(p); } catch { /* 아래에서 본다 */ } }
    if (링크인가(p)) throw new Error(`잇기를 걷지 못했다: ${p}`);
  }
}
function 돌리기(단계, 인자, 사본, 기록, { 실패해도 = false, 까닭 = null, 시간 = 기본시간, 보임 = a => a } = {}) {
  const 때 = Date.now();
  const r = spawnSync(process.execPath, 인자, { cwd: 사본, maxBuffer: 1 << 28, windowsHide: true, timeout: 시간 });
  const 끝글 = `${r.stdout || ''}${r.stderr || ''}`.replace(메일, '<메일>').slice(-1500);
  const 줄 = { 단계, 명령: ['node', ...인자.map(보임).map(a => (path.isAbsolute(a) && 안인가(슬래시(a), 슬래시(사본)) ? `<사본>${슬래시(a).slice(슬래시(사본).length)}` : 슬래시(a)))].join(' '),
    종료: r.status, ...(r.signal ? { 신호: r.signal } : {}), 걸림ms: Date.now() - 때, ...(실패해도 ? { 실패해도, 까닭 } : {}), 끝글 };
  기록.push(줄);
  if (r.error) throw new Error(`${단계} 실행 실패: ${줄.명령} — ${r.error.message}`);
  if (r.status !== 0 && !실패해도) throw new Error(`${단계} 실패(종료 ${r.status}${r.signal ? ` · ${r.signal}` : ''}): ${줄.명령}\n${끝글.slice(-600)}`);
}
/** 원천경로 아래 보통 파일(링크는 건너뜀) — 사본 상대 경로 → 절대 경로. 없음: 뿌리에 없는 원천경로 항목. */
export function 파일모음(뿌리, 경로들, 뺌) {
  const 모음 = new Map(), 없음 = [];
  const 걷기 = rel => {
    if (뺌.some(x => 안인가(rel, x))) return;
    const abs = path.join(뿌리, rel);
    let st;
    try { st = fs.lstatSync(abs); } catch { return; }
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) { for (const n of fs.readdirSync(abs).sort()) 걷기(`${rel}/${n}`); return; }
    if (st.isFile()) 모음.set(rel, abs);
  };
  for (const p of 경로들) {
    const r = 슬래시(p);
    // 원천경로 항목의 마디(위 마디 포함)가 링크면 링크를 따라 사본 밖 파일을 원천으로 읽는다 — 지원하지 않고 멈춘다(GPT -d GD3).
    const 마디 = 링크마디(뿌리, r);
    if (마디) throw new Error(`원천경로 ${r}의 마디가 링크다(${마디}) — 링크를 따라 사본 밖 파일을 원천 차이로 읽지 않게 멈춘다(도구가 다루지 않는 꼴)`);
    if (!fs.existsSync(path.join(뿌리, r))) 없음.push(r);
    걷기(r);
  }
  return Object.assign(모음, { 없음 });
}
const 이진인가 = b => b.subarray(0, 8000).includes(0);
/** 두 파일의 차이 글. J(JSON 모음)를 주면 두 판이 다 있는 .json은 줄 차이 대신 구조 차이를 모음에 한 번 기록하고 자리표만 둔다(쓰기 꼴을 못 찾으면 줄 차이). */
function 두파일차이(a, b, rel, 빈, J = null) {
  const 앞 = a ? fs.readFileSync(a) : Buffer.alloc(0), 뒤 = b ? fs.readFileSync(b) : Buffer.alloc(0);
  const 머리 = `--- ${a ? `a/${rel}` : '/dev/null'}\n+++ ${b ? `b/${rel}` : '/dev/null'}`;
  if (이진인가(앞) || 이진인가(뒤)) return `${머리}\n(이진 파일: ${a ? sha(앞).slice(0, 12) : '없음'} → ${b ? sha(뒤).slice(0, 12) : '없음'})\n`;
  // UTF-8이 아닌 글 파일(NUL 없는 Latin-1 등)은 서로 다른 바이트가 같은 글자(�)로 보여 차이가 사라진다 — 다루지 않고 멈춘다(설계 주인 11-21 · GPT -c GD16).
  const 아닌 = [[앞, a], [뒤, b]].filter(([x, 곳]) => 곳 && !Buffer.from(x.toString('utf8'), 'utf8').equals(x));
  if (아닌.length) throw new Error(`원천 차이: ${rel}이 UTF-8이 아니다 — 글 차이로 보이면 다른 바이트가 같은 글자로 보여 차이가 사라질 수 있어 멈춘다(도구가 다루지 않는 꼴)`);
  // 두 판이 같으면(모듈 원천 차이에서 원천은 같고 묶음 안 모듈만 다를 때) 그 사실만 적는다 — 묶음 쪽 차이는 빌드 맥락(가져오는 쪽)에서 온다.
  if (a && b && 앞.equals(뒤)) return `${머리}\n(두 판의 바이트가 같다 · sha256 ${sha(앞).slice(0, 12)})\n`;
  if (J && a && b && /\.json$/i.test(rel)) { const 표 = J.파일(rel, 앞, 뒤); if (표) return `${머리}\n${표}\n`; }
  const r = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.quotePath=false', 'diff', '--no-index', '--no-color', '--no-ext-diff', '-U5', '--', a || 빈, b || 빈], { maxBuffer: 1 << 28, windowsHide: true });
  if (r.status !== 0 && r.status !== 1) throw new Error(`원천 차이를 만들지 못했다: ${rel} — ${String(r.stderr || '').trim().slice(0, 300)}`);
  // CR은 ␍로 보인다(GPT -e GF2) — 줄 끝을 LF에서 CRLF로 바꾼 줄이 같은 줄을 빼고 더한 것처럼 보이지 않게.
  const 글 = r.stdout.toString('utf8').replace(/\r/g, '␍'), k = 글.indexOf('\n@@');
  return `${머리}\n${k < 0 ? '' : 글.slice(k + 1)}`;
}
/** 원천 차이(바탕 → 되돌린 뒤 후보 원천). 원천경로 항목이 두 판 어디에도 없으면 멈춘다(Opus F3 — 물음 글이 붙은 표지 꼴 같은 잘못 적은 경로가
 *  말없이 빠지지 않게). 원천글: 후보 원천의 그 파일들(반사실 빌드가 바탕 사본에 덮는다). */
function 원천차이만들기(바탕폴더, 후보폴더, 경로들, 뺌, 빈, J = null) {
  const 앞 = 파일모음(바탕폴더, 경로들, 뺌), 뒤 = 파일모음(후보폴더, 경로들, 뺌);
  const 둘다없음 = 앞.없음.filter(p => 뒤.없음.includes(p));
  if (둘다없음.length) throw new Error(`원천경로 항목이 바탕 · 후보 원천 어디에도 없다: ${둘다없음.join(', ')} — 명세의 원천경로를 고친다(물음 글 ?v=… 같은 표지 꼴은 파일 경로가 아니다)`);
  const 모두 = [...new Set([...앞.keys(), ...뒤.keys()])].sort(), 조각 = [], 조각경로 = [];
  for (const rel of 모두) {
    const a = 앞.get(rel), b = 뒤.get(rel);
    if (a && b && fs.readFileSync(a).equals(fs.readFileSync(b))) continue;
    조각.push(두파일차이(a, b, rel, 빈, J)); 조각경로.push(rel);
  }
  return { 글: 조각.join('\n'), 조각들: 조각.map((글, n) => ({ rel: 조각경로[n], 글 })), 바뀐파일: 조각.length, 본파일: 모두.length, 원천글: new Map([...뒤].map(([rel, abs]) => [rel, fs.readFileSync(abs)])) };
}
/** 원천경로 밖 빌드 입력 차이의 글(Opus F3) — 묶음 글(입력글)에는 반사실 빌드 결과 · 폴더별 수 · 빌더가 부르는 파일과 설정 파일의 차이를 싣고,
 *  증거 글(입력증거)에는 바뀐 경로를 다 싣는다. */
function 입력글들(d, 후보지도, 후보설정글, 빌더파일, 임시, 빈, 실은차글 = new Map(), 이번항목 = null) {
  const { 바뀐, 앞, 바탕글, 반사실 } = d.입력;
  // 바탕글은 바탕 · 후보 빌더가 부르는 파일과 설정 파일 가운데 바뀐 것만 담는다(GPT -c GD15) — 후보에서 사라진 빌더 파일도 지운 차이로 보인다.
  const 보일 = 바뀐.filter(rel => 바탕글.has(rel) || ((빌더파일.has(rel) || 설정꼴(rel)) && 후보설정글.has(rel)));
  const 차 = 보일.map(rel => {
    const a = 바탕글.has(rel) ? path.join(임시, 'input-a') : null, b = 후보설정글.has(rel) ? path.join(임시, 'input-b') : null;
    if (a) fs.writeFileSync(a, 바탕글.get(rel));
    if (b) fs.writeFileSync(b, 후보설정글.get(rel));
    return 두파일차이(a, b, rel, 빈);
  });
  const 폴더수 = new Map();
  for (const rel of 바뀐) { const k = rel.split('/').slice(0, 2).join('/'); 폴더수.set(k, (폴더수.get(k) || 0) + 1); }
  const 반 = 반사실.length ? 반사실.map(x => (x.같음 ? `- ${x.경로}: 이 파일들을 바탕 판으로 둔 채 후보 원천경로로 다시 지어도 sha256이 후보와 같다(반사실 빌드) — 이 출력에는 영향이 없다`
    : `- ${x.경로}: 바탕 판 입력으로는 ${x.실패 ? `지어지지 않는다(${x.실패})` : `sha256 ${x.sha256 ? x.sha256.slice(0, 12) : '없음'}로 후보와 다르다`} — 원천경로 밖 입력이 출력을 바꾸므로 이 항목은 본문 차이 · 대조로 검수한다`))
    : ['- 이 원천 차이를 쓰는 항목은 바탕 재현이 안 돼 본문 차이 · 대조로 검수한다(반사실 빌드는 하지 않았다).'];
  const 머리 = [`## 원천경로 밖 빌드 입력 차이 — 바탕 ${d.바탕.slice(0, 10)} → 후보 원천(되돌림 · 준비 뒤): 파일 ${바뀐.length}개`,
    '원천경로 밖의 꺼냄 파일도 빌더의 입력이다. 빌더가 부르는 파일(빌더 대본과 그 가져오기 · 인자로 준 사본 안 파일)과 설정 파일(package.json 등)은 차이를 싣고, 나머지는 폴더별 수만 싣는다(경로는 증거 파일 원천차이-n.patch에 다 있다).',
    ...반, ...(반사실.some(x => x.같음) ? ['- 한계: 반사실 빌드는 원천을 덮은 뒤 준비 대본을 다시 돌린다. 준비 대본이 원천경로 안의 값을 원천경로 밖 파일에 옮겨 쓰면 그 파일도 후보 값으로 지어 「같다」에 든다 — 그 값이 원천 차이에 이미 있고 대본이 해시로 묶였다(설계 주인 11-21 · GPT -c GD14).'] : []),
    '', `폴더별 수: ${[...폴더수].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).map(([k, n]) => `${k} ${n}`).join(' · ')}`];
  const 차글 = (차.length ? [`### 빌더가 부르는 파일 · 설정 파일의 차이 ${차.length}개`, ...차] : ['(빌더가 부르는 파일 · 설정 파일은 바뀌지 않았다)']).join('\n');
  const 줄 = rel => `- ${rel}: ${앞.get(rel)?.slice(0, 10) ?? '없음'} → ${후보지도.get(rel)?.slice(0, 10) ?? '없음'}`;
  // 같은 바탕의 다른 원천 차이가 같은 차이를 이미 실었으면 묶음에는 그 항목을 가리킨다(증거 파일에는 다 싣는다).
  const 앞항목 = 차.length ? 실은차글.get(차글) : null;
  if (차.length && !앞항목) 실은차글.set(차글, 이번항목);
  const 묶음차글 = 앞항목 ? `### 빌더가 부르는 파일 · 설정 파일의 차이 ${차.length}개 — [${앞항목}]에 실은 것과 같다(그 항목을 본다)` : 차글;
  return { 입력글: [...머리, '', 묶음차글].join('\n'), 입력증거: [...머리, '', 차글, '', '### 바뀐 경로(git 블롭 번호 바탕 → 후보)', ...바뀐.map(줄)].join('\n') };
}
/** 반사실 빌드의 덮기 — 바탕 사본의 원천경로(원천뺌 밖)를 후보 원천의 파일로 바꾼다. 원천경로 밖(빌드 입력)은 바탕 판 그대로다. */
export function 원천덮기(사본, 경로들, 뺌, 원천글) {
  // 지우거나 쓰기 전에 경로 마디마다 링크가 없는지 본다(GPT GB2) — 바탕 사본의 링크(git 심볼릭 링크 등)를 따라 사본 밖 파일을 지우거나 덮지 않게 멈춘다.
  const 링크보기 = rel => { const 마디 = 링크마디(사본, rel); if (마디) throw new Error(`반사실 빌드: 덮을 자리에 링크가 있다: ${rel}(${마디}) — 링크를 따라 사본 밖에 쓰지 않게 멈춘다`); };
  for (const p of 경로들) 링크보기(p);
  for (const [rel, abs] of 파일모음(사본, 경로들, 뺌)) { 링크보기(rel); fs.rmSync(abs); }
  // 지운 뒤 빈 폴더를 걷는다 — 바탕의 폴더 자리(src/config/index.js)를 후보가 파일(src/config)로 쓰면 빈 폴더가 쓰기를 막는다(GPT -c GD18). 링크는 따라가지 않는다.
  const 빈폴더걷기 = abs => {
    let s;
    try { s = fs.lstatSync(abs); } catch { return; }
    if (!s.isDirectory()) return;
    for (const e of fs.readdirSync(abs)) 빈폴더걷기(path.join(abs, e));
    if (!fs.readdirSync(abs).length) fs.rmdirSync(abs);
  };
  for (const p of 경로들) 빈폴더걷기(path.join(사본, p));
  for (const [rel, b] of 원천글) { 링크보기(rel); const 곳 = path.join(사본, rel); fs.mkdirSync(path.dirname(곳), { recursive: true }); 링크보기(rel); fs.writeFileSync(곳, b); }
}

// ── JSON 구조 차이(설계 주인 11-21) ──────────────────────────────────
// 두 판이 다 있는 JSON 파일은 줄 차이 대신 열쇠 단위 연산(바꿈 · 더함 · 뺌 · 차례)으로 싣는다. 바뀐 열쇠는 옛 값 → 새 값을 줄이지 않고 싣는다.
// 도구가 완전함을 증명한다: 앞 값에 연산을 차례로 적용해 앞 파일과 같은 쓰기 꼴로 다시 쓰면 뒤 바이트가 그대로 나와야 한다(완전). 완전하지
// 않으면 증명에 그대로 적고 처음 고리 판정이 미충족으로 막는다. 같은 (경로 · 앞 · 뒤) 차이는 묶음에 한 번만 싣고(G5…) 다른 자리는 가리킨다.
// 배열은 모든 원소가 객체이고 두 판에서 겹치지 않는 열쇠(id를 먼저, 다음 …Id · …Key 꼴)가 있으면 그 열쇠로, 아니면 자리로 짝짓는다.
const 알맹이 = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const 같은값 = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const 칸넣기 = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
const 본문글 = b => { const s = b.toString('utf8'); return s.startsWith('﻿') ? s.slice(1) : s; };
/** 쓰기 꼴 — { 들여쓰기, 끝줄, 줄끝, bom }. 그 꼴로 다시 쓴 글이 바이트까지 같을 때만 꼴이다. 못 찾으면 null. */
export function JSON쓰기꼴(b) {
  const 글 = b.toString('utf8');
  if (!Buffer.from(글, 'utf8').equals(b)) return null;
  let v;
  try { v = JSON.parse(본문글(b)); } catch { return null; }
  const bom = 글.startsWith('﻿'), 줄끝 = 글.includes('\r\n') ? '\r\n' : '\n';
  for (const 들여쓰기 of [2, 4, '\t', 0]) for (const 끝줄 of [true, false]) {
    const 꼴 = { 들여쓰기, 끝줄, 줄끝, bom };
    if (JSON쓰기(v, 꼴) === 글) return 꼴;
  }
  return null;
}
export function JSON쓰기(v, 꼴) {
  const s = JSON.stringify(v, null, 꼴.들여쓰기 || undefined);
  return `${꼴.bom ? '﻿' : ''}${꼴.줄끝 === '\r\n' ? s.replace(/\n/g, '\r\n') : s}${꼴.끝줄 ? 꼴.줄끝 : ''}`;
}
const 짝열쇠꼴 = /(?:Id|Key|_id|_key)$|^(?:key|uid|slug|code)$/;
function 짝열쇠(a, b) {
  const 모두 = [...a, ...b];
  if (!모두.length || !모두.every(알맹이)) return null;
  const 공통 = Object.keys(모두[0]).filter(k => 모두.every(x => Object.hasOwn(x, k) && (typeof x[k] === 'string' || typeof x[k] === 'number')));
  const 겹침없음 = (xs, k) => new Set(xs.map(x => JSON.stringify(x[k]))).size === xs.length;
  return [...공통.filter(k => k === 'id'), ...공통.filter(k => k !== 'id' && 짝열쇠꼴.test(k))].find(k => 겹침없음(a, k) && 겹침없음(b, k)) ?? null;
}
const 차례로 = ks => { const o = Object.create(null); for (const k of ks) o[k] = 1; return Object.keys(o); };
/** 앞 값 → 뒤 값의 연산 목록. 길은 열쇠(글) · 자리(수) · { 열쇠, 값 }(짝 열쇠로 찾는 배열 원소) 마디의 목록이다. */
export function JSON차이연산(a, b, 길 = [], 연산 = []) {
  if (알맹이(a) && 알맹이(b)) {
    const ak = Object.keys(a), bk = Object.keys(b), as = new Set(ak), bs = new Set(bk);
    for (const k of ak) if (!bs.has(k)) 연산.push({ 연산: '뺌', 길: [...길, k], 앞: a[k] });
    for (const k of ak) if (bs.has(k)) JSON차이연산(a[k], b[k], [...길, k], 연산);
    for (const k of bk) if (!as.has(k)) 연산.push({ 연산: '더함', 길: [...길, k], 뒤: b[k] });
    // 열쇠에 NUL이 들 수 있어 이어 붙이지 않고 자리마다 견준다(GPT GB14).
    const 뒤차례 = 차례로([...ak.filter(k => bs.has(k)), ...bk.filter(k => !as.has(k))]);
    if (뒤차례.length !== bk.length || 뒤차례.some((k, n) => k !== bk[n])) 연산.push({ 연산: '차례', 길, 뒤: bk });
  } else if (Array.isArray(a) && Array.isArray(b)) {
    const k = 짝열쇠(a, b);
    if (k) {
      const 값 = x => JSON.stringify(x[k]), am = new Map(a.map(x => [값(x), x])), bm = new Map(b.map(x => [값(x), x]));
      for (const x of a) if (!bm.has(값(x))) 연산.push({ 연산: '뺌', 길: [...길, { 열쇠: k, 값: x[k] }], 앞: x });
      for (const x of a) if (bm.has(값(x))) JSON차이연산(x, bm.get(값(x)), [...길, { 열쇠: k, 값: x[k] }], 연산);
      for (const x of b) if (!am.has(값(x))) 연산.push({ 연산: '더함', 길: [...길, { 열쇠: k, 값: x[k] }], 뒤: x });
      if ([...a.filter(x => bm.has(값(x))), ...b.filter(x => !am.has(값(x)))].map(값).join('\0') !== b.map(값).join('\0')) 연산.push({ 연산: '차례', 길, 열쇠: k, 뒤: b.map(x => x[k]) });
    } else {
      const n = Math.min(a.length, b.length);
      for (let i = a.length - 1; i >= n; i -= 1) 연산.push({ 연산: '뺌', 길: [...길, i], 앞: a[i] });
      for (let i = 0; i < n; i += 1) JSON차이연산(a[i], b[i], [...길, i], 연산);
      for (let i = n; i < b.length; i += 1) 연산.push({ 연산: '더함', 길: [...길, i], 뒤: b[i] });
    }
  } else if (!같은값(a, b)) 연산.push({ 연산: '바꿈', 길, 앞: a, 뒤: b });
  return 연산;
}
/** 연산을 앞 값에 차례로 적용한다(앞 값은 건드리지 않는다). 연산이 앞 값과 맞지 않으면(옛 값이 다름 · 길이 없음 · 이미 있음) 던진다. */
export function JSON연산적용(값, 연산) {
  const 복사 = v => JSON.parse(JSON.stringify(v));
  let 뿌리 = 복사(값);
  const 틀림 = (o, m) => { throw new Error(`JSON 연산이 앞 값과 맞지 않는다: ${o.연산} ${JSON.stringify(o.길).slice(0, 200)} — ${m}`); };
  const 칸 = (o, s, x) => {
    if (typeof s === 'number') return Array.isArray(o) && Number.isInteger(s) ? s : 틀림(x, '배열 자리가 아니다');
    if (typeof s === 'string') return 알맹이(o) ? s : 틀림(x, '객체 열쇠가 아니다');
    if (!Array.isArray(o) || !알맹이(s) || typeof s.열쇠 !== 'string') 틀림(x, '짝 열쇠 마디가 배열에 있지 않다');
    return o.findIndex(y => 알맹이(y) && Object.hasOwn(y, s.열쇠) && 같은값(y[s.열쇠], s.값));
  };
  const 있음 = (o, k) => (Array.isArray(o) ? Number.isInteger(k) && k >= 0 && k < o.length : Object.hasOwn(o, k));
  const 내려가기 = (길, x) => { let o = 뿌리; for (const s of 길) { const k = 칸(o, s, x); if (!있음(o, k)) 틀림(x, '길이 없다'); o = o[k]; } return o; };
  for (const x of 연산) {
    if (!x || !Array.isArray(x.길)) 틀림(x ?? {}, '연산 꼴이 아니다');
    if (x.연산 === '차례') {
      const t = 내려가기(x.길, x);
      if (Array.isArray(t)) {
        const 새 = (x.뒤 || []).map(v => t.find(y => 알맹이(y) && 같은값(y[x.열쇠], v)));
        if (새.length !== t.length || 새.some(v => v === undefined) || new Set(새).size !== 새.length) 틀림(x, '차례가 지금 원소의 순열이 아니다');
        t.splice(0, t.length, ...새);
      } else if (알맹이(t)) {
        const 뒤 = x.뒤 || [];
        if (뒤.length !== Object.keys(t).length || new Set(뒤).size !== 뒤.length || !뒤.every(k => Object.hasOwn(t, k))) 틀림(x, '차례가 지금 열쇠의 순열이 아니다');
        for (const k of 뒤) { const v = t[k]; delete t[k]; 칸넣기(t, k, v); }
      } else 틀림(x, '차례를 둘 곳이 객체나 배열이 아니다');
      continue;
    }
    if (!x.길.length) {
      if (x.연산 !== '바꿈' || !같은값(뿌리, x.앞)) 틀림(x, '뿌리는 옛 값이 같은 바꿈만 받는다');
      뿌리 = 복사(x.뒤);
      continue;
    }
    const 부모 = 내려가기(x.길.slice(0, -1), x), s = x.길.at(-1), k = 칸(부모, s, x);
    if (x.연산 === '바꿈') {
      if (!있음(부모, k) || !같은값(부모[k], x.앞)) 틀림(x, '옛 값이 다르다');
      if (Array.isArray(부모)) 부모[k] = 복사(x.뒤); else 칸넣기(부모, k, 복사(x.뒤));
    } else if (x.연산 === '더함') {
      if (Array.isArray(부모)) {
        if (typeof s === 'number' ? k !== 부모.length : k >= 0) 틀림(x, '더할 자리에 이미 원소가 있다');
        if (typeof s !== 'number' && !(알맹이(x.뒤) && 같은값(x.뒤[s.열쇠], s.값))) 틀림(x, '더한 원소의 짝 열쇠가 길과 다르다');
        부모.push(복사(x.뒤));
      } else {
        if (Object.hasOwn(부모, k)) 틀림(x, '더할 열쇠가 이미 있다');
        칸넣기(부모, k, 복사(x.뒤));
      }
    } else if (x.연산 === '뺌') {
      if (!있음(부모, k) || !같은값(부모[k], x.앞)) 틀림(x, '뺄 값이 다르다');
      if (Array.isArray(부모)) 부모.splice(k, 1); else delete 부모[k];
    } else 틀림(x, '모르는 연산');
  }
  return 뿌리;
}
/** 완전한가 — 앞 값에 연산을 적용해 꼴대로 쓴 바이트가 뒤 바이트와 같은가. */
export function JSON차이완전(앞값, 연산, 꼴, 뒤b) {
  try { return Buffer.from(JSON쓰기(JSON연산적용(앞값, 연산), 꼴), 'utf8').equals(뒤b); } catch { return false; }
}
/** 두 JSON 파일의 구조 차이 — 두 판이 같은 쓰기 꼴일 때만(아니면 null · 줄 차이로 간다). { 꼴, 연산, 연산수, 연산sha256, 완전 }. */
export function JSON구조차이(앞b, 뒤b) {
  const 꼴 = JSON쓰기꼴(앞b), 뒤꼴 = JSON쓰기꼴(뒤b);
  if (!꼴 || !뒤꼴 || !같은값(꼴, 뒤꼴)) return null;
  const 앞값 = JSON.parse(본문글(앞b)), 연산 = JSON차이연산(앞값, JSON.parse(본문글(뒤b)));
  return { 꼴, 연산, 연산수: 연산.length, 연산sha256: sha(JSON.stringify(연산)), 완전: JSON차이완전(앞값, 연산, 꼴, 뒤b) };
}
/** 모듈 글의 맨 위 문장에 값(객체 · 배열 식)이 「시작」 자리에서 시작하는 선언(var · let · const)이나 module.exports 대입이 있는가(acorn · GPT -c GD10). */
function JSON값자리인가(글, 시작) {
  let 나무;
  try { 나무 = 파서얻기().parse(글, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, allowImportExportEverywhere: true }); } catch { return false; }
  const 값꼴 = n => !!n && n.start === 시작 && (n.type === 'ObjectExpression' || n.type === 'ArrayExpression');
  for (const 문 of 나무.body) {
    if (문.type === 'VariableDeclaration' && 문.declarations.some(d => 값꼴(d.init))) return true;
    const e = 문.type === 'ExpressionStatement' ? 문.expression : null, l = e?.left;
    if (e?.type === 'AssignmentExpression' && e.operator === '=' && 값꼴(e.right) && l.type === 'MemberExpression' && !l.computed
      && l.object.type === 'Identifier' && l.object.name === 'module' && l.property.type === 'Identifier' && l.property.name === 'exports') return true;
  }
  return false;
}
/** 묶음 안 JSON 모듈의 글자 값을 코드를 돌리지 않고 읽는다 — `var 이름 = <값>` 또는 `module.exports = <값>`의 첫 값만.
 *  돌려주는 것: { 값, 틀(값 자리를 0으로 바꾼 모듈 글) } 또는 null. */
export function 모듈JSON값(글) {
  const m = /(?:^|[\s;])(?:var|let|const)\s+[\p{L}_$][\p{L}\p{N}_$]*\s*=\s*|module\.exports\s*=\s*/u.exec(글);
  if (!m) return null;
  let i = m.index + m[0].length;
  const 시작 = i, s = 글;
  if (s[i] !== '{' && s[i] !== '[') return null;
  // 찾은 자리가 실제 맨 위 선언 · module.exports 대입의 값 자리인지 acorn 나무로 본다 — 문자열 · 주석 안의 `module.exports =`를 값으로 읽지
  // 않는다(GPT -c GD10). 읽지 못하거나 자리가 다르면 구조 차이로 읽지 않는다(정리한 글 차이로 간다 — 「같다」 쪽으로 틀리지 않는다).
  if (!JSON값자리인가(s, 시작)) return null;
  const 그만 = () => { throw new Error('글자 값이 아니다'); };
  const 빈칸 = () => { while (i < s.length && /\s/.test(s[i])) i += 1; };
  const 이름글자 = c => c != null && /[\p{L}\p{N}_$]/u.test(c);
  const 글자 = () => {
    const q = s[i]; let j = i + 1;
    while (j < s.length && s[j] !== q) { if (s[j] === '\\') j += 1; else if ((q === '`' && s[j] === '$' && s[j + 1] === '{') || (q !== '`' && s[j] === '\n')) 그만(); j += 1; }
    if (j >= s.length) 그만();
    const t = s.slice(i, j + 1); i = j + 1; return 글풀기(t);
  };
  // 계산하지 않은 __proto__ 열쇠는 실행하면 자체 속성이 아니라 프로토타입을 바꾼다 — JSON 값으로 읽지 않는다(계산한 ["__proto__"]만 자체 속성, GPT GB10).
  const 열쇠 = () => {
    if (s[i] === '"' || s[i] === "'") { const k = 글자(); if (k === '__proto__') 그만(); return k; }
    if (s[i] === '[') { i += 1; 빈칸(); if (s[i] !== '"' && s[i] !== "'") 그만(); const k = 글자(); 빈칸(); if (s[i] !== ']') 그만(); i += 1; return k; }
    // 이름 열쇠 — esbuild는 ASCII 밖 글자를 \uXXXX로 쓴다(남자: …). 탈출 글자를 풀어 열쇠로 쓴다.
    const n = /^(?:[\p{L}_$]|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\})(?:[\p{L}\p{N}_$]|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\})*/u.exec(s.slice(i, i + 512)) || /^\d+(?![\p{L}\p{N}_$.])/u.exec(s.slice(i, i + 64));
    if (!n) 그만();
    i += n[0].length;
    const k = /^\d+$/.test(n[0]) ? String(Number(n[0])) : 글풀기(`"${n[0]}"`);
    if (k === '__proto__') 그만();
    return k;
  };
  const 값 = () => {
    빈칸();
    const c = s[i];
    if (c === '{' || c === '[') {
      const 객체 = c === '{', 닫음 = 객체 ? '}' : ']', o = 객체 ? {} : [];
      i += 1; 빈칸();
      if (s[i] === 닫음) { i += 1; return o; }
      for (;;) {
        빈칸();
        if (객체) { const k = 열쇠(); 빈칸(); if (s[i] !== ':') 그만(); i += 1; 칸넣기(o, k, 값()); } else o.push(값());
        빈칸();
        if (s[i] === ',') { i += 1; 빈칸(); if (s[i] === 닫음) { i += 1; return o; } continue; }
        if (s[i] === 닫음) { i += 1; return o; }
        그만();
      }
    }
    if (c === '"' || c === "'" || c === '`') return 글자();
    for (const [낱, v] of [['true', true], ['false', false], ['null', null]]) if (s.startsWith(낱, i) && !이름글자(s[i + 낱.length])) { i += 낱.length; return v; }
    const n = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i, i + 64));
    if (!n || 이름글자(s[i + n[0].length])) 그만();
    i += n[0].length;
    const v = Number(n[0]);
    // -0은 JSON으로 쓰면 0이 되어 구조 차이가 바뀜을 잃는다(GPT GB12) — JSON 값으로 읽지 않는다(모듈 글 차이로 간다).
    return Number.isFinite(v) && !Object.is(v, -0) ? v : 그만();
  };
  try { const v = 값(); return { 값: v, 틀: `${s.slice(0, 시작)}0${s.slice(i)}` }; } catch { return null; }
}
const 꼴글 = 꼴 => `들여쓰기 ${꼴.들여쓰기 === '\t' ? '탭' : 꼴.들여쓰기 || '없음'} · 끝 줄바꿈 ${꼴.끝줄 ? '있음' : '없음'} · 줄끝 ${꼴.줄끝 === '\r\n' ? 'CRLF' : 'LF'}${꼴.bom ? ' · BOM' : ''}`;
const 길글 = 길 => `$${길.map(s => (typeof s === 'number' ? `[${s}]` : typeof s === 'string' ? (이름꼴.test(s) ? `.${s}` : `[${JSON.stringify(s)}]`) : `[${s.열쇠}=${JSON.stringify(s.값)}]`)).join('')}`;
/** JSON 구조 차이의 검수 글 — 연산마다 한 줄, 값은 줄이지 않는다. */
export function JSON차이글(x) {
  const 값 = v => JSON.stringify(v);
  const 줄 = o => (o.연산 === '바꿈' ? `바꿈 ${길글(o.길)}: ${값(o.앞)} → ${값(o.뒤)}` : o.연산 === '더함' ? `더함 ${길글(o.길)}: ${값(o.뒤)}`
    : o.연산 === '뺌' ? `뺌 ${길글(o.길)}: ${값(o.앞)}` : `차례 ${길글(o.길)}${o.열쇠 ? `(${o.열쇠} 차례)` : ''}: ${값(o.뒤)}`);
  return [x.모듈 ? `라이브 묶음의 JSON 모듈 값(코드를 돌리지 않고 글자 그대로 읽었다 · 모듈 글 sha256 ${x.앞sha256}) → 후보 묶음의 JSON 모듈 값(sha256 ${x.뒤sha256}). 후보 원천 파일 sha256 ${x.원천sha256}. 두 모듈의 값 밖 글(틀)은 같은 코드다.`
    : `앞 sha256 ${x.앞sha256} → 뒤 sha256 ${x.뒤sha256}`,
  `쓰기 꼴: ${꼴글(x.꼴)}${x.모듈 ? '(후보 원천 파일의 꼴)' : ''} · 연산 ${x.연산수}개 · 연산 sha256 ${x.연산sha256}`,
  x.완전 ? `완전: 앞 값에 아래 연산을 차례로 적용해 이 꼴로 쓰면 ${x.모듈 ? '후보 원천 파일' : '뒤 파일'}의 바이트가 그대로 나온다(도구가 확인했다).`
    : `완전하지 않음: 앞 값에 아래 연산을 적용해 이 꼴로 써도 ${x.모듈 ? '후보 원천 파일' : '뒤 파일'}의 바이트가 나오지 않는다 — 이 검수는 미충족이다.`,
  '', '연산(차례대로 · 바뀐 열쇠는 옛 값 → 새 값을 줄이지 않고 싣는다):', ...x.연산.map(줄)].join('\n');
}
/** 한 번의 재현에서 쓰는 JSON 구조 차이 모음. 파일() · 모듈()은 기록하고 자리표(이 재현에서만 쓰는 글)를 돌려준다. 꼴을 못 찾으면 null. */
function JSON모음만들기() {
  const 기록 = [], 열쇠별 = new Map(), 씨 = crypto.randomBytes(6).toString('hex');
  const 자리표 = x => `⟦JSON ${씨} ${x.번}⟧`;
  const 기록하기 = (열쇠, 짓기) => {
    if (!열쇠별.has(열쇠)) { const r = 짓기(); 열쇠별.set(열쇠, r ? Object.assign(r, { 번: 기록.length }) : null); if (r) 기록.push(r); }
    const x = 열쇠별.get(열쇠);
    return x ? 자리표(x) : null;
  };
  return {
    기록,
    자리꼴: new RegExp(`⟦JSON ${씨} (\\d+)⟧`, 'g'),
    파일: (rel, 앞b, 뒤b) => 기록하기(`파일\0${rel}\0${sha(앞b)}\0${sha(뒤b)}`, () => { const r = JSON구조차이(앞b, 뒤b); return r && { 경로: rel, 앞sha256: sha(앞b), 뒤sha256: sha(뒤b), ...r }; }),
    // 묶음 안 JSON 모듈(라이브 · 후보 모듈 글)과 후보 원천 파일: 후보 모듈 값을 꼴대로 쓰면 원천 파일과 같아야 하고(읽기가 맞다), 값 밖 글이 같은 코드여야 한다.
    모듈: (rel, 라이브글, 후보글, 원천b) => 기록하기(`모듈\0${rel}\0${sha(라이브글)}\0${sha(후보글)}`, () => {
      const A = 모듈JSON값(라이브글), B = 모듈JSON값(후보글), 꼴 = Buffer.isBuffer(원천b) ? JSON쓰기꼴(원천b) : null;
      if (!A || !B || !꼴 || !Buffer.from(JSON쓰기(B.값, 꼴), 'utf8').equals(원천b) || !같은코드(A.틀, B.틀).같음) return null;
      const 연산 = JSON차이연산(A.값, B.값);
      return { 경로: rel, 모듈: true, 앞sha256: sha(라이브글), 뒤sha256: sha(후보글), 원천sha256: sha(원천b), 꼴, 연산, 연산수: 연산.length, 연산sha256: sha(JSON.stringify(연산)), 완전: JSON차이완전(A.값, 연산, 꼴, 원천b) };
    }),
  };
}
/** 묶음에 싣는 글(실린 원천 차이 · 대조 몸)에서 처음 나오는 차례로 JSON 구조 차이에 G50 · G51 …을 매기고 자리표를 가리킴 글로 바꾼다.
 *  묶음에 싣지 않는 원천 차이(증거 파일만)에만 나오는 차이는 그 글에 전문을 둔다. 돌려주는 것: 묶음에 싣는 JSON 구조 차이 목록. */
function JSON마무리(J, 원천차이, 대조자료, 알리기) {
  const 실린글 = [...원천차이.filter(d => d.원천실림 ?? d.실림).map(d => d.글), ...원천차이.filter(d => d.비모듈글).map(d => d.비모듈글), ...[...대조자료.values()].flatMap(x => x.몸들.map(m => m.몸))];
  const 실림 = [];
  for (const 글 of 실린글) for (const m of 글.matchAll(J.자리꼴)) { const x = J.기록[Number(m[1])]; if (!x.앞) { x.앞 = `G5${실림.length}`; 실림.push(x); } }
  const 바꾸기 = 글 => 글.replace(J.자리꼴, (_, n) => {
    const x = J.기록[Number(n)];
    return x.앞 ? `(JSON 구조 차이 — [${x.앞}]에 한 번 싣는다 · 연산 ${x.연산수}개 · ${x.완전 ? '완전' : '완전하지 않음(미충족)'})` : `(JSON 구조 차이 — 이 증거에만 싣는다)\n${JSON차이글(x)}`;
  });
  for (const d of 원천차이) { d.글 = 바꾸기(d.글); if (d.비모듈글) d.비모듈글 = 바꾸기(d.비모듈글); }
  for (const x of 대조자료.values()) for (const m of x.몸들) m.몸 = 바꾸기(m.몸);
  for (const x of 실림.filter(y => !y.완전)) 알리기(`생성물: JSON 구조 차이 ${x.앞}(${x.경로})가 완전하지 않다 — 앞 값에 연산을 적용해도 뒤 바이트가 나오지 않는다. 이 검수는 미충족이 된다(도구 결함)`);
  return 실림;
}

// 출력은 경로 마디 어디에도 링크가 없을 때만 읽는다 — 위 폴더를 링크로 이으면 사본 밖 파일을 재현으로 받게 된다(GPT -c GD5).
const 만든sha = (사본, 만든곳) => { const 곳 = path.join(사본, 만든곳); return !링크마디(사본, 만든곳) && fs.existsSync(곳) && fs.statSync(곳).isFile() ? sha(fs.readFileSync(곳)) : null; };
/** 커밋을 사본으로 꺼내 잇기 · (되돌림) · 준비 · 빌더를 차례로 돌린다. 그때()는 되돌린 뒤 · 준비 전에 부른다(원천 차이를 뜨는 자리).
 *  입력그때(지도)는 준비 뒤 · 빌더 전에 빌드 입력 지도를 넘겨 부른다(Opus F3 · F4). */
function 짓기({ 저장소, 커밋, 사본, 임시, 정보, 링크, 기록, 되돌림 = true, 그때 = null, 입력그때 = null, 시간, 알리기, 머리 = '', 빌더 = null, 준비함 = true }) {
  const 명세 = { ...정보.명세, 빌더: 빌더 ?? 정보.명세.빌더 };
  입력확인(정보, `${머리}짓기 전:`);
  const 꺼낸수 = 꺼내기(저장소, 커밋, 명세.꺼냄, 사본, 임시);
  // 꺼낸 판에 EXPORT_COMMIT이 링크로 있으면 쓰기가 링크 대상을 덮는다 — 멈춘다(GPT -c GD4).
  const 표마디 = 링크마디(사본, 'EXPORT_COMMIT');
  if (표마디) throw new Error(`EXPORT_COMMIT 자리가 링크다(${표마디}) — 쓰면 링크를 따라 사본 밖 파일을 덮는다`);
  fs.writeFileSync(path.join(사본, 'EXPORT_COMMIT'), `${커밋}\n`);
  기록.push({ 단계: `${머리}꺼냄`, 명령: `git checkout-index(${커밋.slice(0, 10)} · ${명세.꺼냄.join(' ')})`, 종료: 0, 파일: 꺼낸수 });
  잇기하기(사본, 임시, 명세.잇기, 링크);
  // 만든곳 비움(GPT GB5): 이 실행의 대본 · 빌더가 새로 지은 파일만 재현으로 본다 — 꺼낸 판에 이미 있던 출력(커밋된 묶음 등)은 지우고 시작한다.
  // 머리곳(설계 검토 F3 · GPT GC3)도 지운다 — 머리 입력 목록은 이 빌드가 지은 중간 묶음에서만 읽는다. 지우기 전에 경로 마디에 링크가 없는지 본다(GPT GB1).
  const 지움 = [];
  for (const p of [...new Set(명세.항목.flatMap(it => [it.만든곳, it.짝만든곳, it.머리곳]).filter(Boolean))]) {
    const 곳 = path.join(사본, p), 마디 = 링크마디(사본, p);
    if (마디) throw new Error(`만든곳 자리에 링크가 있다: ${p}(${마디}) — 지우면 링크를 따라 사본 밖 파일을 지운다`);
    if (!fs.existsSync(곳)) continue;
    if (!fs.statSync(곳).isFile()) throw new Error(`만든곳이 파일이 아니다: ${p}`);
    fs.rmSync(곳); 지움.push(p);
  }
  if (지움.length) 기록.push({ 단계: `${머리}만든곳 비움`, 명령: `꺼낸 판에 있던 출력을 지움: ${지움.join(' ')}`, 종료: 0, 파일: 지움.length });
  // 잇기 사본 지킴(GPT GB4 · GA1 · GB3): 빌드는 잇기 원본의 임시 사본에 잇는다. 짓기 앞뒤로(단계가 실패해도) 그 사본의 지문을 재서 달라졌으면
  // 준비 전체를 멈춘다 — 사본을 이 준비의 다른 빌드와 나눠 쓰므로 재현을 믿을 수 없다. 공용 원본은 사본으로 이었으니 그대로다.
  const 이은곳들 = 명세.잇기.map(l => 잇기사본자리(임시, l)), 기준지문 = 명세.잇기.map(l => 잇기기준.get(`${임시}\0${l.경로}`));
  if (기준지문.some(x => !x)) throw new Error('잇기 사본의 기준 지문이 없다 — 잇기뜨기가 먼저 돌아야 한다');
  // 입력 사본(GPT -c GD2 · P2 B3): 빌더 인자로 넘기는 사본 밖 입력 파일도 명세를 읽을 때 해시한 바이트를 임시 사본에 써서 그 자리를 넘긴다 —
  // 빌더가 그 파일을 고쳐도 원본은 그대로이고, 사본이 바뀌면 짓기 뒤에 멈춘다. 기록에는 원래 경로로 적는다.
  const 입력사본 = new Map();
  fs.rmSync(path.join(임시, '입력'), { recursive: true, force: true, maxRetries: 3 });   // 짓기마다 새로 뜬다 — 앞 빌드가 남긴 곁 파일을 다음 빌드가 읽지 않게(GPT -d GD5)
  for (const [n, d] of 정보.대본.filter(x => x.역할 === '입력').entries()) {
    const 곳 = path.join(임시, '입력', String(n + 1), path.basename(d.경로));
    fs.mkdirSync(path.dirname(곳), { recursive: true });
    fs.writeFileSync(곳, d.바이트);
    입력사본.set(경로열쇠(d.경로), { 곳, d });
  }
  const 인자바꿈 = a => (path.isAbsolute(a) && 입력사본.has(경로열쇠(a)) ? 입력사본.get(경로열쇠(a)).곳 : a);
  const 인자보임 = a => { for (const { 곳, d } of 입력사본.values()) if (같은경로(path.resolve(a), path.resolve(곳))) return d.경로; return a; };
  try {
    const 되돌림대본 = 되돌림 ? 정보.대본.find(d => d.역할 === '되돌림') : null;
    if (되돌림대본) { 알리기(`생성물: ${머리}되돌림 대본 ${path.basename(되돌림대본.경로)}`); 돌리기(`${머리}되돌림`, [대본실행곳(되돌림대본), 사본], 사본, 기록, { 시간 }); }
    그때?.();
    for (const d of 정보.대본.filter(x => 준비함 && x.역할 === '준비')) { 알리기(`생성물: ${머리}준비 대본 ${path.basename(d.경로)}`); 돌리기(`${머리}준비`, [대본실행곳(d), 사본], 사본, 기록, { 시간 }); }
    if (입력그때) 입력그때(입력지도(사본, 명세.꺼냄));
    for (const b of 명세.빌더) {
      const 대본 = path.join(사본, b.명령[0]);
      // 빌더 대본 경로의 마디에 링크가 있으면 사본 밖 대본을 돌리게 된다(그 대본이 제 곁에 캐시를 쓰면 사본 밖에 쓴다) — 멈춘다(GPT -d GD2).
      const 대본마디 = 링크마디(사본, b.명령[0]);
      if (대본마디) throw new Error(`빌더 대본 경로에 링크가 있다: ${b.명령[0]}(${대본마디}) — 사본 밖 대본을 돌리지 않게 멈춘다`);
      if (!fs.existsSync(대본)) throw new Error(`빌더 대본이 사본에 없다: ${b.명령[0]}`);
      알리기(`생성물: ${머리}빌더 ${b.명령.join(' ')}`);
      돌리기(`${머리}빌더`, [대본, ...b.명령.slice(1).map(인자바꿈)], 사본, 기록, { 실패해도: b.실패해도, 까닭: b.까닭, 시간, 보임: 인자보임 });
    }
  } finally {
    const 바뀐입력 = [...입력사본.values()].filter(({ 곳, d }) => { try { return sha(fs.readFileSync(곳)) !== d.sha256; } catch { return true; } }).map(({ d }) => d.경로);
    // 빌드가 입력 사본 폴더에 다른 파일(입력 옆 캐시 등)을 만들었으면 다음 빌드가 그 파일을 읽을 수 있다 — 멈춘다(GPT -d GD5).
    const 둔것 = new Set([...입력사본.values()].flatMap(({ 곳 }) => [경로열쇠(곳), 경로열쇠(path.dirname(곳))]));
    const 곁 = 폴더안(path.join(임시, '입력')).filter(p => !둔것.has(경로열쇠(p)));
    if (곁.length) throw Object.assign(new Error(`${머리}대본 · 빌더가 입력 사본 폴더에 다른 파일을 만들었다: ${곁.slice(0, 3).map(p => 슬래시(path.relative(임시, p))).join(', ')} — 다음 빌드가 그 파일을 읽을 수 있어 멈춘다`), { 잇기위반: true });
    if (바뀐입력.length) throw Object.assign(new Error(`${머리}대본 · 빌더가 입력 파일 사본에 썼다: ${바뀐입력.join(', ')} — 원본은 임시 사본으로 넘겨 그대로지만, 입력을 고치는 빌드는 재현을 믿을 수 없다`), { 잇기위반: true });
    const 바뀐 = 명세.잇기.filter((l, n) => 폴더지문(이은곳들[n], { 내용: true }) !== 기준지문[n]).map(l => l.경로);
    if (바뀐.length) throw Object.assign(new Error(`${머리}대본 · 빌더가 이은 폴더에 썼다: ${바뀐.join(', ')} — 공용 원본은 임시 사본으로 이어 그대로지만, 그 사본을 이 준비의 다른 빌드(바탕 · 짝 · 반사실)와 나눠 써 재현을 믿을 수 없다. 이은 폴더에 쓰지 않는 빌더로 고치거나 그 폴더를 잇지 않는다`), { 잇기위반: true });
  }
  입력확인(정보, `${머리}짓기 뒤:`);
}
/** 대본 고정(GPT GB4): 되돌림 · 준비 대본은 명세를 읽을 때 해시한 바이트를 임시 폴더에 써 두고 그것을 돌린다 — 빌드 사이에 원래 자리의 대본이
 *  바뀌어도 증명에 묶인 코드만 돈다. 대본은 node 내장만 부르는 한 파일이어야 한다(옆 파일을 상대 경로로 부르면 고정한 자리에서 찾지 못해 멈춘다).
 *  .js 대본은 원래 자리의 가장 가까운 package.json의 type을 따라 간다. */
function 대본고정(임시, 정보) {
  for (const [n, d] of 정보.대본.entries()) {
    if (!['되돌림', '준비'].includes(d.역할)) continue;
    const 바이트 = d.바이트 ?? Buffer.from(d.글, 'utf8');
    if (sha(바이트) !== d.sha256) throw new Error(`${d.역할} 대본의 바이트가 명세를 읽을 때와 다르다: ${d.경로}`);
    const 곳 = path.join(임시, '대본', String(n));
    fs.mkdirSync(곳, { recursive: true });
    if (/\.js$/i.test(d.경로)) {
      let 위 = path.dirname(path.resolve(d.경로)), 꼴 = null;
      for (;;) { const p = path.join(위, 'package.json'); if (fs.existsSync(p)) { try { 꼴 = JSON.parse(fs.readFileSync(p, 'utf8')).type ?? null; } catch { 꼴 = null; } break; } const 다음 = path.dirname(위); if (다음 === 위) break; 위 = 다음; }
      if (꼴 === 'module') fs.writeFileSync(path.join(곳, 'package.json'), '{"type":"module"}\n');
    }
    const 실행 = path.join(곳, path.basename(d.경로));
    fs.writeFileSync(실행, 바이트);
    Object.defineProperty(d, '실행경로', { value: 실행, configurable: true });
  }
}
const 대본실행곳 = d => { if (!d.실행경로 || sha(fs.readFileSync(d.실행경로)) !== d.sha256) throw new Error(`${d.역할} 대본을 고정한 사본이 없거나 바뀌었다: ${d.경로}`); return d.실행경로; };
const 설정꼴 = rel => /(^|\/)(package\.json|tsconfig[^/]*\.json|jsconfig[^/]*\.json|\.npmrc|\.browserslistrc)$/.test(rel);
/** 빌더가 부르는 파일(Opus F3) — 빌더 대본과 그 상대 가져오기(import · export from · import() · require)를 따라간 닫힌 모음, 빌더 인자가 가리키는 사본 안
 *  파일. 사본 상대 경로 집합(꺼냄 안 · 링크 밖만). 동적으로 읽는 파일은 모른다 — 그 파일의 차이는 경로 목록에 남고 반사실 빌드가 잡는다. */
function 빌더파일모음(사본, 빌더들, 꺼냄) {
  const s = new Set(), 볼 = [];
  const 있는파일 = r => 상대경로인가(r) && 꺼냄.some(x => 안인가(r, x)) && !링크마디(사본, r) && fs.existsSync(path.join(사본, r)) && fs.statSync(path.join(사본, r)).isFile();
  const 넣기 = 꼴들 => { const r = 꼴들.map(x => path.posix.normalize(슬래시(x))).find(있는파일); if (r && !s.has(r)) { s.add(r); 볼.push(r); } };
  for (const b of 빌더들) { 넣기([b.명령[0]]); for (const a of b.명령.slice(1)) for (const v of [a, ...(a.includes('=') ? [a.slice(a.indexOf('=') + 1)] : [])]) if (!절대인가(v)) 넣기([v]); }
  const 가져옴 = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])(\.{1,2}\/[^'"\n]+)\1/g;
  while (볼.length) {
    const rel = 볼.pop();
    if (!/\.(?:mjs|cjs|js|jsx|ts|tsx|mts|cts)$/.test(rel)) continue;
    const 글 = fs.readFileSync(path.join(사본, rel), 'utf8'), 곳 = path.posix.dirname(rel);
    for (const m of 글.matchAll(가져옴)) {
      const 뜻 = path.posix.join(곳, m[2]);
      넣기([뜻, ...['.mjs', '.js', '.cjs', '.json', '.ts'].map(e => `${뜻}${e}`), ...['index.mjs', 'index.js', 'index.cjs'].map(e => `${뜻}/${e}`)]);
    }
  }
  return s;
}
/** 폴더 지문 — 안의 모든 항목(링크는 따라가지 않고 가리키는 곳을 적는다)의 상대 경로 · 크기 · 고친 때를 모은 sha256. 내용이면 파일 바이트의 해시도 넣는다. */
const 잇기기준 = new Map();   // `${임시}\0${잇기 경로}` → 잇기 사본의 내용 지문(뜬 직후)
function 폴더지문(뿌리, { 내용 = false } = {}) {
  const 줄 = [];
  const 걷기 = rel => {
    const abs = rel ? path.join(뿌리, rel) : 뿌리;
    let st;
    try { st = fs.lstatSync(abs); } catch { 줄.push(`${rel}\t없음`); return; }
    if (st.isSymbolicLink()) { let t = ''; try { t = fs.readlinkSync(abs); } catch { /* 읽지 못한 링크 */ } 줄.push(`${rel}\t링크\t${t}`); return; }
    if (st.isDirectory()) { 줄.push(`${rel}\t폴더`); for (const n of fs.readdirSync(abs).sort()) 걷기(rel ? `${rel}/${n}` : n); return; }
    줄.push(`${rel}\t${st.size}\t${st.mtimeMs}${내용 ? `\t${sha(fs.readFileSync(abs))}` : ''}`);
  };
  걷기('');
  return sha(줄.join('\n'));
}

/** 다시 짓고 후보와 견준다. 다르거나 단계가 실패하면 사본을 남기고 던진다(경로를 알린다).
 *  바탕 재현(설계 주인 11-21): 라이브 판(앞판)이 항목의 바탕 커밋에서 다시 지어지는지도 본다. 지어지지 않으면 원천 차이(바탕 → 후보 원천)가
 *  실제로 나가는 바이트 차이(라이브 → 후보)를 다 말하지 못하므로, 그 항목은 바탕재현 false로 적고 검수 묶음에 본문 차이를 싣는다. 바탕 빌드가
 *  실패해도 준비는 막지 않는다(그 항목이 본문 차이로 간다). 라이브에 없는 항목도 본문으로 간다.
 *  돌려주는 것: { 원천, 결과[], 기록[], 바탕기록[], 원천차이[], 되돌림차이[] }. */
export function 생성물재현(정보, { 저장소, 후보, 후보내용, 앞판 = null, 알리기 = () => {}, 시간 = 기본시간 } = {}) {
  const 명세 = 정보.명세;
  저장소 = path.resolve(명세.원천저장소 || 저장소);
  const 원천 = 커밋확인(저장소, 명세.원천);
  const 후보항목 = new Map((후보?.항목 || []).map((f, i) => [f.경로, { f, b: 후보내용?.[i] }]));
  for (const it of 명세.항목) {
    const x = 후보항목.get(it.경로);
    if (!x) throw new Error(`생성물 항목이 배포 후보에 없다: ${it.경로}`);
    if (x.f.sha256 == null || !Buffer.isBuffer(x.b) || sha(x.b) !== x.f.sha256) throw new Error(`생성물 항목의 후보 바이트가 없거나 후보.json과 다르다: ${it.경로}`);
  }
  const 바탕들 = new Map(명세.항목.map(it => [it.경로, 커밋확인(저장소, it.바탕)]));
  // 명세 경로의 철자(GPT -c GD12) · 되돌림 목록의 병합 커밋(GD13)은 도구가 다루지 않는 꼴이라 멈춘다(설계 주인 11-21).
  const 원천경로모두 = [...new Set(명세.항목.flatMap(it => it.원천경로))];
  철자확인(저장소, 원천, [...명세.꺼냄, ...원천경로모두, ...명세.원천뺌]);
  for (const b of new Set(바탕들.values())) 철자확인(저장소, b, [...명세.꺼냄, ...명세.항목.filter(it => 바탕들.get(it.경로) === b).flatMap(it => it.원천경로)]);
  for (const c of 명세.되돌림?.목록 || []) {
    const 부모 = git(저장소, ['rev-list', '--parents', '-n', '1', 커밋확인(저장소, c)]).trim().split(/\s+/).length - 1;
    if (부모 > 1) throw new Error(`되돌림 목록에 병합 커밋이 있다: ${c.slice(0, 10)}(부모 ${부모}) — 어느 부모로 되돌리는지 증명에 없어 받지 않는다(도구가 다루지 않는 꼴)`);
  }
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-gen-')), 사본 = path.join(임시, 'export'), 빈 = path.join(임시, 'empty');
  fs.writeFileSync(빈, '');
  const 링크 = [], 기록 = [], 바탕기록 = [];
  let 남김 = false;
  try {
    // 잇기 원본은 임시 사본으로 떠서 잇고, 되돌림 · 준비 대본은 해시한 바이트로 고정해 돌린다(GPT GA1 · GB4).
    잇기뜨기(임시, 저장소, 명세.잇기, 알리기);
    대본고정(임시, 정보);
    알리기(`생성물: 원천 ${원천.slice(0, 10)}을 임시 사본으로 꺼낸다(${임시})`);
    // 원천 차이는 되돌린 뒤 · 준비와 빌더 전의 사본으로 뜬다 — 빌더가 쓴 파일이 섞이지 않게.
    const 원천차이 = [], 본 = new Map(), J = JSON모음만들기();
    const 차이뜨기 = () => {
      for (const it of 명세.항목) {
        const 바탕 = 바탕들.get(it.경로), 열쇠 = JSON.stringify([바탕, it.원천경로]);
        if (!본.has(열쇠)) {
          const 곳 = path.join(임시, `base-${본.size + 1}`);
          꺼내기(저장소, 바탕, it.원천경로, 곳, 임시, { 빈것허용: true });
          본.set(열쇠, { 바탕, 원천경로: it.원천경로, 항목: [], ...원천차이만들기(곳, 사본, it.원천경로, 명세.원천뺌, 빈, J) });
          원천차이.push(본.get(열쇠));
        }
        본.get(열쇠).항목.push(it.경로);
      }
    };
    // 모듈 대조 항목: 후보 묶음에 든 모듈의 원천을 되돌린 뒤 · 빌더 전에 떠 둔다(원천 차이 · 후보에만 모듈의 출처 줄에 쓴다).
    const 원천본 = new Map();
    const 원천본뜨기 = () => {
      for (const it of 명세.항목.filter(x => x.대조 === '모듈')) {
        for (const x of 모듈나누기(후보항목.get(it.경로).b) || []) {
          const p = 경로만(x.이름);
          if (p.startsWith('(') || 원천본.has(p) || !상대경로인가(p) || 명세.잇기.some(l => 파일안인가(p, l.경로))) continue;
          const 곳 = path.join(사본, p);
          if (!링크마디(사본, p) && fs.existsSync(곳) && fs.statSync(곳).isFile()) 원천본.set(p, fs.readFileSync(곳));
        }
      }
      // 문자열 대조 항목: 까닭 무리가 댄 파일도 같은 때 떠 둔다(소속 확인은 되돌린 뒤 후보 원천에서 한다 — 꺼냄 밖 파일만 원천 커밋에서 읽는다).
      // 꺼냄 안인데 사본에 없는 파일(되돌림이 지운 파일)은 「없음」(null)으로 적는다 — 원천 커밋 판으로 대신 읽지 않는다(GPT GB12).
      for (const it of 명세.항목.filter(x => x.대조 === '문자열')) {
        const 파일들 = Object.values(정보.까닭.get(it.경로)?.무리 ?? {}).flatMap(g => g.파일);
        for (const p of 파일들) {
          if (원천본.has(p)) continue;
          const 곳 = path.join(사본, p);
          if (!링크마디(사본, p) && fs.existsSync(곳) && fs.statSync(곳).isFile()) 원천본.set(p, fs.readFileSync(곳));
          else if (명세.꺼냄.some(x => 안인가(p, x))) 원천본.set(p, null);
        }
      }
    };
    // 빌드 입력(Opus F3 · F4): 빌더가 돌기 직전(되돌림 · 준비 뒤) 꺼냄 파일의 지도를 빌드마다 잰다. 빌더가 부르는 파일과 설정 파일은 글을 떠 둔다(차이를 싣는다).
    let 후보지도 = null, 빌더파일 = new Set();
    const 후보설정글 = new Map();
    짓기({ 저장소, 커밋: 원천, 사본, 임시, 정보, 링크, 기록, 그때: () => { 차이뜨기(); 원천본뜨기(); }, 시간, 알리기, 입력그때: m => {
      후보지도 = m;
      빌더파일 = 빌더파일모음(사본, 명세.빌더, 명세.꺼냄);
      for (const rel of m.keys()) if (빌더파일.has(rel) || 설정꼴(rel)) 후보설정글.set(rel, fs.readFileSync(path.join(사본, rel)));
    } });
    const 결과 = 명세.항목.map(it => {
      const 재현 = 만든sha(사본, it.만든곳), 후보sha256 = 후보항목.get(it.경로).f.sha256;
      return { 경로: it.경로, 만든곳: it.만든곳, 바탕: 바탕들.get(it.경로), 후보sha256, 재현sha256: 재현, 같음: 재현 === 후보sha256 };
    });
    const 다름 = 결과.filter(r => !r.같음);
    if (다름.length) throw new Error(`생성물 재현이 후보와 다르다 — ${다름.map(r => `${r.경로}: 후보 ${r.후보sha256.slice(0, 12)} · 재현 ${r.재현sha256 ? r.재현sha256.slice(0, 12) : '없음'}`).join(' / ')}`);
    // 머리곳(GPT 다시 검수 GC3): 이 빌드가 사본에서 지은 중간 묶음 — 짓기 전에 지웠으므로 있으면 이번 빌더가 쓴 것이다. 그 머리가 문자열 대조의 입력 목록이다.
    const 머리본 = new Map();
    for (const it of 명세.항목.filter(x => x.머리곳)) {
      const 곳 = path.join(사본, it.머리곳);
      if (링크마디(사본, it.머리곳) || !fs.existsSync(곳) || !fs.statSync(곳).isFile()) throw new Error(`머리곳 ${it.머리곳}을 빌드가 짓지 않았다(${it.경로}) — 머리 입력 목록을 읽을 중간 묶음이 없다`);
      머리본.set(it.경로, fs.readFileSync(곳));
    }
    // 바탕 재현 — 바탕 커밋마다 한 번 짓는다(되돌림 없이). 다 본 바탕 사본은 바로 걷는다(공개 빌드는 크다).
    const 바탕결과 = new Map(), 바탕묶음 = new Map(), 바탕출력 = new Map(), 바탕지도 = new Map(), 바탕설정글 = new Map();
    for (const it of 명세.항목) {
      const 라이브 = 앞판?.get(it.경로);
      if (!Buffer.isBuffer(라이브)) { 바탕결과.set(it.경로, { 라이브sha256: null, 바탕재현sha256: null, 바탕재현: false, 바탕까닭: '라이브에 없음' }); continue; }
      const b = 바탕들.get(it.경로);
      (바탕묶음.get(b) || 바탕묶음.set(b, []).get(b)).push(it);
    }
    let k = 0;
    for (const [바탕, 항목들] of 바탕묶음) {
      const 곳 = path.join(임시, `base-build-${++k}`), 바탕링크 = [];
      알리기(`생성물: 바탕 ${바탕.slice(0, 10)}에서 라이브 판을 다시 짓는다(${항목들.map(x => x.경로).join(', ')})`);
      let 실패 = null;
      const 앞수 = 바탕기록.length;
      const 입력그때 = m => {
        바탕지도.set(바탕, m);
        const 글 = new Map();
        // 바탕 빌더가 부르는 파일도 모은다 — 후보에서 사라진 가져오기(legacy.mjs)도 바탕 출력을 만든 코드다(GPT -c GD15).
        const 바탕빌더파일 = 빌더파일모음(곳, 명세.빌더, 명세.꺼냄);
        for (const rel of m.keys()) if ((빌더파일.has(rel) || 바탕빌더파일.has(rel) || 설정꼴(rel)) && m.get(rel) !== 후보지도.get(rel)) 글.set(rel, fs.readFileSync(path.join(곳, rel)));
        바탕설정글.set(바탕, 글);
      };
      try { 짓기({ 저장소, 커밋: 바탕, 사본: 곳, 임시, 정보, 링크: 바탕링크, 기록: 바탕기록, 되돌림: false, 시간, 알리기, 머리: `바탕 ${바탕.slice(0, 10)} `, 입력그때 }); }
      catch (e) { if (e?.잇기위반) throw e; 실패 = String(e.message).split('\n')[0].slice(0, 300); }   // 잇기 위반은 보통 실패로 삼키지 않는다(GPT GB3)
      // 실패해도 되는 단계가 바탕 빌드에서 0 아닌 종료로 끝났으면 출력이 덜 쓰였을 수 있다 — 재현이 안 될 때 까닭에 그 단계를 밝힌다.
      const 덜끝남 = 바탕기록.slice(앞수).filter(x => x.종료 !== 0).map(x => `${x.명령.replace(/^node <사본>\//, '').slice(0, 80)} 종료 ${x.종료}`);
      for (const it of 항목들) {
        const 라이브sha256 = sha(앞판.get(it.경로)), 바탕재현sha256 = 실패 ? null : 만든sha(곳, it.만든곳), 바탕재현 = 바탕재현sha256 !== null && 바탕재현sha256 === 라이브sha256;
        const 다름까닭 = 덜끝남.length ? `라이브와 다름 — 바탕 빌드에서 0 아닌 종료: ${덜끝남.join(', ')}` : '라이브와 다름';
        바탕결과.set(it.경로, { 라이브sha256, 바탕재현sha256, 바탕재현, 바탕까닭: 실패 ? `바탕 빌드 실패 — ${실패}` : 바탕재현 ? '같음' : 바탕재현sha256 ? 다름까닭 : '만든 파일 없음' });
        if (it.대조 === '모듈' && 바탕재현sha256) 바탕출력.set(it.경로, fs.readFileSync(path.join(곳, it.만든곳)));
      }
      try { 링크걷기(바탕링크); fs.rmSync(곳, { recursive: true, force: true, maxRetries: 3 }); } catch { 링크.push(...바탕링크); }
    }
    for (const r of 결과) Object.assign(r, 바탕결과.get(r.경로));
    // 원천경로 밖 빌드 입력(Opus F3): 바탕 사본과 후보 사본(되돌림 · 준비 뒤)의 꺼냄 파일이 원천경로 밖에서 다르면 원천 차이에 그 목록을 단다.
    for (const d of 원천차이) {
      const a = 바탕지도.get(d.바탕);
      if (!a || !후보지도) continue;
      const 바뀐 = 지도차이(a, 후보지도, rel => !원천안(rel, d.원천경로, 명세.원천뺌));
      if (바뀐.length) d.입력 = { 바뀐, 앞: a, 바탕글: 바탕설정글.get(d.바탕) ?? new Map(), 반사실: [] };
    }
    // 반사실 빌드: 바탕 재현이 같아 원천 차이로 본문을 대신하는 항목은, 원천경로 밖 입력을 바탕 판으로 둔 채 후보 원천경로로 다시 지어 후보와
    // 같아야 원천 차이가 출력 변경을 다 말한다. 다르거나 지어지지 않으면 그 항목을 바탕재현 false로 돌린다(본문 차이 · 대조로 검수한다).
    // 입력 지도가 같아도 늘 짓는다(설계 검토 F4 · GPT GB5 · GB6) — 지도에 없는 입력(도구가 쓰는 EXPORT_COMMIT · 꺼냄 밖 파일)도 출력을 바꿀 수 있다.
    let 반수 = 0;
    for (const d of 원천차이) {
      const 걸린 = 결과.filter(r => d.항목.includes(r.경로) && r.바탕재현 === true);
      if (!걸린.length) continue;
      const 곳 = path.join(임시, `counter-build-${++반수}`), 반링크 = [], 밖수 = d.입력?.바뀐.length ?? 0;
      d.반사실 = [];
      if (d.입력) d.입력.반사실 = d.반사실;
      알리기(`생성물: 바탕 판(원천경로 밖 입력 ${밖수 ? `${밖수}개가 다름` : '지도는 같음'})에 후보 원천경로를 덮어 다시 짓는다(${걸린.map(r => r.경로).join(', ')})`);
      let 실패 = null;
      try { 짓기({ 저장소, 커밋: d.바탕, 사본: 곳, 임시, 정보, 링크: 반링크, 기록: 바탕기록, 되돌림: false, 그때: () => 원천덮기(곳, d.원천경로, 명세.원천뺌, d.원천글), 시간, 알리기, 머리: `반사실 ${d.바탕.slice(0, 10)} ` }); }
      catch (e) { if (e?.잇기위반) throw e; 실패 = String(e.message).split('\n')[0].slice(0, 300); }
      for (const r of 걸린) {
        const s = 실패 ? null : 만든sha(곳, r.만든곳), 같음 = s !== null && s === r.후보sha256;
        d.반사실.push({ 경로: r.경로, sha256: s, 같음, ...(실패 ? { 실패 } : {}) });
        r.입력반사실 = 같음 ? '같음' : '다름';
        const 값 = `바탕 판 입력 + 후보 원천경로로 지으면 sha256 ${s ? s.slice(0, 12) : '없음'} · 후보 ${r.후보sha256.slice(0, 12)}`;
        if (!같음) Object.assign(r, { 바탕재현: false, 바탕까닭: 밖수
          ? (실패 ? `원천경로 밖 빌드 입력 ${밖수}개를 바탕 판으로 두면 지어지지 않는다 — ${실패}` : `원천경로 밖 빌드 입력 ${밖수}개가 출력을 바꾼다(${값})`)
          : (실패 ? `바탕 판에 후보 원천경로를 덮으면 지어지지 않는다 — ${실패}` : `입력 지도에 없는 빌드 입력(도구가 쓰는 파일 · 꺼냄 밖 파일)이 출력을 바꾼다(${값})`) });
      }
      try { 링크걷기(반링크); fs.rmSync(곳, { recursive: true, force: true, maxRetries: 3 }); } catch { 링크.push(...반링크); }
    }
    const 대조자료 = 대조하기({ 정보, 저장소, 원천, 결과, 후보항목, 앞판, 바탕들, 바탕출력, 원천본, 머리본, 임시, 빈, 링크, 바탕기록, 시간, 알리기, J });
    // 모듈 대조로 대신한 항목만 쓰는 원천 차이(G1…)의 원천 쪽은 묶음에 싣지 않는다 — 모듈 원천 차이(G3…)가 같은 것을 모듈별로 싣는다(설계 주인 11-21).
    // 원천경로 밖 빌드 입력 차이는 늘 싣는다(Opus F3). 증거 파일(원천차이-n.patch)은 그대로 쓴다.
    const 대조로 = p => 명세.항목.find(x => x.경로 === p)?.대조 === '모듈' && 결과.find(x => x.경로 === p)?.대조?.꼴 === '모듈';
    const 실은차글 = new Map();
    for (const [i, d] of 원천차이.entries()) {
      d.원천실림 = d.항목.some(p => !대조로(p));
      // 모듈 대조만 쓰는 원천 차이도 원천경로 안 · 묶음 모듈이 아닌 파일(설정 · 곁 파일)의 차이는 싣는다(설계 검토 F1) — G3은 묶음 모듈만 싣는다.
      if (!d.원천실림) {
        const 묶인 = new Set(d.항목.flatMap(p => 대조자료.get(p)?.모듈들 ?? [])), xs = d.조각들.filter(x => !묶인.has(x.rel));
        d.비모듈수 = xs.length; d.비모듈글 = xs.map(x => x.글).join('\n');
      }
      d.실림 = d.원천실림 || !!d.입력 || !!d.비모듈글;
      if (d.입력) { Object.assign(d, 입력글들(d, 후보지도, 후보설정글, 빌더파일, 임시, 빈, 실은차글, `G1${i}`)); d.입력 = { 바뀐: d.입력.바뀐, 반사실: d.입력.반사실 }; }
    }
    const JSON차이 = JSON마무리(J, 원천차이, 대조자료, 알리기);
    const 원천모두 = [...new Set(명세.항목.flatMap(it => it.원천경로))].sort();
    // 되돌림 목록(Opus F3): 그 커밋이 원천경로에서 바꾼 것과 함께, 원천경로 밖(꺼냄 안)에서 바꾼 파일 목록 · 빌더가 부르는 파일과 설정 파일의 차이를 싣는다.
    const 되돌림차이 = (명세.되돌림?.목록 || []).map(c => {
      const 커밋 = 커밋확인(저장소, c);
      // 머리줄은 따옴표 꼴이 아니어야 하고(차이머리확인 · GPT -e F1), CR은 ␍로 보인다(GPT -e GF2).
      const 안 = 차이머리확인(git(저장소, ['show', '--no-color', '--no-ext-diff', '--format=%H%n%s%n', '-U3', 커밋, '--', ...원천모두]).replace(/\r/g, '␍'), `되돌림 ${커밋.slice(0, 10)}`);
      const 밖 = 이름상태(git(저장소, ['show', '--no-color', '--format=', '--name-status', '-z', '--no-renames', 커밋, '--', ...명세.꺼냄]))
        .filter(([s, p]) => s && p && !원천안(p, 원천모두, 명세.원천뺌));
      const 보일 = 밖.map(([, p]) => p).filter(p => 빌더파일.has(p) || 설정꼴(p));
      const 밖글 = 밖.length ? ['', `## 이 커밋이 원천경로 밖(꺼냄 안 — 빌드 입력)에서 바꾼 파일 ${밖.length}개 · 빌더가 부르는 파일과 설정 파일 ${보일.length}개는 차이를 싣는다`, ...밖.map(([s, p]) => `- ${s} ${p}`),
        ...(보일.length ? ['', 차이머리확인(git(저장소, ['show', '--no-color', '--no-ext-diff', '--format=', '-U3', 커밋, '--', ...보일]).replace(/\r/g, '␍'), `되돌림 ${커밋.slice(0, 10)} 빌드 입력`)] : [])].join('\n') : '';
      return { 커밋, 글: `${안}${밖글}`.replace(메일, '<메일>'), ...(밖.length ? { 밖: 밖.length } : {}) };
    });
    return { 원천, 결과, 기록, 바탕기록, 원천차이, 되돌림차이, 대조자료, JSON차이 };
  } catch (e) {
    남김 = true;
    throw Object.assign(new Error(`${e.message}\n(재현 사본을 남겼다: ${사본})`), { 사본 });
  } finally {
    let 걷힘 = true;
    for (const k of [...잇기기준.keys()]) if (k.startsWith(`${임시}\0`)) 잇기기준.delete(k);
    try { 링크걷기(링크); } catch (e) { 걷힘 = false; 알리기(`잇기를 걷지 못해 임시 폴더를 남긴다: ${임시} — ${e.message}`); }
    if (걷힘 && !남김) fs.rmSync(임시, { recursive: true, force: true, maxRetries: 3 });
  }
}

// ── 모듈 나누기(설계 주인 11-21) ────────────────────────────────────
// 바탕 재현이 안 된 묶음은 esbuild 모듈 표지(`// <경로>` 줄)로 나눠 경로끼리 견준다(아래 묶음 대조). 첫 표지 앞은 「(머리)」, 끝의
// export 덩이는 「(꼬리)」 조각이다(모듈 밖 이음 글). 조각을 차례로 이으면 원래 바이트와 같아야 한다 — 덮음은 나누기와 따로 조각덮음이 본다.
// 표지 뒤의 ?v= 같은 물음 글도 표지다(journeys.mjs?v=… — 같은 파일의 다른 판). 경로별로 모을 때 물음 글을 뗀다.
const 표지줄 = /^\/\/ ((?:[\w@.+-]+\/)+[\w@.+-]+\.(?:mjs|cjs|js|json|css|jsx|ts|tsx)(?:\?[\w@.=&%+-]*)?)$/;
/** 바이트를 모듈 조각으로 — [{ 이름, 시작, 끝, sha256 }](바이트 위치). 표지가 둘 미만이거나 손실 없는 UTF-8이 아니면 null. */
export function 모듈나누기(b) {
  const 글 = b.toString('utf8');
  if (!Buffer.from(글, 'utf8').equals(b)) return null;
  const 자리 = [];   // [바이트 위치, 이름]
  let 위치 = 0;
  for (const 줄 of 글.split(/(?<=\n)/)) {
    const m = 표지줄.exec(줄.replace(/\r?\n$/, ''));
    if (m) 자리.push([위치, m[1]]);
    위치 += Buffer.byteLength(줄, 'utf8');
  }
  if (자리.length < 2) return null;
  const 셈 = new Map(), 조각 = [];
  const 넣기 = (이름, 시작, 끝) => { if (끝 > 시작) 조각.push({ 이름, 시작, 끝, sha256: sha(b.subarray(시작, 끝)) }); };
  넣기('(머리)', 0, 자리[0][0]);
  for (const [k, [시작, 경로]] of 자리.entries()) {
    const n = (셈.get(경로) || 0) + 1; 셈.set(경로, n);
    const 이름 = n > 1 ? `${경로}#${n}` : 경로, 끝 = k + 1 < 자리.length ? 자리[k + 1][0] : b.length;
    if (k + 1 === 자리.length) {
      // 끝 모듈 뒤의 export 덩이는 꼬리 조각으로 뗀다(바뀌어도 그 모듈의 변경으로 보이지 않게)
      const 꼬리 = 글.lastIndexOf('\nexport {'), 꼬리바이트 = 꼬리 < 0 ? -1 : Buffer.byteLength(글.slice(0, 꼬리 + 1), 'utf8');
      if (꼬리바이트 > 시작) { 넣기(이름, 시작, 꼬리바이트); 넣기('(꼬리)', 꼬리바이트, 끝); continue; }
    }
    넣기(이름, 시작, 끝);
  }
  return 조각;
}
/** 조각이 바이트를 빠짐없이 차례로 덮고 해시가 맞는지 — 나누기와 따로 본다(「이음 글 조각 뺌」 같은 빠짐을 잡는다). */
export function 조각덮음(b, 조각) {
  if (!Array.isArray(조각) || !조각.length) return false;
  let 끝 = 0;
  for (const x of 조각) {
    if (x.시작 !== 끝 || !(x.끝 > x.시작) || sha(b.subarray(x.시작, x.끝)) !== x.sha256) return false;
    끝 = x.끝;
  }
  return 끝 === b.length;
}
// ── 같은 코드 · 묶음 대조 · 문자열 대조(설계 주인 11-21 답) ─────────────────────
const 도구저장소 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let 빌드기;
/** 공백 줄이기 — esbuild로 읽어 공백 없이 다시 찍는다(주석도 빠진다, 묶음 빌더와 같은 esbuild를 찾는다). 읽지 못한 글은 null.
 *  증거에 싣는 정리한 모듈 글(문장줄)에만 쓴다 — 같은 코드 판정은 acorn 구문 나무로 한다. */
function 줄이기(글) {
  if (빌드기 === undefined) {
    try { const req = createRequire(import.meta.url); 빌드기 = req(req.resolve('esbuild', { paths: [path.join(도구저장소, 'experiences/synk-account'), 도구저장소] })); } catch { 빌드기 = null; }
  }
  if (!빌드기) throw new Error('정리한 모듈 글을 찍을 esbuild가 없다(experiences/synk-account나 저장소 루트의 node_modules)');
  try { return 빌드기.transformSync(글, { minifyWhitespace: true, legalComments: 'none', loader: 'js', charset: 'utf8' }).code; } catch { return null; }
}
const 이름꼴 = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;
const 낱말머리 = /^[\p{L}_$][\p{L}\p{N}_$]*|^\d[\w.]*/u;
const 앞말 = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const 정규식자리 = t => t == null || 앞말.has(t) || (!이름꼴.test(t) && !/^\d/.test(t) && t !== ')' && t !== ']' && t !== '++' && t !== '--' && !/^["'`]/.test(t) && !t.startsWith('T:'));
// 여러 글자 연산자는 가장 길게 한 낱말로 읽는다(GPT GB7: 「x + ++y」와 「x++ + y」를 가른다). 「?.」 뒤가 숫자면 「?」와 「.5」다.
const 연산자들 = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '**'];
// 줄바꿈이 뜻을 바꾸는 자리(자동 쌍반점): 이 낱말 뒤 줄바꿈, 또는 줄바꿈 뒤 ++ · -- — 그 줄바꿈을 「⏎」 낱말로 남긴다.
const 줄바꿈뜻 = new Set(['return', 'throw', 'break', 'continue', 'yield', 'async', '++', '--']);
const 조건앞 = new Set(['if', 'for', 'while', 'with']);
/** 코드 낱말 — 공백 · 주석은 건너뛴다. 따옴표 글자 · 정규식은 한 낱말, 틀 글자는 「`」 · 「T:조각」 · 「${」 · 식의 낱말 · 「}$」로 나눈다.
 *  여러 글자 연산자는 한 낱말이고, 자동 쌍반점이 걸리는 줄바꿈은 「⏎」로 남긴다. */
export function 낱말나누기(s) {
  // 괄호: 연 「(」마다 if · for · while · with의 조건을 여는지 — 조건을 닫는 「)」 뒤의 「/」는 정규식이다(Opus F5 ②: if (a) /x/.test(s)).
  // 자리: 낱말마다 원문에서 시작한 글자 자리(숨은 칸 — 둘레 글을 그 낱말 자리에서 자른다 · GPT 다시 검수 GC7).
  const out = [], 자리 = [], 틀 = [], 괄호 = []; let i = 0, 깊이 = 0, 줄바뀜 = false, 조건닫힘 = false;
  Object.defineProperty(out, '자리', { value: 자리 });
  const 밀기 = (t, k) => { out.push(t); 자리.push(k); };
  const 넣기 = t => {
    if (줄바뀜) { const 앞 = out[out.length - 1]; if (앞 !== undefined && (줄바꿈뜻.has(앞) || t === '++' || t === '--')) 밀기('⏎', i); 줄바뀜 = false; }
    if (t === '(') { const 앞 = out[out.length - 1], 점 = out[out.length - 2] === '.' || out[out.length - 2] === '?.'; 괄호.push(!점 && (조건앞.has(앞) || (앞 === 'await' && out[out.length - 2] === 'for'))); }
    else if (t === ')') 조건닫힘 = 괄호.pop() ?? false;
    밀기(t, i);
  };
  const 조각 = () => {
    let t = ''; const 앞 = i;
    while (i < s.length) {
      const c = s[i];
      if (c === '\\') { t += s.slice(i, i + 2); i += 2; continue; }
      if (c === '`') { 밀기(`T:${t}`, 앞); 밀기('`', i); i += 1; return; }
      if (c === '$' && s[i + 1] === '{') { 밀기(`T:${t}`, 앞); 밀기('${', i); i += 2; 틀.push(깊이); return; }
      t += c; i += 1;
    }
    밀기(`T:${t}`, 앞);
  };
  while (i < s.length) {
    const c = s[i];
    if (c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029') { 줄바뀜 = true; i += 1; continue; }
    if (c === ' ' || c === '\t' || c === '﻿') { i += 1; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i += 1; continue; }
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2), 끝 = e < 0 ? s.length : e + 2; if (/[\n\r\u2028\u2029]/.test(s.slice(i, 끝))) 줄바뀜 = true; i = 끝; continue; }
    if (c === '`') { 넣기('`'); i += 1; 조각(); continue; }
    if (c === '}' && 틀.length && 틀[틀.length - 1] === 깊이) { 틀.pop(); 넣기('}$'); i += 1; 조각(); continue; }
    if (c === '{') { 깊이 += 1; 넣기('{'); i += 1; continue; }
    if (c === '}') { 깊이 -= 1; 넣기('}'); i += 1; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < s.length && s[j] !== c && s[j] !== '\n') j += s[j] === '\\' ? 2 : 1; 넣기(s.slice(i, j + 1)); i = j + 1; continue; }
    if (c === '/' && (out[out.length - 1] === ')' ? 조건닫힘 : 정규식자리(out[out.length - 1]))) {
      let j = i + 1, 칸 = false, 맞음 = false;
      while (j < s.length) { const d = s[j]; if (d === '\\') { j += 2; continue; } if (d === '\n') break; if (칸) { if (d === ']') 칸 = false; } else if (d === '[') 칸 = true; else if (d === '/') { 맞음 = true; break; } j += 1; }
      if (맞음) { j += 1; while (/[a-z]/.test(s[j] ?? '')) j += 1; 넣기(s.slice(i, j)); i = j; continue; }
    }
    const m = 낱말머리.exec(s.slice(i, i + 256));
    if (m) { 넣기(m[0]); i += m[0].length; continue; }
    const 연 = 연산자들.find(o => s.startsWith(o, i) && !(o === '?.' && /\d/.test(s[i + 2] ?? '')));
    if (연) { 넣기(연); i += 연.length; continue; }
    넣기(c); i += 1;
  }
  return out;
}
/** esbuild가 짓는 이름 짝인가(Opus F2) — 글자가 같거나, 같은 원래 이름 o에 esbuild가 겹친 이름 뒤에 붙이는 수(2 이상 · 0으로 시작하지 않음)를
 *  붙인 꼴끼리다(o ↔ o2 · o2 ↔ o3 · sha1 ↔ sha12). 끝 숫자만 다른 다른 이름(sha1 ↔ sha256 · step1 ↔ step2)은 짝이 아니다. */
const 덧수 = s => s === '' || (/^[1-9]\d*$/.test(s) && s !== '1');
export function 이름짝인가(x, y) {
  if (x === y) return true;
  for (let k = 1; k <= Math.min(x.length, y.length) && x[k - 1] === y[k - 1]; k += 1) if (덧수(x.slice(k)) && 덧수(y.slice(k))) return true;
  return false;
}
// 메서드 · 게터 이름({ f(){…} } · get f(){…} · 클래스 몸의 f(){…})은 객체 열쇠처럼 글자 그대로다 — 이름 뒤 ( … ) 다음이 { 이고 앞이 아래 낱말일 때.
const 메서드앞 = new Set(['{', ',', '}', ';', 'get', 'set', 'static', 'async', '*']);
function 메서드이름(T, k) {
  if (T[k + 1] !== '(' || !메서드앞.has(T[k - 1])) return false;
  let d = 0;
  for (let m = k + 1; m < T.length; m += 1) { if (T[m] === '(') d += 1; else if (T[m] === ')') { d -= 1; if (d === 0) return T[m + 1] === '{'; } }
  return false;
}
/** 낱말마다 그것을 감싼 가장 안쪽 여는 괄호의 자리(「{」 · 「(」 · 「[」 · 틀 글자의 「${」, 없으면 -1). */
function 괄호자리(T) {
  const 쌓 = [], 열림 = new Array(T.length);
  for (let k = 0; k < T.length; k += 1) {
    const t = T[k];
    열림[k] = 쌓.length ? 쌓[쌓.length - 1] : -1;
    if (t === '{' || t === '(' || t === '[' || t === '${') 쌓.push(k);
    else if ((t === '}' || t === ')' || t === ']' || t === '}$') && 쌓.length) 쌓.pop();
  }
  return 열림;
}
/** 낱말마다 그것을 감싼 가장 안쪽 괄호(「{」 · 「(」 · 「[」 · 「${」, 없으면 null). */
const 감싼괄호 = (T, 열림 = 괄호자리(T)) => 열림.map(o => (o >= 0 ? T[o] : null));
/** 줄여 쓴 속성 자리 — 중괄호 바로 안에서 「{ 이름 ,」 · 「, 이름 }」처럼 쉼표 사이에 홀로 선 이름(객체 · 구조 분해 · 가져오기 · 내보내기 목록).
 *  배열 · 인자 · 변수 목록의 쉼표 사이 이름은 아니다. 문자열 대조가 속성 이름을 모을 때 쓴다. */
const 줄인속성 = (T, 안, k) => 안[k] === '{' && (T[k - 1] === '{' || T[k - 1] === ',') && (T[k + 1] === ',' || T[k + 1] === '}');

// ── 같은 코드(설계 검토 D2 · GPT 다시 검수 GB8~GB10 · 설계 주인 11-21) ──────────────────────────────
// 두 모듈 글을 acorn으로 ES 모듈 구문 나무로 읽어 견준다. 「같은 코드」는 묶인 이름만 일관되게 바꾼 같은 나무(알파 동치)다 —
// 묶인 이름: 조각 안에서 선언한 이름(범위를 따라 푼다), 조각 밖이면 묶음 맨 위에서 선언한 이름. 바꾼 이름은 esbuild 꼬리 짝이어야 하고
// 짝은 일대일이다. 전역 이름(묶음 어디에도 맨 위 선언이 없는 이름) · 속성 이름 · 열쇠 · 꼬리표 · 상수(값으로)는 그대로 같아야 한다.
// 묶음은 ES 모듈(.mjs)이라 엄격 모드 규칙으로 푼다. 읽지 못한 조각은 같은 코드가 아니다(바이트가 같아도 다른 조각 이름을 확인하지 못한다).
let 나무파서 = undefined, 나무판 = null, 에이콘 = null;
function 파서얻기() {
  if (나무파서 === undefined) {
    try {
      const req = createRequire(import.meta.url), acorn = req(req.resolve('acorn', { paths: [도구저장소] }));
      나무판 = acorn.version; 에이콘 = acorn;
      // 조각을 떼어 읽으면 다른 조각이 선언한 이름을 내보내는 export { … }가 「정의되지 않음」으로 걸린다 — 그 오류만 넘긴다.
      나무파서 = class extends acorn.Parser { raiseRecoverable(pos, msg) { if (/^Export '.+' is not defined$/.test(msg)) return; super.raiseRecoverable(pos, msg); } };
    } catch { 나무파서 = null; }
  }
  if (!나무파서) throw new Error('같은 코드 대조에 쓸 acorn이 없다(저장소 루트의 node_modules — package.json이 고정한 판)');
  return 나무파서;
}
/** 완성 묶음이 표준 ES 모듈로 읽히는가 — 조각용 느슨한 옵션(어디서나 import · export, 선언 없는 내보냄) 없이 읽는다(GPT -d GD7). */
function 엄격모듈인가(글) {
  파서얻기();
  try { 에이콘.parse(글, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }); return true; } catch { return false; }
}
/** 글을 ES 모듈 구문 나무로 읽는다. 읽지 못하면 null. */
function 나무읽기(글) {
  const P = 파서얻기();
  try { return P.parse(글, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, allowImportExportEverywhere: true }); } catch { return null; }
}
/** 코드 낱말(acorn · GPT -c GD11 · GE14 · GE15 · GE17) — 낱말나누기와 같은 꼴의 낱말 목록(숨은 칸 「자리」)을 낸다. 이름 · 예약어는 푼 이름,
 *  글 · 숫자 · 정규식 · 연산자는 원문, 틀 글자는 「`」 · 「T:원문 조각」 · 「${」 · 식 · 「}$」. 주석 · 줄 끝(CR · U+2028) · 숫자 꼴(1.e-3)은 표준대로 읽는다.
 *  꼴 'module': 글 전체를 ES 모듈 구문 나무로 읽으며 낱말을 모은다(나누기와 정규식을 파서가 가른다 · 엄격 모드라 8진 탈출은 오류).
 *  꼴 'script전체': 글 전체를 스크립트 구문 나무로 읽으며 낱말을 모은다(맨 위 return 허용 — 원천 파일의 소속 맞춤 · GPT -d GD8).
 *  꼴 'module낱말' · 'script': 토크나이저만 쓴다(코드 조각). 나누기와 정규식을 앞 낱말로만 가려 틀릴 수 있다. 읽지 못하면 던진다. */
export function 코드낱말(s, 꼴 = 'module') {
  const P = 파서얻기(), tt = 에이콘.tokTypes, out = [], 자리 = [], 쌓 = [];
  Object.defineProperty(out, '자리', { value: 자리 });
  const 넣기 = k => {
    if (k.type === tt.eof) return;
    const 원 = s.slice(k.start, k.end);
    let t;
    if (k.type === tt.name) t = k.value;
    else if (k.type === tt.template || k.type === tt.invalidTemplate) t = `T:${원}`;
    else if (k.type === tt.dollarBraceL) { 쌓.push('$'); t = '${'; }
    else if (k.type === tt.braceL) { 쌓.push('{'); t = '{'; }
    else if (k.type === tt.braceR) t = 쌓.pop() === '$' ? '}$' : '}';
    else if (k.type === tt.privateId) t = `#${k.value}`;
    else if (k.type.keyword) t = k.type.keyword;
    else t = 원;
    out.push(t); 자리.push(k.start);
  };
  const 설정 = { ecmaVersion: 'latest', sourceType: 꼴 === 'script' || 꼴 === 'script전체' ? 'script' : 'module', allowHashBang: true };
  if (꼴 === 'module') Object.defineProperty(out, '나무', { value: P.parse(s, { ...설정, allowImportExportEverywhere: true, onToken: 넣기 }) });
  else if (꼴 === 'script전체') Object.defineProperty(out, '나무', { value: P.parse(s, { ...설정, allowReturnOutsideFunction: true, onToken: 넣기 }) });
  else for (const k of 에이콘.tokenizer(s, 설정)) 넣기(k);
  return out;
}
/** 도구가 다루지 않는 꼴(설계 주인 11-21: 지원하지 않고 감지해 멈춘다 — 실제 (2-2) 묶음에는 없다). 구문 나무에서 찾아 [{ 꼴, 자리 }]로 낸다.
 *  계산된 문자열 열쇠는 문자열 대조가 속성 이름으로 세지 않고(GPT -c GE13), __proto__ 줄여 쓰기는 뜻이 다른 두 꼴이며(GD7), 선언과 함께 내보내는
 *  이름은 이름 바꾸기가 바깥 이름을 바꾸고(GD8 · GE3), 탈출이 든 태그 틀 글자는 문자열 대조가 값으로만 본다(GE16). */
function 지원밖꼴(나무) {
  const 찾음 = [];
  const 걷기 = n => {
    if (Array.isArray(n)) { for (const x of n) 걷기(x); return; }
    if (!n || typeof n.type !== 'string') return;
    if ((n.type === 'Property' || n.type === 'PropertyDefinition' || n.type === 'MethodDefinition') && n.computed
      && ((n.key.type === 'Literal' && typeof n.key.value === 'string') || (n.key.type === 'TemplateLiteral' && !n.key.expressions.length))) 찾음.push({ 꼴: '계산된 문자열 열쇠', 자리: n.start });
    if (n.type === 'Property' && n.shorthand && n.key.type === 'Identifier' && n.key.name === '__proto__') 찾음.push({ 꼴: '__proto__ 줄여 쓰기', 자리: n.start });
    if (n.type === 'ExportNamedDeclaration' && n.declaration) 찾음.push({ 꼴: '선언과 함께 내보냄', 자리: n.start });
    if (n.type === 'TaggedTemplateExpression' && n.quasi.quasis.some(q => q.value.raw !== q.value.cooked)) 찾음.push({ 꼴: '탈출이 든 태그 틀 글자', 자리: n.start });
    for (const k of Object.keys(n)) { if (나무자리칸.has(k)) continue; const v = n[k]; if (v && typeof v === 'object') 걷기(v); }
  };
  걷기(나무);
  return 찾음;
}
/** 다루지 않는 꼴이 있으면 멈춘다 — 꼴마다 수와 처음 자리 둘레를 적는다. */
function 지원밖멈춤(글, 나무, 머리) {
  const 찾음 = 나무 ? 지원밖꼴(나무) : [];
  if (!찾음.length) return;
  const 꼴들 = [...new Set(찾음.map(x => x.꼴))].map(k => { const xs = 찾음.filter(x => x.꼴 === k); return `${k} ${xs.length}곳(처음: ${JSON.stringify(글.slice(xs[0].자리, xs[0].자리 + 60))})`; });
  throw new Error(`${머리}에 도구가 다루지 않는 꼴이 있다 — ${꼴들.join(' · ')}. 이 꼴은 대조가 「같다」 쪽으로 틀릴 수 있어 지원하지 않고 멈춘다(설계 주인 11-21)`);
}
/** 원천 파일 낱말(소속 맞춤) — 전체 구문 분석(모듈 → 스크립트)으로 읽고 숨은 칸 「확인」을 켠다. 둘 다 못 읽으면 토크나이저(모듈 → 스크립트)로
 *  읽되 「확인」을 끈다 — 토크나이저는 나누기와 정규식을 앞 낱말로만 가려 틀릴 수 있다(GPT -d GD8). 소속 맞춤은 확인된 낱말만 쓴다. 다 못 읽으면 빈 목록. */
const 파일낱말 = 글 => {
  for (const 꼴 of ['module', 'script전체']) { try { return Object.defineProperty(코드낱말(글, 꼴), '확인', { value: true }); } catch { /* 다음 꼴 */ } }
  for (const 꼴 of ['module낱말', 'script']) { try { return 코드낱말(글, 꼴); } catch { /* 다음 꼴 */ } }
  return [];
};
/** 낱말에서 모은 집합 · 모음에 낱말의 「확인」을 숨은 칸으로 옮긴다. */
const 확인옮김 = (o, T) => Object.defineProperty(o, '확인', { value: T.확인 === true });
class 이름범위 {
  constructor(위) { this.위 = 위; this.이름 = new Map(); }
  선언(n) { if (!this.이름.has(n)) this.이름.set(n, { 이름: n, 범위: this }); return this.이름.get(n); }
  찾기(n) { for (let s = this; s; s = s.위) if (s.이름.has(n)) return s.이름.get(n); return null; }
}
/** 묶는 꼴(이름 · 구조 분해 · 기본값 · 나머지)의 이름 Identifier들. */
function 묶는꼴(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p);
  else if (p.type === 'ObjectPattern') for (const q of p.properties) 묶는꼴(q.type === 'RestElement' ? q.argument : q.value, out);
  else if (p.type === 'ArrayPattern') for (const q of p.elements) 묶는꼴(q, out);
  else if (p.type === 'RestElement') 묶는꼴(p.argument, out);
  else if (p.type === 'AssignmentPattern') 묶는꼴(p.left, out);
  return out;
}
/** var로 선언한 이름 Identifier — 안쪽 함수 · 클래스에는 들어가지 않는다(그 var는 그 함수의 것이다). */
function var선언(n, out = []) {
  if (!n || typeof n.type !== 'string') return out;
  switch (n.type) {
    case 'VariableDeclaration': if (n.kind === 'var') for (const d of n.declarations) 묶는꼴(d.id, out); break;
    case 'ExportNamedDeclaration': case 'ExportDefaultDeclaration': var선언(n.declaration, out); break;
    case 'Program': case 'BlockStatement': case 'StaticBlock': for (const s of n.body) var선언(s, out); break;
    case 'IfStatement': var선언(n.consequent, out); var선언(n.alternate, out); break;
    case 'ForStatement': var선언(n.init, out); var선언(n.body, out); break;
    case 'ForInStatement': case 'ForOfStatement': var선언(n.left, out); var선언(n.body, out); break;
    case 'WhileStatement': case 'DoWhileStatement': case 'LabeledStatement': var선언(n.body, out); break;
    case 'TryStatement': var선언(n.block, out); var선언(n.handler?.body, out); var선언(n.finalizer, out); break;
    case 'SwitchStatement': for (const c of n.cases) for (const s of c.consequent) var선언(s, out); break;
    default: break;
  }
  return out;
}
/** 문장 목록에 바로 선언한 let · const · class · 함수 선언의 이름 Identifier(엄격 모드의 블록 안 함수는 블록에 묶인다). */
function 어휘선언(문장들, out = []) {
  for (let s of 문장들) {
    if (s.type === 'ExportNamedDeclaration' || s.type === 'ExportDefaultDeclaration') s = s.declaration;
    if (!s) continue;
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') for (const d of s.declarations) 묶는꼴(d.id, out);
    else if ((s.type === 'ClassDeclaration' || s.type === 'FunctionDeclaration') && s.id) out.push(s.id);
  }
  return out;
}
const 나무자리칸 = new Set(['type', 'start', 'end', 'loc', 'range']);
/** 이름 풀이 — Identifier마다 자리(변수 · 열쇠 · 꼬리표 · 메타)를, 변수면 가리키는 묶임(조각 안에서 못 찾으면 null — 조각 밖 이름)을 적는다.
 *  맨: 조각 맨 위 범위. 선언: 맨 위 범위에 이름을 선언한 Identifier(묶음 맨 위 선언의 자리를 찾는 데 쓴다). 위험: 직접 eval · with가 있다. */
function 이름풀이(나무) {
  const 역할 = new Map(), 묶임 = new Map(), 선언 = []; let 위험 = false;
  // .name(설계 주인 11-21 · GPT -c GD9 · GE3): 함수 · 클래스 이름이 되는 묶임(선언 · 이름 붙은 식 · 이름 없는 함수 · 클래스 식을 받은 변수)과
  // 그 이름의 .name을 직접 읽는 곳(X.name · 그 클래스 안의 this.constructor.name · new.target.name). 조각 밖 이름은 글자로 모은다.
  // 원문 읽기(GPT -d GD12): 그 이름의 원문을 직접 읽는 곳(X.toString). 이름모름(GD11): 어느 함수의 .name인지 가릴 수 없는 직접 읽기가 있다.
  const 함수이름 = new Set(), 이름읽음 = new Set(), 밖이름읽음 = new Set(), 원문읽음 = new Set(), 틀쌓 = [];
  let 이름모름 = false, 대기 = null, 메서드대기 = false;
  const 익명함수 = e => !!e && (((e.type === 'FunctionExpression' || e.type === 'ClassExpression') && !e.id) || e.type === 'ArrowFunctionExpression');
  // 이름틀: 함수 · 클래스마다 틀을 쌓는다(이름 없는 것도 — 화살 함수 안의 new.target은 바깥 함수를 가리킨다, GPT -d GD11). 이름 없는 함수 식은
  // 바로 앞에서 그 값을 받은 묶임(대기 — 변수 · 대입 · 논리 대입 · 기본값)을 이름으로 쓴다.
  const 받기 = () => { const x = 대기; 대기 = null; return x; };
  const 이름틀 = (x, 클래스, 화살, 일) => { const 메서드 = 메서드대기; 메서드대기 = false; if (x) 함수이름.add(x); 틀쌓.push({ 묶임: x, 클래스, 화살, 메서드 }); try { 일(); } finally { 틀쌓.pop(); } };
  const 읽음넣기 = c => { if (c?.묶임) 이름읽음.add(c.묶임); else if (c) 이름모름 = true; };
  const 상수칸 = (n, 이름) => (n.computed ? n.property.type === 'Literal' && n.property.value === 이름 : n.property.type === 'Identifier' && n.property.name === 이름);
  const 열쇠 = n => { if (n?.type === 'Identifier') 역할.set(n, '열쇠'); };
  const 변수 = (n, s) => { 역할.set(n, '변수'); 묶임.set(n, s.찾기(n.name)); };
  const 블록 = (문장들, s) => { const t = new 이름범위(s); for (const x of 어휘선언(문장들)) t.선언(x.name); 보기(문장들, t); };
  const 함수 = (n, s) => {
    const 인자 = new 이름범위(s);
    if (n.type !== 'ArrowFunctionExpression') 인자.선언('arguments');
    for (const p of n.params) for (const x of 묶는꼴(p)) 인자.선언(x.name);
    보기(n.params, 인자);
    if (n.body.type !== 'BlockStatement') { 보기(n.body, 인자); return; }
    // 몸의 var · 맨 위 함수 선언은 같은 이름의 인자와 한 묶임으로 본다(몸 안에서 그 이름은 인자 값으로 시작한다). 인자 기본값 식은 몸의 선언을 보지 않는다.
    const 몸 = new 이름범위(인자);
    for (const x of [...var선언(n.body), ...어휘선언(n.body.body)]) if (!인자.이름.has(x.name)) 몸.선언(x.name);
    보기(n.body.body, 몸);
  };
  const 보기 = (n, s) => {
    if (Array.isArray(n)) { for (const x of n) 보기(x, s); return; }
    if (!n || typeof n.type !== 'string') return;
    switch (n.type) {
      case 'Identifier': 변수(n, s); return;
      case 'PrivateIdentifier': case 'Literal': case 'TemplateElement': return;
      case 'MemberExpression': {
        const o = n.object;
        if (상수칸(n, 'name')) {
          if (o.type === 'Identifier') { const x = s.찾기(o.name); if (x) 이름읽음.add(x); else 밖이름읽음.add(o.name); }
          // this.constructor · this["constructor"](GPT -d GD10): 가장 안쪽 클래스나 화살 · 메서드가 아닌 함수(생성자로 부른 함수)
          else if (o.type === 'MemberExpression' && o.object.type === 'ThisExpression' && 상수칸(o, 'constructor')) 읽음넣기(틀쌓.findLast(x => x.클래스 || (!x.화살 && !x.메서드)));
          // new.target: 화살 함수는 건너뛴 가장 안쪽 함수 · 클래스(GPT -d GD11). 클래스 생성자 안이면 그 클래스이고, 메서드 안이면 undefined다(메서드는 new로 부를 수 없다).
          else if (o.type === 'MetaProperty' && o.meta.name === 'new' && o.property.name === 'target') {
            const k = 틀쌓.findLastIndex(x => !x.화살), c = 틀쌓[k];
            if (c?.메서드 === '생성자') 읽음넣기(틀쌓[k - 1]); else if (!c?.메서드) 읽음넣기(c);
          }
        }
        // 원문 읽기(GPT -d GD12): X.toString — 같은 나무라도 글이 다르면 결과가 다르다
        if (상수칸(n, 'toString') && o.type === 'Identifier') { const x = s.찾기(o.name); if (x) 원문읽음.add(x); }
        보기(n.object, s); if (n.computed) 보기(n.property, s); else 열쇠(n.property); return;
      }
      case 'VariableDeclarator': case 'AssignmentExpression': {
        const 왼 = n.type === 'VariableDeclarator' ? n.id : n.left, 오 = n.type === 'VariableDeclarator' ? n.init : n.right;
        보기(왼, s);
        // 논리 대입(??= · ||= · &&=)도 이름 없는 함수에 이름을 붙인다(GPT -d GD9).
        const x = 왼?.type === 'Identifier' && (n.type === 'VariableDeclarator' || ['=', '??=', '||=', '&&='].includes(n.operator)) && 익명함수(오) ? 묶임.get(왼) : null;
        if (x) 대기 = x;
        보기(오, s); 대기 = null;
        return;
      }
      // 기본값(인자 · 구조 분해)도 이름 없는 함수에 이름을 붙인다(GPT -d GD9).
      case 'AssignmentPattern': {
        보기(n.left, s);
        const x = n.left?.type === 'Identifier' && 익명함수(n.right) ? 묶임.get(n.left) : null;
        if (x) 대기 = x;
        보기(n.right, s); 대기 = null;
        return;
      }
      case 'Property': case 'MethodDefinition': case 'PropertyDefinition':
        if (n.computed) 보기(n.key, s); else 열쇠(n.key);
        // 메서드 몸의 this는 그 객체 · 인스턴스다 — this.constructor를 풀 때 메서드 틀은 건너뛴다
        if (n.type === 'MethodDefinition' || n.method || n.kind === 'get' || n.kind === 'set') 메서드대기 = n.value?.type === 'FunctionExpression' && (n.kind === 'constructor' ? '생성자' : '메서드');
        보기(n.value, s); 메서드대기 = false; return;
      case 'LabeledStatement': 역할.set(n.label, '꼬리표'); 보기(n.body, s); return;
      case 'BreakStatement': case 'ContinueStatement': if (n.label) 역할.set(n.label, '꼬리표'); return;
      case 'MetaProperty': 역할.set(n.meta, '메타'); 역할.set(n.property, '메타'); return;
      case 'ImportDeclaration': for (const sp of n.specifiers) 변수(sp.local, s); return;
      case 'ExportNamedDeclaration': if (n.declaration) 보기(n.declaration, s); for (const sp of n.specifiers) if (n.source) 역할.set(sp.local, '열쇠'); else 변수(sp.local, s); return;
      case 'ExportAllDeclaration': return;
      case 'FunctionDeclaration': 대기 = null; if (n.id) 변수(n.id, s); 이름틀(n.id ? 묶임.get(n.id) : null, false, false, () => 함수(n, s)); return;
      case 'FunctionExpression': { const 받은 = 받기(); let t = s; if (n.id) { t = new 이름범위(s); t.선언(n.id.name); 변수(n.id, t); } 이름틀(n.id ? 묶임.get(n.id) : 받은, false, false, () => 함수(n, t)); return; }
      case 'ArrowFunctionExpression': { const 받은 = 받기(); 이름틀(받은, false, true, () => 함수(n, s)); return; }
      case 'ClassDeclaration': case 'ClassExpression': {
        const t = new 이름범위(s);
        if (n.id) { if (n.type === 'ClassDeclaration') t.이름.set(n.id.name, s.찾기(n.id.name) ?? s.선언(n.id.name)); else t.선언(n.id.name); 변수(n.id, t); }
        const 받은 = 받기();
        이름틀(n.id ? 묶임.get(n.id) : 받은, true, false, () => { 보기(n.superClass, t); for (const m of n.body.body) 보기(m, t); }); return;
      }
      case 'StaticBlock': { const t = new 이름범위(s); for (const x of [...var선언(n), ...어휘선언(n.body)]) t.선언(x.name); 보기(n.body, t); return; }
      case 'BlockStatement': 블록(n.body, s); return;
      case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': {
        const 머리 = n.type === 'ForStatement' ? n.init : n.left, t = 머리?.type === 'VariableDeclaration' && 머리.kind !== 'var' ? new 이름범위(s) : s;
        if (t !== s) for (const d of 머리.declarations) for (const x of 묶는꼴(d.id)) t.선언(x.name);
        for (const k of n.type === 'ForStatement' ? ['init', 'test', 'update', 'body'] : ['left', 'right', 'body']) 보기(n[k], t);
        return;
      }
      case 'SwitchStatement': { 보기(n.discriminant, s); const t = new 이름범위(s); for (const x of 어휘선언(n.cases.flatMap(c => c.consequent))) t.선언(x.name); for (const c of n.cases) { 보기(c.test, t); 보기(c.consequent, t); } return; }
      case 'CatchClause': { const t = new 이름범위(s); for (const x of 묶는꼴(n.param)) t.선언(x.name); 보기(n.param, t); 블록(n.body.body, t); return; }
      case 'CallExpression': if (n.callee.type === 'Identifier' && n.callee.name === 'eval' && !s.찾기('eval')) 위험 = true; break;
      case 'WithStatement': 위험 = true; break;
      default: break;
    }
    for (const k of Object.keys(n)) { if (나무자리칸.has(k)) continue; const v = n[k]; if (v && typeof v === 'object') 보기(v, s); }
  };
  const 맨 = new 이름범위(null);
  선언.push(...어휘선언(나무.body), ...var선언(나무));
  for (const st of 나무.body) if (st.type === 'ImportDeclaration') for (const sp of st.specifiers) 선언.push(sp.local);
  for (const x of 선언) 맨.선언(x.name);
  보기(나무.body, 맨);
  return { 역할, 묶임, 맨, 선언, 위험, 함수이름, 이름읽음, 밖이름읽음, 원문읽음, 이름모름 };
}
const 모듈바깥이름 = x => (x.type === 'Literal' ? `"${x.value}"` : x.name);
const 열쇠글 = k => (k?.type === 'Identifier' ? k.name : k?.type === 'Literal' ? String(k.value) : null);
/** 선언과 함께 내보내는 이름들(export const a, b · export function f · export class C). */
const 내보낸이름 = d => (!d ? [] : d.type === 'VariableDeclaration' ? d.declarations.flatMap(x => 묶는꼴(x.id)).map(x => x.name) : d.id ? [d.id.name] : []);
const 견주지않는칸 = new Set(['type', 'start', 'end', 'loc', 'range', 'raw', 'shorthand']);
/** 두 나무를 견준다. 바깥A · 바깥B: 묶음 맨 위에서 선언한 이름 집합(조각 밖 이름 가운데 묶음 이름 — esbuild 꼬리 짝을 받는다).
 *  돌려주는 것: { 같음, 짝: [[앞 이름, 뒤 이름] — 묶인 이름], 바깥짝: [[앞, 뒤] — 조각 밖 묶음 이름], 맨위짝: [[앞, 뒤] — 조각 맨 위 선언], 어긋남? } */
function 나무견주기(A, B, 풀A, 풀B, 바깥A, 바깥B) {
  const ab = new Map(), ba = new Map(), 밖ab = new Map(), 밖ba = new Map();
  let 어긋남 = null;
  const 틀림 = (a, b, 왜) => { 어긋남 ??= { a, b, 왜 }; return false; };
  const 이름견주기 = (a, b) => {
    const ra = 풀A.역할.get(a) ?? '열쇠', rb = 풀B.역할.get(b) ?? '열쇠';
    if (ra !== rb) return 틀림(a, b, '이름 자리가 다르다');
    if (ra !== '변수') return a.name === b.name || 틀림(a, b, ra === '꼬리표' ? '꼬리표가 다르다' : '속성 · 열쇠 이름이 다르다');
    if (!이름짝인가(a.name, b.name)) return 틀림(a, b, `이름 ${a.name} → ${b.name}이 esbuild 꼬리 짝이 아니다`);
    const xa = 풀A.묶임.get(a), xb = 풀B.묶임.get(b);
    if (xa && xb) {
      if ((ab.has(xa) && ab.get(xa) !== xb) || (ba.has(xb) && ba.get(xb) !== xa)) return 틀림(a, b, `묶인 이름의 짝 ${a.name} → ${b.name}이 일대일이 아니다`);
      ab.set(xa, xb); ba.set(xb, xa); return true;
    }
    if (xa || xb) return 틀림(a, b, `${a.name} → ${b.name}: 한쪽은 조각 안 이름, 한쪽은 조각 밖 이름이다`);
    const 묶a = 바깥A.has(a.name), 묶b = 바깥B.has(b.name);
    if (묶a !== 묶b) return 틀림(a, b, `${a.name} → ${b.name}: 한쪽만 묶음 맨 위 이름이다(다른 쪽은 전역)`);
    if (!묶a) return a.name === b.name || 틀림(a, b, `전역 이름 ${a.name} → ${b.name}이 다르다`);
    if ((밖ab.has(a.name) && 밖ab.get(a.name) !== b.name) || (밖ba.has(b.name) && 밖ba.get(b.name) !== a.name)) return 틀림(a, b, `묶음 이름의 짝 ${a.name} → ${b.name}이 일대일이 아니다`);
    밖ab.set(a.name, b.name); 밖ba.set(b.name, a.name); return true;
  };
  const 값같음 = (a, b) => {
    if (a.regex || b.regex) return !!a.regex && !!b.regex && a.regex.pattern === b.regex.pattern && a.regex.flags === b.regex.flags;
    if (a.bigint != null || b.bigint != null) return a.bigint != null && b.bigint != null && Object.is(a.value, b.value);
    return Object.is(a.value, b.value);
  };
  const 같음 = (a, b) => {
    if (a === b) return true;
    if (a == null || b == null) return 틀림(a, b, '한쪽에만 있다');
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 틀림(a, b, '수가 다르다');
      for (let i = 0; i < a.length; i += 1) if (!같음(a[i], b[i])) return false;
      return true;
    }
    if (typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b) || 틀림(a, b, '값이 다르다');
    if (a.type !== b.type) return 틀림(a, b, `꼴이 다르다(${a.type} ↔ ${b.type})`);
    switch (a.type) {
      case 'Identifier': return 이름견주기(a, b);
      case 'PrivateIdentifier': return a.name === b.name || 틀림(a, b, '# 이름이 다르다');
      case 'Literal': return 값같음(a, b) || 틀림(a, b, '상수가 다르다');
      // 틀 글자 조각은 값(cooked)으로 본다. 태그 붙은 틀 글자(String.raw`…` · tag`…`)는 태그가 raw를 받으므로 raw도 같아야 한다.
      case 'TemplateElement': return (Object.is(a.value.cooked, b.value.cooked) && a.tail === b.tail) || 틀림(a, b, '틀 글자가 다르다');
      case 'TaggedTemplateExpression':
        if (!같음(a.tag, b.tag)) return false;
        if (a.quasi.quasis.length !== b.quasi.quasis.length || a.quasi.quasis.some((q, i) => q.value.raw !== b.quasi.quasis[i].value.raw)) return 틀림(a, b, '태그 붙은 틀 글자의 raw가 다르다');
        return 같음(a.quasi, b.quasi);
      case 'ImportSpecifier': return 모듈바깥이름(a.imported) === 모듈바깥이름(b.imported) ? 같음(a.local, b.local) : 틀림(a, b, '가져오는 바깥 이름이 다르다');
      case 'ExportSpecifier': return 모듈바깥이름(a.exported) === 모듈바깥이름(b.exported) ? 같음(a.local, b.local) : 틀림(a, b, '내보내는 바깥 이름이 다르다');
      case 'ExportAllDeclaration': return ((a.exported ? 모듈바깥이름(a.exported) : null) === (b.exported ? 모듈바깥이름(b.exported) : null) || 틀림(a, b, '내보내는 바깥 이름이 다르다')) && 같음(a.source, b.source) && 같음(a.attributes, b.attributes);
      // 선언과 함께 내보내는 이름은 바깥 이름이다 — 꼬리 짝으로 바꾸면 내보내는 이름이 바뀐다(GPT -c GD8 · GE3).
      case 'ExportNamedDeclaration': if (내보낸이름(a.declaration).join('\0') !== 내보낸이름(b.declaration).join('\0')) return 틀림(a, b, '선언과 함께 내보내는 이름이 다르다'); break;
      // { __proto__ }(자체 속성)와 { __proto__: x }(프로토타입)는 뜻이 다르다(GPT -c GD7).
      case 'Property': if (!a.computed && 열쇠글(a.key) === '__proto__' && a.shorthand !== b.shorthand) return 틀림(a, b, '__proto__ 줄여 쓰기가 다르다'); break;
      default: break;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (견주지않는칸.has(k)) continue; if (!같음(a[k], b[k])) return false; }
    return true;
  };
  let 같다 = 같음(A, B);
  if (같다 && (풀A.위험 || 풀B.위험)) { 같다 = false; 어긋남 = { a: A, b: B, 왜: '직접 eval 또는 with가 있다(이름을 바꾸면 뜻이 바뀔 수 있다)' }; }
  // 이름이 바뀐 함수 · 클래스(설계 주인 11-21): 증거에 따로 싣고, 그 이름의 .name을 조각 안에서 직접 읽으면 다름이다. 간접 읽기는 한계로 둔다.
  const 함수바뀜 = [...ab].filter(([x, y]) => x.이름 !== y.이름 && (풀A.함수이름.has(x) || 풀B.함수이름.has(y)));
  const 읽힘 = 함수바뀜.find(([x, y]) => 풀A.이름읽음.has(x) || 풀B.이름읽음.has(y));
  if (같다 && 읽힘) { 같다 = false; 어긋남 = { a: A, b: B, 왜: `이름이 바뀐 함수 · 클래스 ${읽힘[0].이름} → ${읽힘[1].이름}의 .name을 직접 읽는다` }; }
  // 어느 함수의 .name인지 가릴 수 없는 직접 읽기(이름 없는 함수 안의 new.target.name 등)가 있는데 함수 이름이 바뀌었으면 다름이다(GPT -d GD11).
  if (같다 && 함수바뀜.length && (풀A.이름모름 || 풀B.이름모름)) { 같다 = false; 어긋남 = { a: A, b: B, 왜: '이름이 바뀐 함수 · 클래스가 있고, 어느 함수의 .name인지 가릴 수 없는 직접 읽기(new.target.name · this.constructor.name)가 있다' }; }
  // 함수 · 클래스 원문을 직접 읽는 곳(X.toString)이 있으면 같은코드가 글을 견줘 다름으로 닫는다(GPT -d GD12).
  const 원문읽힘 = [...풀A.원문읽음].find(x => 풀A.함수이름.has(x))?.이름 ?? [...풀B.원문읽음].find(x => 풀B.함수이름.has(x))?.이름 ?? null;
  const 쌍 = m => [...m].map(([x, y]) => [x.이름 ?? x, y.이름 ?? y]);
  return { 같음: 같다, 짝: 쌍(ab), 바깥짝: [...밖ab], 맨위짝: [...ab].filter(([x, y]) => x.범위 === 풀A.맨 && y.범위 === 풀B.맨).map(([x, y]) => [x.이름, y.이름]),
    함수바뀜: 함수바뀜.map(([x, y]) => [x.이름, y.이름]), 원문읽힘, 어긋남 };
}
const 빈이름 = new Set();
/** 같은 코드인가 — 두 모듈 글의 구문 나무가 묶인 이름만 일대일로 바꾼 같은 나무인가(위 설명). 바깥A · 바깥B는 묶음 맨 위 선언 이름(묶음 대조가 준다).
 *  돌려주는 것: { 같음, 짝: ['앞→뒤', …](글자가 다른 짝만), 맨위짝, 바깥짝(묶음 전체 확인에 쓴다), 정리: 'acorn 판', 앞?, 뒤?(처음 어긋난 곳 둘레), 왜? } */
export function 같은코드(앞글, 뒤글, { 바깥A = 빈이름, 바깥B = 빈이름 } = {}) {
  const A = 나무읽기(앞글), B = 나무읽기(뒤글), 정리 = `acorn ${나무판}`;
  const 둘레 = (글, n) => 글.slice(Math.max(0, (n?.start ?? 0) - 60), (n?.end ?? 0) + 60).replace(/\s+/g, ' ').slice(0, 300);
  if (!A || !B) return { 같음: false, 짝: [], 맨위짝: [], 바깥짝: [], 정리, 왜: `${!A ? '라이브' : '후보'} 조각을 ES 모듈로 읽지 못했다(읽지 못한 조각은 같은 코드가 아니다)`, 앞: 앞글.slice(0, 300), 뒤: 뒤글.slice(0, 300) };
  const r = 나무견주기(A, B, 이름풀이(A), 이름풀이(B), 바깥A, 바깥B);
  // 함수 · 클래스 원문을 조각 안에서 직접 읽으면(X.toString) 나무가 같아도 글이 다를 때 결과가 다르다 — 다름이다(GPT -d GD12).
  if (r.같음 && r.원문읽힘 && 앞글 !== 뒤글) return { 같음: false, 짝: [], 맨위짝: [], 바깥짝: [], 정리, 왜: `함수 · 클래스 ${r.원문읽힘}의 원문을 직접 읽는다(${r.원문읽힘}.toString) — 글이 달라 결과가 다르다`, 앞: 앞글.slice(0, 300), 뒤: 뒤글.slice(0, 300) };
  if (!r.같음) return { 같음: false, 짝: [], 맨위짝: [], 바깥짝: [], 정리, 왜: r.어긋남?.왜 ?? '나무가 다르다', 앞: 둘레(앞글, r.어긋남?.a), 뒤: 둘레(뒤글, r.어긋남?.b) };
  return { 같음: true, 짝: r.짝.filter(([p, q]) => p !== q).map(([p, q]) => `${p}→${q}`), 맨위짝: r.맨위짝, 바깥짝: r.바깥짝, 함수바뀜: r.함수바뀜, 정리 };
}
/** 같은 경로의 조각들을 조각마다 견준다(GPT -c GE1). 하나라도 같은 코드가 아니면 그 조각의 어긋남을 낸다. 짝들은 모은다. */
function 조각같은코드(xs, ys, 바깥) {
  if (xs.length !== ys.length) return { 같음: false, 왜: `같은 경로의 조각 수가 다르다(라이브 ${xs.length} · 후보 ${ys.length})`, 앞: '', 뒤: '' };
  const 모음 = { 같음: true, 짝: [], 맨위짝: [], 바깥짝: [], 함수바뀜: [], 정리: null };
  for (let k = 0; k < xs.length; k += 1) {
    const s = 같은코드(xs[k], ys[k], 바깥);
    if (!s.같음) return { ...s, 왜: xs.length > 1 ? `${k + 1}번째 조각: ${s.왜}` : s.왜 };
    for (const 칸 of ['짝', '맨위짝', '바깥짝', '함수바뀜']) 모음[칸].push(...(s[칸] ?? []));
    모음.정리 = s.정리;
  }
  모음.짝 = [...new Set(모음.짝)];
  return 모음;
}
/** 묶음 맨 위 선언 — 이름 → 그 이름을 선언한 모듈(경로) 집합. 묶음 전체를 ES 모듈로 읽어 맨 위 범위의 선언 자리를 조각에 댄다. 읽지 못하면 null. */
function 맨위모듈(b, 조각, 쪽 = '묶음') {
  const 글 = b.toString('utf8'), 나무 = 나무읽기(글);
  지원밖멈춤(글, 나무, `묶음 대조: ${쪽} 묶음`);
  // 완성 묶음은 표준 ES 모듈 파서로도 읽혀야 한다 — 실행할 수 없는 묶음을 대조하지 않는다(GPT -d GD7).
  if (!나무 || !엄격모듈인가(글)) return null;
  const 자리들 = []; let k = 0;
  for (const x of [...조각].sort((p, q) => p.시작 - q.시작)) { const n = b.subarray(x.시작, x.끝).toString('utf8').length; 자리들.push({ 시작: k, 끝: k + n, 경로: 경로만(x.이름) }); k += n; }
  if (k !== 글.length) return null;
  // 맨 위 문장이 모듈 표지 경계를 넘으면(앞 조각 끝의 ;가 빠져 다음 조각과 한 식이 됨) 조각마다 견줘도 실행 뜻이 바뀐 것을 놓친다 — 멈춘다(GPT -d GE1).
  const 경계 = 자리들.slice(1).map(z => z.시작), 넘음 = 나무.body.find(n => 경계.some(c => n.start < c && c < n.end));
  if (넘음) throw new Error(`묶음 대조: ${쪽} 묶음의 맨 위 문장이 모듈 표지 경계를 넘는다 — ${JSON.stringify(글.slice(넘음.start, 넘음.start + 60))}. 조각마다 견주는 대조가 실행 차이를 놓칠 수 있어 지원하지 않고 멈춘다`);
  const 선 = new Map(), 풀 = 이름풀이(나무);
  for (const x of 풀.선언) {
    const z = 자리들.find(z => x.start >= z.시작 && x.start < z.끝);
    if (z) (선.get(x.name) || 선.set(x.name, new Set()).get(x.name)).add(z.경로);
  }
  // 묶음 맨 위의 함수 · 클래스 이름과, 묶음 어디서든 .name을 직접 읽는 맨 위 이름 — 조각 밖에서 읽는 것까지 본다(설계 주인 11-21 · GPT -c GD9).
  const 맨이름 = xs => new Set([...xs].filter(x => x.범위 === 풀.맨).map(x => x.이름));
  return Object.assign(선, { 함수: 맨이름(풀.함수이름), 이름읽음: 맨이름(풀.이름읽음), 원문읽음: 맨이름(풀.원문읽음) });
}
/** 정리한 코드를 문장 줄로 — ; { } 낱말에서 끊는다(글 차이를 읽히게). */
function 문장줄(글) {
  const 정리 = 줄이기(글), T = 낱말나누기(정리 ?? 글), 줄 = []; let 지금 = [];
  for (const t of T) { 지금.push(t); if (t === ';' || t === '{' || t === '}') { 줄.push(지금.join(' ')); 지금 = []; } }
  if (지금.length) 줄.push(지금.join(' '));
  return `${줄.join('\n')}\n`;
}
const 경로만 = 이름 => 이름.replace(/#\d+$/, '').replace(/\?[^/]*$/, '');
/** 묶음을 경로별 글로 — Map<경로, 글>(#n 조각과 ?v= 판은 차례로 잇는다) · 조각 목록 · 조각 수. 나눌 수 없거나 조각이 다 덮지 않으면 null. */
function 경로별(b) {
  const 조각 = 모듈나누기(b);
  if (!조각 || !조각덮음(b, 조각)) return null;
  const m = new Map(), 조각글 = new Map();
  for (const x of 조각) {
    const p = 경로만(x.이름), g = b.subarray(x.시작, x.끝).toString('utf8');
    m.set(p, (m.get(p) ?? '') + g);
    (조각글.get(p) || 조각글.set(p, []).get(p)).push(g);
  }
  return Object.assign(m, { 조각수: 조각.length, 조각, 조각글 });
}
/** 가장 긴 늘어나는 줄(LIS)의 자리 — 차례가 그대로인 것들. */
function 늘줄(수) {
  const 끝 = [], 앞 = new Array(수.length).fill(-1), 자리 = new Set();
  for (let n = 0; n < 수.length; n += 1) {
    let lo = 0, hi = 끝.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (수[끝[mid]] < 수[n]) lo = mid + 1; else hi = mid; }
    if (lo > 0) 앞[n] = 끝[lo - 1];
    끝[lo] = n;
  }
  for (let n = 끝.length ? 끝[끝.length - 1] : -1; n >= 0; n = 앞[n]) 자리.add(n);
  return 자리;
}
/** 묶음 대조 — 라이브 · 후보를 모듈 표지로 나눠 경로별로(#n 조각과 ?v= 판은 차례로 이어) 견준다. 나눌 수 없거나 조각이 바이트를 다 덮지
 *  않거나 묶음 전체를 ES 모듈로 읽지 못하면 null. 돌려주는 것: { 라이브조각: n, 후보조각: n, 경로: [{ 경로, 꼴: 같음 | 같은 코드 | 바뀜 | 후보에만 |
 *  라이브에만, 짝?, 라이브글?, 후보글?, 참조?, 어긋남? }], 차례: { 옮김, 라이브, 후보 } } */
export function 묶음대조(라이브, 후보) {
  const LA = 경로별(라이브), LB = 경로별(후보);
  if (!LA || !LB) return null;
  const 선A = 맨위모듈(라이브, LA.조각, '라이브'), 선B = 맨위모듈(후보, LB.조각, '후보');
  if (!선A || !선B) return null;
  const 바깥A = new Set(선A.keys()), 바깥B = new Set(선B.keys()), 선글 = s => (s ? [...s].sort().join(' · ') : '없음');
  // 맨 위 이름의 짝은 두 묶음에서 같은 모듈의 선언을 가리켜야 같은 코드다(GPT GB6 — getLimit → getLimit2가 다른 모듈의 다른 함수일 수 있다).
  // 글이 같은 모듈도 그 이름의 선언이 다른 모듈로 옮겨 갔으면 다른 것을 부른다. 조각 안에서 묶인 이름은 이름 풀이가 이미 뺐다.
  const 엇갈림글 = ([a, b]) => `이름 ${a}${a === b ? '' : ` → ${b}`}이 가리키는 맨 위 선언의 모듈이 다르다(라이브 ${선글(선A.get(a))} · 후보 ${선글(선B.get(b))})`;
  const 경로 = [], 짝모음 = [];
  for (const [p, y] of LB) {
    const x = LA.get(p);
    if (x == null) { 경로.push({ 경로: p, 꼴: '후보에만', 후보글: y }); continue; }
    // 같은 경로의 조각이 여럿이면(esbuild가 한 모듈을 다른 모듈 사이에 나눠 싣는다) 조각마다 견준다 — 이어 붙여 견주면 조각 사이로 옮긴 문장,
    // 곧 사이에 낀 모듈과의 실행 차례가 바뀐 것을 놓친다(GPT -c GE1). 조각 수가 다르면 바뀜이다.
    const xs = LA.조각글.get(p), ys = LB.조각글.get(p), 조각같음 = xs.length === ys.length && xs.every((g, k) => g === ys[k]);
    // 글이 같아도 늘 견준다 — 맨 위 이름이 가리키는 선언의 모듈이 바뀌었는지(엇갈림)를 보려면 짝이 있어야 한다.
    const s = 조각같은코드(xs, ys, { 바깥A, 바깥B });
    // 조각 글이 같은데 같은 코드가 아니면 다른 조각과의 이음이 바뀐 것이다(참조) — 짝커밋의 글로 설명되지 않는다.
    if (!s.같음) { 경로.push({ 경로: p, 꼴: '바뀜', 라이브글: x, 후보글: y, ...(x === y ? { 참조: true } : {}), 어긋남: `「${s.앞}」 ↔ 「${s.뒤}」(${s.왜})` }); continue; }
    const 묶음짝 = [...s.맨위짝, ...s.바깥짝], e = 묶음짝.find(([a, b]) => 선글(선A.get(a)) !== 선글(선B.get(b)));
    if (e) { 경로.push({ 경로: p, 꼴: '바뀜', 라이브글: x, 후보글: y, 참조: true, 어긋남: 엇갈림글(e) }); continue; }
    // 맨 위 함수 · 클래스 이름이 바뀌었고 묶음 어디서든 그 이름의 .name을 직접 읽으면 바뀜이다(설계 주인 11-21 · GPT -c GD9).
    const 맨함수바뀜 = 묶음짝.filter(([a, b]) => a !== b && (선A.함수.has(a) || 선B.함수.has(b)));
    const 읽힘 = 맨함수바뀜.find(([a, b]) => 선A.이름읽음.has(a) || 선B.이름읽음.has(b));
    if (읽힘) { 경로.push({ 경로: p, 꼴: '바뀜', 라이브글: x, 후보글: y, 참조: true, 어긋남: `이름이 바뀐 함수 · 클래스 ${읽힘[0]} → ${읽힘[1]}의 .name을 묶음에서 직접 읽는다` }); continue; }
    // 이 모듈의 맨 위 함수 · 클래스 원문을 묶음 어디서든 직접 읽으면(X.toString) 모듈 글이 다를 때 바뀜이다(GPT -d GD12).
    const 원문 = !조각같음 && s.맨위짝.find(([a, b]) => (선A.함수.has(a) && 선A.원문읽음.has(a)) || (선B.함수.has(b) && 선B.원문읽음.has(b)));
    if (원문) { 경로.push({ 경로: p, 꼴: '바뀜', 라이브글: x, 후보글: y, 참조: true, 어긋남: `함수 · 클래스 ${원문[0]}${원문[0] === 원문[1] ? '' : ` → ${원문[1]}`}의 원문을 묶음에서 직접 읽는다(toString) — 모듈 글이 달라 결과가 다를 수 있다` }); continue; }
    const 함수바뀜 = [...new Set([...s.함수바뀜, ...맨함수바뀜].map(([a, b]) => `${a}→${b}`))];
    경로.push(조각같음 ? { 경로: p, 꼴: '같음' } : { 경로: p, 꼴: '같은 코드', 짝: s.짝, 정리: s.정리, ...(함수바뀜.length ? { 함수바뀜 } : {}) });
    짝모음.push({ p, 짝: 묶음짝 });
  }
  // 묶음 전체의 일대일(Opus F2): 같음 · 같은 코드 모듈의 맨 위 이름 짝(그 모듈이 선언하는 이름과 다른 모듈의 선언을 부르는 이름)을 모두 모아,
  // 한 라이브 이름이 둘 이상의 후보 이름으로(또는 그 거꾸로) 가면 그 짝을 낸 모듈을 모두 바뀜(참조)으로 돌린다 — 한 모듈이 두 이름을 다
  // 선언해도(sha1 · sha256) 부르는 쪽이 다른 몸을 부르게 된 것을 놓치지 않는다.
  const 앞쪽 = new Map(), 뒤쪽 = new Map();
  const 쌓기 = (m, k, v, p) => { const n = m.get(k) || m.set(k, new Map()).get(k); (n.get(v) || n.set(v, new Set()).get(v)).add(p); };
  for (const { p, 짝 } of 짝모음) for (const [a, b] of 짝) { 쌓기(앞쪽, a, b, p); 쌓기(뒤쪽, b, a, p); }
  const 걸림 = new Map(), 줄임 = xs => (xs.length > 4 ? `${xs.slice(0, 4).join(' · ')} …` : xs.join(' · '));
  for (const [쪽, 뜻] of [[앞쪽, '라이브 이름 X가 후보의 여러 이름으로 간다'], [뒤쪽, '후보 이름 X에 라이브의 여러 이름이 모인다']]) {
    for (const [k, n] of 쪽) {
      if (n.size < 2) continue;
      const 글 = `맨 위 이름의 짝이 묶음 전체에서 일대일이 아니다 — ${뜻.replace('X', k)}: ${[...n].map(([v, ps]) => `${쪽 === 앞쪽 ? `${k}→${v}` : `${v}→${k}`}(${줄임([...ps])})`).join(' / ')}`;
      for (const ps of n.values()) for (const p of ps) if (!걸림.has(p)) 걸림.set(p, 글);
    }
  }
  for (const [n, x] of 경로.entries()) {
    if (!걸림.has(x.경로) || (x.꼴 !== '같음' && x.꼴 !== '같은 코드')) continue;
    경로[n] = { 경로: x.경로, 꼴: '바뀜', 라이브글: LA.get(x.경로), 후보글: LB.get(x.경로), 참조: true, 어긋남: 걸림.get(x.경로) };
  }
  for (const [p, x] of LA) if (!LB.has(p)) 경로.push({ 경로: p, 꼴: '라이브에만', 라이브글: x });
  // 모듈 차례(GPT GB8 · 다시 검수 GB7 · -c GE2): 두 묶음에 다 있는 조각을 「경로#몇 번째」(?v=는 뗀다) 차례로 견준다 — 같은 경로의 판 사이에 다른
  // 모듈이 끼거나 빠진 것도, ?v=가 바뀐 판이 자리를 옮긴 것도 잡는다. 차례가 그대로인 가장 긴 줄 밖의 조각을 옮겨진 것으로 적는다.
  const 차례이름 = 조각들 => { const 셈 = new Map(); return 조각들.map(x => { const p = 경로만(x.이름), n = (셈.get(p) || 0) + 1; 셈.set(p, n); return `${p}#${n}`; }); };
  const 이름A = 차례이름(LA.조각), 이름B = 차례이름(LB.조각), 있A = new Set(이름A), 있B = new Set(이름B);
  const 라이브차례 = 이름A.filter(n => 있B.has(n)), 후보차례 = 이름B.filter(n => 있A.has(n)), 자리B = new Map(후보차례.map((n, k) => [n, k]));
  const 그대로 = 늘줄(라이브차례.map(n => 자리B.get(n)));
  return { 라이브조각: LA.조각수, 후보조각: LB.조각수, 경로, 차례: { 옮김: 라이브차례.filter((n, k) => !그대로.has(k)), 라이브: 라이브차례, 후보: 후보차례 } };
}
/** 따옴표 글자 낱말을 값으로 — 코드를 돌리지 않고 탈출 글자를 푼다(\n · \xHH · \uHHHH · \u{…} · 줄 이음). */
function 글풀기(t) {
  // 틀 글자(`…`)의 줄끝은 JavaScript 값 규칙대로 CRLF · CR을 LF로 푼다(GPT GB11) — 탈출 글자로 쓴 \r은 그대로다.
  const s = t.slice(1, -1), 틀 = t[0] === '`', 짧은 = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' };
  let o = '';
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c !== '\\') { if (틀 && c === '\r') { o += '\n'; if (s[i + 1] === '\n') i += 1; continue; } o += c; continue; }
    const d = s[i + 1]; i += 1;
    if (d === 'x') { o += String.fromCharCode(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; }
    else if (d === 'u' && s[i + 1] === '{') { const e = s.indexOf('}', i); o += String.fromCodePoint(parseInt(s.slice(i + 2, e), 16)); i = e; }
    else if (d === 'u') { o += String.fromCharCode(parseInt(s.slice(i + 1, i + 5), 16)); i += 4; }
    else if (d === '\r') { if (s[i + 1] === '\n') i += 1; }
    else if (d === '\n' || d === '\u2028' || d === '\u2029') { /* 줄 이음 */ }
    else o += 짧은[d] ?? d;
  }
  return o;
}
/** 파일 글의 글자 상수 집합(따옴표 글자 · 틀 글자 조각, 탈출 글자를 푼 값). */
const 글자상수 = 글 => { const T = 파일낱말(글), s = new Set(); for (const t of T) { if (t[0] === '"' || t[0] === "'") s.add(글풀기(t)); else if (t.startsWith('T:') && t.length > 2) s.add(글풀기(`\`${t.slice(2)}\``)); } return 확인옮김(s, T); };
/** 문자열 대조의 소속 맞춤 — 값이 파일(본 = { 글, 낱말 })의 문자열 상수에 있는가. 파일을 낱말로 나눠 따옴표 · 틀 글자 조각의 값만 본다(주석 뺌).
 *  「같음」: 값과 같은 상수가 있다. 「앞부분」: 여러 줄 값만 — 값의 4자 이상 첫 마디(앞 공백 걷음)의 앞 60자가 어떤 상수의 같은 자리와 같다.
 *  없으면 null. 다른 값의 일부(POSTCARD 안의 POST)나 주석에 적은 값은 소속으로 받지 않는다(GPT 다시 검수 GB15). */
const 첫마디 = v => {
  const p = v.split(/[\r\n]/).map(x => x.trimStart()).find(x => x.trim().length >= 4), k = p?.slice(0, 60);
  return k && k.replace(/\s/gu, '').length >= 4 ? k : null;   // 앞 60자에 공백 아닌 글자가 4자 미만이면 맞추지 않는다(GPT -c B10)
};
export function 글맞춤(v, 본) {
  const 상수 = (본.낱말 ??= 글자상수(본.글));
  if (!상수.확인) return null;   // 전체 구문 분석으로 읽지 못한 파일의 낱말로는 소속을 증명하지 않는다(GPT -d GD8)
  if (상수.has(v)) return '같음';
  if (!/[\r\n]/.test(v)) return null;
  const k = 첫마디(v);
  if (!k) return null;
  for (const c of 상수) if (/[\r\n]/.test(c) && 첫마디(c) === k) return '앞부분';
  return null;
}
/** 이름 맞춤 — 파일의 이름 낱말과 문자열 상수(따옴표로 쓴 열쇠 · obj["이름"])에 있는가(주석 뺌 · GPT 다시 검수 GB15). */
const 이름낱말 = 글 => { const T = 파일낱말(글), s = new Set(); for (const t of T) { if (이름꼴.test(t)) s.add(t); else if (t[0] === '"' || t[0] === "'") s.add(글풀기(t)); } return 확인옮김(s, T); };
export const 이름맞춤 = (n, 본) => { const s = (본.이름들 ??= 이름낱말(본.글)); return s.확인 && s.has(n) ? '같음' : null; };
/** 코드 글 본 — 파일의 글자 상수 값들을 코드 글로 잇는다(손 판 무리의 「코드 글 안」 맞춤에 쓴다). 위 맞춤들이 이 글을 다시 낱말로 나눠 본다. */
export const 코드글본 = 본 => (본.코드글 ??= (() => {
  // 상수마다 따로 낱말로 나눈다 — 이어 붙이면 앞 상수의 "/*"가 뒤 상수를 주석으로 삼킨다(GPT -c GE20). 맞춤들이 읽는 집합을 미리 채운 본을 낸다.
  // 상수 값(끼울 코드 조각)은 홀로 구문 분석되지 않으므로 토크나이저 낱말을 받는다. 상수를 꺼낸 파일 자체는 전체 구문 분석으로 읽혀야 한다(GPT -d GD8).
  const 상수 = (본.낱말 ??= 글자상수(본.글)), 켬 = o => Object.defineProperty(o, '확인', { value: 상수.확인 });
  const 합 = { 글: null, 낱말: 켬(new Set()), 이름들: 켬(new Set()), 값: 켬({ 숫자: new Set(), 정규식: new Set() }) };
  for (const c of 상수) {
    for (const x of 글자상수(c)) 합.낱말.add(x);
    for (const x of 이름낱말(c)) 합.이름들.add(x);
    const v = 파일값들(c);
    for (const k of Object.keys(합.값)) for (const x of v[k]) 합.값[k].add(x);
  }
  return 합;
})());
/** 문자열 대조(설계 주인 11-21, 압축돼 표지가 없는 묶음) — 문자열 상수(따옴표 · 틀 글자 조각) · 속성 이름(점 뒤 · 객체 열쇠) · 숫자(값으로) · 정규식의
 *  집합을 견준다(숫자 · 정규식은 설계 검토 F2). 압축해도 이 넷은 남는다. 연산자 · 흐름 · 점 뒤가 아닌 이름은 보지 않는다.
 *  돌려주는 것: { 수: { 라이브, 후보 }, 라이브에만: { 글: [], 이름: [], 숫자?: [], 정규식?: [] }, 후보에만: 같은 꼴 } — 숫자 · 정규식 칸은 값이 있을 때만.
 *  숨은 칸 라이브원형: 「칸\0값」 → 라이브 묶음에서 그 값을 처음 쓴 낱말(둘레 글을 찾는 데 쓴다). */
/** 문자열 대조의 묶음 낱말 — 묶음 전체를 ES 모듈로 읽는다(acorn). 읽지 못하면 멈춘다: 낱말을 잘못 나누면 라이브에만 있는 값을 놓친다(GPT -c GD11 · GE15 · GE17). */
function 묶음낱말(b) {
  const 글 = b.toString('utf8');
  let T;
  try { T = 코드낱말(글, 'module'); } catch (e) { throw new Error(`문자열 대조: 묶음을 ES 모듈로 읽지 못했다(${e.message}) — 낱말을 표준대로 나눌 수 없어 대조하지 않는다`); }
  // 완성 묶음은 표준 ES 모듈 파서로도 읽혀야 한다(GPT -d GD7).
  if (!엄격모듈인가(글)) throw new Error('문자열 대조: 묶음을 표준 ES 모듈로 읽지 못했다(조각용 느슨한 읽기로만 읽힌다) — 실행할 수 없는 묶음은 대조하지 않는다');
  return T;
}
export function 문자열대조(라이브, 후보) {
  const 모으기 = (b, 쪽) => {
    const T = 묶음낱말(b);
    지원밖멈춤(b.toString('utf8'), T.나무, `문자열 대조: ${쪽} 묶음`);
    const 안 = 감싼괄호(T), 글 = new Set(), 이름 = new Set(), 숫자 = new Set(), 정규식 = new Set(), 참고 = new Set(), 원형 = new Map();
    // 원형: 값을 처음 쓴 낱말과 그 원문 자리 — 둘레 글을 그 자리에서 자른다(GPT 다시 검수 GC7).
    const 넣기 = (칸, s, v, t, k) => { s.add(v); if (!원형.has(`${칸}\0${v}`)) 원형.set(`${칸}\0${v}`, { 낱말: t, 자리: T.자리[k] }); };
    for (let i = 0; i < T.length; i += 1) {
      const t = T[i], 열쇠 = (T[i - 1] === '{' || T[i - 1] === ',') && T[i + 1] === ':';
      // 따옴표로 쓴 열쇠와 메서드 이름({'f'(){…}})도 속성 이름이다(GPT GB11).
      if (t[0] === '"' || t[0] === "'") { const v = 글풀기(t); 넣기('글', 글, v, t, i); if (열쇠 || 메서드이름(T, i)) 넣기('이름', 이름, v, t, i); continue; }
      if (t.startsWith('T:')) { if (t.length > 2) 넣기('글', 글, 글풀기(`\`${t.slice(2)}\``), t.slice(2), i); continue; }
      // 숫자 · 정규식 값(설계 검토 F2): 라이브의 손 고침(한도 · 문턱 · 거르기)이 후보에서 사라져도 까닭을 요구한다.
      const 값 = 값낱말(T, i);
      if (값) { 넣기(값.칸, 값.칸 === '숫자' ? 숫자 : 정규식, 값.값, 값.원형, 값.시작); i = 값.끝; continue; }
      if (!이름꼴.test(t)) continue;
      // 줄여 쓴 속성({count} · {a, count})의 이름도 열쇠다 — 후보에서 그 객체가 {}로 바뀌면 라이브의 count 속성이 사라진다(GPT GB11).
      const 줄인 = 줄인속성(T, 안, i);
      if (T[i - 1] === '.' || T[i - 1] === '?.' || 열쇠 || 줄인 || 메서드이름(T, i)) 넣기('이름', 이름, t, t, i);
      else if (!참고뺄낱말.has(t)) 참고.add(꼬리뗌(t));
    }
    return { 글, 이름, 숫자, 정규식, 참고, 원형 };
  };
  const A = 모으기(라이브, '라이브'), B = 모으기(후보, '후보'), 빼기 = (x, y) => [...x].filter(v => !y.has(v)).sort();
  // 숫자 · 정규식 칸은 값이 있을 때만 단다(앞 증명의 꼴을 그대로 둔다).
  const 셈 = x => ({ 글: x.글.size, 이름: x.이름.size, ...(x.숫자.size ? { 숫자: x.숫자.size } : {}), ...(x.정규식.size ? { 정규식: x.정규식.size } : {}) });
  const 칸들 = (x, y) => { const o = { 글: 빼기(x.글, y.글), 이름: 빼기(x.이름, y.이름) }, n = 빼기(x.숫자, y.숫자), r = 빼기(x.정규식, y.정규식); if (n.length) o.숫자 = n; if (r.length) o.정규식 = r; return o; };
  return Object.defineProperties({ 수: { 라이브: 셈(A), 후보: 셈(B) }, 라이브에만: 칸들(A, B), 후보에만: 칸들(B, A) }, {
    라이브원형: { value: A.원형 },
    // 점 뒤가 아닌 이름의 집합 차이 — 까닭을 묻지 않고 증거에 참고로 싣는다(설계 주인 11-21 F2 조건 2).
    참고이름: { value: { 라이브에만: 빼기(A.참고, B.참고), 후보에만: 빼기(B.참고, A.참고) } },
  });
}
/** 참고 이름(점 뒤가 아닌 이름)에서 뺄 낱말 — 예약어와 리터럴 낱말(minifySyntax가 바꿔 쓰는 true · undefined · Infinity 같은 것). */
const 참고뺄낱말 = new Set(['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'async', 'await', 'of', 'get', 'set', 'from', 'as', 'true', 'false', 'null', 'undefined', 'Infinity', 'NaN', 'arguments']);
/** esbuild가 겹친 이름 뒤에 붙이는 수(2 이상 · 0으로 시작하지 않음)를 뗀다 — owners2 → owners. 참고 이름에만 쓴다. */
const 꼬리뗌 = n => { const m = /^(.*\D)([1-9]\d*)$/u.exec(n); return m && m[2] !== '1' ? m[1] : n; };
/** 숫자 낱말의 값 — 쓰는 꼴(1000 · 1e3 · 0x3E8 · 1_000 · .5)이 달라도 같은 값이면 같다. BigInt(…n)와 읽지 못한 꼴은 글 그대로.
 *  0으로 시작하는 정수(010 · 08)는 엄격 모드 밖에서 8진 · 10진으로 갈려 Number와 값이 다를 수 있으므로 글 그대로 둔다(GPT GB13). */
const 숫자값 = t => { if (/n$/.test(t) || /^0\d/.test(t)) return t; const v = Number(t.replace(/_/g, '')); return Number.isFinite(v) ? String(v) : t; };
const 값칸 = ['글', '이름', '숫자', '정규식'];
/** 숫자 · 정규식 낱말(설계 검토 F2) — T[i]가 숫자면 { 칸: '숫자', 값, 원형, 끝 }, 정규식이면 { 칸: '정규식', … }, 아니면 null(끝: 이 값의 마지막 낱말 자리).
 *  낱말나누기는 「.5」를 「.」 · 「5」로, 「1e-3」을 「1e」 · 「-」 · 「3」으로 나눈다 — 한 값으로 모은다(「.」 바로 뒤 숫자는 늘 소수점이다: a.5는 JS가 아니다). */
function 값낱말(T, i) {
  const t = T[i];
  if (/^\.?\d/.test(t)) {
    const 점 = T[i - 1] === '.' && !t.includes('.') ? '.' : '';
    if (/^[\d.]*\d[eE]$/.test(t) && (T[i + 1] === '-' || T[i + 1] === '+') && /^\d/.test(T[i + 2] ?? '')) { const 원형 = `${점}${t}${T[i + 1]}${T[i + 2]}`; return { 칸: '숫자', 값: 숫자값(원형), 원형, 끝: i + 2, 시작: 점 ? i - 1 : i }; }
    return { 칸: '숫자', 값: 숫자값(`${점}${t}`), 원형: `${점}${t}`, 끝: i, 시작: 점 ? i - 1 : i };
  }
  if (t.length > 1 && t[0] === '/' && t !== '/=') return { 칸: '정규식', 값: t, 원형: t, 끝: i, 시작: i };
  return null;
}
/** 파일 글의 숫자 · 정규식 값 집합(소속 맞춤에 쓴다 — 문자열 대조와 같은 낱말 읽기). */
function 파일값들(글) {
  const T = 파일낱말(글), o = { 숫자: new Set(), 정규식: new Set() };
  for (let i = 0; i < T.length; i += 1) { const v = 값낱말(T, i); if (v) { o[v.칸].add(v.값); i = v.끝; } }
  return 확인옮김(o, T);
}
/** 숫자 · 정규식 소속 맞춤 — 파일 글에 같은 값(숫자는 값으로)이 있으면 「같음」. 전체 구문 분석으로 읽은 파일만 본다(GPT -d GD8). */
const 값맞춤 = (칸, v, 본) => { const o = (본.값 ??= 파일값들(본.글)); return o.확인 && o[칸].has(v) ? '같음' : null; };
/** 파일이 전체 구문 분석으로 읽혔는가 — 「그 판에 값이 없다」를 증명하려면 읽혀야 한다(GPT -d GE3). */
const 낱말확인 = 본 => (본.낱말 ??= 글자상수(본.글)).확인;
/** 라이브 묶음에서 값을 처음 쓴 낱말 자리의 둘레 글(앞뒤 40자). 낱말을 모을 때 적은 원문 자리에서 자른다(GPT 다시 검수 GC7). 자리가 없으면 null. */
function 둘레글(글, 원형) {
  if (!원형 || !Number.isInteger(원형.자리)) return null;
  return 글.slice(Math.max(0, 원형.자리 - 40), 원형.자리 + 원형.낱말.length + 40);
}
/** 묶음 머리의 입력 목록 — 맨 앞에 이어진 `// ` 줄마다 경로 한 낱말(물음 글 ?v=…는 뗀다). 머리 줄이 없으면 null(설계 검토 F3).
 *  경로 꼴을 따지지 않는다 — 맨 위 파일(package.json 같은)에서 목록 읽기가 멈추지 않게. 경로가 아닌 낱말은 원천경로 밖으로 걸린다.
 *  일부만 읽은 목록을 다 읽은 것처럼 쓰지 않는다(GPT GB14 · GC4): `// `로 시작하는데 한 낱말이 아닌 줄(빈칸 든 경로 · 설명 글)이 머리에 있으면 던진다.
 *  한도 없이 첫 코드 줄까지 줄 단위로 읽는다 — 머리 바로 뒤의 긴 한 줄이나 긴 머리 줄에서 경계를 잘못 보지 않는다(GPT -c GE12).
 *  경로는 정규 상대 경로여야 한다(.. · . · 빈 마디 · 역슬래시 · 절대 경로는 던진다) — 원천경로 안인지 접두사로 가리기 때문이다(GPT -c GE11). */
export function 머리입력읽기(b) {
  const 목록 = [];
  let 위치 = 0;
  while (위치 < b.length) {
    const n = b.indexOf(0x0a, 위치), 끝 = n < 0 ? b.length : n;
    if (b[위치] !== 0x2f || b[위치 + 1] !== 0x2f || b[위치 + 2] !== 0x20) break;   // 「// 」로 시작하지 않으면 머리 끝
    const 줄 = b.subarray(위치, 끝).toString('utf8').replace(/\r$/, '');
    const m = /^\/\/ (\S+)$/.exec(줄);
    if (!m) throw new Error(`묶음 머리의 입력 줄을 경로 하나로 읽지 못했다: ${JSON.stringify(줄.slice(0, 120))} — 빈칸이 든 줄이 머리에 있어 목록을 끝까지 읽지 못하므로 덮음을 판정하지 않는다`);
    const p = m[1].replace(/\?.*$/, '');
    if (p.split('/').some(x => x === '..' || x === '.' || x === '') || p.includes('\\') || /^[a-zA-Z]:/.test(p)) throw new Error(`묶음 머리의 입력 경로가 정규 상대 경로가 아니다: ${JSON.stringify(p.slice(0, 120))} — 원천경로 안인지 가릴 수 없어 덮음을 판정하지 않는다`);
    목록.push(p);
    위치 = 끝 + 1;
  }
  // 머리 뒤 빈 줄 다음에 「// 경로」 줄이 다시 나오면 목록이 끊긴 것이다 — 앞부분만으로 덮음을 판정하지 않고 멈춘다(GPT -d GE2).
  if (목록.length) {
    let p = 위치, 빈줄 = 0;
    for (;;) {
      let q = p;
      while (q < b.length && (b[q] === 0x20 || b[q] === 0x09 || b[q] === 0x0d)) q += 1;
      if (q >= b.length || b[q] !== 0x0a) break;
      빈줄 += 1; p = q + 1;
    }
    if (빈줄 && b[p] === 0x2f && b[p + 1] === 0x2f && b[p + 2] === 0x20) {
      const n = b.indexOf(0x0a, p), 줄 = b.subarray(p, n < 0 ? b.length : n).toString('utf8').replace(/\r$/, '');
      if (/^\/\/ \S+$/.test(줄)) throw new Error(`묶음 머리의 입력 목록이 빈 줄로 끊겼다 — 끊긴 뒤 다시 나온 줄 ${JSON.stringify(줄.slice(0, 120))}. 앞부분만으로 덮음을 판정하지 않는다`);
    }
  }
  return 목록.length ? [...new Set(목록)] : null;
}
/** 머리곳에 머리바꿈(차례대로 replaceAll)을 적용한 바이트. 손실 없는 UTF-8이 아니면 null(설계 주인 11-21 물음 1 (가)). */
function 머리바꿈적용(b, 쌍들) {
  let 글 = b.toString('utf8');
  if (!Buffer.from(글, 'utf8').equals(b)) return null;
  for (const [a, c] of 쌍들) 글 = 글.replaceAll(a, c);
  return Buffer.from(글, 'utf8');
}

/** 바탕 재현이 안 된 대조 항목을 가른다(생성물재현이 바탕 재현 뒤에 부른다). 결과(r)에 증명용 r.대조를 달고, 묶음 재료를 돌려준다 —
 *  Map<항목 경로, { 꼴, 몸들: [{ 앞, 제목, 몸 }] }>. 까닭이 없는 모듈 · 값이 있으면 던진다(검수에 보내지 않는다 — 설계 주인 11-21). */
function 대조하기({ 정보, 저장소, 원천, 결과, 후보항목, 앞판, 바탕들, 바탕출력, 원천본, 머리본 = new Map(), 임시, 빈, 링크, 바탕기록, 시간, 알리기, J = null }) {
  const 명세 = 정보.명세, 자료 = new Map();
  const 할 = 명세.항목.filter(it => it.대조 && 결과.find(r => r.경로 === it.경로)?.바탕재현 !== true && Buffer.isBuffer(앞판?.get(it.경로)));
  if (!할.length) return 자료;
  // 파일 그대로의 두 판(짝커밋 · 후보 원천)이면 J를 넘겨 .json을 구조 차이로 싣는다. 정리한 모듈 글끼리는 줄 차이다.
  const 파일차 = (앞b, 뒤b, rel, 그대로 = false) => {
    const a = 앞b ? path.join(임시, 'diff-a') : null, c = 뒤b ? path.join(임시, 'diff-b') : null;
    if (a) fs.writeFileSync(a, 앞b);
    if (c) fs.writeFileSync(c, 뒤b);
    return 두파일차이(a, c, rel, 빈, 그대로 ? J : null);
  };
  // 설명으로 넘기는 JSON 모듈은 모듈 값의 구조 차이로(후보 원천 파일로 읽기를 확인한다 · 설계 주인 11-21), 안 되면 정리한 글 차이로 싣는다.
  const 설명차 = x => {
    const 표 = J && /\.json$/i.test(x.경로) ? J.모듈(x.경로, x.라이브글, x.후보글, 원천본.get(x.경로) ?? null) : null;
    return 표 ? `--- a/${x.경로}\n+++ b/${x.경로}\n${표}\n` : 파일차(Buffer.from(문장줄(x.라이브글)), Buffer.from(문장줄(x.후보글)), x.경로);
  };
  // 커밋 판 읽기는 블롭만(GPT 다시 검수 GC5) — 폴더 자리를 git show로 읽으면 트리 목록이 본문처럼 나와 소속 맞춤을 거짓으로 세운다.
  // 경로가 그 커밋에 없을 때만 「없음」이다. 그 밖의 읽기 실패는 소속을 거짓으로 세울 수 있어 멈춘다(GPT -c GE18).
  const 보기 = (c, p) => {
    let 꼴;
    try { 꼴 = git(저장소, ['cat-file', '-t', `${c}:${p}`]).trim(); }
    catch (e) { if (/does not exist|exists on disk, but not in|Not a valid object name|invalid object name/i.test(e.message)) return null; throw new Error(`커밋 판 읽기 실패: ${c.slice(0, 10)}:${p} — ${e.message.slice(0, 200)}`); }
    if (꼴 !== 'blob') return null;
    return git(저장소, ['cat-file', 'blob', `${c}:${p}`], { 버퍼: true });
  };
  const 표들 = new Map();
  for (const it of 할.filter(x => x.대조 === '모듈')) {
    const 표 = 묶음대조(앞판.get(it.경로), 후보항목.get(it.경로).b);
    if (!표) throw new Error(`모듈 대조: ${it.경로}를 모듈 표지로 나눌 수 없거나, 조각이 묶음을 다 덮지 않거나, 묶음 전체를 ES 모듈로 읽지 못한다 — 문자열 대조로 바꾸거나 명세를 고친다`);
    표들.set(it.경로, 표);
  }
  // 짝커밋은 (커밋 · 짝빌더)마다 한 번 짓는다(되돌림 없이 — 라이브가 그 커밋에서 지어졌는지 보는 것이다). 짝빌더가 있으면 준비 대본 없이 그
  // 빌더만 돌린다. 빌드가 실패한 커밋은 그 사실만 남는다(그 커밋으로 짝을 대지 못할 뿐이다).
  const 짝출력 = new Map(), 짝열쇠 = (c, it) => `${c}\0${JSON.stringify(it.짝빌더)}`;
  const 바뀐항목 = [...표들].filter(([, 표]) => 표.경로.some(x => x.꼴 === '바뀜')).map(([p]) => 명세.항목.find(it => it.경로 === p));
  for (const it of 바뀐항목) {
    for (const c of it.짝커밋.map(x => 커밋확인(저장소, x))) {
      const 열쇠 = 짝열쇠(c, it);
      if (짝출력.has(열쇠)) continue;
      const 곳 = path.join(임시, `pair-build-${짝출력.size + 1}`), 짝링크 = [], 출력 = new Map();
      알리기(`생성물: 짝커밋 ${c.slice(0, 10)}에서 묶음을 짓는다(라이브 모듈과 같은 코드인지 본다${it.짝빌더 ? ' · 짝빌더만' : ''})`);
      try {
        짓기({ 저장소, 커밋: c, 사본: 곳, 임시, 정보, 링크: 짝링크, 기록: 바탕기록, 되돌림: false, 시간, 알리기, 머리: `짝 ${c.slice(0, 10)} `, 빌더: it.짝빌더, 준비함: !it.짝빌더 });
        for (const x of 바뀐항목.filter(y => 짝열쇠(c, y) === 열쇠)) { const f = path.join(곳, x.짝만든곳); if (!링크마디(곳, x.짝만든곳) && fs.existsSync(f) && fs.statSync(f).isFile()) 출력.set(x.경로, fs.readFileSync(f)); }   // 위 마디 링크(밖 캐시)는 짝 출력으로 받지 않는다(GPT -c GE19)
      } catch (e) { if (e?.잇기위반) throw e; 바탕기록.push({ 단계: `짝 ${c.slice(0, 10)} 빌드 실패`, 명령: '-', 종료: -1, 끝글: String(e.message).split('\n')[0].slice(0, 300) }); }
      짝출력.set(열쇠, 출력);
      try { 링크걷기(짝링크); fs.rmSync(곳, { recursive: true, force: true, maxRetries: 3 }); } catch { 링크.push(...짝링크); }
    }
  }
  let 셈3 = 0, 셈4 = 0;
  for (const it of 할) {
    const r = 결과.find(x => x.경로 === it.경로), 까닭 = 정보.까닭.get(it.경로) ?? {};
    if (it.대조 === '모듈') {
      const 표 = 표들.get(it.경로), 몫 = 까닭.모듈 ?? {}, 없음 = [];
      // 짝 후보: 명세의 짝커밋 차례(새것부터 적는다) 다음 바탕 — 라이브와 같은 코드를 짓는 가장 앞의 커밋을 고른다(원천 차이가 가장 작다).
      // 지도: 그 판의 빌드 입력 지도(짝빌더로 지은 판은 빌더가 달라 재지 않는다 — Opus F4).
      const 후보판 = [...it.짝커밋.map(c => 커밋확인(저장소, c)).map(c => ({ 커밋: c, b: 짝출력.get(짝열쇠(c, it))?.get(it.경로) })),
        { 커밋: 바탕들.get(it.경로), b: 바탕출력.get(it.경로) }].filter(x => Buffer.isBuffer(x.b));
      // 짝 판도 라이브와 묶음 대조로 견준다(Opus F1): 그 모듈의 글이 같은 코드여도 맨 위 이름이 다른 모듈의 선언을 가리키거나 묶음 전체의 이름 짝이
      // 일대일이 아니면 그 판은 라이브와 같은 코드를 짓는 판이 아니다. 판마다 한 번만 견준다.
      const 짝표 = new Map();
      const 짝판표 = y => { if (!짝표.has(y)) { const t = 묶음대조(앞판.get(it.경로), y.b); 짝표.set(y, t ? new Map(t.경로.map(z => [z.경로, z])) : null); } return 짝표.get(y); };
      const 같은판 = (y, p) => { const z = 짝판표(y)?.get(p); return !!z && (z.꼴 === '같음' || z.꼴 === '같은 코드'); };
      for (const x of 표.경로) {
        if (x.꼴 === '바뀜') {
          // 맨 위 이름이 다른 모듈의 선언을 가리키게 된 모듈(참조)은 짝커밋의 글로 설명되지 않는다 — 까닭을 받는다(GPT GB6).
          const 맞음 = !x.참조 && 후보판.find(y => 같은판(y, x.경로));
          if (맞음) { x.꼴 = '원천 차이'; x.짝커밋 = 맞음.커밋; x.짝판 = 맞음; }
          else if (몫[x.경로]) { x.꼴 = '설명'; x.까닭 = 몫[x.경로]; }
          else 없음.push(`${x.경로}(바뀜 · ${x.참조 ? '맨 위 이름이 다른 모듈의 선언을 가리킨다' : '라이브와 같은 코드를 짓는 커밋이 없다'} — 첫 어긋남 ${x.어긋남})`);
        } else if (x.꼴 === '라이브에만') {
          if (몫[x.경로]) x.까닭 = 몫[x.경로]; else 없음.push(`${x.경로}(라이브에만)`);
        }
      }
      if (없음.length) throw new Error(`모듈 대조(${it.경로}): 까닭이 없는 모듈 ${없음.length}개 — ${없음.slice(0, 6).join(' / ')}${없음.length > 6 ? ' …' : ''}. 명세 까닭 파일의 모듈에 적거나 짝커밋을 더한다`);
      const 꼴별 = k => 표.경로.filter(x => x.꼴 === k);
      // 덧 항목은 큰 글자(A…)를 붙인다 — 묶음 도구가 큰 항목을 쪼갤 때 붙이는 작은 글자(a · b … · z<수>)와 겹치지 않게(GPT GB2).
      // 25개를 넘으면 Z<차례>를 붙인다 — 글자가 모자라 번호가 겹치면 하나만 실려도 둘 다 실린 것으로 보인다(GPT -c GE6).
      const 앞 = `G3${셈3++}`;
      const 묶음별 = new Map();
      // 원천 차이 모듈은 짝 판의 원천 차이와 함께 정리한 모듈 글 차이(라이브 → 후보)를 늘 싣는다(설계 검토 F1 · 대안 C): 그 모듈의 출력 변경은
      // 원천 파일 하나만이 아니라 빌드 입력(설정 · define · 원천경로 안의 곁 파일 · 빌더)에서도 온다. 원천 차이는 그 출력 변경의 설명이다.
      for (const x of 꼴별('원천 차이')) {
        const 앞b = 보기(x.짝커밋, x.경로), 뒤b = 원천본.get(x.경로) ?? null;
        const 모듈글차 = () => 파일차(Buffer.from(문장줄(x.라이브글)), Buffer.from(문장줄(x.후보글)), x.경로);
        const 글 = 앞b && 뒤b && 앞b.equals(뒤b) ? `--- ${x.경로}\n(짝커밋과 후보 원천의 이 파일 바이트가 같은데 묶음 안 모듈 글은 다르다 — 빌드 입력(설정 · define · 의존성) 차이에서 온 변경이다. 정리한 모듈 글 차이를 싣는다)\n${모듈글차()}`
          : 앞b || 뒤b ? `--- ${x.경로}\n(짝커밋 ${x.짝커밋.slice(0, 10)} → 후보 원천의 이 파일 차이와, 정리한 모듈 글 차이(라이브 → 후보)를 싣는다)\n${파일차(앞b, 뒤b, x.경로, true)}\n${모듈글차()}`
          : `--- ${x.경로}\n(짝커밋과 후보 원천 어디에도 파일이 없다 — 빌드가 지은 모듈이라 정리한 모듈 글 차이를 싣는다)\n${모듈글차()}`;
        (묶음별.get(x.짝커밋) || 묶음별.set(x.짝커밋, []).get(x.짝커밋)).push({ 경로: x.경로, 글 });
      }
      const 몸들 = [], 항목들 = [앞];
      let k = 0;
      for (const [c, xs] of 묶음별) {
        const id = `${앞}${덧글자(k++)}`; 항목들.push(id);
        몸들.push({ 앞: id, 제목: `생성물 모듈 원천 차이 — ${it.경로}: 라이브와 같은 코드를 짓는 커밋 ${c.slice(0, 10)} → 후보 원천(${원천.slice(0, 10)} + 되돌림) · 모듈 ${xs.length}개`, 몸: xs.map(x => x.글).join('\n') });
      }
      if (꼴별('후보에만').length) {
        const id = `${앞}${덧글자(k++)}`; 항목들.push(id);
        // 묶음에 실제로 든 코드를 싣는다(GPT 다시 검수 GC6) — 준비 대본이 원천 파일을 바꿔 넣었으면 준비 전 원천은 나가는 코드가 아니다. 원천은 출처 줄로 둔다.
        몸들.push({ 앞: id, 제목: `생성물 후보에만 있는 모듈 — ${it.경로}: ${꼴별('후보에만').length}개(라이브에 새로 나가는 코드 · 묶음 안 글)`, 몸: 꼴별('후보에만').map(x => {
          const 뒤b = 원천본.get(x.경로);
          const 출처 = 뒤b ? `(출처: 후보 원천(되돌린 뒤 · 준비 대본 전)의 ${x.경로} · sha256 ${sha(뒤b).slice(0, 12)} — 준비 대본이 바꾼 파일이면 묶음에는 바뀐 판이 든다. 아래가 실제로 나가는 코드다)` : '(후보 원천에 없는 모듈 — 빌드가 지은 모듈이다. 아래가 실제로 나가는 코드다)';
          return `--- /dev/null\n+++ b/${x.경로}(묶음 안 모듈 글 · 정리함)\n${출처}\n${문장줄(x.후보글)}`;
        }).join('\n') });
      }
      if (꼴별('설명').length) {
        const id = `${앞}${덧글자(k++)}`; 항목들.push(id);
        몸들.push({ 앞: id, 제목: `생성물 설명으로 넘기는 모듈 — ${it.경로}: ${꼴별('설명').length}개(라이브와 같은 코드를 짓는 커밋이 없다 · 까닭과 정리한 글 차이 · JSON 모듈은 값의 구조 차이)`, 몸: 꼴별('설명').map(x => `## ${x.경로}\n까닭: ${x.까닭}\n${x.참조 ? `어긋남: ${x.어긋남}\n` : ''}${설명차(x)}`).join('\n') });
      }
      // 모듈 차례(GPT GB8): 두 묶음에 다 있는 모듈의 실행 차례가 바뀌었으면 옮겨진 모듈과 그 앞뒤를 싣는다 — 몸이 같아도 전역 설정 · 등록 차례가 바뀔 수 있다.
      const 옮김 = 표.차례?.옮김 ?? [];
      if (옮김.length) {
        const id = `${앞}${덧글자(k++)}`; 항목들.push(id);
        const 이웃 = (줄들, p) => { const n = 줄들.indexOf(p); return `${줄들[n - 1] ?? '(처음)'} → [${p}] → ${줄들[n + 1] ?? '(끝)'}`; };
        몸들.push({ 앞: id, 제목: `생성물 모듈 차례가 바뀜 — ${it.경로}: ${옮김.length}개(두 묶음에 다 있는 모듈의 실행 차례가 다르다)`, 몸: [
          '두 묶음에 다 있는 모듈을 라이브 차례로 늘어놓고, 후보 차례가 그대로인 가장 긴 줄 밖의 모듈을 옮겨진 것으로 적었다. 모듈 몸이 같아도 실행 차례가 바뀌면 전역 설정 · 등록 차례가 달라질 수 있다.',
          '볼 것: 차례가 바뀐 까닭(가져오기 차례 변경 등)과, 옮겨진 모듈이 차례에 기대는 일(전역 값 쓰기 · 등록 · 덮어쓰기)을 하는지.', '',
          ...옮김.map(p => `- ${p}\n  라이브: ${이웃(표.차례.라이브, p)}\n  후보: ${이웃(표.차례.후보, p)}`)].join('\n') });
      }
      const 줄 = x => `- ${x.경로} · ${x.꼴}${x.짝?.length ? ` · 짝 ${x.짝.join(' ')}` : ''}${x.함수바뀜?.length ? ` · 이름이 바뀐 함수 · 클래스 ${x.함수바뀜.join(' ')}` : ''}${x.짝커밋 ? ` · 짝커밋 ${x.짝커밋.slice(0, 10)}` : ''}${x.까닭 ? ` · 까닭: ${x.까닭}` : ''}`;
      몸들.unshift({ 앞, 제목: `생성물 모듈 대조 — ${it.경로}(바탕 재현 안 됨 · 모듈 대조로 대신함): 같음 ${꼴별('같음').length} · 같은 코드 ${꼴별('같은 코드').length} · 원천 차이 ${꼴별('원천 차이').length} · 설명 ${꼴별('설명').length} · 후보에만 ${꼴별('후보에만').length} · 라이브에만 ${꼴별('라이브에만').length}${옮김.length ? ` · 차례 바뀜 ${옮김.length}` : ''}`, 몸: [
        '라이브 · 후보 묶음을 모듈 표지(`// <경로>`)로 나눠 경로별로 견줬다. 조각은 두 묶음의 바이트를 빠짐없이 덮는다. 같은 경로의 조각이 여럿이면(다른 모듈 사이에 나뉘어 실린 모듈) 조각마다 견주고, 조각 수가 다르면 바뀜이다. 차례는 「경로#몇 번째」(?v=는 뗀다)로 견준다.',
        `같은 코드: 두 모듈 글을 acorn(${나무판})으로 ES 모듈 구문 나무로 읽어 견줬다. 묶인 이름(모듈 안 선언과 묶음 맨 위 선언)만 esbuild 숫자 꼬리 짝으로 일대일 바뀌고, 전역 이름 · 속성 이름 · 열쇠 · 상수(값으로)는 그대로 같다. 읽지 못한 조각은 같은 코드로 보지 않는다. 증명에 짝을 남긴다. 이름이 바뀐 함수 · 클래스는 줄 끝에 따로 적었다 — 그 이름의 .name을 묶음 안에서 직접 읽으면(X.name · 그 클래스 안의 this.constructor.name · new.target.name) 바뀜으로 돌렸다. 값을 넘겨받아 읽는 .name은 보지 못한다(한계 — 꺼진 판 화면 대조가 받친다).`,
        '원천 차이: 라이브 모듈과 같은 코드를 짓는 커밋(짝커밋 · 바탕)에서 후보 원천까지의 그 파일 차이를 아래 항목에 싣는다. 이것이 이 묶음이 라이브에 싣는 변경이다. 짝 판은 라이브와 묶음 전체로 견줘 그 모듈이 같은 코드일 때만 고른다(맨 위 이름이 같은 선언을 가리킨다). 원천 차이 모듈은 정리한 모듈 글 차이(라이브 → 후보)도 늘 싣는다 — 출력 변경이 빌드 입력(설정 · define · 곁 파일 · 빌더)에서도 오기 때문이다.',
        '후보에만: 라이브에 새로 나가는 모듈의 묶음 안 글(정리함)과 그 원천 출처. 설명 · 라이브에만: 명세 까닭 파일의 까닭(라이브에서 사라지는 것이 무엇이고 왜 괜찮은지).',
        '볼 것: 원천 차이와 새 모듈이 의도한 변경뿐인지, 라이브에서 사라지는 것(설명 · 라이브에만)의 까닭이 맞는지.', '', ...표.경로.map(줄)].join('\n') });
      r.대조 = { 꼴: '모듈', 대신: '재현 안 됨 — 모듈 대조로 대신함', 항목들, 라이브조각: 표.라이브조각, 후보조각: 표.후보조각, 같음: 꼴별('같음').length,
        같은코드: 꼴별('같은 코드').map(x => ({ 경로: x.경로, 짝: x.짝, ...(x.함수바뀜?.length ? { 함수바뀜: x.함수바뀜 } : {}) })), 원천차이: 꼴별('원천 차이').map(x => ({ 경로: x.경로, 짝커밋: x.짝커밋 })),
        설명: 꼴별('설명').map(x => ({ 경로: x.경로, 까닭: x.까닭 })), 후보에만: 꼴별('후보에만').map(x => x.경로), 라이브에만: 꼴별('라이브에만').map(x => ({ 경로: x.경로, 까닭: x.까닭 })),
        ...(옮김.length ? { 차례바뀜: 옮김 } : {}) };
      자료.set(it.경로, { 꼴: '모듈', 몸들, 모듈들: 표.경로.map(x => x.경로).filter(p => !p.startsWith('(')) });
    } else {
      // 머리 입력 덮음(설계 검토 F3): 묶음 머리의 `// 경로` 입력 목록(계정 빌더가 metafile 입력을 싣는다)을 원천경로(+잇기)가 다 덮어야 한다 — 묶음에 든
      // 파일이 원천경로에서 빠지면 그 파일의 차이는 원천경로 밖 폴더별 수에만 남는다. 머리곳이 있으면 이 빌드가 사본에서 지은 그 중간 묶음의 머리를 읽는다
      // (마지막 빌더가 입력 이름을 바꿔 써도 실제 입력을 본다 — GPT 다시 검수 GC3). 도구가 검증할 수 없는 이름 짝은 받지 않는다.
      const 후보b = 후보항목.get(it.경로).b, 머리b = it.머리곳 ? 머리본.get(it.경로) : 후보b;
      if (!Buffer.isBuffer(머리b)) throw new Error(`문자열 대조(${it.경로}): 머리곳 ${it.머리곳}의 바이트가 없다`);
      // 머리곳이 후보의 실제 중간 묶음인지 기계로 본다(설계 주인 11-21 물음 1 (가) · GPT -c C1 · GE10): 머리곳에 머리바꿈을 적용한 바이트가 후보
      // 바이트와 같아야 한다. 다르면 이 항목은 문자열 대조로 대신하지 않고 본문 차이(라이브 → 후보)로 검수한다.
      if (it.머리곳) {
        const 적용 = 머리바꿈적용(머리b, it.머리바꿈 ?? []);
        if (!적용 || !적용.equals(후보b)) {
          r.대조못함 = `머리곳 ${it.머리곳}에 머리바꿈 ${(it.머리바꿈 ?? []).length}쌍을 적용한 바이트가 후보와 다르다 — 머리곳이 후보의 중간 묶음임을 보이지 못해 문자열 대조 대신 본문 차이로 검수한다`;
          알리기(`… 생성물 ${it.경로}: ${r.대조못함}`);
          continue;
        }
      }
      let 머리입력;
      try { 머리입력 = 머리입력읽기(머리b); } catch (e) { throw new Error(`문자열 대조(${it.경로}): ${e.message}`); }
      const 머리이름 = it.머리곳 ? `머리곳 ${it.머리곳}(이 빌드가 사본에서 지은 중간 묶음)` : '후보 묶음';
      const 덮임 = p => 명세.잇기.some(l => 파일안인가(p, l.경로)) || 원천안(p, it.원천경로, 명세.원천뺌);
      const 밖 = (머리입력 ?? []).filter(p => !덮임(p));
      if (밖.length) throw new Error(`문자열 대조(${it.경로}): ${머리이름} 머리의 입력 ${밖.length}개가 원천경로 밖이다 — ${밖.slice(0, 6).join(' · ')}${밖.length > 6 ? ' …' : ''}. 원천경로에 더하거나, 마지막 빌더가 입력 이름을 바꿔 쓰면 그 전에 지은 중간 묶음을 항목의 머리곳에 적는다`);
      // 머리곳이 후보 묶음을 지은 중간 묶음인지 본다: 두 머리 목록의 수가 같고, 후보 묶음 머리의 원천경로 안 입력이 모두 중간 묶음 머리에 있어야 한다.
      // 다른 데가 바꿔 쓴 이름뿐이다(후보 머리에만 — 원천경로 밖 · 중간 머리에만 — 원천 이름). 다른 묶음을 머리곳으로 대면 멈춘다.
      let 바꿔씀 = null;
      if (it.머리곳) {
        let 끝머리;
        try { 끝머리 = 머리입력읽기(후보b); } catch (e) { throw new Error(`문자열 대조(${it.경로}): 후보 묶음 — ${e.message}`); }
        if (!끝머리 || !머리입력) throw new Error(`문자열 대조(${it.경로}): 머리곳을 쓰려면 후보 묶음과 머리곳 ${it.머리곳} 머리에 다 입력 목록이 있어야 한다 — 두 목록을 견줘 같은 묶음인지 본다`);
        const 중간 = new Set(머리입력), 끝 = new Set(끝머리), 빠짐 = 끝머리.filter(p => 덮임(p) && !중간.has(p));
        바꿔씀 = { 후보에만: 끝머리.filter(p => !중간.has(p)), 중간에만: 머리입력.filter(p => !끝.has(p)) };
        if (끝머리.length !== 머리입력.length || 빠짐.length || 바꿔씀.후보에만.length !== 바꿔씀.중간에만.length) throw new Error(`문자열 대조(${it.경로}): 머리곳 ${it.머리곳}의 입력 목록이 후보 묶음 머리와 맞지 않는다(입력 ${머리입력.length}개 · 후보 ${끝머리.length}개${빠짐.length ? ` · 후보 머리의 원천경로 안 입력 ${빠짐.slice(0, 3).join(' · ')}이 중간 묶음에 없다` : ''}) — 후보 묶음을 지은 중간 묶음을 적는다`);
      }
      const 라이브b = 앞판.get(it.경로), s = 문자열대조(라이브b, 후보b), 무리 = 까닭.무리 ?? {};
      const 칸무리 = Object.fromEntries(값칸.map(k => [k, 까닭[k] ?? {}]));
      const 값들 = 값칸.flatMap(칸 => (s.라이브에만[칸] ?? []).map(v => ({ 칸, 값: v, 무리: Object.hasOwn(칸무리[칸], v) ? 칸무리[칸][v] : undefined })));
      const 없음 = 값들.filter(x => !Object.hasOwn(칸무리[x.칸], x.값)).map(x => `${x.칸} ${JSON.stringify(x.값).slice(0, 50)}`);
      if (없음.length) throw new Error(`문자열 대조(${it.경로}): 라이브에만 있는 값 ${없음.length}개에 까닭이 없다 — ${없음.slice(0, 8).join(' / ')}${없음.length > 8 ? ' …' : ''}. 명세 까닭 파일에 적는다`);
      // 소속 확인(설계 주인 11-21): 옮겨감 · 안 쓰임 · 손 판은 값이 후보 원천(되돌린 뒤)의 무리 파일에 있어야 하고, 커밋이 뺌은 그 커밋의 앞 판 파일에
      // 있고 그 커밋 판 파일에는 없어야 한다. 맞춤은 글맞춤 · 이름맞춤 · 값맞춤의 설명을 따른다(파일을 낱말로 읽어 주석을 뺀다 · GPT 다시 검수 GB15).
      // 되돌린 뒤 후보 원천과 커밋 판은 따로 읽는다 — 커밋이 뺌의 커밋이 원천과 같아도 그 커밋 판(git)을 본다(GPT GB12).
      const 글본 = new Map(), 본 = t => (t == null ? null : { 글: t, 낱말: null });
      const 원천읽기 = p => { const k = `원천\0${p}`; if (!글본.has(k)) 글본.set(k, 본(원천본.has(p) ? 원천본.get(p)?.toString('utf8') ?? null : 보기(원천, p)?.toString('utf8') ?? null)); return 글본.get(k); };
      const 읽기 = (c, p) => { const k = `커밋\0${c}\0${p}`; if (!글본.has(k)) 글본.set(k, 본(보기(c, p)?.toString('utf8') ?? null)); return 글본.get(k); };
      const 맞춤 = (x, 본) => (본 ? (x.칸 === '이름' ? 이름맞춤(x.값, 본) : x.칸 === '글' ? 글맞춤(x.값, 본) : 값맞춤(x.칸, x.값, 본)) : null);
      const 틀림 = [];
      for (const x of 값들) {
        const g = 무리[x.무리];
        let 못읽음 = null;
        for (const p of g.파일) {
          // 그 커밋 판에 값이 없다는 것은 그 판 파일이 없거나, 전체 구문 분석으로 읽혀 값을 못 찾을 때만 받는다 — 읽지 못한 판을 「없음」으로 세지 않는다(GPT -d GE3).
          if (g.꼴 === '커밋이 뺌') {
            const 앞k = 맞춤(x, 읽기(`${g.커밋}^`, p)), 뒤 = 읽기(g.커밋, p);
            if (앞k && 뒤 && !낱말확인(뒤)) 못읽음 = p;
            if (앞k && (!뒤 || (낱말확인(뒤) && !맞춤(x, 뒤)))) { x.맞춤 = 앞k; x.파일 = p; break; }
          }
          else {
            // 손 판 무리는 손 고침 대본이 라이브 묶음에 끼울 코드를 글자 상수로 지닌다(D · E 공개묶음 · 지하철 공개후보) — 그 상수의 값을 코드로 다시
            // 낱말로 나눠 같은 낱말이 있으면 「코드 글 안」이다. 다른 값의 일부(POSTCARD 안의 POST)는 여전히 받지 않는다(GPT 다시 검수 GB15).
            const 본 = 원천읽기(p), k = 맞춤(x, 본) || (g.꼴 === '손 판' && 본 && 맞춤(x, 코드글본(본)) ? '코드 글 안' : null);
            if (k) { x.맞춤 = k; x.파일 = p; break; }
          }
        }
        if (!x.맞춤) 틀림.push(`${x.칸} ${JSON.stringify(x.값).slice(0, 50)}(무리 ${x.무리} · ${g.꼴}: ${g.꼴 === '커밋이 뺌' ? `${g.커밋.slice(0, 10)}의 앞 판 파일에 있고 그 판에 없는 곳을 못 찾음${못읽음 ? ` — 그 판의 ${못읽음}을 전체 구문 분석으로 읽지 못해 없음을 증명하지 않았다` : ''}` : '후보 원천의 무리 파일에서 못 찾음'})`);
      }
      if (틀림.length) throw new Error(`문자열 대조(${it.경로}): 무리에 들지 않는 값 ${틀림.length}개 — ${틀림.slice(0, 6).join(' / ')}${틀림.length > 6 ? ' …' : ''}. 까닭 파일의 무리를 고친다`);
      const 앞 = `G4${셈4++}`;
      const 무리별 = Object.entries(무리).map(([이름, g]) => ({ 이름, ...g, 값들: 값들.filter(x => x.무리 === 이름) })).filter(g => g.값들.length);
      const 보기값 = xs => [...xs].sort((a, b) => a.값.length - b.값.length || (a.값 < b.값 ? -1 : 1)).slice(0, 3).map(x => { const t = JSON.stringify(x.값); return t.length > 50 ? `${t.slice(0, 49)}…` : t; }).join(' · ');
      const 칸글 = t => String(t).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
      const 라이브글 = 라이브b.toString('utf8'), 칸수 = (o, k) => o[k]?.length ?? 0, 셈칸 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.length]));
      const 수글 = x => `글 ${x.글} · 이름 ${x.이름} · 숫자 ${x.숫자 ?? 0} · 정규식 ${x.정규식 ?? 0}`, 에만글 = o => 값칸.map(k => `${k} ${칸수(o, k)}`).join(' · ');
      const 무리칸수 = (g, k) => g.값들.filter(x => x.칸 === k).length;
      // 값마다 라이브 묶음의 둘레 글(설계 검토 F2 ⓑ) — 검수자가 그 값이 라이브에서 무엇을 하던 값인지 본다.
      const 목록글 = [`# 라이브에만 있는 값과 까닭 무리 — ${it.경로}(한 줄에 값 하나 · 맞춤은 도구가 확인한 소속 · 둘레는 라이브 묶음에서 그 값을 처음 쓴 자리의 앞뒤 40자)`, '',
        ...값들.map(x => { const d = 둘레글(라이브글, s.라이브원형.get(`${x.칸}\0${x.값}`)); return `- ${x.칸} ${JSON.stringify(x.값)} — 무리 ${x.무리}(${무리[x.무리].꼴}) · ${x.파일} · ${x.맞춤}\n  둘레: ${d == null ? '(못 찾음)' : JSON.stringify(d)}`; }), ''].join('\n');
      const 머리글 = 머리입력
        ? `머리 입력: ${머리이름} 머리의 \`// 경로\` 입력 ${머리입력.length}개를 원천경로(+잇기)가 다 덮는다(도구가 확인했다).${바꿔씀 ? ` 후보 묶음 머리와 수가 같고 원천경로 안 입력이 모두 같다. 마지막 빌더가 바꿔 쓴 이름: 후보 머리 ${바꿔씀.후보에만.join(' · ') || '없음'} / 중간 머리 ${바꿔씀.중간에만.join(' · ') || '없음'}.` : ''}`
        : `머리 입력: ${머리이름} 머리에 \`// 경로\` 입력 줄이 없다 — 도구는 이 묶음에 든 원천 파일을 모른다. 원천경로가 묶음 입력을 다 덮는지는 명세를 쓴 사람이 맞춘 것이다.`;
      // 증거 파일에 쓸 글을 한 번 만들어 그 글로 증명의 해시도 낸다 — 파일 바이트와 증명 해시가 같다(GPT GB15).
      const 몸 = [`라이브 · 후보 묶음의 문자열 상수(따옴표 · 틀 글자 조각) · 속성 이름(점 뒤 · 객체 열쇠) · 숫자(값으로 — 1e3과 1000은 같다) · 정규식을 집합으로 견줬다(압축해도 이 넷은 남는다). 이 파일은 바탕 재현이 안 돼 문자열 대조로 대신한다(설계 주인 11-21).`,
        '보지 않는 것: 연산자(+ · - · < 같은 것과 부호), 흐름(조건 · 차례 · 부르기 구조), 점 뒤가 아닌 이름(지역 변수 · 함수 · 전역 이름). 이것만 바뀐 손 고침은 이 대조에 드러나지 않는다 — 원천 차이(G1…)와 함께 본다. 점 뒤가 아닌 이름은 까닭을 묻지 않고 집합 차이만 끝에 참고로 싣는다.',
        머리글,
        `수: 라이브 ${수글(s.수.라이브)} / 후보 ${수글(s.수.후보)}`,
        '라이브에만 있는 값은 까닭 무리로 묶어 싣는다. 도구가 값마다 무리 소속을 확인했다: 옮겨감 · 안 쓰임 · 손 판은 값이 후보 원천(되돌린 뒤)의 무리 파일에 있고, 커밋이 뺌은 그 커밋의 앞 판 파일에 있고 그 커밋 판에는 없다. 맞춤 「같음」은 그 파일의 문자열 상수 · 이름 낱말(주석 뺌) 가운데 값과 같은 것이 있다는 뜻이다(숫자는 같은 값). 「앞부분」은 여러 줄 값에만 쓴다 — 값의 4자 이상 첫 마디 앞 60자가 파일의 여러 줄 상수의 첫 마디와 같다. 「코드 글 안」은 손 판 무리에만 쓴다 — 손 고침 대본이 끼울 코드를 글자 상수로 지닐 때, 그 상수를 코드로 다시 낱말로 나눠 값과 같은 낱말이 있다.',
        `값 하나하나와 무리, 라이브 묶음의 둘레 글은 증명(생성물 항목의 대조 칸)과 증거 파일 생성물/대조-${앞}-…-목록.md에 한 줄씩 있다.`,
        '볼 것: 무리마다 까닭이 맞는지(특히 손 판 · 커밋이 뺌), 후보에만 있는 값이 원천 차이(G1…)로 설명되는지.', '',
        `## 라이브에만 있는 값 — 까닭 무리 ${무리별.length}개(${에만글(s.라이브에만)})`,
        '| 무리 | 꼴 | 파일 | 커밋 | 글 | 이름 | 숫자 · 정규식 | 같음 · 앞부분 | 보기 |', '|---|---|---|---|---|---|---|---|---|',
        ...무리별.map(g => `| ${칸글(g.이름)} | ${g.꼴} | ${칸글(g.파일.join(', '))} | ${g.커밋 ? g.커밋.slice(0, 10) : ''} | ${무리칸수(g, '글')} | ${무리칸수(g, '이름')} | ${무리칸수(g, '숫자')} · ${무리칸수(g, '정규식')} | ${g.값들.filter(x => x.맞춤 === '같음').length} · ${g.값들.filter(x => x.맞춤 === '앞부분').length}${g.값들.some(x => x.맞춤 === '코드 글 안') ? ` · 코드 글 안 ${g.값들.filter(x => x.맞춤 === '코드 글 안').length}` : ''} | ${칸글(보기값(g.값들))} |`),
        '', '### 무리의 까닭', ...무리별.map(g => `- ${g.이름}(${g.꼴}): ${g.까닭}`), '',
        `## 후보에만 있는 이름 ${s.후보에만.이름.length}개`, ...s.후보에만.이름.map(v => `- ${v}`), '',
        `## 후보에만 있는 글 ${s.후보에만.글.length}개`, ...s.후보에만.글.map(v => `- ${JSON.stringify(v)}`),
        ...['숫자', '정규식'].flatMap(k => (칸수(s.후보에만, k) ? ['', `## 후보에만 있는 ${k} ${칸수(s.후보에만, k)}개`, ...s.후보에만[k].map(v => `- ${v}`)] : [])),
        '', `## 참고 — 까닭 묻지 않음: 점 뒤가 아닌 이름의 집합 차이(라이브에만 ${s.참고이름.라이브에만.length}개 · 후보에만 ${s.참고이름.후보에만.length}개)`,
        '예약어와 리터럴 낱말(true · undefined · Infinity 같은 것)을 빼고 esbuild가 붙이는 꼬리 수(owners2의 2)를 뗀 집합이다. 설계 주인 11-21 결정으로 이 차이에는 까닭을 묻지 않는다.',
        '', `### 라이브에만 ${s.참고이름.라이브에만.length}개`, ...s.참고이름.라이브에만.map(v => `- ${v}`), '', `### 후보에만 ${s.참고이름.후보에만.length}개`, ...s.참고이름.후보에만.map(v => `- ${v}`)].join('\n');
      r.대조 = { 꼴: '문자열', 대신: '재현 안 됨 — 문자열 대조로 대신함(연산자 · 흐름 · 지역 이름은 보지 않음)', 항목들: [앞], 수: s.수,
        라이브에만: 셈칸(s.라이브에만), 후보에만: 셈칸(s.후보에만), 목록sha256: sha(목록글),
        머리입력: 머리입력 ? 머리입력.length : null, ...(it.머리곳 ? { 머리곳: it.머리곳, 바꿔씀 } : {}),
        참고이름: { 라이브에만: s.참고이름.라이브에만.length, 후보에만: s.참고이름.후보에만.length },
        무리: 무리별.map(g => {
          const 칸값 = k => g.값들.filter(x => x.칸 === k).map(x => x.값), n = 칸값('숫자'), rx = 칸값('정규식');
          return { 이름: g.이름, 꼴: g.꼴, 파일: g.파일, ...(g.커밋 ? { 커밋: g.커밋 } : {}), 까닭: g.까닭, 글: 칸값('글'), 이름들: 칸값('이름'),
            ...(n.length ? { 숫자: n } : {}), ...(rx.length ? { 정규식: rx } : {}), 앞부분: g.값들.filter(x => x.맞춤 === '앞부분').map(x => x.값),
            ...(g.값들.some(x => x.맞춤 === '코드 글 안') ? { 코드글안: g.값들.filter(x => x.맞춤 === '코드 글 안').map(x => `${x.칸} ${x.값}`) } : {}) };
        }) };
      자료.set(it.경로, { 꼴: '문자열', 몸들: [{ 앞, 제목: `생성물 문자열 대조 — ${it.경로}(바탕 재현 안 됨 · 문자열 대조로 대신함): 라이브에만 ${에만글(s.라이브에만)}(까닭 무리 ${무리별.length}개 · 소속 확인) · 후보에만 ${에만글(s.후보에만)} · ${머리입력 ? `머리 입력 ${머리입력.length}개 원천경로 안` : '머리 입력 줄 없음'} · 연산자 · 흐름 · 지역 이름은 보지 않음`, 몸 }],
        증거: [{ 이름: `대조-${앞}-${파일이름(it.경로)}-목록.md`, 글: 목록글 }] });
    }
  }
  return 자료;
}

const 파일이름 = s => String(s).replace(/[^0-9A-Za-z가-힣._-]+/g, '_').slice(0, 80);
/** 검수 폴더의 생성물/에 증거를 쓴다 — Fable 최종 자료가 이 파일을 보조 파일(해시 묶음)로 읽는다. 검수 폴더 상대 경로 목록(늘 생성물/…).
 *  곳: 쓸 폴더 이름. 페이블 다시 뜨기는 생성물.새에 써 두고 같은 판 확인을 지난 뒤에만 생성물/로 옮긴다(GPT 다시 검수 GC2 — 생성물옮기기). */
export function 생성물증거쓰기(폴더, 정보, 재현, { 곳: 곳이름 = '생성물', 앞판 = null } = {}) {
  const 곳 = path.join(폴더, 곳이름);
  if (곳이름 !== '생성물') fs.rmSync(곳, { recursive: true, force: true, maxRetries: 3 });
  fs.mkdirSync(곳, { recursive: true });
  // 증거 파일 이름이 겹치면(경로의 / · 대소문자를 _ · 같은 글자로 줄여 같은 이름이 됨) 뒤 파일이 앞 파일을 덮는다 — 멈춘다(GPT -d GE4).
  const 쓴 = [], 쓴열쇠 = new Set(), 쓰기 = (이름, 글) => {
    const k = 이름.toLowerCase();
    if (쓴열쇠.has(k)) throw new Error(`생성물 증거 파일 이름이 겹친다: ${이름} — 다른 항목의 증거가 덮이지 않게 멈춘다`);
    쓴열쇠.add(k); fs.writeFileSync(path.join(곳, 이름), 글); 쓴.push(`생성물/${이름}`);
  };
  쓰기('명세.json', 정보.원문);
  정보.대본.forEach((d, i) => 쓰기(`대본-${i + 1}-${d.역할}-${파일이름(path.basename(d.경로))}.txt`, d.글));
  쓰기('재현.json', `${JSON.stringify({ 원천: 재현.원천, 결과: 재현.결과, 기록: 재현.기록, 바탕기록: 재현.바탕기록 || [] }, null, 2)}\n`);
  재현.원천차이.forEach((d, i) => 쓰기(`원천차이-${i + 1}.patch`, `# 바탕 ${d.바탕} → 후보 원천(${재현.원천} + 되돌림) · 원천경로 ${d.원천경로.join(' ')} · 항목 ${d.항목.join(' ')}\n${d.글 || '(차이 없음)\n'}${d.입력증거 ? `\n${d.입력증거}\n` : ''}`));
  재현.되돌림차이.forEach(d => 쓰기(`되돌림-${d.커밋.slice(0, 10)}.patch`, d.글));
  for (const [p, x] of 재현.대조자료 || []) for (const m of x.몸들) 쓰기(`대조-${m.앞}-${파일이름(p)}.md`, `# ${m.제목}\n\n${m.몸}\n`);
  for (const [, x] of 재현.대조자료 || []) for (const e of x.증거 || []) 쓰기(e.이름, e.글);
  for (const x of 재현.JSON차이 || []) 쓰기(`JSON차이-${x.앞}-${파일이름(x.경로)}.md`, `# ${JSON차이제목(x)}\n\n${JSON차이글(x)}\n`);
  // 바탕 재현이 안 되고 대조로 대신하지 않은 항목은 Fable이 본문 차이(지금 공개본 → 후보 파일)를 본다. 그 공개본(후보 폴더 .앞판의 바이트)을
  // 검수 폴더에 고정해 보조 파일 해시로 묶는다 — 후보 폴더의 .앞판은 자료를 뜬 뒤 바뀌어도 해시 밖이라 Fable이 다른 앞판을 읽을 수 있었다(GPT -c GE9).
  for (const r of 재현.결과) if (r.바탕재현 !== true && !r.대조 && 앞판?.has(r.경로)) 쓰기(`앞판-${파일이름(r.경로)}`, 앞판.get(r.경로));
  return 쓴;
}
/** 페이블 다시 뜨기가 이 실행만의 폴더(곳이름)에 따로 쓴 증거를 생성물/로 바꿔 넣는다 — 같은 판 확인을 다 지난 뒤, 검수 폴더 잠금 안에서만
 *  부른다(GPT 다시 검수 GC2 · -c GE7). 옛 증거는 지우지 않고 옆(곳이름.옛)으로 옮겨 둔다: 바꿔 넣기가 실패하면 그 자리에서, 뒤의 증명 쓰기가
 *  실패하면 되돌리기로 제자리에 돌리고, 증명까지 다 쓴 뒤에 끝내기로 지운다(GPT -c GE8). 버리기: 거절됐을 때 새 폴더를 지운다. */
export function 생성물바꿔넣기(폴더, 곳이름) {
  const 새 = path.join(폴더, 곳이름), 곳 = path.join(폴더, '생성물'), 옛 = path.join(폴더, `${곳이름}.옛`);
  if (!fs.existsSync(새)) return { 끝내기: () => {}, 되돌리기: () => {} };
  const 있었음 = fs.existsSync(곳);
  if (있었음) fs.renameSync(곳, 옛);
  try { fs.renameSync(새, 곳); } catch (e) { if (있었음) fs.renameSync(옛, 곳); throw e; }
  return {
    // 옛 증거를 못 지우면 남겨 둔다 — 증명의 해시 밖이라 판정에 쓰이지 않는다. 여기서 던지면 이미 쓴 새 증명과 증거를 되돌리게 된다.
    끝내기: () => { if (있었음) { try { fs.rmSync(옛, { recursive: true, force: true, maxRetries: 3 }); } catch { /* 남김 */ } } },
    되돌리기: () => { fs.rmSync(곳, { recursive: true, force: true, maxRetries: 3 }); if (있었음) fs.renameSync(옛, 곳); },
  };
}
export const 생성물새버리기 = (폴더, 곳이름) => fs.rmSync(path.join(폴더, 곳이름), { recursive: true, force: true, maxRetries: 3 });
const JSON차이제목 = x => `생성물 JSON 구조 차이 — ${x.경로}: ${x.모듈 ? '라이브 묶음의 JSON 모듈 값 → 후보 묶음의 JSON 모듈 값' : `앞 ${x.앞sha256.slice(0, 12)} → 뒤 ${x.뒤sha256.slice(0, 12)}`} · 연산 ${x.연산수}개 · ${x.완전 ? '완전(적용하면 뒤 바이트가 그대로 나온다)' : '완전하지 않음 — 미충족'}`;

/** 덧 항목 글자 — 0…24는 A…Y, 그 뒤는 Z<차례>(Z25 · Z26 …). 쪼갠 조각의 작은 글자(a … z · z<수>)와 겹치지 않는다(GPT -c GE6). */
export const 덧글자 = k => (k < 25 ? 'ABCDEFGHIJKLMNOPQRSTUVWXY'[k] : `Z${k}`);
/** 검수 묶음에 넣을 항목 재료 — { 앞, 제목, 몸, 갈래 }. 검수묶음.mjs가 항목()으로 감싼다. */
export function 생성물항목들(정보, 재현) {
  const 줄 = r => `- ${r.경로} · 만든곳 ${r.만든곳} · 바탕 ${r.바탕.slice(0, 10)} · 후보 sha256 ${r.후보sha256} · 재현 sha256 ${r.재현sha256} · ${r.같음 ? '같음' : '다름'}`;
  const 단계 = x => `- ${x.단계}: ${x.명령} · 종료 ${x.종료}${x.신호 ? ` · ${x.신호}` : ''}${x.걸림ms != null ? ` · ${Math.round(x.걸림ms / 1000)}초` : ''}${x.파일 != null ? ` · 파일 ${x.파일}개` : ''}${x.실패해도 ? ` · 실패해도 된다(까닭: ${x.까닭})` : ''}`;
  const 바탕줄 = r => `- ${r.경로} · 라이브 sha256 ${r.라이브sha256 ?? '없음'} · 바탕 재현 sha256 ${r.바탕재현sha256 ?? '없음'} · ${r.바탕재현 ? '바탕 재현 같음 · 반사실 빌드(바탕 판에 후보 원천경로를 덮어 지음)도 후보와 같음 — 원천 차이로 검수한다'
    : r.대조 ? `바탕 재현 안 됨(${r.바탕까닭}) — ${r.대조.대신}: [${r.대조.항목들.join('] [')}]를 검수한다` : `바탕 재현 안 됨(${r.바탕까닭}) — 이 항목은 본문 차이(라이브 → 후보)를 검수한다${r.대조못함 ? `(${r.대조못함})` : ''}`}`;
  const 끝글 = [...재현.기록, ...(재현.바탕기록 || [])].filter(x => x.끝글 && (x.종료 !== 0 || x.실패해도)).map(x => `#### ${x.단계} ${x.명령}의 끝 출력\n${x.끝글}`);
  const 재현됨 = 재현.결과.filter(r => r.바탕재현 === true).length;
  const 목록 = [{ 앞: 'G00', 제목: `생성물 재현 — 결과 · 바탕 재현 · 단계 · 명세(생성물 ${재현.결과.length}개 · 바탕 재현 ${재현됨}개는 본문 대신 이 증거로 본다)`, 몸: [
    '도구가 명세의 원천 커밋을 임시 사본으로 꺼내 되돌림 · 준비 · 빌더를 차례로 돌려 다시 지었고, 아래 결과가 후보와 sha256이 같다. 하나라도 다르면 준비가 멈춘다.',
    '라이브 판이 바탕 커밋에서 그대로 다시 지어진 항목(바탕 재현 같음)은 본문과 앞 공개본 차이를 싣지 않고 이 증거와 원천 차이로 본다. 바탕 재현이 안 된 항목은 원천 차이가 실제로 나가는 바이트 차이를 다 말하지 못하므로 배포 후보 항목에 본문 차이(라이브 → 후보)를 싣는다(설계 주인 11-20 저녁 · 11-21).',
    '볼 것: 원천 차이(G1…)가 의도한 변경뿐인지, 되돌림 대본과 되돌림 목록(G2…)이 「아직 공개하지 않은 다른 일」을 빠짐없이 · 그것만 되돌리는지, 빌더 명령과 실패해도 되는 단계의 까닭이 맞는지.',
    '두 판이 다 있는 JSON 파일은 줄 차이 대신 열쇠 단위 구조 차이(G5…)로 한 번만 싣고 다른 자리는 그 항목을 가리킨다. 도구가 앞 값에 연산을 적용해 같은 쓰기 꼴로 쓰면 뒤 바이트가 그대로 나오는지 확인했다(완전 — 아니면 미충족). 모듈 대조로 대신한 항목만 쓰는 원천 차이(G1…)는 모듈 원천 차이(G3…)가 대신 싣는다.',
    '', `원천 커밋: ${재현.원천}`, '결과:', ...재현.결과.map(줄), '', '바탕 재현(라이브 판이 바탕 커밋에서 다시 지어지는가):', ...재현.결과.map(바탕줄),
    '', '단계:', ...재현.기록.map(단계), ...((재현.바탕기록 || []).length ? ['', '바탕 재현 단계:', ...재현.바탕기록.map(단계)] : []),
    ...(끝글.length ? ['', ...끝글] : []), '', `명세(sha256 ${정보.sha256}):`, 정보.원문.trimEnd()].join('\n'), 갈래: '코드' }];
  // 까닭 파일은 대조 항목(G3 · G4)이 값마다 까닭을 옮겨 싣는다 — 같은 글을 두 번 싣지 않는다(파일은 증명에 해시로 묶인다).
  정보.대본.filter(d => d.역할 !== '까닭').forEach((d, i) => 목록.push({ 앞: `G0${i + 1}`, 제목: d.역할 === '입력' ? `생성물 빌더 입력 파일 ${path.basename(d.경로)} — 빌더 인자가 가리키는 사본 밖 파일(sha256 ${d.sha256})` : `생성물 ${d.역할} 대본 ${path.basename(d.경로)} (sha256 ${d.sha256})`, 몸: d.글, 갈래: '코드' }));
  // 모듈 대조로 대신한 항목만 쓰는 원천 차이의 원천 쪽은 싣지 않는다(설계 주인 11-21). 원천경로 밖 빌드 입력 차이는 늘 싣는다(Opus F3).
  // 번호는 원천 차이 차례 그대로다(증거 파일 원천차이-n과 맞춘다).
  재현.원천차이.forEach((d, i) => {
    if (d.실림 === false) return;
    const 원천쪽 = d.원천실림 === false ? [`(이 원천 차이를 쓰는 항목은 모듈 대조로 대신해, 묶음 모듈의 원천 차이는 모듈 대조(G3…)가 모듈별로 싣는다 — 여기에는 원천경로 안 · 묶음 모듈이 아닌 파일 ${d.비모듈수 ?? 0}개의 차이와 원천경로 밖 빌드 입력 차이를 싣는다)`, d.비모듈글].filter(Boolean).join('\n') : d.글 || '(차이 없음)';
    목록.push({ 앞: `G1${i}`, 제목: `생성물 원천 차이 — 바탕 ${d.바탕.slice(0, 10)} → 후보 원천(${재현.원천.slice(0, 10)} + 되돌림) · ${d.항목.join(', ')} · 원천경로 ${d.원천경로.join(' ')} · 바뀐 파일 ${d.바뀐파일}/${d.본파일}${d.입력 ? ` · 원천경로 밖 빌드 입력 ${d.입력.바뀐.length}개` : ''}`,
      몸: [원천쪽, d.입력글].filter(Boolean).join('\n\n'), 갈래: '코드' });
  });
  재현.되돌림차이.forEach((d, i) => 목록.push({ 앞: `G2${i}`, 제목: `생성물 되돌림 목록 ${d.커밋.slice(0, 10)} — 이 커밋이 원천경로에서 바꾼 것(되돌림 대본이 이것을 걷는다)${d.밖 ? ` · 원천경로 밖 빌드 입력 ${d.밖}개` : ''}`, 몸: d.글, 갈래: '코드' }));
  for (const [, x] of 재현.대조자료 || []) for (const m of x.몸들) 목록.push({ 앞: m.앞, 제목: m.제목, 몸: m.몸, 갈래: '코드' });
  for (const x of 재현.JSON차이 || []) 목록.push({ 앞: x.앞, 제목: JSON차이제목(x), 몸: JSON차이글(x), 갈래: '코드' });
  // 번호가 겹치거나 대조가 가리키는 번호가 없으면 묶음 판정이 다른 항목을 실린 것으로 볼 수 있다 — 멈춘다(GPT -c GE6).
  const 앞들 = 목록.map(x => x.앞), 겹침 = [...new Set(앞들.filter((a, i) => 앞들.indexOf(a) !== i))];
  if (겹침.length) throw new Error(`생성물 항목 번호가 겹친다: ${겹침.join(', ')} — 묶음 판정이 한 항목만 보고 둘 다 실렸다고 볼 수 있어 멈춘다`);
  const 없는번호 = 재현.결과.flatMap(r => r.대조?.항목들 || []).filter(id => !앞들.includes(id));
  if (없는번호.length) throw new Error(`생성물 대조가 가리키는 항목 번호가 묶음 재료에 없다: ${[...new Set(없는번호)].join(', ')}`);
  return 목록;
}
