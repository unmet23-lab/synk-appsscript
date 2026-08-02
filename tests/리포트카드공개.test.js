/* [v9.138] 리포트카드 공개 링크 회귀 테스트 — 2026-08-03 적대 검토가 잡은 결함의 재발 방지.
 *
 * 결함: previewOneReportCard가 학생 카드 PNG(실명·급수·모의점수·출결·포인트·강사 코멘트)를
 *       ANYONE_WITH_LINK로 공유하고 그 공개 URL을 반환했다. 호출부는 0개 — 아무것도 사지 못하는 공유였다.
 *
 * 원칙(guard-must-check-result): **문자열이 아니라 실행 결과를 본다.** 그래서 previewOneReportCard는
 *   진짜 함수를 그대로 부르고, 협력 함수(슬라이드 렌더·데이터 조립)만 스텁으로 갈아끼운 뒤
 *   「Drive에 setSharing이 불렸는가」를 관찰한다. 주석·변수명을 바꿔도 이 검사는 안 죽고,
 *   공유를 되살리면 반드시 깨진다.
 *
 * ⚠ 이 파일이 지키는 경계 하나 — closePreviewCardLinks는 PREVIEW_ 접두어만 닫아야 한다.
 *   배치 카드까지 닫으면 Glide 학부모 「성장 리포트」 탭이 통째로 빈 이미지가 된다(라이브 사고). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { ROOT, ENGINE_FILES, engineSource } = require('./_engine-source');

/** 소스 읽기 — 줄끝을 LF로 통일한다. 이 저장소 작업본은 CRLF라 '\n}\n' 같은 표식이 안 걸린다. */
const readSrc = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

/* ── GAS 스텁 ────────────────────────────────────────────────────────── */
const ACCESS = {
  ANYONE: 'A_ANYONE', ANYONE_WITH_LINK: 'A_ANYONE_WITH_LINK',
  DOMAIN: 'A_DOMAIN', DOMAIN_WITH_LINK: 'A_DOMAIN_WITH_LINK', PRIVATE: 'A_PRIVATE',
};
const PERM = { VIEW: 'P_VIEW', EDIT: 'P_EDIT', COMMENT: 'P_COMMENT', NONE: 'P_NONE', OWNER: 'P_OWNER' };

/** 실행 중 관찰 기록 — 테스트마다 reset()으로 비운다. */
const rec = { sharing: [], created: [], logs: [] };
const reset = () => {
  rec.sharing = []; rec.created = []; rec.logs = [];
  state.folderFiles = []; state.folderAccess = 'A_PRIVATE'; state.folderAccessThrows = false; state.byId = {};
};

/** 폴더 상태 — 테스트가 갈아끼운다. folderAccess = 폴더 자체의 공유(상속의 원천). */
const state = { folderFiles: [], folderAccess: 'A_PRIVATE', folderAccessThrows: false, byId: {} };

function makeFile(name, access, opts) {
  const o = opts || {};
  const f = {
    _access: access,
    getName: () => { if (o.nameThrows) throw new Error('이름 조회 실패'); return name; },
    getId: () => 'ID_' + name,
    getUrl: () => 'https://drive.google.com/file/d/ID_' + name + '/view',
    getSharingAccess: () => { if (o.accessThrows) throw new Error('공유 상태 조회 실패'); return f._access; },
    setSharing: (a, p) => {
      if (o.setThrows) throw new Error('공유 변경 실패');
      rec.sharing.push({ name: name, access: a, permission: p });
      f._access = a;
      return f;
    },
  };
  return f;
}

const iter = (arr) => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };

const DriveAppMock = {
  Access: ACCESS,
  Permission: PERM,
  getFoldersByName: () => iter([{
    getSharingAccess: () => {
      if (state.folderAccessThrows) throw new Error('폴더 공유 상태 조회 실패');
      return state.folderAccess;
    },
    getFiles: () => iter(state.folderFiles),
    createFile: (blob) => {
      const f = makeFile(blob._name, ACCESS.PRIVATE);
      rec.created.push(blob._name);
      state.folderFiles.push(f);
      return f;
    },
  }]),
  createFolder: () => { throw new Error('테스트에서 폴더를 새로 만들 일이 없다'); },
  getFileById: (id) => {
    const f = state.byId[id];
    if (!f) throw new Error('없는 파일: ' + id);
    return f;
  },
};

