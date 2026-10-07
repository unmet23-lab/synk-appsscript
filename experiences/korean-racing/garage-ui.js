// 공통 차고 화면(?garage=1) — 여덟 게임이 같이 쓰는 공통 코인으로 차·도색·휠·부스터·배지와 말 랠리의 라켓·공을 사고 장착한다.
// 규칙(사기·장착·찜·미션)은 garage.js·garage-core.js가 맡고, 여기서는 키트 부품으로 그린다:
// 종이 판 위의 펠트 쿠션 카드(장착 = 크림 칼선 + 펠트 체크, 보는 중 = 들뜸), 코인 알약, 펠트 단추. 3D 미리보기 캔버스는 app.js가 #garage-world에 넣는다.
import { SHOP_ITEMS, VEHICLES, FINALE_REWARDS, emptyGarage, buyItem, equipItem, setWish, dailyMission } from './garage.js';
import { josa } from './learning.js';

// 말 랠리 칸(2026-10-07): 같은 지갑으로 사는 말 랠리의 라켓·공. 차에는 입히지 않아서 3D 미리보기는 장착한 차 그대로다.
const CATEGORIES = [
  { id: 'vehicle', name: '차량' }, { id: 'paint', name: '도색' }, { id: 'wheels', name: '휠' },
  { id: 'trail', name: '부스터' }, { id: 'badge', name: '배지' }, { id: 'rally', name: '말 랠리', kinds: ['racket', 'ball'] },
];
const kindsOf = (tab) => CATEGORIES.find((c) => c.id === tab)?.kinds || [tab];
const tabOf = (kind) => CATEGORIES.find((c) => (c.kinds || [c.id]).includes(kind))?.id || 'vehicle';
const firstOfTab = (garage, tab) => kindsOf(tab).map((kind) => equippedItem(garage, kind)).find(Boolean) || SHOP_ITEMS.find((product) => kindsOf(tab).includes(product.kind));
const RALLY_KINDS = new Set(['racket', 'ball']);
const KIND_NAME = { ...Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name])), racket: '말 랠리 라켓', ball: '말 랠리 공' };
const CARD_COLOR = { vehicle: 'c-blush', paint: 'c-butter', wheels: 'c-blush', trail: 'c-lapis', badge: 'c-butter', racket: 'c-blush', ball: 'c-butter' };
const REWARD_CHAPTER = Object.fromEntries(Object.entries(FINALE_REWARDS).map(([chapter, id]) => [id, chapter]));
const findItem = (id) => SHOP_ITEMS.find((item) => item.id === id);
const equippedItem = (garage, kind) => SHOP_ITEMS.find((item) => item.kind === kind && item.value === garage.equipped?.[kind]);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const coins = (value) => Math.max(0, Number(value) || 0).toLocaleString('ko-KR');

