/* ============================================================
 * SYNK 회사 두뇌 — 3층 코어
 *
 * 무엇: 강사·학부모가 물어보면 "우리 학원이 확정한 것"만 답하고, 모르는 것은 지어내지 않고
 *       원장님께 넘긴다. 넘어간 질문은 원장님이 한 번 답하면 지식이 되어 다음부터 봇이 답한다.
 *       → 성공 기준은 정확도가 아니라 「같은 질문에 두 번 답하지 않는다」이다.
 *
 * 3층 구조 (2026-08-03 유호님 확정 · 판정 정본 = memory/company-brain-2026-08-03)
 *   1층 문서층 = 이 파일 + 두뇌지식 탭        … 강사·홈페이지가 물어보는 대상
 *   2층 기록층 = 기존 시트(첨삭·발화·약점)    … 회화 앱의 진짜 자산. 여기서 건드리지 않는다
 *   3층 모델층 = 두뇌_AI_() 어댑터            … 벤더는 갈아끼우는 부품. 데이터는 안 움직인다
 *
 * 설계 원칙 5가지 (①~④는 상담AI.js에서 검증된 것을 승계, ⑤는 두뇌에서 새로 세운 것)
 *   ① 지식베이스 밖은 말하지 않는다 — 확정:true 블록만 프롬프트에 들어가고 나머지는 자동 인계
 *   ② 스위치 없으면 아무 일도 안 일어난다 — API 키 없으면 인계문만 돌려주고 0초 종료
 *   ③ 비용이 폭주할 수 없다 — 일일 호출 상한 + 실측 토큰 기록(추정 아님)
 *   ④ 연결 방식에 안 묶인다 — 강사 화면이든 홈페이지든 두뇌_답_() 하나가 받는다
 *   ⑤ 대상이 볼 수 없는 지식은 프롬프트에 실리지 않는다 — 필터가 아니라 화이트리스트로.
 *      "공개"는 '내부' 라벨을 구조적으로 받을 수 없다(모델의 판단에 맡기지 않는다).
 *
 * 만지는 시트는 딱 둘 — 두뇌지식 · 두뇌로그. 학생 개인정보 시트는 읽지도 쓰지도 않는다.
 *
 * 유호님 준비물 — Script Properties
 *   CLAUDE_API_KEY   … 이미 있는 것을 그대로 쓴다(상담AI·AI 첨삭과 공용)
 * 선택
 *   두뇌_OFF=1       … 즉시 정지(킬 스위치). 인계문만 돌려준다
 *   두뇌_일일상한    … 하루 최대 호출 수(기본 500)
 *   AI_VENDOR        … 'anthropic'(기본). 3층 교체용 — 지금은 anthropic만 구현
 * ============================================================ */

// [v9.57] 톱레벨 타파일 참조 금지 — 라이브 로드 순서에 따라 ReferenceError로 전 트리거가 즉사한다.
//   타파일 전역(ensureSheet·adminMail·AI_FEEDBACK_MODEL·두뇌_내부씨앗·상담_지식)은 전부 함수 안에서 읽는다.
const 두뇌_지식탭 = '두뇌지식';
const 두뇌_로그탭 = '두뇌로그';
const 두뇌_지식헤더 = ['대상', '주제', '확정', '내용', '출처', '갱신일'];
const 두뇌_로그헤더 = ['시각', '대상', '세션', '발신', '내용', '인계', '입력토큰', '캐시읽기', '출력토큰', '사용지식', '비고'];
const 두뇌_기본상한 = 500;
const 두뇌_프롬프트상한 = 60000;   // 지식 총량이 이 글자 수를 넘으면 그때부터 질문과 관련된 것만 골라 싣는다
const 두뇌_사고 = false;           // 응답속도 우선. 답변 품질이 아쉬우면 true

/* 대상별 지식 화이트리스트 — 설계원칙 ⑤.
 * 이 표에 없는 라벨은 어떤 경로로도 프롬프트에 실리지 않는다. 새 대상을 늘릴 때 여기부터 고친다. */
