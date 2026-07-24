/* ============================================================
 * SYNK 교재연동 엔진 [v9.58] — 목소리 타임랩스(A) + 필살기 노트(B)
 *
 * 무엇(2026-07-24 유호님 채택 2건 — 기능 동결의 명시 예외):
 *   A. 목소리 타임랩스 — 교재 권1 1·4·8과 과업의 음성 녹음을 폼으로 제출받아
 *      "처음 목소리 vs 오늘 목소리" 성장 카드를 만든다(시즌1 「첫 목소리」 서사의 물증).
 *   B. 필살기 노트 — mastery_log(미도달 문법)·student_errors(강사 약점 메모)·
 *      hw_feedback(AI 첨삭)을 모아 "너의 약점 → 교재 몇 과를 다시 펴라"를 학생별 생성.
 *
 * 설계 원칙
 *   ① Glide update 0 — 폼 제출(인바운드)·야간 배치 쓰기만. 앱은 읽기 전용.
 *   ② AI 신규 호출 0 — B는 이미 생성된 첨삭 문구를 재조립한다(비용 증가 없음).
 *   ③ Code.js 무편집 — 상담AI.js 선례(신규 파일 분리). 타파일 전역은 함수 안에서만 읽는다.
 *   ④ 파일 업로드 폼은 Apps Script가 못 만든다(FormApp 미지원) — 폼만 유호님 손(5분),
 *      나머지 연결·미리채움·전개는 전부 스크립트가 한다.
 *
 * 유호님 절차 정본 = docs/교재연동_실행지_v958.md (폼 생성 → app_state 등록 →
 *   voiceFormFinishSetup ▶ → setupTextbookLink ▶ → Glide 열 배치)
 *
 * profiles 신규 열(헤더는 setupTextbookLink가 세팅):
 *   DB 목소리폼URL(학생별 미리채움) · DC 목소리성장카드 · DD 필살기노트
 * 신규 시트: voice_log [student_id, 제출일, 미션, 파일URL, file_id, created_at]
 * ============================================================ */

// ── 자체 상수(리터럴만 — 톱레벨 타파일 참조 금지 규칙 준수) ──────────────

// 문법 ID → 교재 위치. 정본 대조 = docs/교재_앱_연동_매핑_v1.md §③ (권2 집필 시 G3xx 잔여 추가)
const TB_GRAMMAR_LESSON = {
  G201: '권1 3과', G202: '권1 2과', G203: '권1 4과', G204: '권1 2과',
  G205: '권1 4과', G206: '권1 3·4과', G207: '권1 7과', G208: '권1 5과',
  G209: '권1 5과', G210: '권1 6과', G211: '권1 6과', G212: '권1 3·4·6과',
  G301: '권1 6과', G305: '권1 7과', G309: '권1 7과', G311: '권1 7과'
};
const TB_VOICE_POINTS = 10;              // 목소리 제출 포인트(하루 1회 자체 가드)
const TB_VOICE_REASON = '목소리제출';     // point_logs 사유(멱등 키)
const TB_NOTE_MAX = 3;                   // 필살기 노트 최대 항목 수(인지 부하 상한)
const TB_GROWTH_MIN_DAYS = 21;           // 성장 카드 최소 간격(처음↔최신)

// profiles 열을 헤더 이름으로 찾는다 — 열 번호 하드코딩 금지(집필 중 54↔106 오계산을 실제로
// 냈던 오류 클래스의 회귀 장치. 다른 세션이 열을 추가·이동해도 이름이 맞으면 안전).
function tbProfileCol_(pf, name) {
  const head = pf.getRange(1, 1, 1, pf.getLastColumn()).getValues()[0];
  for (let i = 0; i < head.length; i++) if (String(head[i]) === name) return i + 1;
  return 0; // 헤더 없음 = setupTextbookLink 미실행 — 쓰지 않고 조용히 대기
}

