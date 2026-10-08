/* synkbrief 상시 자료 전달. 관리표에서 게시물별 자료를 등록한다.
 * 상담 봇과 계정·토큰·설정·중복 기록을 분리하며 기본 발송은 꺼져 있다.
 * SYNKBRIEF_CAMPAIGN_INDEX와 편별 속성은 관리표의 '등록 내용 적용'이 갱신한다.
 * 직접 DM 경로는 별도 캠페인을 지정하고 명시 활성화한 경우에만 사용한다.
 * 신규 요청 자료 DM은 Supabase가 담당하며 팔로우를 필수 조건으로 삼지 않는다.
 * 이 파일의 구형 발송기는 OFF를 유지하고, 운영 상태 조회와 장애 메일을 담당한다.
 * 공개 자료는 가상 회의 예시이며, 원문 댓글·DM·사용자 이름을 저장하지 않는다.
 */
const SYNKBRIEF_MEETING_URL = 'https://synk.im/brief/meeting/';
const SYNKBRIEF_ACCOUNT = '17841433358976667';
const SYNKBRIEF_CONFIG_SHEET = 'synkbrief_자료등록';
const SYNKBRIEF_LOG_SHEET = 'synkbrief_발송기록';

function synkbrief_키워드_(text, keyword) {
  const word = String(keyword || 'synk').normalize('NFKC').toLowerCase();
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return typeof text === 'string' && new RegExp('(^|[^a-z0-9_])' + escaped + '([^a-z0-9_]|$)', 'i').test(text.normalize('NFKC'));
}

function synkbrief_캠페인읽기_(props) {
  try {
    const ids = JSON.parse(props.getProperty('SYNKBRIEF_CAMPAIGN_INDEX') || '[]');
    if (!Array.isArray(ids) || ids.length > 300) return [];
    return ids.map(id => JSON.parse(props.getProperty('SYNKBRIEF_CAMPAIGN_' + id) || 'null')).filter(c => c && c.enabled === true && /^[a-z0-9_-]{1,64}$/.test(c.id) && /^[0-9]+$/.test(c.mediaId) && /^[a-z0-9가-힣_-]{1,30}$/i.test(c.keyword) && /^https:\/\/[^\s]+$/.test(c.url) && typeof c.message === 'string' && c.message.length <= 800);
  } catch (_) { return []; }
}

function synkbrief_웹훅_(e, body) {
  if (!body || body.object !== 'instagram' || !Array.isArray(body.entry)) return null;
  const props = PropertiesService.getScriptProperties();
  const own = props.getProperty('SYNKBRIEF_IG_ID');
  if (!own || !body.entry.some(entry => String(entry.id) === own)) return null;
  const key = props.getProperty('상담AI_URL키');
  if (!key || !e || !e.parameter || e.parameter.k !== key) return { ok: false, error: 'unauthorized' };
  const entries = body.entry.filter(entry => String(entry.id) === own);
  if (props.getProperty('SYNKBRIEF_DM_ENABLED') !== '1') return { ok: true, skip: 'synkbrief-disabled' };
  const token = props.getProperty('SYNKBRIEF_IG_TOKEN');
  if (!token || !/^[A-Za-z0-9._-]{30,}$/.test(token)) return { ok: false, error: 'synkbrief-token-missing' };
  const campaigns = synkbrief_캠페인읽기_(props);
  const directId = props.getProperty('SYNKBRIEF_DIRECT_CAMPAIGN');
  const direct = props.getProperty('SYNKBRIEF_DM_KEYWORD_ENABLED') === '1';
  const events = [];
  const now = Date.now();
  entries.slice(0, 50).forEach(entry => {
    (Array.isArray(entry.changes) ? entry.changes : []).slice(0, 50).forEach(change => {
      const v = change.value || {};
      const time = Number(entry.time) * (Number(entry.time) < 1e12 ? 1000 : 1);
      if (change.field !== 'comments' || !v.id || !v.from || !v.from.id || String(v.from.id) === own) return;
      const campaign = campaigns.find(c => c.mediaId === String((v.media || {}).id) && synkbrief_키워드_(v.text, c.keyword));
      if (!campaign || !time || now - time > 7 * 86400000 || time - now > 300000) return;
      events.push({ kind: 'comment', id: String(v.id), recipient: String(v.from.id), campaign: campaign });
    });
    if (direct) (Array.isArray(entry.messaging) ? entry.messaging : []).slice(0, 50).forEach(message => {
      const m = message.message || {};
      const campaign = campaigns.find(c => c.id === directId && synkbrief_키워드_(m.text, c.keyword));
      if (!campaign || !message.sender || !message.recipient || String(message.recipient.id) !== own || String(message.sender.id) === own || m.is_echo || !m.mid) return;
      const time = Number(message.timestamp);
      if (!time || now - time > 24 * 3600000 || time - now > 300000) return;
      events.push({ kind: 'dm', id: String(m.mid), recipient: String(message.sender.id), campaign: campaign });
    });
  });
  let sent = 0, skipped = 0, failed = 0;
  events.slice(0, 20).forEach(event => {
    const result = synkbrief_자료발송_(props, own, token, event, now);
    if (result === 'sent') sent++; else if (result === 'failed') failed++; else skipped++;
  });
  return { ok: failed === 0, channel: 'synkbrief', sent: sent, skipped: skipped, failed: failed };
}

