/* ===================== [v9.70~v9.73] 만족도팩 — 4기능 엔진 =====================
 * 유호님 직접 지시(2026-07-27, cowork 세션)로 개원 전 기능 동결의 예외로 추가.
 *   ② [v9.70] 초급 한·몽 병기 — 적재만 돼 있던 MN_* 병렬 상수를 초급 학생 화면에 배선
 *   ① [v9.71] 학부모 메신저 이중화 — 이메일은 보장 채널로 유지, Messenger는 보조 채널(연결된 학부모만)
 *   ③ [v9.72] 수강 만료 안내 — enrollments 시트 + D-14/D-3 학부모 안내(재등록 강요 아님·보장 표현 금지)
 *   ④ [v9.73] 월간 만족도 설문 — 몽골어 3문항 폼 + 주간 리포트 집계(첫 만족도 기준선)
 *
 * 로드 순서 안전(07-24 P0 전면 다운 재발 방지):
 *   이 파일의 톱레벨은 자체 상수 정의뿐이다. Code.js·상담AI.js의 전역(MN_*, ensureSheet, 상담AI_페이지토큰 등)은
 *   전부 함수 본문 안에서만 참조한다. Code.js 쪽 호출부도 typeof 가드 또는 클로저로 감싼다
 *   (이 파일이 라이브에 누락돼도 — 반쪽 배포 — 기존 배치가 죽지 않는다).
 *
 * 쿼터 안전: Glide update 소모 0(전부 서버 시트 쓰기·메일·메신저). 메일은 quotaOk 경유.
 * 몽골어: 이 파일의 신규 몽골어 문자열은 전부 초벌이다 — docs/원어민_검수지_v1.md 「만족도팩」 절에 등재, 감수 후 치환.
 */

/* ---------- 스위치 (전부 되돌릴 수 있는 안전 기본값) ---------- */
const MJ_BILINGUAL = 'beginner';  // 한·몽 병기 범위: 'off' | 'beginner'(한국어수준 완전초보·기초) | 'all'
const MJ_MSG_ENABLED = true;      // 메신저 레일 전체 스위치(links 스위프·주간 미러). false = 완전 휴면
const MJ_MSG_TAG = '';            // Meta 앱 검수로 승인된 메시지 태그(예: 'CONFIRMED_EVENT_UPDATE').
                                  //   빈값 = 24시간 창 안(학부모가 먼저 말 건 뒤)에만 발송, 창 밖은 조용히 스킵(이메일이 보장 채널).
const MJ_EXPIRY_NOTICE = true;    // 만료 D-14/D-3 학부모 안내 메일(+연결 시 메신저 미러)
const MJ_SURVEY_IN_HIGHLIGHTS = true; // 매월 1일 하이라이트 메일에 설문 링크 동봉(폼 미생성이면 자동 생략)

/* ---------- 시트 스키마 ---------- */
const MJ_MSG_HEADERS = ['psid', 'student_id', '이름', '상태', '연결일', '마지막수신', '마지막발송', '비고'];
const MJ_ENROLL_HEADERS = ['student_id', '이름', '시작일', '개월수', '만료일', '상태', '비고', 'created_at'];

/* ===================== ② [v9.70] 한·몽 병기 헬퍼 ===================== */

// hashPick_(Code.js L1112)와 같은 해시 — 같은 seed면 같은 인덱스가 나와 한국어·몽골어가 반드시 같은 문장 쌍이 된다.
// ⚠ 알고리즘을 바꾸면 tests/만족도팩.test.js의 동조 테스트가 깨진다(의도된 회귀 장치).
function MJ_hashIdx_(arr, seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) % 100000;
  return h % arr.length;
}

// 병기 조립 — mn이 없거나 꺼져 있으면 한국어 원문 그대로(무해 폴백).
function MJ_bi_(ko, mn, on, sep) {
  if (!on || !mn) return ko;
  return ko + (sep || '\n') + mn;
}

// 한국어·몽골어 배열에서 같은 인덱스 쌍을 골라 병기 한 줄로. (운세 BE열 — 텍스트 셀이라 개행 구분)
function MJ_biLine_(koArr, mnArr, seed, on) {
  const i = MJ_hashIdx_(koArr, seed);
  const ko = koArr[i];
  if (!on || !mnArr || !mnArr[i]) return ko;
  return ko + '\n' + mnArr[i];
}

