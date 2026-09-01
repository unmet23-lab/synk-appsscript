#!/usr/bin/env node
/**
 * 제미나이LM 묶음 생성기 — repo 정본에서 제미나이LM 업로드 폴더를 **생성**한다.
 * (2026-08-22 개명: 구글이 「노트북LM」을 이 이름으로 바꿨다. 폴더 이름 자체는 안 바꿨다 —
 *  아래 DEFAULT_OUT 주석 참고.)
 *
 * 왜 생성기인가:
 *   `docs/AI_스택_가이드.md` §1-5의 잠금 3개 중 하나가 「사본에 만든 날짜를 박는다 —
 *   사본을 손으로 관리하지 않는다」다. 손으로 올린 묶음은 스스로 낡음을 모르고,
 *   낡은 사본이 출처를 찍어 답하면 그게 정확히 「정본 분열」이다.
 *   → 다시 돌리면 폴더 전체가 새로 만들어진다(harness-export.js와 같은 정신).
 *
 * 사용:
 *   node tools/geminilm-export.js           # 바탕화면\SYNK_제미나이LM 에 생성
 *   node tools/geminilm-export.js --out <경로>
 *   node tools/geminilm-export.js --dry     # 무엇을 쓸지·무엇이 막히는지만 출력
 *
 * ⛔ 이 폴더는 **외부(구글 계정)로 나간다.** harness-export와 위험의 층이 다르다 —
 *    거긴 내 디스크 안이고 여긴 업로드다. 그래서 이름이 아니라 **내용까지** 검사한다.
 *    학생 개인정보·제3자 연락처·자격증명이 한 줄이라도 있으면 그 파일을 통째로 뺀다.
 *
 * require 시에는 아무것도 만들지 않는다 — 회귀 테스트가 아래 export 만 물어본다.
 * 생성 실행은 CLI 직접 호출뿐.
 *
 * 🔴 [2026-08-29 정정] 이 자리는 **없는 검사를 가리키고 있었다.** 옛 문구는 「회귀 테스트가
 *   { scanPII, DEFAULT_OUT }만 물어본다」였는데, 저장소 전체에서 `scanPII` 는 이 파일과
 *   `tools/geminilm-drive.js` 안에서만 나왔고 **테스트는 0벌**이었다(08-29 실측).
 *   위 PII 목록의 「이 파일의 회귀 테스트가 잡은 실결함」이라는 주석도 같은 유령을 가리켰다.
 *   지금은 실물이 있다 → `tests/반출식별자.test.js`.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..');
// 하네스 경로는 손으로 조립하지 않는다 — 이 자리엔 이 기계 이름이 박혀 있었다(F206).
const MEM = require('./memory-graph.js').memoryDir();
// 폴더 이름도 2026-08-22 갈아탔다(geminilm-drive.js 의 같은 주석 참고) — 단 이 폴더는
// 위험이 다르다: 매번 통째로 지우고 새로 만드는 «생성기 산출물»이라 살아있는 소스
// 바인딩이 없다(README 안내대로 이미 업로드된 노트북은 그 시점의 정적 사본을 갖고
// 있을 뿐, 이 폴더를 계속 지켜보지 않는다). 그래서 실물 웹 폴더 순서를 안 기다려도 된다.
const DEFAULT_OUT = path.join(os.homedir(), 'OneDrive', 'Desktop', 'SYNK_제미나이LM');

// ── 담지 않을 폴더 (경로 단위) ──────────────────────────────────────────
// _archive·_구본 = 낡은 판. 제미나이LM이 낡은 판을 출처로 찍어 답하는 것이
// 이 묶음의 최대 위험이라 아예 안 넣는다. 보안 폴더는 사업 기밀.
const DENY_DIR = [
  /[\\/]_archive([\\/]|$)/, /[\\/]_구본([\\/]|$)/, /[\\/]SYNK 보안([\\/]|$)/,
  /[\\/]node_modules([\\/]|$)/, /[\\/]worktrees([\\/]|$)/,
];

// ── 내용 게이트 ─────────────────────────────────────────────────────────
// 정책: 「사람이 실제로 쓰는 표기」로 잡되, 알려진 안전값은 리터럴로 통과시킨다.
// 화이트리스트를 안 두면 공개 업체 대표번호 하나 때문에 판정 이력이 통째로 빠지고,
// 그렇게 헛돌기 시작한 게이트는 곧 --force 로 꺼진다.
const ALLOW = [
  'unmet23@gmail.com', 'unmet27@gmail.com', '77yuhbs@gmail.com',  // 유호님 본인 계정
  'info@qpay.mn', '+976 7610 2211',                                // QPay 공개 고객센터
  // SYNK 공개 연락처 — 둘 다 개인정보처리방침에 **게시된** 주소다(비공개 개인정보가 아니다)
  'hello@synk.im',                                                 // 삭제·철회 접수 창구
  'founder@synk.im',                                               // 개인정보 관리 책임자(양유호)
  'demo0X@synk.test',                                              // 문서용 더미
  // [08-29 · 출처 08-30 정정] 크루카드 이관 회귀의 픽스처 학생 「바트」의 연락처 — 실사람이 아니다.
  //   `tests/크루카드.test.js` 의 두 검사가 같은 값을 픽스처로 쓴다(재제출 병합 · 동일인키_).
  //   ⚠ 첫 판은 이 출처를 «왕복시험 픽스처»라 적고 `tools/왕복시험.js` 를 가리켰는데 **그런 파일은
  //     저장소에 없다**(08-30 재확인 · find 0건). 줄 번호도 빼 둔다 — 태어나는 순간 낡는다.
  //   라벨 식별자 축을 켜면서 실코퍼스에서 유일하게 걸린 값이라 **값 단위로** 통과시킨다.
  '9911-2233',
  // [09-01] **우리 브랜드 이름**이 「이름」 라벨 뒤에 서는 자리 — 사람 이름이 아니다.
  //   실물 = `docs/SHIFT/계정개설_실행지.md:183` 「페이지 이름 = 「SYNK」 → 「SYNK LAB」」
  //   (페이스북 페이지 표시명을 고치라는 안내 표다). 라벨 축은 «형식이 없는» 식별자를 라벨로만
  //   잡으므로 브랜드 표기와 사람 이름을 원리상 못 가른다 — 그래서 **값 단위로** 통과시킨다.
  //   ⚠ 완전 일치만 통과다(`ALLOW.includes(v)`) — 「이름: 바트」는 그대로 잡힌다. 넓히지 마라:
  //     `SYNK LAB` 처럼 아직 «안 걸린» 표기를 미리 넣으면 구멍만 넓어진다(걸리는 날 같은 사유로 넣는다).
  'SYNK',
];

const PII = [
  { name: '휴대폰번호',   re: /01[016-9][-. ]?\d{3,4}[-. ]?\d{4}/g },
  { name: '몽골 전화번호', re: /\+?976[-. ]?\d{4}[-. ]?\d{4}/g },
  { name: '주민등록번호', re: /\b\d{6}-[1-4]\d{6}\b/g },
  { name: '카드번호',     re: /\b(?:\d{4}[- ]){3}\d{4}\b/g },
  { name: '이메일',       re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  // ⚠ 자격증명은 길이를 **고정하지 않는다** — 하한만 둔다.
  //   `AIza…{35}` + `\b` 로 못박았더니 한 글자 긴 값이 경계에서 미끄러져 **그냥 통과**했다
  //   (이 파일의 회귀 테스트가 잡은 실결함). 비밀값 게이트는 실패 방향이 「차단」이어야 한다.
  //   접두어도 고정하지 않는다 — 구글이 `AIza…` 말고 **`AQ.…` 형식**으로도 발급한다(08-05 실물 확인).
  //   접두어를 하나만 적으면 새 형식이 조용히 통과한다 — 같은 「실패 방향이 통과」 계열.
  { name: 'API 키',       re: /(?:sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{30,})/g },
  { name: '텔레그램 토큰', re: /\b\d{8,12}:[A-Za-z0-9_-]{30,}/g },
];

/* ══════════════════════════════════════════════════════════════════════
 * 라벨 식별자 축 [2026-08-29] — 「형식이 없는 식별자」를 맥락으로 잡는다
 * ══════════════════════════════════════════════════════════════════════
 * 🔴 왜 이 축이 새로 필요했나 (실측 반증 · 추측 아님)
 *   위 PII 목록은 전부 **형식이 있는 값**이다 — 휴대폰·주민번호·카드·이메일·자격증명.
 *   그래서 08-29 실측에서 이 한 줄이 **빈 배열**을 냈다:
 *       scanPII('학생 바트자르갈 (student_id: S2027-0143, 생일 2011-04-02)')  →  []
 *   정본(`docs/제품방향.md` 설계 불변식 4 · 유호 확정 08-05 · A안 08-06)이 「안 나가는 것」으로
 *   못박은 다섯 **이름·연락처·student_id·생년·학교** 중 **이름·student_id·생년 셋이 통째로 사각**
 *   이었다. 이 폴더는 구글 계정으로 **업로드**되는 것이라 그 사각이 곧 반출이다.
 *
 * 🔴 이름 자체는 형식이 없다 — 그래서 «값»이 아니라 «라벨이 붙은 값»을 잡는다.
 *   「모든 한글 두세 글자」를 잡는 판은 지어보지도 않았다. 이 저장소 문서 전체가 걸려
 *   게이트가 헛돌고, **헛도는 게이트는 곧 꺼진다**(위 ALLOW 주석이 적은 것과 같은 병).
 *   실측으로 눈금을 맞췄다(docs + memory 전량 · md 기준):
 *     · 라벨만 보고 값을 안 가린 1차 판 → **375건 / 348파일**(기억 파일 머리말의 `name:` 이 전부 걸렸다)
 *     · 값 꼴까지 가린 지금 판 → **0건 / 0파일**. 그러면서 위 반증 한 줄은 그대로 잡는다.
 *
 * ■ 안 잡는 것 (「없다」가 아니라 «못 잡는다» — 정직히 적는다)
 *   ① **라벨 없는 맨 이름.** 「바트자르갈이 어제…」는 원리상 못 잡는다. 이 축의 상한이다.
 *   ② **라벨 없는 맨 학생ID(`SYNK-042` 꼴).** 형식이 있어 잡을 수는 있는데 **일부러 뺐다** —
 *      실측: docs+memory 에 `SYNK-\d{3,}` 이 **16종 · 31파일**(_archive 제외) 있고 전부 문서 예시다
 *      (001·002·007·013·014·021·042·101·777·900·901·902·903·912·918·999). 넣으면 첫날부터
 *      31벌이 통째로 빠진다 = 우는 검사 = 꺼지는 검사. 라벨이 붙은 `student_id: SYNK-042` 만 잡는다.
 *      ⚠ **학생이 실제로 생기는 날 이 판정을 다시 해야 한다** — 그때는 실물 ID 와 예시 ID 가
 *      같은 모양으로 섞인다. (지금 재판정하면 표본이 0이라 재는 시늉만 된다.)
 *   ③ **학교**(불변식 4 의 다섯째). 학교 이름은 라벨도 형식도 안정적이지 않아 안 걸었다.
 *
 * ■ 한 값을 두 곳이 알지 않게 (`constant-known-in-two-places`)
 *   열 이름 목록을 여기 베끼지 않는다 — `엔진_셋업확장.js` `sheetSkeleton_()` 의 `profiles` 행
 *   **정본에서 읽는다**. 새 열이 붙었는데 아래 분류표에 없으면 **던진다**(조용한 통과 금지).
 *   업로드 도구가 던지면 그 파일은 안 나간다 = 실패 방향이 「차단」이다. */