function synkbrief_자료발송_(props, own, token, event, now) {
  // 사용자 식별자 대신 SHA-256을 저장한다. 캠페인당 같은 사람에게 한 번만 보낸다.
  const hash = value => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
  const userKey = 'SYNKBRIEF_SENT_' + hash(event.campaign.id + ':' + event.recipient);
  const eventKey = 'SYNKBRIEF_EVENT_' + hash(event.kind + ':' + event.id);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return 'skipped';
  try {
    if (props.getProperty(userKey) || props.getProperty(eventKey)) return 'skipped';
    const stored = props.getProperties();
    let storageBytes = 0;
    Object.keys(stored).forEach(k => {
      if (/^SYNKBRIEF_(SENT|EVENT)_/.test(k)) {
        try {
          if (now - JSON.parse(stored[k]).at > 30 * 86400000) { props.deleteProperty(k); return; }
        } catch (_) { /* 손상된 기록은 자동 삭제하지 않는다. */ }
      }
      storageBytes += (k.length + stored[k].length) * 3;
    });
    // 같은 Apps Script의 다른 설정 공간까지 소진하지 않는다.
    if (storageBytes > 380000) return 'skipped';
    const hour = Math.floor(now / 3600000);
    const budget = JSON.parse(props.getProperty('SYNKBRIEF_RATE') || '{"hour":0,"count":0}');
    if (budget.hour !== hour) { budget.hour = hour; budget.count = 0; }
    if (budget.count >= 100) return 'skipped';
    // 한 댓글에는 1회만 보낼 수 있다. 응답 유실 때 재전송하지 않도록 먼저 시도 표시.
    props.setProperty(eventKey, JSON.stringify({ state: 'pending', at: now }));
    props.setProperty(userKey, JSON.stringify({ state: 'pending', at: now }));
    budget.count++; props.setProperty('SYNKBRIEF_RATE', JSON.stringify(budget));
  } finally { lock.releaseLock(); }
  const message = event.campaign.message + '\n\n' + event.campaign.url + '\n\n요청 키워드에 따른 @synkbrief 자동 안내입니다.';
  try {
    const response = UrlFetchApp.fetch('https://graph.instagram.com/v26.0/' + encodeURIComponent(own) + '/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ recipient: event.kind === 'comment' ? { comment_id: event.id } : { id: event.recipient }, message: { text: message } })
    });
    const data = JSON.parse(response.getContentText());
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300 && data.message_id) {
      props.setProperty(eventKey, JSON.stringify({ state: 'sent', at: now }));
      props.setProperty(userKey, JSON.stringify({ state: 'sent', at: now }));
      synkbrief_발송로그_(props, event.campaign.id, '성공', response.getResponseCode());
      return 'sent';
    }
    props.setProperty(eventKey, JSON.stringify({ state: 'failed', at: now, code: response.getResponseCode() }));
    props.setProperty(userKey, JSON.stringify({ state: 'failed', at: now }));
    synkbrief_발송로그_(props, event.campaign.id, '실패', response.getResponseCode());
    return 'failed';
  } catch (_) {
    // 네트워크 예외문에는 토큰·URL이 섞일 수 있어 출력하지 않는다.
    props.setProperty(eventKey, JSON.stringify({ state: 'unknown', at: now }));
    synkbrief_발송로그_(props, event.campaign.id, '응답 확인 필요', 0);
    return 'failed';
  }
}

function synkbrief_설정검사_() {
  const p = PropertiesService.getScriptProperties();
  const result = { enabled: p.getProperty('SYNKBRIEF_DM_ENABLED') === '1', accountConfigured: p.getProperty('SYNKBRIEF_IG_ID') === SYNKBRIEF_ACCOUNT, tokenConfigured: !!p.getProperty('SYNKBRIEF_IG_TOKEN'), activeCampaigns: synkbrief_캠페인읽기_(p).length, directKeywordEnabled: p.getProperty('SYNKBRIEF_DM_KEYWORD_ENABLED') === '1', health: p.getProperty('SYNKBRIEF_HEALTH') || '미확인' };
  console.log(JSON.stringify(result));
  return result;
}

// 관리자가 연결된 스프레드시트에서 실행한다. 토큰을 코드/로그에 넣지 않는다.
function synkbrief_관리자확인_() {
  const active = Session.getActiveUser().getEmail();
  if (!active || active !== Session.getEffectiveUser().getEmail()) throw new Error('프로젝트 관리자 로그인이 필요합니다.');
}

function synkbrief연결창() {
  synkbrief_관리자확인_();
  const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{font:16px sans-serif;padding:20px;line-height:1.7}input{box-sizing:border-box;width:100%;padding:12px}button{margin-top:16px;padding:12px 20px}#status{white-space:pre-wrap}</style><h2>@synkbrief 인증 연결</h2><p>Meta에서 발급한 액세스 토큰을 넣으세요. 계정 확인 후 비공개 서버 설정에만 저장합니다. 자동 발송은 아직 켜지 않습니다.</p><input id="token" type="password" autocomplete="off" aria-label="액세스 토큰"><button id="save">계정 확인하고 저장</button><p id="status" role="status"></p><script>document.getElementById("save").onclick=function(){var b=this,t=document.getElementById("token"),s=document.getElementById("status");b.disabled=true;s.textContent="계정 확인 중…";google.script.run.withSuccessHandler(function(r){t.value="";s.textContent=r.username+" 연결 확인 및 저장 완료. 자동 발송은 꺼져 있습니다.";b.disabled=false}).withFailureHandler(function(){s.textContent="저장하지 못했습니다. 관리자 로그인과 토큰을 확인해 주세요.";b.disabled=false}).synkbrief인증저장(t.value);};</script></html>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(480).setHeight(370), 'synkbrief 비공개 연결');
}

