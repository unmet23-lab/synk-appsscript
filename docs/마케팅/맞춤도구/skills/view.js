/* synkbrief 뉴스 · 내 GPTs·젬 옮기기 점검 — 그림과 결과 화면.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/skills/view.js
 * rules.compute()가 낸 값을 그린다. 여기서 추천을 새로 계산하지 않는다(D-몇 표시만 rules.days를 부른다).
 * 결과 순서(추천기준 §6): 머리 → 낱말 풀이 → 내 날짜 → 이 순서대로(단계마다 실제 앱 화면) → 「여기까지 하면 돼요」·더 보기
 *   → (기본·자세히) 안 따라오는 것·괜찮은 것 → 비교 메모 → 팁 → 옮긴 뒤 확인 → 나머지. 처음 값은 간단히(index.html defaultLayout).
 *   10-17 검수(검수_fable_20261017.md): 처음 쓰는 사람에겐 15화면이 너무 길었고, ChatGPT 안에서 할 일을 그림 없이 글로만 줬다.
 * 틀은 카타나 도구(katana/view.js)와 같다 — 싱ㅋ 시그널(core/signal.css)의 같은 부품을 쓴다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.SynkSkillsView = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KIND_TEXT = { official: '공식', seen: 'SYNK 확인', synk: 'SYNK 판단', community: '커뮤니티' };
  // 「·」로 이은 말은 한 덩어리로 묶는다(카타나와 같은 규칙).
  const keepDots = s => esc(s).replace(/[^\s·]+(?:·[^\s·]+)+/g, m => `<span class="nw">${m}</span>`);
  let SOURCES = {};

  const sources = () => (Object.keys(SOURCES).length ? SOURCES : ((root.SynkSkillsContent || {}).SOURCES || {}));
  function badge(src) {
    const all = sources();
    const s = all[src] || all.synk || { kind: 'synk', label: '' };
    return `<span class="src ${esc(s.kind)}" title="${esc(s.label)}">${KIND_TEXT[s.kind] || ''}</span>`;
  }
  // 공식 배지는 상자 설명에 한 번만 쓰고, 줄마다는 SYNK 판단·커뮤니티만 붙인다(10-17 「공식」이 한 화면에 25번).
  const softBadge = src => { const s = sources()[src]; return s && s.kind !== 'official' ? badge(src) : ''; };
  const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

  // 화면마다 내용을 설명하는 펠트 그림(10-17 GPT 이미지 2.5로 한 판에 구워 오림 — 판·지시문은
  // docs/마케팅/synkbrief_GPTs젬_스킬전환_20261017/그림/). 같은 그림을 되풀이하지 않는다.
  const ART = {
    intro: ['skills-art-intro.webp', 348, 366],     // 두 날짜에 동그라미 친 탁상 달력: 언제까지
    where: ['skills-art-where.webp', 417, 250],     // 보석(젬)과 말풍선 상자(GPT): 어디에
    who: ['skills-art-who.webp', 296, 360],         // 이름표 달린 열쇠: 만든 사람만 옮긴다
    account: ['skills-art-account.webp', 419, 330], // 집·회사·학교: 계정마다 날짜가 다르다
    gptHas: ['skills-art-gpthas.webp', 369, 433],   // 열린 상자 속 서류철·플러그·고리: GPT 안에 든 것
    gemHas: ['skills-art-gemhas.webp', 382, 362],   // 보석과 필름·음표·돋보기: 젬과 같이 쓰던 기능
    result: ['skills-art-result.webp', 289, 414],   // 체크 붙은 클립보드: 내 할 일
  };
  const art = (key, cls) => { const a = ART[key]; return a ? `<img class="${cls}" src="assets/${a[0]}" width="${a[1]}" height="${a[2]}" alt="">` : ''; };
  const R = () => root.SynkSkillsRules;

  // 첫 화면 포스터: SHIFT 청금석 면 + 펠트 달력 + 아주 큰 「스킬」. 오른쪽 위 상태 칩은 GPTs 종료까지 남은 날.
  function hero() {
    const rules = R();
    const n = rules ? rules.days('2026-12-11') : null;
    const chip = n == null ? 'GPTs 12.11 종료' : n > 0 ? `GPTs 종료 D-${n}` : 'GPTs 종료됨';
    return `<div class="poster tall" data-word="스킬" style="--len:2"><span class="label">01 / SYNKBRIEF TOOL</span><span class="led-chip alert">${esc(chip)}</span>${art('intro', 'cut')}</div>`;
  }
  function marked(title, marks) {
    const t = esc(title);
    for (const m of marks) { const e = esc(m); const i = t.indexOf(e); if (m && i >= 0) return `${t.slice(0, i)}<span class="hl nw">${e}</span>${t.slice(i + e.length)}`; }
    return t;
  }
  const head = (no, title) => `<h2><span class="no">${String(no).padStart(2, '0')}</span>${esc(title)}</h2>`;

  // 두 날짜 줄: 젬 11.17 · GPTs 12.11, 오늘 기준 D-몇.
  function timeline() {
    const rules = R();
    const rows = [['제미나이 젬', '2026-11-17', '11.17', '스킬로 저절로 이전 시작'], ['ChatGPT GPTs', '2026-12-11', '12.11', '종료 · 직접 옮겨야 함']];
    const html = rows.map(([k, d, short, s]) => {
      const n = rules ? rules.days(d) : null;
      const dl = n == null ? '' : rules.dLabel(n, true);
      return `<div class="row" style="display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:4px 12px;margin:8px 0"><span style="font-weight:600;color:var(--ink)">${esc(k)}<small style="display:block;margin-top:2px;font-size:13px;font-weight:450;color:var(--ink-3)">${keepDots(s)}</small></span><span style="font-family:var(--latin,inherit);font-weight:600;white-space:nowrap;color:var(--ink)">${esc(short)}${dl ? ` · ${esc(dl)}` : ''}</span></div>`;
    }).join('');
    return `<div class="pool" role="img" aria-label="제미나이 젬은 11월 17일부터 스킬로 자동 이전, ChatGPT GPTs는 12월 11일 종료"><div class="p" style="grid-column:1/-1">${html}</div></div><p class="vis-cap" style="font-size:13px;color:var(--faint);margin:8px 0 0">개인 계정 기준이에요. 회사·학교 계정은 다음 질문에서 고르면 바뀌어요.</p>`;
  }
  function visual(key) {
    if (key === 'timeline') return timeline();
    return '';
  }
  // 질문 옆 포스터: 지금 질문의 낱말을 큰 한글로 + 그 질문을 설명하는 펠트 그림.
  function aside(answers, rules, step) {
    const C = root.SynkSkillsContent;
    if (!C || !step) return '';
    const list = C.steps.filter(x => !x.when || x.when(answers || {}));
    const i = list.findIndex(x => x.id === step.id);
    const word = step.short || step.eyebrow || '';
    const pad = n => String(n).padStart(2, '0');
    const width = [...word].reduce((n, ch) => n + (/[가-힣]/.test(ch) ? 1 : /\s/.test(ch) ? 0.3 : /[A-Z]/.test(ch) ? 0.62 : 0.55), 0);
    return `<div class="poster step-poster" data-word="${esc(word)}" style="--len:${Math.max(2, Math.round(width * 100) / 100)}" aria-hidden="true"><span class="label">QUESTION ${pad(i + 1)} / ${pad(list.length)}</span>${art(step.id, 'cut')}</div>`;
  }

  function copyBox(id, label, text, button, primary, rows, done) {
    return `<div class="copybox${primary ? ' main' : ''}"><label for="t-${id}">${esc(label)}</label><textarea id="t-${id}" readonly spellcheck="false"${rows ? ` style="min-height:${rows}px"` : ''}>${esc(text)}</textarea><div class="row"><button type="button" class="btn ${primary ? 'primary' : 'soft'}" data-action="copy:${id}"${done ? ` data-done="${esc(done)}"` : ''}>${esc(button)}</button><span class="status" role="status"></span></div></div>`;
  }

  function dateCard(c, layout) {
    const note = c.note ? `<ul class="why"><li>${keepDots(c.note)}${badge(c.src)}</li></ul>` : '';
    return `<div class="spec${c.key ? ' key' : ''}"><p class="k">${keepDots(c.k)}</p><p class="v">${keepDots(c.v)}${c.d ? ` · ${esc(c.d)}` : ''}</p><p class="s">${keepDots(c.s)} ${badge(c.src)}</p>${note}</div>`;
  }

  function summaryText(rec, content) {
    const tips = content.TIPS || {};
    const lines = [
      `synkbrief 뉴스 · 내 GPTs·젬 옮기기 점검 (${content.checked} 기준)`,
      rec.headline.title, [rec.headline.sub, rec.headline.more].filter(Boolean).join(' '), '',
      '[내 날짜]', ...rec.cards.map(c => `- ${c.k}: ${c.v}${c.d ? ` (${c.d})` : ''} — ${c.s}${c.note ? ` · ${c.note}` : ''}`), '',
    ];
    for (const g of rec.groups) lines.push(`[${g.title} · 이 순서대로]`, ...g.steps.map((x, i) => `${i + 1}. ${x.t} — ${x.d}`), '');
    if (rec.ask) lines.push('[만든 사람에게 보낼 한 줄]', rec.ask, '');
    if (rec.warns.length) lines.push('[먼저 알아 둘 것]', ...rec.warns.map(w => `※ ${w.t}`), '');
    if (rec.carry.length) lines.push('[옮겨도 안 따라오는 것]', ...rec.carry.map(x => `- ${x.t}`), '');
    if (rec.relax.length) lines.push('[신경 쓰지 않아도 되는 것]', ...rec.relax.map(x => `- ${x.t}`), '');
    lines.push('[나에게 필요한 팁]', ...rec.tips.filter(id => tips[id]).flatMap(id => [`· ${tips[id].title}`, ...tips[id].body.map(b => `  ${b}`)]), '');
    if (rec.checklist.length) lines.push('[옮긴 뒤 확인할 것]', ...rec.checklist.map(c => `[ ] ${c.t}: ${c.d}`), '');
    lines.push('다시 보기: https://synk.im/brief/skills/');
    return lines.join('\n');
  }

  function tipCards(rec, content, layout, h2) {
    const tips = content.TIPS || {};
    const ids = rec.tips.filter(id => tips[id]);
    if (!ids.length) return '';
    const card = id => {
      const t = tips[id];
      return `<details class="tipcard"${layout === 'deep' ? ' open' : ''}><summary>${keepDots(t.title)}</summary><div class="tipbody">${t.body.map(p => `<p>${keepDots(p)}</p>`).join('')}<p class="tipsrc">${[...new Map(t.src.map(s => [(sources()[s] || {}).kind, s])).values()].map(badge).join(' ')}</p></div></details>`;
    };
    const first = layout === 'deep' ? ids : ids.slice(0, 4), rest = layout === 'deep' ? [] : ids.slice(4);
    const more = rest.length ? `<details class="more"><summary>팁 ${rest.length}개 더 보기</summary><div class="tipcards" style="margin-top:8px">${rest.map(card).join('')}</div></details>` : '';
    return `<section class="block">${h2}<p class="sub">고른 답에 맞춰, 왜 그런지와 조심할 점을 골라 드렸어요. 눌러서 펼쳐 보세요.</p><div class="tipcards">${first.map(card).join('')}</div>${more}</section>`;
  }

  function shot(x) {
    return `<figure class="guide-shot"><a href="${esc(x.src)}" target="_blank" rel="noopener"><img src="${esc(x.src)}" width="${x.w}" height="${x.h}" alt="${esc(x.alt)}"></a><figcaption>${keepDots(x.cap)} 누르면 크게 보여요.</figcaption></figure>`;
  }
  // 할 일 한 줄: 제목 · 설명 · 실제 앱 화면 · 바로 가기 · (남이 만든 GPT) 보낼 한 줄
  function stepLi(x, rec) {
    const link = x.link ? `<p class="step-link"><a class="btn soft" href="${esc(x.link.href)}" target="_blank" rel="noopener">${esc(x.link.label)} ${ARROW}</a></p>` : '';
    const copy = x.copy === 'ask' && rec.ask ? copyBox('ask', '만든 사람에게 보낼 한 줄', rec.ask, '한 줄 복사', true, 0, '복사했어요. 그 GPT를 알려 준 사람에게 보내 보세요.') : '';
    return `<li><div><b>${keepDots(x.t)}</b>${x.d ? `<p>${keepDots(x.d)}${x.src ? softBadge(x.src) : ''}</p>` : ''}${x.img ? shot(x.img) : ''}${link}${copy}</div></li>`;
  }

  function result(ctx) {
    const { rec, layout, plan, checks, feedbackGiven, content } = ctx;
    SOURCES = content.SOURCES;
    const deep = layout === 'deep', quick = layout === 'quick';
    const f = rec.f;
    const because = plan && plan.selected && plan.selected.id === layout
      ? (plan.reasons.includes('feedback.too_much') ? '지난번에 ‘너무 많아요’라고 하셔서 간단히 보여 드려요. 이 기기에 저장된 답을 기준으로 했어요.' : plan.reasons.includes('feedback.want_more') ? '지난번에 ‘더 자세히’를 고르셔서 자세히 보여 드려요. 이 기기에 저장된 답을 기준으로 했어요.' : '')
      : '';
    const seg = [['quick', '간단히'], ['guided', '기본'], ['deep', '자세히']].map(([id, t]) => `<button type="button" class="glass chip" role="radio" aria-checked="${id === layout}" data-action="layout:${id}">${t}</button>`).join('');
    const warns = rec.warns.map(x => `<div class="warn">${keepDots(x.t)}${badge(x.src)}</div>`).join('');
    let n = 0;
    const H = title => head(++n, title);
    const mine = f.gptMine || f.gemMine;
    const now = new Date();
    const today = `${now.getMonth() + 1}월 ${now.getDate()}일`;

    // 낯선 낱말 두 개는 결과 맨 위에서 푼다(GPT만 쓰는 사람도 「스킬」을 보게).
    const words = [];
    if (f.gpt) words.push(['플러그인', 'ChatGPT에서 지침(스킬)·파일·연결한 앱을 한데 묶은 것이에요. GPT를 옮기면 플러그인이 돼요.']);
    words.push(['스킬', f.gem ? '자주 쓰는 지시를 저장해 두고 이름으로 불러 쓰는 것이에요. 제미나이는 채팅창에 「/」를 쳐서 불러요.' : '자주 쓰는 지시를 저장해 두고 이름으로 불러 쓰는 것이에요. 플러그인 안에 들어 있어요.']);
    const inApp = typeof navigator !== 'undefined' && /Instagram|FBAN|FBAV|Threads/i.test(navigator.userAgent || '');
    const inAppWarn = inApp && rec.primary && rec.primary.kind === 'link' ? `<div class="warn">인스타그램 안에서 열렸어요. 아래 「${esc(rec.primary.label)}」가 로그인 화면에서 막히면 오른쪽 위 ⋯ 메뉴 → ‘외부 브라우저로 열기’를 누르세요.</div>` : '';
    const gloss = `<p class="gloss">${words.map(([k, v]) => `<span><b>${esc(k)}</b>${keepDots(v)}</span>`).join('')}</p>`;

    const dates = `<section class="block">${H('내 날짜')}<p class="sub">D-몇은 오늘(${esc(today)}) 기준이에요.</p><div class="specs">${rec.cards.map(c => dateCard(c, layout)).join('')}</div></section>`;
    const flows = `<section class="block">${H('이 순서대로 하세요')}<p class="sub">위에서부터 하나씩 하면 돼요. 날짜와 할 일은 공식 안내 기준이에요.</p>${rec.groups.map(g => `<section class="formbox"><p class="eyebrow">${g.id === 'gem-mine' ? '기다리면 되고, 옮겨진 뒤 확인' : g.id === 'gem-others' ? '확인할 것' : `${g.steps.length}단계`}</p><h2>${esc(g.title)}</h2><ol class="steps">${g.steps.map(x => stepLi(x, rec)).join('')}</ol></section>`).join('')}<p class="hint">인스타그램 안에서 열었다면 오른쪽 위 메뉴에서 ‘외부 브라우저로 열기’를 누르면 ${f.gpt ? 'ChatGPT' : '제미나이'} 로그인과 복사가 잘 돼요.</p></section>`;
    const gemOnlyWait = !f.gptMine && f.gemMine && !(f.gpt && f.others);
    const doneText = gemOnlyWait ? '지금은 할 일이 없어요. 옮겨지는 날 뒤에 이 화면을 다시 열어 확인할 것만 보면 돼요.' : '여기까지 하면 돼요.';
    const more = [(rec.carry.length || rec.relax.length) && '따라오는 것', mine && '비교 메모', rec.tips.length && '팁', rec.checklist.length && '옮긴 뒤 확인표'].filter(Boolean);
    const doneline = `<div class="doneline no-print"><p><b>${esc(doneText)}</b> ${quick ? (more.length ? `「기본」을 고르면 ${esc(more.join(', '))}도 볼 수 있어요.` : '') : '아래는 더 꼼꼼히 하고 싶을 때 보세요.'}</p><div class="layout"><span>보기</span><div class="seg" role="radiogroup" aria-label="결과 분량">${seg}</div></div></div>`;
    const yesNo = !quick && (rec.carry.length || rec.relax.length) ? `<section class="block">${H('따라오는 것과 안 따라오는 것')}<p class="sub">고른 답에 해당하는 것만 골랐어요. 공식 안내 기준이에요.</p><ul class="why npu">${rec.carry.map(x => `<li><b class="no">안 따라와요</b> ${keepDots(x.t)}${softBadge(x.src)}</li>`).join('')}${rec.relax.map(x => `<li><b class="yes">괜찮아요</b> ${keepDots(x.t)}${softBadge(x.src)}</li>`).join('')}</ul></section>` : '';
    const take = !quick && mine ? `<section class="block">${H('꼼꼼히 하고 싶다면 · 비교 메모')}<p class="sub">옮기기 전에 자주 쓰던 질문 셋과 어려운 질문 하나, 지금 답을 메모해 두고, 옮긴 뒤 같은 질문으로 비교해 보세요.</p>${copyBox('memo', '옮기기 전후 비교 메모', rec.memo, '비교 메모 복사', false, 0, '비교 메모를 복사했어요. 메모장에 붙여 넣고 질문을 적어 두세요.')}</section>` : '';
    const tipsHtml = quick ? '' : tipCards(rec, content, layout, H('나에게 필요한 팁'));
    const checklist = quick || !rec.checklist.length ? '' : `<section class="block">${H('옮긴 뒤 확인할 것')}<p class="sub">체크한 내용은 이 기기에 남아요.</p><ul class="checks">${rec.checklist.map(c => `<li><label><input type="checkbox" data-check="${esc(c.id)}"${checks[c.id] ? ' checked' : ''}><span><b>${keepDots(c.t)}</b><small>${keepDots(c.d)}</small></span></label></li>`).join('')}</ul></section>`;
    const saveRow = `<section class="block">${H('저장하고 다시 보기')}<div class="take"><button type="button" class="btn soft" data-action="share">내 결과 링크 복사</button><button type="button" class="btn soft" data-action="copy:all" data-what="결과 전체">결과 전체 복사</button><button type="button" class="btn soft" data-action="print">PDF로 저장·인쇄</button><span class="status" role="status" style="flex-basis:100%"></span></div></section>`;
    const fbMsg = { helpful: '고마워요. 다음에도 이렇게 보여 드릴게요.', too_much: '알겠어요. 다음에 이 기기에서 열면 간단히 보여 드릴게요.', want_more: '알겠어요. 다음에 이 기기에서 열면 자세히 보여 드릴게요.', not_fit: '알려 주셔서 고마워요. 어떤 점이 안 맞았는지 synkbrief 댓글이나 DM으로 알려 주시면 다음 버전에 반영할게요.' };
    const fb = `<section class="block">${H('이 점검, 도움이 됐나요?')}<div class="fb" role="group" aria-label="점검 결과에 대한 반응">${[['helpful', '도움이 됐어요'], ['too_much', '너무 많아요'], ['want_more', '더 자세히 알고 싶어요'], ['not_fit', '나와 안 맞아요']].map(([id, t]) => `<button type="button" class="glass chip" aria-pressed="${feedbackGiven === id}" data-action="feedback:${id}"${feedbackGiven ? ' disabled' : ''}>${t}</button>`).join('')}</div><p class="fbnote">${feedbackGiven ? esc(fbMsg[feedbackGiven]) : '답은 이 기기에만 저장되고, 다음에 이 도구를 열 때 보여 주는 분량에 반영돼요.'}</p></section>`;

    const used = new Set(rec.sourcesUsed);
    const tipBank = content.TIPS || {};
    for (const id of rec.tips) for (const s of (tipBank[id] || {}).src || []) used.add(s);
    const srcList = Object.entries(content.SOURCES).filter(([id]) => used.has(id) || id === 'synk');
    const sourcesBox = `<details class="sources"${deep ? ' open' : ''}><summary>출처와 기준 (${esc(content.checked)} 확인)</summary><ul>${srcList.map(([, s]) => `<li><span class="src ${esc(s.kind)}">${KIND_TEXT[s.kind]}</span> ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ul><p style="font-size:14px;color:var(--muted)">이 화면은 GPT나 젬의 내용을 받지 않고 AI도 부르지 않아요. 날짜와 할 일은 고른 답으로 이 화면 안에서 계산해요. 메뉴 이름과 일정은 업데이트에 따라 바뀔 수 있어요.</p></details>`;
    const editable = content.steps.filter(s => !s.when || s.when(ctx.answers)).map(s => `<button type="button" class="glass chip" data-action="edit:${esc(s.id)}">${esc(s.short || s.eyebrow || s.title)}</button>`).join('');
    const edit = `<section class="block no-print">${H('답 바꿔 보기')}<p class="sub">하나만 바꿔도 날짜와 할 일이 다시 나와요.</p><div class="take">${editable}</div></section>`;

    // 떠 있는 주 단추: 갈래마다 다음에 할 일 하나(내 GPT 열기 · Gems 열기 · 만든 사람에게 보낼 한 줄).
    const p = rec.primary;
    const main = !p ? '<button type="button" class="btn primary" data-proxy="share">내 결과 링크</button>'
      : p.kind === 'link' ? `<a class="btn primary" href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.label)} ${ARROW}</a>`
        : `<button type="button" class="btn primary" data-proxy="copy:${esc(p.id)}">${esc(p.label)}</button>`;
    const dock = `<div class="dock no-print" role="group" aria-label="다음에 할 일">${main}${p ? '<button type="button" class="btn soft" data-proxy="share">내 결과 링크</button>' : ''}</div>`;
    const html = `<article class="result"><header class="r-top"><p class="rec"><span class="sticker">${esc(content.checked.replace(/-/g, '.'))} 확인</span><span>${esc(content.series)} · 내 GPTs·젬 점검</span></p><h1 id="q" tabindex="-1">${marked(rec.headline.title, [rec.headline.mark])}</h1><p>${esc(rec.headline.sub + (quick || !rec.headline.more ? '' : ' ' + rec.headline.more)).replace(/(?:젬|GPTs) \d+월 \d+일\(D-\d+\)|\d+월 \d+일\(D-\d+\)|D-\d+/g, m => `<span class="nw">${m}</span>`)}</p>${because ? `<p class="because">${esc(because)}</p>` : ''}<figure class="shot cut" aria-hidden="true">${art('result', '')}</figure></header>${gloss}${inAppWarn}${warns}${dates}${flows}${doneline}${yesNo}${take}${tipsHtml}${checklist}${saveRow}${fb}${edit}${sourcesBox}<div class="nav no-print"><button type="button" class="btn ghost" data-action="restart">처음부터 다시</button></div>${dock}</article>`;
    const texts = { memo: rec.memo, all: summaryText(rec, content), ask: rec.ask };
    return { html, texts };
  }

  return Object.freeze({ hero, visual, aside, result });
});
