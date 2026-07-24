/* ============================================================
 * SYNK 자동 상담 AI — 엔진 (지식·문구는 contents_상담AI.js)
 *
 * 무엇: 페이스북 메신저로 들어온 학부모 문의에 Claude가 몽골어로 답하고,
 *       이름·연락처가 잡히면 leads 시트에 자동 적재, 못 답할 질문은 유호님께 인계한다.
 *
 * 설계 원칙 4가지
 *   ① 지식베이스 밖은 말하지 않는다 — 확정:true 블록만 프롬프트에 들어가고 나머지는 자동 인계
 *   ② 스위치 없으면 아무 일도 안 일어난다 — CLAUDE_API_KEY·상담AI_토큰 둘 다 없으면 0초 종료
 *   ③ 비용이 폭주할 수 없다 — 일일 호출 상한 + 실사용 토큰을 상담로그에 기록(추정 아닌 실측)
 *   ④ 연결 방식에 안 묶인다 — 매니챗이든 Meta 직결이든 doPost가 같은 모양으로 정규화해 받는다
 *
 * 연결 방식 = Meta 메신저 직결(07-24 유호님 확정) · 운영 = 완전 자동
 *
 * 유호님 준비물 — Script Properties (설치 절차 정본 = docs/상담AI_설치_v1.md)
 *   CLAUDE_API_KEY     … console.anthropic.com 발급 키 (AI 첨삭과 공용 — 이미 있으면 그대로)
 *   상담AI_URL키        … 아무 긴 문자열. 웹훅 URL 뒤 ?k=<이 값>. 없으면 봇이 모든 요청을 거부한다(fail-closed)
 *   상담AI_검증토큰     … 아무 문자열. Meta 웹훅 등록 화면에 같은 값을 넣는다(1회용 확인 절차)
 *   상담AI_페이지토큰   … SYNK LAB 페이지 액세스 토큰. 이게 없으면 답장이 안 나간다
 *   상담AI_페이지ID     … (선택) 우리 페이지 웹훅만 받도록 거르는 잠금
 * 선택
 *   상담AI_토큰        … 매니챗·자체 폼에서 호출할 때만 필요(Meta 직결에는 불필요)
 *   상담AI_OFF=1       … 즉시 정지(킬 스위치). 봇은 인계문만 돌려준다
 *   상담AI_일일상한    … 하루 최대 호출 수(기본 300)
 * ============================================================ */

// [v9.57] 톱레벨 타파일 참조 금지 — Apps Script는 파일 순서대로 전역을 초기화하는데 라이브에선 이 파일이
//   Code.gs보다 먼저 돈다(07-24 실사고: 모든 ▶실행·트리거가 여기 ReferenceError로 즉사, 유호님 실행에서 발각).
//   타파일 전역은 반드시 함수 안(호출 시점)에서 읽는다 — tests/safety.test.js가 전 파일 기계 차단 + .clasp.json
//   filePushOrder가 Code.js 선두를 이중 보증.
function 상담AI_모델_() { return typeof AI_FEEDBACK_MODEL === 'undefined' ? 'claude-sonnet-5' : AI_FEEDBACK_MODEL; } // Code.js 정본을 따른다
const 상담AI_사고 = false;               // 메신저는 응답속도가 전환을 좌우 — 사고 OFF. 답변 품질이 아쉬우면 true
const 상담AI_기본상한 = 300;             // 하루 호출 상한 기본값
const 상담AI_로그헤더 = ['시각', '세션', '발신', '내용', '인계', '입력토큰', '캐시읽기', '출력토큰', '비고'];
const 상담AI_리드헤더 = ['날짜', '이름', '연락처', '유입경로', '추천인', '체험참석', '등록', '등록권종', '등록일', '미등록사유', '메모', '캠페인'];

