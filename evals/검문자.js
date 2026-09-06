#!/usr/bin/env node
/* 몽골어 검문 시험지의 «채점 부품» — promptfoo(evals/몽골어검문.yaml)가 이 파일의 함수를 부른다.
 *
 * ■ 무엇을 내주나
 *   ① 문법프롬프트  — 문항 하나를 «실제 검문이 쓰는 그 프롬프트»로 만든다
 *   ② 문법스키마    — 모델에 강제할 JSON 모양 (--스키마쓰기 로 evals/문법스키마.json 을 찍는다)
 *   ③ 판정채점      — 모델 답을 정답지와 맞춘다 (결정적 · LLM 심판이 아니다)
 *   ④ 근거채점      — 「어색·파손」이면 문제문장이 진짜 입력 안의 글자인지, 키릴인지
 *
 * ■ 왜 정본을 «복사»하지 않고 «읽어»오나
 *   프롬프트와 스키마의 정본은 `tools/몽골어대조.js` 다. 여기에 같은 글을 한 벌 더 적으면
 *   한 값을 두 곳이 아는 꼴이 되고 — 이 저장소가 반복해서 데인 병이다 — 시험지가 조용히
 *   «다른 검문»을 재게 된다. 그래서 정본 파일의 원문을 읽어 그 자리에서 뽑는다.
 *   🔴 **못 뽑으면 던진다.** 조용히 물러서면 「0건 = 성공 얼굴」이 된다.
 *
 * ■ 부르는 법
 *   node evals/검문자.js --자체점검     ← 정본에서 프롬프트·스키마가 뽑히는지만 본다(호출 0)
 *   node evals/검문자.js --스키마쓰기   ← evals/문법스키마.json 을 정본에서 다시 찍는다
 *   (시험 자체는 promptfoo 가 돌린다 — evals/README.md)
 *
 * ■ 함정
 *   - `tools/몽골어대조.js` 의 프롬프트 줄 모양이 바뀌면 여기서 **즉시 죽는다.** 그게 맞다.
 *   - 이 파일은 네트워크도 열쇠도 만지지 않는다. 제미나이를 «부르는» 자리는 `evals/제미나이문.js`
 *     하나다(09-07 · 그 전에는 promptfoo 가 환경변수로 열쇠를 받아 직접 불렀다).
 *   - `require('tools/몽골어대조.js')` 는 모듈을 여는 것만으로 모델정책을 읽는다(네트워크 0).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 정본경로 = path.join(__dirname, '..', 'tools', '몽골어대조.js');
const 스키마파일 = path.join(__dirname, '문법스키마.json');
const 판정값 = ['정상', '어색', '파손'];

function 확인불가(말) {
  const e = new Error(`확인 불가 — ${말}`);
  e.확인불가 = true;
  return e;
}

function 정본원문() {
  if (!fs.existsSync(정본경로)) throw 확인불가(`검문 정본이 없다 → ${정본경로}`);
  return fs.readFileSync(정본경로, 'utf8');
}

/* 소스에 «적힌 대로»의 템플릿 리터럴을 JS 가 읽는 문자열로 되돌린다.
 * \n 말고 다른 이스케이프가 섞이면 조용히 틀리게 푸느니 던진다. */
function 이스케이프풀기(s) {
  const 푼것 = s.split('\\n').join('\n');
  if (푼것.indexOf('\\') !== -1) throw 확인불가('프롬프트에 \\n 아닌 이스케이프가 있다 — 손으로 확인해라');
  return 푼것;
}