function synkbrief인증저장(token) {
  synkbrief_관리자확인_();
  if (typeof token !== 'string' || !/^[A-Za-z0-9._-]{30,}$/.test(token.trim())) throw new Error('유효한 토큰을 입력해 주세요.');
  token = token.trim();
  const identity = synkbrief_계정확인_(token);
  const p = PropertiesService.getScriptProperties();
  p.setProperties({ SYNKBRIEF_IG_ID: String(identity.user_id), SYNKBRIEF_IG_TOKEN: token, SYNKBRIEF_DM_ENABLED: '0', SYNKBRIEF_DM_KEYWORD_ENABLED: '0', SYNKBRIEF_TOKEN_SAVED_AT: new Date().toISOString(), SYNKBRIEF_HEALTH: '정상 · 계정 확인 ' + new Date().toISOString() });
  return { username: identity.username, configured: true, enabled: false };
}

function synkbrief_계정확인_(token) {
  let identity;
  try {
    const res = UrlFetchApp.fetch('https://graph.instagram.com/v26.0/me?fields=user_id,username', {
      headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw new Error('identity');
    identity = JSON.parse(res.getContentText());
  } catch (_) { throw new Error('Instagram 인증을 확인하지 못했습니다.'); }
  if (identity.username !== 'synkbrief' || String(identity.user_id) !== '17841433358976667') throw new Error('@synkbrief 전용 토큰이 필요합니다.');
  return identity;
}

function synkbrief_관리문서_(props) {
  const id = props.getProperty('SYNKBRIEF_ADMIN_SHEET_ID');
  if (!id) throw new Error('synkbrief운영설치를 먼저 실행해 주세요.');
  return SpreadsheetApp.openById(id);
}

function synkbrief관리메뉴() {
  SpreadsheetApp.getUi().createMenu('synkbrief 자료 DM')
    .addItem('1. 인증 연결·교체', 'synkbrief연결창')
    .addItem('2. 자료 등록표 열기', 'synkbrief등록표열기')
    .addItem('3. 등록 내용 적용', 'synkbrief등록적용')
    .addItem('연결 상태 확인', 'synkbrief상태보기')
    .addItem('운영 알림 읽기 키 연결', 'synkbrief운영알림연결창')
    .addItem('자동 발송 켜기', 'synkbrief운영시작')
    .addItem('자동 발송 일시 중지', 'synkbrief운영중지').addToUi();
}

function synkbrief운영설치() {
  synkbrief_관리자확인_();
  const p = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('연결된 관리 스프레드시트에서 실행해 주세요.');
  p.setProperty('SYNKBRIEF_ADMIN_SHEET_ID', ss.getId());
  if (!p.getProperty('SYNKBRIEF_DM_ENABLED')) p.setProperty('SYNKBRIEF_DM_ENABLED', '0');
  let sheet = ss.getSheetByName(SYNKBRIEF_CONFIG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SYNKBRIEF_CONFIG_SHEET);
    sheet.getRange(1, 1, 1, 8).setValues([['캠페인ID', '콘텐츠 이름', 'Instagram 게시물 링크', '댓글 키워드', '보낼 자료 링크', 'DM 안내 문구', '사용', '적용 상태']]);
    sheet.getRange(2, 1, 1, 8).setValues([['meeting-20260924', '1편 · 회의 기록 정리', '', 'synk', SYNKBRIEF_MEETING_URL, '요청하신 회의 정리 자료예요. 11쪽 PDF 가이드, 복사해서 쓸 문장, 연습 메모와 정리 예시를 준비했어요. 아래 링크에서 이용해 주세요.', false, '게시 후 Instagram 게시물 링크를 넣고 사용을 체크하세요.']]);
    sheet.getRange('G2:G301').insertCheckboxes();
    sheet.getRange('A1:H1').setFontWeight('bold').setBackground('#2e5bb6').setFontColor('#ffffff');
    sheet.setFrozenRows(1); sheet.setColumnWidth(1, 170); sheet.setColumnWidth(2, 220);
    sheet.setColumnWidths(3, 4, 280); sheet.setColumnWidth(7, 80); sheet.setColumnWidth(8, 320);
    sheet.getRange('A1:H301').setWrap(true);
    sheet.getRange('A1').setNote('편마다 다른 영문·숫자 ID. 예: meeting-20260924. 발송 이력이 생긴 뒤에는 바꾸지 마세요.');
    sheet.getRange('C1').setNote('Instagram에서 게시물 공유 → 링크 복사. @synkbrief 게시물만 등록할 수 있습니다.');
    sheet.getRange('G1').setNote('체크 후 상단 synkbrief 자료 DM → 등록 내용 적용. 게시 전에는 체크하지 않습니다.');
  }
  if (!ss.getSheetByName(SYNKBRIEF_LOG_SHEET)) {
    const log = ss.insertSheet(SYNKBRIEF_LOG_SHEET);
    log.appendRow(['시각', '캠페인ID', '처리 결과', 'HTTP 상태']); log.setFrozenRows(1); log.setColumnWidths(1, 4, 190);
  }
  // 편집기에서 설치해도 getUi 오류가 나지 않도록 메뉴는 시트를 열 때 onOpen이 만든다.
  // 기존 morningJobs를 사용하므로 별도 트리거를 중복 생성하지 않는다.
  console.log('synkbrief 관리표 설치 완료. 시트를 새로고침하면 운영 메뉴가 나타납니다. 발송 상태는 자동으로 바꾸지 않았습니다.');
}

function synkbrief등록표열기() {
  synkbrief_관리자확인_();
  const ss = synkbrief_관리문서_(PropertiesService.getScriptProperties());
  ss.setActiveSheet(ss.getSheetByName(SYNKBRIEF_CONFIG_SHEET));
}

function synkbrief_게시물목록_(p) {
  const all = [];
  let after = '';
  for (let page = 0; page < 10; page++) {
    const res = UrlFetchApp.fetch('https://graph.instagram.com/v26.0/' + SYNKBRIEF_ACCOUNT + '/media?fields=id,permalink&limit=100' + (after ? '&after=' + encodeURIComponent(after) : ''), {
      headers: { Authorization: 'Bearer ' + p.getProperty('SYNKBRIEF_IG_TOKEN') }, muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw new Error('Instagram 게시물 목록을 읽지 못했습니다. 인증 상태를 확인해 주세요.');
    const body = JSON.parse(res.getContentText());
    all.push(...(body.data || []));
    after = body.paging && body.paging.next && body.paging.cursors && body.paging.cursors.after;
    if (!after) break;
  }
  return all;
}

function synkbrief_게시물주소_(url) {
  const match = String(url || '').trim().match(/^https:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)(?:\/|\?|$)/i);
  return match ? match[1] : '';
}

function synkbrief등록적용() {
  synkbrief_관리자확인_();
  const p = PropertiesService.getScriptProperties();
  const sheet = synkbrief_관리문서_(p).getSheetByName(SYNKBRIEF_CONFIG_SHEET);
  if (!sheet || sheet.getLastRow() > 301) throw new Error('관리표는 최대 300편까지 지원합니다.');
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues() : [];
  const media = rows.some(r => r[6] === true) ? synkbrief_게시물목록_(p) : [];
  const campaigns = [], statuses = [], ids = new Set(), posts = new Set();
  let errors = 0;
  rows.forEach(r => {
    if (r[6] !== true) { statuses.push(['미사용 · 자동 발송 제외']); return; }
    const c = { id: String(r[0]).trim(), title: String(r[1]).trim(), keyword: String(r[3]).trim().normalize('NFKC').toLowerCase(), url: String(r[4]).trim(), message: String(r[5]).trim(), enabled: true };
    const shortcode = synkbrief_게시물주소_(r[2]);
    const post = shortcode && media.find(m => synkbrief_게시물주소_(m.permalink) === shortcode);
    let error = '';
    const prior = /^[a-z0-9_-]{1,64}$/.test(c.id) ? JSON.parse(p.getProperty('SYNKBRIEF_CAMPAIGN_' + c.id) || 'null') : null;
    if (!/^[a-z0-9_-]{1,64}$/.test(c.id) || ids.has(c.id)) error = '캠페인ID는 중복 없는 영문 소문자·숫자·-·_로 작성하세요.';
    else if (!post) error = '@synkbrief에 게시된 게시물 링크를 확인하세요.';
    else if (prior && prior.mediaId !== String(post.id)) error = '다른 게시물에는 새 캠페인ID를 사용하세요.';
    else if (posts.has(String(post.id))) error = '같은 게시물을 두 번 등록할 수 없습니다.';
    else if (!/^[a-z0-9가-힣_-]{1,30}$/i.test(c.keyword)) error = '댓글 키워드는 공백 없이 1~30자로 작성하세요.';
    else if (!/^https:\/\/[^\s]+$/.test(c.url) || c.url.length > 1000) error = '보낼 자료의 https 링크를 입력하세요.';
    else if (!c.message || c.message.length > 800 || (c.message + c.url).length > 930) error = '안내 문구와 링크를 합쳐 930자 이내로 입력하세요.';
    if (error) { errors++; statuses.push(['적용 안 됨: ' + error]); return; }
    c.mediaId = String(post.id); ids.add(c.id); posts.add(c.mediaId); campaigns.push(c); statuses.push(['확인 완료: ' + c.mediaId]);
  });
  if (statuses.length) sheet.getRange(2, 8, statuses.length, 1).setValues(statuses);
  if (errors) throw new Error(errors + '개 행을 수정해야 합니다. 기존 운영 설정은 유지했습니다.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('발송 처리 중입니다. 잠시 뒤 다시 적용해 주세요.');
  try {
    const old = JSON.parse(p.getProperty('SYNKBRIEF_CAMPAIGN_INDEX') || '[]');
    campaigns.forEach(c => p.setProperty('SYNKBRIEF_CAMPAIGN_' + c.id, JSON.stringify(c)));
    p.setProperty('SYNKBRIEF_CAMPAIGN_INDEX', JSON.stringify(campaigns.map(c => c.id)));
    old.filter(id => !ids.has(id)).forEach(id => p.deleteProperty('SYNKBRIEF_CAMPAIGN_' + id));
  } finally { lock.releaseLock(); }
  console.log(campaigns.length + '편의 자료 등록을 적용했습니다.');
  SpreadsheetApp.getUi().alert(campaigns.length + '편 적용 완료. 자동 발송을 켜면 등록한 게시물의 요청 댓글에만 자료가 전달됩니다.');
}

function synkbrief운영시작() {
  synkbrief_관리자확인_();
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('SYNKBRIEF_IG_ID') !== SYNKBRIEF_ACCOUNT || !p.getProperty('SYNKBRIEF_IG_TOKEN')) throw new Error('인증 연결부터 완료해 주세요.');
  if (!synkbrief_캠페인읽기_(p).length) throw new Error('게시물을 등록하고 등록 내용 적용을 먼저 눌러 주세요.');
  p.setProperty('SYNKBRIEF_DM_ENABLED', '1');
  SpreadsheetApp.getUi().alert('자동 발송을 켰습니다. 다른 계정으로 등록 게시물에 요청 댓글을 남겨 실제 수신을 확인해 주세요.');
}

function synkbrief운영중지() {
  synkbrief_관리자확인_();
  PropertiesService.getScriptProperties().setProperty('SYNKBRIEF_DM_ENABLED', '0');
  SpreadsheetApp.getUi().alert('자동 발송을 중지했습니다. 등록한 자료와 인증 정보는 보존합니다.');
}

function synkbrief상태보기() {
  synkbrief_관리자확인_();
  const s = synkbrief_설정검사_();
  SpreadsheetApp.getUi().alert('계정 연결: ' + (s.accountConfigured && s.tokenConfigured ? '저장됨' : '필요') + '\n자동 발송: ' + (s.enabled ? '켜짐' : '꺼짐') + '\n등록한 게시물: ' + s.activeCampaigns + '개\n인증 점검: ' + s.health + '\n실제 DM 도착은 등록 게시물에 댓글을 남겨 별도로 확인하세요.');
}

function synkbrief_발송로그_(p, campaign, state, code) {
  try {
    p.setProperty('SYNKBRIEF_LAST_RESULT', JSON.stringify({ at: new Date().toISOString(), campaign: campaign, state: state, code: code }));
    const sheet = synkbrief_관리문서_(p).getSheetByName(SYNKBRIEF_LOG_SHEET);
    if (sheet) sheet.appendRow([new Date(), campaign, state, code]);
  } catch (_) { /* 기록 오류 때문에 성공한 DM을 재발송하지 않는다. */ }
}

function synkbrief정기점검() {
  const p = PropertiesService.getScriptProperties();
  // Meta 토큰 갱신은 Supabase Vault/cron의 책임이다. 설치 전에는 기존 일일 트리거도 조용히 멈춘다.
  if (p.getProperty('SYNKBRIEF_OPS_MONITOR_ENABLED') !== '1') return { ok: true, state: 'disabled' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { ok: true, state: 'busy' };
  try {
    const status = synkbrief_운영상태읽기_(p.getProperty('SYNKBRIEF_OPS_READ_KEY'));
    const signature = JSON.stringify([status.healthy, status.rows.map(r => [r.name, r.health, r.http])]);
    const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, signature).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
    let previous = null;
    try { previous = JSON.parse(p.getProperty('SYNKBRIEF_OPS_NOTICE') || 'null'); } catch (_) { /* 손상된 상태는 새 관측으로 복구한다. */ }
    const record = { hash: hash, healthy: status.healthy, at: new Date().toISOString(), delivery: 'baseline' };
    p.setProperty('SYNKBRIEF_OPS_LAST_CHECK', JSON.stringify({ healthy: status.healthy, at: record.at }));
    if (previous && previous.hash === hash) return { ok: previous.delivery !== 'unknown' && previous.delivery !== 'pending', state: previous.delivery === 'unknown' || previous.delivery === 'pending' ? 'delivery_unknown' : 'unchanged', healthy: status.healthy };
    if (!previous && status.healthy) {
      p.setProperty('SYNKBRIEF_OPS_NOTICE', JSON.stringify(record));
      return { ok: true, state: 'baseline', healthy: true };
    }
    // 일일 잔여 수신자 수가 없으면 상태를 소비하지 않아 다음 회차에 다시 시도한다.
    if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, state: 'quota_exhausted', healthy: status.healthy };
    record.delivery = 'pending';
    p.setProperty('SYNKBRIEF_OPS_NOTICE', JSON.stringify(record));
    try {
      MailApp.sendEmail({
        to: 'unmet23@gmail.com',
        subject: status.healthy ? '[SYNK DM] 운영 복구' : '[SYNK DM] 운영 이상',
        body: '확인 시각: ' + status.at + '\n상태: ' + (status.healthy ? '정상' : '확인 필요') + '\n\n' + status.rows.map(r => r.name + ' | ' + r.health + ' | 시각 ' + r.at + ' | HTTP ' + (r.http || '-')).join('\n'),
        name: 'SYNK'
      });
      record.delivery = 'sent';
      p.setProperty('SYNKBRIEF_OPS_NOTICE', JSON.stringify(record));
      return { ok: true, state: 'sent', healthy: status.healthy };
    } catch (_) {
      // 수신 여부가 불명확한 발송을 자동으로 반복하지 않는다. 원본 예외·본문은 저장하지 않는다.
      record.delivery = 'unknown';
      p.setProperty('SYNKBRIEF_OPS_NOTICE', JSON.stringify(record));
      throw new Error('SYNK DM 운영 알림 전달 여부를 확인하지 못했습니다. 같은 상태는 자동 재발송하지 않습니다.');
    }
  } finally { lock.releaseLock(); }
}

// 관리자 편집기의 관측 전용 함수. 원본 속성·키·예외를 로그/반환값에 복사하지 않는다.
function synkbrief운영알림상태() {
  try { synkbrief_관리자확인_(); }
  catch (_) { throw new Error('프로젝트 관리자 로그인이 필요합니다.'); }
  try {
    const p = PropertiesService.getScriptProperties();
    const readRecord = name => {
      const raw = p.getProperty(name);
      if (!raw) return { missing: true, value: {} };
      try {
        if (typeof raw !== 'string' || raw.length > 4096) throw new Error('shape');
        const value = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
        return { missing: false, value: value };
      } catch (_) { return { missing: false, value: {} }; }
    };
    const safeTime = value => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
      const time = Date.parse(value);
      return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null;
    };
    const delivery = (record, allowed) => record.missing ? 'not_recorded'
      : allowed.indexOf(record.value.delivery) >= 0 ? record.value.delivery : 'invalid';
    const mail = readRecord('SYNKBRIEF_OPS_MAIL_TEST');
    const notice = readRecord('SYNKBRIEF_OPS_NOTICE');
    const last = readRecord('SYNKBRIEF_OPS_LAST_CHECK');
    const key = p.getProperty('SYNKBRIEF_OPS_READ_KEY');
    let quota = null, timerCount = null;
    try {
      const value = MailApp.getRemainingDailyQuota();
      if (Number.isInteger(value) && value >= 0) quota = value;
    } catch (_) { /* 권한/조회 실패는 원본 예외 대신 null로 표시한다. */ }
    try {
      // 이 API는 실행 계정 소유 트리거만 반환한다. 다른 소유자의 트리거 수나 실제 간격은 단정하지 않는다.
      timerCount = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'synkbrief정기점검'
        && t.getEventType() === ScriptApp.EventType.CLOCK).length;
    } catch (_) { /* 트리거 조회 실패와 0개를 구분한다. */ }
    const result = {
      enabled: p.getProperty('SYNKBRIEF_OPS_MONITOR_ENABLED') === '1',
      keyConfigured: typeof key === 'string' && key.length >= 32 && !/\s/.test(key),
      mailTest: { state: delivery(mail, ['pending', 'sent', 'unknown']), at: safeTime(mail.value.at) },
      notice: { delivery: delivery(notice, ['baseline', 'pending', 'sent', 'unknown']),
        healthy: typeof notice.value.healthy === 'boolean' ? notice.value.healthy : null, at: safeTime(notice.value.at) },
      lastCheck: { at: safeTime(last.value.at), healthy: typeof last.value.healthy === 'boolean' ? last.value.healthy : null },
      currentMailQuota: quota,
      timers: { ownerScope: 'current_user', handler: 'synkbrief정기점검', count: timerCount }
    };
    console.log(JSON.stringify(result));
    return result;
  } catch (_) { throw new Error('운영 알림 상태를 읽지 못했습니다.'); }
}