/* ── 웹훅 입구 ─────────────────────────────────────────────
 * 매니챗 External Request / 자체 폼 → POST {token, session, text}
 * Meta 메신저 직결 → POST {object:'page', entry:[{messaging:[{sender:{id},message:{text}}]}]}
 * 둘 다 이 함수 하나가 받는다. */
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const 입력 = 상담_정규화_(body);
    if (!입력) return 상담_응답_({ ok: true, skip: 'no-message' });   // 읽음표시·배달확인 등은 조용히 무시

    /* 인증. ⚠ Apps Script 웹앱은 요청 헤더를 읽을 수 없어 Meta의 서명 검증(X-Hub-Signature-256)을 쓸 수 없다.
     *   → 웹훅 URL 뒤에 ?k=<비밀키>를 붙이고 그 값을 검사하는 방식으로 대체한다(쿼리는 Meta가 그대로 보존).
     *   → 키 미설정이면 통과가 아니라 '거부'다(fail-closed). URL만 새면 누구나 우리 API 예산을 태울 수 있기 때문. */
    const props = PropertiesService.getScriptProperties();
    if (입력.경로 === 'custom') {
      const 토큰 = props.getProperty('상담AI_토큰');
      if (!토큰 || body.token !== 토큰) return 상담_응답_({ ok: false, error: 'unauthorized' });
    } else {
      const urlkey = props.getProperty('상담AI_URL키');
      const 받은키 = (e && e.parameter && e.parameter.k) || '';
      if (!urlkey) {
        상담_기록_('-', 'system', '거부 — 상담AI_URL키 미설정(설정 전까지 모든 메신저 요청을 막습니다)', true, null);
        return 상담_응답_({ ok: false, error: 'not-configured' });
      }
      if (받은키 !== urlkey) return 상담_응답_({ ok: false, error: 'unauthorized' });
      const pid = props.getProperty('상담AI_페이지ID');
      if (pid && 입력.페이지 && String(입력.페이지) !== String(pid)) return 상담_응답_({ ok: false, error: 'wrong-page' });
    }

    // Meta는 20초 안에 200을 못 받으면 같은 웹훅을 재전송한다 → 메시지ID로 중복 차단(6시간 캐시)
    if (입력.경로 === 'meta' && 입력.mid) {
      const cache = CacheService.getScriptCache();
      if (cache.get('mid:' + 입력.mid)) return 상담_응답_({ ok: true, skip: 'duplicate' });
      cache.put('mid:' + 입력.mid, '1', 21600);
    }

    const r = 상담응답_(입력.세션, 입력.내용);
    if (입력.경로 === 'meta') 상담_전송_(입력.세션, r.reply);   // Meta는 응답 본문을 답장으로 쓰지 않는다 — 우리가 직접 쏜다
    return 상담_응답_({ ok: true, reply: r.reply, handoff: r.handoff });
  } catch (err) {
    상담_기록_('-', 'system', 'doPost 오류: ' + String(err && err.message || err).slice(0, 300), false, null);
    return 상담_응답_({ ok: false, error: 'internal' });   // 내부 오류 내용은 밖으로 흘리지 않는다
  }
}

/* Meta 메신저 웹훅 등록 시의 검증 요청(hub.challenge) 응답. 매니챗만 쓸 거면 안 쓰인다. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const 검증 = PropertiesService.getScriptProperties().getProperty('상담AI_검증토큰');
  if (p['hub.mode'] === 'subscribe' && 검증 && p['hub.verify_token'] === 검증) {
    return ContentService.createTextOutput(p['hub.challenge'] || '');
  }
  return ContentService.createTextOutput('SYNK');
}

// 서로 다른 웹훅 모양을 {세션, 내용, 페이지, 경로} 하나로 정규화. 사람 메시지가 아니면 null
function 상담_정규화_(b) {
  if (b && b.object === 'page' && Array.isArray(b.entry)) {          // Meta 메신저 직결
    for (const ent of b.entry) {
      for (const m of (ent.messaging || [])) {
        if (m.message && m.message.text && !m.message.is_echo) {
          return { 세션: String(m.sender && m.sender.id || ''), 내용: String(m.message.text), 페이지: ent.id, mid: String(m.message.mid || ''), 경로: 'meta' };
        }
      }
    }
    return null;
  }
  if (b && b.text) {                                                  // 매니챗 External Request / 자체 호출
    return { 세션: String(b.session || b.psid || 'anon'), 내용: String(b.text), 페이지: '', 경로: 'custom' };
  }
  return null;
}

function 상담_응답_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ── 본체 ─────────────────────────────────────────────────
 * 한 번의 사용자 발화 → 한 번의 답변. 실패·정지·상한 초과는 전부 인계문으로 우아하게 착지한다. */