// 학생별 병기 대상 집합 — profiles AY열(51, 한국어수준: 상담시트 S열에서 자동 복사)이 완전초보·기초인 학생.
// calcAll 학생 루프의 행 폭과 무관하게 쓰도록 별도 좁은 읽기(2열)로 만든다.
function MJ_beginnerSet_(pf) {
  const set = new Set();
  try {
    if (MJ_BILINGUAL === 'off') return set;
    if (!pf || pf.getLastRow() < 2) return set;
    // [v9.125] 위치 상수 51 폐기 — v9.119가 「레벨 열은 이름으로 찾는다」로 못박은 규약을 이 파일만 안 따랐다.
    //   열이 밀리면 병기가 엉뚱한 학생 집합에 조용히 적용된다. typeof 가드 = 반쪽 배포 안전.
    //   ⚠ profileLevelCol_은 0-기반 인덱스를 돌려준다(호출부 규약 = c + 1) — 못 찾으면 -1.
    const lv0 = (typeof profileLevelCol_ === 'function') ? profileLevelCol_(pf) : 50;
    if (lv0 < 0) return set;
    const lvCol = lv0 + 1;
    if (pf.getMaxColumns() < lvCol) return set;
    const ids = pf.getRange(2, 1, pf.getLastRow() - 1, 1).getValues();
    const lvl = pf.getRange(2, lvCol, pf.getLastRow() - 1, 1).getValues();
    ids.forEach((r, i) => {
      if (r[0] && MJ_isBeginnerLvl_(lvl[i] ? lvl[i][0] : '')) set.add(String(r[0]).trim());
    });
  } catch (e) { /* 병기는 장식 — 실패해도 본 계산을 막지 않는다 */ }
  return set;
}

function MJ_isBeginnerLvl_(v) {
  const s = String(v || '').trim();
  return s === '완전초보' || s === '기초';
}

// 개별 학생 병기 여부 (calcAll 루프용 — biSet은 위에서 1회 계산)
function MJ_biOn_(biSet, sid) {
  if (MJ_BILINGUAL === 'off') return false;
  if (MJ_BILINGUAL === 'all') return true;
  return !!(biSet && biSet.has(String(sid).trim()));
}

// 한국어수준 값으로 직접 판정 (writeSharedCols_처럼 행에 r[50]이 이미 있는 곳용)
function MJ_biOnLvl_(lvlVal) {
  if (MJ_BILINGUAL === 'off') return false;
  if (MJ_BILINGUAL === 'all') return true;
  return MJ_isBeginnerLvl_(lvlVal);
}

// 한국어 배열 기준 인덱스로 몽골어 쌍을 고른다. 몽골어 뱅크가 짧으면(한국어만 증편된 경우 — v9.69 신뢰도 팩이
// SPEAK를 확장한 실사례) 그 인덱스는 '' — 다른 문장을 억지로 붙이거나 지어내지 않는다.
function MJ_pairPick_(koArr, mnArr, seed) {
  if (!koArr || !koArr.length) return '';
  const i = MJ_hashIdx_(koArr, seed);
  return (mnArr && i < mnArr.length && mnArr[i]) ? mnArr[i] : '';
}

// 몬스터 한마디 몽골어 미러 — Code.js speak 분기(v9.36 순서)와 1:1로, 한국어(SPEAK)가 고른 것과 같은 인덱스의
// 몽골어(MN_SPEAK)를 붙인다. 진화 게이트 분기(리터럴 한국어)는 뱅크에 대응이 없어 '' 반환.
// ⚠ Code.js 분기 순서가 바뀌면 이 함수도 같이 바꿔야 한다 — tests의 분기 순서 동조 테스트가 지킨다.
function MJ_speakMirror_(ctx) {
  try {
    if (typeof MN_SPEAK === 'undefined' || typeof SPEAK === 'undefined') return '';
    const seed = ctx.seed;
    if (ctx.isBday) return MJ_pairPick_(SPEAK.bday, MN_SPEAK.bday, seed);
    if (ctx.crownToday) return MJ_pairPick_(SPEAK.crown, MN_SPEAK.crown, seed);
    if (ctx.gateWait) return ''; // 게이트 문구는 한국어 리터럴 — 뱅크에 없음
    if (ctx.toNext > 0 && ctx.toNext <= 30) return MJ_pairPick_(SPEAK.evosoon, MN_SPEAK.evosoon, seed).replace('{n}', ctx.toNext);
    if (ctx.attended) return MJ_pairPick_(SPEAK.today[ctx.tone], MN_SPEAK.today[ctx.tone], seed);
    if (ctx.daysSince >= 7 && ctx.daysSince < 999) {
      const t7 = Math.min(ctx.tone, SPEAK.miss7.length - 1); // 버킷 선택도 한국어 기준(Code.js와 동일)
      return MJ_pairPick_(SPEAK.miss7[t7], MN_SPEAK.miss7[t7], seed);
    }
    if (ctx.daysSince >= 3 && ctx.daysSince < 7) return MJ_pairPick_(SPEAK.miss3[ctx.tone], MN_SPEAK.miss3[ctx.tone], seed);
    return MJ_pairPick_(SPEAK.idle[ctx.tone], MN_SPEAK.idle[ctx.tone], seed);
  } catch (e) { return ''; }
}