const pad = (n) => String(n).padStart(2, '0');
const UtilitiesMock = {
  sleep: () => {},
  formatDate: (d, tz, fmt) => {
    const Y = d.getFullYear(), M = pad(d.getMonth() + 1), D = pad(d.getDate());
    if (fmt === 'yyyy-MM') return Y + '-' + M;
    if (fmt === 'yyyyMMdd') return '' + Y + M + D;
    return Y + '-' + M + '-' + D;
  },
};

// profiles: A=user_id · B=이름 · D=역할
const profileRows = [
  ['SYNK-001', '바트', '', 'student'],
  ['SYNK-002', '어윤', '', 'student'],
];
const profilesSheet = {
  getLastRow: () => profileRows.length + 1,
  getLastColumn: () => 74,
  getRange: () => ({ getValues: () => profileRows }),
};

const stub = new Proxy(function () {}, { get: () => stub, apply: () => stub });
const ctx = {
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar',
      getSheetByName: (n) => (n === 'profiles' ? profilesSheet : null),
    }),
    getUi: () => ({ alert: () => {} }),
  },
  DriveApp: DriveAppMock,
  Utilities: UtilitiesMock,
  SlidesApp: {
    openById: () => ({
      getSlides: () => [{ getObjectId: () => 'PAGE1', remove: () => {} }],
      saveAndClose: () => {},
    }),
  },
  Logger: { log: (m) => rec.logs.push(String(m)) },
  PropertiesService: stub, Session: stub, MailApp: stub, GmailApp: stub,
  UrlFetchApp: stub, FormApp: stub, DocumentApp: stub, ScriptApp: stub,
  CacheService: stub, LockService: stub, HtmlService: stub, console,
};
vm.createContext(ctx);
vm.runInContext(engineSource(), ctx);

/* 협력 함수만 스텁으로 교체 — previewOneReportCard 본체는 진짜를 그대로 실행한다.
 * (톱레벨 function 선언은 전역 속성이라 덮어쓸 수 있다. const인 REPORT_* 상수는 실값을 그대로 쓴다.) */
ctx.reportTemplateSlide_ = () => ({ duplicate: () => ({ getObjectId: () => 'PAGE1' }) });
ctx.fillReportCardSlide_ = () => {};
ctx.readAcademicLogs_ = () => ({});
ctx.monsterImgMap_ = () => ({});
ctx.reportCardData_ = (r) => ({
  sid: r[0], name: r[1], levelText: '3급', mockText: '모의', scoreText: '80',
  attendText: '출석 20/20', stageText: '2단계', pointsText: '1,200P', comment: '잘하고 있어요',
});
ctx.exportSlidePng = () => ({ _name: '', setName(n) { this._name = n; return this; } });

/* ── ① 프리뷰는 공유하지 않는다 (실행 검증) ─────────────────────────── */

test('[v9.138] previewOneReportCard는 Drive 파일을 공유하지 않는다', () => {
  reset();
  const url = ctx.previewOneReportCard('SYNK-001');

  assert.equal(rec.created.length, 1, '프리뷰 파일이 생성되지 않았다 — 테스트 배선이 깨졌다');
  assert.deepEqual(rec.sharing, [],
    'previewOneReportCard가 setSharing을 호출했다 — 학생 실명·성적 카드가 인증 없이 열리는 링크가 다시 생겼다');
  assert.ok(url, '프리뷰 URL이 반환되지 않았다');
  assert.ok(!/lh3\.googleusercontent\.com/.test(url),
    '공개 lh3 URL을 반환한다 — 이 주소는 파일이 공개일 때만 열리므로 공개 공유를 전제한다');
  assert.ok(/drive\.google\.com/.test(url),
    '소유자 인증 Drive 링크(getUrl)가 아니다 — 유호님이 열 수 없는 주소를 돌려준다');
});