function 상담응답_(세션, 사용자말) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('CLAUDE_API_KEY');
  if (props.getProperty('상담AI_OFF') === '1' || !key) {
    상담_기록_(세션, 'user', 사용자말, true, null);
    상담_기록_(세션, 'bot', 상담_인계문, true, null, key ? '정지(상담AI_OFF)' : 'API키 없음');
    상담_인계알림_(세션, 사용자말, key ? '봇 정지 상태' : 'API 키 미설정');
    return { reply: 상담_인계문, handoff: true };
  }
  if (!상담_상한통과_(props)) {
    상담_기록_(세션, 'user', 사용자말, true, null);
    상담_기록_(세션, 'bot', 상담_인계문, true, null, '일일 상한 초과');
    상담_인계알림_(세션, 사용자말, '일일 호출 상한 초과 — 오늘은 사람이 받아야 합니다');
    return { reply: 상담_인계문, handoff: true };
  }

  // ⚠ 사용자 발화는 호출 '뒤'에 기록한다 — 먼저 쓰면 상담_이력_가 그 줄을 읽어 같은 말이 두 번 들어간다
  let out;
  try {
    out = 상담_호출_(key, 세션, 사용자말);
  } catch (err) {
    상담_기록_(세션, 'user', 사용자말, false, null);
    상담_기록_(세션, 'bot', 상담_인계문, true, null, 'API 오류: ' + String(err && err.message || err).slice(0, 160));
    상담_인계알림_(세션, 사용자말, 'API 오류 — ' + String(err && err.message || err).slice(0, 160));
    return { reply: 상담_인계문, handoff: true };
  }

  const 답 = String(out.data.reply || '').trim() || 상담_인계문;
  const 인계 = !!out.data.handoff || !out.data.reply;
  상담_기록_(세션, 'user', 사용자말, false, null);
  상담_기록_(세션, 'bot', 답, 인계, out.usage, 인계 ? ('인계: ' + (out.data.handoff_reason || '')) : '');
  if (out.data.lead_name || out.data.lead_contact) 상담_리드적재_(세션, out.data);
  if (인계) 상담_인계알림_(세션, 사용자말, out.data.handoff_reason || '봇이 답할 수 없는 질문');
  return { reply: 인계 ? (답 === 상담_인계문 ? 답 : 답 + '\n\n' + 상담_인계문) : 답, handoff: 인계 };
}

// Claude 호출 — 시스템(지식)은 프롬프트 캐싱으로 고정, 대화 이력만 매번 바뀐다
function 상담_호출_(apiKey, 세션, 사용자말) {
  const schema = {
    type: 'object', additionalProperties: false,
    required: ['reply', 'handoff', 'handoff_reason', 'lead_name', 'lead_contact', 'lead_child_age', 'lead_topic'],
    properties: {
      reply: { type: 'string', description: '학부모에게 보낼 답변. 지식에 있는 내용만. 답할 수 없으면 빈 문자열' },
      handoff: { type: 'boolean', description: '사람에게 넘겨야 하면 true. 지식에 없는 질문·금칙 저촉·불만·상담예약 요청은 전부 true' },
      handoff_reason: { type: 'string', description: '넘기는 이유를 한국어 한 문장으로(유호님이 읽는다). 넘기지 않으면 빈 문자열' },
      lead_name: { type: 'string', description: '대화에서 확인된 학부모 또는 학생 이름. 없으면 빈 문자열 — 추측 금지' },
      lead_contact: { type: 'string', description: '전화번호 등 연락처. 없으면 빈 문자열 — 추측 금지' },
      lead_child_age: { type: 'string', description: '자녀 나이·학년. 없으면 빈 문자열' },
      lead_topic: { type: 'string', description: '이 사람이 가장 알고 싶어 하는 것 한 줄(한국어)' }
    }
  };
  const body = {
    model: 상담AI_모델_(),
    max_tokens: 2048,
    system: [{ type: 'text', text: 상담_시스템_(), cache_control: { type: 'ephemeral' } }], // 지식은 매번 같음 → 캐시 읽기 약 1/10 가격
    messages: 상담_이력_(세션).concat([{ role: 'user', content: 사용자말 }]),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: schema } }
  };
  if (!상담AI_사고) body.thinking = { type: 'disabled' };   // 응답속도 우선. true로 바꾸면 적응형 사고 ON

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Claude ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 160));
  const j = JSON.parse(res.getContentText());
  if (j.stop_reason === 'refusal') throw new Error('거부(refusal)');
  if (j.stop_reason === 'max_tokens') throw new Error('출력 잘림(max_tokens)');
  const tb = (j.content || []).filter(b => b.type === 'text')[0];
  if (!tb || !tb.text) throw new Error('text 블록 없음');
  return { data: JSON.parse(tb.text), usage: j.usage || null };
}