/* ===================== ① [v9.71] 학부모 메신저 이중화 ===================== */

/* 연결 방식(2단계 — 자동 접수 + 유호님 승인):
 *   학부모가 학원 페이스북 페이지(m.me 링크)에 학생ID(예: SYNK-001)를 메시지로 보낸다.
 *   상담AI 웹훅이 모든 수신을 상담로그에 남기므로, 10분 스위프가 새 행에서 학생ID 패턴을 찾아
 *   messenger_links에 상태 '대기'로 접수하고, 접수 답장 1통 + 유호님께 승인 요청 메일을 보낸다.
 *   유호님이 시트에서 상태를 '연결'로 바꿔야 발송이 시작된다.
 *   ⚠ 자동 확정을 하지 않는 이유(적대 리뷰 C1): 학생ID는 순차라 추측 가능하다. ID만으로 자동 연결하면
 *     제3자가 아이 실명·출결·포인트를 매주 수신하게 된다(미성년자 개인정보). 발신은 사람 승인 1회를 게이트로 둔다.
 * 발신 정책(이중화의 핵심):
 *   이메일이 보장 채널이다. 메신저는 상태 '연결'에만, (a) 검수 태그(MJ_MSG_TAG)가 있으면 언제나,
 *   (b) 없으면 마지막 수신 24시간 안에만 발송하고, 못 보낸 건 조용히 스킵한다(이메일이 이미 갔으므로 유실 아님).
 * 전송 실패를 건당 관리자 메일로 쏘지 않는다(상담_전송_과 다른 점) — 주간 리포트 섹션에서 집계로 보고. */

// 시트 확보 + 발송 가능(sid→{psid, lastIn, row}) 맵 + 전 행 psid·pair 색인(창 갱신·중복 접수 방지용)
function MJ_msgLinks_(ss) {
  const sh = ensureSheet(ss, 'messenger_links', MJ_MSG_HEADERS);
  const map = {}, psidRows = {}, pairs = new Set();
  let pending = 0;
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues().forEach((r, i) => {
      const psid = String(r[0] || '').trim(), sid = String(r[1] || '').trim(), state = String(r[3] || '');
      if (!psid || !sid) return;
      pairs.add(psid + '|' + sid);
      psidRows[psid] = i + 2; // 상태 무관 — 어떤 상태든 수신이 오면 24시간 창은 갱신
      if (state === '대기') pending++;
      if (state !== '연결') return; // [적대 리뷰 C1] 발송은 유호님이 승인한 '연결'만 — '대기'·'해지'는 발송 제외
      map[sid] = { psid: psid, lastIn: r[5] ? new Date(r[5]) : null, row: i + 2 };
    });
  }
  return { sh: sh, map: map, psidRows: psidRows, pairs: pairs, pending: pending };
}

// 메시지 본문에서 학생ID 추출 — 대소문자 무시, 공백 허용("synk 001"도 인식), 유효 집합 대조
function MJ_extractSid_(text, validSet) {
  const m = String(text || '').match(/([A-Za-z]{2,10})[\s-]?(\d{1,4})/g);
  if (!m) return '';
  for (let i = 0; i < m.length; i++) {
    const norm = m[i].replace(/\s+/g, '-').replace(/-+/g, '-').toUpperCase();
    const parts = norm.match(/^([A-Z]+)-?(\d+)$/);
    if (!parts) continue;
    // 자릿수 보존 후보 + 3자리 패딩 후보 둘 다 대조 (SYNK-1 → SYNK-001)
    const cands = [parts[1] + '-' + parts[2], parts[1] + '-' + ('00' + parts[2]).slice(-3)];
    for (let j = 0; j < cands.length; j++) if (validSet.has(cands[j])) return cands[j];
  }
  return '';
}

