/**
 * **배포 코드의 AI 벤더 호출부(aiCall_·aiText_·callClaudeFeedback_)에 학생 이름·식별자가 실리지 않는다.**
 *
 * 왜 기계로 막나: 방향 불변식 4(docs/제품방향.md:62 — 이름·연락처·student_id·생년·학교는 벤더로 안 나간다)를
 * 정면 위반한 자리가 **도는 것만 6개**였고(대기열 P0 · 108bbefa), 첫 측정은 `aiText_` 호출부만 세서
 * `aiCall_` 계열이 통째로 빠졌다 — 사람 눈의 전수는 두 번 연속 틀렸다. 나간 것은 소급이 안 된다(벤더 쪽).
 *
 * 구조: ①호출부 전수(스냅샷) — 새 호출부가 생기면 여기 등재 전까지 빨갛다(측정 누락의 재발 방지)
 *       ②자리별 검사 — 이름이 프롬프트 조립에 되끼는 것을 잡는다 ③탐지력은 픽스처가 진다.
 *
 * ⚠ **이름 「낱말」 블랙리스트가 아니다** — 못 적은 이름이 새는 방식은 원리상 못 지킨다(메모리 🚫차단 목록).
 *   여기서 잡는 것은 각 호출부의 **조립식이 이름 필드(s.n·stu.name·x.n·nm·body)를 참조하는가**다.
 * ⚠ 안 도는 두 자리(웰컴 스토리·미래의 나 편지 — STORY_AI_ON=false)는 이름이 산출물의 핵심이라
 *   갈래 판정이 유호님 몫으로 남아 있다(대기열 P0) — 여기서 안 잡는다. 켜기 전 판정이 선행이다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
/* 배포 범위 판정을 여기 베끼지 않는다 — `.claspignore` 정본을 읽는 그 함수를 그대로 쓴다(은퇴문구.test.js와 동일). */
const { 배포집합, claspProjects } = require('../tools/배포판점검.js');

/* ── ① 호출부 전수 스냅샷 ─────────────────────────────────────────────
 * 벤더로 나가는 관문은 셋뿐이고, 호출부가 늘면 이 스냅샷이 빨개진다.
 * 처방: 새 호출부에 이름·student_id·연락처·자유서술 원문이 실리지 않음을 확인하고
 *       아래 자리 목록에 검사 항목을 추가한 뒤 스냅샷을 갱신한다. 그냥 숫자만 올리지 않는다. */