// ── 유호님 ▶ 1회: 폼 연결 마무리 ─────────────────────────────────────
// 전제: 실행지 STEP 1~2 — 유호님이 폼(학생ID·미션·녹음 파일 3문항)을 만들고
//       app_state에 [목소리폼편집URL | <폼 편집 화면 URL>] 행을 추가한 상태.
function voiceFormFinishSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const url = String(getState(st, '목소리폼편집URL').val || '').trim();
  if (!url) { Logger.log('❌ app_state에 「목소리폼편집URL」 행이 없습니다 — 실행지 STEP 2를 먼저.'); return; }
  const m = url.match(/\/d\/([-\w]+)/);
  if (!m) { Logger.log('❌ URL에서 폼 ID를 찾지 못했습니다. 폼 "편집 화면"의 주소 전체를 붙여넣었는지 확인하세요.'); return; }
  let form;
  try { form = FormApp.openById(m[1]); }
  catch (e) { Logger.log('❌ 폼을 열 수 없습니다(권한/삭제 확인): ' + e); return; }

  // 응답 목적지를 이 시트로(이미 연결돼 있으면 스킵) + 탭 이름 고정
  if (!ss.getSheetByName('목소리폼_응답')) {
    const before = ss.getSheets().map(s => s.getName());
    try { form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId()); } catch (e) {}
    linkFormTab_(ss, before, '목소리폼_응답');
  }
  setState(st, '목소리폼ID', form.getId());
  setState(st, '목소리폼URL틀', prefillTemplateOf_(form, '학생ID')); // SIDTOKEN 치환형 — 학생별 원터치
  Logger.log('✅ 목소리 폼 연결 완료. setupTextbookLink ▶ 실행(1회) 후, 다음 야간 배치부터 profiles DB열에 학생별 링크가 채워집니다.');
  Logger.log('※ 파일 업로드 폼은 학생이 구글 계정 로그인 상태여야 제출됩니다(안드로이드 폰은 대부분 로그인 상태).');
}

// ── 유호님 ▶ 1회: 시트·열·야간 트리거 설치(멱등) ───────────────────────
function setupTextbookLink() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, 'voice_log', ['student_id', '제출일', '미션', '파일URL', 'file_id', 'created_at']);
  const pf = ss.getSheetByName('profiles');
  if (pf) {
    if (String(pf.getRange('DB1').getValue()) !== '목소리폼URL') pf.getRange('DB1').setValue('목소리폼URL');
    if (String(pf.getRange('DC1').getValue()) !== '목소리성장카드') pf.getRange('DC1').setValue('목소리성장카드');
    if (String(pf.getRange('DD1').getValue()) !== '필살기노트') pf.getRange('DD1').setValue('필살기노트');
  }
  // 야간 트리거(23:00) — 같은 함수의 기존 트리거는 제거 후 재설치(멱등)
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === '교재연동Nightly') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('교재연동Nightly').timeBased().everyDays(1).atHour(23).create();
  Logger.log('✅ 교재연동 설치 완료 — 매일 23시: 목소리 스윕+링크, 일요일 밤: 필살기 노트 생성.');
  교재연동Nightly(); // 설치 직후 1회 즉시(링크 열을 바로 채워 Glide 조립을 기다리게 하지 않는다)
}

// ── 야간 오케스트레이터(트리거 23:00) ─────────────────────────────────
function 교재연동Nightly() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try { voiceSweep_(ss); } catch (e) { Logger.log('voiceSweep_ 오류: ' + e); }
  try { writeVoiceLinks_(ss); } catch (e) { Logger.log('writeVoiceLinks_ 오류: ' + e); }
  try { buildVoiceGrowthCards_(ss); } catch (e) { Logger.log('buildVoiceGrowthCards_ 오류: ' + e); }
  // 필살기 노트는 주 1회(일요일 밤)면 충분 — 매일 바뀌면 "노트"가 아니라 소음이 된다
  if (new Date().getDay() === 0) {
    try { buildFocusNotes_(ss); } catch (e) { Logger.log('buildFocusNotes_ 오류: ' + e); }
  }
}

