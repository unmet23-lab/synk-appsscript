/* yuhobuilds · AI 직원 매뉴얼 만들기 — 그림과 결과 화면.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/manual/view.js
 * rules.compute()가 낸 값을 그린다. 여기서 추천을 새로 계산하지 않는다.
 * 결과 순서(추천기준 §8): 결과 머리 → 01 써 보기(가게 정보 → 쓰는 방법 둘: 바로 써 보기 / 한 번 넣어 두기, 단계마다 단추)
 *   → 02 한 줄로 맡기는 예 → 설명 분량 → 사람 차례 확인표 → 나에게 의미 있는 것 → 요금제와 신경 쓰지 않아도 되는 것
 *   → 저장·반응·답 바꾸기·출처.
 * 10-06 밤 처음 쓰는 사람 검토(GPT 세 명): 셋 다 「ChatGPT 프로젝트 설정」에서 포기, 결과가 길고 복사 단추가 많아 헷갈림
 *   → 유호님 「사용자입장에서 최대한 쉽게 … 친절해야해」. 할 일을 맨 위에 순서대로, 읽을거리는 아래로.
 * 질문 4(사람 차례)는 처음 열 때 다섯 개를 모두 골라 둔다(bindAny). 고른 적이 있으면 건드리지 않는다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.SynkManualView = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 출처 꼬리표: 공식 · 보도 · SYNK 판단 · 실제 사례(SYNK가 겪은 일)
  const KIND_TEXT = { official: '공식', community: '보도', synk: 'SYNK 판단' };
  let SOURCES = {};

  const sources = () => (Object.keys(SOURCES).length ? SOURCES : ((root.SynkManualContent || {}).SOURCES || {}));
  function badge(src) {
    const all = sources();
    const s = all[src] || all.synk || { kind: 'synk', label: '' };
    const isCase = src === 'case';
    return `<span class="src ${esc(s.kind)}${isCase ? ' case' : ''}" title="${esc(s.label)}">${isCase ? '실제 사례' : KIND_TEXT[s.kind] || ''}</span>`;
  }
  const kindText = (id, s) => (id === 'case' ? '실제 사례' : KIND_TEXT[s.kind] || '');

  // 첫 화면: 펠트 매뉴얼 한 권(버터 표지·검은 책등·체크 배지). synk.im 브랜드 면의 펠트 오브젝트처럼 하나만 세운다.
  function hero() {
    return '<figure class="hero-obj"><img src="assets/hero-manual.webp" width="766" height="1148" alt=""></figure>';
  }
  function marked(title, marks) {
    const t = esc(title);
    for (const m of marks) { const e = esc(m); const i = t.indexOf(e); if (m && i >= 0) return `${t.slice(0, i)}<span class="hl">${e}</span>${t.slice(i + e.length)}`; }
    return t;
  }
  // 구획 머리: 모노 번호와 가는 선, 그 아래 제목(synk.im 구획 머리와 같은 짜임). 스티커는 붙이지 않는다.
  const head = (no, title, id) => `<h2${id ? ` id="${esc(id)}" tabindex="-1"` : ''}><span class="no">${String(no).padStart(2, '0')}</span>${esc(title)}</h2>`;

  // ── 질문 팁의 그림 ──
  function oneline() {
    return '<div class="lanes" role="img" aria-label="매뉴얼이 없으면 매번 긴 요청문을 쓰고, 매뉴얼을 넣어 두면 한 줄로 같은 기준의 결과를 받는다"><div class="lane"><b>매뉴얼 없이</b><div class="flow"><span class="node">긴 요청문</span><span class="arr">+</span><span class="node">이번 일</span><span class="arr">→</span><span class="node">매번 다른 결과</span></div></div><div class="lane"><b>매뉴얼을 넣은 뒤</b><div class="flow"><span class="node">한 줄</span><span class="arr">+</span><span class="node">이번 일</span><span class="arr">→</span><span class="node hot">같은 기준의 결과</span></div></div></div>';
  }
  function finishLadder(answers) {
    const at = { draft: 0, final: 1, ready: 2 }[(answers || {}).finish];
    const cells = [['초안', 'AI'], ['완성본', 'AI'], ['올리기 직전', 'AI']];
    const lis = cells.map(([t, s], i) => `<li${at != null && i <= at ? ' class="on"' : ''}>${t}<small>${s}</small></li>`).join('');
    return `<ol class="ladder" aria-label="AI가 어디까지 할지: 초안, 완성본, 올리기 직전. 마지막 올리기·보내기는 사람 차례">${lis}<li class="human">올리기·보내기<small>사람 차례</small></li></ol><p class="ladder-cap">고른 곳까지 AI가 하고, 마지막 버튼은 사람이 눌러요.</p>`;
  }
  function caseMn() {
    return '<div class="mn" role="img" aria-label="몽골어 끝 문장이 두 뜻으로 읽혀 기계 검수에서 걸렸고, 카드를 저장하라는 한 뜻의 문장으로 고쳤다"><div class="bad"><b lang="mn">Зургаа хадгалаад</b><span>만든 그림 말고 ‘내 사진을 저장해’로도 읽혀요</span><em>걸림</em></div><div class="good"><b lang="mn">Картаа хадгалаад</b><span>‘카드를 저장해’ 한 가지로만 읽혀요</span><em>고침</em></div></div><p class="ladder-cap">SYNK 실제 사례 · 2026-10-03 몽골어 쇼츠의 끝 문장. 검수 방법이 정해져 있어서 올리기 전에 잡았어요.</p>';
  }
  function stopFlow() {
    return '<div class="stopflow" role="img" aria-label="AI는 만들기, 검수, 준비, 보고를 하고, 결제·가입·게시·삭제·내 글 수정 앞에서 멈춰 사람에게 묻는다"><div class="col"><b>AI가 하는 일</b><span>만들기</span><span>검수</span><span>준비</span><span>보고</span></div><div class="pause">멈춤</div><div class="col human"><b>사람 차례</b><span>결제</span><span>가입</span><span>게시</span><span>삭제</span><span>내 글 수정</span></div></div>';
  }
  function names() {
    return '<div class="pool" role="img" aria-label="바로 써 볼 때는 어느 AI든 새 채팅에 붙여 넣고, 계속 쓸 때는 ChatGPT와 Claude는 프로젝트의 지침, Gemini는 Gem의 요청 사항에 넣는다"><div class="p"><b>바로 써 보기</b><div class="row"><span>새 채팅</span><span class="alt">붙여 넣기</span></div></div><div class="p"><b>ChatGPT·Claude</b><div class="row"><span>프로젝트</span><span class="alt">지침</span></div></div><div class="p"><b>Gemini</b><div class="row"><span>Gem</span><span class="alt">요청 사항</span></div></div></div>';
  }
  function visual(key, answers) {
    if (key === 'oneline') return oneline();
    if (key === 'finish') return finishLadder(answers);
    if (key === 'case') return caseMn();
    if (key === 'stop') return stopFlow();
    if (key === 'names') return names();
    return '';
  }
  function aside() { return ''; }

  // 질문 4(사람 차례)를 처음 열면 다섯 개를 모두 골라 둔다. 화면과 답을 함께 맞추고, 왜 골라 뒀는지 한 줄 보여 준다.
  function bindAny(el, ctx) {
    const a = ctx && ctx.answers;
    if (!a || a.stops !== undefined) return;
    if (!el.querySelector('.opts [data-opt="spend"]')) return;
    const step = ((ctx.content || {}).steps || []).find(s => s.id === 'stops');
    if (!step) return;
    a.stops = step.options.map(o => o.id);
    el.querySelectorAll('.opts [data-opt]').forEach(b => b.setAttribute('aria-checked', 'true'));
    const next = el.querySelector('[data-action="next"]');
    if (next) next.disabled = false;
    const picked = el.querySelector('.picked');
    if (picked && step.preset) { const p = picked.querySelector('p'); if (p) p.textContent = step.preset; picked.hidden = false; }
  }

  function summaryText(rec, content) {
    const tips = content.TIPS || {};
    const app = rec.saves.length > 1 ? '쓰는 AI' : rec.saves[0].label;
    const lines = [
      `yuhobuilds · AI 직원 매뉴얼 만들기 (${content.checked} 기준)`,
      rec.headline.title, rec.headline.sub, '',
      '[내 AI 직원 매뉴얼]', rec.manual, '',
      '[쓰는 법 1 · 바로 써 보기]', `${app}의 새 채팅에 위 매뉴얼을 붙여 넣고, 맨 끝에 ‘이번 일: (맡길 일과 자료)’을 적어 보내요. 새 채팅을 열 때마다 다시 붙여요.`, '',
      '[쓰는 법 2 · 한 번 넣어 두기]', ...rec.saves.flatMap(s => [`· ${s.where}`, `  ${s.what}`, ...s.steps.map((x, i) => `  ${i + 1}. ${x.t}`), ...(s.note ? [`  ※ ${s.note.t}`] : [])]), '',
      '[한 줄 명령 예시]', ...rec.commands.map(c => `- ${c}`), '',
      `[요금제] ${rec.plan.v}`, ...rec.plan.yes.map(x => `- 무료로 충분: ${x.t}`), ...rec.plan.roomy.map(x => `- 여유가 되면: ${x.t}`), '',
      '[사람 차례 확인표]', ...rec.checklist.map(c => `[ ] ${c.t}: ${c.d}`), '',
      '[나에게 의미 있는 것]', ...rec.tips.filter(id => tips[id]).flatMap(id => [`· ${tips[id].title}`, ...tips[id].body.map(b => `  ${b}`)]), '',
      '[신경 쓰지 않아도 되는 것]', ...rec.skip.map(x => `- ${x.t}: ${x.d}`), '',
      '다시 보기: https://synk.im/builds/manual/',
    ];
    return lines.join('\n');
  }

  // 팁은 ‘자세히’에서만 펼쳐 둔다(10-06 검토: 첫 카드의 긴 사례가 할 일을 밀어냈다).
  function tipCards(rec, content, layout, h2) {
    const tips = content.TIPS || {};
    const ids = rec.tips.filter(id => tips[id]);
    if (!ids.length) return '';
    return `<section class="block">${h2}<p class="sub">고른 답에 맞춰, 왜 그렇게 하는지와 조심할 점을 골라 드렸어요. 궁금한 것만 펼쳐 보세요.</p><div class="tipcards">${ids.map(id => {
      const t = tips[id];
      return `<details class="tipcard"${layout === 'deep' ? ' open' : ''}><summary>${esc(t.title)}</summary><div class="tipbody">${t.body.map(p => `<p>${esc(p)}</p>`).join('')}<p class="tipsrc">${[...new Set(t.src)].map(badge).join(' ')}</p></div></details>`;
    }).join('')}</div></section>`;
  }

  // ── 01 써 보기: 가게 정보(선택) → 쓰는 방법 둘. 지금 고른 방법은 다시 그려도 남는다(PATH_NOW). ──
  let PATH_NOW = 'try';
  const openLink = s => `<a class="btn soft open" href="${esc(s.open)}" target="_blank" rel="noopener">${esc(s.label)} 열기<span class="ext" aria-hidden="true">↗</span><span class="sr"> (새 창)</span></a>`;
  const step = (k, title, body) => `<li><span class="k" aria-hidden="true">${k}</span><div><p class="t">${title}</p>${body || ''}</div></li>`;
  const copyRow = (id, label, what, done) => `<div class="row"><button type="button" class="btn primary" data-action="copy:${id}" data-what="${esc(what)}" data-done="${esc(done)}">${esc(label)}</button><span class="status" role="status"></span></div>`;
  function meForm(list) {
    const field = f => `<label class="${f.multi ? 'wide' : ''}"><span>${esc(f.label)}</span>${f.multi ? `<textarea data-me-field="${f.id}" rows="2" maxlength="${f.max}" placeholder="${esc(f.ph)}"></textarea>` : `<input type="text" data-me-field="${f.id}" maxlength="${f.max}" placeholder="${esc(f.ph)}" autocomplete="off">`}</label>`;
    const first = list.filter(f => !f.more), more = list.filter(f => f.more);
    const moreBox = more.length ? `<details class="me-more"><summary><b>더 적기</b><span>${esc(more.map(f => f.short || f.label).join(' · '))}</span></summary><div class="me-grid">${more.map(field).join('')}</div></details>` : '';
    return `<div class="me" data-me><p class="me-head"><b>가게 정보 넣기</b><span>선택 · 건너뛰어도 돼요</span></p><p class="me-sub">적는 대로 아래에서 복사할 글에 들어가요. 넣을수록 AI가 우리 가게답게, 더 구체적으로 써요.</p><div class="me-grid">${first.map(field).join('')}</div>${moreBox}<p class="me-note">적은 내용은 서버로 보내지 않고 저장하지도 않아요. 이 화면을 닫으면 사라지고, 결과 링크에도 들어가지 않아요.</p></div>`;
  }
  function usePanel(rec, ctx, H) {
    const { rules, layout } = ctx;
    const quick = layout === 'quick', deep = layout === 'deep';
    const multi = rec.saves.length > 1;
    const app = multi ? '쓰는 AI' : rec.saves[0].label;
    const appO = rules && rules.josa ? rules.josa(app, '을', '를') : `${app}를`;
    const P = PATH_NOW;
    const tab = (id, t, s) => `<button type="button" role="tab" id="tab-${id}" aria-controls="path-${id}" aria-selected="${P === id}"${P === id ? '' : ' tabindex="-1"'} data-path="${id}"><b>${t}</b><small>${s}</small></button>`;
    const tabs = `<div class="pathseg" role="tablist" aria-label="쓰는 방법">${tab('try', '바로 써 보기', '새 채팅에 붙여 넣기')}${tab('keep', '한 번 넣어 두기', '다음부터 한 줄로')}</div>`;

    const tryPanel = `<div class="path" id="path-try" role="tabpanel" aria-labelledby="tab-try" data-panel="try"${P === 'try' ? '' : ' hidden'}><ol class="usesteps">${
      // 10-06 검토 2차: 셋 모두 「붙여 넣은 긴 글 끝(‘이번 일:’)을 휴대폰에서 고치기 어렵다」 → 맡길 일을 여기서 적어 함께 복사
      step(1, '오늘 맡길 일을 적고 복사해요', `<label class="task"><span>오늘 맡길 일 · 선택</span><textarea data-task rows="3" maxlength="600" placeholder="예: ${esc(rec.task.sample)}"></textarea></label><p class="d">적은 일은 매뉴얼 끝 ‘이번 일:’ 뒤에 붙어 함께 복사돼요. 비워 두면 AI가 무엇을 맡길지 먼저 물어봐요.</p>${copyRow('trial', `${app}에 붙일 글 복사`, `${app}에 붙일 글`, `복사했어요. 이제 ${appO} 열어 새 채팅에 붙여 넣고 보내세요.`)}`)
    }${step(2, `${esc(appO)} 열어요`, `<p class="d">앱이 있으면 앱을 열어도 돼요.</p><div class="row opens">${rec.saves.map(openLink).join('')}</div>`)
    }${step(3, '새 채팅에 붙여 넣고 보내요', '<p class="d">입력칸을 길게 눌러 ‘붙여넣기’를 고르세요(컴퓨터는 Ctrl+V). 사진이나 파일이 있으면 함께 올리고 보내요.</p>')
    }</ol><p class="path-note">새 채팅을 열 때마다 다시 붙여야 해요. 결과가 마음에 들면 ‘한 번 넣어 두기’로 저장하세요. 다음부터는 한 줄만 보내면 돼요.</p><button type="button" class="btn ghost goto" data-goto-path="keep">한 번 넣어 두기 보기</button></div>`;

    const keepDone = multi ? '복사했어요. 이제 쓰는 AI의 지침 칸에 붙여 넣으세요.' : `복사했어요. 이제 ${rec.saves[0].where} 칸에 붙여 넣으세요.`;
    const copyStep = step(1, '매뉴얼을 복사해요', copyRow('manual', '매뉴얼 복사', '매뉴얼', keepDone));
    // 그림 안내(10-07): 그 단계 아래에 실제 화면. 누르면 원래 크기로 열린다.
    const figs = (s, i) => ((s.guide && s.guide.figs) || []).filter(f => f.step === i).map(f => `<figure class="guide-shot"><a href="${esc(f.src)}" target="_blank" rel="noopener"><img src="${esc(f.src)}" width="${f.w}" height="${f.h}" loading="lazy" alt="${esc(f.alt)}"></a><figcaption>${esc(f.cap)}</figcaption></figure>`).join('');
    const guideNote = s => (s.guide ? `<p class="guide-note">그림은 웹 ${esc(s.label)}를 휴대폰 크기로 찍은 화면이에요(${esc(s.guide.shot.replace(/-/g, '.'))}). 앱이나 화면 설정에 따라 색과 배치가 조금 다를 수 있어요. 그림을 누르면 크게 보여요.</p>` : '');
    const saveSteps = s => s.steps.map((x, i) => step(i + 2, esc(x.t), `${i === 0 ? `<div class="row opens">${openLink(s)}</div>` : ''}${figs(s, i)}`)).join('');
    let keepBody;
    if (!multi) {
      const s = rec.saves[0];
      keepBody = `<p class="what">${esc(s.what)}</p><ol class="usesteps">${copyStep}${saveSteps(s)}</ol>${guideNote(s)}<p class="path-note">잘 들어갔는지 보려면 그 ${esc(s.place)}의 새 채팅에서 “이 매뉴얼에서 내가 허락해야 하는 일을 말해 줘”라고 물어보세요. 사람 차례가 그대로 나오면 잘 들어간 거예요.</p>${s.note && !quick ? `<p class="path-note">${esc(s.note.t)}</p>` : ''}<p class="path-src">메뉴 순서는 ${esc(s.label)} 공식 도움말 기준이에요${badge(s.steps[0].src)} 화면 언어나 업데이트에 따라 이름이 조금 다를 수 있어요.</p>`;
    } else {
      keepBody = `<p class="what">ChatGPT·Claude는 ‘프로젝트’, Gemini는 ‘Gem’이라는 일 전용 공간이 있어요. 그 공간의 지침 칸에 매뉴얼을 넣어 두면, 새 채팅을 열 때마다 AI가 먼저 읽어요.</p><ol class="usesteps">${copyStep}</ol>${rec.saves.map((s, j) => `<details class="appbox"${j === 0 ? ' open' : ''}><summary>${esc(s.label)}에 넣기</summary><ol class="usesteps">${saveSteps(s)}</ol>${guideNote(s)}</details>`).join('')}<p class="path-src">메뉴 순서는 각 AI의 공식 도움말 기준이에요${badge(rec.saves[0].steps[0].src)} 화면 언어나 업데이트에 따라 이름이 조금 다를 수 있어요.</p>`;
    }
    const keepPanel = `<div class="path" id="path-keep" role="tabpanel" aria-labelledby="tab-keep" data-panel="keep"${P === 'keep' ? '' : ' hidden'}>${keepBody}</div>`;

    const inapp = '<p class="inapp" hidden>인스타그램 같은 앱 안에서 열었어요. 복사가 안 되면 오른쪽 위 메뉴(⋯)에서 ‘외부 브라우저로 열기’를 눌러 주세요.</p>';
    const missing = rec.missing.length ? `<p class="manual-note">${esc(rec.task.short)}에서 자주 필요한 검수 중 ‘${esc(rec.missing.join('’, ‘'))}’은 고르지 않으셨어요. 필요하면 아래 ‘답 바꿔 보기’에서 더하세요.</p>` : '';
    const where = multi ? '쓰는 AI의 지침 칸이나 새 채팅' : `${rec.saves[0].where} 칸이나 새 채팅`;
    // 컴퓨터에서 이어 하기(10-06 검토 2차: 「주로 컴퓨터에서 쓰는데 옮기는 단추가 한참 뒤에 있어요」)
    const pc = '<div class="pc"><p>컴퓨터에서 이어 하려면 이 페이지 링크를 나에게 보내 두세요. 고른 답으로 같은 매뉴얼이 다시 열려요. 가게 정보와 맡길 일은 링크에 들어가지 않아요.</p><div class="row"><button type="button" class="btn soft" data-action="share" data-done="링크를 복사했어요. 나에게 보내 두고 컴퓨터에서 여세요. 가게 정보는 그곳에서 다시 적어 주세요.">이 페이지 링크 복사</button><span class="status" role="status"></span></div></div>';
    // 매뉴얼 전문은 접어 둔다(읽고 싶은 사람만). 인쇄에서는 잘리지 않는 전문이 따로 나온다.
    const peek = `<details class="peek"${deep ? ' open' : ''}><summary>복사할 매뉴얼 전문 보기</summary><div class="copybox main"><label for="t-manual">내 AI 직원 매뉴얼 · ${esc(where)}에 그대로</label><textarea id="t-manual" readonly spellcheck="false">${esc(rec.manual)}</textarea></div></details><pre class="manual-print" aria-hidden="true">${esc(rec.manual)}</pre>`;
    return `<section class="block use">${H(`${app}에서 써 보기`, 'use-h')}<p class="sub">방법은 두 가지예요. 처음이라면 ‘바로 써 보기’로 결과부터 보고, 마음에 들면 ‘한 번 넣어 두기’로 저장하세요. 둘 다 무료 요금제로 돼요.</p>${meForm(rec.me || (rules && rules.ME) || [])}${inapp}<div class="paths">${tabs}${tryPanel}${keepPanel}</div>${pc}${missing}${peek}</section>`;
  }

  function result(ctx) {
    const { rec, layout, plan, checks, feedbackGiven, content } = ctx;
    SOURCES = content.SOURCES;
    const deep = layout === 'deep', quick = layout === 'quick';
    const because = plan && plan.selected && plan.selected.id === layout
      ? (plan.reasons.includes('feedback.too_much') ? '지난번에 ‘너무 많아요’라고 하셔서 간단히 보여 드려요. 이 기기에 저장된 답을 기준으로 했어요.' : plan.reasons.includes('feedback.want_more') ? '지난번에 ‘더 자세히’를 고르셔서 자세히 보여 드려요. 이 기기에 저장된 답을 기준으로 했어요.' : '')
      : '';
    const seg = [['quick', '간단히'], ['guided', '기본'], ['deep', '자세히']].map(([id, t]) => `<button type="button" class="glass chip" role="radio" aria-checked="${id === layout}" data-action="layout:${id}">${t}</button>`).join('');
    const warns = rec.warns.map(x => `<div class="warn">${esc(x.t)}${badge(x.src)}</div>`).join('');
    let n = 0;
    const H = (title, id) => head(++n, title, id);
    const multi = rec.saves.length > 1;

    const use = usePanel(rec, ctx, H);
    const cmds = `<section class="block">${H('한 줄로 맡기는 예')}<p class="sub">써 볼 때는 ‘오늘 맡길 일’ 칸에, 넣어 둔 뒤에는 새 채팅에 이렇게 한 줄로 적어요. 소식·사진·문의 같은 자료는 함께 보내요.</p><ol class="cmdlist plainsay">${rec.commands.map(c => `<li><p class="say">“${esc(c)}”</p></li>`).join('')}</ol></section>`;
    // 10-06 검토 3차: 「아래까지 확인해야 준비가 끝나는 줄 알고 읽게 돼요」 → 쓰는 데 필요한 것은 여기까지라고 밝힌다
    const doneLine = '<p class="doneline"><b>여기까지면 바로 쓸 수 있어요.</b><span>아래는 궁금할 때 읽는 설명이에요.</span></p>';
    const layoutRow = `<div class="layout"><span>아래 설명 분량</span><div class="seg" role="radiogroup" aria-label="설명 분량">${seg}</div>${because ? `<p class="because">${esc(because)}</p>` : ''}</div>`;

    const checklist = `<section class="block">${H('사람 차례 확인표')}<p class="sub">지금 체크할 필요는 없어요. AI가 일하다 멈추고 물어볼 때 이 표를 보며 정하세요. 체크한 내용은 이 기기에 남아요.</p><ul class="checks">${rec.checklist.map(c => `<li><label><input type="checkbox" data-check="${esc(c.id)}"${checks[c.id] ? ' checked' : ''}><span><b>${esc(c.t)}</b><small>${esc(c.d)}</small></span></label></li>`).join('')}</ul></section>`;

    const tipsHtml = tipCards(rec, content, layout, H('나에게 의미 있는 것'));
    // 요금제: 무료로 되는 것을 먼저, 유료(에이전트)는 접어 둔다(10-06 검토: 「‘올리기 직전까지’는 돈 내야 하나?」).
    const roomy = rec.plan.roomy.length ? `<details class="paid"${deep ? ' open' : ''}><summary>여유가 되면 · AI가 화면을 직접 누르게 하고 싶다면</summary><ul class="why npu">${rec.plan.roomy.map(x => `<li>${esc(x.t)}${badge(x.src)}</li>`).join('')}</ul></details>` : '';
    const planBox = `<div class="spec key"><p class="k">요금제</p><p class="v small">${esc(rec.plan.v)}</p><ul class="why npu">${rec.plan.yes.map(x => `<li><b class="yes">무료로 충분</b> ${esc(x.t)}${badge(x.src)}</li>`).join('')}</ul>${roomy}</div>`;
    const skip = `<section class="block">${H(quick ? '요금제' : '요금제와 신경 쓰지 않아도 되는 것')}${quick ? '' : '<p class="sub">고른 답 기준으로 시간과 돈을 아껴도 되는 곳이에요.</p>'}${planBox}${quick ? '' : `<ul class="why npu skip">${rec.skip.map(x => `<li><b class="no">${esc(x.t)}</b> ${esc(x.d)}${badge(x.src)}</li>`).join('')}</ul>`}</section>`;

    const saveRow = `<section class="block">${H('저장하고 다시 보기')}<div class="take"><button type="button" class="btn soft" data-action="share" data-done="링크를 복사했어요. 이 링크로 언제든 다시 열 수 있어요. 가게 정보는 링크에 들어가지 않으니, 다른 기기에서는 다시 적어 주세요.">이 페이지 링크 복사</button><button type="button" class="btn soft" data-action="print">PDF로 저장·인쇄</button><span class="status" role="status" style="flex-basis:100%"></span></div><p class="hint">AI에 붙일 글은 위 01에서 복사하세요. 컴퓨터에서 이어 하려면 ‘이 페이지 링크’를 나에게 보내 두세요. 인스타그램 안에서 열었다면 오른쪽 위 메뉴에서 ‘외부 브라우저로 열기’를 누르면 복사와 저장이 더 잘 돼요.</p></section>`;

    const fbMsg = { helpful: '고마워요. 다음에도 이렇게 보여 드릴게요.', too_much: '알겠어요. 다음에 이 기기에서 열면 간단히 보여 드릴게요.', want_more: '알겠어요. 다음에 이 기기에서 열면 자세히 보여 드릴게요.', not_fit: '알려 주셔서 고마워요. 어떤 점이 안 맞았는지 yuhobuilds 댓글이나 DM으로 알려 주시면 다음 판에 반영할게요.' };
    const fb = `<section class="block">${H('이 매뉴얼, 도움이 됐나요?')}<div class="fb" role="group" aria-label="결과에 대한 반응">${[['helpful', '도움이 됐어요'], ['too_much', '너무 많아요'], ['want_more', '더 자세히 알고 싶어요'], ['not_fit', '나와 안 맞아요']].map(([id, t]) => `<button type="button" class="glass chip" aria-pressed="${feedbackGiven === id}" data-action="feedback:${id}"${feedbackGiven ? ' disabled' : ''}>${t}</button>`).join('')}</div><p class="fbnote">${feedbackGiven ? esc(fbMsg[feedbackGiven]) : '답은 이 기기에만 저장되고, 다음에 이 도구를 열 때 보여 주는 분량에 반영돼요.'}</p></section>`;

    const used = new Set(rec.sourcesUsed);
    const tipBank = content.TIPS || {};
    for (const id of rec.tips) for (const s of (tipBank[id] || {}).src || []) used.add(s);
    for (const x of rec.skip) used.add(x.src);
    const srcList = Object.entries(content.SOURCES).filter(([id]) => used.has(id) || id === 'synk' || id === 'case');
    const sourcesBox = `<details class="sources"${deep ? ' open' : ''}><summary>출처와 기준 (${esc(content.checked)} 확인)</summary><ul>${srcList.map(([id, s]) => `<li><span class="src ${esc(s.kind)}${id === 'case' ? ' case' : ''}">${kindText(id, s)}</span> ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ul><p style="font-size:14px;color:var(--muted)">적은 가게 정보는 서버로 보내지 않고 저장하지도 않아요. 매뉴얼은 이 화면 안에서 규칙으로 만들고, 실제 일은 여러분이 쓰는 AI에서 해요. AI 앱의 메뉴 이름은 화면 언어와 업데이트에 따라 조금 다를 수 있어요.</p></details>`;

    const editable = content.steps.filter(s => !s.when || s.when(ctx.answers)).map(s => `<button type="button" class="glass chip" data-action="edit:${esc(s.id)}">${esc(s.short || s.eyebrow || s.title)}</button>`).join('');
    const edit = `<section class="block no-print">${H('답 바꿔 보기')}<p class="sub">하나만 바꿔도 매뉴얼과 한 줄 명령이 다시 만들어져요. 다른 일의 매뉴얼은 ‘맡길 일’을 바꿔 하나 더 만들면 돼요.</p><div class="take">${editable}</div></section>`;

    // 하단 바: 지금 고른 방법의 복사 + AI 열기(여러 AI면 쓰는 법으로 올라가기)
    const dockCopy = PATH_NOW === 'keep' ? ['copy:manual', '매뉴얼 복사'] : ['copy:trial', '붙일 글 복사'];
    const dock = `<div class="dock no-print" role="group" aria-label="바로 쓰기"><button type="button" class="btn primary" data-proxy="${dockCopy[0]}" data-dock-copy>${dockCopy[1]}</button>${multi ? '<button type="button" class="btn soft" data-scroll="use-h">쓰는 법 보기</button>' : openLink(rec.saves[0])}</div>`;

    const html = `<article class="result"><header class="r-top${rec.warns.length ? '' : ' cheer'}"><p class="rec"><span class="stamp">${esc(content.checked.replace(/-/g, '.'))} 기준</span><span>${esc(content.series)} · 내 AI 직원 매뉴얼</span></p><h1 id="q" tabindex="-1">${marked(rec.headline.title, [rec.headline.mark])}</h1><p>${esc(rec.headline.sub)}</p><ul class="facts" aria-label="매뉴얼 요약">${rec.facts.map(x => `<li>${esc(x)}</li>`).join('')}</ul><figure class="shot" aria-hidden="true"><img src="assets/hero-manual.webp" width="766" height="1148" alt=""></figure></header>${warns}${use}${cmds}${doneLine}${layoutRow}${checklist}${tipsHtml}${skip}${saveRow}${fb}${edit}${sourcesBox}<div class="nav no-print"><button type="button" class="btn ghost" data-action="restart">처음부터 다시</button></div>${dock}</article>`;
    const texts = { manual: rec.manual, trial: rec.trial, all: summaryText(rec, content) };
    rec.commands.forEach((c, i) => { texts[`cmd${i}`] = c; });
    return { html, texts };
  }

  // 내 정보와 오늘 맡길 일은 이 변수에만 둔다(저장소·네트워크 없음). 답을 바꿔 결과를 다시 그려도 화면을 닫기 전까지는 남는다.
  let ME_NOW = {};
  let TASK_NOW = '';
  const cleanTask = v => String(v || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 600);
  function bindResult(el, ctx) {
    const ua = (root.navigator && root.navigator.userAgent) || '';
    if (/Instagram|FBAN|FBAV|KAKAOTALK|NAVER\(inapp|Line\/|DaumApps|everytimeApp/i.test(ua)) { const n = el.querySelector('.inapp'); if (n) n.hidden = false; }

    // 쓰는 방법 둘(탭). 고른 방법에 맞춰 하단 바의 복사 단추도 바꾼다.
    const tabs = [...el.querySelectorAll('[data-path]')];
    const dockCopy = el.querySelector('[data-dock-copy]');
    const setPath = (id, focus) => {
      PATH_NOW = id;
      tabs.forEach(t => {
        const on = t.dataset.path === id;
        t.setAttribute('aria-selected', String(on));
        if (on) t.removeAttribute('tabindex'); else t.setAttribute('tabindex', '-1');
        if (on && focus) t.focus();
      });
      el.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== id; });
      if (dockCopy) { dockCopy.dataset.proxy = id === 'keep' ? 'copy:manual' : 'copy:trial'; dockCopy.textContent = id === 'keep' ? '매뉴얼 복사' : '붙일 글 복사'; }
    };
    tabs.forEach(t => {
      t.addEventListener('click', () => setPath(t.dataset.path, false));
      t.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const i = tabs.indexOf(t);
        const j = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        setPath(tabs[j].dataset.path, true);
      });
    });
    el.querySelectorAll('[data-goto-path]').forEach(b => b.addEventListener('click', () => {
      setPath(b.dataset.gotoPath, true);
      const tl = el.querySelector('[role="tablist"]');
      if (tl) tl.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }));
    el.querySelectorAll('[data-scroll]').forEach(b => b.addEventListener('click', () => {
      const t = el.querySelector(`#${b.dataset.scroll}`);
      if (t) { t.scrollIntoView({ block: 'start', behavior: 'smooth' }); t.focus({ preventScroll: true }); }
    }));

    const box = el.querySelector('[data-me]');
    if (!box || !ctx || !ctx.rules) return;
    const fields = [...box.querySelectorAll('[data-me-field]')];
    fields.forEach(f => { const v = ME_NOW[f.getAttribute('data-me-field')]; if (typeof v === 'string') f.value = v; });
    const more = box.querySelector('.me-more');
    if (more && [...more.querySelectorAll('[data-me-field]')].some(f => f.value.trim())) more.open = true;
    const taskBox = el.querySelector('[data-task]');
    if (taskBox && TASK_NOW) taskBox.value = TASK_NOW;
    // 복사한 뒤 바꾸면 그 단추 아래에만 다시 복사하라고 알린다. 넣은 것은 완료 문장에도 밝힌다.
    const copyBtns = [...el.querySelectorAll('[data-action="copy:trial"],[data-action="copy:manual"]')];
    const baseDone = new Map(copyBtns.map(b => [b, b.dataset.done || '']));
    const copied = new Set();
    copyBtns.forEach(b => b.addEventListener('click', () => { copied.add(b); }));
    const apply = from => {
      const v = {};
      fields.forEach(f => { v[f.getAttribute('data-me-field')] = f.value; });
      ME_NOW = v;
      TASK_NOW = taskBox ? taskBox.value : TASK_NOW;
      const rec = ctx.rules.compute(ctx.answers, v);
      const task = cleanTask(TASK_NOW);
      const ta = el.querySelector('#t-manual');
      if (ta) ta.value = rec.manual;
      const pre = el.querySelector('.manual-print');
      if (pre) pre.textContent = rec.manual;
      if (el._texts) { el._texts.manual = rec.manual; el._texts.trial = rec.trial + task; el._texts.all = summaryText(rec, ctx.content); }
      const meOn = Object.keys(ctx.rules.cleanMe(v)).length > 0;
      copyBtns.forEach(b => {
        const isTrial = b.dataset.action === 'copy:trial';
        const parts = [...(meOn ? ['가게 정보'] : []), ...(isTrial && task ? ['오늘 맡길 일'] : [])];
        b.dataset.done = parts.length ? baseDone.get(b).replace('복사했어요.', `${parts.join('와 ')}까지 넣어 복사했어요.`) : baseDone.get(b);
      });
      if (from) copied.forEach(b => {
        if (from === 'task' && b.dataset.action !== 'copy:trial') return;
        const st = b.parentElement.querySelector('.status');
        if (st) st.textContent = from === 'task' ? '맡길 일을 바꿨어요. 다시 복사해 주세요.' : '가게 정보를 바꿨어요. 다시 복사해 주세요.';
        copied.delete(b);
      });
    };
    if (fields.some(f => f.value.trim()) || cleanTask(TASK_NOW)) apply();
    if (taskBox) taskBox.addEventListener('input', () => apply('task'));
    box.addEventListener('input', () => apply('me'));
  }

  return Object.freeze({ hero, visual, aside, bindAny, bindResult, result, summaryText });
});