// 연결된 관리 시트의 메뉴에서만 연다. 입력값은 HTML/반환값/로그에 다시 넣지 않는다.
function synkbrief운영알림연결창() {
  synkbrief_관리자확인_();
  const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{font:16px sans-serif;padding:20px;line-height:1.7}input{box-sizing:border-box;width:100%;padding:12px}button{margin-top:16px;padding:12px 20px}#status{white-space:pre-wrap}</style><h2>운영 알림 읽기 키 연결</h2><p>비공개 읽기 키로 운영 상태 조회를 확인한 뒤 저장합니다. 이 단계에서는 메일을 보내거나 정기 점검을 켜지 않습니다.</p><input id="key" type="password" autocomplete="off" spellcheck="false" maxlength="64" aria-label="운영 알림 읽기 키"><button id="save">연결 확인하고 저장</button><p id="status" role="status"></p><script>document.getElementById("save").onclick=function(){var b=this,k=document.getElementById("key"),s=document.getElementById("status"),value=k.value;k.value="";b.disabled=true;s.textContent="연결 확인 중…";google.script.run.withSuccessHandler(function(){s.textContent="읽기 키 연결을 확인하고 저장했습니다. 정기 점검과 메일 발송은 별도 단계입니다.";b.disabled=false}).withFailureHandler(function(){s.textContent="연결하지 못했습니다. 관리자 권한과 입력값을 확인해 주세요.";b.disabled=false}).synkbrief운영알림키저장(value);value="";};</script></html>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(480).setHeight(390), '운영 알림 비공개 연결');
}