const 골격정본_ = path.join(REPO, '엔진_셋업확장.js');

/** profiles 열 중 **식별자인 것** → 그 열을 부르는 라벨 별칭.
 *  키는 반드시 정본 열 이름이어야 한다(아래 `식별라벨_` 이 대조해 던진다). */
const 식별열_별칭 = {
  user_id:          ['user_id', 'student_id', 'sid', '학생ID', '학생 ID', '학생아이디'],
  이름:             ['이름', '학생이름', '학생명', '성명', 'name', 'student_name'],
  이름_몽골:        ['이름_몽골', '몽골이름', '몽골어이름'],
  생일:             ['생일', '생년월일', '생년', 'birth', 'birthday', 'dob'],
  email:            ['email', '이메일', 'e-mail', '메일주소'],
  연락처:           ['연락처', '전화', '전화번호', '휴대폰', '휴대전화', 'phone', 'tel'],
  messenger_link:   ['messenger_link', '메신저링크', 'igsid', 'psid'],
  parent_of:        ['parent_of'],
  보호자명:         ['보호자명', '보호자이름', '학부모명', '학부모이름'],
  보호자연락처:     ['보호자연락처', '학부모연락처'],
};

/** profiles 열 중 **식별자가 아닌 것** — 여기 적힌 것만 「분류했다」로 친다.
 *  ⚠ `class_name`(반)은 소수 인원 구간에서 준식별자라는 지적이 08-29 검증에 있었다.
 *     불변식 4 는 「학교」만 적고 「반」은 안 적어서 **정본이 답을 안 준 자리**다 —
 *     지금은 식별자로 안 친다(정본을 넘겨짚지 않는다). 유호님 판정이 서면 위 표로 옮긴다. */
