// 말 랠리 꾸미기(2026-10-07): 공통 코인으로 산 라켓·공의 색. 값·사기·장착·저장 규칙은 공통 지갑(collection.js — 원본 korean-racing/garage-core.js)이
// 맡고, 여기서는 입구의 꾸미기 판을 그리고 장착한 색을 3D 무대에 넘긴다. 견본은 크림 펠트 원(실제 펠트 사진)을 그 색으로 물들인 것이다.
// collection.js를 읽지 못하면 판을 숨기고 원래 모습(코랄 라켓·크림 공)으로 친다.
export const GEAR_KINDS = [{ kind: 'racket', label: '라켓' }, { kind: 'ball', label: '공' }];
export const DEFAULT_GEAR = Object.freeze({ racket: '#d63c2a', ball: '#fff1c9' });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const coins = (n) => Math.max(0, Number(n) || 0).toLocaleString('ko-KR');
/** 받침 고르기: 받침이 있으면 a, 없으면 b(‘라켓을’·‘공으로’ — ㄹ 받침은 ‘으로’ 대신 ‘로’). */
function josa(word, withBatchim, without, rieulAsWithout = false) {
  const c = String(word).trim().slice(-1).charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171) return withBatchim;
  const jong = c % 28;
  return jong === 0 || (rieulAsWithout && jong === 8) ? without : withBatchim;
}

