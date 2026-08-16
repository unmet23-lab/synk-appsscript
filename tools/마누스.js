#!/usr/bin/env node
'use strict';
/**
 * 마누스 — **「밖의 사실」 적대 심문**을 세션 밖으로 던지는 통로 하나.
 *
 * ■ 왜 있나 (유호 지시 2026-08-16)
 *   지금 검수는 **코드 한 축뿐**이다(`codex-review.js`). 그런데 틀리면 돈이 걸리는 축은
 *   따로 있다 — 법령·업종코드·FDI·상표·시세. 그 층은 지금 세션 안에서 검색 한 번으로
 *   판정되고, 적대 반박 패스도 없고, 기록도 안 남는다. **코드는 두 번 보는데 돈은 한 번도
 *   안 본다.** 이 파일이 그 자리다.
 *
 * ■ 왜 마누스인가 — 「똑똑해서」가 아니다
 *   스택에서 **노트북을 닫아도 도는 유일한 계산기**라서다(클로드 세션=죽음 · 헤르메스=PC와
 *   함께 죽음 · Actions=한도 소진). 30~80분짜리 조사를 세션 수명에서 떼어내는 것이 값이다.
 *
 * ■ 🔑 왜 «로컬 폴러»를 띄우는가 (이 파일의 유일한 설계 판단)
 *   줍기는 이미 `review-runs` 훅 + `lib/검수런.js` 가 한다 — **새 훅을 안 만든다.** 그런데
 *   그 판정기는 런의 생사를 **로컬 pid** 로 본다(`살아있나`). 마누스 작업은 클라우드에 살아
 *   pid 가 없으니, 그냥 등록하면 **던지자마자 「멈춤 · 프로세스 없음」으로 오판**된다.
 *   → 그래서 던지기가 로컬 폴러 자식을 띄운다. 그 순간 codex 런과 **글자까지 같은 모양**이
 *     되고, 훅·판정기·처분 도장이 전부 그대로 재사용된다. 장치 +1 이 아니라 +0 이다.
 *
 * ■ 대가 (틀릴 때의 모습 — 규칙대로 적는다)
 *   ① **그럴듯한 오답이 제일 위험하다.** 산출물은 «반박문»이지 «판정»이 아니다 — 최종 판정은
 *      사람·세션이 진다. 그래서 결과 파일 머리에 그 문장을 박는다.
 *   ② 노트북이 닫히면 **폴러만 죽고 마누스는 계속 돈다.** 그때 런은 「멈춤」으로 보이는데
 *      실제로는 살아 있다 — 그 둘을 가르려고 `--이어받기` 가 있다(재던지기 아님 · 크레딧 0).
 *   ③ 크레딧은 유한하다(무료 등급 = 하루 300 · 조사 1건 200~500). 한 발이 하루치다.
 *   ▶ 닫을 것 1개: 없다. 이 축은 새 층이고 대체하는 옛 통로가 0이다(추가임을 밝힌다).
 *
 * ■ 사용
 *   node tools/마누스.js --크레딧
 *   node tools/마누스.js --작업목록 [개수]     # 계정에 **실제로** 있는 작업(크레딧 0 · 유령 id 판별)
 *   node tools/마누스.js --던지기 "<질문>" [--라벨 "짧은 이름"]
 *   node tools/마누스.js --런목록
 *   node tools/마누스.js --이어받기 <런ID>     # 폴러가 죽었을 때 다시 붙는다
 *   node tools/마누스.js --폴러 <런ID>          # 내부용(던지기가 띄운다) — 직접 부르지 않는다
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const 런 = require(path.join(ROOT, 'tools', 'lib', '검수런.js'));

const 종류 = '사실심문';
const API = 'https://api.manus.ai/v2';
const 결과방 = path.join(ROOT, 'docs', '_ops', '사실심문');
const 장부 = path.join(ROOT, 'docs', '_ops', '사실심문기록.jsonl');

/* 폴링 간격 — 마누스 작업은 25~80분이 정상이라 촘촘히 볼 값이 없다.
 * 상한은 「영원히 도는 폴러」를 막는 것이지 작업을 끊는 것이 아니다(마누스는 계속 돈다). */
