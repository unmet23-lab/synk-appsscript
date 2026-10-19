/* synkbrief 기초 · AI 컴퓨터 맞춤 추천 — 그림과 결과 화면 v3(싱ㅋ 시그널).
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/computer/view.js
 * rules.compute()가 낸 값을 그린다. 여기서 사양을 새로 계산하지 않는다.
 * 결과 순서(추천기준 §11): 형태와 핵심 사양 → 왜 이 형태인가 → 사양 카드(가성비/여유) → 돈 쓰는 순서 → 나에게 필요한 팁 → 나머지.
 * 10-18 옛 펠트 스크랩북(유리 카드·스티커)을 걷고 카타나·skills와 같은 시그널 틀로 옮겼다. 포스터마다 그 화면을 설명하는 펠트 물건.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.SynkComputerView = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 「·」로 이은 말(「램·저장공간·그래픽」)은 한 덩어리로 묶는다(카타나와 같은 규칙).
  const keepDots = s => esc(s).replace(/[^\s·]+(?:·[^\s·]+)+/g, m => `<span class="nw">${m}</span>`);
  const fmt = n => (Math.round(n * 10) / 10).toString();
  const TIER_LIST = [4, 8, 12, 16, 24, 32, 64];
  const KIND_TEXT = { official: '공식', seen: 'SYNK 확인', synk: 'SYNK 판단', community: '커뮤니티' };
  let SOURCES = {};
  let SHOW_SYNK = false;

  const sources = () => (Object.keys(SOURCES).length ? SOURCES : ((root.SynkComputerContent || {}).SOURCES || {}));
  function badge(src) {
    const all = sources();
    const s = all[src] || all.synk || { kind: 'synk', label: '' };
    if (s.kind === 'synk' && !SHOW_SYNK) return '';
    return `<span class="src ${esc(s.kind)}" title="${esc(s.label)}">${KIND_TEXT[s.kind] || ''}</span>`;
  }
  const reasonLi = x => `<li>${keepDots(x.t)}${badge(x.src)}</li>`;

  // 화면마다 내용을 설명하는 펠트 그림(같은 그림을 되풀이하지 않는다).
  const ART = {
    intro: ['computer-art-intro.webp', 409, 440],         // 노트북과 데스크톱을 다는 저울: 무엇을 살까
    owned: ['computer-art-owned.webp', 315, 284],         // 메모 붙은 노트북과 돋보기: 지금 컴퓨터
    uses: ['computer-art-uses.webp', 350, 274],           // 말풍선·필름·팔레트·게임패드 쟁반: 하고 싶은 일
    video: ['computer-art-video.webp', 390, 440],         // 풀리는 필름 릴과 가위: 영상 편집
    photo: ['computer-art-photo.webp', 352, 336],         // 카메라와 색 견본: 사진·디자인
    code: ['computer-art-code.webp', 374, 239],           // 키보드와 휴대폰: 코딩·앱
    localai: ['computer-art-localai.webp', 337, 309],     // 옆판 연 본체 속 그래픽카드: 내 컴퓨터에 AI
    multitask: ['computer-art-multitask.webp', 376, 273], // 부채꼴로 겹친 창 카드: 켜 두는 개수
    current: ['computer-art-current.webp', 440, 197],     // 줄자 감은 노트북: 지금 사양 재기
    place: ['computer-art-place.webp', 440, 321],         // 노트북 든 가방: 들고 다니는 정도
    os: ['computer-art-os.webp', 440, 250],               // 생김새가 다른 모니터 둘: 운영체제
    budget: ['computer-art-budget.webp', 375, 440],       // 돼지 저금통과 동전: 예산
    result: ['computer-art-result.webp', 367, 440],       // 노트북·램이 든 쇼핑백과 체크 꼬리표: 나의 추천
    desk: ['computer-art-desk.webp', 440, 342],           // 블록이 넘치는 책상: 램은 작업 책상
  };
  const art = (key, cls) => { const a = ART[key]; return a ? `<img class="${cls}" src="assets/${a[0]}"${a[1] ? ` width="${a[1]}" height="${a[2]}"` : ''} alt="">` : ''; };
  // 질문 포스터의 큰 낱말(짧게). 없으면 short·eyebrow.
  const WORD = { owned: '내 컴퓨터', uses: '할 일', video: '영상', photo: '사진', code: '코딩', localai: '내 AI', multitask: '창 개수', current: '지금 사양', place: '들고 다님', os: '운영체제', budget: '예산' };

  // 첫 화면 포스터(시그널): SHIFT 청금석 면 + 펠트 저울 + 아주 큰 「컴퓨터」. 오른쪽 위 상태 칩.
  function hero() {
    return `<div class="poster tall" data-word="컴퓨터" style="--len:3"><span class="label">01 / SYNKBRIEF TOOL</span><span class="led-chip">가성비 기준 · 1분</span>${art('intro', 'cut')}</div>`;
  }
  // 결과 제목(「노트북(윈도우·맥북 에어) · 램 16GB · SSD 512GB」): 큰 글자라 줄이 자주 갈린다. 「·」가 줄 앞에 오지 않게
  // 마디 사이 「 · 」는 앞 낱말에 붙이고(&nbsp;), 마디 안 「·」는 앞에 붙인 채(U+2060) 뒤에서만 갈리게(<wbr>) 한다. marks와 같은 마디는 형광펜.
  function marked(title, marks) {
    const parts = String(title).split(' · ');
    const inner = s => esc(s).replace(/·/g, '⁠·<wbr>');
    return parts.map((p, i) => {
      const body = marks.includes(p) ? `<span class="hl nw">${esc(p)}</span>` : inner(p);
      return i < parts.length - 1 ? `${body}&nbsp;·` : body;
    }).join(' ');
  }
  // 구역 머리: 「01 가져가기」 모노 번호 + 제목 + 1px 선(시그널). 스티커는 붙이지 않는다.
  const head = (no, title) => `<h2><span class="no">${String(no).padStart(2, '0')}</span>${esc(title)}</h2>`;

  // 블록 색: rules의 tone을 따르되, 설치형 대화 AI(llm)는 인터넷 탭과 같은 청금석이라 청록으로 갈라 보인다.
  const tone = b => (b.id === 'llm' ? 'teal' : b.tone);
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
      return `<div class="blk ${esc(tone(b))}" style="flex:0 0 calc(${pct.toFixed(2)}% - 3px)" title="${esc(b.label)} · 약 ${fmt(b.gb)}GB">${pct >= 16 ? `<span>${esc(b.label)}</span>` : ''}</div>`;
    }).join('');
    const aria = `${deskGB}GB 책상에 약 ${fmt(used)}GB를 펼친 그림. ${over > 0.05 ? `약 ${fmt(over)}GB가 넘쳐요.` : `약 ${fmt(Math.max(0, deskGB - used))}GB가 남아요.`}`;
    const free = deskGB - used;
    const drawer = over > 0.05
      ? `<p class="drawer over"><i></i><span>책상에 못 올린 약 ${fmt(over)}GB는 서랍(SSD)을 오가요. 창을 바꿀 때마다 멈칫해요.</span></p>`
      : free < 1 ? '<p class="drawer fit"><span>책상에 딱 맞아요. 창을 많이 더 열면 느려질 수 있어요.</span></p>'
      : free < deskGB * 0.2 ? `<p class="drawer fit"><span>여유 약 ${fmt(free)}GB · 딱 맞는 가성비예요</span></p>`
      : `<p class="drawer ok"><span>여유 약 ${fmt(free)}GB · 넉넉해요</span></p>`;
    return `<div class="desk" role="img" aria-label="${esc(aria)}"><div class="surface"><div class="blocks">${cells}</div></div>${drawer}</div>`;
  }
  const legend = blocks => `<ul class="legend">${blocks.map(b => `<li><i class="blk ${esc(tone(b))}"></i>${esc(b.label)} 약 ${fmt(b.gb)}GB</li>`).join('')}</ul>`;

  function tiersInner(rec, R, sel, list) {
    const note = R.TIER_NOTES.find(t => t.gb === sel);
    const noteText = note ? `${keepDots(note.t)}${badge(note.src)}` : (sel > 64 ? '아주 큰 AI 모델이나 전문 작업용이에요. 대부분의 사람에겐 필요 이상이에요.' : '');
    const mark = g => (g === rec.ram.value ? ' · 가성비' : g === rec.ram.roomy && rec.ram.roomy > rec.ram.value ? ' · 여유' : '');
    return `<div class="tiers" role="radiogroup" aria-label="램 용량 비교">${list.map(g => `<button type="button" class="glass chip" role="radio" aria-checked="${g === sel}" data-tier="${g}">${g}GB${mark(g)}</button>`).join('')}</div>${desk(rec.blocks, sel)}<p class="tier-note"><b>${sel}GB</b> · ${noteText}</p>`;
  }
  function tiers(answers, R, sel) {
    const rec = R.compute(answers);
    const list = [...new Set([...TIER_LIST, rec.ram.value])].sort((a, b) => a - b);
    // 처음에는 가성비 추천 용량을 보여 준다(16GB 기준점). 8GB는 눌러서 비교한다.
    return `<div data-tiers data-list="${list.join(',')}">${tiersInner(rec, R, sel || rec.ram.value, list)}</div>${legend(rec.blocks)}<p class="vis-cap">책상 위 물건은 지금까지 고른 작업이에요. 용량을 눌러 비교해 보세요.</p>`;
  }

  function visual(key, answers) {
    const R = root.SynkComputerRules;
    if (key === 'server') {
      return '<div class="lanes" role="img" aria-label="웹 AI는 서버가 계산하고, 설치형 AI는 내 컴퓨터가 계산한다는 그림"><div class="lane"><b>웹 AI</b><div class="flow"><span class="node">내 컴퓨터 · 질문 입력</span><span class="arr">→</span><span class="node hot">AI 회사 서버 · 계산</span><span class="arr">→</span><span class="node">답이 화면에</span></div></div><div class="lane"><b>설치형 AI</b><div class="flow"><span class="node hot">내 컴퓨터 · 질문 입력과 계산 모두</span><span class="arr">→</span><span class="node">답이 화면에</span></div></div></div>';
    }
    if (key === 'tiers') return tiers(answers, R);
    if (key === 'res') {
      return '<div class="cmp" role="img" aria-label="4K 한 장면은 FHD 네 장면 크기"><figure><div class="box" style="aspect-ratio:16/9;width:50%;margin:0 auto"></div><figcaption>FHD 1920×1080</figcaption></figure><figure><div class="grid4"><i></i><i></i><i></i><i></i></div><figcaption>4K 3840×2160 = FHD 4장</figcaption></figure></div>';
    }
    if (key === 'models') {
      const rows = [['4B', 2.5], ['8B', 5.2], ['14B', 9.3], ['32B', 20], ['70B', 43]];
      return `<ul class="bars" aria-label="대화 AI 모델 크기별 압축판 파일 크기">${rows.map(([n, g]) => `<li><span>${n}</span><span class="rail"><i style="width:${((g / 48) * 100).toFixed(1)}%"></i></span><em>${g}GB</em></li>`).join('')}</ul><p class="vis-cap">Ollama 공식 라이브러리의 압축판 파일 크기(Qwen3, 70B는 Llama 3.3). 맥 기준 가성비는 8B까지 16GB, 14B는 24GB, 32B는 48GB예요.${badge('ollama-qwen3')}</p>`;
    }
    if (key === 'swap') {
      const blocks = [{ label: '운영체제', gb: 4, tone: 'base' }, { label: '탭 수십 개', gb: 7, tone: 'lapis' }, { label: '화상회의', gb: 1.5, tone: 'butter' }, { label: '영상 편집', gb: 5, tone: 'coral' }];
      return `${desk(blocks, 8)}${legend(blocks)}<p class="vis-cap">예시: 8GB 책상에 약 17.5GB를 펼치면</p>`;
    }
    if (key === 'pool') {
      return '<div class="pool mem" role="img" aria-label="맥은 CPU와 그래픽이 메모리 하나를 같이 쓰고, 윈도우는 램과 그래픽 메모리가 따로"><div class="p"><b class="kr">맥 · 통합 메모리</b><div class="row"><span>CPU와 그래픽이 함께 쓰는 메모리</span></div></div><div class="p"><b class="kr">윈도우 · 따로따로</b><div class="row"><span>램</span><span class="alt">그래픽 메모리(VRAM)</span></div></div></div>';
    }
    return '';
  }

  // 질문 옆: 그 질문을 설명하는 포스터(큰 낱말 + 펠트 물건) + 지금까지 고른 걸 펼친 램 책상.
  // core/wizard.js가 aside 글을 <div> 하나로 감싸므로, 포스터 칸을 닫고 책상 칸을 따로 연다 —
  // 휴대폰에서는 포스터 칸만 질문 위 띠로 올라가고(signal.css .aside>div:has(>.step-poster)) 책상은 팁 아래에 남는다.
  function aside(answers, R, step) {
    const C = root.SynkComputerContent;
    if (!C || !step) return '';
    const list = C.steps.filter(x => !x.when || x.when(answers || {}));
    const i = list.findIndex(x => x.id === step.id);
    const word = WORD[step.id] || step.short || step.eyebrow || '';
    const pad = n => String(n).padStart(2, '0');
    const width = [...word].reduce((n, ch) => n + (/[가-힣]/.test(ch) ? 1 : /\s/.test(ch) ? 0.3 : /[A-Z]/.test(ch) ? 0.62 : 0.55), 0);
    const poster = `<div class="poster step-poster" data-word="${esc(word)}" style="--len:${Math.max(2, Math.round(width * 100) / 100)}" aria-hidden="true"><span class="label">QUESTION ${pad(i + 1)} / ${pad(list.length)}</span>${art(step.id, 'cut')}</div>`;
    // 램 용량 비교 그림이 팁에 이미 있는 질문에서는 책상을 두 번 보여 주지 않는다.
    if (step.tip && step.tip.visual === 'tiers') return poster;
    const rec = R.compute(answers);
    const hasUses = (answers.uses || []).length > 0;
    const title = hasUses ? '지금까지 고른 걸 다 켜면' : '컴퓨터를 켜고 인터넷 창을 열면';
    return `${poster}</div><div class="desk-aside"><div class="desk-card"><h3>${title}</h3><p class="big">약 ${fmt(rec.used)}GB <small>→ 가성비 책상 ${rec.ram.value}GB</small></p>${desk(rec.blocks, rec.ram.value)}${legend(rec.blocks)}<p class="cap">그림의 GB는 이해를 돕는 대략값이에요. 결과에서 공식 사양과 함께 다시 보여 드려요.</p></div>`;
  }

  function reasonsBlock(list, layout, keep = 3) {
    if (!list.length || layout === 'quick') return '';
    if (layout === 'deep' || list.length <= keep) return `<ul class="why">${list.map(reasonLi).join('')}</ul>`;
    return `<ul class="why">${list.slice(0, keep).map(reasonLi).join('')}</ul><details class="more"><summary>이유 더 보기 (${list.length - keep})</summary><ul class="why">${list.slice(keep).map(reasonLi).join('')}</ul></details>`;
  }
  function spec({ k, v, s, extra, reasons, layout, key }) {
    return `<div class="spec${key ? ' key' : ''}"><p class="k">${keepDots(k)}</p><p class="v">${keepDots(v)}</p>${s ? `<p class="s">${keepDots(s)}</p>` : ''}${extra || ''}${reasonsBlock(reasons || [], layout)}</div>`;
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
      `- 램: ${rec.ram.value}GB${rec.ram.roomy > rec.ram.value ? ` · 여유가 되면 ${rec.ram.roomy}GB` : ''} (최소 ${rec.ram.officialMin}GB)`,
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
      return `<details class="tipcard"${open ? ' open' : ''}><summary>${keepDots(t.title)}</summary><div class="tipbody">${t.body.map(p => `<p>${keepDots(p)}</p>`).join('')}<p class="tipsrc">${[...new Map(t.src.map(s => [(sources()[s] || {}).kind, s])).values()].map(badge).join(' ')}</p></div></details>`;
    }).join('')}</div></section>`;
  }
  function copyBox(id, label, text, button, primary, rows) {
    return `<div class="copybox${primary ? ' main' : ''}"><label for="t-${id}">${esc(label)}</label><textarea id="t-${id}" readonly spellcheck="false"${rows ? ` style="min-height:${rows}px"` : ''}>${esc(text)}</textarea><div class="row"><button type="button" class="btn ${primary ? 'primary' : 'soft'}" data-action="copy:${id}">${esc(button)}</button><span class="status" role="status"></span></div></div>`;
  }

  function result(ctx) {
    const { rec, layout, plan, checks, feedbackGiven, content } = ctx;
    SOURCES = content.SOURCES;
    const deep = layout === 'deep', quick = layout === 'quick';
    SHOW_SYNK = deep;
    const because = plan && plan.selected && plan.selected.id === layout
      ? (plan.reasons.includes('feedback.too_much') ? '지난번에 ‘너무 많아요’라고 하셔서 간단히 보여 드려요. 이 기기에 저장된 답을 기준으로 했어요.' : plan.reasons.includes('feedback.want_more') ? '지난번에 ‘더 자세히’를 고르셔서 자세히 보여 드려요. 이 기기에 저장된 답을 기준으로 했어요.' : '')
      : '';
    const seg = [['quick', '간단히'], ['guided', '기본'], ['deep', '자세히']].map(([id, t]) => `<button type="button" class="glass chip" role="radio" aria-checked="${id === layout}" data-action="layout:${id}">${t}</button>`).join('');
    const warns = [
      ...rec.os.conflicts.map(x => `<div class="warn">${keepDots(x.t)}${badge(x.src)}</div>`),
      rec.budget.warn ? '<div class="warn"><b>예산보다 높은 조건일 가능성이 커요.</b> 고른 작업에 맞추면 보통 고가 장비예요. 아래 ‘돈 아끼는 방법’을 먼저 보세요.</div>' : '',
    ].join('');
    let n = 0;
    const H = title => head(++n, title);

    const f = rec.form;
    const prod = rec.product.replace(/^(데스크톱|노트북)\(?/, '').replace(/\)$/, '');
    const formTitle = `${f.pick === 'desktop' ? '데스크톱' : '노트북'}을 추천해요${prod ? ` · ${prod}` : ''}`;
    const formBox = `<section class="formbox"><p class="eyebrow">데스크톱인가 노트북인가</p><h2>${keepDots(formTitle)}</h2><ul class="why">${(quick ? f.reasons.slice(0, 1) : f.reasons).map(reasonLi).join('')}</ul>${f.portable.length ? `<div class="plan"><b>밖에서는 이렇게</b><ul class="why">${f.portable.map(reasonLi).join('')}</ul></div>` : ''}${f.fallback.length && !quick ? `<details class="more"><summary>꼭 노트북 한 대로 해야 한다면</summary><ul class="why">${f.fallback.map(reasonLi).join('')}</ul></details>` : ''}</section>`;

    const ram = rec.ram, st = rec.storage, gpu = rec.gpu;
    const roomyP = text => `<p class="roomy">${keepDots(text)}</p>`;
    const npuExtra = `<ul class="why npu">${rec.npu.yes.map(x => `<li><b class="yes">의미 있음</b> ${keepDots(x.t)}${badge(x.src)}</li>`).join('')}${(quick ? [] : rec.npu.no).map(x => `<li><b class="no">차이 없음</b> ${keepDots(x.t)}${badge(x.src)}</li>`).join('')}</ul>${rec.npu.note && !quick ? `<p class="s">${keepDots(rec.npu.note.t)}${badge(rec.npu.note.src)}</p>` : ''}`;
    const specs = [
      spec({ k: '램', v: `${ram.value}GB`, s: `가성비 추천 · 최소 ${ram.officialMin}GB`, extra: roomyP(ram.roomyNote), reasons: ram.reasons, layout, key: true }),
      spec({ k: '저장공간', v: `SSD ${st.valueText}`, s: st.roomy > st.value ? `가성비 추천 · 여유가 되면 ${st.roomyText}` : '가성비 추천', reasons: st.reasons, layout }),
      spec({ k: '그래픽', v: gpu.kind === 'dedicated' || gpu.kind === 'either' ? `그래픽 메모리 ${gpu.vram}GB` : gpu.short, s: gpu.kind === 'dedicated' ? `외장 그래픽카드 · 예: ${gpu.example}` : gpu.kind === 'either' ? gpu.text : gpu.kind === 'unified' ? '따로 고르지 않아요' : '따로 살 필요 없어요', extra: gpu.roomyText ? roomyP(gpu.roomyText) : '', reasons: gpu.reasons, layout }),
      spec({ k: 'CPU', v: rec.cpu.text, reasons: rec.cpu.reasons, layout }),
      spec({ k: '운영체제', v: rec.osLabel, reasons: rec.os.reasons, layout }),
      `<div class="spec npu-card"><p class="k">NPU(‘AI PC’)</p><p class="v small">${keepDots(rec.npu.title)}</p>${npuExtra}</div>`,
    ].join('');

    const money = quick ? '' : `<section class="block">${H('돈 쓰는 순서')}<p class="sub">같은 돈이면 여기에 먼저 쓰세요.</p><ol class="money">${rec.money.map(reasonLi).join('')}</ol></section>`;

    const deskList = [...new Set([8, 16, 32, 64, rec.ram.value, rec.ram.roomy])].sort((a, b) => a - b);
    const tipsHtml = tipCards(rec, content, layout, H('나에게 필요한 팁'));
    const cur = rec.current;
    const currentSection = !cur ? '' : `<section class="block">${H('지금 컴퓨터는?')}<span class="verdict ${esc(cur.verdict)}">${VERDICT[cur.verdict]}</span><ul class="why">${cur.reasons.map(reasonLi).join('')}</ul>${cur.can.length ? `<h3 class="mini">지금 컴퓨터로 할 수 있는 일</h3><ul class="why can">${cur.can.map(c => `<li><b class="${esc(c.level)}">${CAN[c.level][0]}</b> ${keepDots(c.label)} · ${CAN[c.level][1]}</li>`).join('')}</ul>` : ''}${quick ? '' : `<h3 class="mini">해 볼 것</h3><ul class="why">${cur.actions.map(reasonLi).join('')}</ul>`}</section>`;
    const deskSection = quick ? '' : `<section class="block">${H('램을 책상으로 보면')}<p class="sub">고른 작업을 한꺼번에 펼쳤을 때예요. 용량을 눌러 8GB 책상과 비교해 보세요.</p><div class="desk-card has-art"><figure class="desk-art cut" aria-hidden="true">${art('desk', '')}</figure><p class="big">약 ${fmt(rec.used)}GB <small>→ 가성비 ${rec.ram.value}GB</small></p><div data-tiers data-list="${deskList.join(',')}">${tiersInner(rec, root.SynkComputerRules, rec.ram.value, deskList)}</div>${legend(rec.blocks)}<p class="cap">그림의 GB는 이해를 돕는 대략값이에요. 추천 용량은 공식 사양과 SYNK 판단으로 정했어요.</p></div></section>`;

    const take = `<section class="block">${H('가져가기')}<p class="sub">결과가 담긴 프롬프트를 AI에 붙여 넣으면, 오늘 살 수 있는 모델을 가성비 순서로 찾아 줘요.</p>${copyBox('prompt', 'AI에게 붙여 넣을 프롬프트', rec.prompt, '프롬프트 복사', true, 0)}${copyBox('store', '매장·상담에서 이렇게 말하세요', rec.store, '문장 복사', false, 120)}</section>`;

    const checklist = `<section class="block">${H('매장에서 확인할 것')}<p class="sub">체크한 내용은 이 기기에 남아요.</p><ul class="checks">${rec.checklist.map(c => `<li><label><input type="checkbox" data-check="${esc(c.id)}"${checks[c.id] ? ' checked' : ''}><span><b>${keepDots(c.t)}</b><small>${keepDots(c.d)}</small></span></label></li>`).join('')}</ul></section>`;

    const moneySave = (deep || rec.budget.warn || rec.budget.tight) && (rec.budget.alternatives.length || rec.budget.tips.length) ? `<section class="block">${H('돈 아끼는 방법')}<ul class="why">${[...rec.budget.tips, ...rec.budget.alternatives].map(reasonLi).join('')}</ul></section>` : '';

    const explainer = deep ? `<section class="block">${H('램 용량별로 할 수 있는 일')}<p class="sub">웹 AI는 서버가 계산하니 램은 탭만큼만 필요해요. 내 컴퓨터에 설치한 AI는 모델 전체를 메모리에 올려야 해서, 모델 크기만큼 더 필요해요.</p><div class="desk-card"><div data-tiers data-list="${TIER_LIST.join(',')}">${tiersInner(rec, root.SynkComputerRules, 16, TIER_LIST)}</div></div></section>` : '';

    const saveRow = `<section class="block">${H('저장하고 다시 보기')}<div class="take"><button type="button" class="btn soft" data-action="share">내 결과 링크 복사</button><button type="button" class="btn soft" data-action="copy:all" data-what="결과 전체">결과 전체 복사</button><button type="button" class="btn soft" data-action="print">PDF로 저장·인쇄</button><a class="btn soft" href="${esc(content.guidePdf)}" target="_blank" rel="noopener">설명서 PDF 받기</a><span class="status" role="status" style="flex-basis:100%"></span></div><p class="hint">인스타그램 안에서 열었다면 오른쪽 위 메뉴에서 ‘외부 브라우저로 열기’를 누르면 저장이 더 잘 돼요.</p></section>`;

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

    const html = `<article class="result r-computer"><header class="r-top"><p class="rec"><span class="sticker">${esc(content.checked.replace(/-/g, '.'))} 확인</span><span>${esc(content.series)} · 나의 가성비 추천</span></p><h1 id="q" tabindex="-1">${marked(rec.headline.title, [`램 ${rec.ram.value}GB`, '시작해도 돼요', '느린 원인부터'])}</h1><p>${keepDots(rec.headline.sub)}</p>${because ? `<p class="because">${esc(because)}</p>` : ''}<figure class="shot cut" aria-hidden="true">${art('result', '')}</figure></header><div class="layout"><span>보기</span><div class="seg" role="radiogroup" aria-label="결과 분량">${seg}</div></div>${warns}${formBox}<div class="specs">${specs}</div>${money}${tipsHtml}${currentSection}${deskSection}${take}${checklist}${moneySave}${explainer}${saveRow}${fb}${edit}${sourcesBox}<div class="nav no-print"><button type="button" class="btn ghost" data-action="restart">처음부터 다시</button></div><div class="dock no-print" role="group" aria-label="바로 쓰기"><button type="button" class="btn primary" data-proxy="copy:prompt">프롬프트 복사</button><button type="button" class="btn soft" data-proxy="share">내 결과 링크</button></div></article>`;
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

  return Object.freeze({ hero, visual, aside, result, bindAny, desk, ART });
});