const 두뇌_열람권 = {
  내부: ['공통', '내부'],   // 강사
  공개: ['공통', '공개']    // 홈페이지·학부모 — '내부'를 구조적으로 볼 수 없다
};

const 두뇌_인계문 = '이건 제가 확실히 아는 범위가 아니라 원장님께 바로 여쭤보겠습니다. 답이 오면 알려드릴게요.';

/* ══════════════════════════════════════════════════════════
 * 3층 — 벤더 중립 AI 어댑터
 * [v9.223] 이 저장소에서 api.anthropic.com을 직접 부르는 곳은 **7군데**다 — 위 넷(상담_호출_·callClaudeFeedback_·
 * aiCall_·aiText_)에 상담_역번역_·callClaudeTalk_·이 함수가 더 있다(「4군데」는 낡은 셈이라 고쳤다).
 * 그 일곱이 곧 옛글자 게이트를 거는 자리다. ⚠개수를 못박던 `tests/옛글자런타임.test.js` 는 08-19
 * 대철거(e75fc7fc)로 걷혔다 — 이 줄이 다섯 달 동안 없는 검사를 가리키고 있었다(심문 G8 · 08-24 정정).
 * 여덟째 자리를 새로 낼 일이 생기면 그 커밋에서 이 셈과 게이트 유무를 손으로 대조한다.
 * 두뇌는 그 길을 늘리지 않고 여기 하나만 쓴다 — 나중에 GPT·음성 API를 붙일 때 고칠 곳이 한 곳이 되도록.
 * ══════════════════════════════════════════════════════════ */

function 두뇌_벤더_() {
  return String(PropertiesService.getScriptProperties().getProperty('AI_VENDOR') || 'anthropic').toLowerCase();
}

/* req = { system, messages, schema, maxTokens, effort, cache }
 * ret = { data(스키마 있으면 객체, 없으면 문자열), usage }
 * 실패는 예외로 던진다 — 호출부가 인계문으로 착지시킨다(설계원칙 ②). */
function 두뇌_AI_(req) {
  const 벤더 = 두뇌_벤더_();
  if (벤더 === 'anthropic') return 두뇌_AI_anthropic_(req);
  // GPT를 붙이는 날 여기에 한 줄 — 데이터도 지식도 움직이지 않는다.
  throw new Error('지원하지 않는 AI_VENDOR: ' + 벤더 + ' (지금은 anthropic만 구현돼 있습니다)');
}

function 두뇌_AI키_() {
  const props = PropertiesService.getScriptProperties();
  const 벤더 = 두뇌_벤더_();
  return props.getProperty(벤더 === 'anthropic' ? 'CLAUDE_API_KEY' : (벤더.toUpperCase() + '_API_KEY'));
}