const 비식별열_ = ['role', 'class_name', 'tuition', '등록일', 'created_at'];

let _라벨캐시 = null;
/** 정본 열 목록과 분류표를 대조해 라벨 축을 만든다. 못 재면 **던진다**(0건으로 접지 않는다). */
function 식별라벨_() {
  if (_라벨캐시) return _라벨캐시;
  let src;
  try { src = fs.readFileSync(골격정본_, 'utf8'); }
  catch (e) { throw new Error(`식별자 게이트 확인 불가 — 열 정본을 못 읽었다(${골격정본_}): ${e.message}`); }
  const m = src.match(/\[\s*'profiles'\s*,\s*\[([^\]]*)\]\s*\]/);
  if (!m) throw new Error(`식별자 게이트 확인 불가 — ${path.basename(골격정본_)} sheetSkeleton_() 의 profiles 행을 못 찾았다`);
  const 열 = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  if (!열.length) throw new Error('식별자 게이트 확인 불가 — profiles 열 목록이 비었다');
  const 미분류 = 열.filter((c) => !(c in 식별열_별칭) && !비식별열_.includes(c));
  if (미분류.length) {
    throw new Error(`식별자 게이트 확인 불가 — profiles 새 열 ${미분류.length}개가 분류표에 없다: ${미분류.join(', ')}\n`
      + `  → tools/geminilm-export.js 의 식별열_별칭(식별자) 또는 비식별열_(아닌 것) 중 하나에 넣어라.`);
  }
  _라벨캐시 = { 열, 라벨: 열.filter((c) => c in 식별열_별칭).flatMap((c) => 식별열_별칭[c]) };
  return _라벨캐시;
}