/** 색이 어두우면 크림 그림 글자, 밝으면 먹색. */
function glyphColor(hex) {
  const n = parseInt(String(hex || '#c9ced3').slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5 ? '#fffaf2' : '#2b2320';
}
const GLYPHS = {
  vehicle: '<path d="M5 28 9 20l9-2 6-8h18l9 9 9 2 3 7v4H5Z" /><circle cx="17" cy="33" r="5"/><circle cx="47" cy="33" r="5"/>',
  paint: '<path d="M32 8C28 17 18 26 18 35a14 14 0 0 0 28 0C46 26 36 17 32 8Z"/>',
  wheels: '<circle cx="32" cy="32" r="17" fill="none" stroke-width="6"/><circle cx="32" cy="32" r="5"/><path d="M32 15v34M15 32h34" stroke-width="4" fill="none"/>',
  trail: '<path d="m36 8-17 25h12l-5 23 19-29H33Z"/>',
  racket: '<g transform="rotate(-40 32 32)"><ellipse cx="32" cy="23" rx="14" ry="16.5"/><rect x="27.5" y="35" width="9" height="21" rx="3.5"/></g><circle cx="52" cy="14" r="5.5"/>',   // 탁구 라켓과 공(돋보기·열쇠 구멍으로 보이지 않게)
  ball: '<circle cx="32" cy="32" r="12"/>',
};
/** 꾸미기 그림: 크림 펠트 원을 그 색으로 물들이고(실제 펠트 사진) 작은 그림 글자를 얹는다. 배지는 펠트 체크 배지 그대로. */
function itemArt(item) {
  if (item.kind === 'badge') return '<span class="swatch badge" aria-hidden="true"></span>';
  const color = item.color || '#c9ced3', ink = glyphColor(color);
  const viewBox = item.kind === 'vehicle' ? '0 0 64 40' : '0 0 64 64';
  return `<span class="swatch" style="--c:${escape(color)}" aria-hidden="true"><svg viewBox="${viewBox}" fill="${ink}" stroke="${ink}" stroke-linejoin="round">${GLYPHS[item.kind] || ''}</svg></span>`;
}

export function createGarageUI({ onPreview = () => {}, onEquip = () => {}, onClose = () => {}, onMission = () => {}, onOpen = () => {},
  readProgress = () => ({}), readGarage = emptyGarage, writeGarage = () => false } = {}) {
  const screen = document.getElementById('garage');
  if (!screen) throw new Error('createGarageUI needs #garage');
  let category = 'vehicle', selectedId = 'vehicle-coast', opened = false, message = '', messageKind = 'info';
  screen.innerHTML = `
  <header class="topbar on-field">
    <a class="logo-tag" href="./" aria-label="레이싱 처음으로"><img src="kit/brand/logo-lab.webp" alt="SYNK LAB" width="96" height="30"></a>
    <span class="kicker">LAB · COMMON GARAGE</span>
    <button id="garage-close" class="chip-btn garage-back" type="button">레이싱 입구로</button>
  </header>
  <section class="garage-hero">
    <div class="garage-copy">
      <span class="kicker">SYNK LAB PLAY · 여덟 게임 공통</span>
      <h1 id="garage-title">공통 차고</h1>
      <p class="lede">모은 코인으로<br><span class="crayon-under">내 차</span>를 꾸며요!</p>
      <p class="sub">게임을 끝까지 마칠 때마다 공통 코인이 모여요. 어떤 꾸미기든 달리는 성능은 같아요.</p>
      <p class="garage-balance"><span class="pill coin-pill"><small>보유 코인</small><b id="garage-coins">0</b></span></p>
    </div>
    <figure class="garage-preview paper" id="garage-preview" aria-label="차량 3D 미리보기">
      <div class="garage-world" id="garage-world"></div>
      <p class="preview-wait" id="garage-wait">차고를 준비하고 있어요…</p>
      <figcaption class="preview-cap"><span class="tag" id="garage-preview-tag">장착 차량</span><strong id="garage-preview-name">코스트 GT</strong><span id="garage-preview-copy"></span></figcaption>
      <label class="garage-rotation"><span class="sr">차량 돌려 보기</span><input id="garage-angle" type="range" min="0" max="360" value="37" step="1" aria-label="차량 미리보기 각도"></label>
    </figure>
  </section>
  <section class="garage-plan">
    <section class="paper garage-shop" aria-labelledby="garage-shop-title">
      <div class="shop-head"><span class="tag" id="garage-shop-title">꾸미기 고르기</span><span class="fine">카드를 누르면 3D로 미리 봐요</span></div>
      <div id="garage-tabs" class="garage-tabs" role="tablist" aria-label="꾸미기 종류"></div>
      <div id="garage-items" class="garage-items" role="tabpanel" tabindex="0"></div>
    </section>
    <aside class="garage-side">
      <section class="paper garage-detail" aria-live="polite">
        <span class="tag" id="garage-selection-type">차량</span>
        <h2 id="garage-selection-name">코스트 GT</h2>
        <p class="garage-price" id="garage-selection-price"></p>
        <p class="reason" id="garage-selection-note"></p>
        <div id="garage-item-actions" class="garage-actions"></div>
        <p id="garage-notice" class="garage-notice" role="status"></p>
      </section>
      <section class="paper garage-goal" aria-label="다음 목표 차">
        <span class="tag">다음 목표 차</span>
        <strong id="garage-wish-name">브리즈 로드스터</strong>
        <span class="fine" id="garage-wish-note"></span>
        <span class="goal-track"><i id="garage-wish-progress"></i></span>
      </section>
      <section class="paper garage-goal" aria-label="오늘의 미션">
        <span class="tag">오늘의 미션 · +15코인</span>
        <strong id="garage-mission-title">새로운 길을 열어요</strong>
        <span class="fine" id="garage-mission-note"></span>
        <button id="garage-mission" class="chip-btn" type="button">미션 달리기 →</button>
      </section>
    </aside>
  </section>`;
  const $ = (id) => screen.querySelector(`#${id}`);
  const setNotice = (text = '', kind = 'info') => { message = text; messageKind = kind; $('garage-notice').textContent = text; $('garage-notice').dataset.kind = kind; };
  const state = () => readGarage() || emptyGarage();
  const owned = (garage, item) => garage.owned?.includes(item.id) === true;
  const isEquipped = (garage, item) => garage.equipped?.[item.kind] === item.value;
  const selected = () => findItem(selectedId) || findItem('vehicle-coast');
  const persist = (next) => {
    try { if (writeGarage(next) !== false) return true; } catch { /* 고른 모습은 그대로 두고, 저장했다고 말하지 않는다 */ }
    setNotice('기록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.', 'error');
    return false;
  };
  const priceLabel = (garage, item) => (isEquipped(garage, item) ? '장착 중' : owned(garage, item) ? '보유'
    : item.unlockOnly ? `${REWARD_CHAPTER[item.id]}장 결승 보상` : `${coins(item.price)}코인`);

  function render() {
    const focused = screen.contains(document.activeElement) ? document.activeElement : null;
    const focusTarget = focused?.dataset.item ? `[data-item="${focused.dataset.item}"]` : focused?.dataset.category ? `[data-category="${focused.dataset.category}"]`
      : focused?.dataset.action ? `[data-action="${focused.dataset.action}"]` : null;
    let garage;
    try { garage = state(); } catch { setNotice('차고 기록을 읽지 못했어요. 잠시 후 다시 열어 주세요.', 'error'); return; }
    const item = selected();
    $('garage-coins').textContent = coins(garage.coins);
    $('garage-tabs').innerHTML = CATEGORIES.map((tab) => `<button type="button" class="chip-btn" id="garage-tab-${tab.id}" role="tab" aria-selected="${category === tab.id}" aria-pressed="${category === tab.id}" aria-controls="garage-items" data-category="${tab.id}" tabindex="${category === tab.id ? '0' : '-1'}">${tab.name}</button>`).join('');
    $('garage-items').setAttribute('aria-labelledby', `garage-tab-${category}`);
    $('garage-items').innerHTML = SHOP_ITEMS.filter((product) => kindsOf(category).includes(product.kind)).map((product) => {
      const have = owned(garage, product), equipped = isEquipped(garage, product), picked = product.id === selectedId;
      const label = priceLabel(garage, product), wish = garage.wish === product.value && product.kind === 'vehicle' && !have;
      return `<button type="button" class="garage-item ${CARD_COLOR[product.kind]}${picked ? ' selected' : ''}${have ? ' owned' : ''}${equipped ? ' equipped' : ''}" data-item="${product.id}" aria-pressed="${picked}" aria-label="${escape(product.name)} · ${escape(label)}${wish ? ' · 목표로 찜한 차' : ''} · 미리보기">${itemArt(product)}<span class="gi-name">${escape(product.name)}</span><span class="gi-state">${escape(label)}</span>${wish ? '<span class="gi-wish">찜</span>' : ''}</button>`;
    }).join('');
    const have = owned(garage, item), equipped = isEquipped(garage, item);
    $('garage-selection-type').textContent = `${KIND_NAME[item.kind] || '꾸미기'} · ${equipped ? '지금 장착' : have ? '보유' : '미리보기'}`;
    $('garage-selection-name').textContent = item.name;
    const rally = RALLY_KINDS.has(item.kind);
    $('garage-selection-price').textContent = equipped ? (rally ? '지금 말 랠리에서 써요' : '지금 이 꾸미기로 달려요') : have ? '가지고 있어요' : item.unlockOnly ? '결승 보상으로 받아요' : `${coins(item.price)}코인`;
    $('garage-selection-note').textContent = item.unlockOnly && !have ? `${REWARD_CHAPTER[item.id]}장 결승에서 다섯 문제 중 넷 이상 맞히면 받을 수 있어요.`
      : item.description || (item.kind === 'paint' ? '차체에 어울리는 색을 골라 보세요.' : item.kind === 'wheels' ? '작은 변화로 차의 분위기를 바꿔 보세요.'
        : item.kind === 'trail' ? '정답 부스터가 켜질 때 이 색으로 빛나요.' : item.kind === 'racket' ? '말 랠리에서 내 라켓이 이 색 펠트로 바뀌어요. 차에는 보이지 않아요.'
          : item.kind === 'ball' ? '말 랠리에서 공이 이 색 펠트로 바뀌어요. 차에는 보이지 않아요.' : '코스를 완주한 순간을 담은 수집 배지예요.');
    let primary = '';
    if (equipped) primary = `<p class="garage-have"><span class="check" aria-hidden="true"></span>${rally ? '말 랠리에서 쓰는 중이에요' : '장착하고 달리는 중이에요'}</p>`;
    else if (have) primary = `<button type="button" class="felt-cta coral" data-action="equip"><span>${rally ? '장착하기' : '장착하고 달리기'}</span><i class="disc" aria-hidden="true"></i></button>`;
    else if (item.unlockOnly) primary = '<p class="garage-need">챕터 결승을 통과하면 차고에 들어와요.</p>';
    else if (garage.coins < item.price) primary = `<p class="garage-need">앞으로 <b>${coins(item.price - garage.coins)}코인</b> 더 모으면 살 수 있어요.</p>`;
    else primary = `<button type="button" class="felt-cta coral" data-action="buy"><span>${coins(item.price)}코인으로 사기</span><i class="disc" aria-hidden="true"></i></button>`;
    const wish = item.kind === 'vehicle' && !have && !item.unlockOnly
      ? `<button type="button" class="chip-btn" data-action="wish" aria-pressed="${garage.wish === item.value}">${garage.wish === item.value ? '목표로 찜한 차' : '다음 목표로 찜하기'}</button>` : '';
    $('garage-item-actions').innerHTML = primary + wish;
    $('garage-preview-tag').textContent = equipped ? '지금 장착' : '미리보기';
    $('garage-preview-name').textContent = item.name;
    $('garage-preview-copy').textContent = item.kind === 'vehicle' ? '마린·까몽이 함께 타요' : rally ? '말 랠리에서 쓰는 꾸미기예요' : `내 차에 ${item.name} 입혀 보기`;
    const wishVehicle = VEHICLES.find((v) => v.id === garage.wish && !v.unlockOnly && !garage.owned?.includes(`vehicle-${v.id}`));
    $('garage-wish-name').textContent = wishVehicle ? wishVehicle.name : '다음 차를 찜해 보세요';
    $('garage-wish-note').textContent = wishVehicle ? (garage.coins >= wishVehicle.price ? '지금 살 수 있어요' : `앞으로 ${coins(wishVehicle.price - garage.coins)}코인`) : '마음에 드는 차를 목표로 골라요.';
    const fill = wishVehicle ? Math.min(100, Math.max(0, garage.coins / wishVehicle.price * 100)) : 0;
    $('garage-wish-progress').style.clipPath = `inset(0 ${(100 - fill).toFixed(1)}% 0 0)`;
    const mission = dailyMission(readProgress(), Date.now(), garage);
    $('garage-mission-title').textContent = mission.completed ? '오늘의 미션 완료' : mission.title;
    $('garage-mission-note').textContent = mission.completed ? '오늘의 15코인을 받았어요. 내일 새 미션이 열려요.' : mission.description;
    $('garage-mission').hidden = mission.completed;
    setNotice(message, messageKind);
    if (focusTarget && !focused.isConnected) {
      const replacement = screen.querySelector(focusTarget) || screen.querySelector('[data-action="equip"]') || screen.querySelector(`[data-item="${selectedId}"]`);
      if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
    }
  }

  function preview(itemId) {
    const item = findItem(itemId);
    if (!item) return;
    selectedId = item.id; category = tabOf(item.kind); setNotice(); render(); onPreview({ ...item });
  }
  function open() {
    opened = true;
    onOpen();
    const item = equippedItem(state(), 'vehicle') || findItem('vehicle-coast');
    selectedId = item.id; category = 'vehicle'; setNotice(); render(); onPreview({ ...item });
  }
  function close() {
    if (!opened) return;
    opened = false;
    onClose();
  }
  function setReady(ready) { $('garage-wait').hidden = ready; }

  $('garage-close').addEventListener('click', close);
  $('garage-tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-category]');
    if (!tab) return;
    category = tab.dataset.category;
    const item = firstOfTab(state(), category);
    preview(item.id); $(`garage-tab-${category}`).focus({ preventScroll: true });
  });
  $('garage-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = CATEGORIES.findIndex((tab) => tab.id === category);
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? CATEGORIES.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + CATEGORIES.length) % CATEGORIES.length;
    const item = firstOfTab(state(), CATEGORIES[target].id);
    preview(item.id); $(`garage-tab-${category}`).focus({ preventScroll: true });
  });
  $('garage-items').addEventListener('click', (event) => {
    const button = event.target.closest('[data-item]');
    if (!button) return;
    preview(button.dataset.item);
    screen.querySelector(`[data-item="${selectedId}"]`)?.focus({ preventScroll: true });
  });
  $('garage-item-actions').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    const item = selected();
    let latest;
    try { latest = state(); } catch { setNotice('차고 기록을 읽지 못했어요. 잠시 후 다시 시도해 주세요.', 'error'); return; }
    if (action === 'wish') {
      if (!persist(setWish(latest, latest.wish === item.value ? null : item.value))) return;
      setNotice(latest.wish === item.value ? '다음 목표를 새로 골라도 좋아요.' : `${item.name}${josa(item.name, '을', '를')} 다음 목표로 찜했어요.`); render(); return;
    }
    const result = action === 'buy' ? buyItem(latest, item.id) : equipItem(latest, item.id);
    if (!result.ok) {
      const note = result.reason === 'insufficient' ? '코인이 조금 모자라요. 한 판 더 달려 볼까요?' : result.reason === 'owned' ? '이미 가지고 있어요. 장착해서 달려 보세요.'
        : result.reason === 'unowned' ? '먼저 사거나 결승 보상으로 받아 주세요.' : '이 꾸미기는 결승 보상으로 만날 수 있어요.';
      setNotice(note, 'error'); render(); return;
    }
    if (!persist(result.state)) return;
    if (action === 'equip') { setNotice(`${item.name} 장착했어요.`); render(); onEquip({ ...item }); onPreview({ ...item }); }
    else { setNotice(RALLY_KINDS.has(item.kind) ? `${item.name} 샀어요. 장착하면 말 랠리에서 보여요.` : `${item.name} 샀어요. 장착하고 함께 달려 보세요.`); render(); }
  });
  $('garage-mission').addEventListener('click', () => {
    const mission = dailyMission(readProgress(), Date.now(), state());
    if (mission.completed) return;
    close(); onMission(mission);
  });
  screen.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && opened) { event.preventDefault(); event.stopPropagation(); close(); }
  });
  render();
  return { render, open, close, setReady, get opened() { return opened; }, get previewItem() { return { ...selected() }; } };
}