function 두뇌_AI_anthropic_(req) {
  const key = 두뇌_AI키_();
  if (!key) throw new Error('CLAUDE_API_KEY 없음');
  const body = {
    model: (typeof AI_FEEDBACK_MODEL === 'undefined' ? 'claude-opus-5' : AI_FEEDBACK_MODEL), // 폴백도 Code.js 정본과 같은 값이어야 한다 — 갈라지면 조용히 옛 모델로 돈다
    max_tokens: req.maxTokens || 2048,
    messages: req.messages
  };
  // 지식은 매번 같다 → 캐시 읽기는 약 1/10 가격. 지식이 커질수록 이 한 줄이 비용을 좌우한다.
  if (req.system) body.system = [{ type: 'text', text: req.system, cache_control: (req.cache === false ? undefined : { type: 'ephemeral' }) }];
  const oc = {};
  if (req.effort) oc.effort = req.effort;
  if (req.schema) oc.format = { type: 'json_schema', schema: req.schema };
  if (oc.effort || oc.format) body.output_config = oc;
  if (!두뇌_사고) body.thinking = { type: 'disabled' };

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('AI ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 160));
  const j = JSON.parse(res.getContentText());
  if (j.stop_reason === 'refusal') throw new Error('거부(refusal)');
  if (j.stop_reason === 'max_tokens') throw new Error('출력 잘림(max_tokens)');
  const tb = (j.content || []).filter(b => b.type === 'text')[0];
  if (!tb || !tb.text) throw new Error('text 블록 없음');
  const data = req.schema ? JSON.parse(tb.text) : tb.text;
  /* [v9.223] 옛 글자(한자·가나) — 유호님 확정 「쓰는 문자 셋뿐」. 두뇌는 비출시 내부 엔진이라 **지금은** 학생이
   *   안 읽지만, 이 어댑터는 「나중에 붙일 길」로 지어진 자리다. 검사를 여기 안 걸면 그 날 새 소비자가 사각으로
   *   태어나고, 사각은 만들 때가 아니라 쓸 때 드러난다. 위 오류들과 같은 규약(throw)이라 새 갈래가 아니다. */
  const 옛 = 옛글자걸림_(data);
  if (옛) throw new Error('옛 글자 감지(' + 옛.칸 + ':' + 옛.짚음 + ') — 응답 폐기');
  return { data: data, usage: j.usage || null };
}

/* ══════════════════════════════════════════════════════════
 * 1층 — 지식
 * ══════════════════════════════════════════════════════════ */

/* ▶ 1회 실행 — 지식 시트를 만들고 씨앗을 옮긴다.
 * 멱등: 이미 있는 (대상,주제) 쌍은 건드리지 않는다. 유호님이 시트에서 다듬은 문장을 재실행이 되돌리지 않는다. */
function setupBrain() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet(ss, 두뇌_지식탭, 두뇌_지식헤더);
  const 오늘 = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');

  const 기존 = new Set();
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
      .forEach(r => 기존.add(String(r[0]).trim() + '\u0000' + String(r[1]).trim()));
  }

  const 신규 = [];
  const 담기 = (대상, b) => {
    const 키 = 대상 + '\u0000' + String(b.주제).trim();
    if (기존.has(키)) return;
    기존.add(키);
    신규.push([대상, b.주제, b.확정 ? 'Y' : '', String(b.내용 || ''), String(b.출처 || ''), 오늘]);
  };

  // 내부(강사) 씨앗
  if (typeof 두뇌_내부씨앗 !== 'undefined') 두뇌_내부씨앗.forEach(b => 담기('내부', b));
  // 공개(학부모·홈페이지) — 상담AI가 이미 검증해 온 지식을 그대로 승계한다
  if (typeof 상담_지식 !== 'undefined') 상담_지식.forEach(b => 담기('공개', { 주제: b.주제, 확정: b.확정, 내용: b.내용, 출처: '상담AI 승계' }));

  if (신규.length) sh.getRange(sh.getLastRow() + 1, 1, 신규.length, 두뇌_지식헤더.length).setValues(신규);
  ensureSheet(ss, 두뇌_로그탭, 두뇌_로그헤더);

  const 요약 = '🧠 회사 두뇌 지식 시트 준비 완료\n'
    + '· 새로 넣은 지식: ' + 신규.length + '건\n'
    + '· 시트 총 지식: ' + Math.max(0, sh.getLastRow() - 1) + '건\n\n'
    + '이제 「' + 두뇌_지식탭 + '」 탭에서 직접 고치시면 됩니다.\n'
    + '· 확정 열이 Y인 것만 봇이 말합니다. 비어 있으면 그 주제는 원장님께 넘깁니다.\n'
    + '· 대상 열: 내부=강사만 / 공개=학부모·홈페이지 / 공통=둘 다.\n'
    + '· 빈 채로 둔 주제(급여·환불·항의 대응 등)는 일부러 비운 것입니다 — 지어낸 답보다 빈칸이 안전합니다.';
  Logger.log(요약);
  return 요약;
}

/* 시트 → 지식 블록. 시트가 없으면 코드 씨앗으로 폴백한다(첫 실행 전에도 봇이 죽지 않게).
 * 대상 화이트리스트는 여기 한 곳에서만 적용된다 — 설계원칙 ⑤의 유일한 관문. */