// 값 꼴 검사 — 「라벨 뒤에 아무거나」를 잡으면 산문이 통째로 걸린다(위 375건 실측).
/* 🔴 [09-01] 라벨 축은 «형식이 없는» 식별자만 맡는다 — 형식 축(PII)이 값을 **통째로** 아는 자리는
 *   비켜준다. 안 그러면 한 값을 두 축이 잡는데, 실제 게이트(`scanPII`)는 겹침을 접어 조용하고
 *   `scan라벨_` 을 «직접» 부르는 소음 눈금(반출식별자 ㉣)만 운다 — 09-01 에 정확히 그렇게 울었다
 *   (`휴대전화: 010-…` 한 줄 · 형식 축 「휴대폰번호」가 **이미 막고 있던** 파일이다).
 *   🔑 그 자리를 `ALLOW` 로 풀면 안 된다 — ALLOW 는 두 축이 **함께** 보므로 형식 축의 눈까지
 *     같이 감긴다(그 값이 진짜로 안 막히게 된다). 값 꼴을 조이는 쪽은 형식 축을 안 건드린다.
 *   ⚠ 탐지력은 안 준다: 비켜준 값은 형식 축이 그대로 잡는다. 그리고 «통째»로만 비킨다 —
 *     `010-1234-5678 (집)` 처럼 번호가 값의 일부면 라벨 축이 계속 잡는다(실패 방향 = 차단). */
