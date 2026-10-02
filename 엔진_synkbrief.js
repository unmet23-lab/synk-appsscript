/* synkbrief 상시 자료 전달. 관리표에서 게시물별 자료를 등록한다.
 * 상담 봇과 계정·토큰·설정·중복 기록을 분리하며 기본 발송은 꺼져 있다.
 * SYNKBRIEF_CAMPAIGN_INDEX와 편별 속성은 관리표의 '등록 내용 적용'이 갱신한다.
 * 직접 DM 경로는 별도 캠페인을 지정하고 명시 활성화한 경우에만 사용한다.
 * 팔로우 요청은 영상 CTA다. 자료를 팔로우 여부로 잠그지는 않는다.
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
  const token = p.getProperty('SYNKBRIEF_IG_TOKEN');
  if (!token) { p.setProperty('SYNKBRIEF_HEALTH', '인증 연결 필요'); return; }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    synkbrief_계정확인_(token);
    p.setProperty('SYNKBRIEF_HEALTH', '정상 · ' + new Date().toISOString());
    const last = Date.parse(p.getProperty('SYNKBRIEF_TOKEN_SAVED_AT') || '');
    if (!last) throw new Error('token-date');
    // Meta 장기 토큰은 발급 24시간 뒤부터 갱신할 수 있다. 매일 확인하고 7일마다 갱신한다.
    if (Date.now() - last < 7 * 86400000) return;
    const res = UrlFetchApp.fetch('https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    const body = JSON.parse(res.getContentText());
    if (res.getResponseCode() !== 200 || !body.access_token || Number(body.expires_in) < 86400) throw new Error('refresh');
    p.setProperties({ SYNKBRIEF_IG_TOKEN: body.access_token, SYNKBRIEF_TOKEN_SAVED_AT: new Date().toISOString(), SYNKBRIEF_TOKEN_EXPIRES_AT: new Date(Date.now() + Number(body.expires_in) * 1000).toISOString(), SYNKBRIEF_HEALTH: '정상 · ' + new Date().toISOString() });
  } catch (_) {
    p.setProperty('SYNKBRIEF_HEALTH', '인증 자동 갱신 실패 · 연결 상태 확인 필요');
    synkbrief_발송로그_(p, 'system', '인증 갱신 실패', 0);
    throw new Error('synkbrief 인증 자동 갱신 실패. 관리자 메뉴에서 인증을 다시 연결해 주세요.');
  } finally { lock.releaseLock(); }
}
