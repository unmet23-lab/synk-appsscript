#!/usr/bin/env node
'use strict';
/**
 * plain-words-guard — 내가 유호님께 낸 답에 «뜻 없이 놓인 낯선 것»이 남았나 센다.
 *                     그리고 유호님이 되물으시면 그 낱말을 잡아 «아는말» 목록을 깎는다.
 *                     (UserPromptSubmit 훅)
 *
 * ■ 왜 있나 (유호 확정 2026-09-03 · CLAUDE.md 「읽히게」 절)
 *   유호님은 비개발자이고, 판단을 하시는 분이다. 판단하려면 재료가 읽혀야 한다.
 *   그런데 09-03 하루에만 이 일이 났다 —
 *     · 내가 「자」라는 말을 뜻 없이 썼다(내가 지어낸 말인 줄도 잊고 있었다)
 *     · 유호님이 **첫 턴에** 「자가 뭐야?」로 되물으셨다
 *   즉 **되물음은 이미 도는 잣대인데, 아무 데도 안 쌓이고 있었다.** 이 훅이 그걸 줍는다.
 *
 * ■ 🔴 설계의 심장 — 목록의 «방향»을 뒤집었다
 *   처음 떠올린 것은 「어려운 낱말 목록」이었고, 그건 못 쓴다:
 *   목록을 내가 만들면 **내가 어려운 줄 모르는 낱말은 안 들어가고**, 장치는 「0건 깨끗하다」고
 *   답한다 — 거짓 초록을 내 손으로 짓는 것이다(zero-is-a-success-face-taxonomy).
 *   ⇒ 기본값을 «전부 낯설다»로 두고, `lib/아는말.js` 에 든 것만 통과시킨다.
 *      내 눈이 틀리는 모습이 «놓침»이 아니라 «시끄러움»으로 나온다. 시끄러운 건 고칠 수 있다.
 *
 * ■ 설계 판정 다섯
 *   ① **막지 않는다.** 평문 stdout 만 낸다(이 이벤트는 평문이 그대로 내 컨텍스트로 들어간다).
 *      유호님 말을 훅이 삼키는 일은 없어야 한다 — decision-catch 와 같은 규율.
 *   ② **판정하지 않는다.** 「이 낱말이 어려운가」를 훅이 정하지 않는다. 후보를 기계로 뽑고,
 *      «뜻이 옆에 붙었나»만 본다. 판정은 나에게 남긴다.
 *   ③ **되물음이 목록을 깎는다.** 유호님이 「뭐야」 하시면 그 턴에 후보를 들이민다.
 *      그래야 `아는말.js` 가 시간이 갈수록 **내 눈이 아니라 유호님 눈**이 된다.
 *   ④ **0건이면 완전 침묵.** 매 턴 도는 훅이라 조용함이 기본값이다(rot-check 선례).
 *   ⑤ **네트워크·git 을 안 쓴다.** 파일 하나 읽고 정규식만 돈다.
 *
 * ■ 대가 (틀릴 때의 모습)
 *   - 뜻을 «앞»에 붙인 문장(「같은 걸 다시 안 만드는 것(캐싱)」)은 못 알아보고 잡는다 → 시끄럽다.
 *   - 코드 블록 안은 통째로 안 본다 — 명령어는 그대로 드려야 하니 뜻풀이 대상이 아니다.
 *     대신 **본문에 그 낱말이 다시 나오면 그때 잡힌다.**
 *   - 한자어·순한글 전문어(「가역」·「소급」)는 못 잡는다. 이 훅은 로마자만 본다.
 *     그 자리는 여전히 유호님 되물음이 잣대다 — 이 훅은 그물이지 벽이 아니다.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

/* ── 문체 자 (2026-09-03 신설) ────────────────────────────────────────────────
 * 유호 지적: 「지금 니가 구사하는게 이해가 안가거나 애매하게 말하는게 너무 많단말이지」
 * 위의 «낯선 낱말» 검사는 로마자만 본다. 그런데 유호님이 걸리신 것은 낱말만이 아니라
 * **문장 모양**이었다 — 긴 줄표로 끝없이 이어 붙이기, 가리킬 것 없는 지시어, 인과 없는 나열.
 * 그 층을 hanlint(한국어 산문 검사기 · MIT · 딸린 것 0)가 잰다. 자 = .claude/hanlint/내답.toml
 *
 * 규율은 위 훅과 같다 — 막지 않고, 판정하지 않고, 0건이면 침묵한다.
 * 🔴 도구가 없으면 «조용히» 건너뛴다. 매 턴 도는 훅이라 없는 도구를 매번 외치면 그게 소음이다.
 *    (손으로 잴 때는 `node tools/글검사.js` 가 「못 쟀다」고 분명히 말한다 — 그쪽이 정직할 자리다.)
 */