// 10분 스위프(parentSweep 편승) — 상담로그의 새 수신에서 ①연결 요청 ②기연결 psid의 창 갱신을 처리
function MJ_msgLinkSweep_(ss) {
  if (!MJ_MSG_ENABLED) return;
  const log = ss.getSheetByName('상담로그');
  if (!log || log.getLastRow() < 2) return;
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const last = log.getLastRow();
  let from = Number(getState(st, '메신저링크_스캔행').val) || 0;
  if (from > last) { setState(st, '메신저링크_스캔행', last); return; } // [v9.125] 클램프 — 로그 행 정리로 last가 줄면 포인터가 허공을 가리켜 영구 침묵하던 구멍(형제 스위프 4곳과 동일 규약)
  if (from >= last) return;                       // 새 행 없음 — 2읽기로 종료(10분 틱 무비용)
  if (from < 1) from = Math.max(1, last - 200);   // 첫 가동: 최근 200행만 소급(과거 전체 재처리 방지)
  const rows = log.getRange(from + 1, 1, last - from, 4).getValues(); // 시각·세션·발신·내용

  const links = MJ_msgLinks_(ss);
  const pf = ss.getSheetByName('profiles');
  const valid = new Set(); // sid만 — 실명은 승인 전 psid에 절대 내보내지 않는다(적대 리뷰 C1)
  if (pf && pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach(r => {
      if (r[0] && r[3] === 'student') valid.add(String(r[0]).trim());
    });
  }

  const now = new Date();
  const newReq = [];
  rows.forEach(r => {
    const psid = String(r[1] || '').trim(), who = String(r[2] || ''), text = String(r[3] || '');
    if (!psid || psid === '-' || psid === 'anon' || who !== 'user') return; // anon = 매니챗/자체폼 세션 — 연결 금지
    if (links.psidRows[psid]) links.sh.getRange(links.psidRows[psid], 6).setValue(now); // 24시간 창 갱신(상태 무관)
    const sid = MJ_extractSid_(text, valid);
    if (!sid) return;
    if (links.pairs.has(psid + '|' + sid)) return; // 같은 psid+sid는 상태 무관 1행만(재요청 중복 접수 방지)
    // [적대 리뷰 C1] 자동 확정 금지 — '대기'로 접수만. 답장에도 실명 없이 ID만 에코. 발송 시작은 유호님이 시트에서 '연결'로.
    links.sh.appendRow([psid, sid, '', '대기', now, now, '', '스위프 접수 — 승인 대기']);
    links.pairs.add(psid + '|' + sid);
    links.psidRows[psid] = links.sh.getLastRow();
    newReq.push(sid);
    // 접수 답장 — 방금 수신이라 항상 24시간 창 안. [몽골어 초벌 — 원어민 검수지 「만족도팩」 M1]
    MJ_send_(psid, '✅ Хүсэлт хүлээн авлаа (' + sid + '). Багш баталгаажуулсны дараа долоо хоног бүрийн тойм эндээс очих болно 🙏\n' +
      '(연결 요청을 접수했어요. 학원 확인 후 주간 소식 발송이 시작됩니다.)');
  });
  if (newReq.length) {
    adminMail('[SYNK] 📨 메신저 연결 요청 ' + newReq.length + '건 — 승인 필요',
      '요청 학생ID: ' + newReq.join(', ') + '\n\nmessenger_links 시트에서 해당 행이 실제 학부모인지 확인 후\n' +
      "상태 칸을 '대기' → '연결'로 바꾸면 그때부터 주간 소식·만료 안내가 메신저로도 나갑니다.\n" +
      "(모르는 요청이면 '해지'로 바꾸세요 — 아무것도 발송되지 않습니다.)");
  }
  setState(st, '메신저링크_스캔행', last);
}

// 창/태그 발송 가능 판정 — 순수 함수(테스트 대상)
function MJ_canSendNow_(lastIn, now, tag) {
  if (tag) return true;                              // 승인 태그 = 창 무관
  if (!lastIn) return false;
  return (now.getTime() - new Date(lastIn).getTime()) < 24 * 3600 * 1000;
}

// Meta Send API — 상담_전송_과 달리 건당 관리자 메일 없이 결과만 반환(집계 보고용)
function MJ_send_(psid, text) {
  try {
    // [v9.125] 리허설 게이트 — 메일 관문(quotaOk)만 막던 리허설이 메신저 실발송은 못 막던 구멍.
    //   typeof 가드 = 반쪽 배포(이 파일만 라이브) 안전.
    if (typeof isRehearsal_ === 'function' && isRehearsal_()) {
      if (typeof rehearsalNote_ === 'function') rehearsalNote_('메신저 발송 MJ_send_ (차단): ' + String(text).slice(0, 40));
      return { ok: false, skip: 'rehearsal' };
    }
    const tok = PropertiesService.getScriptProperties().getProperty('상담AI_페이지토큰');
    if (!tok) return { ok: false, skip: 'no-token' }; // Meta 미세팅 = 조용한 휴면
    if (!psid || !text) return { ok: false, skip: 'no-input' };
    const payload = { recipient: { id: String(psid) }, message: { text: String(text).slice(0, 1900) } };
    if (MJ_MSG_TAG) { payload.messaging_type = 'MESSAGE_TAG'; payload.tag = MJ_MSG_TAG; }
    else payload.messaging_type = 'RESPONSE';
    const res = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/me/messages?access_token=' + encodeURIComponent(tok), {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return { ok: false, err: res.getResponseCode() + ':' + String(res.getContentText()).slice(0, 120) };
    return { ok: true };
  } catch (e) { return { ok: false, err: String(e && e.message || e).slice(0, 120) }; }
}