// 시스템 프롬프트 조립 — 확정된 지식만 넣고, 미확정 주제는 "모르는 것" 목록으로 넘긴다
function 상담_시스템_() {
  const 확정 = 상담_지식.filter(k => k.확정);
  const 미확정 = 상담_지식.filter(k => !k.확정).map(k => k.주제);
  return [
    '너는 몽골 울란바토르의 한국어 학원 SYNK LAB의 온라인 상담 담당자다. 페이스북 메신저로 학부모와 대화한다.',
    '',
    '【말투】',
    '· 기본은 ' + 상담_설정.기본언어 + '로 답한다. 상대가 한국어로 쓰면 한국어로 답한다.',
    '· ' + 상담_설정.최대답변문장 + '문장 이내로 짧게. 메신저라 길면 읽지 않는다.',
    '· 따뜻하되 과장하지 않는다. 팔려고 밀어붙이지 않는다.',
    '',
    '【아는 것 — 오직 이것만 말할 수 있다】',
    확정.map(k => '· [' + k.주제 + '] ' + k.내용).join('\n'),
    '',
    '【모르는 것 — 물어보면 반드시 handoff=true, reply는 빈 문자열】',
    (미확정.length ? 미확정.map(t => '· ' + t).join('\n') : '· (없음)'),
    '',
    '【반드시 사람에게 넘기는 경우 handoff=true】',
    '· 위 "모르는 것"에 해당하는 질문',
    '· 상담·체험·방문 예약을 원할 때 (다만 이름과 연락처는 정중히 여쭤보고 lead 항목에 채운다)',
    '· 불만·항의·환불 이야기',
    '· 지식에 없는 숫자를 말해야만 답이 되는 질문',
    '· 조금이라도 확신이 없을 때 — 애매하면 넘긴다. 지어내는 것보다 넘기는 것이 항상 낫다.',
    '',
    '【절대 금지】',
    상담_금칙.map((r, i) => (i + 1) + '. ' + r).join('\n'),
    '',
    '【리드 정보】 대화에서 이름·연락처·자녀 나이가 실제로 나왔을 때만 lead 항목을 채운다. 추측해서 채우지 않는다.'
  ].join('\n');
}

// 최근 대화 이력 — 상담로그 끝부분만 훑어 이 세션 것만 골라낸다(전량 스캔 회피)
function 상담_이력_(세션) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('상담로그');
  if (!sh || sh.getLastRow() < 2) return [];
  const from = Math.max(2, sh.getLastRow() - 300);
  const rows = sh.getRange(from, 1, sh.getLastRow() - from + 1, 4).getValues();
  const mine = rows.filter(r => String(r[1]) === String(세션) && r[3]);
  const 최근 = mine.slice(-(상담_설정.이력턴수 * 2));
  const msgs = [];
  최근.forEach(r => {
    const role = (r[2] === 'user') ? 'user' : 'assistant';
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + String(r[3]);
    else msgs.push({ role: role, content: String(r[3]) });
  });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();   // 첫 메시지는 반드시 user
  return msgs;
}

function 상담_기록_(세션, 발신, 내용, 인계, usage, 비고) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet(ss, '상담로그', 상담AI_로그헤더);
  const u = usage || {};
  sh.appendRow([new Date(), String(세션), 발신, String(내용).slice(0, 2000), 인계 ? 'Y' : '',
    u.input_tokens || '', u.cache_read_input_tokens || '', u.output_tokens || '', 비고 || '']);
}