const 호출부재 = /\b(aiCall_|aiText_|callClaudeFeedback_)\(/;
const 호출부스냅샷 = {
  '교재연동.js': 2,        // masteryFromFeedback_(쓴 글) + [v9.248] masteryFromVoice_(말한 것의 전사) — 둘 다 문법 목록+문장만(식별자 0)
  '엔진_콘텐츠AI.js': 10,  // 첨삭 위임 1 + aiCall_ 6(튜터·오류은행·반브리핑·리텐션·칭호·SNS) + aiText_ 3(웰컴⛔·편지⛔·레벨진단)
  '엔진_셋업확장.js': 1,   // H7 주간 리포트 해설 — aiBody(집계 화이트리스트)만
};

function 호출부세기(projRoot, root = ROOT) {
  const counts = {};
  for (const rel of 배포집합(projRoot, root)) {
    let t;
    try { t = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    let n = 0;
    t.split(/\r?\n/).forEach((ln) => {
      const s = ln.trim();
      if (s.startsWith('//') || s.startsWith('*') || s.startsWith('/*')) return; // 주석은 호출이 아니다
      if (/function (aiCall_|aiText_|callClaudeFeedback_)\(/.test(ln)) return;   // 정의는 호출이 아니다
      if (호출부재.test(ln)) n++;
    });
    if (n) counts[rel] = n;
  }
  return counts;
}

/* ── ② 자리별 검사 — 데이터 주도(픽스처가 같은 검사기를 통과·실패해 탐지력을 증명한다) ── */
const 자리들 = [
  {
    id: '첨삭-틀상수', file: '엔진_콘텐츠AI.js',
    from: 'const FB_USER_TEMPLATE', to: ';',
    필수: [{ re: /\{급수\}/, 왜: '급수 슬롯' }, { re: /\{제출문\}/, 왜: '제출문 슬롯' }],
    금지: [{ re: /이름|name/i, 왜: '틀에 이름 슬롯이 되살아났다' }],
  },
  {
    id: '첨삭-지문', file: '엔진_콘텐츠AI.js',
    from: 'function fbPromptVer_()', to: '\n}',
    필수: [{ re: /FB_USER_TEMPLATE/, 왜: '사용자 틀이 지문 밖이면 틀 변경(이름 재유입 포함)이 prompt_ver에 안 보인다' }],
    금지: [],
  },
  {
    id: '첨삭-호출', file: '엔진_콘텐츠AI.js',
    from: 'function callClaudeFeedback_(', to: 'UrlFetchApp.fetch',
    필수: [{ re: /FB_USER_TEMPLATE/, 왜: '요청 조립이 틀 상수를 안 쓰면 지문과 실물이 갈라진다' }],
    금지: [{ re: /stu\.name/, 왜: '첨삭 요청에 학생 이름' }],
  },
  {
    id: '튜터-입력', file: '엔진_콘텐츠AI.js',
    from: 'const userMsg = chunk.map', to: '학생 목록:',
    필수: [],
    금지: [{ re: /\bs\.n\b/, 왜: '개인화 튜터 입력에 학생 이름(매칭은 인덱스 i가 진다)' }],
  },
  {
    id: '리텐션-스키마', file: '엔진_콘텐츠AI.js',
    from: 'const rSchema', to: 'SYNK LAB 리텐션 조수',
    필수: [{ re: /required: \['i', 'line'\]/, 왜: '응답 매칭 키는 인덱스 — 이름 키(n)로 되돌리면 이름을 실어야만 돌아간다' }],
    금지: [],
  },
  {
    id: '리텐션-입력', file: '엔진_콘텐츠AI.js',
    from: 'SYNK LAB 리텐션 조수', to: 'rSchema, 3072',
    필수: [],
    금지: [{ re: /\bx\.n\b/, 왜: '리텐션 입력에 학생 이름(이름 키는 응답을 받은 뒤 붙인다)' }],
  },
  {
    id: '칭호-입력', file: '엔진_콘텐츠AI.js',
    from: '칭호 작명가', to: 'tSchema, 4096',
    필수: [],
    금지: [{ re: /\bs\.n\b/, 왜: '칭호 입력에 학생 이름(매칭은 it.i → chunk[it.i])' }],
  },
  {
    id: '레벨진단-입력', file: '엔진_콘텐츠AI.js',
    from: '몽골 학생의 한국어 레벨 테스트 결과로', to: 'Таны оноо',
    필수: [{ re: /if \(report\) report = nm \+/, 왜: '이름은 AI 밖(템플릿)이 끼운다 — 갈래②' }],
    금지: [{ re: /\bnm\b(?=[^;]*1536)/, 왜: '레벨 진단 프롬프트에 리드 이름' }],
  },
  /* [v9.248 · #Q99] 문법 판정관 둘 — 스냅샷은 「교재연동.js 에 호출부가 몇이냐」만 셌고, 그 안에
   *   무엇이 실리는지는 **아무도 안 봤다**(주석이 「식별자 0」이라 말할 뿐이었다). 말하기 판정을
   *   더하며 그 빈칸을 같이 닫는다 — 두 자리 모두 실리는 것은 문법 목록과 문장뿐이고,
   *   `sid` 는 **묶음의 키**로만 쓰이지 프롬프트 문자열에 이어 붙지 않는다. */
  {
    id: '문법판정-쓰기입력', file: '교재연동.js',
    from: 'out = aiCall_(apiKey, system,', to: 'schema, 2048);',
    필수: [{ re: /bankList\.join/, 왜: '판정 목록이 문법 뱅크 파생이 아니다' },
      { re: /bySid\[sid\]/, 왜: '실리는 것은 묶인 제출문뿐이어야 한다' }],
    금지: [{ re: /\bsid\s*\+|\+\s*sid\b/, 왜: '문법 판정 입력에 student_id 가 문자열로 이어 붙었다' }],
  },
  {
    id: '문법판정-말하기입력', file: '교재연동.js',
    from: 'out = aiCall_(apiKey, 음성지문,', to: 'schema, 2048);',
    필수: [{ re: /bankList\.join/, 왜: '판정 목록이 문법 뱅크 파생이 아니다' },
      { re: /글\[sid\]/, 왜: '실리는 것은 묶인 전사문뿐이어야 한다' }],
    금지: [{ re: /\bsid\s*\+|\+\s*sid\b/, 왜: '말하기 판정 입력에 student_id 가 문자열로 이어 붙었다' }],
  },
  {
    id: '주간리포트-H7', file: '엔진_셋업확장.js',
    from: 'cmtH7 = aiText_(', to: ', 900)',
    필수: [{ re: /aiBody/, 왜: 'AI 해설 입력은 집계 화이트리스트(aiBody)만' }],
    금지: [{ re: /\bbody\b/, 왜: '리포트 전문(이름 6개 섹션 포함)이 통째로 벤더에 나간다' }],
  },
];

function 조각(src, 자리) {
  const i = src.indexOf(자리.from);
  if (i < 0) return null;
  const j = src.indexOf(자리.to, i + 자리.from.length);
  if (j < 0) return null;
  return src.slice(i, j + 자리.to.length);
}

/** 한 자리를 검사해 문제 목록을 낸다 — 빈 배열이면 깨끗하다. 조각을 못 찾으면 그것도 문제다(분모 F207). */
function 자리검사(src, 자리) {
  const 문제 = [];
  const s = 조각(src, 자리);
  if (s === null) { 문제.push(`${자리.id}: 조각을 못 찾았다(${자리.from} … ${자리.to}) — 코드가 옮겨졌으면 자리 목록을 갱신하라`); return 문제; }
  for (const f of 자리.필수) if (!f.re.test(s)) 문제.push(`${자리.id}: 필수 누락 — ${f.왜}`);
  for (const g of 자리.금지) if (g.re.test(s)) 문제.push(`${자리.id}: 금지 검출 — ${g.왜}`);
  return 문제;
}

const 처방 = [
  '방향 불변식 4(docs/제품방향.md:62): 이름·연락처·student_id·생년·학교는 외부 모델로 내보내지 않는다.',
  '처방 실물 셋이 저장소에 이미 있다 — 오류은행(개인정보 제거 지시)·반 브리핑(집계만)·SNS 초안(숫자만).',
  '매칭이 필요하면 이름이 아니라 인덱스(i)로 한다 — 튜터·칭호·리텐션이 그 꼴이다.',
  '정본 = docs/_ops/작업대기열.md P0 「학생 이름 외부 유출」 · 근거 커밋 108bbefa.',
].join('\n');

/* 🔴 0건과 「아무것도 안 봤다」가 같은 모양이다 — 분모(스냅샷·조각 존재)를 먼저 못박는다(F207). */
test('호출부 전수 — 벤더 호출부 수가 스냅샷과 같다(새 호출부 = 등재 전까지 빨강)', () => {
  const 프로젝트들 = claspProjects();
  assert.ok(프로젝트들.length > 0, 'clasp 프로젝트를 하나도 못 찾았다');
  const counts = {};
  for (const p of 프로젝트들) Object.assign(counts, 호출부세기(p, ROOT));
  assert.deepStrictEqual(counts, 호출부스냅샷,
    '벤더 호출부 전수가 변했다. 새 호출부라면: 이름·식별자·자유서술 원문이 실리지 않음을 확인하고, 이 파일 자리 목록에 검사를 추가한 뒤 스냅샷을 갱신하라. 숫자만 올리지 않는다.\n' + 처방);
});

test('자리별 — 도는 호출부 어디에도 이름 필드가 조립식에 없다', () => {
  const bySrc = {};
  const 문제 = [];
  for (const 자리 of 자리들) {
    if (!(자리.file in bySrc)) bySrc[자리.file] = fs.readFileSync(path.join(ROOT, 자리.file), 'utf8');
    문제.push(...자리검사(bySrc[자리.file], 자리));
  }
  assert.deepStrictEqual(문제, [], 처방);
});

test('주간리포트 화이트리스트 — AI에 실리는 섹션이 집계 전용 여섯뿐이다', () => {
  const src = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const s = 조각(src, { from: 'const sections = [', to: '];' });
  assert.ok(s, 'sections 배열을 못 찾았다');
  const 실림 = [];
  s.split(/\r?\n/).forEach((ln) => {
    const m = ln.match(/^\s*\['([^']+)',.*,\s*true\]/);
    if (m) 실림.push(m[1]);
  });
  assert.deepStrictEqual(실림.sort(), [
    '📈 KPI(이탈·전환)', '📟 경영계기판', '📨 메신저 연결(학부모)',
    '🔁 결석 복귀율(강사별)', '📋 마감 제출률', '🔇 4주차 침묵 학생',
  ].sort(),
    '화이트리스트가 변했다 — 새로 실은 섹션의 반환 문자열에 이름·학생ID·연락처·자유서술 원문이 없음을 실측(그 함수의 텍스트 반환 경로)한 뒤에만 갱신하라.\n' + 처방);
});

/* 🔴 실저장소는 이제 0건이라 탐지력을 못 잰다 — 그 몫은 픽스처가 진다(버그 존치를 요구하는 회귀 금지). */
test('탐지력 — 이름이 되끼는 여섯 모양을 픽스처로 잡는다', () => {
  const 픽스처 = [
    { src: "function callClaudeFeedback_(apiKey, stu, text) {\n  const body = { messages: [{ role: 'user', content: '학생: ' + stu.name + '\\n제출 문장:\\n' + text }] };\n  const res = UrlFetchApp.fetch('u');\n}", id: '첨삭-호출', 기대: ['필수 누락', '금지 검출'] },
    { src: "const userMsg = chunk.map((s, i) => { return i + '. ' + s.n + ' | 급수 ' + s.lv; }).join('\\n');\n aiCall_(k, 'x', '학생 목록:' + userMsg);", id: '튜터-입력', 기대: ['금지 검출'] },
    { src: "aiCall_(apiKey, 'SYNK LAB 리텐션 조수. …', list.map(x => x.n + ' (' + x.c + ') — ' + x.w).join('\\n'), rSchema, 3072)", id: '리텐션-입력', 기대: ['금지 검출'] },
    { src: "aiCall_(apiKey, 'SYNK LAB … 칭호 작명가. …', chunk.map((s, i) => i + '. ' + s.n + ' | 월').join('\\n'), tSchema, 4096)", id: '칭호-입력', 기대: ['금지 검출'] },
    { src: "let report = aiText_('몽골 학생의 한국어 레벨 테스트 결과로 … 이름: ' + nm + ' 점수 ' + score, 1536);\n if (!report) report = nm + ' — Таны оноо';", id: '레벨진단-입력', 기대: ['필수 누락', '금지 검출'] },
    { src: "const cmtH7 = aiText_('주간 리포트다 …' + body.slice(0, 6000), 900)", id: '주간리포트-H7', 기대: ['필수 누락', '금지 검출'] },
    { src: "out = aiCall_(apiKey, system, '학생 ' + sid + ' 문장:\\n' + bySid[sid], schema, 2048);", id: '문법판정-쓰기입력', 기대: ['필수 누락', '금지 검출'] },
    { src: "out = aiCall_(apiKey, 음성지문, '학생 ' + sid + ' 전사:\\n' + 글[sid], schema, 2048);", id: '문법판정-말하기입력', 기대: ['필수 누락', '금지 검출'] },
  ];
  for (const f of 픽스처) {
    const 자리 = 자리들.find((z) => z.id === f.id);
    assert.ok(자리, `픽스처가 가리키는 자리(${f.id})가 목록에 없다`);
    const 문제 = 자리검사(f.src, 자리);
    for (const 기대 of f.기대) {
      assert.ok(문제.some((p) => p.includes(기대)), `픽스처(${f.id})의 ${기대}를 못 잡았다: ${JSON.stringify(문제)}`);
    }
  }
});

/* 거짓양성 — 지금의 깨끗한 실물이 통과하는 것은 「자리별」 테스트가 실파일로 이미 증명한다.
 * 여기서는 헷갈리기 쉬운 정상 표기를 못박는다(걸리면 다음 사람이 검사를 끈다). */
test('거짓양성 — 인덱스 매칭·aiBody·lvl.n·rowsN 은 통과한다', () => {
  const 정상 = [
    { src: "const userMsg = chunk.map((s, i) => { const rowsN = []; return i + '. 급수 ' + (s.lv || '미정'); }).join('\\n'); aiCall_(k, 'x', '학생 목록:' + userMsg);", id: '튜터-입력' },
    { src: "aiCall_(apiKey, 'SYNK LAB 리텐션 조수. …', list.map((x, i) => i + '. (' + x.c + ') — ' + x.w).join('\\n'), rSchema, 3072)", id: '리텐션-입력' },
    { src: "let report = aiText_('몽골 학생의 한국어 레벨 테스트 결과로 … 판정 레벨: ' + lvl.n + ' (' + lvl.d + ')', 1536);\n if (report) report = nm + ' —\\n' + report;\n if (!report) report = nm + ' — Таны оноо';", id: '레벨진단-입력' },
    { src: "const cmtH7 = aiText_('주간 리포트다 …' + aiBody.slice(0, 6000), 900)", id: '주간리포트-H7' },
  ];
  for (const f of 정상) {
    const 자리 = 자리들.find((z) => z.id === f.id);
    const 문제 = 자리검사(f.src, 자리).filter((p) => p.includes('금지 검출'));
    assert.deepStrictEqual(문제, [], `거짓양성(${f.id})`);
  }
});