function 두뇌_지식로드_(대상) {
  const 허용 = 두뇌_열람권[대상];
  if (!허용) throw new Error('알 수 없는 대상: ' + 대상);

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(두뇌_지식탭);
  if (!sh || sh.getLastRow() < 2) {
    // 폴백 — 시트가 아직 없을 때. 내부 씨앗만(공개 지식은 상담AI가 자기 경로로 이미 답한다)
    if (대상 === '내부' && typeof 두뇌_내부씨앗 !== 'undefined') {
      return 두뇌_내부씨앗.map(b => ({ 대상: '내부', 주제: b.주제, 확정: !!b.확정, 내용: String(b.내용 || ''), 출처: String(b.출처 || ''), 갱신일: '' }));
    }
    return [];
  }
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 두뇌_지식헤더.length).getValues();
  return rows
    .filter(r => 허용.indexOf(String(r[0]).trim()) >= 0 && String(r[1]).trim())
    .map(r => ({
      대상: String(r[0]).trim(),
      주제: String(r[1]).trim(),
      확정: String(r[2]).trim().toUpperCase() === 'Y',
      내용: String(r[3] || '').trim(),
      출처: String(r[4] || '').trim(),
      갱신일: r[5] instanceof Date
        ? Utilities.formatDate(r[5], SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd')
        : String(r[5] || '').trim()
    }));
}

/* 내용이 빈 확정 블록은 확정이 아니다 — 시트에서 확정만 Y로 켜고 내용을 안 쓴 실수를 여기서 잡는다.
 * (이걸 안 막으면 봇이 "아는 주제"로 분류해 놓고 빈손으로 답을 지어낸다) */
function 두뇌_유효확정_(b) { return b.확정 && b.내용.length > 0; }

/* 지식이 프롬프트 상한을 넘으면 질문과 관련된 것만 고른다.
 * 상한 안이면 전부 싣는다 — 검색으로 좁히는 것보다 다 넣는 쪽이 항상 정확하고, 캐싱 덕에 비용도 싸다. */
function 두뇌_관련지식_(질문, 블록들, 상한) {
  const 총량 = 블록들.reduce((s, b) => s + b.주제.length + b.내용.length, 0);
  if (총량 <= (상한 || 두뇌_프롬프트상한)) return 블록들;

  const 토큰 = String(질문).replace(/[^0-9A-Za-z가-힣]+/g, ' ').split(' ').filter(t => t.length >= 2);
  const 점수 = b => {
    const 텍스트 = b.주제 + ' ' + b.내용;
    let s = 0;
    토큰.forEach(t => {
      if (텍스트.indexOf(t) >= 0) { s += 3; return; }
      // 한국어 조사 탈락 근사 — "수업료는" 이 "수업료" 를 놓치지 않게 뒤에서 한 글자씩 깎아 본다
      for (let n = t.length - 1; n >= 2; n--) { if (텍스트.indexOf(t.slice(0, n)) >= 0) { s += 1; break; } }
    });
    return s;
  };
  const 정렬 = 블록들.map(b => ({ b: b, s: 점수(b) })).sort((x, y) => y.s - x.s);
  const 고른것 = [];
  let 누적 = 0;
  정렬.forEach(x => {
    const 길이 = x.b.주제.length + x.b.내용.length;
    if (누적 + 길이 > (상한 || 두뇌_프롬프트상한)) return;
    누적 += 길이; 고른것.push(x.b);
  });
  // 미확정 주제는 짧고, 빠지면 "모르는 것"을 아는 것으로 착각하게 되므로 항상 넣는다
  블록들.filter(b => !두뇌_유효확정_(b)).forEach(b => { if (고른것.indexOf(b) < 0) 고른것.push(b); });
  return 고른것;
}

