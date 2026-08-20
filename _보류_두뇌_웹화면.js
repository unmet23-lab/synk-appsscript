/* ============================================================
 * 🚧 보류 — 회사 두뇌 「강사 웹 화면」 (라이브 미배포)
 *
 * ⛔ 이 파일은 .claspignore 허용목록에 없다 = 라이브에 올라가지 않는다. 그대로 두어라.
 *
 * 왜 뺐나 (2026-08-03 배포 직전 적대 보안 검토 2인이 독립적으로 같은 결론):
 *   Apps Script 웹앱이 ANYONE_ANONYMOUS + USER_DEPLOYING이라, doGet이 HtmlService 페이지를 한 번이라도
 *   반환하면 그 페이지를 받은 사람은 google.script.run으로 **이 프로젝트의 밑줄 없는 전역 함수 전부**(실측 171개)를
 *   원장 권한으로 부를 수 있다. 노출 단위가 「내가 부르려던 함수」가 아니라 「프로젝트 전체」다.
 *   · 거부 화면도 HtmlService였다 → 키를 몰라도 브릿지를 얻는다.
 *   · 그 브릿지로 두뇌_링크()를 부르면 URL 키를 **만들어서 돌려준다** → fail-closed가 통째로 무력화.
 *   · previewOneReportCard('')는 학생 리포트카드 PNG를 ANYONE_WITH_LINK로 공유하고 URL을 반환하고,
 *     notifyParents()는 실제 학부모 메일을 발송한다. 전부 같은 브릿지 위에 있다.
 *   즉 이 화면 하나가 학원 스프레드시트 전체를 익명에게 여는 문이었다. 키 재검사(brainAsk)로는 못 막는다 —
 *   막아야 할 것이 내 함수가 아니라 옆 함수들이기 때문이다.
 *
 * 되살리는 조건 (셋 중 하나 — 코드를 고쳐서 되는 문제가 아니다)
 *   ① 두뇌를 **별도 Apps Script 프로젝트**로 분리하고, 그 프로젝트는 지식·로그 전용 스프레드시트만 붙인다(권장).
 *      브릿지가 열려도 닿을 수 있는 것이 지식·로그뿐이라 피해 상한이 구조적으로 정해진다.
 *   ② 웹앱 배포를 「Google 계정 필요」로 바꾼다 — 단 그러면 Meta 메신저 웹훅(익명 POST)이 죽으므로 상담AI와 양립 불가.
 *   ③ HtmlService를 아예 쓰지 않고 doPost + 본문 토큰으로만 받는다(memory deploy-security-gate-2026-08-02의 러너 규칙과 동일 결론).
 *
 * 되살릴 때 반드시 함께 할 것
 *   · 거부 경로는 HtmlService가 아니라 ContentService 텍스트로 (브릿지 부트스트랩 자체를 억제)
 *   · setupBrain·두뇌_점검·두뇌_모르는것·두뇌_시험·두뇌_링크를 밑줄 접미로 private화하고 메뉴 래퍼만 공개
 *   · tests/두뇌.test.js의 웹 검사 4종을 되살리고, 「RPC 표면에 brainAsk 외에는 없다」를 결과로 검사하는 회귀를 추가
 * ============================================================ */

/* ══════════════════════════════════════════════════════════
 * 강사 입구 — 링크 하나로 열리는 질문 화면
 *
 * 왜 doGet인가: Apps Script는 프로젝트당 doGet이 하나라 상담AI.js의 것을 함께 쓴다.
 *   거기 분기는 ?p=두뇌 가 있을 때만 발화하므로 Meta 웹훅 경로는 무영향이다.
 *
 * 인증의 한계를 정직하게 — 지금 방어는 URL 키 하나다(fail-closed: 키 미설정이면 화면 자체가 안 열린다).
 *   링크를 받은 사람은 누구나 볼 수 있으므로 「내부 지식」까지가 한계고, 학생 개인정보는 애초에
 *   이 경로에 실리지 않는다(설계원칙 ⑤ · tests/두뇌.test.js가 결과로 검사).
 *   더 조이려면 웹앱 배포를 「Google 계정 필요」로 바꾼다 — 그때 아래 두뇌_강사_()가 자동으로 이름을 잡는다.
 * ══════════════════════════════════════════════════════════ */

function 두뇌_키통과_(키) {
  const 정답 = PropertiesService.getScriptProperties().getProperty('두뇌_URL키');
  if (!정답) return false;                        // 미설정 = 통과가 아니라 거부(fail-closed)
  return String(키 || '') === String(정답);
}

/* 로그인 상태로 열렸으면 강사 이름을 잡는다. 익명 배포면 빈 문자열 — 화면은 그대로 동작한다. */
function 두뇌_강사_() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return '';
    const map = teacherEmailMap_(SpreadsheetApp.getActiveSpreadsheet()) || {};
    const 이름 = Object.keys(map).filter(n => String(map[n]).toLowerCase() === String(email).toLowerCase())[0];
    return 이름 || '';
  } catch (e) { return ''; }
}