function synkbrief운영알림키저장(key) {
  let lock, acquired = false;
  try {
    synkbrief_관리자확인_();
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{64}$/.test(key)) throw new Error('invalid');
    lock = LockService.getScriptLock();
    acquired = lock.tryLock(10000);
    if (!acquired) throw new Error('busy');
    // 연결 계정/예약이 아직 준비되지 않았어도 인증된 정상 형식의 응답이면 키를 연결할 수 있다.
    const status = synkbrief_운영상태읽기_(key);
    if (status.validated !== true) throw new Error('unverified');
    PropertiesService.getScriptProperties().setProperty('SYNKBRIEF_OPS_READ_KEY', key);
    return { ok: true, configured: true };
  } catch (_) {
    throw new Error('운영 알림 읽기 키를 연결하지 못했습니다. 관리자 권한과 입력값을 확인해 주세요.');
  } finally { if (acquired) lock.releaseLock(); }
}

// 편집기에서 명시 실행한다. 읽기 키는 관리자 연결창에서 먼저 저장한다.
// 이 함수는 메일을 보내지 않지만 최초 실행 시 Google 메일 발송 권한 승인이 필요할 수 있다.
function synkbrief운영알림설정() {
  synkbrief_관리자확인_();
  const p = PropertiesService.getScriptProperties();
  const key = p.getProperty('SYNKBRIEF_OPS_READ_KEY');
  if (!key || key.length < 32 || /\s/.test(key)) throw new Error('SYNKBRIEF_OPS_READ_KEY를 Script Properties에 먼저 저장해 주세요.');
  MailApp.getRemainingDailyQuota();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('운영 점검이 실행 중입니다. 잠시 뒤 다시 설정해 주세요.');
  try {
    const old = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'synkbrief정기점검' && t.getEventType() === ScriptApp.EventType.CLOCK);
    // 생성 실패 시 기존 타이머를 보존한다. 다른 handler/이벤트 트리거는 건드리지 않는다.
    ScriptApp.newTrigger('synkbrief정기점검').timeBased().everyMinutes(15).create();
    old.forEach(t => ScriptApp.deleteTrigger(t));
    p.setProperty('SYNKBRIEF_OPS_MONITOR_ENABLED', '1');
    return { ok: true, enabled: true, intervalMinutes: 15, recipient: 'unmet23@gmail.com', emailSent: false };
  } finally { lock.releaseLock(); }
}

