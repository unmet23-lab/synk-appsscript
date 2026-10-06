/* yuhobuilds · AI 직원 매뉴얼 만들기 — 그림과 결과 화면.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/manual/view.js
 * rules.compute()가 낸 값을 그린다. 여기서 추천을 새로 계산하지 않는다.
 * 결과 순서(추천기준 §8): 결과 머리 → 내 AI 직원 매뉴얼(요청문 창 하나)·한 줄 명령 → 매뉴얼을 넣는 곳·요금제
 *   → 사람 차례 확인표 → 나에게 의미 있는 것 → 신경 쓰지 않아도 되는 것 → 저장·반응·답 바꾸기·출처.
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
  const head = (no, title) => `<h2><span class="no">${String(no).padStart(2, '0')}</span>${esc(title)}</h2>`;

  // ── 질문 팁의 그림 ──
  function oneline() {
    return '<div class="lanes" role="img" aria-label="매뉴얼이 없으면 매번 긴 요청문을 쓰고, 매뉴얼을 깔아 두면 한 줄로 같은 기준의 결과를 받는다"><div class="lane"><b>매뉴얼 없이</b><div class="flow"><span class="node">긴 요청문</span><span class="arr">+</span><span class="node">이번 일</span><span class="arr">→</span><span class="node">매번 다른 결과</span></div></div><div class="lane"><b>매뉴얼을 깐 뒤</b><div class="flow"><span class="node">한 줄</span><span class="arr">+</span><span class="node">이번 일</span><span class="arr">→</span><span class="node hot">같은 기준의 결과</span></div></div></div>';
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
    return '<div class="pool" role="img" aria-label="ChatGPT와 Claude는 프로젝트의 지침, Gemini는 Gem의 요청 사항에 매뉴얼을 넣는다"><div class="p"><b>ChatGPT·Claude</b><div class="row"><span>프로젝트</span><span class="alt">지침</span></div></div><div class="p"><b>Gemini</b><div class="row"><span>Gem</span><span class="alt">요청 사항</span></div></div></div>';
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

  // 인쇄하면 글 상자가 잘리므로, 요청문 창에는 인쇄에서만 보이는 전문을 함께 둔다(화면 낭독기에는 숨김).
  function copyBox(id, label, text, button, primary, rows) {
    const printCopy = primary ? `<pre class="manual-print" aria-hidden="true">${esc(text)}</pre>` : '';
    return `<div class="copybox${primary ? ' main' : ''}"><label for="t-${id}">${esc(label)}</label><textarea id="t-${id}" readonly spellcheck="false"${rows ? ` style="min-height:${rows}px"` : ''}>${esc(text)}</textarea>${printCopy}<div class="row"><button type="button" class="btn ${primary ? 'primary' : 'soft'}" data-action="copy:${id}">${esc(button)}</button><span class="status" role="status"></span></div></div>`;
  }

  function summaryText(rec, content) {
    const tips = content.TIPS || {};
    const lines = [
      `yuhobuilds · AI 직원 매뉴얼 만들기 (${content.checked} 기준)`,
      rec.headline.title, rec.headline.sub, '',
      '[내 AI 직원 매뉴얼]', rec.manual, '',
      '[한 줄 명령 예시]', ...rec.commands.map(c => `- ${c}`), '',
      '[매뉴얼을 넣는 곳]', ...rec.saves.flatMap(s => [`· ${s.where}`, ...s.steps.map((x, i) => `  ${i + 1}. ${x.t}`), ...(s.note ? [`  ※ ${s.note.t}`] : [])]), '',
      `[요금제] ${rec.plan.v}`, ...rec.plan.yes.map(x => `- 무료로 충분: ${x.t}`), ...rec.plan.roomy.map(x => `- 여유가 되면: ${x.t}`), '',
      '[사람 차례 확인표]', ...rec.checklist.map(c => `[ ] ${c.t}: ${c.d}`), '',
      '[나에게 의미 있는 것]', ...rec.tips.filter(id => tips[id]).flatMap(id => [`· ${tips[id].title}`, ...tips[id].body.map(b => `  ${b}`)]), '',
      '[신경 쓰지 않아도 되는 것]', ...rec.skip.map(x => `- ${x.t}: ${x.d}`), '',
      '다시 보기: https://synk.im/builds/manual/',
    ];
    return lines.join('\n');
  }

  function tipCards(rec, content, layout, h2) {
    const tips = content.TIPS || {};
    const ids = rec.tips.filter(id => tips[id]);
    if (!ids.length) return '';
    return `<section class="block">${h2}<p class="sub">고른 답에 맞춰, 왜 그렇게 하는지와 조심할 점을 골라 드렸어요.</p><div class="tipcards">${ids.map((id, i) => {
      const t = tips[id];
      const open = layout === 'deep' || (layout === 'guided' && i === 0);
      return `<details class="tipcard"${open ? ' open' : ''}><summary>${esc(t.title)}</summary><div class="tipbody">${t.body.map(p => `<p>${esc(p)}</p>`).join('')}<p class="tipsrc">${[...new Set(t.src)].map(badge).join(' ')}</p></div></details>`;
    }).join('')}</div></section>`;
  }

  function result(ctx) {
    const { rec, layout, plan, checks, feedbackGiven, content, rules } = ctx;
    SOURCES = content.SOURCES;
    const deep = layout === 'deep', quick = layout === 'quick';
    const because = plan && plan.selected && plan.selected.id === layout
      ? (plan.reasons.includes('feedback.too_much') ? '지난번에 ‘너무 많아요’라고 하셔서 간단히 보여 드려요. 이 기기에 저장된 답을 기준으로 했어요.' : plan.reasons.includes('feedback.want_more') ? '지난번에 ‘더 자세히’를 고르셔서 자세히 보여 드려요. 이 기기에 저장된 답을 기준으로 했어요.' : '')
      : '';
    const seg = [['quick', '간단히'], ['guided', '기본'], ['deep', '자세히']].map(([id, t]) => `<button type="button" class="glass chip" role="radio" aria-checked="${id === layout}" data-action="layout:${id}">${t}</button>`).join('');
    const warns = rec.warns.map(x => `<div class="warn">${esc(x.t)}${badge(x.src)}</div>`).join('');
    let n = 0;
    const H = (title, stk, r) => head(++n, title, stk, r);

    const where = rec.saves.length > 1 ? '쓰는 AI의 지침 칸' : rec.saves[0].where;
    const missing = rec.missing.length ? `<p class="manual-note">${esc(rec.task.short)}에서 자주 필요한 검수 중 ‘${esc(rec.missing.join('’, ‘'))}’은 고르지 않으셨어요. 필요하면 아래 ‘답 바꿔 보기’에서 더하세요.</p>` : '';
    const cmds = `<div class="cmds"><p>깔아 둔 뒤에는 이렇게 한 줄로</p><ol class="cmdlist">${rec.commands.map((c, i) => `<li><p class="say">“${esc(c)}”</p><div class="row"><button type="button" class="btn soft" data-action="copy:cmd${i}" data-what="한 줄 명령">복사</button><span class="status" role="status"></span></div></li>`).join('')}</ol></div>`;
    // 내 정보(선택): 적는 대로 아래 매뉴얼에 들어간다. 저장·전송 없이 이 화면 안에서만(bindResult). 결과 링크에도 들어가지 않는다.
    const meForm = `<div class="me" data-me><p class="me-head"><b>내 정보 넣기</b><span>선택 · 적는 대로 아래 매뉴얼에 들어가요</span></p><div class="me-grid">${rules && rules.ME ? rules.ME.map(f => `<label class="${f.multi ? 'wide' : ''}"><span>${esc(f.label)}</span>${f.multi ? `<textarea data-me-field="${f.id}" rows="2" maxlength="${f.max}" placeholder="${esc(f.ph)}"></textarea>` : `<input type="text" data-me-field="${f.id}" maxlength="${f.max}" placeholder="${esc(f.ph)}" autocomplete="off">`}</label>`).join('') : ''}</div><p class="me-note">적은 내용은 서버로 보내지 않고 저장하지도 않아요. 이 화면을 닫으면 사라지고, 결과 링크에도 들어가지 않아요.</p></div>`;
    const inapp = '<p class="inapp" hidden>인스타그램 같은 앱 안에서 열었어요. 복사가 안 되면 오른쪽 위 메뉴(⋯)에서 ‘외부 브라우저로 열기’를 눌러 주세요.</p>';
    const take = `<section class="block">${H('내 AI 직원 매뉴얼', 'book', 6)}<p class="sub">${esc(where)}에 이 글을 통째로 붙여 넣으세요. 가게·브랜드 정보를 적으면 내 일에 더 맞춰져요.</p>${meForm}${inapp}${copyBox('manual', '내 AI 직원 매뉴얼 · 지침 칸에 그대로 붙여 넣기', rec.manual, '매뉴얼 복사', true)}${missing}${cmds}</section>`;

    const saveBoxes = rec.saves.map(s => `<div class="formbox"><p class="eyebrow">매뉴얼을 넣는 곳 · ${esc(s.label)}</p><h2>${esc(s.where)}</h2><ol class="plain">${s.steps.map(x => `<li>${esc(x.t)}${badge(x.src)}</li>`).join('')}</ol>${s.note && !quick ? `<p class="s" style="font-size:14px;color:var(--muted);margin:8px 0 0">${esc(s.note.t)}${badge(s.note.src)}</p>` : ''}</div>`).join('');
    const planBox = `<div class="spec key"><p class="k">요금제</p><p class="v small">${esc(rec.plan.v)}</p><ul class="why npu">${rec.plan.yes.map(x => `<li><b class="yes">무료로 충분</b> ${esc(x.t)}${badge(x.src)}</li>`).join('')}${quick ? '' : rec.plan.roomy.map(x => `<li><b class="no">여유가 되면</b> ${esc(x.t)}${badge(x.src)}</li>`).join('')}</ul></div>`;
    const save = `<section class="block">${H('매뉴얼을 넣는 곳', 'check', -6)}<p class="sub">고른 AI의 실제 메뉴 순서예요. 화면 언어에 따라 영어로 보일 수 있어 영어 이름을 함께 적었어요.</p>${saveBoxes}${planBox}</section>`;

    const checklist = `<section class="block">${H('사람 차례 확인표', 'person', 7)}<p class="sub">AI가 멈추고 물어보면 여기서 확인하고 정해요. 체크한 내용은 이 기기에 남아요.</p><ul class="checks">${rec.checklist.map(c => `<li><label><input type="checkbox" data-check="${esc(c.id)}"${checks[c.id] ? ' checked' : ''}><span><b>${esc(c.t)}</b><small>${esc(c.d)}</small></span></label></li>`).join('')}</ul></section>`;

    const tipsHtml = tipCards(rec, content, layout, H('나에게 의미 있는 것', 'search', -7));
    const skip = quick ? '' : `<section class="block">${H('신경 쓰지 않아도 되는 것')}<p class="sub">고른 답 기준으로 시간과 돈을 아껴도 되는 곳이에요.</p><ul class="why npu">${rec.skip.map(x => `<li><b class="no">${esc(x.t)}</b> ${esc(x.d)}${badge(x.src)}</li>`).join('')}</ul></section>`;

    const saveRow = `<section class="block">${H('저장하고 다시 보기')}<div class="take"><button type="button" class="btn soft" data-action="share">내 결과 링크 복사</button><button type="button" class="btn soft" data-action="copy:all">결과 전체 복사</button><button type="button" class="btn soft" data-action="print">PDF로 저장·인쇄</button><span class="status" role="status" style="flex-basis:100%"></span></div><p class="hint">인스타그램 안에서 열었다면 오른쪽 위 메뉴에서 ‘외부 브라우저로 열기’를 누르면 복사와 저장이 더 잘 돼요.</p></section>`;

    const fbMsg = { helpful: '고마워요. 다음에도 이렇게 보여 드릴게요.', too_much: '알겠어요. 다음에 이 기기에서 열면 간단히 보여 드릴게요.', want_more: '알겠어요. 다음에 이 기기에서 열면 자세히 보여 드릴게요.', not_fit: '알려 주셔서 고마워요. 어떤 점이 안 맞았는지 yuhobuilds 댓글이나 DM으로 알려 주시면 다음 판에 반영할게요.' };
    const fb = `<section class="block">${H('이 매뉴얼, 도움이 됐나요?')}<div class="fb" role="group" aria-label="결과에 대한 반응">${[['helpful', '도움이 됐어요'], ['too_much', '너무 많아요'], ['want_more', '더 자세히 알고 싶어요'], ['not_fit', '나와 안 맞아요']].map(([id, t]) => `<button type="button" class="glass chip" aria-pressed="${feedbackGiven === id}" data-action="feedback:${id}"${feedbackGiven ? ' disabled' : ''}>${t}</button>`).join('')}</div><p class="fbnote">${feedbackGiven ? esc(fbMsg[feedbackGiven]) : '답은 이 기기에만 저장되고, 다음에 이 도구를 열 때 보여 주는 분량에 반영돼요.'}</p></section>`;

    const used = new Set(rec.sourcesUsed);
    const tipBank = content.TIPS || {};
    for (const id of rec.tips) for (const s of (tipBank[id] || {}).src || []) used.add(s);
    for (const x of rec.skip) used.add(x.src);
    const srcList = Object.entries(content.SOURCES).filter(([id]) => used.has(id) || id === 'synk' || id === 'case');
    const sourcesBox = `<details class="sources"${deep ? ' open' : ''}><summary>출처와 기준 (${esc(content.checked)} 확인)</summary><ul>${srcList.map(([id, s]) => `<li><span class="src ${esc(s.kind)}${id === 'case' ? ' case' : ''}">${kindText(id, s)}</span> ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ul><p style="font-size:14px;color:var(--muted)">적은 내 정보는 서버로 보내지 않고 저장하지도 않아요. 매뉴얼은 이 화면 안에서 규칙으로 만들고, 실제 일은 여러분이 쓰는 AI에서 해요. AI 앱의 메뉴 이름은 화면 언어와 업데이트에 따라 조금 다를 수 있어요.</p></details>`;

    const editable = content.steps.filter(s => !s.when || s.when(ctx.answers)).map(s => `<button type="button" class="glass chip" data-action="edit:${esc(s.id)}">${esc(s.short || s.eyebrow || s.title)}</button>`).join('');
    const edit = `<section class="block no-print">${H('답 바꿔 보기')}<p class="sub">하나만 바꿔도 매뉴얼과 한 줄 명령이 다시 만들어져요.</p><div class="take">${editable}</div></section>`;

    // 쓰는 순서(10-06 사용성 검토): 결과가 길어도 처음 할 일 세 가지가 머리 바로 아래 보이게
    const howto = `<ol class="howto" aria-label="쓰는 순서"><li><b>01</b><span>아래 매뉴얼 복사</span></li><li><b>02</b><span>${esc(where)}에 붙여 넣기</span></li><li><b>03</b><span>그 안에서 새 채팅에 한 줄 보내기</span></li></ol>`;
    const html = `<article class="result"><header class="r-top${rec.warns.length ? '' : ' cheer'}"><p class="rec"><span class="stamp">${esc(content.checked.replace(/-/g, '.'))} 기준</span><span>${esc(content.series)} · 내 AI 직원 매뉴얼</span></p><h1 id="q" tabindex="-1">${marked(rec.headline.title, [rec.headline.mark])}</h1><p>${esc(rec.headline.sub)}</p><ul class="facts" aria-label="매뉴얼 요약">${rec.facts.map(x => `<li>${esc(x)}</li>`).join('')}</ul><figure class="shot" aria-hidden="true"><img src="assets/hero-manual.webp" width="766" height="1148" alt=""></figure></header>${howto}<div class="layout"><span>보기</span><div class="seg" role="radiogroup" aria-label="결과 분량">${seg}</div></div>${warns}${take}${save}${checklist}${tipsHtml}${skip}${saveRow}${fb}${edit}${sourcesBox}<div class="nav no-print"><button type="button" class="btn ghost" data-action="restart">처음부터 다시</button></div><div class="dock no-print" role="group" aria-label="바로 쓰기"><button type="button" class="btn primary" data-proxy="copy:manual">매뉴얼 복사</button><button type="button" class="btn soft" data-proxy="share">내 결과 링크</button></div></article>`;
    const texts = { manual: rec.manual, all: summaryText(rec, content) };
    rec.commands.forEach((c, i) => { texts[`cmd${i}`] = c; });
    return { html, texts };
  }

  // 내 정보는 이 변수에만 둔다(저장소·네트워크 없음). 답을 바꿔 결과를 다시 그려도 화면을 닫기 전까지는 남는다.
  let ME_NOW = {};
  function bindResult(el, ctx) {
    const ua = (root.navigator && root.navigator.userAgent) || '';
    if (/Instagram|FBAN|FBAV|KAKAOTALK|NAVER\(inapp|Line\/|DaumApps|everytimeApp/i.test(ua)) { const n = el.querySelector('.inapp'); if (n) n.hidden = false; }
    const box = el.querySelector('[data-me]');
    if (!box || !ctx || !ctx.rules) return;
    const fields = [...box.querySelectorAll('[data-me-field]')];
    fields.forEach(f => { const v = ME_NOW[f.getAttribute('data-me-field')]; if (typeof v === 'string') f.value = v; });
    const apply = () => {
      const v = {};
      fields.forEach(f => { v[f.getAttribute('data-me-field')] = f.value; });
      ME_NOW = v;
      const rec = ctx.rules.compute(ctx.answers, v);
      const ta = el.querySelector('#t-manual');
      if (ta) ta.value = rec.manual;
      const pre = el.querySelector('.manual-print');
      if (pre) pre.textContent = rec.manual;
      if (el._texts) { el._texts.manual = rec.manual; el._texts.all = summaryText(rec, ctx.content); }
    };
    if (fields.some(f => f.value.trim())) apply();
    box.addEventListener('input', apply);
  }

  return Object.freeze({ hero, visual, aside, bindAny, bindResult, result, summaryText });
});