function 두뇌_시스템_(대상, 블록들) {
  const 확정 = 블록들.filter(두뇌_유효확정_);
  const 미확정 = 블록들.filter(b => !두뇌_유효확정_(b)).map(b => b.주제);
  const 누구 = (대상 === '내부')
    ? '너는 몽골 울란바토르의 한국어 학원 SYNK LAB의 강사 안내 담당자다. 우리 학원 강사가 근무 중에 물어본다.'
    : '너는 몽골 울란바토르의 한국어 학원 SYNK LAB의 안내 담당자다. 학부모·예비 학생이 물어본다.';
  const 말투 = (대상 === '내부')
    ? ['· 한국어로 답한다. 강사가 몽골어로 물으면 몽골어로 답한다.',
       '· 짧고 실무적으로. 강사는 수업 사이에 급히 읽는다. 3~5문장.',
       '· 절차를 물으면 순서대로 번호를 매겨 답한다.']
    : ['· 기본은 몽골어로 답한다. 상대가 한국어로 쓰면 한국어로 답한다.',
       '· 5문장 이내로 짧게.',
       '· 따뜻하되 과장하지 않는다. 팔려고 밀어붙이지 않는다.'];
  return [
    누구, '',
    '【말투】', 말투.join('\n'), '',
    '【아는 것 — 오직 이것만 말할 수 있다】',
    (확정.length ? 확정.map(b => '· [' + b.주제 + '] ' + b.내용).join('\n') : '· (아직 없음 — 무엇을 물어도 handoff=true)'), '',
    '【모르는 것 — 물어보면 반드시 handoff=true, reply는 빈 문자열】',
    (미확정.length ? 미확정.map(t => '· ' + t).join('\n') : '· (없음)'), '',
    '【반드시 넘기는 경우 handoff=true】',
    '· 위 "모르는 것"에 해당하는 질문',
    '· 위 "아는 것"에 없는 숫자·날짜·금액을 말해야만 답이 되는 질문',
    '· 개별 학생의 성적·출결·개인정보를 묻는 질문 (너는 학생 데이터를 갖고 있지 않다)',
    '· 규칙의 예외를 만들어 달라는 요청, 불만·항의',
    '· 조금이라도 확신이 없을 때 — 애매하면 넘긴다. 지어내는 것보다 넘기는 것이 항상 낫다.', '',
    '【절대 금지】',
    '1. 위 지식에 없는 내용을 추론해서 말하지 않는다. "아마도"로 시작하는 답을 하지 않는다.',
    '2. 확정되지 않은 것을 확정된 것처럼 말하지 않는다.',
    '3. 개별 학생·강사의 개인정보를 만들어내지 않는다.', '',
    '【used_topics】 답에 실제로 사용한 지식의 [주제]만 정확히 배열로 적는다. 쓰지 않은 주제는 넣지 않는다.'
  ].join('\n');
}