// 사용자가 시험 메일 1통을 승인한 뒤 관리자 편집기에서 실행한다. 재실행으로 초기화하지 않는다.
function synkbrief운영알림시험() {
  synkbrief_관리자확인_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('운영 점검이 실행 중입니다. 잠시 뒤 다시 시험해 주세요.');
  try {
    const p = PropertiesService.getScriptProperties();
    const previous = p.getProperty('SYNKBRIEF_OPS_MAIL_TEST');
    if (previous) {
      let delivered = false;
      try { delivered = JSON.parse(previous).delivery === 'sent'; } catch (_) { /* 손상된 기록도 재발송하지 않는다. */ }
      return { ok: delivered, state: delivered ? 'already_sent' : 'delivery_unknown', emailSent: false };
    }
    if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, state: 'quota_exhausted', emailSent: false };
    const record = { at: new Date().toISOString(), delivery: 'pending' };
    p.setProperty('SYNKBRIEF_OPS_MAIL_TEST', JSON.stringify(record));
    try {
      MailApp.sendEmail({
        to: 'unmet23@gmail.com', subject: '[SYNK DM] 알림 연결 시험', name: 'SYNK',
        body: 'SYNK DM 운영 알림의 메일 연결을 확인하기 위한 시험 메일입니다.\n운영 장애가 발생했다는 알림이 아닙니다.\n확인 시각: ' + record.at
      });
      record.delivery = 'sent';
      p.setProperty('SYNKBRIEF_OPS_MAIL_TEST', JSON.stringify(record));
      return { ok: true, state: 'sent', emailSent: true };
    } catch (_) {
      record.delivery = 'unknown';
      p.setProperty('SYNKBRIEF_OPS_MAIL_TEST', JSON.stringify(record));
      throw new Error('SYNK DM 시험 메일 전달 여부를 확인하지 못했습니다. 자동 재발송하지 않습니다.');
    }
  } finally { lock.releaseLock(); }
}

