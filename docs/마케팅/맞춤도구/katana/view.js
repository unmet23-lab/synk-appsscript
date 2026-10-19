/* synkbrief 뉴스 · 카타나 요청문 만들기 — 그림과 결과 화면.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/katana/view.js
 * rules.compute()가 낸 값을 그린다. 여기서 추천을 새로 계산하지 않는다.
 * 결과 순서(추천기준 §6): 머리 → 이 순서대로 → 가져가기(요청문) → 어림·설정 카드 → 나에게 필요한 팁 → 결과 받은 뒤 확인 → 영상 속 실제 요청 → 나머지.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.SynkKatanaView = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KIND_TEXT = { official: '공식', synk: 'SYNK 판단', community: '커뮤니티' };
  // 「·」로 이은 말(「병·상자·화장품」)은 한 덩어리로 묶는다 — word-break:keep-all이 「·」 앞뒤에서 줄을 가르기 때문(10-13 글자 2판, PULSE keepDots와 같은 규칙).
  const keepDots = s => esc(s).replace(/[^\s·]+(?:·[^\s·]+)+/g, m => `<span class="nw">${m}</span>`);
  let SOURCES = {};

  const sources = () => (Object.keys(SOURCES).length ? SOURCES : ((root.SynkKatanaContent || {}).SOURCES || {}));
  function badge(src) {
    const all = sources();
    const s = all[src] || all.synk || { kind: 'synk', label: '' };
    return `<span class="src ${esc(s.kind)}" title="${esc(s.label)}">${KIND_TEXT[s.kind] || ''}</span>`;
  }
  const reasonLi = x => `<li>${keepDots(x.t)}${badge(x.src)}</li>`;

  // 화면마다 내용을 설명하는 펠트 그림(10-13, 한 판에 구워 오림 — 만든 길과 판·지시문의 자리는 ../README.md 「파일」 표의 katana 줄).
  // 유호님 「각 사진마다 너무 똑같아서 별로야. 항상 내용에 도움이 되는 사진을 넣어야해」 → 같은 그림을 되풀이하지 않는다.
  const ART = {
    intro: ['katana-art-intro.webp', 605, 680],     // 말풍선 붙은 클래퍼보드: 말로 요청하면 영상이 된다
    hero: ['katana-art-hero.webp', 405, 251],       // 제품·음료·가게: 주인공 후보
    style: ['katana-art-style.webp', 211, 366],     // 색이 다른 세 칸 필름: 영상 종류
    input: ['katana-art-input.webp', 420, 314],     // 사진 묶음과 필름통: 재료
    where: ['katana-art-where.webp', 398, 285],     // 세로 휴대폰과 가로 모니터: 올릴 곳
    quality: ['katana-art-quality.webp', 420, 314], // 높이가 다른 코인 탑: 화질이 비용을 바꾼다
    keep: ['katana-art-keep.webp', 276, 360],       // 자물쇠: 바뀌면 안 되는 것을 잠근다
    result: ['katana-art-result.webp', 390, 332],   // 체크 붙은 메모: 요청문 완성
  };
  const art = (key, cls) => { const a = ART[key]; return a ? `<img class="${cls}" src="assets/${a[0]}" width="${a[1]}" height="${a[2]}" alt="">` : ''; };

  // 첫 화면 포스터(싱ㅋ 시그널, core/signal.css): SHIFT 청금석 면 + 펠트 그림(제 색 그대로 −3°) + 아주 큰 「카타나」.
  // 플랫폼 앱 포스터처럼 왼쪽 위 모노 번호, 오른쪽 위 상태 칩(LED 점). 펠트 물건은 한 화면에 하나.
  function hero() {
    return `<div class="poster tall" data-word="카타나" style="--len:3"><span class="label">01 / SYNKBRIEF TOOL</span><span class="led-chip">실제 결과 2편</span>${art('intro', 'cut')}</div>`;
  }
  function marked(title, marks) {
    const t = esc(title);
    for (const m of marks) { const e = esc(m); const i = t.indexOf(e); if (m && i >= 0) return `${t.slice(0, i)}<span class="hl">${e}</span>${t.slice(i + e.length)}`; }
    return t;
  }
  // 구역 머리: 「01 가져가기」 모노 번호 + 제목 + 1px 선(시그널). 펠트 스티커는 붙이지 않는다.
  const head = (no, title) => `<h2><span class="no">${String(no).padStart(2, '0')}</span>${esc(title)}</h2>`;

  // 카타나가 하는 일: 우리 제품 광고 실제 기록(38분) 기준.
  function pipeline() {
    return '<div class="lanes" role="img" aria-label="요청을 보내면 카타나가 레퍼런스를 찾아 분석하고, 장면을 생성하고, 합성해서 결과를 줘요. 우리 실제 기록은 38분이었어요."><div class="lane"><b>요청 한 번</b><div class="flow"><span class="node">사진 + 요청문</span><span class="arr">→</span><span class="node">레퍼런스 찾기·분석 25분</span><span class="arr">→</span><span class="node">생성 4분</span><span class="arr">→</span><span class="node">합성 4분</span><span class="arr">→</span><span class="node hot">결과</span></div></div></div><p class="vis-cap" style="font-size:13px;color:var(--faint);margin:8px 0 0">10월 13일 우리 제품 광고 실제 기록이에요. 중간에 질문하지 않고 끝까지 가요.</p>';
  }
  function rates() {
    const rows = [['480p', 3, '미리 보기'], ['720p', 7, '기본값'], ['1080p', 12, '완성본']];
    return `<div class="pool" role="img" aria-label="초당 크레딧: 480p 3, 720p 7, 1080p 12"><div class="p" style="grid-column:1/-1">${rows.map(([k, v, s]) => `<div class="row" style="display:grid;grid-template-columns:70px 1fr 120px;align-items:center;gap:10px;margin:6px 0"><b>${k}</b><span style="display:block;height:14px;border-radius:7px;background:var(--face);width:${Math.round((v / 12) * 100)}%"></span><span>초당 ${v} · ${s}</span></div>`).join('')}</div></div><p class="vis-cap" style="font-size:13px;color:var(--faint);margin:8px 0 0">카타나 가격표의 10월 8일 관측값이에요. 실제 비용은 카타나가 계획할 때 받는 견적을 따라요.</p>`;
  }
  function visual(key) {
    if (key === 'pipeline') return pipeline();
    if (key === 'rates') return rates();
    return '';
  }
  // 질문 옆 포스터: 지금 질문의 낱말을 큰 한글로 + 그 질문을 설명하는 펠트 그림. 휴대폰에서는 질문 위의 띠가 된다(signal.css).
  function aside(answers, rules, step) {
    const C = root.SynkKatanaContent;
    if (!C || !step) return '';
    const list = C.steps.filter(x => !x.when || x.when(answers || {}));
    const i = list.findIndex(x => x.id === step.id);
    const word = step.short || step.eyebrow || '';
    const pad = n => String(n).padStart(2, '0');
    return `<div class="poster step-poster" data-word="${esc(word)}" style="--len:${Math.max(2, [...word.replace(/\s/g, '')].length)}" aria-hidden="true"><span class="label">QUESTION ${pad(i + 1)} / ${pad(list.length)}</span>${art(step.id, 'cut')}</div>`;
  }

  function reasonsBlock(list, layout, keep = 3) {
    if (!list || !list.length || layout === 'quick') return '';
    if (layout === 'deep' || list.length <= keep) return `<ul class="why">${list.map(reasonLi).join('')}</ul>`;
    return `<ul class="why">${list.slice(0, keep).map(reasonLi).join('')}</ul><details class="more"><summary>이유 더 보기 (${list.length - keep})</summary><ul class="why">${list.slice(keep).map(reasonLi).join('')}</ul></details>`;
  }
  function yesNo(card, quick) {
    if (!(card.yes || []).length && !(card.no || []).length) return '';
    const yes = (card.yes || []).map(x => `<li><b class="yes">필요해요</b> ${esc(x.t)}${badge(x.src)}</li>`).join('');
    const no = (quick ? [] : card.no || []).map(x => `<li><b class="no">없어도 돼요</b> ${esc(x.t)}${badge(x.src)}</li>`).join('');
    return yes || no ? `<ul class="why npu">${yes}${no}</ul>` : '';
  }
  function cardHtml(c, layout) {
    const quick = layout === 'quick';
    return `<div class="spec${c.key ? ' key' : ''}"><p class="k">${keepDots(c.k)}</p><p class="v">${keepDots(c.v)}</p>${c.s ? `<p class="s">${keepDots(c.s)}</p>` : ''}${yesNo(c, quick)}${reasonsBlock(c.reasons, layout)}</div>`;
  }
  function copyBox(id, label, text, button, primary, rows, done) {
    return `<div class="copybox${primary ? ' main' : ''}"><label for="t-${id}">${esc(label)}</label><textarea id="t-${id}" readonly spellcheck="false"${rows ? ` style="min-height:${rows}px"` : ''}>${esc(text)}</textarea><div class="row"><button type="button" class="btn ${primary ? 'primary' : 'soft'}" data-action="copy:${id}"${done ? ` data-done="${esc(done)}"` : ''}>${esc(button)}</button><span class="status" role="status"></span></div></div>`;
  }

  function summaryText(rec, content) {
    const tips = content.TIPS || {};
    const lines = [
      `synkbrief 뉴스 · 카타나 요청문 만들기 (${content.checked} 기준)`,
      rec.headline.title, rec.headline.sub, '',
      '[이 순서대로]', ...rec.flow.map((x, i) => `${i + 1}. ${x.t} — ${x.d}`), '',
      '[/katana 뒤에 붙여 넣을 요청문]', rec.prompt, '',
      '[어림과 설정]', ...rec.cards.map(c => `- ${c.k}: ${c.v}${c.s ? ` (${c.s})` : ''}`), '',
    ];
    if (rec.warns.length) lines.push('[먼저 알아 둘 것]', ...rec.warns.map(w => `※ ${w.t}`), '');
    lines.push('[나에게 필요한 팁]', ...rec.tips.filter(id => tips[id]).flatMap(id => [`· ${tips[id].title}`, ...tips[id].body.map(b => `  ${b}`)]), '');
    lines.push('[결과 받은 뒤 확인할 것]', ...rec.checklist.map(c => `[ ] ${c.t}: ${c.d}`), '', '다시 보기: https://synk.im/brief/katana/');
    return lines.join('\n');
  }

  function tipCards(rec, content, layout, h2) {
    const tips = content.TIPS || {};
    const ids = rec.tips.filter(id => tips[id]);
    if (!ids.length) return '';
    return `<section class="block">${h2}<p class="sub">고른 답에 맞춰, 왜 그렇게 넣었는지와 조심할 점, 신경 쓰지 않아도 되는 것을 골라 드렸어요.</p><div class="tipcards">${ids.map((id, i) => {
      const t = tips[id];
      const open = layout === 'deep' || (layout === 'guided' && i < 2);
      return `<details class="tipcard"${open ? ' open' : ''}><summary>${keepDots(t.title)}</summary><div class="tipbody">${t.body.map(p => `<p>${keepDots(p)}</p>`).join('')}<p class="tipsrc">${[...new Map(t.src.map(s => [(sources()[s] || {}).kind, s])).values()].map(badge).join(' ')}</p></div></details>`;
    }).join('')}</div></section>`;
  }

  function examplesBlock(content, h2) {
    const ex = content.examples || [];
    return `<section class="block">${h2}<p class="sub">영상에서 보여 드린 두 편이에요. 몽글 사진 5장을 붙이고 /katana 뒤에 이렇게 보냈어요(실제 요청을 줄인 것).</p>${ex.map((e, i) => `<div class="formbox ex"><div class="ex-art"><span class="label">${String(i + 1).padStart(2, '0')}</span><img src="assets/katana-ex-${esc(e.id)}.webp" width="270" height="480" alt="${esc(e.title)} 결과의 한 장면"></div><div><p class="eyebrow">${esc(e.title)} · ${esc(e.result)}</p><pre style="white-space:pre-wrap;font:inherit;font-size:15.5px;line-height:1.6;margin:8px 0 10px">${esc(e.text)}</pre><p class="s" style="font-size:14px;color:var(--muted);margin:0 0 10px">${esc(e.note)}</p><div class="row"><button type="button" class="btn soft" data-action="copy:ex-${esc(e.id)}" data-what="요청">이 요청 복사</button><span class="status" role="status"></span></div></div></div>`).join('')}</section>`;
  }

  function result(ctx) {
    const { rec, layout, plan, checks, feedbackGiven, content } = ctx;
    SOURCES = content.SOURCES;
    const deep = layout === 'deep', quick = layout === 'quick';
    const because = plan && plan.selected && plan.selected.id === layout
      ? (plan.reasons.includes('feedback.too_much') ? '지난번에 ‘너무 많아요’라고 하셔서 간단히 보여 드려요. 이 기기에 저장된 답을 기준으로 했어요.' : plan.reasons.includes('feedback.want_more') ? '지난번에 ‘더 자세히’를 고르셔서 자세히 보여 드려요. 이 기기에 저장된 답을 기준으로 했어요.' : '')
      : '';
    const seg = [['quick', '간단히'], ['guided', '기본'], ['deep', '자세히']].map(([id, t]) => `<button type="button" class="glass chip" role="radio" aria-checked="${id === layout}" data-action="layout:${id}">${t}</button>`).join('');
    const warns = rec.warns.map(x => `<div class="warn">${keepDots(x.t)}${badge(x.src)}</div>`).join('');
    let n = 0;
    const H = title => head(++n, title);

    const flow = `<section class="formbox"><p class="eyebrow">이 순서대로 하세요</p><h2>클로드에서 카타나 쓰기</h2><ol class="steps">${rec.flow.map(x => `<li><div><b>${keepDots(x.t)}${x.src && x.src !== 'synk' ? badge(x.src) : ''}</b>${x.d && !quick ? `<p>${keepDots(x.d)}</p>` : ''}</div></li>`).join('')}</ol></section>`;
    const take = `<section class="block">${H('가져가기')}<p class="sub">클로드 새 채팅에 재료를 붙이고, 입력창에 <b>/katana</b> 를 쓴 다음 이 요청문을 붙여 넣어 보내세요.</p>${copyBox('prompt', '/katana 뒤에 붙여 넣을 요청문', rec.prompt, '요청문 복사', true, 0, '요청문을 복사했어요. 클로드 새 채팅에서 /katana 를 쓰고 붙여 넣으세요.')}</section>`;
    const cards = `<section class="block">${H('어림과 설정')}<p class="sub">비용은 화질과 길이로 어림했어요. 실제 비용은 카타나가 계획할 때 받는 견적을 따라요.</p><div class="specs">${rec.cards.map(c => cardHtml(c, layout)).join('')}</div></section>`;
    const tipsHtml = tipCards(rec, content, layout, H('나에게 필요한 팁'));
    const checklist = quick ? '' : `<section class="block">${H('결과 받은 뒤 확인할 것')}<p class="sub">카타나는 끝까지 혼자 가요. 받은 뒤 이것만 보세요. 체크한 내용은 이 기기에 남아요.</p><ul class="checks">${rec.checklist.map(c => `<li><label><input type="checkbox" data-check="${esc(c.id)}"${checks[c.id] ? ' checked' : ''}><span><b>${keepDots(c.t)}</b><small>${keepDots(c.d)}</small></span></label></li>`).join('')}</ul></section>`;
    const examples = examplesBlock(content, H('영상 속 실제 요청 두 개'));
    const saveRow = `<section class="block">${H('저장하고 다시 보기')}<div class="take"><button type="button" class="btn soft" data-action="share">내 결과 링크 복사</button><button type="button" class="btn soft" data-action="copy:all" data-what="결과 전체">결과 전체 복사</button><button type="button" class="btn soft" data-action="print">PDF로 저장·인쇄</button><span class="status" role="status" style="flex-basis:100%"></span></div><p class="hint">인스타그램 안에서 열었다면 오른쪽 위 메뉴에서 ‘외부 브라우저로 열기’를 누르면 복사와 저장이 더 잘 돼요.</p></section>`;
    const fbMsg = { helpful: '고마워요. 다음에도 이렇게 보여 드릴게요.', too_much: '알겠어요. 다음에 이 기기에서 열면 간단히 보여 드릴게요.', want_more: '알겠어요. 다음에 이 기기에서 열면 자세히 보여 드릴게요.', not_fit: '알려 주셔서 고마워요. 어떤 점이 안 맞았는지 synkbrief 댓글이나 DM으로 알려 주시면 다음 버전에 반영할게요.' };
    const fb = `<section class="block">${H('이 요청문, 도움이 됐나요?')}<div class="fb" role="group" aria-label="추천에 대한 반응">${[['helpful', '도움이 됐어요'], ['too_much', '너무 많아요'], ['want_more', '더 자세히 알고 싶어요'], ['not_fit', '나와 안 맞아요']].map(([id, t]) => `<button type="button" class="glass chip" aria-pressed="${feedbackGiven === id}" data-action="feedback:${id}"${feedbackGiven ? ' disabled' : ''}>${t}</button>`).join('')}</div><p class="fbnote">${feedbackGiven ? esc(fbMsg[feedbackGiven]) : '답은 이 기기에만 저장되고, 다음에 이 도구를 열 때 보여 주는 분량에 반영돼요.'}</p></section>`;

    const used = new Set(rec.sourcesUsed);
    const tipBank = content.TIPS || {};
    for (const id of rec.tips) for (const s of (tipBank[id] || {}).src || []) used.add(s);
    const srcList = Object.entries(content.SOURCES).filter(([id]) => used.has(id) || id === 'synk');
    const sourcesBox = `<details class="sources"${deep ? ' open' : ''}><summary>출처와 기준 (${esc(content.checked)} 확인)</summary><ul>${srcList.map(([, s]) => `<li><span class="src ${esc(s.kind)}">${KIND_TEXT[s.kind]}</span> ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ul><p style="font-size:14px;color:var(--muted)">이 화면은 사진을 받지 않고 AI도 부르지 않아요. 요청문은 고른 답으로 이 화면 안에서 만들고, 영상은 여러분의 클로드·힉스필드 계정에서 만들어져요. 메뉴 이름과 요금은 업데이트에 따라 바뀔 수 있어요.</p></details>`;
    const editable = content.steps.filter(s => !s.when || s.when(ctx.answers)).map(s => `<button type="button" class="glass chip" data-action="edit:${esc(s.id)}">${esc(s.short || s.eyebrow || s.title)}</button>`).join('');
    const edit = `<section class="block no-print">${H('답 바꿔 보기')}<p class="sub">하나만 바꿔도 요청문과 어림이 다시 만들어져요.</p><div class="take">${editable}</div></section>`;

    const html = `<article class="result"><header class="r-top"><p class="rec"><span class="sticker">${esc(content.checked.replace(/-/g, '.'))} 기준</span><span>${esc(content.series)} · 나의 카타나 요청문</span></p><h1 id="q" tabindex="-1">${marked(rec.headline.title, ['아우라 에딧', '제품 광고', '편집 영상', '레퍼런스 리믹스'])}</h1><p>${esc(rec.headline.sub)}</p>${because ? `<p class="because">${esc(because)}</p>` : ''}<figure class="shot cut" aria-hidden="true">${art('result', '')}</figure></header><div class="layout"><span>보기</span><div class="seg" role="radiogroup" aria-label="결과 분량">${seg}</div></div>${warns}${flow}${take}${cards}${tipsHtml}${checklist}${examples}${saveRow}${fb}${edit}${sourcesBox}<div class="nav no-print"><button type="button" class="btn ghost" data-action="restart">처음부터 다시</button></div><div class="dock no-print" role="group" aria-label="바로 쓰기"><button type="button" class="btn primary" data-proxy="copy:prompt">요청문 복사</button><button type="button" class="btn soft" data-proxy="share">내 결과 링크</button></div></article>`;
    const texts = { prompt: rec.prompt, all: summaryText(rec, content) };
    for (const e of content.examples || []) texts[`ex-${e.id}`] = e.text;
    return { html, texts };
  }

  return Object.freeze({ hero, visual, aside, result });
});