// ── A-1. 폼 응답 → voice_log 전개(+포인트, 파일 공유 전환) ──────────────
function voiceSweep_(ss) {
  const src = ss.getSheetByName('목소리폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  const from = Number(props.getProperty('목소리폼_포인터')) || 1;
  if (from >= last) { if (from > last) props.setProperty('목소리폼_포인터', String(last)); return; }
  const tz = ss.getSpreadsheetTimeZone();

  // 응답 열 위치는 헤더로 찾는다(문항 순서를 유호님이 바꿔도 안전)
  const head = src.getRange(1, 1, 1, src.getLastColumn()).getValues()[0].map(h => String(h || ''));
  const cSid = head.findIndex(h => h.indexOf('학생ID') > -1);
  const cMission = head.findIndex(h => h.indexOf('미션') > -1);
  const cFile = head.findIndex(h => h.indexOf('녹음') > -1 || h.indexOf('파일') > -1);
  if (cSid < 0 || cFile < 0) { Logger.log('voiceSweep_: 응답 탭에서 학생ID/녹음 열을 못 찾음 — 폼 문항 제목 확인'); return; }

  const valid = new Set();
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') valid.add(String(r[0]).trim());
  });

  const vl = ensureSheet(ss, 'voice_log', ['student_id', '제출일', '미션', '파일URL', 'file_id', 'created_at']);
  const pl = ensureSheet(ss, 'point_logs', ['id', 'student_id', 'points', 'reason', 'given_by', 'created_at', 'month', '태그']);
  // 멱등: 이미 지급된 '날짜|sid' (지급→포인터 저장 사이 크래시 재시도 대비)
  const givenKey = {};
  if (pl.getLastRow() >= 2) pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
    if (r[1] && String(r[3] || '') === TB_VOICE_REASON && r[5]) givenKey[dstr(r[5], tz) + '|' + String(r[1]).trim()] = 1;
  });

  const rows = src.getRange(from + 1, 1, last - from, src.getLastColumn()).getValues();
  const vOut = [], pOut = [];
  rows.forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const sid = String(r[cSid] || '').trim();
    if (!sid || !valid.has(sid)) return;
    const fileUrl = String(r[cFile] || '').trim();
    if (!fileUrl) return;
    const mission = cMission >= 0 ? String(r[cMission] || '').trim() : '';
    const fid = (fileUrl.match(/[?&]id=([-\w]+)/) || fileUrl.match(/\/d\/([-\w]+)/) || [])[1] || '';
    // 학부모 메일·앱 재생을 위해 링크 공개(링크를 아는 사람만) — 실패해도 기록은 남긴다
    if (fid) {
      try { DriveApp.getFileById(fid).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
      catch (e) { Logger.log('공유 전환 실패(' + sid + '): ' + e); }
    }
    vOut.push([sid, ts, mission, fileUrl, fid, new Date()]);
    const key = dstr(ts, tz) + '|' + sid;
    if (!givenKey[key]) { // 하루 1회만 지급(여러 번 제출해도 기록은 전부, 포인트는 1회)
      givenKey[key] = 1;
      pOut.push(['VC' + Utilities.formatDate(ts, tz, 'yyyyMMdd') + '-' + sid, sid, TB_VOICE_POINTS,
        TB_VOICE_REASON, '시스템', ts, Utilities.formatDate(ts, tz, 'yyyy-MM'), '']);
    }
  });
  if (vOut.length) vl.getRange(vl.getLastRow() + 1, 1, vOut.length, 6).setValues(vOut);
  if (pOut.length) pl.getRange(pl.getLastRow() + 1, 1, pOut.length, 8).setValues(pOut);
  props.setProperty('목소리폼_포인터', String(last));
  if (vOut.length) adminMail('[SYNK] 🎙 새 목소리 ' + vOut.length + '건',
    '목소리 미션 제출 ' + vOut.length + '건이 voice_log에 쌓였습니다. 성장 카드는 야간 배치가 자동 갱신합니다.');
}

// ── A-2. 학생별 미리채움 링크 → profiles '목소리폼URL' 열 ─────────────────
function writeVoiceLinks_(ss) {
  const st = ss.getSheetByName('app_state');
  if (!st) return;
  const tmpl = String(getState(st, '목소리폼URL틀').val || '');
  if (!tmpl) return; // 폼 미연결 — 조용히 대기(다른 기능과 동일한 스위치 원칙)
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;
  const n = pf.getLastRow() - 1;
  const ids = pf.getRange(2, 1, n, 4).getValues();
  const out = ids.map(r => [(r[0] && r[3] === 'student') ? tmpl.replace(/SIDTOKEN/g, encodeURIComponent(String(r[0]).trim())) : '']);
  const col = tbProfileCol_(pf, '목소리폼URL');
  if (col) writeIfChanged(pf, 2, col, out);
}