const 형식축이통째로아는값_ = (v) => PII.some(({ re }) => (v.match(re) || []).includes(v));
const 값꼴_ = {
  ID:   (v) => /^[A-Za-z][A-Za-z0-9]*[-_]?\d{2,}$/.test(v) || /^\d{3,}$/.test(v),
  // 사람 이름 = 공백·문장부호 없는 한글/키릴/라틴 낱말 하나. 코드 스팬(`…`)은 이름이 아니다.
  이름: (v, 코드) => !코드 && /^[가-힣Ѐ-ӿA-Za-z]{2,12}$/.test(v),
  날짜: (v) => /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(v) || /^\d{6,8}$/.test(v),
  연락: (v) => /^[+\d][\d\s\-.()]{6,}$/.test(v),
  링크: (v) => /^[A-Za-z0-9_.@:/-]{6,}$/.test(v),
};
/* `띄` = 라벨과 값 사이에 **구분자 없이 공백만** 있어도 잡는가.
 *   실물 반증이 `생일 2011-04-02`(콜론 없음) 꼴이었다 — 사람이 쓰는 표기는 콜론을 안 붙인다.
 *   🔴 그런데 «이름»만은 못 연다: 값 꼴이 「낱말 하나」라 `이름 자리를`·`이름 까몽` 같은 산문이
 *     통째로 걸린다(실측으로 확인). 값 꼴이 스스로 좁은 축(ID·날짜·전화·링크)만 공백을 허용한다. */
const 라벨축_ = [
  { kind: '학생ID(라벨)',  cols: ['user_id'],                       ok: 값꼴_.ID,   띄: true },
  { kind: '이름(라벨)',    cols: ['이름', '이름_몽골', '보호자명'],  ok: 값꼴_.이름, 띄: false },
  { kind: '생년(라벨)',    cols: ['생일'],                          ok: 값꼴_.날짜, 띄: true },
  { kind: '연락처(라벨)',  cols: ['연락처', '보호자연락처'],         ok: 값꼴_.연락, 띄: true },
  { kind: '메신저(라벨)',  cols: ['email', 'messenger_link', 'parent_of'], ok: 값꼴_.링크, 띄: true },
];

const 정규식_이스케이프_ = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* 라벨 앞 경계 — 🔴 한글은 낱말 경계가 없어 `\b` 가 안 통한다. 경계를 안 두면 `파일이름:`·
 *   `옛이름:` 이 `이름` 으로 걸린다(이 저장소가 여러 번 겪은 무늬). 그래서 «앞 글자»를 못박는다.
 *   `학생이름` 같은 합성어는 별칭으로 따로 등재해 잡는다(경계를 느슨하게 푸는 대신). */
const 라벨앞_ = '(?:^|[\\s(\\[「『·,"\'])';

/** 값에서 마크다운 껍질을 벗긴다. 코드 스팬이었는지도 함께 돌려준다. */
function 값정제_(raw) {
  const 코드 = /^`/.test(raw.trim());
  const v = raw.trim().replace(/^[*_`"'«「『]+/, '').replace(/[*_`"'»」』.,;:]+$/, '').trim();
  return { v, 코드 };
}

/** 라벨 식별자 스캔 — PII 와 같은 모양의 hit 배열을 돌려준다. */
function scan라벨_(text) {
  const { 라벨 } = 식별라벨_();          // 못 재면 여기서 던진다
  const 있는라벨 = new Set(라벨);
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (const 축 of 라벨축_) {
    const 후보 = 축.cols.flatMap((c) => 식별열_별칭[c]).filter((l) => 있는라벨.has(l));
    if (!후보.length) continue;
    // 긴 별칭 먼저 — `이름` 이 `이름_몽골` 을 앞질러 먹지 않게(교대 순서가 곧 우선순위다)
    const 구분자 = 축.띄 ? '(?:\\s*[:=：]\\s*|\\s+)' : '\\s*[:=：]\\s*';
    const re = new RegExp(라벨앞_ + '(' + 후보.slice().sort((a, b) => b.length - a.length).map(정규식_이스케이프_).join('|')
      + ')' + 구분자 + '(\\S[^,)\\]|\\n]{0,39})', 'gi');
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(re)) {
        const { v, 코드 } = 값정제_(m[2]);
        if (!v || !축.ok(v, 코드)) continue;
        if (형식축이통째로아는값_(v)) continue;   // 형식 축이 맡는 값 — 위 주석
        if (ALLOW.includes(v)) continue;
        hits.push({ kind: 축.kind, value: m[1] + ': ' + v, line: i + 1 });
      }
    }
  }
  return hits;
}