// 일요일 밤(nightJobs 편승) — 이메일 다이제스트의 메신저 미러. 몽골어 문구는 기존 이메일 꼬리줄 재사용(신규 창작 없음).
function MJ_messengerDigest_() {
  if (!MJ_MSG_ENABLED) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  if (now.getDay() !== 0) return; // 일요일만(훅 쪽 조건과 이중 안전)
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
  const weekEnd = new Date(monday.getTime() + 7 * 86400000);
  const weekKey = Utilities.formatDate(monday, tz, 'yyyy-MM-dd');
  if (String(getState(st, '메신저다이제스트주').val) === weekKey) return; // 재실행 방지

  const links = MJ_msgLinks_(ss);
  const sids = Object.keys(links.map);
  if (!sids.length) { setState(st, '메신저다이제스트주', weekKey); return; }

  const pf = ss.getSheetByName('profiles');
  const names = {};
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') names[String(r[0]).trim()] = String(r[1] || r[0]);
  });
  // 주간 집계 — parentWeeklyDigestCore_와 같은 창 규약(월요일 0시 ≤ d < 다음 월요일)
  const attW = {}, ptsW = {}, crownW = {};
  const at = ss.getSheetByName('attendance');
  if (at && at.getLastRow() >= 2) at.getRange(2, 1, at.getLastRow() - 1, 4).getValues().forEach(r => {
    if (!r[1] || !r[2]) return;
    const d = asDate_(r[2]);
    if (d >= monday && d < weekEnd && String(r[3]).indexOf('출석') > -1) attW[String(r[1]).trim()] = (attW[String(r[1]).trim()] || 0) + 1;
  });
  const pl = ss.getSheetByName('point_logs');
  if (pl && pl.getLastRow() >= 2) pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
    if (!r[1] || !r[5]) return;
    const d = asDate_(r[5]);
    if (d < monday || d >= weekEnd) return;
    const sid = String(r[1]).trim(), pts = Number(r[2]) || 0, rs = String(r[3] || '');
    if (pts > 0) ptsW[sid] = (ptsW[sid] || 0) + pts;
    if (rs.indexOf('MVP') > -1 || rs.indexOf('도전') > -1 || rs.indexOf('시냅스') > -1 || rs.indexOf('성장') > -1) crownW[sid] = (crownW[sid] || 0) + (pts > 0 ? 1 : (rs.indexOf('정정') > -1 ? -1 : 0)); // [08-21] 새 사유 편입 + 정정 순계 — 엔진_운영배치 2124행과 같은 규약(초과 지급이 밤에 정정돼도 다이제스트가 옛 횟수를 말하지 않게)
  });

  let sent = 0, skipped = 0, failed = 0;
  sids.forEach(sid => {
    const lk = links.map[sid];
    if (!MJ_canSendNow_(lk.lastIn, now, MJ_MSG_TAG)) { skipped++; return; } // 창 밖 — 이메일이 이미 감(유실 아님)
    const att = attW[sid] || 0, pts = ptsW[sid] || 0, cr = crownW[sid] || 0;
    const nm = names[sid] || sid;
    const txt = '📮 ' + nm + '\n' +
      'Долоо хоногийн тойм — ирц ' + att + ' · оноо +' + pts + 'P' + (cr > 0 ? ' · 🔥 Сорилт·Өсөлт ' + cr + ' удаа' : '') + ' 🎉\n' +
      '(이번 주 등원 ' + att + '회 · 포인트 +' + pts + 'P' + (cr > 0 ? ' · 도전·성장 ' + cr + '회' : '') + ')';
    const r = MJ_send_(lk.psid, txt);
    if (r.ok) { sent++; try { links.sh.getRange(lk.row, 7).setValue(now); } catch (e) {} }
    else if (r.skip) skipped++;
    else failed++;
  });
  setState(st, '메신저다이제스트주', weekKey);
  setState(st, '메신저다이제스트_최근', weekKey + '|발송 ' + sent + '·스킵 ' + skipped + '·실패 ' + failed);
  Logger.log('메신저 다이제스트: 발송 ' + sent + ' · 창밖스킵 ' + skipped + ' · 실패 ' + failed);
}