const 문체자 = path.join(__dirname, '..', 'hanlint', '내답.toml');
const 문체검사기 = path.join(__dirname, '..', '..', 'node_modules', 'hanlint', 'bin', 'hanlint.js');

function 문체검사(글) {
  if (!글 || 글.length < 80) return [];              // 짧은 답은 안 잰다
  if (!fs.existsSync(문체검사기) || !fs.existsSync(문체자)) return [];
  let 낸것 = '';
  try {
    낸것 = cp.execFileSync(process.execPath,
      [문체검사기, '-', '--config', 문체자, '--format', 'json', '--path', '내답.md'],
      { input: 글, encoding: 'utf8', timeout: 8000, maxBuffer: 1 << 24 });
  } catch (e) {
    낸것 = String(e.stdout || '');                    // 지적이 있으면 종료 코드 1 — 실패가 아니다
    if (!낸것.trim()) return [];
  }
  try {
    const j = JSON.parse(낸것);
    return (j.files || []).flatMap((f) => f.findings || [])
      .map((f) => ({ 규칙: f.rule, 말: f.why || '', 글: String(f.quote || '').slice(0, 60) }));
  } catch { return []; }
}

// 🔌 끄기 스위치 — 이 파일이 있으면 훅은 아무 일도 안 한다.
//    유호님 「잠깐 써 보고 판단할게. 꺼달라면 바로 꺼줄 수 있지?」(09-03)에 대한 답이다.
//    «바로»를 말이 아니라 물건으로 둔다 — 설정을 안 건드리고, 파일 하나로 켜고 끈다.
//      끄기: touch .claude/hooks/lib/쉬운말끔      켜기: rm .claude/hooks/lib/쉬운말끔
if (fs.existsSync(path.join(__dirname, 'lib', '쉬운말끔'))) process.exit(0);

let 아는말집합;
try {
  ({ 아는말집합 } = require(path.join(__dirname, 'lib', '아는말.js')));
} catch {
  process.exit(0); // 목록이 없으면 조용히 빠진다 — 이 훅은 «띄우는» 층이다
}

// 유호님이 「이게 뭐냐」고 물으시는 무늬. 좁게 잡는다 — 거짓 양성은 ③의 값을 깎는다.
const 되물음무늬 = [
  /(가|이|은|는|을|를)?\s*(뭐야|뭔데|뭐임|뭐예요|뭔가요)/,
  /무슨\s*(뜻|말)/,
  /뜻이\s*(뭐|무엇)/,
  /이해가\s*(안|잘 안)/,
  /(모르겠|잘 모르|어렵게|어려워|어렵다)/,
];

// 되물음 문장에서 «되물으신 낱말 그 자체»를 뽑는다 — 「자가 뭐야?」 → 「자」.
// 🔑 이 층이 로마자 그물의 구멍(한글 전문어)을 메운다. 유호님이 낱말을 직접 짚어 주시기 때문에
//    내 판정이 한 번도 끼지 않는다 — 이 훅에서 가장 정확한 자리다.
const 지시어 = new Set(['이게', '그게', '저게', '이거', '그거', '저거', '이건', '그건', '이것', '그것',
  '뭐', '무슨', '이', '그', '저', '것', '거', '너', '니', '내', '나', '왜', '어디', '언제', '누구']);

function 되물은낱말(말) {
  // 🔴 낱말 그룹은 «게으르게» 잡는다 — 욕심내면 조사까지 먹어 「자가」가 나온다(09-03 시험에서 잡음).
  const 뽑개 = /([가-힣A-Za-z][가-힣A-Za-z0-9_.\-]{0,14}?)\s*(?:가|이|은|는|을|를|라는\s*(?:게|건|말))?\s*(?:뭐야|뭔데|뭐임|뭐예요|뭔가요|무슨\s*(?:뜻|말)|뜻이\s*(?:뭐|무엇))/g;
  const 나온것 = [];
  let m;
  while ((m = 뽑개.exec(말)) !== null) {
    const 낱말 = m[1];
    if (지시어.has(낱말) || 낱말.length < 1) continue;
    if (!나온것.includes(낱말)) 나온것.push(낱말);
  }
  return 나온것;
}