/* 한 번의 질문 → 한 번의 답. 실패·정지·상한 초과는 전부 인계문으로 우아하게 착지한다. */
function 두뇌_답_(질문, 대상, 세션) {
  const props = PropertiesService.getScriptProperties();
  const 대상키 = (대상 === '내부') ? '내부' : '공개';
  const sid = String(세션 || 'anon');
  const q = String(질문 || '').trim();
  if (!q) return { reply: '무엇이 궁금하신지 한 줄만 적어 주세요.', handoff: false, sources: [] };

  const 착지 = (사유) => {
    두뇌_기록_(대상키, sid, 'user', q, true, null, '', 사유);
    두뇌_기록_(대상키, sid, 'bot', 두뇌_인계문, true, null, '', 사유);
    두뇌_인계알림_(대상키, sid, q, 사유);
    return { reply: 두뇌_인계문, handoff: true, sources: [] };
  };

  if (props.getProperty('두뇌_OFF') === '1') return 착지('봇 정지 상태(두뇌_OFF=1)');
  if (!두뇌_AI키_()) return 착지('API 키 미설정');
  if (!두뇌_상한통과_(props)) return 착지('일일 호출 상한 초과');

  let 블록들;
  try {
    블록들 = 두뇌_관련지식_(q, 두뇌_지식로드_(대상키));
  } catch (err) {
    return 착지('지식 로드 실패: ' + String(err && err.message || err).slice(0, 120));
  }

  const schema = {
    type: 'object', additionalProperties: false,
    required: ['reply', 'handoff', 'handoff_reason', 'used_topics'],
    properties: {
      reply: { type: 'string', description: '답변. 지식에 있는 내용만. 답할 수 없으면 빈 문자열' },
      handoff: { type: 'boolean', description: '원장에게 넘겨야 하면 true' },
      handoff_reason: { type: 'string', description: '넘기는 이유를 한국어 한 문장으로(원장이 읽는다). 넘기지 않으면 빈 문자열' },
      used_topics: { type: 'array', items: { type: 'string' }, description: '답에 실제로 사용한 지식의 주제' }
    }
  };

  let out;
  try {
    out = 두뇌_AI_({
      system: 두뇌_시스템_(대상키, 블록들),
      messages: 두뇌_이력_(대상키, sid).concat([{ role: 'user', content: q }]),
      schema: schema, maxTokens: 1536, effort: 'low'
    });
  } catch (err) {
    return 착지('AI 오류: ' + String(err && err.message || err).slice(0, 160));
  }

  const 답 = String(out.data.reply || '').trim();
  const 인계 = !!out.data.handoff || !답;
  const 사용 = Array.isArray(out.data.used_topics) ? out.data.used_topics : [];
  const 출처 = 두뇌_출처표기_(사용, 블록들);

  두뇌_기록_(대상키, sid, 'user', q, false, null, '', '');
  두뇌_기록_(대상키, sid, 'bot', 답 || 두뇌_인계문, 인계, out.usage, 사용.join(' / '),
    인계 ? ('인계: ' + (out.data.handoff_reason || '')) : '');
  if (인계) 두뇌_인계알림_(대상키, sid, q, out.data.handoff_reason || '봇이 답할 수 없는 질문');

  return {
    reply: 인계 ? (답 ? 답 + '\n\n' + 두뇌_인계문 : 두뇌_인계문) : 답,
    handoff: 인계,
    sources: 출처   // 화면에 "무엇을 근거로 답했는지 + 그 문서가 언제 갱신됐는지"를 붙이는 재료
  };
}

/* 답변에 붙일 근거 표기 — 모델이 말한 주제를 실제 지식 블록과 대조해 확인된 것만 남긴다.
 * (모델이 없는 주제를 지어내 인용하는 경우를 여기서 걸러낸다) */
function 두뇌_출처표기_(사용주제, 블록들) {
  const 맵 = {};
  블록들.forEach(b => { 맵[b.주제] = b; });
  return 사용주제.map(t => 맵[String(t).trim()]).filter(Boolean)
    .map(b => ({ 주제: b.주제, 출처: b.출처 || '(출처 미기재)', 갱신일: b.갱신일 || '(갱신일 없음)' }));
}

function 두뇌_이력_(대상, 세션) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(두뇌_로그탭);
  if (!sh || sh.getLastRow() < 2) return [];
  const from = Math.max(2, sh.getLastRow() - 300);
  const rows = sh.getRange(from, 1, sh.getLastRow() - from + 1, 5).getValues();
  const mine = rows.filter(r => String(r[1]) === String(대상) && String(r[2]) === String(세션) && r[4]);
  const msgs = [];
  mine.slice(-12).forEach(r => {
    const role = (r[3] === 'user') ? 'user' : 'assistant';
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + String(r[4]);
    else msgs.push({ role: role, content: String(r[4]) });
  });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();   // 첫 메시지는 반드시 user
  return msgs;
}

/* 질문 원문이 시트에 들어간다 — `=`로 시작하면 시트가 수식으로 실행하고, 같은 스프레드시트에 학생 개인정보가 있다.
 * 방어는 상담AI.js의 셀안전_ 하나로 통일한다(로드 순서와 무관 — 호출 시점에 전역에서 찾는다).
 * tests/두뇌.test.js가 「기록 함수가 셀안전_을 거치는가」를 결과로 검사한다. */
function 두뇌_기록_(대상, 세션, 발신, 내용, 인계, usage, 사용지식, 비고) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet(ss, 두뇌_로그탭, 두뇌_로그헤더);
  const u = usage || {};
  sh.appendRow([new Date(), 대상, 셀안전_(세션), 발신, 셀안전_(String(내용).slice(0, 2000)), 인계 ? 'Y' : '',
    u.input_tokens || '', u.cache_read_input_tokens || '', u.output_tokens || '', 셀안전_(사용지식 || ''), 셀안전_(비고 || '')]);
}