/**
 * 본문에서 개인정보·자격증명 후보를 찾는다.
 * 축 둘 = ①형식이 있는 값(PII) ②라벨이 붙은 형식 없는 식별자(scan라벨_ · 08-29 증축).
 * ⚠ 던질 수 있다 — 열 정본을 못 읽거나 새 열이 미분류면 「확인 불가」로 던진다(0건으로 안 접는다).
 *
 * 🔴 [08-30] **같은 자리의 같은 값은 한 번만 센다.** 두 축이 겹치는 값(라벨 붙은 전화·이메일)이
 *   건수를 두 배로 부풀리고 있었다 — 실측:
 *       'phone: +976 9911 2233' → ["몽골 전화번호", "연락처(라벨)"]  (같은 값 · 같은 줄)
 *   이 저장소는 「몇 건인가」로 판정하고(`korean-grep-matches-inside-words`), 그 수가 그대로
 *   `_빠진_파일.md` 표에 3칸만 실린다. 한 값이 두 칸을 먹으면 **진짜 다른 위반이 표에서 밀려난다.**
 *   겹칠 때 남기는 쪽은 **형식 축**이다 — 값이 «무엇인지»를 정확히 말한다(라벨 축은 열 갈래로
 *   뭉뚱그려 `email:` 을 「메신저(라벨)」이라 부른다). 탐지력은 안 준다: 겹친 자리는 이미 한 축이
 *   잡고 있어 파일은 그대로 막힌다(변이로 확인).
 * @returns {{kind:string, value:string, line:number}[]}  빈 배열이면 통과
 */
function scanPII(text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (const { name, re } of PII) {
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(re)) {
        if (ALLOW.includes(m[0].trim())) continue;
        hits.push({ kind: name, value: m[0], line: i + 1 });
      }
    }
  }
  // 라벨 축의 value 는 `라벨: 값` 꼴이라 값만 떼어 형식 축과 대조한다
  const 이미 = new Set(hits.map((h) => h.line + '|' + h.value.trim()));
  const 값만 = (v) => v.slice(v.indexOf(': ') + 2).trim();
  return hits.concat(scan라벨_(text).filter((h) => !이미.has(h.line + '|' + 값만(h.value))));
}

// ── 수집 ────────────────────────────────────────────────────────────────
/* ⚠ 거부 판정은 **걷는 뿌리 기준 상대경로**로 한다 — 절대경로에 걸면 뿌리 자체가 인질이 된다.
 * 실측(2026-08-05): 워크트리 세션의 REPO 는 `…\.claude\worktrees\<이름>\` 아래라, `worktrees`
 * 거부 규칙이 docs **전량**을 걸러 수집이 조용히 0이 됐다(같은 코드가 메인 트리·CI에선 초록). */
function walk(dir, out = [], base) {
  const root = base || dir;
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (DENY_DIR.some((re) => re.test(path.sep + path.relative(root, p)))) continue;
    if (e.isDirectory()) walk(p, out, root);
    else if (e.name.toLowerCase().endsWith('.md')) out.push(p);
  }
  return out;
}

// 제미나이LM은 **폴더 구조를 잃는다** — 업로드하면 파일명만 남는다.
// 그래서 출처가 어디서 왔는지를 파일명이 스스로 말하게 한다.
const flatName = (prefix, rel) =>
  `${prefix}__${rel.replace(/[\\/]/g, '__')}`;