test('[v9.138] 프리뷰 파일명에 학생 실명이 들어가지 않는다', () => {
  reset();
  ctx.previewOneReportCard('SYNK-001');
  const name = rec.created[0];
  assert.ok(name.indexOf('PREVIEW_') === 0, '정리 함수가 잡을 PREVIEW_ 접두어가 없다: ' + name);
  assert.ok(name.includes('SYNK-001'), '학생ID가 없어 어느 학생 프리뷰인지 분간할 수 없다: ' + name);
  assert.ok(!name.includes('바트'),
    'Drive 파일명에 실명이 박힌다 — 목록·공유 화면에 이름이 그대로 뜬다: ' + name);
});

test('[v9.138] 인자 없이 실행하면 첫 학생을 고르되, 그 경우에도 공유는 없다', () => {
  reset();
  // [v9.19] 드롭다운 ▶는 인자를 못 넘기므로 자동 선택이 정상 동작이다 — 문제는 그게 아니라 공유였다
  const url = ctx.previewOneReportCard('');
  assert.equal(rec.created.length, 1, '자동 선택 경로가 카드를 만들지 않았다');
  assert.ok(rec.created[0].includes('SYNK-001'), '첫 학생(SYNK-001)이 선택되지 않았다');
  assert.deepEqual(rec.sharing, [], '자동 선택 경로에서 공개 공유가 남아 있다');
  assert.ok(!/lh3\.googleusercontent\.com/.test(url), '자동 선택 경로가 공개 URL을 반환한다');
});

/* ── ② 이미 새어 있는 링크를 닫는다 (실행 검증) ─────────────────────── */

test('[v9.138] closePreviewCardLinks는 공개된 프리뷰를 비공개로 닫는다', () => {
  reset();
  state.folderFiles = [
    makeFile('PREVIEW_2026-07_SYNK-001.png', ACCESS.ANYONE_WITH_LINK),
    makeFile('PREVIEW_2026-06_SYNK-002.png', ACCESS.ANYONE),
  ];
  const out = ctx.closePreviewCardLinks();

  assert.equal(rec.sharing.length, 2, '공개 프리뷰 2개를 닫지 않았다');
  rec.sharing.forEach((s) => {
    assert.equal(s.access, ACCESS.PRIVATE, '비공개(PRIVATE)로 닫지 않았다: ' + s.name);
    assert.equal(s.permission, PERM.NONE, '권한을 NONE으로 내리지 않았다: ' + s.name);
  });
  assert.ok(/2개/.test(out), '몇 개를 닫았는지 보고하지 않는다 — 유호님이 결과를 확인할 수 없다');
});

test('[v9.138] 🔴 배치 카드는 절대 건드리지 않는다 (건드리면 학부모 화면이 빈다)', () => {
  reset();
  state.folderFiles = [
    makeFile('2026-07_SYNK-001_바트.png', ACCESS.ANYONE_WITH_LINK),   // 배치 카드 — Glide가 읽는다
    makeFile('2026-06_SYNK-002_어윤.png', ACCESS.ANYONE_WITH_LINK),   // 배치 카드
    makeFile('PREVIEW_2026-07_SYNK-001.png', ACCESS.ANYONE_WITH_LINK), // 프리뷰 — 이것만 닫혀야 한다
  ];
  ctx.closePreviewCardLinks();

  assert.equal(rec.sharing.length, 1,
    '배치 카드까지 닫았다 — report_cards.image_url이 죽어 학부모 성장 리포트 탭이 전부 빈 이미지가 된다');
  assert.equal(rec.sharing[0].name, 'PREVIEW_2026-07_SYNK-001.png');
});

test('[v9.138] 공유 상태를 못 읽으면 닫는다 — 판정 불가를 통과로 바꾸지 않는다', () => {
  reset();
  state.folderFiles = [makeFile('PREVIEW_2026-05_SYNK-003.png', null, { accessThrows: true })];
  ctx.closePreviewCardLinks();
  assert.equal(rec.sharing.length, 1,
    '상태를 못 읽은 파일을 그냥 넘겼다 — 공개인 채로 남는데 로그는 "정리 완료"라고 말한다');
  assert.equal(rec.sharing[0].access, ACCESS.PRIVATE);
});

test('[v9.138] 이미 비공개면 다시 건드리지 않는다 (멱등 — 여러 번 눌러도 같다)', () => {
  reset();
  state.folderFiles = [makeFile('PREVIEW_2026-04_SYNK-004.png', ACCESS.PRIVATE)];
  ctx.closePreviewCardLinks();
  assert.equal(rec.sharing.length, 0, '이미 비공개인 파일에 불필요한 Drive 쓰기를 한다');
});