// 이름 또는 연락처가 잡히면 leads에 적재. 같은 세션은 한 번만(중복 리드 방지)
function 상담_리드적재_(세션, d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ld = ensureSheet(ss, 'leads', 상담AI_리드헤더);
  const 표식 = '[상담AI:' + 세션 + ']';
  if (ld.getLastRow() > 1) {
    const memo = ld.getRange(2, 11, ld.getLastRow() - 1, 1).getValues();
    if (memo.some(r => String(r[0]).indexOf(표식) >= 0)) return;
  }
  const 메모 = 표식 + ' ' + [d.lead_child_age ? '자녀 ' + d.lead_child_age : '', d.lead_topic || ''].filter(String).join(' · ');
  ld.appendRow([new Date(), d.lead_name || '(이름 미확인)', d.lead_contact || '', '페이스북', '', '', '', '', '', '', 메모, '상담AI']);
  adminMail('[SYNK] 💬 상담AI 리드 1건', '이름: ' + (d.lead_name || '-') + '\n연락처: ' + (d.lead_contact || '-') +
    '\n자녀: ' + (d.lead_child_age || '-') + '\n관심: ' + (d.lead_topic || '-') + '\n\nleads 시트에 적재했습니다.');
}

/* 메신저 답장 전송 (Meta Send API).
 * 24시간 창: 상대가 마지막으로 보낸 지 24시간 안에만 자유 전송 가능하다. 봇은 방금 받은 말에 답하는 것이라 항상 창 안이다.
 * (우리가 먼저 거는 홍보 발송은 이 창 밖이라 별도 승인 태그가 필요 — 이 봇의 범위 아님) */
function 상담_전송_(psid, text) {
  const tok = PropertiesService.getScriptProperties().getProperty('상담AI_페이지토큰');
  if (!tok) { 상담_기록_(psid, 'system', '전송 불가 — 상담AI_페이지토큰 미설정', true, null); return false; }
  if (!psid || !text) return false;
  try {
    const res = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/me/messages?access_token=' + encodeURIComponent(tok), {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({
        recipient: { id: String(psid) }, messaging_type: 'RESPONSE',
        message: { text: String(text).slice(0, 1900) }   // 메신저 한 통 상한 2000자
      }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      const 오류 = 'Meta 전송 ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200);
      상담_기록_(psid, 'system', 오류, true, null);
      adminMail('[SYNK] ⚠ 상담AI 전송 실패', 오류 + '\n\n학부모에게 답장이 안 갔습니다. 메신저에서 직접 답변해 주세요.\n페이지 액세스 토큰 만료가 가장 흔한 원인입니다.');
      return false;
    }
    return true;
  } catch (e) {
    상담_기록_(psid, 'system', '전송 예외: ' + String(e && e.message || e).slice(0, 200), true, null);
    return false;
  }
}

function 상담_인계알림_(세션, 사용자말, 사유) {
  adminMail('[SYNK] 🙋 상담AI 인계 요청', '사유: ' + 사유 + '\n세션: ' + 세션 +
    '\n\n학부모 질문:\n' + String(사용자말).slice(0, 500) + '\n\n메신저에서 직접 답변해 주세요.');
}

// 일일 호출 상한 — 날짜가 바뀌면 카운터 리셋. 상한을 넘으면 false
function 상담_상한통과_(props) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const 상한 = Number(props.getProperty('상담AI_일일상한')) || 상담AI_기본상한;
  const cur = String(props.getProperty('상담AI_카운터') || '');
  const [d, n] = cur.split('|');
  const cnt = (d === today) ? (Number(n) || 0) : 0;
  if (cnt >= 상한) return false;
  props.setProperty('상담AI_카운터', today + '|' + (cnt + 1));
  return true;
}

/* ── 유호님이 직접 돌리는 점검 함수 ────────────────────────
 * Apps Script 편집기에서 실행 → 실행 로그에 결과가 뜬다. 메신저 연결 전에 여기서 먼저 검증. */