// 톱레벨에 둔 이유: rot-check(주간 부패 점검)가 「묶음을 만든 뒤 원천이 몇 개 바뀌었나」를
// 세려면 원천 목록을 알아야 한다. 생성기 안에 가둬두면 그 점검을 다시 쓸 수 없다.
const SOURCE_ROOTS = [
  { prefix: '기억', root: MEM, label: '판정 이력(memory)' },
  { prefix: '문서', root: path.join(REPO, 'docs'), label: '정본 문서(docs)' },
];

function main() {
  const args = process.argv.slice(2);
  const DRY = args.includes('--dry');
  const outIdx = args.indexOf('--out');
  const OUT = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : DEFAULT_OUT;

  const today = new Date().toISOString().slice(0, 10);
  const log = (s) => console.log(s);

  log(`제미나이LM 묶음 생성 — 만든 날 ${today}`);
  log(`대상: ${OUT}${DRY ? '  [DRY RUN]' : ''}\n`);

  // 정본 버전 (묶음이 어느 판에서 나왔는지)
  const claudeMd = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8');
  const mVer = claudeMd.match(/\*\*(v[\d.]+)\s*·\s*([\d-]+)\*\*/);
  const VER = mVer ? `${mVer[1]} (정본일 ${mVer[2]})` : '(버전 미검출)';

  const banner = (원본경로) => `> ⚠ **사본이다 — 정본이 아니다.**
> **만든 날: ${today}** · 지침 ${VER}
> 원본 = SYNK-appsscript 저장소 \`${원본경로}\`
> 다시 만들기: 저장소에서 \`node tools/geminilm-export.js\`
>
> ⛔ **여기서 결정하지 않는다.** 이 묶음의 답은 **재료지 판정이 아니다** —
> 확정은 저장소의 정본과 대조한 뒤에만. 이 사본은 만든 날 이후 갱신되지 않는다.

---

`;

  const sources = SOURCE_ROOTS;

  if (!DRY && fs.existsSync(OUT)) {
    fs.rmSync(OUT, { recursive: true, force: true });   // 재생성이므로 통째로 새로
    log('  (기존 폴더를 지우고 새로 만든다 — 이 폴더는 언제나 생성물이다)\n');
  }
  if (!DRY) fs.mkdirSync(OUT, { recursive: true });

  let written = 0;
  const blocked = [];

  for (const { prefix, root, label } of sources) {
    const files = walk(root);
    log(`${label} — ${files.length}개 후보`);
    for (const abs of files) {
      const rel = path.relative(root, abs).replace(/\\/g, '/');
      const body = fs.readFileSync(abs, 'utf8');
      const hits = scanPII(body);
      if (hits.length) {
        blocked.push({ prefix, rel, hits });
        continue;
      }
      const name = flatName(prefix, rel);
      if (!DRY) fs.writeFileSync(path.join(OUT, name), banner(`${prefix === '기억' ? 'memory' : 'docs'}/${rel}`) + body, 'utf8');
      written++;
    }
  }

  // ── 제외 목록도 묶음 안에 쓴다 ─────────────────────────────────────────
  // 터미널 출력은 스크롤로 사라진다. 「무엇이 빠졌는지」가 묶음 안에 있어야
  // 나중에 제미나이LM이 답을 못 할 때 「없는 것」과 「빠진 것」을 구분할 수 있다.
  const 제외본문 = `# 이 묶음에서 **빠진** 파일 (${blocked.length}개)

> 만든 날 ${today} · 자동 생성 — 손으로 고치지 말 것

개인정보·제3자 연락처·자격증명이 본문에 있어 **업로드에서 제외**했다.
제미나이LM이 이 주제를 못 답하면 「자료가 없어서」가 아니라 「일부러 뺐기 때문」이다.

| 원본 | 걸린 것 | 줄 | 값 |
|---|---|---|---|
${blocked.length === 0 ? '| — | (없음) | — | — |' :
  blocked.flatMap(({ prefix, rel, hits }) =>
    hits.slice(0, 3).map((h) => `| ${prefix}/${rel} | ${h.kind} | ${h.line} | \`${h.value}\` |`)
  ).join('\n')}