test('[v9.138] 한 파일이 실패해도 나머지를 계속 닫고, 실패를 숨기지 않는다', () => {
  reset();
  state.folderFiles = [
    makeFile('PREVIEW_a.png', ACCESS.ANYONE_WITH_LINK, { setThrows: true }),
    makeFile('PREVIEW_b.png', ACCESS.ANYONE_WITH_LINK),
  ];
  const out = ctx.closePreviewCardLinks();
  assert.equal(rec.sharing.length, 1, '한 건이 실패하자 나머지를 포기했다');
  assert.ok(/실패/.test(out), '실패를 보고하지 않는다 — 안 닫힌 파일이 있는데 성공처럼 읽힌다');
});

/* ── ②-b 적대 리뷰가 잡은 두 구멍 (2026-08-03) ──────────────────────── */

test('[v9.138] DOMAIN 공유를 「이미 비공개」로 세지 않는다 (fail-open 차단)', () => {
  // Access는 5종 — ANYONE·ANYONE_WITH_LINK만 공개로 보면 DOMAIN 계열이 틈으로 빠진다.
  // 지금 계정은 개인 Gmail이라 노출이 없지만, 운영 도메인 계정 이관 순간 실재한다.
  reset();
  state.folderFiles = [
    makeFile('PREVIEW_d1.png', ACCESS.DOMAIN),
    makeFile('PREVIEW_d2.png', ACCESS.DOMAIN_WITH_LINK),
  ];
  ctx.closePreviewCardLinks();
  assert.equal(rec.sharing.length, 2,
    'DOMAIN·DOMAIN_WITH_LINK를 닫지 않았다 — 도메인 전체에 열린 파일을 「이미 비공개」로 센다');
  rec.sharing.forEach((s) => assert.equal(s.access, ACCESS.PRIVATE));
});

test('[v9.138] 🔴 폴더가 공개면 숫자만 말하지 않고 그 사실을 알린다', () => {
  // Drive는 폴더 권한을 자식에게 상속시키고 자식은 그걸 뗄 수 없다. 그런데 파일의
  // getSharingAccess()는 자기 설정(PRIVATE)만 돌려주므로, 상속으로 열린 파일이
  // 「이미 비공개」로 집계된다 — 보고서가 거짓말하는 자리라 폴더 상태를 함께 말해야 한다.
  reset();
  state.folderAccess = ACCESS.ANYONE_WITH_LINK;
  state.folderFiles = [makeFile('PREVIEW_x.png', ACCESS.PRIVATE)];
  const out = ctx.closePreviewCardLinks();
  state.folderAccess = ACCESS.PRIVATE;

  assert.ok(/폴더 자체가 공개/.test(out),
    '폴더가 공개인데 침묵한다 — 유호님이 "닫을 게 없었네"로 읽고 유출이 열린 채 남는다');
  assert.ok(/제한됨/.test(out), '무엇을 해야 하는지(폴더 공유를 제한됨으로)를 말하지 않는다');
  /* 2026-08-03 실측으로 뒤집힌 문장 — 예전엔 "폴더를 잠가도 안 깨진다"고 안내했는데 **거짓이었다**.
   * 배치 카드에는 자기 공유가 없었고(= setSharing이 줄곧 실패) 공개는 전부 폴더 상속이었다.
   * 그래서 경고는 이제 「깨진다」는 사실과 순서를 말해야 한다. 낙관적 문구가 돌아오면 이 검사가 죽는다. */
  assert.ok(/깨집니다/.test(out) && !/안 깨집니다/.test(out),
    '폴더를 잠그면 학부모 카드가 함께 깨진다는 사실을 숨긴다 — 08-03 실측으로 확인된 결과다');
});

