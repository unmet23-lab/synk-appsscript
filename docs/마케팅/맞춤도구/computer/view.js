/* synkbrief 기초 · AI 컴퓨터 맞춤 추천 — 그림과 결과 화면 v2.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/computer/view.js
 * rules.compute()가 낸 값을 그린다. 여기서 사양을 새로 계산하지 않는다.
 * 결과 순서(추천기준 §11): 형태와 핵심 사양 → 왜 이 형태인가 → 사양 카드(가성비/여유) → 돈 쓰는 순서 → 나에게 필요한 팁 → 나머지.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.SynkComputerView = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (Math.round(n * 10) / 10).toString();
  const TIER_LIST = [4, 8, 12, 16, 24, 32, 64];
  const KIND_TEXT = { official: '공식', synk: 'SYNK 판단', community: '커뮤니티' };
  let SOURCES = {};

  const sources = () => (Object.keys(SOURCES).length ? SOURCES : ((root.SynkComputerContent || {}).SOURCES || {}));
  function badge(src) {
    const all = sources();
    const s = all[src] || all.synk || { kind: 'synk', label: '' };
    return `<span class="src ${esc(s.kind)}" title="${esc(s.label)}">${KIND_TEXT[s.kind] || ''}</span>`;
  }
  const reasonLi = x => `<li>${esc(x.t)}${badge(x.src)}</li>`;

  // 첫 화면: 승인 펠트 노트북 위에 펠트 스티커를 붙인 콜라주(v3 리디자인).
  function hero() {
    return '<div class="collage"><span class="spark"></span><img class="main" src="assets/laptop-felt.webp" width="320" height="320" alt=""><img class="stk s1" src="assets/sticker-time.webp" alt=""><img class="stk s2" src="assets/sticker-search.webp" alt=""><img class="stk s3" src="assets/sticker-check.webp" alt=""></div>';
  }
  // 제목에서 한 구절을 손그림 형광펜으로 강조한다. 없으면 그대로 둔다.
  function marked(title, marks) {
    const t = esc(title);
    for (const m of marks) { const e = esc(m); const i = t.indexOf(e); if (m && i >= 0) return `${t.slice(0, i)}<span class="hl">${e}</span>${t.slice(i + e.length)}`; }
    return t;
  }
  const sticker = (name, r) => `<img class="stk" src="assets/sticker-${name}.webp" alt=""${r ? ` style="--r:${r}deg"` : ''}>`;
  const head = (no, title, stk, r) => `<h2><span class="no">${String(no).padStart(2, '0')}</span>${esc(title)}${stk ? sticker(stk, r) : ''}</h2>`;

  // 책상(램) 한 장: 올린 물건이 책상보다 크면 넘친 만큼을 서랍(SSD) 줄로 보여 준다.
  function desk(blocks, deskGB) {
    let used = 0, over = 0;
    const inside = [];
    for (const b of blocks) {
      const room = Math.max(0, deskGB - used);
      const put = Math.min(room, b.gb);
      if (put > 0.05) inside.push({ ...b, put });
      over += b.gb - put; used += b.gb;
    }
    const cells = inside.map(b => {
      const pct = (b.put / deskGB) * 100;
      return `<div class="blk ${esc(b.tone)}" style="flex:0 0 calc(${pct.toFixed(2)}% - 3px)" title="${esc(b.label)} · 약 ${fmt(b.gb)}GB">${pct >= 13 ? `<span>${esc(b.label)}</span>` : ''}</div>`;
    }).join('');
    const aria = `${deskGB}GB 책상에 약 ${fmt(used)}GB를 펼친 그림. ${over > 0.05 ? `약 ${fmt(over)}GB가 넘쳐요.` : `약 ${fmt(Math.max(0, deskGB - used))}GB가 남아요.`}`;
    const free = deskGB - used;
    const drawer = over > 0.05
      ? `<p class="drawer"><i></i><span>책상에 못 올린 약 ${fmt(over)}GB는 서랍(SSD)을 오가요. 창을 바꿀 때마다 멈칫해요.</span></p>`
      : free < 1 ? '<p class="drawer" style="color:var(--butter-deep)"><span>책상에 딱 맞아요. 창을 많이 더 열면 느려질 수 있어요.</span></p>'
      : free < deskGB * 0.2 ? `<p class="drawer" style="color:var(--butter-deep)"><span>여유 약 ${fmt(free)}GB · 딱 맞는 가성비예요</span></p>`
      : `<p class="drawer" style="color:var(--meadow-deep)"><span>여유 약 ${fmt(free)}GB · 넉넉해요</span></p>`;
    return `<div class="desk" role="img" aria-label="${esc(aria)}"><div class="surface"><div class="blocks">${cells}</div></div>${drawer}</div>`;
  }
  function legend(blocks) {
    const color = { base: '#e3e5e8', lapis: 'var(--brand-soft)', meadow: 'var(--meadow-soft)', butter: 'var(--butter-soft)', pop: 'var(--pop-soft)', coral: 'var(--coral-wash)' };
    return `<ul class="legend">${blocks.map(b => `<li><i style="background:${color[b.tone] || '#eee'}"></i>${esc(b.label)} 약 ${fmt(b.gb)}GB</li>`).join('')}</ul>`;
  }

  function tiersInner(rec, R, sel, list) {
    const note = R.TIER_NOTES.find(t => t.gb === sel);
    const noteText = note ? `${esc(note.t)}${badge(note.src)}` : (sel > 64 ? '아주 큰 AI 모델이나 전문 작업용이에요. 대부분의 사람에겐 필요 이상이에요.' : '');
    const mark = g => (g === rec.ram.value ? ' · 가성비' : g === rec.ram.roomy && rec.ram.roomy > rec.ram.value ? ' · 여유' : '');
    return `<div class="tiers" role="radiogroup" aria-label="램 용량 비교">${list.map(g => `<button type="button" class="glass chip" role="radio" aria-checked="${g === sel}" data-tier="${g}">${g}GB${mark(g)}</button>`).join('')}</div>${desk(rec.blocks, sel)}<p class="tier-note"><b>${sel}GB</b> · ${noteText}</p>`;
  }
  function tiers(answers, R, sel) {
    const rec = R.compute(answers);
    const list = [...new Set([...TIER_LIST, rec.ram.value])].sort((a, b) => a - b);
    // 처음에는 가성비 추천 용량을 보여 준다(16GB 기준점). 8GB는 눌러서 비교한다.
    return `<div data-tiers data-list="${list.join(',')}">${tiersInner(rec, R, sel || rec.ram.value, list)}</div><p class="vis-cap" style="font-size:13px;color:var(--faint);margin:8px 0 0">책상 위 물건은 지금까지 고른 작업이에요. 용량을 눌러 비교해 보세요.</p>`;
  }

  function visual(key, answers) {
    const R = root.SynkComputerRules;
    if (key === 'server') {
      return `<div class="lanes" role="img" aria-label="웹 AI는 서버가 계산하고, 설치형 AI는 내 컴퓨터가 계산한다는 그림"><div class="lane"><b>웹 AI</b><div class="flow"><span class="node">내 컴퓨터 · 질문 입력</span><span class="arr">→</span><span class="node hot">AI 회사 서버 · 계산</span><span class="arr">→</span><span class="node">답이 화면에</span></div></div><div class="lane"><b>설치형 AI</b><div class="flow"><span class="node hot">내 컴퓨터 · 질문 입력과 계산 모두</span><span class="arr">→</span><span class="node">답이 화면에</span></div></div></div>`;
    }
    if (key === 'tiers') return tiers(answers, R);
    if (key === 'res') {
      return `<div class="cmp" role="img" aria-label="4K 한 장면은 FHD 네 장면 크기"><figure><div class="box" style="aspect-ratio:16/9;width:50%;margin:0 auto"></div><figcaption>FHD 1920×1080</figcaption></figure><figure><div class="grid4"><i></i><i></i><i></i><i></i></div><figcaption>4K 3840×2160 = FHD 4장</figcaption></figure></div>`;
    }
    if (key === 'models') {
      const rows = [['4B', 2.5], ['8B', 5.2], ['14B', 9.3], ['32B', 20], ['70B', 43]];
      return `<ul class="bars" aria-label="대화 AI 모델 크기별 압축판 파일 크기">${rows.map(([n, g]) => `<li><span>${n}</span><span class="rail"><i style="width:${((g / 48) * 100).toFixed(1)}%"></i></span><em>${g}GB</em></li>`).join('')}</ul><p class="vis-cap" style="font-size:13px;color:var(--faint);margin:8px 0 0">Ollama 공식 라이브러리의 압축판 파일 크기(Qwen3, 70B는 Llama 3.3). 맥 기준 가성비는 8B까지 16GB, 14B는 24GB, 32B는 48GB예요.${badge('ollama-qwen3')}</p>`;
    }
    if (key === 'swap') {
      const blocks = [{ label: '운영체제', gb: 4, tone: 'base' }, { label: '탭 수십 개', gb: 7, tone: 'lapis' }, { label: '화상회의', gb: 1.5, tone: 'butter' }, { label: '영상 편집', gb: 5, tone: 'coral' }];
      return `${desk(blocks, 8)}<p class="vis-cap" style="font-size:13px;color:var(--faint);margin:6px 0 0">예시: 8GB 책상에 약 17.5GB를 펼치면</p>`;
    }
    if (key === 'pool') {
      return `<div class="pool" role="img" aria-label="맥은 CPU와 그래픽이 메모리 하나를 같이 쓰고, 윈도우는 램과 그래픽 메모리가 따로"><div class="p"><b>맥 · 통합 메모리</b><div class="row"><span>CPU와 그래픽이 함께 쓰는 메모리</span></div></div><div class="p"><b>윈도우 · 따로따로</b><div class="row"><span>램</span><span class="alt">그래픽 메모리(VRAM)</span></div></div></div>`;
    }
    return '';
  }

  function aside(answers, R, step) {
    // 램 용량 비교 그림이 팁에 이미 있는 질문에서는 책상을 두 번 보여 주지 않는다.
    if (step && step.tip && step.tip.visual === 'tiers') return '';
    const rec = R.compute(answers);
    const hasUses = (answers.uses || []).length > 0;
    const title = hasUses ? '지금까지 고른 걸 다 켜면' : '컴퓨터를 켜고 인터넷 창을 열면';
    return `<div class="desk-card"><h3>${title}</h3><p class="big">약 ${fmt(rec.used)}GB <small>→ 가성비 책상 ${rec.ram.value}GB</small></p>${desk(rec.blocks, rec.ram.value)}${legend(rec.blocks)}<p class="cap">그림의 GB는 이해를 돕는 대략값이에요. 결과에서 공식 사양과 함께 다시 보여 드려요.</p></div>`;
  }

  function reasonsBlock(list, layout, keep = 3) {
    if (!list.length || layout === 'quick') return '';
    if (layout === 'deep' || list.length <= keep) return `<ul class="why">${list.map(reasonLi).join('')}</ul>`;
    return `<ul class="why">${list.slice(0, keep).map(reasonLi).join('')}</ul><details class="more"><summary>이유 더 보기 (${list.length - keep})</summary><ul class="why">${list.slice(keep).map(reasonLi).join('')}</ul></details>`;
  }
  function spec({ k, v, s, extra, reasons, layout, key }) {
    return `<div class="spec${key ? ' key' : ''}"><p class="k">${esc(k)}</p><p class="v">${esc(v)}</p>${s ? `<p class="s">${esc(s)}</p>` : ''}${extra || ''}${reasonsBlock(reasons || [], layout)}</div>`;
  }

  const VERDICT = { enough: '충분해요', workable: '시작해도 돼요', tight: '빠듯해요', short: '부족해요', unknown: '램부터 확인해요' };
  const CAN = { ok: ['✓', '편하게'], maybe: ['△', '빠듯하게 가능'], no: ['×', '어려워요'] };

  function summaryText(rec, content) {
    const uniq = [];
    for (const x of [...rec.form.reasons, ...rec.ram.reasons, ...rec.storage.reasons, ...rec.gpu.reasons, ...rec.cpu.reasons, ...rec.os.reasons, ...rec.os.conflicts]) if (!uniq.includes(x.t)) uniq.push(x.t);
    const lines = [
      `synkbrief 기초 · AI 컴퓨터 맞춤 추천 (${content.checked} 기준, 가성비 우선)`,
      rec.headline.title, rec.headline.sub, '',
      '[가성비 추천]',
      `- 형태: ${rec.product}${rec.form.notLaptop ? ' (무거운 작업이라 노트북은 권하지 않아요)' : ''}`,
      `- 램: ${rec.ram.value}GB${rec.ram.roomy > rec.ram.value ? ` · 여유가 되면 ${rec.ram.roomy}GB` : ''} (공식 최소 ${rec.ram.officialMin}GB)`,
      `- 저장공간: SSD ${rec.storage.valueText}${rec.storage.roomy > rec.storage.value ? ` · 여유가 되면 ${rec.storage.roomyText}` : ''}`,
      `- 그래픽: ${rec.gpu.text}${rec.gpu.example ? ` (예: ${rec.gpu.example})` : ''}`,
      `- CPU: ${rec.cpu.text}`,
      `- 운영체제: ${rec.osLabel}`,
      `- NPU: ${rec.npu.title}`, '',
      '[돈 쓰는 순서]', ...rec.money.map((x, i) => `${i + 1}. ${x.t}`), '',
      '[왜 이렇게 추천했나]', ...uniq.map(t => `- ${t}`), '',
    ];
    if (rec.form.portable.length) lines.push('[밖에서는 이렇게]', ...rec.form.portable.map(x => `- ${x.t}`), '');
    if (rec.current) lines.push('[지금 컴퓨터]', `- ${VERDICT[rec.current.verdict]}`, ...rec.current.reasons.map(x => `- ${x.t}`), ...rec.current.actions.map(x => `- ${x.t}`), '');
    const tips = content.TIPS || {};
    lines.push('[나에게 필요한 팁]', ...rec.tips.filter(id => tips[id]).flatMap(id => [`· ${tips[id].title}`, ...tips[id].body.map(b => `  ${b}`)]), '');
    lines.push('[매장에서 확인할 것]', ...rec.checklist.map(c => `[ ] ${c.t}: ${c.d}`), '', '[AI에게 붙여 넣을 프롬프트]', rec.prompt, '', '[매장에서 이렇게 말하세요]', rec.store, '', '다시 보기: https://synk.im/brief/computer/');
    return lines.join('\n');
  }

  function tipCards(rec, content, layout, h2) {
    const tips = content.TIPS || {};
    const ids = rec.tips.filter(id => tips[id]);
    if (!ids.length) return '';
    return `<section class="block">${h2}<p class="sub">추천에 들어간 부품마다 무엇인지, 왜 필요하고 왜 비싼지, 신경 쓰지 않아도 되는 건 무엇인지 골라 드렸어요.</p><div class="tipcards">${ids.map((id, i) => {
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
    const warns = [
      ...rec.os.conflicts.map(x => `<div class="warn">${esc(x.t)}${badge(x.src)}</div>`),
      rec.budget.warn ? '<div class="warn"><b>예산보다 높은 조건일 가능성이 커요.</b> 고른 작업에 맞추면 보통 고가 장비예요. 아래 ‘돈 아끼는 방법’을 먼저 보세요.</div>' : '',
    ].join('');
    let n = 0;
    const H = (title, stk, r) => head(++n, title, stk, r);

    const f = rec.form;
    const formTitle = f.pick === 'desktop' ? `데스크톱을 추천해요 · ${rec.product}` : `노트북을 추천해요 · ${rec.product}`;
    const formBox = `<section class="formbox"><p class="eyebrow">데스크톱인가 노트북인가</p><h2>${esc(formTitle)}</h2><ul class="why">${(quick ? f.reasons.slice(0, 1) : f.reasons).map(reasonLi).join('')}</ul>${f.portable.length ? `<div class="plan"><b>밖에서는 이렇게</b><ul class="why">${f.portable.map(reasonLi).join('')}</ul></div>` : ''}${f.fallback.length && !quick ? `<details class="more"><summary>꼭 노트북 한 대로 해야 한다면</summary><ul class="why">${f.fallback.map(reasonLi).join('')}</ul></details>` : ''}</section>`;

    const ram = rec.ram, st = rec.storage, gpu = rec.gpu;
    const roomyP = text => `<p class="roomy">${esc(text)}</p>`;
    const npuExtra = `<ul class="why npu">${rec.npu.yes.map(x => `<li><b class="yes">의미 있음</b> ${esc(x.t)}${badge(x.src)}</li>`).join('')}${(quick ? [] : rec.npu.no).map(x => `<li><b class="no">차이 없음</b> ${esc(x.t)}${badge(x.src)}</li>`).join('')}</ul>${rec.npu.note && !quick ? `<p class="s">${esc(rec.npu.note.t)}${badge(rec.npu.note.src)}</p>` : ''}`;
    const specs = [
      spec({ k: '램', v: `${ram.value}GB`, s: `가성비 추천 · 공식 최소 ${ram.officialMin}GB`, extra: roomyP(ram.roomyNote), reasons: ram.reasons, layout, key: true }),
      spec({ k: '저장공간', v: `SSD ${st.valueText}`, s: st.roomy > st.value ? `가성비 추천 · 여유가 되면 ${st.roomyText}` : '가성비 추천', reasons: st.reasons, layout }),
      spec({ k: '그래픽', v: gpu.kind === 'dedicated' || gpu.kind === 'either' ? `그래픽 메모리 ${gpu.vram}GB` : gpu.short, s: gpu.kind === 'dedicated' ? `외장 그래픽카드 · 예: ${gpu.example}` : gpu.kind === 'either' ? gpu.text : gpu.kind === 'unified' ? '따로 고르지 않아요' : '따로 살 필요 없어요', extra: gpu.roomyText ? roomyP(gpu.roomyText) : '', reasons: gpu.reasons, layout }),
      spec({ k: 'CPU', v: rec.cpu.text, reasons: rec.cpu.reasons, layout }),
      spec({ k: '운영체제', v: rec.osLabel, reasons: rec.os.reasons, layout }),
      `<div class="spec"><p class="k">NPU(‘AI PC’)</p><p class="v small">${esc(rec.npu.title)}</p>${npuExtra}</div>`,
    ].join('');

    const money = quick ? '' : `<section class="block">${H('돈 쓰는 순서', 'adapt', -6)}<p class="sub">같은 돈이면 여기에 먼저 쓰세요.</p><ol class="money">${rec.money.map(reasonLi).join('')}</ol></section>`;

    const deskList = [...new Set([8, 16, 32, 64, rec.ram.value, rec.ram.roomy])].sort((a, b) => a - b);
    const tipsHtml = tipCards(rec, content, layout, H('나에게 필요한 팁', 'search', 7));
    const currentHead = rec.current ? H('지금 컴퓨터는?', 'time', 6) : '';
    const deskSection = quick ? '' : `<section class="block">${H('램을 책상으로 보면')}<p class="sub">고른 작업을 한꺼번에 펼쳤을 때예요. 용량을 눌러 8GB 책상과 비교해 보세요.</p><div class="desk-card"><p class="big">약 ${fmt(rec.used)}GB <small>→ 가성비 ${rec.ram.value}GB</small></p><div data-tiers data-list="${deskList.join(',')}">${tiersInner(rec, root.SynkComputerRules, rec.ram.value, deskList)}</div>${legend(rec.blocks)}<p class="cap">그림의 GB는 이해를 돕는 대략값이에요. 추천 용량은 공식 사양과 SYNK 판단으로 정했어요.</p></div></section>`;

    const cur = rec.current;
    const currentSection = !cur ? '' : `<section class="block">${currentHead}<span class="verdict ${cur.verdict}">${VERDICT[cur.verdict]}</span><ul class="why">${cur.reasons.map(reasonLi).join('')}</ul>${cur.can.length ? `<h3 style="font-size:17px;margin:18px 0 8px">지금 컴퓨터로 할 수 있는 일</h3><ul class="why">${cur.can.map(c => `<li><b>${CAN[c.level][0]}</b> ${esc(c.label)} · ${CAN[c.level][1]}</li>`).join('')}</ul>` : ''}${quick ? '' : `<h3 style="font-size:17px;margin:18px 0 8px">해 볼 것</h3><ul class="why">${cur.actions.map(reasonLi).join('')}</ul>`}</section>`;

    const take = `<section class="block">${H('가져가기', 'envelope', 8)}<p class="sub">결과가 담긴 프롬프트를 AI에 붙여 넣으면, 오늘 살 수 있는 모델을 가성비 순서로 찾아 줘요.</p><div class="copybox main"><label for="t-prompt">AI에게 붙여 넣을 프롬프트</label><textarea id="t-prompt" readonly spellcheck="false">${esc(rec.prompt)}</textarea><div class="row"><button type="button" class="btn primary" data-action="copy:prompt">프롬프트 복사</button><span class="status" role="status"></span></div></div><div class="copybox"><label for="t-store">매장·상담에서 이렇게 말하세요</label><textarea id="t-store" readonly spellcheck="false" style="min-height:120px">${esc(rec.store)}</textarea><div class="row"><button type="button" class="btn soft" data-action="copy:store">문장 복사</button><span class="status" role="status"></span></div></div></section>`;

    const checklist = quick ? '' : `<section class="block">${H('매장에서 확인할 것', 'check', -8)}<p class="sub">체크한 내용은 이 기기에 남아요.</p><ul class="checks">${rec.checklist.map(c => `<li><label><input type="checkbox" data-check="${esc(c.id)}"${checks[c.id] ? ' checked' : ''}><span><b>${esc(c.t)}</b><small>${esc(c.d)}</small></span></label></li>`).join('')}</ul></section>`;

    const moneySave = (deep || rec.budget.warn || rec.budget.tight) && (rec.budget.alternatives.length || rec.budget.tips.length) ? `<section class="block">${H('돈 아끼는 방법')}<ul class="why">${[...rec.budget.tips, ...rec.budget.alternatives].map(reasonLi).join('')}</ul></section>` : '';

    const explainer = deep ? `<section class="block">${H('램 용량별로 할 수 있는 일', 'book', 5)}<p class="sub">웹 AI는 서버가 계산하니 램은 탭만큼만 필요해요. 내 컴퓨터에 설치한 AI는 모델 전체를 메모리에 올려야 해서, 모델 크기만큼 더 필요해요.</p><div class="desk-card"><div data-tiers data-list="${TIER_LIST.join(',')}">${tiersInner(rec, root.SynkComputerRules, 16, TIER_LIST)}</div></div></section>` : '';

    const saveRow = `<section class="block">${H('저장하고 다시 보기')}<div class="take"><button type="button" class="btn soft" data-action="share">내 결과 링크 복사</button><button type="button" class="btn soft" data-action="copy:all">결과 전체 복사</button><button type="button" class="btn soft" data-action="print">PDF로 저장·인쇄</button><a class="btn soft" href="${esc(content.guidePdf)}" target="_blank" rel="noopener">설명서 PDF 받기</a><span class="status" role="status" style="flex-basis:100%"></span></div><p class="hint">인스타그램 안에서 열었다면 오른쪽 위 메뉴에서 ‘외부 브라우저로 열기’를 누르면 저장이 더 잘 돼요.</p></section>`;

    const fbMsg = { helpful: '고마워요. 다음에도 이렇게 보여 드릴게요.', too_much: '알겠어요. 다음에 이 기기에서 열면 간단히 보여 드릴게요.', want_more: '알겠어요. 다음에 이 기기에서 열면 자세히 보여 드릴게요.', not_fit: '알려 주셔서 고마워요. 어떤 점이 안 맞았는지 synkbrief 댓글이나 DM으로 알려 주시면 다음 버전에 반영할게요.' };
    const fb = `<section class="block">${H('이 추천, 도움이 됐나요?')}<div class="fb" role="group" aria-label="추천에 대한 반응">${[['helpful', '도움이 됐어요'], ['too_much', '너무 많아요'], ['want_more', '더 자세히 알고 싶어요'], ['not_fit', '나와 안 맞아요']].map(([id, t]) => `<button type="button" class="glass chip" aria-pressed="${feedbackGiven === id}" data-action="feedback:${id}"${feedbackGiven ? ' disabled' : ''}>${t}</button>`).join('')}</div><p class="fbnote">${feedbackGiven ? esc(fbMsg[feedbackGiven]) : '답은 이 기기에만 저장되고, 다음에 이 도구를 열 때 보여 주는 분량에 반영돼요.'}</p></section>`;

    const used = new Set(['trendforce']);
    const tipBank = content.TIPS || {};
    for (const x of [...rec.form.reasons, ...rec.form.portable, ...rec.form.fallback, ...rec.ram.reasons, ...rec.storage.reasons, ...rec.gpu.reasons, ...rec.cpu.reasons, ...rec.os.reasons, ...rec.os.conflicts, ...rec.npu.yes, ...rec.npu.no, ...(rec.npu.note ? [rec.npu.note] : []), ...rec.money, ...(rec.current ? [...rec.current.reasons, ...rec.current.actions] : []), ...rec.budget.tips, ...rec.budget.alternatives]) used.add(x.src);
    for (const id of rec.tips) for (const s of (tipBank[id] || {}).src || []) used.add(s);
    const srcList = Object.entries(content.SOURCES).filter(([id]) => used.has(id) || id === 'synk');
    const sourcesBox = `<details class="sources"${deep ? ' open' : ''}><summary>출처와 기준 (${esc(content.checked)} 확인)</summary><ul>${srcList.map(([, s]) => `<li><span class="src ${esc(s.kind)}">${KIND_TEXT[s.kind]}</span> ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ul><p style="font-size:14px;color:var(--muted)">제품 순위나 오늘 가격을 알려 주는 서비스가 아니에요. 공식 사양과 SYNK 판단으로 필요한 사양을 가성비 기준으로 계산해요. 가격은 프롬프트로 AI에게 오늘 기준으로 확인하세요.</p></details>`;

    const editable = content.steps.filter(s => !s.when || s.when(ctx.answers)).map(s => `<button type="button" class="glass chip" data-action="edit:${esc(s.id)}">${esc(s.short || s.eyebrow || s.title)}</button>`).join('');
    const edit = `<section class="block no-print">${H('답 바꿔 보기')}<p class="sub">하나만 바꿔도 결과가 다시 계산돼요.</p><div class="take">${editable}</div></section>`;

    const html = `<article class="result"><header class="r-top${rec.budget.warn || rec.os.conflicts.length ? '' : ' cheer'}"><p class="rec"><span class="stamp">${esc(content.checked.replace(/-/g, '.'))} 기준</span><span>${esc(content.series)} · 나의 가성비 추천</span></p><h1 id="q" tabindex="-1">${marked(rec.headline.title, [`램 ${rec.ram.value}GB`, '시작해도 돼요', '느린 원인부터'])}</h1><p>${esc(rec.headline.sub)}</p>${because ? `<p class="because">${esc(because)}</p>` : ''}<figure class="shot" aria-hidden="true"><img src="assets/laptop-felt.webp" alt=""></figure></header><div class="layout"><span>보기</span><div class="seg" role="radiogroup" aria-label="결과 분량">${seg}</div></div>${warns}${formBox}<div class="specs">${specs}</div>${money}${tipsHtml}${currentSection}${deskSection}${take}${checklist}${moneySave}${explainer}${saveRow}${fb}${edit}${sourcesBox}<div class="nav no-print"><button type="button" class="btn ghost" data-action="restart">처음부터 다시</button></div><div class="dock no-print" role="group" aria-label="바로 쓰기"><button type="button" class="btn primary" data-proxy="copy:prompt">프롬프트 복사</button><button type="button" class="btn soft" data-proxy="share">내 결과 링크</button></div></article>`;
    return { html, texts: { prompt: rec.prompt, store: rec.store, all: summaryText(rec, content) } };
  }

  // 램 용량 칩: 해당 그림만 다시 그린다. 질문 흐름의 답은 건드리지 않는다.
  function bindAny(el, ctx) {
    const R = ctx.rules;
    el.querySelectorAll('[data-tiers]').forEach(box => {
      const list = box.dataset.list.split(',').map(Number);
      const draw = sel => {
        box.innerHTML = tiersInner(R.compute(ctx.answers), R, sel, list);
        const b = box.querySelector(`[data-tier="${sel}"]`);
        if (b) b.focus({ preventScroll: true });
      };
      box.addEventListener('click', e => { const b = e.target.closest('[data-tier]'); if (b) draw(Number(b.dataset.tier)); });
      box.addEventListener('keydown', e => {
        const b = e.target.closest('[data-tier]');
        if (!b || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
        e.preventDefault();
        const i = list.indexOf(Number(b.dataset.tier)), d = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1;
        draw(list[(i + d + list.length) % list.length]);
      });
    });
  }

  return Object.freeze({ hero, visual, aside, result, bindAny, desk });
});