**안전한 값으로 판명되면** \`tools/geminilm-export.js\`의 \`ALLOW\` 목록에 그 값을
그대로 추가하고 다시 돌린다(파일 단위 예외가 아니라 **값 단위 예외** — 파일을 통째로
통과시키면 그 파일에 나중에 들어올 진짜 개인정보까지 함께 통과한다).
`;
  if (!DRY) fs.writeFileSync(path.join(OUT, '_빠진_파일.md'), 제외본문, 'utf8');

  const 안내 = `# SYNK 제미나이LM 묶음 — 올리는 방법

> **만든 날 ${today}** · 지침 ${VER} · 자료 **${written}개** (제외 ${blocked.length}개)
> ⚠ 이 안내의 접속 URL·상한 개수는 「노트북LM」시절 값을 그대로 옮긴 것이다(2026-08-22) —
> 구글이 이름을 제미나이LM으로 바꾼 뒤 실제 화면에서 달라졌으면 그대로 따르면 된다.

## 이 묶음의 자리 (왜 만드는가)
**클로드 한도가 찼을 때의 조회 창구.** 제미나이LM은 클로드 한도를 **0** 쓴다.
능력 경쟁이 아니라 **결손 보전** — 정본 = \`docs/AI_스택_가이드.md\` §1-5.

## 올리는 순서
1. 크롬에서 **notebooklm.google.com** 접속 → 구글 계정(Google AI Pro) 로그인
2. 왼쪽 위 **「새로 만들기(Create new)」** 클릭
3. 자료 추가 창이 뜨면 **「파일 업로드」** 선택
4. 이 폴더(\`SYNK_제미나이LM\`)를 열고 **Ctrl+A**로 전부 선택 → **열기**
   - 자료 ${written}개 (Plus 상한 300개 이내)
5. 왼쪽 위 노트북 이름을 **\`SYNK 판정이력 ${today}\`** 로 바꾼다
   - 🔑 **이름에 날짜를 넣는 게 핵심이다.** 다음에 다시 만들면 노트북이 2개가 되는데,
     날짜가 없으면 어느 쪽이 최신인지 화면으로 구별할 방법이 없다.

## 쓸 때의 규칙 3개 (이게 없으면 오히려 사고다)
1. ⛔ **여기서 결정하지 않는다.** 답은 재료지 판정이 아니다.
2. ⛔ **학생 데이터·개인정보를 추가로 올리지 않는다.** 이 묶음은 이미 걸러져 있다.
3. ⛔ **답을 정본에 되돌려 쓰지 않는다.** 정본은 저장소 하나뿐 — 반영은 클로드에게 시킨다.

## 다시 만들 때
저장소가 바뀌면 이 묶음은 그날로 낡는다. 클로드에게 **"제미나이LM 묶음 만들어줘"** 라고 하면
이 폴더가 새로 생성된다. 그 뒤 **제미나이LM에서 옛 노트북은 지우고 새로 올린다**
(자료만 갈아끼우면 옛 자료가 남아 섞인다).
`;
  if (!DRY) fs.writeFileSync(path.join(OUT, 'README_먼저읽기.md'), 안내, 'utf8');

  log('');
  log(`✅ 자료 ${written}개 생성${DRY ? ' (예정)' : ''}`);
  if (blocked.length) {
    log(`⛔ 제외 ${blocked.length}개 — 개인정보·자격증명이 본문에 있다:`);
    for (const { prefix, rel, hits } of blocked) {
      const 요약 = [...new Set(hits.map((h) => h.kind))].join('·');
      log(`   ${prefix}/${rel}  [${요약}] 예) ${hits[0].value} (${hits[0].line}줄)`);
    }
    log('   → 안전한 값이면 ALLOW 목록에 값을 추가하고 다시 돌린다.');
  }
  if (!DRY) log(`\n폴더: ${OUT}`);
}

if (require.main === module) main();

module.exports = {
  scanPII, walk, flatName, DEFAULT_OUT, ALLOW, DENY_DIR, SOURCE_ROOTS,
  // 08-29 라벨 식별자 축 — 회귀가 «분류 전수»와 «정본 대조»를 재려고 물어본다
  scan라벨_, 식별라벨_, 식별열_별칭, 비식별열_, 라벨축_, 골격정본_,
};