// 주간 통합 리포트 섹션 — 연결 현황·최근 발송 결과 (wantText 규약: 발송하지 않고 텍스트만 반환)
function MJ_msgSection_(wantText) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ss.getSheetByName('app_state');
  const links = MJ_msgLinks_(ss);
  const linked = Object.keys(links.map).length;
  let total = 0;
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach(r => { if (r[0] && r[3] === 'student') total++; });
  const recent = st ? String(getState(st, '메신저다이제스트_최근').val || '') : '';
  const lines = ['메신저 연결 ' + linked + '명 / 재원 ' + total + '명' + (linked < total ? ' — 미연결 학부모에게는 이메일만 발송 중' : ''),
    recent ? '최근 주간 미러: ' + recent : '주간 미러 발송 이력 아직 없음',
    MJ_MSG_TAG ? '발송 모드: 승인 태그(' + MJ_MSG_TAG + ')' : '발송 모드: 24시간 창 안에서만(Meta 검수 전) — 창 밖은 이메일 단독'];
  return lines.join('\n');
}

/* ===================== ③ [v9.72] 수강 만료 안내 ===================== */

// 개월 더하기 — 말일 보정(1/31 +1개월 = 2/28)
function MJ_addMonths_(d, n) {
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  const t = new Date(y, m + n, day);
  if (t.getDate() !== day) return new Date(y, m + n + 1, 0); // 넘침 = 대상 달 말일로
  return t;
}

// 만료 안내 문구 — 재등록 '권유'가 아니라 사실 안내 + 상담 초대. 성과·보장 표현 금지(몽골 광고법 17.2.4).
// [몽골어 초벌 — 원어민 검수지 「만족도팩」 M2]
function MJ_expiryNoticeText_(name, dLeft, dateStr) {
  return 'Сайн байна уу! 👋\n\n' +
    name + ' сурагчийн хичээлийн эрх ' + dLeft + ' хоногийн дараа (' + dateStr + ') дуусна.\n' +
    'Үргэлжлүүлэн суралцахыг хүсвэл багштай холбогдоорой — бид танд туслахад үргэлж бэлэн 😊\n\n' +
    '(' + name + ' 학생의 수강 기간이 ' + dLeft + '일 뒤(' + dateStr + ') 만료됩니다.\n' +
    '계속 함께하시길 원하시면 편하게 상담을 예약해 주세요.)\n\n' +
    '— SYNK · Тархи судлалд суурилсан солонгос хэлний академи';
}

// 매일 아침(morningJobs 편승) — 만료일 자동 보정 + D-14/D-3 안내 + D-0 상태 전환
function MJ_expiryDaily_() {
  if (!MJ_EXPIRY_NOTICE) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet(ss, 'enrollments', MJ_ENROLL_HEADERS);
  if (sh.getLastRow() < 2) return; // 시트 비어 있음 = 무비용 휴면
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const today0 = new Date(todayStr + 'T00:00:00');

  // 학부모 이메일·메신저 연결 준비
  const pEmailBy = {};
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 26).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') pEmailBy[String(r[0]).trim()] = String(r[25] || '').trim();
  });
  const links = MJ_MSG_ENABLED ? MJ_msgLinks_(ss) : { map: {} };

  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
  const adminLines = [];
  rows.forEach((r, i) => {
    const sid = String(r[0] || '').trim();
    if (!sid) return;
    const rowN = i + 2;
    let expiry = r[4] ? asDate_(r[4]) : null;
    // 만료일 빈칸 + 시작일·개월수 있으면 자동 계산해 채움(유호님은 시작일·개월수만 적으면 된다)
    if (!expiry && r[2] && Number(r[3]) > 0) {
      expiry = MJ_addMonths_(asDate_(r[2]), Number(r[3]));
      sh.getRange(rowN, 5).setValue(Utilities.formatDate(expiry, tz, 'yyyy-MM-dd'));
    }
    if (!expiry) return;
    const expStr = Utilities.formatDate(expiry, tz, 'yyyy-MM-dd');
    const dLeft = Math.round((new Date(expStr + 'T00:00:00') - today0) / 86400000);
    const state = String(r[5] || '');
    const memo = String(r[6] || '');

    if (dLeft < 0 && state !== '만료' && state !== '갱신') {
      sh.getRange(rowN, 6).setValue('만료');
      adminLines.push(sid + ' · ' + (r[1] || '') + ' — ' + expStr + ' 만료(미갱신)');
      return;
    }
    // [적대 리뷰 M2] 정확일(===14/===3) 매칭은 배치가 하루 죽으면 그 단계를 영영 건너뛴다 → 창 방식.
    //   D14 단계 = 남은 3일 초과~14일, D3 단계 = 남은 0~3일. 단계 마커가 있으면 스킵이라 하루 놓쳐도 다음 아침 따라잡는다.
    const stage = (dLeft >= 0 && dLeft <= 3) ? 'D3' : (dLeft > 3 && dLeft <= 14) ? 'D14' : '';
    if (stage && state !== '만료' && state !== '갱신') {
      const mark = stage + ':' + expStr; // 같은 만료일·같은 단계 알림은 1회만(만료일이 바뀌면 마커도 새로 — 의도)
      if (memo.indexOf(mark) > -1) return;
      const name = String(r[1] || sid);
      const text = MJ_expiryNoticeText_(name, dLeft, expStr);
      let sentTo = [];
      const pe = pEmailBy[sid] || '';
      if (pe.indexOf('@') > -1 && quotaOk(1)) {
        MailApp.sendEmail(pe, '[SYNK] ' + name + ' — хичээлийн эрх ' + dLeft + ' хоногийн дараа дуусна (수강 만료 ' + dLeft + '일 전 안내)', text);
        sentTo.push('메일');
      }
      const lk = links.map[sid];
      if (lk && MJ_canSendNow_(lk.lastIn, now, MJ_MSG_TAG)) {
        if (MJ_send_(lk.psid, text).ok) sentTo.push('메신저');
      }
      // [적대 리뷰 M1] 마커는 발송 성공분에만 기록 — 실패(쿼터 소진·이메일 미입력)면 다음 아침 자동 재시도.
      if (sentTo.length) sh.getRange(rowN, 7).setValue((memo ? memo + ' ' : '') + mark + '(' + sentTo.join('·') + ')');
      else adminLines.push(sid + ' · ' + name + ' — ' + stage + ' 안내 미발송(보호자이메일 미입력 또는 쿼터) · 채워질 때까지 매일 아침 재시도');
    }
  });
  if (adminLines.length) adminMail('[SYNK] 📅 수강 만료 처리 ' + adminLines.length + '건', adminLines.join('\n') + '\n\nenrollments 시트를 확인하세요.');
}