test('[v9.140] 배치 공유 실패를 세고 원장에게 알린다 (조용한 실패 금지)', () => {
  // 구 코드는 '폴더 공유 설정으로 대체'라고만 로그했고, 그 문장이 몇 달간 문제를 가렸다.
  // 폴더를 잠근 뒤에는 대체 수단이 없으므로 이 알림이 유일한 신호다.
  const src = readSrc('엔진_폼리포트.js');
  const s = src.indexOf('function runReportCards_(');
  const raw = src.slice(s, src.indexOf('\n}\n', s));
  // 주석을 걷어내고 **코드만** 본다 — 옛 문구를 설명하는 주석에 걸려 거짓 실패하지 않도록
  const body = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(body.includes('createFile('), '주석 제거가 코드까지 지웠다');
  assert.ok(/shareFail\+\+/.test(body), '공유 실패를 세지 않는다 — 몇 건이 깨졌는지 알 수 없다');
  assert.ok(!body.includes('폴더 공유 설정으로 대체'),
    '「폴더 공유 설정으로 대체」가 코드에 남아 있다 — 폴더를 잠근 지금 그 대체 수단은 존재하지 않는다');
  const notify = body.indexOf('adminMail(\'[SYNK] ⚠️ 리포트카드 공유 설정 실패');
  assert.notEqual(notify, -1, '공유 실패를 원장에게 알리지 않는다 — 시트엔 URL이 적히고 화면만 빈다');
  assert.ok(body.indexOf('if (shareFail)') < notify, '실패가 없어도 알림이 나간다(오탐)');
});

test('[v9.138] 폴더가 비공개면 불필요한 경고를 붙이지 않는다 (오탐 0)', () => {
  reset();
  state.folderAccess = ACCESS.PRIVATE;
  state.folderFiles = [makeFile('PREVIEW_y.png', ACCESS.ANYONE_WITH_LINK)];
  const out = ctx.closePreviewCardLinks();
  assert.ok(!/폴더 자체가 공개/.test(out), '폴더가 비공개인데 공개라고 경고한다');
  assert.equal(rec.sharing.length, 1, '정상 경로에서 파일을 닫지 않았다');
});

test('[v9.138] 폴더 상태를 못 읽으면 숫자를 믿지 말라고 말한다', () => {
  reset();
  state.folderAccessThrows = true;
  state.folderFiles = [makeFile('PREVIEW_z.png', ACCESS.ANYONE_WITH_LINK)];
  const out = ctx.closePreviewCardLinks();
  state.folderAccessThrows = false;
  assert.ok(/읽지 못했습니다/.test(out),
    '폴더 상태를 못 읽었는데 조용히 넘어간다 — 상속분을 놓친 숫자가 완료처럼 읽힌다');
  assert.equal(rec.sharing.length, 1, '폴더를 못 읽었다고 파일 정리를 멈추면 안 된다');
});

/* ── ②-c 카드 링크 복구 (폴더 잠금 뒤 화면을 되살리는 유일한 수단) ──── */

const rcSheet = (rows) => ({
  getLastRow: () => rows.length + 1,
  getRange: () => ({ getValues: () => rows }),
});
// report_cards: A=card_id B=student_id C=월 D=image_url
const RC_ROWS = [
  ['2026-08-S1', 'S1', '2026-08', 'https://lh3.googleusercontent.com/d/ID_A'],
  ['2026-08-S2', 'S2', '2026-08', 'https://lh3.googleusercontent.com/d/ID_B'],
  ['2026-06-S3', 'S3', '2026-06', 'https://placehold.co/600x800/png'], // 플레이스홀더 — Drive 아님
];
/** report_cards를 보게 만든 뒤 복구 함수를 돌린다. Drive는 id→파일 맵으로 스텁. */
function runRepair(rows, filesById) {
  state.byId = filesById;
  const prev = ctx.SpreadsheetApp;
  ctx.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar',
      getSheetByName: (n) => (n === 'report_cards' ? rcSheet(rows) : null),
    }),
    getUi: () => ({ alert: () => {} }),
  };
  try { return ctx.repairReportCardSharing(); } finally { ctx.SpreadsheetApp = prev; }
}

test('[v9.142] 카드 링크 복구 — report_cards의 카드에만 공개 링크를 되살린다', () => {
  reset();
  const a = makeFile('2026-08_S1.png', ACCESS.PRIVATE);
  const b = makeFile('2026-08_S2.png', ACCESS.PRIVATE);
  const out = runRepair(RC_ROWS, { ID_A: a, ID_B: b });

  assert.equal(rec.sharing.length, 2, 'Drive 카드 2개를 복구하지 않았다');
  rec.sharing.forEach((s) => {
    assert.equal(s.access, ACCESS.ANYONE_WITH_LINK, '공개 링크로 되살리지 않았다');
    assert.equal(s.permission, PERM.VIEW, '보기 권한이 아니다');
  });
  assert.ok(/복구 2개/.test(out), '복구 건수를 보고하지 않는다');
});