function 상담AI_점검() {
  const props = PropertiesService.getScriptProperties();
  const 준비 = [], 경고 = [];
  if (!props.getProperty('CLAUDE_API_KEY')) 준비.push('CLAUDE_API_KEY 없음 — 답변 자체가 불가');
  if (!props.getProperty('상담AI_URL키')) 경고.push('상담AI_URL키 없음 — 메신저 요청을 전부 거부합니다(fail-closed)');
  if (!props.getProperty('상담AI_페이지토큰')) 경고.push('상담AI_페이지토큰 없음 — 답을 만들어도 메신저로 안 나감');
  if (!props.getProperty('상담AI_검증토큰')) 경고.push('상담AI_검증토큰 없음 — Meta 웹훅 등록이 안 됨');
  if (props.getProperty('상담AI_OFF') === '1') 경고.push('상담AI_OFF=1 — 봇이 정지 상태');
  const 확정수 = 상담_지식.filter(k => k.확정).length;
  const 미확정 = 상담_지식.filter(k => !k.확정).map(k => k.주제);

  Logger.log('■ 준비 상태: ' + (준비.length ? '❌ ' + 준비.join(' / ') : '✅ 정상'));
  if (경고.length) Logger.log('■ 경고: ⚠ ' + 경고.join('\n         ⚠ '));
  Logger.log('■ 모델: ' + 상담AI_모델_() + ' · 사고: ' + (상담AI_사고 ? 'ON' : 'OFF') + ' · 일일상한: ' + (props.getProperty('상담AI_일일상한') || 상담AI_기본상한));
  Logger.log('■ 지식 블록: 확정 ' + 확정수 + '개 / 미확정 ' + 미확정.length + '개 → ' + (미확정.join(', ') || '없음'));
  Logger.log('■ 시스템 프롬프트 길이: ' + 상담_시스템_().length + '자');
  if (준비.length) { Logger.log('※ 준비물부터 채워주세요. 실호출은 건너뜁니다.'); return; }

  const 시험 = ['수업이 언제 시작하나요?', '한 달에 얼마인가요?'];
  시험.forEach(q => {
    try {
      const r = 상담_호출_(props.getProperty('CLAUDE_API_KEY'), '점검-' + new Date().getTime(), q);
      const u = r.usage || {};
      Logger.log('\n❓ ' + q + '\n💬 ' + (r.data.reply || '(빈 답변)') +
        '\n   인계=' + r.data.handoff + (r.data.handoff_reason ? ' — ' + r.data.handoff_reason : '') +
        '\n   토큰: 입력 ' + (u.input_tokens || 0) + ' · 캐시읽기 ' + (u.cache_read_input_tokens || 0) +
        ' · 캐시생성 ' + (u.cache_creation_input_tokens || 0) + ' · 출력 ' + (u.output_tokens || 0));
    } catch (e) { Logger.log('\n❓ ' + q + '\n❌ 오류: ' + e.message); }
  });
  Logger.log('\n※ "한 달에 얼마인가요?"가 인계=true 로 나와야 정상입니다(수강료 미확정).');
}

// 실측 비용 집계 — 상담로그에 쌓인 토큰으로 이번 달 실제 비용을 계산한다(추정 아님)
function 상담AI_비용() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('상담로그');
  if (!sh || sh.getLastRow() < 2) { Logger.log('상담로그가 비어 있습니다.'); return; }
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const 이번달 = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
  let 입력 = 0, 캐시 = 0, 출력 = 0, 건 = 0;
  rows.forEach(r => {
    if (!(r[0] instanceof Date) || Utilities.formatDate(r[0], tz, 'yyyy-MM') !== 이번달) return;
    if (!r[5] && !r[7]) return;
    입력 += Number(r[5]) || 0; 캐시 += Number(r[6]) || 0; 출력 += Number(r[7]) || 0; 건++;
  });
  // Sonnet 5 도입가 기준 $2/$10 per MTok · 캐시 읽기는 입력가의 0.1배. 환율 ₮3,500/$1
  const usd = (입력 / 1e6) * 2 + (캐시 / 1e6) * 0.2 + (출력 / 1e6) * 10;
  Logger.log('■ ' + 이번달 + ' 상담AI 실측\n  응답 ' + 건 + '건\n  입력 ' + 입력 + ' · 캐시읽기 ' + 캐시 + ' · 출력 ' + 출력 + ' 토큰' +
    '\n  비용 ≈ $' + usd.toFixed(3) + ' (약 ₮' + Math.round(usd * 3500).toLocaleString() + ')' +
    (건 ? '\n  응답 1건당 ≈ ₮' + Math.round(usd * 3500 / 건).toLocaleString() : '') +
    '\n※ 단가는 코드 주석 기준 — 실제 청구는 console.anthropic.com Usage에서 확인하세요.');
}