/** 정본에서 «문법·자연스러움 채점 층»의 프롬프트 틀을 그대로 뽑는다. */
function 문법프롬프트틀() {
  const m = /const 문법답 = await 제미나이\(key, model,\s*`([\s\S]*?)`,/.exec(정본원문());
  if (!m) throw 확인불가('tools/몽골어대조.js 에서 문법 층 프롬프트를 못 찾았다 (정본 모양이 바뀌었다)');
  const 틀 = 이스케이프풀기(m[1]);
  if (틀.indexOf('${mn}') === -1) throw 확인불가('뽑은 프롬프트에 ${mn} 자리가 없다');
  return 틀;
}

/** 정본에서 응답 스키마를 그대로 뽑는다. */
function 문법스키마정본() {
  const src = 정본원문();
  const 머리 = 'const 문법스키마 = ';
  const 시작 = src.indexOf(머리);
  if (시작 === -1) throw 확인불가('tools/몽골어대조.js 에서 문법스키마를 못 찾았다');
  const 끝 = src.indexOf('\n};', 시작);
  if (끝 === -1) throw 확인불가('문법스키마 블록의 끝을 못 찾았다');
  const 본문 = src.slice(시작 + 머리.length, 끝 + 2);
  let 스키마;
  try { 스키마 = new Function('return ' + 본문)(); } // 정본은 우리 저장소 파일이다(바깥 입력 아님)
  catch (e) { throw 확인불가(`문법스키마를 못 읽었다 — ${e.message}`); }
  const 칸 = 스키마 && 스키마.properties && 스키마.properties.판정;
  if (!칸 || String(칸.enum) !== String(판정값)) {
    throw 확인불가(`뽑은 스키마의 판정 enum 이 ${판정값.join('·')} 이 아니다`);
  }
  return 스키마;
}

/* YAML 은 JS 함수를 스키마로 못 받는다(promptfoo 는 .json/.yaml 만 읽어 준다).
 * 그래서 파일로 한 벌 찍어 두되, **매 채점마다 정본과 대조해** 낡으면 그 자리에서 실패시킨다.
 * 파일이 정본에 뒤처진 채 초록이 뜨는 것이 이 구조의 유일한 위험이라, 그 구멍만 막는다. */
function 스키마파일대조() {
  if (!fs.existsSync(스키마파일)) {
    throw 확인불가(`evals/문법스키마.json 이 없다 — node evals/검문자.js --스키마쓰기 를 먼저 돌려라`);
  }
  const 파일 = JSON.stringify(JSON.parse(fs.readFileSync(스키마파일, 'utf8')));
  const 정본 = JSON.stringify(문법스키마정본());
  if (파일 !== 정본) {
    throw 확인불가('evals/문법스키마.json 이 tools/몽골어대조.js 의 정본과 다르다 — --스키마쓰기 로 다시 찍어라');
  }
}

/* 모델·사고수준의 정본은 `tools/모델정책.js` 다. 시험지가 딴 것을 재고 있으면 여기서 막는다.
 *
 * 🔄 **09-07 에 자가 뒤집혔다.** 그 전에는 YAML 에 모델 이름을 적어 두고 «그 글자가 정본과 같은가»를
 *   봤다. 이제는 YAML 이 모델을 아예 안 적고 `evals/제미나이문.js` 가 정본에서 읽어 온다 —
 *   그래서 검사도 **「적힌 값이 맞나」에서 「적어 두지 않았나」로** 바뀐다. 적혀 있지 않으면 어긋날 수 없다.
 *   대신 통로가 «실제로 내는» 값을 되읽어 정본과 맞춰 본다(네트워크 0). */
function 정책대조() {
  const 픽 = require(path.join(__dirname, '..', 'tools', '모델정책.js')).제미나이설정();
  const yaml = path.join(__dirname, '몽골어검문.yaml');
  if (!fs.existsSync(yaml)) throw 확인불가(`시험지 YAML 이 없다 → ${yaml}`);
  // 주석 줄은 «꺼 둔 것»이라 자에 안 걸린다(대조군 블록이 여기서 걸리면 시험지를 못 적는다).
  const 산줄 = fs.readFileSync(yaml, 'utf8').split(/\r?\n/).filter((l) => !/^\s*#/.test(l));

  // ① 부르는 자리가 우리 통로인가 — 아니면 정본이 아닌 문·모델로 잴 수 있다
  if (산줄.join('\n').indexOf('file://제미나이문.js') === -1) {
    throw 확인불가('시험지가 evals/제미나이문.js 를 안 쓴다 — 그러면 정본 아닌 문·모델로 재게 된다');
  }
  // ② 모델 이름을 «시험지에도» 적어 두지 않았나 — 한 값을 두 곳이 알면 갈린다
  //    (`file://…` 는 «부르는 자리»를 가리키는 것이지 모델 이름이 아니라 여기서 뺀다)
  const 직접 = 산줄.find((l) => /^\s*-?\s*id:\s*(?!file:\/\/)[a-z]+:/i.test(l));
  if (직접) {
    throw 확인불가(`시험지가 모델을 직접 적고 있다 → "${직접.trim()}" · 정본은 tools/모델정책.js 하나다`);
  }
  // ③ 그 통로가 실제로 내는 값이 정본과 같나 (호출 0 · 파일만 읽는다)
  const 제미나이문 = require(path.join(__dirname, '제미나이문.js'));
  const 정보 = new 제미나이문().모델정보();
  if (정보.model !== 픽.model || 정보.thinking !== 픽.thinking_level) {
    throw 확인불가(`evals/제미나이문.js 가 내는 픽이 정본과 다르다 — 정본 ${픽.model}/${픽.thinking_level}`
      + ` · 내는 것 ${정보.model}/${정보.thinking}`);
  }
  return { ...픽, 용도: 정보.용도, 문: 정보.문 };
}

// ── promptfoo 가 부르는 자리 ────────────────────────────────────────────────

/** 프롬프트 함수. promptfoo 가 문항마다 한 번 부른다. */
function 문법프롬프트({ vars }) {
  const mn = String((vars && vars.몽골어) || '').trim();
  if (!mn) throw 확인불가('문항에 몽골어 본문(vars.몽골어)이 없다');
  return 문법프롬프트틀().replace('${mn}', () => mn); // 함수 치환 = $& 같은 글자를 안 먹는다
}

/** 모델 답에서 판정을 읽는다 — 자는 정본(`문법파싱`)을 그대로 쓴다. */
function 판정읽기(출력) {
  const { 문법파싱 } = require(정본경로);
  return 문법파싱(typeof 출력 === 'string' ? 출력 : JSON.stringify(출력));
}

/**
 * 채점 ① — 판정이 정답지와 맞나. **결정적이다**(문자열 비교뿐 · 모델이 심판하지 않는다).
 * 정답지 값: `정상` = 검문을 지나고 채택돼 지금 라이브·정본에 선 글 ·
 *            `비정상` = 실제로 「어색·파손」으로 잡혀 «고쳐진» 글(어색이든 파손이든 잡기만 하면 맞다).
 */
function 판정채점(출력, 문맥) {
  스키마파일대조();
  정책대조();
  const 기대 = String(((문맥 && 문맥.vars) || {}).기대 || '');
  if (기대 !== '정상' && 기대 !== '비정상') {
    return { pass: false, score: 0, reason: `확인 불가 — 문항의 기대값이 정상/비정상이 아니다: "${기대}"` };
  }
  const 읽음 = 판정읽기(출력);
  if (!읽음) {
    // 정본과 같은 실패 방향: 판정을 «못 읽은» 것은 통과가 아니라 검수 필요다.
    return { pass: false, score: 0, reason: '판정불능 — 모델 답에서 판정을 못 읽었다(통과 아님)' };
  }
  const 맞음 = 기대 === '정상' ? 읽음.판정 === '정상' : 읽음.판정 !== '정상';
  return {
    pass: 맞음,
    score: 맞음 ? 1 : 0,
    reason: `기대 ${기대} · 모델 판정 ${읽음.판정}${맞음 ? '' : ' ← 어긋남'}`,
  };
}

/**
 * 채점 ② — 「어색·파손」일 때 근거가 실물인가.
 *   ㉠ 문제문장이 비어 있지 않다  ㉡ 입력 안에 실제로 있는 글자다(지어낸 문장이 아니다)
 *   ㉢ 키릴 비율이 절반을 넘는다 — 몽골어 문장을 인용해야 할 자리이므로(언어 감지)
 * 판정이 「정상」이면 볼 근거가 없는 자리다 — 그때는 **통과로 접지 않고 그렇게 적어** 남긴다.
 */
function 근거채점(출력, 문맥) {
  const mn = String(((문맥 && 문맥.vars) || {}).몽골어 || '');
  const 읽음 = 판정읽기(출력);
  if (!읽음) return { pass: false, score: 0, reason: '판정불능 — 근거를 볼 답 자체가 없다' };
  if (읽음.판정 === '정상') {
    return { pass: true, score: 1, reason: '해당 없음(판정 정상 — 문제문장을 요구하지 않는 자리)' };
  }
  const 문장 = String(읽음.문제문장 || '').trim();
  if (!문장) return { pass: false, score: 0, reason: '비정상 판정인데 문제문장이 비어 있다' };
  const 정규 = (t) => t.replace(/\s+/g, ' ').trim();
  if (정규(mn).indexOf(정규(문장)) === -1) {
    return { pass: false, score: 0, reason: `문제문장이 입력 안에 없다(지어냈다) → "${문장.slice(0, 60)}"` };
  }
  const 글자 = 문장.replace(/[^\p{L}]/gu, '');
  const 키릴 = (문장.match(/[\u0400-\u04FF]/g) || []).length;
  const 비율 = 글자.length ? 키릴 / 글자.length : 0;
  if (비율 < 0.5) {
    return { pass: false, score: 0, reason: `문제문장의 키릴 비율 ${(비율 * 100).toFixed(0)}% — 몽골어 인용이 아니다` };
  }
  return { pass: true, score: 1, reason: `근거 실물 ✓ (키릴 ${(비율 * 100).toFixed(0)}%) "${문장.slice(0, 40)}"` };
}

// ── CLI ────────────────────────────────────────────────────────────────────

function 자체점검() {
  const 틀 = 문법프롬프트틀();
  const 스 = 문법스키마정본();
  console.log('■ 정본에서 뽑은 것 (tools/몽골어대조.js · 호출 0건)');
  console.log('\n[프롬프트 틀]\n' + 틀.split('\n').map((l) => '  ' + l).join('\n'));
  console.log('\n[스키마] ' + JSON.stringify(스));
  let 파일상태;
  try { 스키마파일대조(); 파일상태 = '✅ evals/문법스키마.json 이 정본과 같다'; }
  catch (e) { 파일상태 = '🔴 ' + e.message; }
  console.log('\n[스키마 파일] ' + 파일상태);
  let 정책상태;
  try {
    const p = 정책대조();
    정책상태 = `✅ 시험지가 정본 픽을 그대로 쓴다 — ${p.model} / thinking=${p.thinking_level}`
      + ` · 가는 문 ${p.문}(${p.용도 === '돈' ? '크레딧이 낸다 · 하루 몫 벽 없음' : '공짜 몫 · 하루 20발'})`;
  } catch (e) { 정책상태 = '🔴 ' + e.message; }
  console.log('[모델 정본] ' + 정책상태);
  return /🔴/.test(파일상태 + 정책상태) ? 2 : 0;
}

function 스키마쓰기() {
  fs.writeFileSync(스키마파일, JSON.stringify(문법스키마정본(), null, 2) + '\n', 'utf8');
  console.log(`✅ 정본에서 다시 찍었다 → ${스키마파일}`);
  return 0;
}

module.exports = { 문법프롬프트, 판정채점, 근거채점, 문법프롬프트틀, 문법스키마정본, 스키마파일대조, 정책대조, 판정읽기 };

if (require.main === module) {
  const argv = process.argv.slice(2);
  try {
    process.exit(argv.includes('--스키마쓰기') ? 스키마쓰기() : 자체점검());
  } catch (e) {
    console.error('🔴 ' + e.message);
    process.exit(1);
  }
}
