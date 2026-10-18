/* yuhobuilds · 내 PC 이사 목록 — 그림과 결과 화면.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/move/view.js
 * rules.compute()가 낸 값을 그린다. 여기서 추천을 새로 계산하지 않는다. 기준 구현은 katana/view.js(싱ㅋ 시그널 + 카타나 2판 요소).
 * 결과 순서(추천기준 §5): 머리 → 먼저 알아 둘 것 → 한눈에 → 00 OneDrive → 01 ① → 02 ② → 03 ③ → 04 ④ + 요청문 → 05 팁 → 06 실제 이사 → 나머지.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.SynkMoveView = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KIND_TEXT = { official: '공식', synk: 'SYNK 판단', community: '커뮤니티' };
  // 「·」로 이은 말은 한 덩어리로 묶는다(word-break:keep-all이 「·」 앞뒤에서 줄을 가르기 때문, 카타나와 같은 규칙).
  const keepDots = s => esc(s).replace(/[^\s·]+(?:·[^\s·]+)+/g, m => `<span class="nw">${m}</span>`);
  let SOURCES = {};
  const sources = () => (Object.keys(SOURCES).length ? SOURCES : ((root.SynkMoveContent || {}).SOURCES || {}));
  function badge(src) {
    const all = sources();
    const s = all[src] || all.synk || { kind: 'synk', label: '' };
    return `<span class="src ${esc(s.kind)}" title="${esc(s.label)}">${KIND_TEXT[s.kind] || ''}</span>`;
  }

  // 화면마다 내용을 설명하는 펠트 물건(10-17, 청금석 바탕 판 세 장에서 오림 — 만든 방법은 build.mjs 머리말).
  // 같은 그림을 되풀이하지 않는다: 첫 화면·질문 셋·결과 머리 넷(방법마다)·OneDrive·실제 이사가 모두 다른 물건이다.
  const ART = {
    intro: ['move-art-intro.webp', 837, 900],        // 노트북·열쇠·서류가 든 이삿짐 상자: 이사
    how: ['move-art-how.webp', 328, 411],            // 화살표 셋 이정표: 어떻게 옮길지 고르기
    uses: ['move-art-uses.webp', 454, 367],          // 게임패드·카메라·팔레트·서류 담은 쟁반: 이 컴퓨터로 하는 일
    old: ['move-art-old.webp', 493, 413],            // 빈 꼬리표를 단 옛 노트북: 옛 컴퓨터 처리
    ssd: ['move-art-ssd.webp', 520, 277],            // 노트북 위 외장 SSD: SSD로 옮기는 결과
    cloud: ['move-art-cloud.webp', 368, 513],        // 폴더·상자를 매단 구름: 클라우드로 옮기는 결과
    direct: ['move-art-direct.webp', 565, 343],      // 케이블로 이은 두 노트북: 직접 연결 결과
    scale: ['move-art-scale.webp', 354, 441],        // 이삿짐 올린 저울: 아직 모름 → 크기부터
    onedrive: ['move-art-onedrive.webp', 395, 440],  // 넘쳐 뚜껑이 들린 보관함: OneDrive가 꽉 참
    keys: ['move-art-keys.webp', 481, 393],          // 열쇠·자물쇠·장부를 묶은 고리: 절대 빼지 않을 것(실제 이사)
  };
  const art = (key, cls) => { const a = ART[key]; return a ? `<img class="${cls}" src="assets/${a[0]}" width="${a[1]}" height="${a[2]}" alt="">` : ''; };

  // 첫 화면 포스터: SHIFT 청금석 면 + 이삿짐 상자 + 큰 「이사」. 왼쪽 위 모노 번호, 오른쪽 위 상태 칩.
  function hero() {
    return `<div class="poster tall" data-word="이사" style="--len:2"><span class="label">01 / YUHOBUILDS TOOL</span><span class="led-chip">실제 이사 기록</span>${art('intro', 'cut')}</div>`;
  }
  // 질문 옆 포스터: 지금 질문의 낱말을 큰 한글로 + 그 질문을 설명하는 펠트 물건. 휴대폰에서는 질문 위의 띠(signal.css).
  function aside(answers, rules, step) {
    const C = root.SynkMoveContent;
    if (!C || !step) return '';
    const list = C.steps.filter(x => !x.when || x.when(answers || {}));
    const i = list.findIndex(x => x.id === step.id);
    const word = step.short || step.eyebrow || '';
    const pad = n => String(n).padStart(2, '0');
    return `<div class="poster step-poster" data-word="${esc(word)}" style="--len:${Math.max(2, [...word.replace(/\s/g, '')].length)}" aria-hidden="true"><span class="label">QUESTION ${pad(i + 1)} / ${pad(list.length)}</span>${art(step.id, 'cut')}</div>`;
  }
  // 첫 질문 팁 안의 비교: 방법마다 막히는 곳.
  function methods() {
    const rows = [['외장 SSD', '인터넷 필요 없음', 'FAT32면 파일 하나 4GB까지'], ['클라우드', '무료 구글 15GB · MS 5GB', '올리는 속도가 곧 시간'], ['직접 연결', '같은 네트워크', '두 PC를 함께 켜 두기']];
    return `<div class="mtable" role="table" aria-label="옮기는 방법 비교">${rows.map(([k, a, b]) => `<div class="mrow" role="row"><b role="cell">${esc(k)}</b><span role="cell">${keepDots(a)}</span><span role="cell">${keepDots(b)}</span></div>`).join('')}</div><p class="vis-cap">Microsoft·Google 공식 문서 기준(10월 17일 확인)이에요.</p>`;
  }
  function visual(key) { return key === 'methods' ? methods() : ''; }

  const head = (no, title) => `<h2><span class="no">${String(no).padStart(2, '0')}</span>${esc(title)}</h2>`;

  function checkList(items, checks, layout, prefix) {
    const quick = layout === 'quick';
    return `<ul class="checks">${items.map(x => `<li><label><input type="checkbox" data-check="${esc(x.id)}"${checks[x.id] ? ' checked' : ''}><span><b>${keepDots(x.t)}${badge(x.src)}</b>${quick ? '' : `<small>${keepDots(x.d)}</small>`}</span></label></li>`).join('')}</ul>`;
  }
  function leaveList(items, layout) {
    const quick = layout === 'quick';
    return `<ul class="checks leave">${items.map(x => `<li><div class="item"><span class="dash" aria-hidden="true"></span><span><b>${keepDots(x.t)}${badge(x.src)}</b>${quick ? '' : `<small>${keepDots(x.d)}</small>`}</span></div></li>`).join('')}</ul>`;
  }
  function cardHtml(c) {
    return `<div class="spec${c.key ? ' key' : ''}"><p class="k">${keepDots(c.k)}</p><p class="v">${keepDots(c.v)}</p>${c.s ? `<p class="s">${keepDots(c.s)}</p>` : ''}</div>`;
  }
  function copyBox(id, label, text, button, primary, done) {
    return `<div class="copybox${primary ? ' main' : ''}"><label for="t-${id}">${esc(label)}</label><textarea id="t-${id}" readonly spellcheck="false">${esc(text)}</textarea><div class="row"><button type="button" class="btn ${primary ? 'primary' : 'soft'}" data-action="copy:${id}"${done ? ` data-done="${esc(done)}"` : ''}>${esc(button)}</button><span class="status" role="status"></span></div></div>`;
  }

  function summaryText(rec, content) {
    const tips = content.TIPS || {};
    const sec = (title, items) => [title, ...items.map(x => `[ ] ${x.t} — ${x.d}`), ''];
    const lines = [
      `yuhobuilds · 내 PC 이사 목록 (${content.checked} 기준)`,
      `${rec.headline.title} ${rec.headline.hl}`, rec.headline.sub, '',
    ];
    if (rec.warns.length) lines.push('[먼저 알아 둘 것]', ...rec.warns.map(w => `※ ${w.t}`), '');
    lines.push(`[00 먼저 확인 · ${content.onedrive.title}]`, ...content.onedrive.steps.map((s, i) => `${i + 1}. ${s.t} — ${s.d}`), '');
    lines.push(...sec('[01 ① 절대 두고 가면 안 되는 것]', rec.must));
    lines.push('[02 ② 두고 와도 되는 것]', ...rec.skip.map(x => `- ${x.t} — ${x.d}`), '');
    lines.push(...sec('[03 ③ 옮긴 뒤 다시 할 것]', rec.redo));
    lines.push(...sec('[04 ④ 끝났는지 확인하는 법]', rec.verify));
    lines.push('[AI한테 이사를 맡길 때 붙여 넣을 요청문]', rec.prompt, '');
    lines.push('[나에게 필요한 팁]', ...rec.tips.filter(id => tips[id]).flatMap(id => [`· ${tips[id].title}`, ...tips[id].body.map(b => `  ${b}`)]), '');
    lines.push('다시 보기: https://synk.im/builds/move/');
    return lines.join('\n');
  }

  function tipCards(rec, content, layout, h2) {
    const tips = content.TIPS || {};
    const ids = rec.tips.filter(id => tips[id]);
    if (!ids.length) return '';
    return `<section class="block">${h2}<p class="sub">고른 답에 맞춰, 왜 그런지와 조심할 점, 신경 쓰지 않아도 되는 것을 골라 드렸어요.</p><div class="tipcards">${ids.map((id, i) => {
      const t = tips[id];
      const open = layout === 'deep' || (layout === 'guided' && i < 2);
      return `<details class="tipcard"${open ? ' open' : ''}><summary>${keepDots(t.title)}</summary><div class="tipbody">${t.body.map(p => `<p>${keepDots(p)}</p>`).join('')}<p class="tipsrc">${[...new Map(t.src.map(s => [(sources()[s] || {}).kind, s])).values()].map(badge).join(' ')}</p></div></details>`;
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
    const warns = rec.warns.map(x => `<div class="warn">${keepDots(x.t)}${badge(x.src)}</div>`).join('');
    const cards = `<div class="specs glance" aria-label="한눈에">${rec.cards.map(cardHtml).join('')}</div>`;

    const od = content.onedrive;
    const onedrive = `<section class="block">${head(0, '먼저 확인 · OneDrive가 멈췄는지')}<p class="sub">질문과 상관없이 모두에게 드리는 확인이에요. 무료 5GB가 차면 바탕화면·문서 백업이 조용히 멈춰요.</p><div class="formbox ex od"><div class="ex-art"><span class="label">ONEDRIVE</span>${art('onedrive', 'cut')}</div><div><p class="eyebrow">${esc(od.title)}</p><ol class="steps">${od.steps.map(s => `<li><div><b>${keepDots(s.t)}${badge(s.src)}</b>${quick ? '' : `<p>${keepDots(s.d)}</p>`}</div></li>`).join('')}</ol><p class="s story-line">${esc(od.story)}</p></div></div></section>`;
    const must = `<section class="block">${head(1, '① 절대 두고 가면 안 되는 것')}<p class="sub">「이미 백업돼 있겠지」 싶어도 빼지 않는 것들이에요. 챙긴 것은 체크해 두세요. 체크는 이 기기에만 남아요.</p>${checkList(rec.must, checks, layout)}</section>`;
    const skip = `<section class="block">${head(2, '② 두고 와도 되는 것')}<p class="sub">다시 받거나 다시 만들어지는 것들이에요. 옮기지 않는 만큼 이사가 빨라져요.</p>${leaveList(rec.skip, layout)}</section>`;
    const redo = `<section class="block">${head(3, '③ 옮긴 뒤 다시 할 것')}<p class="sub">로그인·설치·권한은 복사로 넘어오지 않아요. 첫 줄은 파일을 넣기 전에 해요.</p>${checkList(rec.redo, checks, layout)}</section>`;
    const verify = `<section class="block">${head(4, '④ 끝났는지 확인하는 법')}<p class="sub">「복사 완료」가 아니라 옛 컴퓨터와 맞춰 본 뒤가 끝이에요.</p>${checkList(rec.verify, checks, layout)}<div class="prompt-wrap"><p class="sub">이사를 AI한테 맡긴다면, 쓰는 AI의 새 대화에 이 요청문을 그대로 붙여 넣으세요. 내 답이 채워져 있어요.</p>${copyBox('prompt', 'AI한테 이사를 맡길 때 붙여 넣을 요청문', rec.prompt, '요청문 복사', true, '요청문을 복사했어요. 쓰는 AI의 새 대화에 붙여 넣으세요.')}</div></section>`;
    const tipsHtml = tipCards(rec, content, layout, head(5, '나에게 필요한 팁'));
    const st = content.story;
    const story = `<section class="block">${head(6, st.title)}<p class="sub">영상에서 보여 드린 노트북 이사의 실제 기록이에요. 이 목록의 순서는 여기서 나왔어요.</p><div class="formbox ex story"><div class="ex-art"><span class="label">10.15–10.17</span>${art('keys', 'cut')}</div><div><dl class="facts">${st.rows.map(x => `<div><dt>${esc(x.k)}</dt><dd>${keepDots(x.v)}</dd></div>`).join('')}</dl><p class="s story-line">${esc(st.note)}${badge('synk-move')}</p></div></div></section>`;
    const saveRow = `<section class="block">${head(7, '저장하고 다시 보기')}<div class="take"><button type="button" class="btn soft" data-action="share">내 결과 링크 복사</button><button type="button" class="btn soft" data-action="copy:all" data-what="결과 전체">결과 전체 복사</button><button type="button" class="btn soft" data-action="print">PDF로 저장·인쇄</button><span class="status" role="status" style="flex-basis:100%"></span></div><p class="hint">인스타그램 안에서 열었다면 오른쪽 위 메뉴에서 ‘외부 브라우저로 열기’를 누르면 복사와 저장이 더 잘 돼요.</p></section>`;
    const fbMsg = { helpful: '고마워요. 다음에도 이렇게 보여 드릴게요.', too_much: '알겠어요. 다음에 이 기기에서 열면 간단히 보여 드릴게요.', want_more: '알겠어요. 다음에 이 기기에서 열면 자세히 보여 드릴게요.', not_fit: '알려 주셔서 고마워요. 어떤 점이 안 맞았는지 yuhobuilds 댓글이나 DM으로 알려 주시면 다음 판에 반영할게요.' };
    const fb = `<section class="block">${head(8, '이 목록, 도움이 됐나요?')}<div class="fb" role="group" aria-label="목록에 대한 반응">${[['helpful', '도움이 됐어요'], ['too_much', '너무 많아요'], ['want_more', '더 자세히 알고 싶어요'], ['not_fit', '나와 안 맞아요']].map(([id, t]) => `<button type="button" class="glass chip" aria-pressed="${feedbackGiven === id}" data-action="feedback:${id}"${feedbackGiven ? ' disabled' : ''}>${t}</button>`).join('')}</div><p class="fbnote">${feedbackGiven ? esc(fbMsg[feedbackGiven]) : '답은 이 기기에만 저장되고, 다음에 이 도구를 열 때 보여 주는 분량에 반영돼요.'}</p></section>`;
    const editable = content.steps.filter(s => !s.when || s.when(ctx.answers)).map(s => `<button type="button" class="glass chip" data-action="edit:${esc(s.id)}">${esc(s.short || s.eyebrow || s.title)}</button>`).join('');
    const edit = `<section class="block no-print">${head(9, '답 바꿔 보기')}<p class="sub">하나만 바꿔도 목록과 요청문이 다시 만들어져요.</p><div class="take">${editable}</div></section>`;

    const used = new Set(rec.sourcesUsed);
    const tipBank = content.TIPS || {};
    for (const id of rec.tips) for (const s of (tipBank[id] || {}).src || []) used.add(s);
    const srcList = Object.entries(content.SOURCES).filter(([id]) => used.has(id) || id === 'synk');
    const sourcesBox = `<details class="sources"${deep ? ' open' : ''}><summary>출처와 기준 (${esc(content.checked)} 확인)</summary><ul>${srcList.map(([, s]) => `<li><span class="src ${esc(s.kind)}">${KIND_TEXT[s.kind]}</span> ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ul><p>이 화면은 내 컴퓨터의 파일을 읽지 않고 AI도 부르지 않아요. 목록과 요청문은 고른 답으로 이 화면 안에서 만들어요. 메뉴 이름과 무료 용량은 업데이트에 따라 바뀔 수 있어요.</p></details>`;

    const html = `<article class="result"><header class="r-top"><p class="rec"><span class="sticker">${esc(content.checked.replace(/-/g, '.'))} 기준</span><span>${esc(content.series)} · 내 PC 이사 목록</span></p><h1 id="q" tabindex="-1">${keepDots(rec.headline.title)}<br><span class="hl">${keepDots(rec.headline.hl)}</span></h1><p>${esc(rec.headline.sub)}</p>${because ? `<p class="because">${esc(because)}</p>` : ''}<figure class="shot cut${ART[rec.art] && ART[rec.art][1] > ART[rec.art][2] * 1.3 ? ' wide' : ''}" aria-hidden="true">${art(rec.art, '')}</figure></header><div class="layout"><span>보기</span><div class="seg" role="radiogroup" aria-label="결과 분량">${seg}</div></div>${warns}${cards}${onedrive}${must}${skip}${redo}${verify}${tipsHtml}${story}${saveRow}${fb}${edit}${sourcesBox}<div class="nav no-print"><button type="button" class="btn ghost" data-action="restart">처음부터 다시</button></div><div class="dock no-print" role="group" aria-label="바로 쓰기"><button type="button" class="btn primary" data-proxy="copy:prompt">요청문 복사</button><button type="button" class="btn soft" data-proxy="share">내 결과 링크</button></div></article>`;
    return { html, texts: { prompt: rec.prompt, all: summaryText(rec, content) } };
  }

  return Object.freeze({ hero, visual, aside, result, ART });
});