// 주간 통합 리포트 섹션 — 30일 내 만료 예정 + 만료 후 미갱신
function MJ_expirySection_(wantText) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('enrollments');
  if (!sh || sh.getLastRow() < 2) return 'enrollments 시트 비어 있음 — 결제 받으면 [학생ID·이름·시작일·개월수]만 적으면 만료일·안내는 자동입니다.';
  const tz = ss.getSpreadsheetTimeZone();
  const today0 = new Date(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') + 'T00:00:00');
  const soon = [], lapsed = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues().forEach(r => {
    if (!r[0] || !r[4]) return;
    const state = String(r[5] || '');
    if (state === '갱신') return;
    const expStr = Utilities.formatDate(asDate_(r[4]), tz, 'yyyy-MM-dd');
    const dLeft = Math.round((new Date(expStr + 'T00:00:00') - today0) / 86400000);
    if (dLeft >= 0 && dLeft <= 30) soon.push('· ' + (r[1] || r[0]) + ' — ' + expStr + ' (D-' + dLeft + ')');
    else if (dLeft < 0) lapsed.push('· ' + (r[1] || r[0]) + ' — ' + expStr + ' 만료');
  });
  const out = [];
  out.push(soon.length ? '📅 30일 내 만료 ' + soon.length + '명\n' + soon.join('\n') : '30일 내 만료 예정 없음');
  if (lapsed.length) out.push('⚠ 만료 후 미갱신 ' + lapsed.length + '명\n' + lapsed.join('\n') + '\n(갱신 확인되면 상태 칸에 "갱신", 새 기간은 새 행으로)');
  return out.join('\n\n');
}

/* ===================== ④ [v9.73] 월간 만족도 설문 ===================== */

/* 첫 만족도 기준선 — 지금까지 학생·학부모 → 학원 방향의 정기 입력 경로가 0이었다.
 * 몽골어 3문항(1분): ①수업 도움 정도 ②한국어 진전 체감 ③한 가지만 바꾼다면.
 * ②가 핵심이다 — 어학원 이탈 실증 연구(Evans & Tragant 2020)에서 학원이 통제 가능한 최대 요인이
 * '수업 방식·진전 체감'이었고, 이 점수가 떨어지는 학생이 다음 달 이탈 후보다. */