/* 인계 = 이 두뇌의 성장 신호다. 알림 한 통이 곧 "채워야 할 지식 한 칸"이다. */
function 두뇌_인계알림_(대상, 세션, 질문, 사유) {
  const 라벨 = (대상 === '내부') ? '강사' : '학부모';
  adminMail('[SYNK] 🧠 두뇌가 모르는 질문 (' + 라벨 + ')',
    '사유: ' + 사유 + '\n세션: ' + 세션 +
    '\n\n질문:\n' + String(질문).slice(0, 500) +
    '\n\n─────\n답해 주신 뒤 「' + 두뇌_지식탭 + '」 탭에 한 줄 추가하시면, 다음부터는 봇이 대신 답합니다.\n' +
    '(대상=' + 대상 + ' · 주제=한 단어 · 확정=Y · 내용=답변)');
}

function 두뇌_상한통과_(props) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const 상한 = Number(props.getProperty('두뇌_일일상한')) || 두뇌_기본상한;
  const cur = String(props.getProperty('두뇌_카운터') || '');
  const parts = cur.split('|');
  const cnt = (parts[0] === today) ? (Number(parts[1]) || 0) : 0;
  if (cnt >= 상한) return false;
  props.setProperty('두뇌_카운터', today + '|' + (cnt + 1));
  return true;
}

/* ══════════════════════════════════════════════════════════
 * 점검·운영
 * ══════════════════════════════════════════════════════════ */

/* ▶ 두뇌가 아직 모르는 것 — 인계된 질문을 모아 보여준다. 이게 곧 「채울 목록」이다. */
function 두뇌_모르는것() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(두뇌_로그탭);
  if (!sh || sh.getLastRow() < 2) { Logger.log('아직 로그가 없습니다.'); return '아직 로그가 없습니다.'; }
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 두뇌_로그헤더.length).getValues();
  const 질문 = rows.filter(r => String(r[3]) === 'user' && String(r[5]) === 'Y')
    .map(r => ({ 대상: String(r[1]), 내용: String(r[4]).trim() }));
  const 집계 = {};
  질문.forEach(q => { const k = q.대상 + ' │ ' + q.내용; 집계[k] = (집계[k] || 0) + 1; });
  const 정렬 = Object.keys(집계).sort((a, b) => 집계[b] - 집계[a]);
  const out = '🧠 두뇌가 아직 모르는 질문 (많이 물은 순 · 총 ' + 질문.length + '건)\n\n'
    + (정렬.length ? 정렬.slice(0, 40).map((k, i) => (i + 1) + '. [' + 집계[k] + '회] ' + k).join('\n') : '(없음 — 아직 아무도 안 물었거나, 전부 답했습니다)')
    + '\n\n위에서 자주 나온 것부터 「' + 두뇌_지식탭 + '」 탭에 채우세요. 2회 이상 나온 질문이 최우선입니다.';
  Logger.log(out);
  return out;
}