/* 화면에서 부르는 서버 함수. 키를 여기서 다시 검사한다 —
 * google.script.run은 웹앱 접근 권한만 있으면 부를 수 있어, 페이지를 열 때 한 검사는 방어가 아니다.
 *
 * ⚠ 이름에 밑줄을 붙이지 않는다 — Apps Script는 `_`로 끝나는 함수를 private으로 취급해
 *   google.script.run에 노출하지 않는다. 이 파일의 다른 함수와 규칙이 다른 이유가 그것이다(오타 아님). */
function brainAsk(질문, 키, 세션) {
  if (!두뇌_키통과_(키)) return { reply: '접근 권한이 없습니다. 원장님께 링크를 다시 받아 주세요.', handoff: false, sources: [], denied: true };
  return 두뇌_답_(질문, '내부', '강사:' + String(세션 || 'anon').slice(0, 40));
}

function 두뇌_웹페이지_(p) {
  if (!두뇌_키통과_(p && p.k)) {
    return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;padding:40px;text-align:center;color:#6B7280">'
      + '접근 권한이 없습니다.<br/><span style="font-size:13px">원장님께 링크를 다시 받아 주세요.</span></div>')
      .setTitle('SYNK');
  }
  const 이름 = 두뇌_강사_();
  const html = 두뇌_HTML_(String(p.k), 이름);
  return HtmlService.createHtmlOutput(html)
    .setTitle('SYNK 안내')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);   // Glide 웹뷰 안에서도 열리도록
}

/* 화면 — 강사가 수업 사이에 폰으로 연다는 전제(모바일 우선·큰 입력창·한 손 조작).
 * 브랜드: 크림 배경 #FAFAF9 · 잉크 #262626 · 액센트 Coral 3 #E8543F(라이트 배경 위 글자용 정본). */
function 두뇌_HTML_(키, 이름) {
  const 인사 = 이름 ? (이름 + ' 선생님, 무엇이 궁금하세요?') : '무엇이 궁금하세요?';
  return '' +
'<style>' +
'*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}' +
'body{margin:0;background:#FAFAF9;color:#262626;font-family:"SUIT","Inter Tight",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.6}' +
'.wrap{max-width:640px;margin:0 auto;padding:16px 14px 120px}' +
'.hd{display:flex;align-items:baseline;gap:8px;padding:6px 2px 14px}' +
'.hd b{font-size:17px;font-weight:800;letter-spacing:-.2px}' +
'.hd span{font-size:12px;color:#8A8578}' +
'.msg{margin:10px 0;display:flex}' +
'.msg.me{justify-content:flex-end}' +
'.bub{max-width:86%;padding:11px 14px;border-radius:16px;white-space:pre-wrap;word-break:break-word}' +
'.me .bub{background:#262626;color:#fff;border-bottom-right-radius:5px}' +
'.bot .bub{background:#fff;border:1px solid #EAEAEA;border-bottom-left-radius:5px}' +
'.src{margin:4px 0 0 2px;font-size:11px;color:#8A8578;line-height:1.5}' +
'.hand{margin:6px 0 0 2px;font-size:12px;color:#E8543F;font-weight:700}' +
'.ask{position:fixed;left:0;right:0;bottom:0;background:#FAFAF9;border-top:1px solid #EAEAEA;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}' +
'.ask .in{max-width:640px;margin:0 auto;display:flex;gap:8px;align-items:flex-end}' +
'textarea{flex:1;resize:none;border:1px solid #E3DACA;border-radius:14px;padding:11px 13px;font:inherit;background:#fff;max-height:120px;min-height:44px}' +
'textarea:focus{outline:2px solid rgba(232,84,63,.35);border-color:#E8543F}' +
'button{border:0;border-radius:14px;background:#E8543F;color:#fff;font:inherit;font-weight:800;padding:0 18px;height:44px;cursor:pointer}' +
'button:disabled{background:#D6CFC2;cursor:default}' +
'.tip{color:#8A8578;font-size:13px;text-align:center;padding:26px 10px;line-height:1.8}' +
'</style>' +
'<div class="wrap">' +
'<div class="hd"><b>SYNK 안내</b><span>모르는 건 원장님께 전달됩니다</span></div>' +
'<div id="log"><div class="tip">' + 두뇌_esc_(인사) + '<br/>수업 규칙·앱 사용법·운영 절차를 물어보세요.<br/>' +
'답을 모르면 지어내지 않고 원장님께 바로 넘깁니다.</div></div>' +
'</div>' +
'<div class="ask"><div class="in">' +
'<textarea id="q" rows="1" placeholder="질문을 입력하세요" enterkeyhint="send"></textarea>' +
'<button id="go">보내기</button>' +
'</div></div>' +
'<script>' +
'var KEY=' + JSON.stringify(키) + ';' +
'var SID=localStorage.getItem("synk_brain_sid")||(Math.random().toString(36).slice(2)+Date.now().toString(36));' +
'localStorage.setItem("synk_brain_sid",SID);' +
'var log=document.getElementById("log"),q=document.getElementById("q"),go=document.getElementById("go"),busy=false;' +
'function add(who,text){var t=document.querySelector(".tip");if(t)t.remove();' +
'var d=document.createElement("div");d.className="msg "+who;' +
'var b=document.createElement("div");b.className="bub";b.textContent=text;d.appendChild(b);log.appendChild(d);' +
'window.scrollTo(0,document.body.scrollHeight);return d;}' +
'function meta(el,cls,text){var d=document.createElement("div");d.className=cls;d.textContent=text;' +
'el.parentNode.insertBefore(d,el.nextSibling);window.scrollTo(0,document.body.scrollHeight);}' +
'function send(){var v=q.value.trim();if(!v||busy)return;busy=true;go.disabled=true;q.value="";q.style.height="auto";' +
'add("me",v);var wait=add("bot","…");' +
'google.script.run.withSuccessHandler(function(r){wait.remove();' +
'var el=add("bot",r.reply);' +
'if(r.sources&&r.sources.length)meta(el,"src","근거 — "+r.sources.map(function(s){return s.주제+" ("+s.출처+" · "+s.갱신일+")"}).join(" / "));' +
'if(r.handoff&&!r.denied)meta(el,"hand","원장님께 전달했습니다");' +
'busy=false;go.disabled=false;q.focus();})' +
'.withFailureHandler(function(e){wait.remove();add("bot","연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");' +
'busy=false;go.disabled=false;})' +
'.brainAsk(v,KEY,SID);}' +
'go.addEventListener("click",send);' +
'q.addEventListener("input",function(){q.style.height="auto";q.style.height=Math.min(q.scrollHeight,120)+"px";});' +
'q.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});' +
'</script>';
}