// [몽골어 초벌 — 원어민 검수지 「만족도팩」 M3]
function createSurveyForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const done = formAlreadyMade_(ss, '설문폼_응답', '설문폼URL틀', '설문폼ID', '학생ID', '만족도 폼'); // 두 번 눌러도 안전
  if (done) return done;
  const before = ss.getSheets().map(s => s.getName());
  const form = FormApp.create('SYNK — Сарын сэтгэл ханамжийн асуулга (월간 만족도 설문)')
    .setDescription('1 минут л зарцуулагдана 🙏 Таны санал бидэнд маш чухал.\n(1분이면 됩니다 — 보내주신 의견은 다음 달 수업에 바로 반영합니다.)')
    .setCollectEmail(false);
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '설문폼ID', form.getId()); // [v9.94] 생성 즉시 기록 — 뒤 단계(응답 시트 연결)에서 타임아웃돼도 앱이 이 폼을 잃지 않는다
  form.addTextItem().setTitle('학생ID').setRequired(true).setHelpText('Аппаас нээсэн бол аль хэдийн бөглөгдсөн байгаа (앱에서 열었다면 자동으로 채워져 있어요)');
  form.addScaleItem().setTitle('Энэ сарын хичээл хүүхдэд тань хэр тус болов? (이번 달 수업이 얼마나 도움이 되었나요?)')
    .setBounds(1, 5).setLabels('Огт үгүй (전혀)', 'Маш их (매우)').setRequired(true);
  form.addScaleItem().setTitle('Хүүхдийн тань солонгос хэл ахиж байна гэж мэдрэгдэж байна уу? (아이의 한국어가 늘고 있다고 느끼시나요?)')
    .setBounds(1, 5).setLabels('Огт үгүй (전혀)', 'Тодорхой мэдрэгдэж байна (뚜렷이)').setRequired(true);
  form.addParagraphTextItem().setTitle('Нэг зүйлийг өөрчилж болох бол юу вэ? (한 가지만 바꿀 수 있다면 무엇인가요?)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  linkFormTab_(ss, before, '설문폼_응답');
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  setState(st, '설문폼ID', form.getId());
  setState(st, '설문폼URL틀', prefillTemplateOf_(form, '학생ID'));
  Logger.log('✅ 만족도 폼 생성 완료! 매월 1일 학부모 하이라이트 메일에 학생별 링크가 자동 동봉됩니다.');
  Logger.log('편집용: ' + form.getEditUrl());
}

// 하이라이트 메일에 붙일 설문 링크 줄 — 폼 미생성(틀 없음)이면 빈 문자열(메일은 기존 그대로)
function MJ_surveyLine_(tpl, sid) {
  if (!MJ_SURVEY_IN_HIGHLIGHTS || !tpl) return '';
  return '\n\n📋 Сарын сэтгэл ханамжийн асуулга (1 минут): ' +
    String(tpl).replace(/SIDTOKEN/g, encodeURIComponent(sid)) +
    '\n(이번 달 만족도 설문 — 1분이면 됩니다)';
}

// 응답 집계(순수 함수 — 테스트 대상). rows = 응답탭 2행~ [시각, 학생ID, q1, q2, 자유], ym = 'yyyy-MM'
function MJ_surveyAgg_(rows, ym, tz) {
  const out = { n: 0, a1: 0, a2: 0, low: [], free: [] };
  rows.forEach(r => {
    if (!r[0] || !r[1]) return;
    let m = '';
    try { m = Utilities.formatDate(asDate_(r[0]), tz, 'yyyy-MM'); } catch (e) { return; }
    if (m !== ym) return;
    const q1 = Number(r[2]) || 0, q2 = Number(r[3]) || 0;
    if (!q1 && !q2) return;
    out.n++; out.a1 += q1; out.a2 += q2;
    if (q2 > 0 && q2 <= 2) out.low.push(String(r[1]).trim() + '(진전 체감 ' + q2 + '점)');
    const fr = String(r[4] || '').trim();
    if (fr) out.free.push(fr.slice(0, 80));
  });
  if (out.n) { out.a1 = Math.round(out.a1 / out.n * 10) / 10; out.a2 = Math.round(out.a2 / out.n * 10) / 10; }
  return out;
}

// 주간 통합 리포트 섹션 — 이번 달 응답 현황(응답이 곧 기준선이 된다)
function MJ_surveySection_(wantText) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('설문폼_응답');
  if (!sh) return '설문 미개통 — createSurveyForm ▶ 1회면 매월 하이라이트 메일에 링크가 자동 동봉됩니다.';
  if (sh.getLastRow() < 2) return '설문 개통됨 — 아직 응답 0건(첫 하이라이트 발송 후부터 쌓입니다).';
  const tz = ss.getSpreadsheetTimeZone();
  const ym = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  const width = Math.min(5, sh.getLastColumn());
  const agg = MJ_surveyAgg_(sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues(), ym, tz);
  if (!agg.n) return ym + ' 응답 아직 0건.';
  const lines = [ym + ' 응답 ' + agg.n + '건 · 수업 도움 ' + agg.a1 + '/5 · 진전 체감 ' + agg.a2 + '/5'];
  if (agg.low.length) lines.push('🔴 진전 체감 2점 이하: ' + agg.low.join(' · ') + ' — 이번 주 개별 상담 후보');
  if (agg.free.length) lines.push('💬 최근 의견: ' + agg.free.slice(-3).map(t => '「' + t + '」').join(' '));
  return lines.join('\n');
}
