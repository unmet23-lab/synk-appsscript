/* synkbrief 활용 · 회의 기록 맞춤 정리 — 그림과 결과 화면.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/meeting/view.js
 * rules.compute()가 낸 값을 그린다. 여기서 추천을 새로 계산하지 않는다.
 * 결과 순서(추천기준 §9): 나의 정리 순서 → 가져가기(요청문·저장할 규칙·다음 회의 한 줄·보낼 글) → 설정 카드 → 나에게 필요한 팁 → 보내기 전 확인 → 영상 자료·연습 → 나머지.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.SynkMeetingView = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KIND_TEXT = { official: '공식', synk: 'SYNK 판단', community: '커뮤니티' };
  let SOURCES = {};

  const sources = () => (Object.keys(SOURCES).length ? SOURCES : ((root.SynkMeetingContent || {}).SOURCES || {}));
  function badge(src) {
    const all = sources();
    const s = all[src] || all.synk || { kind: 'synk', label: '' };
    return `<span class="src ${esc(s.kind)}" title="${esc(s.label)}">${KIND_TEXT[s.kind] || ''}</span>`;
  }
  const reasonLi = x => `<li>${esc(x.t)}${badge(x.src)}</li>`;

  // 첫 화면: 승인 펠트 그림 위에 펠트 스티커를 붙인 콜라주(v3 리디자인).
  function hero() {
    return '<div class="collage"><span class="spark"></span><img class="main flat" src="assets/meeting-hero.webp" width="340" height="340" alt=""><img class="stk s1" src="assets/sticker-envelope.webp" alt=""><img class="stk s2" src="assets/sticker-person.webp" alt=""><img class="stk s3" src="assets/sticker-check.webp" alt=""></div>';
  }
  // 제목에서 한 구절을 손그림 형광펜으로 강조한다. 없으면 그대로 둔다.
  function marked(title, marks) {
    const t = esc(title);
    for (const m of marks) { const e = esc(m); const i = t.indexOf(e); if (m && i >= 0) return `${t.slice(0, i)}<span class="hl">${e}</span>${t.slice(i + e.length)}`; }
    return t;
  }
  const sticker = (name, r) => `<img class="stk" src="assets/sticker-${name}.webp" alt=""${r ? ` style="--r:${r}deg"` : ''}>`;
  const head = (no, title, stk, r) => `<h2><span class="no">${String(no).padStart(2, '0')}</span>${esc(title)}${stk ? sticker(stk, r) : ''}</h2>`;

  // 영상과 11쪽 PDF의 가상 예시(지수·민호)를 그대로 쓴다. 실제 회의가 아니다.
  function beforeAfter() {
    return `<div class="ba" role="img" aria-label="두서없는 메모가 담당자와 기한이 있는 표로 바뀌는 예시. 기한이 없는 일은 확인 필요로 남는다."><div class="memo">소개 페이지 문구 길다 → 짧게. 지수 9/23까지 수정. 설문 초안 민호, 마감 안 정함. 인터뷰는 미정. 다음 회의 9/25 2시.</div><div class="arr" aria-hidden="true">→</div><table><thead><tr><th>할 일</th><th>담당</th><th>기한</th></tr></thead><tbody><tr><td>소개 문구 줄이기</td><td>지수</td><td>9월 23일</td></tr><tr><td>설문 초안</td><td>민호</td><td class="need">확인 필요</td></tr></tbody></table></div><p class="vis-cap" style="font-size:13px;color:var(--faint);margin:8px 0 0">영상 속 가상 메모예요. 정해지지 않은 기한은 지어내지 않고 ‘확인 필요’로 남겨요.</p>`;
  }
  function deadline() {
    return `<div class="cal" role="img" aria-label="다음 회의 날짜를 할 일의 기한으로 착각하는 예시"><div><b>메모에 적힌 것</b>설문 초안은 민호가. 마감은 안 정함. 다음 회의는 9월 25일.</div><div class="bad"><b>AI가 잘못 채우기 쉬운 것</b>설문 초안 · 민호 · 9월 25일까지 ← 기록에 없는 기한이에요</div></div>`;
  }
  function repeat() {
    return `<div class="lanes" role="img" aria-label="처음에는 요청문과 기록을 함께 보내고, 규칙을 저장한 뒤에는 한 줄과 기록만 보낸다"><div class="lane"><b>처음 한 번</b><div class="flow"><span class="node">요청문</span><span class="arr">+</span><span class="node">회의 기록</span><span class="arr">→</span><span class="node hot">회의록</span></div></div><div class="lane"><b>규칙 저장 뒤</b><div class="flow"><span class="node">“이번 회의도 정리해줘”</span><span class="arr">+</span><span class="node">새 기록</span><span class="arr">→</span><span class="node hot">같은 형식</span></div></div></div>`;
  }
  function names() {
    return `<div class="pool" role="img" aria-label="ChatGPT와 Claude는 프로젝트, Gemini는 Gem이라는 이름으로 규칙을 저장한다"><div class="p"><b>ChatGPT·Claude</b><div class="row"><span>프로젝트</span><span class="alt">지침</span></div></div><div class="p"><b>Gemini</b><div class="row"><span>Gem</span><span class="alt">요청 사항</span></div></div></div>`;
  }

  function visual(key) {
    if (key === 'beforeafter') return beforeAfter();
    if (key === 'deadline') return deadline();
    if (key === 'repeat') return repeat();
    if (key === 'names') return names();
    return '';
  }
  function aside() { return ''; }

  function reasonsBlock(list, layout, keep = 3) {
    if (!list.length || layout === 'quick') return '';
    if (layout === 'deep' || list.length <= keep) return `<ul class="why">${list.map(reasonLi).join('')}</ul>`;
    return `<ul class="why">${list.slice(0, keep).map(reasonLi).join('')}</ul><details class="more"><summary>이유 더 보기 (${list.length - keep})</summary><ul class="why">${list.slice(keep).map(reasonLi).join('')}</ul></details>`;
  }
  function yesNo(card, quick) {
    if (!card.yes && !card.no) return '';
    const yes = (card.yes || []).map(x => `<li><b class="yes">${esc(card.yesLabel || '필요해요')}</b> ${esc(x.t)}${badge(x.src)}</li>`).join('');
    const no = (quick ? [] : card.no || []).map(x => `<li><b class="no">${esc(card.noLabel || '없어도 돼요')}</b> ${esc(x.t)}${badge(x.src)}</li>`).join('');
    return yes || no ? `<ul class="why npu">${yes}${no}</ul>` : '';
  }
  function cardHtml(c, layout) {
    const quick = layout === 'quick';
    return `<div class="spec${c.key ? ' key' : ''}"><p class="k">${esc(c.k)}</p><p class="v${c.small ? ' small' : ''}">${esc(c.v)}</p>${c.s ? `<p class="s">${esc(c.s)}</p>` : ''}${yesNo(c, quick)}${c.note && !quick ? `<p class="s">${esc(c.note.t)}${badge(c.note.src)}</p>` : ''}${reasonsBlock(c.reasons || [], layout)}</div>`;
  }
  function copyBox(id, label, text, button, primary, rows) {
    return `<div class="copybox${primary ? ' main' : ''}"><label for="t-${id}">${esc(label)}</label><textarea id="t-${id}" readonly spellcheck="false"${rows ? ` style="min-height:${rows}px"` : ''}>${esc(text)}</textarea><div class="row"><button type="button" class="btn ${primary ? 'primary' : 'soft'}" data-action="copy:${id}">${esc(button)}</button><span class="status" role="status"></span></div></div>`;
  }

  function summaryText(rec, content) {
    const tips = content.TIPS || {};
    const lines = [
      `synkbrief 활용 · 회의 기록 맞춤 정리 (${content.checked} 기준)`,
      rec.headline.title, rec.headline.sub, '',
      '[나의 정리 순서]', ...rec.flow.map((x, i) => `${i + 1}. ${x.t}${x.d ? ` — ${x.d}` : ''}`), '',
      '[처음 정리할 때 보낼 요청문]', rec.prompts.first, '',
    ];
    if (rec.save.recommend) lines.push(`[${rec.save.where}에 저장할 규칙]`, rec.prompts.rules, '', '[저장하는 곳]', ...rec.save.steps.map((x, i) => `${i + 1}. ${x.t}`), '', '[다음 회의 때]', rec.prompts.next, '');
    if (rec.prompts.share) lines.push('[보낼 글로 바꾸는 요청문]', rec.prompts.share, '');
    lines.push('[내 상황에 맞춘 설정]', ...rec.cards.map(c => `- ${c.k}: ${c.v}${c.s ? ` (${c.s})` : ''}`), '');
    lines.push('[나에게 필요한 팁]', ...rec.tips.filter(id => tips[id]).flatMap(id => [`· ${tips[id].title}`, ...tips[id].body.map(b => `  ${b}`)]), '');
    lines.push('[보내기 전에 확인할 것]', ...rec.checklist.map(c => `[ ] ${c.t}: ${c.d}`), '', `영상 속 11쪽 PDF: https://synk.im/brief/meeting/${content.guidePdf}`, `다시 보기: https://synk.im/brief/meeting/`);
    return lines.join('\n');
  }

  function tipCards(rec, content, layout, h2) {
    const tips = content.TIPS || {};
    const ids = rec.tips.filter(id => tips[id]);
    if (!ids.length) return '';
    return `<section class="block">${h2}<p class="sub">고른 답에 맞춰, 왜 그렇게 하는지와 조심할 점, 신경 쓰지 않아도 되는 것을 골라 드렸어요.</p><div class="tipcards">${ids.map((id, i) => {
      const t = tips[id];
      const open = layout === 'deep' || (layout === 'guided' && i === 0);
      return `<details class="tipcard"${open ? ' open' : ''}><summary>${esc(t.title)}</summary><div class="tipbody">${t.body.map(p => `<p>${esc(p)}</p>`).join('')}<p class="tipsrc">${[...new Set(t.src)].map(badge).join(' ')}</p></div></details>`;
    }).join('')}</div></section>`;
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
    const H = (title, stk, r) => head(++n, title, stk, r);

    const flow = `<section class="formbox"><p class="eyebrow">이 순서대로 하세요</p><h2>${esc(rec.flowTitle)}</h2><ol class="steps">${rec.flow.map(x => `<li><div><b>${esc(x.t)}${x.src && x.src !== 'synk' ? badge(x.src) : ''}</b>${x.d && !quick ? `<p>${esc(x.d)}</p>` : ''}</div></li>`).join('')}</ol></section>`;

    const saveBox = rec.save.recommend ? `<div class="copybox"><label for="t-rules">${esc(rec.save.where)}에 한 번 저장할 규칙</label><textarea id="t-rules" readonly spellcheck="false" style="min-height:260px">${esc(rec.prompts.rules)}</textarea><div class="row"><button type="button" class="btn soft" data-action="copy:rules">규칙 복사</button><span class="status" role="status"></span></div></div><div class="formbox" style="padding:18px 20px"><p class="eyebrow">저장하는 곳 · ${esc(rec.ai.label)}</p><ol class="plain" style="margin-top:8px">${rec.save.steps.map(x => `<li>${esc(x.t)}${badge(x.src)}</li>`).join('')}</ol>${rec.save.note ? `<p class="s" style="font-size:14px;color:var(--muted);margin:8px 0 0">${esc(rec.save.note.t)}${badge(rec.save.note.src)}</p>` : ''}</div>${copyBox('next', '다음 회의 때 보낼 한 줄', rec.prompts.next, '한 줄 복사', false, 110)}` : '';
    const shareBox = rec.prompts.share ? copyBox('share', rec.shareLabel, rec.prompts.share, '요청문 복사', false, 200) : '';
    const take = `<section class="block">${H('가져가기', 'envelope', 8)}<p class="sub">${esc(rec.takeSub)}</p>${copyBox('first', '처음 정리할 때 보낼 요청문', rec.prompts.first, '요청문 복사', true, 300)}${saveBox}${shareBox}</section>`;

    const cards = `<section class="block">${H('내 상황에 맞춘 설정', 'adapt', -6)}<p class="sub">왜 이렇게 했는지와, 신경 쓰지 않아도 되는 것까지 함께 적었어요.</p><div class="specs">${rec.cards.map(c => cardHtml(c, layout)).join('')}</div></section>`;

    const tipsHtml = tipCards(rec, content, layout, H('나에게 필요한 팁', 'search', 7));
    const checklist = quick ? '' : `<section class="block">${H('보내기 전에 확인할 것', 'check', -8)}<p class="sub">AI가 만든 회의록은 초안이에요. 체크한 내용은 이 기기에 남아요.</p><ul class="checks">${rec.checklist.map(c => `<li><label><input type="checkbox" data-check="${esc(c.id)}"${checks[c.id] ? ' checked' : ''}><span><b>${esc(c.t)}</b><small>${esc(c.d)}</small></span></label></li>`).join('')}</ul></section>`;

    const practice = quick ? '' : `<section class="block">${H('영상 속 자료와 연습', 'book', 5)}<p class="sub">영상에서 보여 드린 순서는 11쪽 PDF에 그대로 있어요(ChatGPT 화면 기준). 처음이라면 가상 메모로 먼저 해 보세요.</p><div class="take" style="margin-bottom:16px"><a class="btn soft" href="${esc(content.guidePdf)}" target="_blank" rel="noopener">11쪽 PDF 열기</a><a class="btn soft" href="${esc(content.kitZip)}" download>연습 자료 ZIP 받기</a></div>${copyBox('practice', '연습용 가상 메모(영상과 같은 예시)', content.practiceMemo, '연습 메모 복사', false, 120)}</section>`;

    const saveRow = `<section class="block">${H('저장하고 다시 보기')}<div class="take"><button type="button" class="btn soft" data-action="share">내 결과 링크 복사</button><button type="button" class="btn soft" data-action="copy:all">결과 전체 복사</button><button type="button" class="btn soft" data-action="print">PDF로 저장·인쇄</button><span class="status" role="status" style="flex-basis:100%"></span></div><p class="hint">인스타그램 안에서 열었다면 오른쪽 위 메뉴에서 ‘외부 브라우저로 열기’를 누르면 복사와 저장이 더 잘 돼요.</p></section>`;

    const fbMsg = { helpful: '고마워요. 다음에도 이렇게 보여 드릴게요.', too_much: '알겠어요. 다음에 이 기기에서 열면 간단히 보여 드릴게요.', want_more: '알겠어요. 다음에 이 기기에서 열면 자세히 보여 드릴게요.', not_fit: '알려 주셔서 고마워요. 어떤 점이 안 맞았는지 synkbrief 댓글이나 DM으로 알려 주시면 다음 버전에 반영할게요.' };
    const fb = `<section class="block">${H('이 정리법, 도움이 됐나요?')}<div class="fb" role="group" aria-label="추천에 대한 반응">${[['helpful', '도움이 됐어요'], ['too_much', '너무 많아요'], ['want_more', '더 자세히 알고 싶어요'], ['not_fit', '나와 안 맞아요']].map(([id, t]) => `<button type="button" class="glass chip" aria-pressed="${feedbackGiven === id}" data-action="feedback:${id}"${feedbackGiven ? ' disabled' : ''}>${t}</button>`).join('')}</div><p class="fbnote">${feedbackGiven ? esc(fbMsg[feedbackGiven]) : '답은 이 기기에만 저장되고, 다음에 이 도구를 열 때 보여 주는 분량에 반영돼요.'}</p></section>`;

    const used = new Set(rec.sourcesUsed);
    const tipBank = content.TIPS || {};
    for (const id of rec.tips) for (const s of (tipBank[id] || {}).src || []) used.add(s);
    const srcList = Object.entries(content.SOURCES).filter(([id]) => used.has(id) || id === 'synk');
    const sourcesBox = `<details class="sources"${deep ? ' open' : ''}><summary>출처와 기준 (${esc(content.checked)} 확인)</summary><ul>${srcList.map(([, s]) => `<li><span class="src ${esc(s.kind)}">${KIND_TEXT[s.kind]}</span> ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ul><p style="font-size:14px;color:var(--muted)">회의 내용은 이 화면에 입력하지 않아요. 요청문은 이 화면 안에서 규칙으로 만들고, 실제 정리는 여러분이 쓰는 AI에서 해요. AI 앱의 메뉴 이름은 화면 언어와 업데이트에 따라 조금 다를 수 있어요.</p></details>`;

    const editable = content.steps.filter(s => !s.when || s.when(ctx.answers)).map(s => `<button type="button" class="glass chip" data-action="edit:${esc(s.id)}">${esc(s.short || s.eyebrow || s.title)}</button>`).join('');
    const edit = `<section class="block no-print">${H('답 바꿔 보기')}<p class="sub">하나만 바꿔도 요청문과 순서가 다시 만들어져요.</p><div class="take">${editable}</div></section>`;

    const html = `<article class="result"><header class="r-top${rec.warns.length ? '' : ' cheer'}"><p class="rec"><span class="stamp">${esc(content.checked.replace(/-/g, '.'))} 기준</span><span>${esc(content.series)} · 나의 회의 정리법</span></p><h1 id="q" tabindex="-1">${marked(rec.headline.title, ['다음부턴 한 줄로', '요청문 하나면', '시크릿 채팅', '임시 채팅'])}</h1><p>${esc(rec.headline.sub)}</p>${because ? `<p class="because">${esc(because)}</p>` : ''}<figure class="shot" aria-hidden="true"><img src="assets/meeting-hero.webp" alt=""></figure></header><div class="layout"><span>보기</span><div class="seg" role="radiogroup" aria-label="결과 분량">${seg}</div></div>${warns}${flow}${take}${cards}${tipsHtml}${checklist}${practice}${saveRow}${fb}${edit}${sourcesBox}<div class="nav no-print"><button type="button" class="btn ghost" data-action="restart">처음부터 다시</button></div><div class="dock no-print" role="group" aria-label="바로 쓰기"><button type="button" class="btn primary" data-proxy="copy:first">요청문 복사</button><button type="button" class="btn soft" data-proxy="share">내 결과 링크</button></div></article>`;
    const texts = { first: rec.prompts.first, rules: rec.prompts.rules, next: rec.prompts.next, share: rec.prompts.share, practice: content.practiceMemo, all: summaryText(rec, content) };
    return { html, texts };
  }

  return Object.freeze({ hero, visual, aside, result });
});