/* HTML 문자열에 값을 심을 때만 쓴다. 화면에 뜨는 사용자 입력은 전부 textContent로 넣으므로 여기 오지 않는다. */
function 두뇌_esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ▶ 강사에게 보낼 링크를 만든다. 키가 없으면 여기서 하나 만들어 저장한다(유호님이 직접 만들 필요 없게). */
function 두뇌_링크() {
  const props = PropertiesService.getScriptProperties();
  let 키 = props.getProperty('두뇌_URL키');
  let 새로 = false;
  if (!키) {
    키 = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('두뇌_URL키', 키);
    새로 = true;
  }
  let url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) { url = ''; }
  const out = '🔗 강사용 두뇌 링크\n\n'
    + (url ? (url + '?p=두뇌&k=' + 키) : '(웹앱이 아직 배포되지 않았습니다 — 배포 후 다시 실행하세요)\n키: ' + 키)
    + '\n\n' + (새로 ? '· URL키를 새로 만들어 저장했습니다.\n' : '· 기존 URL키를 사용했습니다.\n')
    + '· 이 링크를 받은 사람은 누구나 열 수 있습니다 — 강사에게만 보내세요.\n'
    + '· 링크가 샜다고 판단되면 Script Properties에서 두뇌_URL키 값을 지우고 이 함수를 다시 실행하면 새 링크가 됩니다(옛 링크는 즉시 죽습니다).\n'
    + '· 학생 개인정보는 이 화면에 실리지 않습니다(구조적으로 차단·회귀 테스트 있음).';
  Logger.log(out);
  return out;
}


/* 링크는 alert로 띄우면 복사가 안 된다(유호님이 손으로 옮겨 적게 된다) → 복사 버튼이 있는 모달로 준다. */
function menuBrainLink() {
  const 안내 = 두뇌_링크();
  const m = 안내.match(/https?:\/\/[^\s]+/);
  const url = m ? m[0] : '';
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:-apple-system,sans-serif;font-size:13px;color:#262626;line-height:1.7">' +
    (url
      ? '<p style="margin:0 0 8px">강사에게 보낼 링크입니다. <b>복사</b>를 누르고 메신저로 보내세요.</p>' +
        '<input id="u" readonly value="' + 두뇌_esc_(url) + '" style="width:100%;padding:9px;border:1px solid #E3DACA;border-radius:8px;font-size:12px"/>' +
        '<button onclick="var i=document.getElementById(\'u\');i.select();document.execCommand(\'copy\');this.textContent=\'복사됨 ✓\'" ' +
        'style="margin-top:10px;border:0;background:#E8543F;color:#fff;font-weight:700;padding:9px 16px;border-radius:8px;cursor:pointer">복사</button>'
      : '<p style="margin:0 0 8px;color:#E8543F"><b>웹앱이 아직 배포되지 않았습니다.</b><br/>배포 후 이 메뉴를 다시 누르면 링크가 나옵니다.</p>') +
    '<pre style="white-space:pre-wrap;background:#FAFAF9;border-radius:8px;padding:10px;margin-top:12px;font-size:11.5px;color:#5A5648">'
    + 두뇌_esc_(안내.replace(/https?:\/\/[^\s]+/, '(위 상자에 있습니다)')) + '</pre></div>'
  ).setWidth(520).setHeight(340);
  SpreadsheetApp.getUi().showModalDialog(html, '🧠 강사용 두뇌 링크');
}