test('[v9.142] 🔴 폴더를 훑지 않는다 — 대상은 report_cards가 지목한 파일뿐', () => {
  // 폴더 순회로 만들면 프리뷰·남의 파일까지 공개로 열어버린다. 시트가 화이트리스트다.
  reset();
  state.folderFiles = [makeFile('PREVIEW_hack.png', ACCESS.PRIVATE), makeFile('남의파일.png', ACCESS.PRIVATE)];
  const a = makeFile('2026-08_S1.png', ACCESS.PRIVATE);
  runRepair([RC_ROWS[0]], { ID_A: a });
  assert.equal(rec.sharing.length, 1, '시트에 없는 파일까지 건드렸다 — 프리뷰가 다시 공개된다');
  assert.equal(rec.sharing[0].name, '2026-08_S1.png');
});

test('[v9.142] 이미 공개면 다시 쓰지 않는다 (멱등)', () => {
  reset();
  const a = makeFile('2026-08_S1.png', ACCESS.ANYONE_WITH_LINK);
  const out = runRepair([RC_ROWS[0]], { ID_A: a });
  assert.equal(rec.sharing.length, 0, '이미 공개인 카드에 불필요한 Drive 쓰기를 한다');
  assert.ok(/이미 공개 1개/.test(out));
});

test('[v9.142] 실패하면 첫 오류 원문을 남긴다 — 가설이 틀렸을 때의 재료', () => {
  reset();
  const a = makeFile('2026-08_S1.png', ACCESS.PRIVATE, { setThrows: true });
  const out = runRepair([RC_ROWS[0]], { ID_A: a });
  assert.ok(/실패 1개/.test(out), '실패 건수를 숨긴다');
  assert.ok(/첫 오류/.test(out), '오류 원문을 남기지 않는다 — 다음 조사가 맨손이 된다');
});

test('[v9.143] 공유 실패 알림이 폴더 상태를 읽어 원인을 지목한다', () => {
  /* 「공유 설정 실패」만 적으면 받는 사람이 무엇을 볼지 모른다. 이 실패의 1순위 원인은
   * 08-03 실측으로 밝혀져 있다 — 폴더가 (다시) 공개면 상속과 충돌해 전부 거부된다.
   * 그러니 알림은 그 한 줄을 스스로 확인해서 담아야 한다. */
  const src = readSrc('엔진_폼리포트.js');
  const s = src.indexOf('function runReportCards_(');
  const raw = src.slice(s, src.indexOf('\n}\n', s));
  const body = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(body.includes('createFile('), '주석 제거가 코드까지 지웠다');

  const hint = body.indexOf('folderHint');
  const read = body.indexOf('folder.getSharingAccess()');
  const mail = body.indexOf('adminMail(');
  assert.notEqual(read, -1, '알림이 폴더 상태를 읽지 않는다 — 원인을 지목하지 못한다');
  assert.ok(hint !== -1 && hint < mail, '폴더 판정이 메일보다 뒤에 있다(메일에 못 실린다)');
  assert.ok(read < mail, '폴더를 읽기 전에 메일을 보낸다');
  // 공개일 때는 되돌릴 방법을 말해야 한다(진단만 하고 처방이 없으면 반쪽이다)
  assert.ok(/제한됨/.test(body), '폴더를 되돌리는 방법(제한됨)을 말하지 않는다');
  assert.ok(/복구/.test(body), '복구 수단(메뉴)을 안내하지 않는다');
});

/* ── ③ 저장소 전체 — 공개 공유는 승인된 두 자리에만 있다 ───────────── */