// ── A-3. 성장 카드(처음 vs 최신, 간격 21일+) → profiles '목소리성장카드' 열 ──
function buildVoiceGrowthCards_(ss) {
  const vl = ss.getSheetByName('voice_log');
  const pf = ss.getSheetByName('profiles');
  if (!vl || !pf || vl.getLastRow() < 2 || pf.getLastRow() < 2) return;
  const tz = ss.getSpreadsheetTimeZone();
  const byStu = {}; // sid → {first:{t,url,mission}, last:{...}, cnt}
  vl.getRange(2, 1, vl.getLastRow() - 1, 4).getValues().forEach(r => {
    const sid = String(r[0] || '').trim();
    if (!sid || !r[1] || !r[3]) return;
    const t = asDate_(r[1]).getTime();
    const rec = { t: t, url: String(r[3]), mission: String(r[2] || '') };
    const s = byStu[sid] = byStu[sid] || { cnt: 0 };
    s.cnt++;
    if (!s.first || t < s.first.t) s.first = rec;
    if (!s.last || t >= s.last.t) s.last = rec;
  });
  const n = pf.getLastRow() - 1;
  const ids = pf.getRange(2, 1, n, 1).getValues();
  const out = ids.map(r => {
    const s = byStu[String(r[0] || '').trim()];
    if (!s || s.cnt < 2) return [''];
    const days = Math.round((s.last.t - s.first.t) / 86400000);
    if (days < TB_GROWTH_MIN_DAYS) return [''];
    const d1 = Utilities.formatDate(new Date(s.first.t), tz, 'M/d');
    const d2 = Utilities.formatDate(new Date(s.last.t), tz, 'M/d');
    return ['## 🎧 나의 목소리 타임랩스\n\n' +
      '**' + d1 + ' 처음의 나** — [듣기](' + s.first.url + ')' + (s.first.mission ? ' · ' + s.first.mission : '') + '\n\n' +
      '**' + d2 + ' 오늘의 나** — [듣기](' + s.last.url + ')' + (s.last.mission ? ' · ' + s.last.mission : '') + '\n\n' +
      days + '일의 거리만큼 목소리가 자랐어요. 다음 무대에서 또 만나요! 🎤'];
  });
  const col = tbProfileCol_(pf, '목소리성장카드');
  if (col) writeIfChanged(pf, 2, col, out);
}

// ── B. 필살기 노트(주 1회) → profiles '필살기노트' 열 ────────────────────
//   재료: mastery_log '연습'(미도달 문법) + aiWeakMap_(강사 메모 14일 + 최근 첨삭 포인트)
//   AI 호출 0 — 전부 기존 데이터의 재조립. 문법→교재 과 매핑 = TB_GRAMMAR_LESSON.
function buildFocusNotes_(ss) {
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;

  // 문법 이름 사전(GRAMMAR_BANK는 Code.js 전역 — 함수 안 접근 규칙 준수)
  const gName = {};
  try { GRAMMAR_BANK.forEach(g => { gName[g[0]] = g[1]; }); } catch (e) {}

  // 학생별 미도달('연습') 문법 — upsert 시트라 마지막 상태가 정본
  const practicing = {}; // sid → [grammar_id...]
  const ml = ss.getSheetByName('mastery_log');
  if (ml && ml.getLastRow() >= 2) {
    const st = {}; // sid|gid → 상태(뒤 행이 최신)
    ml.getRange(2, 1, ml.getLastRow() - 1, 3).getValues().forEach(r => {
      const sid = String(r[0] || '').trim(), gid = String(r[1] || '').trim();
      if (sid && gid) st[sid + '|' + gid] = String(r[2] || '');
    });
    Object.keys(st).forEach(k => {
      if (st[k] !== '연습') return;
      const p = k.split('|');
      (practicing[p[0]] = practicing[p[0]] || []).push(p[1]);
    });
  }
  let weak = {};
  try { weak = aiWeakMap_(ss); } catch (e) {} // 강사 메모+첨삭 — Code.js 로더 재사용

  const n = pf.getLastRow() - 1;
  const ids = pf.getRange(2, 1, n, 4).getValues();
  const out = ids.map(r => {
    const sid = String(r[0] || '').trim();
    if (!sid || r[3] !== 'student') return [''];
    const gids = (practicing[sid] || []).slice(0, TB_NOTE_MAX);
    const memos = (weak[sid] || []).slice(-1); // 가장 최근 코치 문구 1건만(소음 방지)
    if (!gids.length && !memos.length) return [''];
    let md = '## 📖 나의 필살기 노트\n\n';
    if (gids.length) {
      md += gids.map((g, i) => (i + 1) + '. **' + (gName[g] || g) + '**' +
        (TB_GRAMMAR_LESSON[g] ? ' — ' + TB_GRAMMAR_LESSON[g] + ' 다시 펴기' : '')).join('\n') + '\n\n';
    }
    if (memos.length) md += '💬 최근 코치: ' + memos[0] + '\n\n';
    md += '이것만 잡으면 다음 진화가 가까워져요 ⚡';
    return [md];
  });
  const col = tbProfileCol_(pf, '필살기노트');
  if (col) writeIfChanged(pf, 2, col, out);
}