/** 세션 기록에서 «내가 마지막으로 낸 답»의 글만 꺼낸다. */
function 마지막답(경로) {
  try {
    if (!경로 || !fs.existsSync(경로)) return '';
    const 크기 = fs.statSync(경로).size;
    const 시작 = Math.max(0, 크기 - 512 * 1024); // 끝 512KB 만 본다(기록은 수십 MB 가 된다)
    const fd = fs.openSync(경로, 'r');
    const 통 = Buffer.alloc(크기 - 시작);
    fs.readSync(fd, 통, 0, 통.length, 시작);
    fs.closeSync(fd);
    const 줄들 = 통.toString('utf8').split('\n');
    for (let i = 줄들.length - 1; i >= 0; i--) {
      let 줄;
      try { 줄 = JSON.parse(줄들[i]); } catch { continue; } // 잘린 첫 줄은 여기서 버려진다
      if (줄.type !== 'assistant') continue;
      const 속 = 줄.message && 줄.message.content;
      if (!Array.isArray(속)) continue;
      const 글 = 속.filter((x) => x && x.type === 'text').map((x) => x.text).join('\n');
      if (글 && 글.trim()) return 글;
    }
  } catch { /* 기록을 못 읽으면 조용히 빈손 */ }
  return '';
}

/** 로마자 토큰 중 «뜻이 안 붙은 낯선 것»만 남긴다. */
function 낯선것뽑기(글) {
  if (!글) return [];
  let 본문 = 글
    .replace(/```[\s\S]*?```/g, ' ')            // 코드 블록 — 명령어는 그대로 드려야 한다
    .replace(/https?:\/\/\S+/g, ' ')            // 주소
    .replace(/\b[0-9a-f]{7,40}\b/g, ' ')        // 커밋 지문 — 읽을 것이 아니라 가리키는 것
    .replace(/\.(md|js|json|html|css|txt|png|jpg|jpeg|svg|csv|xlsx|pdf|mp4|ts|tsx)\b/gi, ' ')
    .replace(/\bv?\d+(\.\d+)+\b/g, ' ');        // 판 번호 v9.295

  const 낯선 = new Map(); // 소문자 → 원래 모습
  const 찾개 = /[A-Za-z][A-Za-z0-9+#_-]*/g;
  let m;
  while ((m = 찾개.exec(본문)) !== null) {
    const 낱말 = m[0];
    if (낱말.length < 2) continue;
    const 열쇠 = 낱말.toLowerCase();
    if (아는말집합.has(열쇠)) continue;
    if (낯선.has(열쇠)) continue;

    // 바로 뒤에 뜻이 붙었나 — 괄호 안 한글, 또는 = · — 뒤 한글
    const 뒤 = 본문.slice(m.index + 낱말.length, m.index + 낱말.length + 60);
    const 뜻붙음 =
      /^\s*[(（][^)）]*[가-힣][^)）]*[)）]/.test(뒤) ||
      /^\s*(=|—|-)\s*[^\n]{0,30}[가-힣]/.test(뒤);
    if (뜻붙음) continue;

    낯선.set(열쇠, 낱말);
  }
  return [...낯선.values()];
}

// 한자가 섞였나 — 09-03 유호님 신고: 내가 「규칙」을 쓰면서 첫 글자만 한자로 냈다(U+898F).
// 판정이 필요 없는 자리다 — 우리 글에 한자를 쓸 자리가 없으니 **나오면 그냥 잘못**이고,
// 기계가 100% 정확하게 잡는다.
//
// 🔴 형제와 겹치지 않는다 — `tools/옛글자검사.js` 는 **커밋되는 파일**을 본다.
//    내 답은 파일이 아니라서 그 그물을 그냥 빠져나갔다. 여기가 그 구멍이다.
//    (이 파일 자신도 그 검사를 받으므로 한자를 «글자»로 못 적는다 → 코드값으로 쓴다)
// 우리 글에 한자를 쓸 일이 없으니 **나오면 그냥 잘못**이고, 기계가 100% 정확하게 잡는다.
// ①번 층(로마자)도 ②번 층(되물음)도 이걸 못 본다 — 그래서 셋째 층이 필요하다.
function 한자찾기(글) {
  if (!글) return [];
  const 본문 = 글.replace(/```[\s\S]*?```/g, ' ');
  return [...new Set(본문.match(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g) || [])];
}