/* ▶ 설치·상태 점검 — 유호님이 시트 메뉴에서 눌러 확인한다. */
function 두뇌_점검() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const 준비 = [], 경고 = [], 정보 = [];

  if (!두뇌_AI키_()) 준비.push('API 키 없음 — 답변 자체가 불가 (' + 두뇌_벤더_() + ')');
  if (props.getProperty('두뇌_OFF') === '1') 경고.push('두뇌_OFF=1 — 봇이 정지 상태');

  const sh = ss.getSheetByName(두뇌_지식탭);
  if (!sh || sh.getLastRow() < 2) 준비.push(두뇌_지식탭 + ' 탭이 비어 있음 — setupBrain ▶ 를 먼저 실행하세요');
  else {
    ['내부', '공개'].forEach(대상 => {
      const 블록 = 두뇌_지식로드_(대상);
      const 확정 = 블록.filter(두뇌_유효확정_).length;
      const 빈확정 = 블록.filter(b => b.확정 && !b.내용).length;
      정보.push(대상 + ': 지식 ' + 블록.length + '건 중 답할 수 있는 것 ' + 확정 + '건');
      if (빈확정) 경고.push(대상 + ' — 확정=Y인데 내용이 빈 줄 ' + 빈확정 + '개(그 주제는 자동으로 인계 처리됩니다)');
    });
    // 설계원칙 ⑤ 실검사 — 공개 경로에 '내부' 라벨이 한 줄이라도 섞이면 즉시 알린다
    const 샌것 = 두뇌_지식로드_('공개').filter(b => b.대상 === '내부').length;
    if (샌것) 경고.push('🔴 공개 경로에 내부 지식 ' + 샌것 + '건이 실렸습니다 — 즉시 확인 필요');
  }

  const 로그 = ss.getSheetByName(두뇌_로그탭);
  const 인계수 = (로그 && 로그.getLastRow() > 1)
    ? 로그.getRange(2, 6, 로그.getLastRow() - 1, 1).getValues().filter(r => String(r[0]) === 'Y').length : 0;
  정보.push('누적 인계(=아직 모르는 질문) ' + 인계수 + '건 — 두뇌_모르는것 ▶ 로 목록을 봅니다');

  const out = '🧠 회사 두뇌 점검\n'
    + '\n[막힌 것]\n' + (준비.length ?준비.map(s => '⛔ ' + s).join('\n') : '없음')
    + '\n\n[주의]\n' + (경고.length ? 경고.map(s => '⚠ ' + s).join('\n') : '없음')
    + '\n\n[현황]\n' + 정보.map(s => '· ' + s).join('\n')
    + '\n\n모델: ' + (typeof AI_FEEDBACK_MODEL === 'undefined' ? '(Code.js 미로드)' : AI_FEEDBACK_MODEL)
    + ' · 벤더: ' + 두뇌_벤더_()
    + ' · 일일상한: ' + (props.getProperty('두뇌_일일상한') || 두뇌_기본상한);
  Logger.log(out);
  return out;
}

/* ── 시트 메뉴 래퍼 ──
 * [v9.127] 교훈 승계 — Logger.log만 하면 유호님 화면에는 아무것도 안 뜬다. 메뉴에서 부르는 것은 결과를 눈에 보이게 한다. */
function menuBrainSetup() { SpreadsheetApp.getUi().alert(setupBrain()); }
function menuBrainCheck() { SpreadsheetApp.getUi().alert(두뇌_점검()); }
function menuBrainGaps() { SpreadsheetApp.getUi().alert(두뇌_모르는것()); }
function menuBrainTry() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('🧠 두뇌에게 물어보기', '강사가 물어볼 법한 질문을 적어보세요.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const q = String(r.getResponseText() || '').trim();
  if (!q) return;
  const a = 두뇌_답_(q, '내부', '메뉴시험');
  ui.alert('질문: ' + q + '\n\n답:\n' + a.reply
    + '\n\n' + (a.handoff ? '→ 답할 수 없어 인계로 처리했습니다(메일 발송).' : '근거: '
      + (a.sources.length ? a.sources.map(s => s.주제 + ' (' + s.출처 + ' · ' + s.갱신일 + ')').join(', ') : '없음')));
}

/* ▶ 실제로 물어보기(관리자 시험용) — 강사 화면을 붙이기 전에 답이 제대로 나오는지 여기서 본다. */
function 두뇌_시험() {
  const r = 두뇌_답_('강사가 수업 끝나고 꼭 해야 하는 게 뭔가요?', '내부', '시험-' + new Date().getTime());
  const out = '질문: 강사가 수업 끝나고 꼭 해야 하는 게 뭔가요?\n\n답: ' + r.reply
    + '\n\n인계: ' + (r.handoff ? 'Y' : 'N')
    + '\n근거: ' + (r.sources.length ? r.sources.map(s => s.주제 + '(' + s.출처 + ' · ' + s.갱신일 + ')').join(', ') : '없음');
  Logger.log(out);
  return out;
}