/** 장착한 라켓·공의 색. 지갑·목록이 없거나 이상하면 원래 색. */
export function gearColors(garage, catalog) {
  const out = { ...DEFAULT_GEAR };
  for (const { kind } of GEAR_KINDS) {
    const item = (catalog || []).find((x) => x.kind === kind && x.value === garage?.equipped?.[kind]);
    if (item && /^#[0-9a-f]{6}$/i.test(item.color)) out[kind] = item.color;
  }
  return out;
}

/**
 * 꾸미기 판. root 안에 줄(라켓·공)과 고른 것의 행동(장착 중·장착하기·사서 장착하기·코인 모자람)을 그린다.
 * onGear(colors)는 처음 읽었을 때와 장착이 바뀔 때마다 부른다.
 */
export function createGearPanel({ root, api = globalThis.SynkPlayCollection, onGear = () => {} }) {
  const rows = root.querySelector('#gear-rows'), act = root.querySelector('#gear-act'), note = root.querySelector('#gear-note');
  let catalog = [], garage = null, selected = null, busy = false;
  if (!api) { root.hidden = true; onGear({ ...DEFAULT_GEAR }); return { refresh: async () => {}, colors: () => ({ ...DEFAULT_GEAR }) }; }
  const items = (kind) => catalog.filter((x) => x.kind === kind);
  const owned = (item) => !!garage?.owned?.includes(item.id);
  const equipped = (item) => garage?.equipped?.[item.kind] === item.value;
  const say = (text, kind = 'info') => { note.textContent = text; note.dataset.kind = kind; };
  const stateLabel = (item) => (equipped(item) ? '장착 중' : owned(item) ? '보유' : `${coins(item.price)}코인`);

  function render() {
    if (!garage) {   // 저장 공간을 읽을 수 없다: 원래 색으로 놀고, 판은 이유만 말한다
      rows.innerHTML = ''; act.innerHTML = '';
      say('이 브라우저에 저장할 수 없어서 꾸미기를 쓸 수 없어요. 원래 라켓과 공으로 놀아요.', 'error');
      return;
    }
    rows.innerHTML = GEAR_KINDS.map(({ kind, label }) => `<div class="gear-row" role="group" aria-label="${label}">
      <span class="gear-kind">${label}</span><div class="gear-swatches">${items(kind).map((item) => `<button type="button" class="gear-swatch${equipped(item) ? ' equipped' : ''}" data-item="${esc(item.id)}"
        aria-pressed="${item.id === selected}" aria-label="${esc(item.name)} · ${esc(stateLabel(item))}"><span class="swatch" style="--c:${esc(item.color)}" aria-hidden="true"></span>
        <span class="g-name" aria-hidden="true">${esc(item.label || item.name)}</span><span class="g-state" aria-hidden="true">${esc(stateLabel(item))}</span></button>`).join('')}</div></div>`).join('');
    const item = catalog.find((x) => x.id === selected);
    if (!item) { act.innerHTML = ''; return; }
    let action;
    if (equipped(item)) action = '<p class="gear-have"><span class="check" aria-hidden="true"></span>지금 쓰는 중이에요</p>';
    else if (owned(item)) action = '<button type="button" class="chip-btn" data-action="equip">장착하기</button>';
    else if ((garage.coins || 0) >= item.price) action = `<button type="button" class="chip-btn buy" data-action="buy">${coins(item.price)}코인으로 사서 장착하기</button>`;
    else action = `<p class="gear-need">코인이 부족해요. 앞으로 <b>${coins(item.price - (garage.coins || 0))}코인</b> 더 모으면 살 수 있어요.</p>`;
    act.innerHTML = `<p class="gear-pick"><b>${esc(item.name)}</b><span>${equipped(item) ? '장착 중' : owned(item) ? '가지고 있어요' : `${coins(item.price)}코인`}</span></p>${action}`;
  }
  const colors = () => gearColors(garage, catalog);
  async function refresh({ keepNote = false } = {}) {
    try { [catalog, garage] = await Promise.all([api.catalog(), api.load()]); } catch { garage = null; }
    catalog = (catalog || []).filter((x) => GEAR_KINDS.some((k) => k.kind === x.kind));
    if (!selected || !catalog.some((x) => x.id === selected)) selected = catalog.find((x) => x.kind === 'racket' && equipped(x))?.id || catalog[0]?.id || null;
    if (!keepNote) say('');
    render();
    onGear(colors());
  }
  const failText = (r, item) => (r?.reason === 'insufficient' ? `코인이 부족해요. 앞으로 ${coins(item.price - (garage?.coins || 0))}코인 더 모으면 살 수 있어요.`
    : r?.reason === 'storage-unavailable' ? '이 브라우저에 저장할 수 없어서 사거나 바꿀 수 없어요.'
      : r?.reason === 'owned' ? '이미 가지고 있어요. 장착해 보세요.' : '공통 지갑을 열지 못했어요. 잠시 뒤에 다시 해 주세요.');

  rows.addEventListener('click', (e) => {
    const b = e.target.closest('[data-item]'); if (!b) return;
    selected = b.dataset.item; say(''); render();
    rows.querySelector(`[data-item="${CSS.escape(selected)}"]`)?.focus({ preventScroll: true });
  });
  act.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action, item = catalog.find((x) => x.id === selected);
    if (!action || !item || busy) return;
    busy = true;
    try {
      if (action === 'buy') {
        const bought = await api.buy(item.id);
        if (!bought?.ok) { await refresh({ keepNote: true }); say(failText(bought, item), 'error'); return; }
        const worn = await api.equip(item.id);
        await refresh({ keepNote: true });
        say(worn?.ok ? `${item.name}${josa(item.name, '을', '를')} 샀어요. 바로 장착했어요.` : `${item.name}${josa(item.name, '을', '를')} 샀어요. ${failText(worn, item)}`, worn?.ok ? 'info' : 'error');
      } else {
        const worn = await api.equip(item.id);
        await refresh({ keepNote: true });
        say(worn?.ok ? `${item.name}${josa(item.name, '으로', '로', true)} 바꿨어요.` : failText(worn, item), worn?.ok ? 'info' : 'error');
      }
      act.querySelector('[data-action]')?.focus({ preventScroll: true });
    } finally { busy = false; }
  });
  // 다른 탭이나 레이싱 차고에서 바꾸고 돌아오면 다시 읽는다
  globalThis.addEventListener?.('storage', (e) => { if (e.key === api.key) refresh({ keepNote: true }); });
  globalThis.addEventListener?.('pageshow', () => refresh({ keepNote: true }));
  refresh();
  return { refresh, colors };
}