function synkbrief_운영상태읽기_(key) {
  const now = new Date().toISOString();
  const failed = (health, http) => ({ validated: false, healthy: false, at: now, rows: [{ name: 'ops-status', health: health, http: http || 0, at: now }] });
  if (!key || key.length < 32 || /\s/.test(key)) return failed('read_key_missing', 0);
  let response;
  try {
    response = UrlFetchApp.fetch('https://qiwxeddwwnzkwalpsuty.supabase.co/functions/v1/synkbrief-dm?task=ops-status', {
      method: 'get', headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true, followRedirects: false
    });
  } catch (_) { return failed('fetch_failed', 0); }
  const http = response.getResponseCode();
  if (http !== 200) return failed('http_error', Number.isInteger(http) && http >= 100 && http <= 599 ? http : 0);
  try {
    const text = response.getContentText();
    if (text.length > 32768) return failed('invalid_response', 200);
    const body = JSON.parse(text);
    if (!body || body.ok !== true || typeof body.healthy !== 'boolean' || !Array.isArray(body.accounts) || body.accounts.length > 100 || !Array.isArray(body.jobs) || body.jobs.length > 10) return failed('invalid_response', 200);
    const checked = Date.parse(body.checked_at);
    if (typeof body.checked_at !== 'string' || !Number.isFinite(checked) || Date.now() - checked > 600000 || checked - Date.now() > 300000) return failed('stale_response', 200);
    const safeTime = value => { const at = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(at) ? new Date(at).toISOString() : '-'; };
    const safeHttp = value => Number.isInteger(value) && value >= 100 && value <= 599 ? value : 0;
    const healthCodes = ['ok', 'healthy', 'pending', 'unknown', 'missing', 'disabled', 'failed', 'stale', 'auth-needed', 'auth-failed', 'refresh-failed', 'stop-identity-needed', 'send-failed', 'unhealthy'];
    const safeHealth = value => healthCodes.indexOf(value) >= 0 ? value : 'unknown';
    const optionalTime = value => value == null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
    const optionalHttp = value => value == null || (Number.isInteger(value) && value >= 100 && value <= 599);
    body.jobs.forEach(job => {
      if (!job || typeof job.jobname !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(job.jobname) || typeof job.active !== 'boolean' || typeof job.health !== 'string' || !optionalTime(job.last_run_at) || !optionalHttp(job.http_status)) throw new Error('shape');
    });
    const rows = [];
    let healthy = body.healthy;
    const seen = Object.create(null);
    const accountIssueCodes = ['token-missing', 'campaign-expired', 'campaign-inactive'];
    body.accounts.forEach(account => {
      if (!account || typeof account.username !== 'string' || !/^[a-zA-Z0-9._]{1,30}$/.test(account.username) || typeof account.connected !== 'boolean' || typeof account.health !== 'string' || !optionalTime(account.token_expires_at) || !optionalTime(account.last_failure_at) || !optionalHttp(account.http_status)) throw new Error('shape');
      if (account.dm_enabled !== undefined && typeof account.dm_enabled !== 'boolean') throw new Error('shape');
      const accountIssues = account.issue_codes === undefined ? [] : account.issue_codes;
      if (!Array.isArray(accountIssues) || accountIssues.length > accountIssueCodes.length
        || accountIssues.some((code, index) => accountIssueCodes.indexOf(code) < 0 || accountIssues.indexOf(code) !== index)
        || (accountIssues.length > 0 && account.dm_enabled !== true)) throw new Error('shape');
      if (!account.connected && account.dm_enabled !== true) return;
      if (seen[account.username]) throw new Error('shape');
      seen[account.username] = true;
      const health = safeHealth(account.health);
      if (health !== 'ok' && health !== 'healthy') healthy = false;
      rows.push({ name: '@' + account.username, health: health, http: safeHttp(account.http_status), at: safeTime(account.last_failure_at || account.token_expires_at) });
      // 발송 ON 계정의 연결 소실과 캠페인 종료는 기존 계정 오류와 별개로 알린다.
      const activeIssues = accountIssues.slice();
      if (!account.connected && activeIssues.indexOf('token-missing') < 0) activeIssues.push('token-missing');
      if (activeIssues.length) healthy = false;
      activeIssues.forEach(code => rows.push({ name: '@' + account.username, health: code, http: 200, at: new Date(checked).toISOString() }));
    });
    ['synkbrief-refresh', 'synkbrief-retention'].forEach(name => {
      const matches = body.jobs.filter(job => job && job.jobname === name);
      if (matches.length > 1) throw new Error('shape');
      const job = matches[0];
      const health = !job ? 'missing' : job.active !== true ? 'disabled' : safeHealth(job.health);
      if (health !== 'ok' && health !== 'healthy' && health !== 'pending') healthy = false;
      rows.push({ name: name, health: health, http: job ? safeHttp(job.http_status) : 0, at: job ? safeTime(job.last_run_at) : '-' });
    });
    // 고정 운영 서버는 승인된 큐가 켜져 있어야 한다. 누락과 알려진 오류 종류를 검증·요약한다.
    if (Object.prototype.hasOwnProperty.call(body, 'queue')) {
      const queue = body.queue;
      const codes = ['stalled_ready', 'stalled_retries', 'stale_leases', 'expiry_overdue', 'recent_errors',
        'cron_missing', 'cron_disabled', 'cron_duplicate', 'cron_failed', 'cron_stale'];
      // 서버·감시 순차 배포 중에는 이전 계약도 허용한다. 새 필드가 있으면 동일하게 검증한다.
      if (queue && queue.issue_counts && Object.prototype.hasOwnProperty.call(queue.issue_counts, 'recent_expired')) codes.push('recent_expired');
      if (!queue || typeof queue !== 'object' || Array.isArray(queue) || typeof queue.healthy !== 'boolean'
        || typeof queue.key_configured !== 'boolean' || !queue.issue_counts || typeof queue.issue_counts !== 'object'
        || Array.isArray(queue.issue_counts) || Object.keys(queue.issue_counts).length !== codes.length
        || codes.some(code => !Number.isSafeInteger(queue.issue_counts[code]) || queue.issue_counts[code] < 0)) throw new Error('shape');
      const active = codes.filter(code => queue.issue_counts[code] > 0);
      if (queue.healthy !== (queue.key_configured && active.length === 0)) throw new Error('shape');
      if (!queue.healthy) healthy = false;
      // 건수·대기량·원문·식별자는 해시와 메일에 넣지 않는다. 오류 종류 변화와 복구만 구분한다.
      if (!queue.key_configured) rows.push({ name: 'synkbrief-queue', health: 'key_missing', http: 200, at: new Date(checked).toISOString() });
      active.forEach(code => rows.push({ name: 'synkbrief-queue', health: code, http: 200, at: new Date(checked).toISOString() }));
    } else {
      healthy = false;
      rows.push({ name: 'synkbrief-queue', health: 'missing', http: 200, at: new Date(checked).toISOString() });
    }
    if (!rows.some(r => r.name.charAt(0) === '@')) { healthy = false; rows.push({ name: 'accounts', health: 'missing', http: 0, at: '-' }); }
    if (!body.healthy && rows.every(r => r.health === 'ok' || r.health === 'healthy' || r.health === 'pending')) rows.push({ name: 'ops-status', health: 'unhealthy', http: 200, at: new Date(checked).toISOString() });
    // 정상 시각/HTTP 성공의 변화는 장애 알림을 만들지 않는다.
    const issues = healthy ? [] : rows.filter(r => r.health !== 'ok' && r.health !== 'healthy' && r.health !== 'pending');
    issues.sort((a, b) => a.name.localeCompare(b.name) || a.health.localeCompare(b.health));
    return { validated: true, healthy: healthy, at: new Date(checked).toISOString(), rows: issues };
  } catch (_) { return failed('invalid_response', 200); }
}