let 들어온것 = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (들어온것 += d));
process.stdin.on('end', () => {
  let 입력;
  try { 입력 = JSON.parse(들어온것 || '{}'); } catch { process.exit(0); }

  const 말 = String(입력.prompt || '');
  if (!말.trim() || 말.trim().startsWith('/')) process.exit(0);

  const 답 = 마지막답(입력.transcript_path);
  const 낯선 = 낯선것뽑기(답);
  const 되물음 = 되물음무늬.some((r) => r.test(말));
  const 짚으신것 = 되물음 ? 되물은낱말(말) : [];
  const 한자 = 한자찾기(답);
  const 문체 = 문체검사(답);

  // 🔴 «돌았다»를 남긴다 — 이게 없으면 «0건이라 조용함»과 «훅이 아예 안 돎»을 못 가른다.
  //    0건이 성공의 얼굴을 하는 자리(zero-is-a-success-face-taxonomy)라, 잣대를 먼저 의심할 수 있어야 한다.
  //    저장소가 아니라 임시 폴더에 둔다 — 기록이 아니라 «맥박»이다.
  //    🔑 누적도 같이 센다 — 유호님이 「한동안 써 보고 거슬리면 말할게」 하셨다(09-03).
  //       그 「거슬리나」를 나중에 **느낌이 아니라 숫자로** 답하려면 지금부터 세야 한다:
  //       돈 횟수 분의 짖은 횟수가 곧 시끄러움이다(report-zero-with-denominator).
  //    🔴 세션마다 따로 적는다 — 09-03 실측: 파일 하나로 뒀더니 **옆 세션이 덮어썼고**,
  //       내 세션 것인 줄 알고 읽은 18개가 통째로 남의 답에서 나온 낱말이었다.
  //       이 기계는 세션 일곱이 동시에 도는 곳이다(peer-identity-and-measurable-gates).
  const 세션 = String(입력.session_id || 'unknown').slice(0, 12);
  const 맥박길 = path.join(require('os').tmpdir(), `synk-쉬운말-맥박-${세션}.json`);
  let 이전 = {};
  try { 이전 = JSON.parse(fs.readFileSync(맥박길, 'utf8')) || {}; } catch { /* 첫 회 */ }
  try {
    fs.writeFileSync(맥박길, JSON.stringify({
      때: new Date().toISOString(),
      낯선: 낯선.length, 낱말: 낯선.slice(0, 20), 되물음, 짚으신것, 한자,
      문체: 문체.length, 문체규칙: [...new Set(문체.map((f) => f.규칙))].slice(0, 8),
      돈수: (이전.돈수 || 0) + 1,
      짖은수: (이전.짖은수 || 0) + (낯선.length || 되물음 || 한자.length || 문체.length ? 1 : 0),
      한자낸수: (이전.한자낸수 || 0) + (한자.length ? 1 : 0),
      샌날: 이전.샌날 || new Date().toISOString().slice(0, 10),
    }), 'utf8');
  } catch { /* 맥박을 못 남겨도 검사는 계속한다 */ }

  if (!낯선.length && !되물음 && !한자.length && !문체.length) process.exit(0); // 0건이면 완전 침묵

  const 보일것 = 낯선.slice(0, 12);
  const 더 = 낯선.length > 12 ? ` (외 ${낯선.length - 12})` : '';
  const 줄 = [];

  // 한자는 갈래가 다르다 — 어려운 말이 아니라 «잘못»이라, 맨 위에 따로 낸다.
  if (한자.length) {
    줄.push(`🈲 **직전 답에 한자가 ${한자.length}자 섞였다: ${한자.join(' ')}** — 우리 글에 쓸 자리가 없다.`);
    줄.push('→ 이번 답에서 한글로 고치고, 방금 낸 답의 그 자리도 바로잡아 말씀드린다.');
  }

  if (되물음) {
    줄.push('📒 **유호님이 되물으시는 무늬다 — 이 턴이 «아는말» 목록을 깎는 자리다.**');
    if (짚으신것.length) {
      줄.push(`유호님이 **직접 짚으신 낱말: 「${짚으신것.join('」 · 「')}」** ← 이것이 표에 들어갈 1순위다.`);
    }
    if (보일것.length) {
      줄.push(`직전 내 답에 뜻 없이 놓였던 것: **${보일것.join(' · ')}**${더}`);
    } else if (!짚으신것.length) {
      줄.push('직전 답의 로마자는 깨끗했다 ⇒ 되물으신 것은 **한글 전문어**일 것이다(이 훅이 못 보는 자리).');
    }
    줄.push('→ ① 되물으신 낱말이 `.claude/hooks/lib/아는말.js` 에 들어 있으면 **뺀다.**');
    줄.push('→ ② 기억 `plain-words-to-yuho-standing` 의 되물음 표에 한 줄 적는다(낱말 · 유호님 말 · 앞으로 쓸 말).');
    줄.push('→ ③ 이번 답에서 그 낱말에 뜻을 붙인다. **바꾸지 말고 붙인다** — 실물 이름을 갈면 절차가 죽는다.');
    줄.push('⚠ 되물음이 아니라 그냥 하신 말이면 이 알림을 **무시한다** — 훅은 판정하지 않는다.');
  } else {
    줄.push(`📝 직전 답에 **뜻 없이 놓인 낯선 것 ${낯선.length}개** — ${보일것.join(' · ')}${더}`);
    줄.push('→ 이번 답에서는 그 자리에 뜻을 단다(괄호 한 마디면 된다). **바꾸지 말고 붙인다.**');
    줄.push('→ 유호님이 이미 아시는 말이면 `.claude/hooks/lib/아는말.js` 에 넣어 조용히 시킨다.');
    줄.push('⚠ 유호님께 보이는 답에만 걸리는 잣대다 — 커밋 메시지·주석·검수 로그는 대상이 아니다.');
  }

  /* 문체는 갈래가 또 다르다 — «낱말»이 아니라 «문장 모양»이라 따로 낸다.
   * 규칙 이름을 그대로 내면 그 자체가 낯선 말이 되므로 우리말 이름으로 바꿔 낸다.
   * 규칙별로 묶어 한 줄씩, 많아야 넉 줄 — 길면 안 읽고, 안 읽으면 없는 것과 같다. */
  if (문체.length) {
    const 우리말 = {
      dash: '긴 줄표(—)로 이어 붙였다', longSentence: '문장이 길다',
      danglingDeixis: '가리킬 것 없는 지시어', deixis: '지시어(이것·해당·이러한)',
      hardWord: '쉬운 말이 있는 어려운 말', translationese: '번역투(~에 의해·~을 통해)',
      factListParagraph: '인과 없이 사실만 나열', endingRepeat: '같은 어미만 반복',
      euiChain: '「의」가 겹쳤다', nounPile: '명사를 조사 없이 쌓았다',
      cliche: '상투어', doublePassive: '이중 피동(되어지다)',
      doubleNegative: '이중 부정', redundantPair: '겹말', japaneseLoan: '일본어투',
      paraFragment: '한두 문장 문단이 이어진다', imperativePeriod: '명령·청유 뒤 마침표',
      noQuestion: '물음표도 부르는 말도 없다', headingSentence: '제목이 본문 문장 복사',
    };
    const 묶음 = new Map();
    for (const f of 문체) {
      if (!묶음.has(f.규칙)) 묶음.set(f.규칙, { 수: 0, 보기: f.글 });
      묶음.get(f.규칙).수++;
    }
    const 정렬 = [...묶음].sort((a, b) => b[1].수 - a[1].수);
    줄.push(`✍ **직전 답의 «문장 모양» 지적 ${문체.length}건** — 유호 09-03 「이해가 안 가거나 애매하게 말하는 게 너무 많다」의 그 자리다.`);
    for (const [규칙, v] of 정렬.slice(0, 4)) {
      줄.push(`   · ${우리말[규칙] || 규칙}${v.수 > 1 ? ` ×${v.수}` : ''}${v.보기 ? `  「${v.보기}」` : ''}`);
    }
    if (정렬.length > 4) 줄.push(`   · 그 밖 ${정렬.length - 4}갈래`);
    줄.push('→ 이번 답에서 고쳐 쓴다. 긴 줄표는 마침표로 끊고, 나열은 「그래서·때문에」로 잇고, 지시어는 가리킬 것을 앞에 둔다.');
    줄.push('→ 손으로 재려면 `node tools/글검사.js --답` · 끄려면 `touch .claude/hooks/lib/쉬운말끔`');
  }

  console.log(줄.join('\n'));
  process.exit(0);
});
setTimeout(() => process.exit(0), 20000);