test('[v9.138] 새 공개 공유(setSharing ANYONE)가 승인 없이 늘지 않는다', () => {
  const GRANT = /setSharing\(\s*DriveApp\.Access\.ANYONE/g;
  /* 승인된 자리 — 둘 다 「끄면 라이브 화면이 죽는」 배선이라 남긴 것이지, 안전해서가 아니다.
   *   엔진_폼리포트.js runReportCards_ : report_cards.image_url → Glide 학부모 성장 리포트 탭
   *   교재연동.js      voiceSweep_     : voice_log/목소리성장카드 → 학생 앱 녹음 재생
   * 여기 숫자를 올리려면 「이 URL이 어디로 흘러가고, 없으면 무엇이 죽는가」를 먼저 답해야 한다. */
  const APPROVED = { '엔진_폼리포트.js': 2, '교재연동.js': 1 }; // [v9.142] 폼리포트 2 = 배치 + 카드 링크 복구

  const roots = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js'));
  assert.ok(roots.length >= 5, '루트 .js 목록을 못 읽었다 — 이 검사가 아무것도 안 보고 통과한다');

  const found = {};
  roots.forEach((f) => {
    const n = (fs.readFileSync(path.join(ROOT, f), 'utf8').match(GRANT) || []).length;
    if (n) found[f] = n;
  });
  assert.deepEqual(found, APPROVED,
    '공개 공유(ANYONE) 자리가 승인 목록과 다르다. 실측=' + JSON.stringify(found) +
    ' / 승인=' + JSON.stringify(APPROVED) +
    ' — 새로 늘렸다면 그 URL이 어디로 흘러가는지 밝히고 이 목록을 함께 고쳐라.');
});

test('[v9.138] previewOneReportCard 본문에는 공유·공개URL이 한 글자도 없다', () => {
  const src = readSrc('엔진_폼리포트.js');
  const s = src.indexOf('function previewOneReportCard(');
  assert.notEqual(s, -1, 'previewOneReportCard를 찾지 못했다 — 함수명이 바뀌면 이 검사를 갱신하라');
  // 닫는 중괄호까지만 자른다 — '다음 function까지'로 자르면 뒤따르는 주석(setSharing을 설명하는
  // 문장)이 딸려 들어와 검사가 거짓으로 실패한다(실제로 한 번 겪었다).
  const end = src.indexOf('\n}\n', s);
  assert.notEqual(end, -1, '함수 끝(열 0의 })을 못 찾았다');
  const raw = src.slice(s, end);
  assert.ok(raw.includes('previewOneReportCard'), '엉뚱한 구간을 잘랐다');
  // 주석을 걷어내고 **코드만** 본다 — "setSharing 없음" 같은 설명 문장에 걸려 거짓 실패하지 않도록.
  // (`://`는 URL이라 줄주석으로 오인하지 않는다.)
  const body = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(body.includes('createFile('), '주석 제거가 코드까지 지웠다 — 이 검사가 빈 문자열을 통과시킨다');
  assert.ok(!body.includes('setSharing'), 'previewOneReportCard 본문에 setSharing이 돌아왔다');
  assert.ok(!body.includes('lh3.googleusercontent.com'), '본문이 공개 lh3 URL을 다시 만든다');
});

/* ── ④ 닫는 수단이 유호님에게 실제로 닿는가 ─────────────────────────── */

test('[v9.138] 프리뷰 링크 닫기가 SYNK 메뉴에 등재돼 있다', () => {
  const setup = readSrc('엔진_셋업확장.js');
  assert.ok(setup.includes("'menuClosePreviewCardLinks'"),
    'SYNK 메뉴에 없다 — 유호님(비개발자)이 Apps Script 편집기를 열지 않고는 링크를 닫을 수 없다');
  assert.equal(typeof ctx.menuClosePreviewCardLinks, 'function',
    '메뉴가 가리키는 함수가 실제로 없다 — 메뉴를 누르면 스크립트 오류가 난다');
  assert.equal(typeof ctx.closePreviewCardLinks, 'function', '정리 함수 자체가 없다');
});

test('[v9.138] 엔진 파일 목록에 이 검사가 보는 파일이 들어 있다', () => {
  // 분할이 또 일어나 previewOneReportCard가 다른 파일로 옮겨가면 위 검사들이 조용히 죽는다
  assert.ok(ENGINE_FILES.includes('엔진_폼리포트.js'), '엔진 목록에서 엔진_폼리포트.js가 빠졌다');
  assert.ok(ENGINE_FILES.includes('엔진_셋업확장.js'), '엔진 목록에서 엔진_셋업확장.js가 빠졌다');
});