const 폴링초 = 60;
const 폴러상한분 = 180;

/** 키는 **파일에서만** 읽는다 — 환경변수 안내는 리터럴 키를 셸 기록에 남긴다(`모델정책.js` 와 같은 축). */
const 키경로 = () => process.env.MANUS_KEY_PATH || 'C:/Users/q1212/SYNK_보안/마누스.txt';

function 키() {
  const p = 키경로();
  let s;
  try { s = fs.readFileSync(p, 'utf8'); } catch (_) {
    throw new Error(`마누스 키 파일을 못 읽었다: ${p}\n  → 발급: https://manus.im/app?show_settings=integrations&app_name=api`);
  }
  /* 주석·빈 줄을 걷어낸다 — 안내문이 남은 파일을 키로 보내면 401 이 나는데, 그 401 은
   * 「키가 틀렸다」로 읽혀 사람이 엉뚱한 곳을 고친다. */
  const 값 = s.split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#'))[0];
  if (!값) throw new Error(`키 파일이 비어 있다: ${p}`);
  return 값;
}

async function 부르기(경로, { method = 'GET', body = null } = {}) {
  if (typeof fetch !== 'function') throw new Error('이 node 에 fetch 가 없다 — node 18+ 가 필요하다');
  const res = await fetch(`${API}/${경로}`, {
    method,
    headers: { 'x-manus-api-key': 키(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const 원문 = await res.text();
  let j = null;
  try { j = JSON.parse(원문); } catch (_) { /* 파싱 실패는 아래서 원문째로 드러낸다 */ }
  if (!res.ok) throw new Error(`마누스 ${경로} → HTTP ${res.status}\n  ${원문.slice(0, 400)}`);
  if (j == null) throw new Error(`마누스 ${경로} → JSON 이 아니다\n  ${원문.slice(0, 400)}`);
  return j;
}

/* 응답에서 작업 id 를 캔다. 벤더 문서가 생성 응답의 필드명을 안 적어 뒀으므로 **추정하지 않고
 * 후보를 훑되, 못 찾으면 원문을 통째로 드러내고 멈춘다** — 폴백으로 빈 id 를 흘리면 폴러가
 * 영원히 헛돌고 그게 「도는 중」과 같은 모양이 된다. */
function 작업ID캐기(j) {
  const 후보 = [j && j.task_id, j && j.id, j && j.data && j.data.task_id, j && j.data && j.data.id];
  const v = 후보.find((x) => typeof x === 'string' && x);
  if (!v) throw new Error(`생성 응답에서 task_id 를 못 찾았다 — 원문:\n${JSON.stringify(j).slice(0, 600)}`);
  return v;
}

/* 생성 요청 몸통 — **순수 함수다.** 갈리는 판단을 한 곳에 모아 회귀가 닿게 한다.
 * ⚠ 모양은 실물에서 왔다. 벤더 문서 `task-lifecycle.md` 는 `{prompt}` 라고 적어 뒀는데
 *   실제 API 는 400 `message.content is required` 를 낸다(2026-08-16 실측 · 회귀가 못박는다).
 *   → 문서를 근거로 `prompt` 로 되돌리지 마라. 되돌리는 순간 전 호출이 400 이다.
 * ⚠ `agent_profile` 은 **일부러 안 보낸다** — 등급마다 쓸 수 있는 프로필이 달라(무료=lite)
 *   박아 두면 등급이 바뀌는 날 조용히 깨진다. 계정 기본값에 맡긴다. */
function 생성몸통(질문, 라벨) {
  if (!질문 || !String(질문).trim()) throw new Error('질문이 비어 있다 — 빈 작업을 만들면 크레딧만 탄다');
  return { message: { content: String(질문) }, ...(라벨 ? { title: String(라벨) } : {}) };
}

/* 조회 오류가 «회복 불가»인가 — 같은 요청을 다시 보내도 영영 같은 답인가.
 *
 * 🔑 왜 필요한가 (실측 F509): 폴러는 조회 실패를 **전부** 「일시 오류」로 보고 60초 뒤 다시 물었다.
 *   없는 작업 id 에 대고 `404 not_found` 를 **167회 · 180분** 반복했고, 그동안 런은 「도는 중」
 *   이었다. 원래 주석은 「일시 오류로 폴러를 죽이지 않는다」고 전제를 적어 뒀는데, 그 전제가
 *   안 맞는 오류가 있다는 것을 안 적었다 — 그래서 전제가 깨진 날 아무도 못 봤다.
 *
 * ⚠ 새는 방향을 골랐다: **모르면 «일시»로 본다**(false). 회복 가능한 것을 회복 불가로 접으면
 *   도는 작업을 끊고 크레딧을 버리는데, 그건 비가역이다. 반대로 접으면 최대 상한분만 늦다.
 *   그래서 HTTP 코드를 못 읽은 오류(네트워크·JSON 파싱)는 전부 재시도 쪽으로 남긴다. */
function 회복불가인가(메시지) {
  const m = /HTTP (\d{3})/.exec(String(메시지 == null ? '' : 메시지));
  if (!m) return false;                                    // 코드를 못 읽었다 = 네트워크·파싱 — 다음 회차에 통할 수 있다
  const 코드 = Number(m[1]);
  if (코드 === 408 || 코드 === 425 || 코드 === 429) return false;   // 시간·혼잡 — 기다리면 풀린다
  return 코드 >= 400 && 코드 < 500;                        // 나머지 4xx = 요청 자체가 틀렸다
}

function 장부적기(줄) {
  fs.mkdirSync(path.dirname(장부), { recursive: true });
  fs.appendFileSync(장부, JSON.stringify(줄) + '\n', 'utf8');   // append-only — 행 삭제 금지
}

// ── 던지기 ────────────────────────────────────────────────────────────────
async function 던지기(질문, 라벨) {
  if (!질문) { console.error('질문이 없다 — node tools/마누스.js --던지기 "<질문>"'); return 2; }

  /* ⚠ 몸통 모양은 **실물에서 왔다.** 벤더 문서 `task-lifecycle.md` 는 `{prompt}` 라고 적어
   *   뒀는데 실제 API 는 400 `message.content is required` 를 낸다(2026-08-16 실측).
   *   → 문서를 근거로 `prompt` 로 되돌리지 마라. 되돌리는 순간 전 호출이 400 이다.
   * ⚠ `agent_profile` 은 **일부러 안 보낸다** — 등급마다 쓸 수 있는 프로필이 달라(무료=lite)
   *   박아 두면 등급이 바뀌는 날 조용히 깨진다. 계정 기본값에 맡긴다. */
  const 작업 = await 부르기('task.create', { method: 'POST', body: 생성몸통(질문, 라벨) });
  const 작업id = 작업ID캐기(작업);

  /* 🔑 캔 id 를 **한 번 써 본다** — 읽기 전용이라 크레딧 0이고 1초면 끝난다.
   *
   * 실측 F509: 생성이 HTTP 200 과 id 를 냈는데 그 id 가 계정 어디에도 없었다
   *   (`task.list` 3건 중 0건 · 크레딧 소모 0 · 그 시각에 만들어진 작업 자체가 없었다).
   *   던지기는 그걸 모른 채 폴러를 띄웠고, 폴러는 404 를 167회 물으며 **3시간**을 태웠다.
   *   확인은 한 번이면 되는데 안 해서, 「모른다」가 「도는 중」의 얼굴로 3시간을 살았다.
   *
   * ⚠ 일시 오류로 여기서 막지 않는다 — 마누스는 이미 돌고 있을 수 있고(크레딧은 이미 탔다),
   *   확인 실패를 곧 작업 실패로 접으면 멀쩡한 작업을 버리게 된다. 회복 불가일 때만 멈춘다. */
  try {
    await 부르기(`task.listMessages?task_id=${encodeURIComponent(작업id)}&limit=1`);
  } catch (e) {
    if (회복불가인가(e.message)) {
      console.error('🔴 생성은 200 인데 **그 작업 id 가 안 열린다** — 폴러를 띄우지 않는다(3시간을 태우지 않으려고).');
      console.error(`   캔 id: ${작업id}`);
      console.error(`   조회 오류: ${e.message}`);
      console.error(`   생성 응답 원문: ${JSON.stringify(작업).slice(0, 600)}`);
      console.error('   → 위 원문에 **진짜** task id 필드가 따로 있는지 본다(`작업ID캐기` 후보 4개 밖일 수 있다).');
      return 2;
    }
    console.error(`⚠ 작업 id 확인이 «일시» 오류로 실패했다(${e.message}) — 판정을 미루고 폴러는 그대로 띄운다.`);
  }

  const 런ID = 런.런ID발급(종류);
  const 로그 = 런.로그경로(런ID);
  fs.mkdirSync(path.dirname(로그), { recursive: true });

  let child;
  const fd = fs.openSync(로그, 'a');
  try {
    child = spawn(process.execPath, [__filename, '--폴러', 런ID], {
      cwd: ROOT, detached: true, windowsHide: true,
      stdio: ['ignore', fd, fd],
      env: { ...process.env, SYNK_REVIEW_RUN_ID: 런ID },
    });
    child.unref();
  } catch (e) {
    console.error(`🔴 폴러를 못 띄웠다(${e.message}) — 마누스 작업 ${작업id} 는 이미 돌고 있다.`);
    console.error(`   나중에 붙으려면: node tools/마누스.js --이어받기 ${런ID}`);
    return 2;
  } finally { fs.closeSync(fd); }

  런.런쓰기({
    런ID, 종류, 로그, pid: child.pid,
    작업id, 질문,
    /* 생성 응답 원문을 남긴다 — F509 때 이걸 안 남겨서, 사후에 **어느 필드를 집었는지**를
     * 원리상 못 쟀다(장부엔 캔 id 하나뿐이었다). 진단이 안 되는 실패는 두 번 난다. */
    생성응답: JSON.stringify(작업).slice(0, 1000),
    시작: new Date().toISOString(), 상태: '진행',
    대상: (라벨 || 질문).replace(/\s+/g, ' ').slice(0, 80),
    세션: process.env.CLAUDE_CODE_HOST_SESSION_ID || '',
  });
  장부적기({ 때: new Date().toISOString(), 일: '던짐', 런ID, 작업id, 라벨: 라벨 || '', 질문 });

  console.log(`🚀 던졌다 — 이 세션이 끝나도 마누스는 계속 돈다.`);
  console.log(`   런 ${런ID} · 마누스 작업 ${작업id} · 폴러 pid ${child.pid}`);
  console.log(`   로그: ${로그}`);
  console.log(`   **기다리지 마라.** 결과는 세션을 새로 열 때 review-runs 훅이 알린다.`);
  return 0;
}

// ── 폴러(자식) ────────────────────────────────────────────────────────────
const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 폴러(런ID) {
  /* 부모가 런을 적기 전에 자식이 먼저 깰 수 있다 — 그 창은 밀리초지만 실재한다. */
  let r = null;
  for (let i = 0; i < 30 && !(r && r.작업id); i++) { r = 런.런읽기(런ID); if (!(r && r.작업id)) await 잠깐(1000); }
  if (!(r && r.작업id)) { console.error(`[폴러] 런 ${런ID} 에서 작업id 를 못 읽었다 — 멈춘다`); return 2; }
  return 붙기(런ID, r);
}

async function 붙기(런ID, r) {
  const 마감 = Date.now() + 폴러상한분 * 60 * 1000;
  console.log(`[폴러] 런 ${런ID} · 작업 ${r.작업id} · ${폴링초}초마다 본다`);

  while (Date.now() < 마감) {
    let j;
    try {
      j = await 부르기(`task.listMessages?task_id=${encodeURIComponent(r.작업id)}&order=desc&limit=30`);
    } catch (e) {
      /* 🔑 회복 불가와 일시 오류를 **가른다**(F509: 안 갈라서 404 를 167회·180분 물었다).
       * 회복 불가면 기다림이 값을 못 낸다 — 그 자리에서 실패로 끝내고 사람에게 넘긴다. */
      if (회복불가인가(e.message)) {
        const 코드 = 4;
        런.런갱신(런ID, {
          상태: 런.상태이름(코드), 끝: new Date().toISOString(), 종료코드: 코드,
          비고: `조회가 회복 불가로 끝났다 — ${String(e.message).split('\n')[0]}`,
        });
        장부적기({ 때: new Date().toISOString(), 일: '실패', 런ID, 작업id: r.작업id, 왜: '조회 회복불가', 오류: String(e.message).slice(0, 400) });
        console.error(`[폴러] 🔴 회복 불가 — 다시 물어도 같은 답이다. 멈춘다(재시도로 시간을 태우지 않는다).`);
        console.error(`  ${e.message}`);
        console.error(`  작업 id 가 계정에 실재하는지부터 본다: node tools/마누스.js --작업목록`);
        return 1;
      }
      /* 일시 오류로 폴러를 죽이지 않는다 — 죽으면 「멈춤」으로 보이고 사람이 재던져 크레딧을 또 태운다. */
      console.error(`[폴러] 조회 실패(다음 회차에 다시 본다): ${e.message}`);
      await 잠깐(폴링초 * 1000);
      continue;
    }

    const 상태 = String(j.task_status || j.status || (j.data && j.data.task_status) || '').toLowerCase();
    console.log(`[폴러] ${new Date().toISOString()} 상태=${상태 || '(빈값)'}`);

    /* ⚠ 아래 세 종료 경로의 `상태` 는 **손으로 적지 않는다.** F509 실측: 여기서 셋 다 '완주'
     * 라고 적어 두는 바람에, 결과가 0바이트인 종료코드 3 이 「✅ 완주」로 장부에 앉았다.
     * 이름은 `검수런.상태이름(종료코드)` 한 곳에서만 나온다(codex-review 와 같은 규칙). */
    if (상태 === 'stopped' || 상태 === 'error') {
      const 코드 = 상태 === 'stopped' ? 0 : 1;
      결과쓰기(런ID, r, 상태, j);
      런.런갱신(런ID, { 상태: 런.상태이름(코드), 끝: new Date().toISOString(), 종료코드: 코드, 마누스상태: 상태 });
      장부적기({ 때: new Date().toISOString(), 일: 런.상태이름(코드), 런ID, 작업id: r.작업id, 마누스상태: 상태 });
      console.log(`[폴러] 끝 — ${상태}`);
      return 코드;
    }
    if (상태 === 'waiting') {
      /* 사람 확인을 요구하는 상태다. 우리 규약상 자동 승인은 안 한다 — 드러내고 멈춘다.
       * 결과 파일은 쓴다(원문이 들어 있다). 그래도 '완주'가 아니다 — 답이 안 끝났기 때문이다. */
      const 코드 = 2;
      결과쓰기(런ID, r, 상태, j);
      런.런갱신(런ID, { 상태: 런.상태이름(코드), 끝: new Date().toISOString(), 종료코드: 코드, 마누스상태: 'waiting', 비고: '마누스가 사람 확인을 기다린다 — 결과 파일은 있다' });
      장부적기({ 때: new Date().toISOString(), 일: '대기', 런ID, 작업id: r.작업id });
      console.log(`[폴러] 마누스가 사람 확인을 기다린다 — 자동 승인하지 않는다.`);
      return 코드;
    }
    await 잠깐(폴링초 * 1000);
  }

  const 코드 = 3;
  런.런갱신(런ID, { 상태: 런.상태이름(코드), 끝: new Date().toISOString(), 종료코드: 코드, 비고: `폴러 상한 ${폴러상한분}분 초과 — 결과 파일 없음 · 마누스는 계속 돌고 있을 수 있다` });
  /* 종결 행을 장부에도 적는다 — F509 때 이게 없어서 append-only 장부가 「던짐」 한 줄로 끝났고,
   * 장부만 보면 그 실탄이 아직 도는 것처럼 보였다. */
  장부적기({ 때: new Date().toISOString(), 일: '상한초과', 런ID, 작업id: r.작업id, 상한분: 폴러상한분 });
  console.log(`[폴러] 상한 ${폴러상한분}분 초과 — 다시 붙으려면 --이어받기 ${런ID}`);
  return 코드;
}

function 결과쓰기(런ID, r, 상태, j) {
  fs.mkdirSync(결과방, { recursive: true });
  const 목록 = Array.isArray(j.messages) ? j.messages : (Array.isArray(j.data) ? j.data : []);
  /* order=desc 로 받았으니 읽는 순서는 뒤집는다 — 사람이 위에서 아래로 읽는다. */
  const 말 = 목록.slice().reverse()
    .filter((m) => /assistant/i.test(String(m.type || m.role || m.event_type || '')))
    .map((m) => String(m.content || m.text || m.message || '')).filter(Boolean);

  const 본문 = [
    `# 사실 심문 — ${r.대상 || r.질문 || 런ID}`,
    '',
    `> ⚠ **이것은 «반박문»이지 «판정»이 아니다.** 마누스가 그럴듯하게 틀릴 수 있고, 그때 이 파일은`,
    `> 「검수 통과」의 얼굴을 한다. 최종 판정은 사람·세션이 진다 — 여기 적힌 근거를 원문까지 열고 쓴다.`,
    '',
    `- 런: \`${런ID}\` · 마누스 작업: \`${r.작업id}\` · 마누스 상태: **${상태}**`,
    `- 던진 때: ${r.시작} · 주운 때: ${new Date().toISOString()}`,
    '',
    '## 질문(던진 원문)',
    '',
    '```',
    String(r.질문 || '(없음)'),
    '```',
    '',
    '## 답',
    '',
    말.length ? 말.join('\n\n---\n\n') : '_(assistant 메시지를 못 찾았다 — 아래 원문을 본다)_',
    '',
    '## 원문 응답 (파싱이 틀렸을 때 여기서 판정한다)',
    '',
    '```json',
    JSON.stringify(j, null, 1).slice(0, 20000),
    '```',
    '',
  ].join('\n');

  const 경로 = path.join(결과방, `${런.파일명(런ID)}.md`);
  fs.writeFileSync(경로, 본문, 'utf8');
  console.log(`[폴러] 결과: ${경로}`);
}

// ── 조회 ──────────────────────────────────────────────────────────────────
async function 크레딧() {
  const j = await 부르기('usage.availableCredits');
  const d = j.data || j;
  console.log(`💰 마누스 지갑 — 총 ${d.total_credits}`);
  console.log(`   가입선물 ${d.free_credits ?? 0} · 구독 ${d.periodic_credits ?? 0} · 애드온 ${d.addon_credits ?? 0} · 매일갱신 ${d.refresh_credits ?? 0}/${d.max_refresh_credits ?? 0}`);
  if (!d.periodic_credits) console.log('   ⚠ 구독 크레딧 0 — 무료 등급이다(조사 1건 200~500이면 하루 한 발).');
  return 0;
}

/* 계정에 **실제로** 있는 작업을 센다 — 읽기 전용 · 크레딧 0.
 * 왜 있나(F509): 던진 실탄의 작업 id 가 계정에 없었는데, 그걸 확인할 통로가 없어서
 * 「id 가 유령이다」를 임시 스크립트로 잰 뒤에야 알았다. 진단 명령이 없으면 진단을 안 한다. */
async function 작업목록(제한) {
  const j = await 부르기(`task.list?limit=${Number(제한) > 0 ? Number(제한) : 20}`);
  const 목록 = Array.isArray(j.data) ? j.data : (Array.isArray(j.tasks) ? j.tasks : []);
  console.log(`마누스 계정 작업 ${목록.length}건 (이 목록에 없는 id 는 폴링해도 영영 404 다)`);
  for (const t of 목록) {
    let 때 = String(t.created_at || '');
    if (/^\d+$/.test(때)) { try { 때 = new Date(Number(때) * 1000).toISOString(); } catch (_) { /* 원문 그대로 */ } }
    console.log(`  ${t.id}  ${때}  ${String(t.status || '?').padEnd(9)} 크레딧${String(t.credit_usage ?? '?').padStart(4)}  ${String(t.title || '').slice(0, 46)}`);
  }
  return 0;
}

function 런목록() {
  const s = 런.요약();
  const 내것 = (x) => x.런.종류 === 종류;
  const 줄 = (x) => `  · ${x.런.런ID} · ${x.판.분 == null ? '?' : x.판.분}분 · ${x.런.대상}`;
  const 완 = s.완주미처분.filter(내것), 멈 = s.멈춤.filter(내것), 진 = s.진행.filter(내것);
  const 실 = s.실패미처분.filter(내것);
  if (!완.length && !실.length && !멈.length && !진.length) { console.log('던진 사실심문 없음.'); return 0; }
  if (완.length) { console.log(`✅ 완주 · 안 주움 ${완.length}건:`); 완.forEach((x) => console.log(줄(x))); }
  if (실.length) {
    console.log(`🔴 **실패로 끝남** ${실.length}건 — 주울 답이 없다(로그를 열어도 답이 아니라 오류다):`);
    실.forEach((x) => { console.log(줄(x)); console.log(`      왜: ${x.런.비고 || `종료코드 ${x.런.종료코드}`}`); });
  }
  if (진.length) { console.log(`⏳ 도는 중 ${진.length}건:`); 진.forEach((x) => console.log(줄(x))); }
  if (멈.length) {
    console.log(`⚠ 폴러가 멈춤 ${멈.length}건 — **마누스는 계속 돌고 있을 수 있다.** 재던지기 말고 이어받아라(크레딧 0):`);
    멈.forEach((x) => { console.log(줄(x)); console.log(`      node tools/마누스.js --이어받기 ${x.런.런ID}`); });
  }
  return 0;
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const 값 = (플래그) => { const i = argv.indexOf(플래그); return i >= 0 ? argv[i + 1] : null; };

  if (argv.includes('--크레딧')) return 크레딧();
  if (argv.includes('--작업목록')) return 작업목록(값('--작업목록'));
  if (argv.includes('--런목록')) return 런목록();
  if (argv.includes('--폴러')) return 폴러(값('--폴러'));
  if (argv.includes('--이어받기')) {
    const id = 값('--이어받기');
    const r = 런.런읽기(id);
    if (!(r && r.작업id)) { console.error(`런 ${id} 를 못 읽었다(또는 작업id 가 없다)`); return 2; }
    런.런갱신(id, { 상태: '진행', pid: process.pid });
    return 붙기(id, r);
  }
  /* 질문은 대개 여러 줄이고 따옴표·괄호를 품는다 — 셸에 맡기면 깨진다(CLAUDE.md 셸 조항).
   * 그래서 파일 통로를 기본으로 두고, `--던지기 "<한 줄>"` 은 짧은 것만 받는다. */
  if (argv.includes('--질문파일')) {
    const p = 값('--질문파일');
    let q;
    try { q = fs.readFileSync(p, 'utf8').trim(); } catch (_) { console.error(`질문 파일을 못 읽었다: ${p}`); return 2; }
    return 던지기(q, 값('--라벨'));
  }
  if (argv.includes('--던지기')) return 던지기(값('--던지기'), 값('--라벨'));

  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 42).join('\n'));
  return 0;
}

/* 회귀가 순수 함수에 닿게 한다 — require 로 들여올 때 main 이 돌면 테스트가 네트워크를 친다. */
if (require.main === module) {
  main().then((c) => process.exit(c || 0)).catch((e) => { console.error(`🔴 ${e.message}`); process.exit(1); });
} else {
  module.exports = { 생성몸통, 작업ID캐기, 회복불가인가, 키, 키경로, 종류, API };
}
