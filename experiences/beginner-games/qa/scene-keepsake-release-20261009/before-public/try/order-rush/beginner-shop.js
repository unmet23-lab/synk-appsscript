import { PICNIC_ID, picnicRound, picnicScene } from './beginner-picnic.js';
// Cosmetics and the permanent picnic playset use the shared wallet.
// Preview never spends coins or changes the currently equipped item.
const PICKS = Object.freeze([
  { id: 'order-stall-default', kind: 'order-stall', value: 'default', ko: '크림 간판', en: 'Cream sign', image: 'beginner-kit/felt/slab-cream-long.webp' },
  { id: 'order-stall-blush', kind: 'order-stall', value: 'blush', ko: '봄빛 간판', en: 'Blush sign', image: 'beginner-kit/felt/cushion-blush-strip.webp' },
  { id: 'order-stall-lapis', kind: 'order-stall', value: 'lapis', ko: '밤하늘 간판', en: 'Blue sign', image: 'beginner-kit/felt/cushion-lapis-strip.webp' },
  { id: 'order-tray-cream', kind: 'order-tray', value: 'cream', ko: '크림 쟁반', en: 'Cream tray', image: 'beginner-assets/felt/cushion-cream-mid.webp' },
  { id: 'order-tray-butter', kind: 'order-tray', value: 'butter', ko: '버터 쟁반', en: 'Butter tray', image: 'beginner-kit/felt/cushion-butter-wide.webp' },
  { id: 'order-tray-coral', kind: 'order-tray', value: 'coral', ko: '코랄 쟁반', en: 'Coral tray', image: 'beginner-kit/felt/slab-coral-long.webp' },
  { id: PICNIC_ID, kind: 'order-playset', value: 'picnic', ko: '소풍 친구 초대 세트', en: 'Picnic with friends', image: 'beginner-assets/picnic/rolled-mat.webp' },
]);
const tr = (ko, en) => `${ko}<small class="b-en" lang="en">${en}</small>`;

export function createBeginnerShop({ beforeOpen = () => {}, onPlayPicnic = () => {}, onCollectionChange = () => {}, api = globalThis.SynkPlayCollection } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'paper b-decor-dialog'; dialog.id = 'b-decor'; dialog.setAttribute('aria-labelledby', 'b-decor-title');
  dialog.innerHTML = `<header class="b-decor-head"><div><span class="kicker">MY LITTLE SHOP</span><h2 id="b-decor-title">소풍·가게 상점<small class="b-en" lang="en">Picnic and shop</small></h2></div><button class="chip-btn" data-decor-close>${tr('닫기', 'Close')}</button></header>
    <p class="b-decor-intro">배운 말로 친구를 초대하고, 내 가게도 꾸며요.<small class="b-en" lang="en">Use your Korean to invite friends, then make the shop your own.</small></p>
    <p class="b-decor-balance" data-decor-balance></p>
    <figure class="b-decor-preview" aria-label="가게 꾸미기 미리보기 · Shop decoration preview"><div class="b-decor-sign">작은 가게<small lang="en">MY LITTLE SHOP</small></div><img class="b-decor-friend" src="beginner-kit/brand/mongle-smile.webp" alt=""><div class="b-decor-tray"><img src="beginner-assets/beginner/bread.webp" alt="빵 · Bread"></div><figcaption>${tr('미리보기 · 아래에서 적용해 주세요', 'Preview only · Apply your choice below')}</figcaption></figure>
    <div class="b-playset-preview" data-playset-preview hidden></div><div class="b-decor-action" data-decor-action></div><p class="b-decor-note" data-decor-note role="status" aria-live="polite"></p><div class="b-decor-goal" data-decor-goal></div><div data-decor-items></div>
    <p class="b-practice-note">27개 첫 주문을 마치면 공통 코인이 모여요. 다른 미니게임에서 모은 코인도 함께 써요. 구매는 선택이며 기본 가게와 그림 도움은 계속 무료예요.<small class="b-en" lang="en">Complete all 27 first orders to earn shared coins. Coins from other minigames work here too. Your basic shop and picture help stay free. Sign in with SYNK ID to keep purchases across devices. Check the account save status above.</small></p>`;
  document.body.append(dialog);
  const rows = dialog.querySelector('[data-decor-items]'), action = dialog.querySelector('[data-decor-action]'), note = dialog.querySelector('[data-decor-note]');
  let wallet = null, catalog = [], selected = PICNIC_ID, goalInfo = null, busy = false, opener = null, revision = 0, viewRevision = 0, focusRevision = 0;
  const owned = item => !!wallet?.owned?.includes(item.id);
  const equipped = item => wallet?.equipped?.[item.kind] === item.value;
  function say(ko = '', en = '') { note.replaceChildren(); if (ko) { note.append(ko); const sub = document.createElement('small'); sub.className = 'b-en'; sub.lang = 'en'; sub.textContent = en; note.append(sub); } }
  function apply() {
    for (const [kind, key, fallback] of [['order-stall', 'orderStall', 'default'], ['order-tray', 'orderTray', 'cream']]) {
      const item = PICKS.find(p => p.kind === kind && p.value === wallet?.equipped?.[kind] && owned(p));
      document.body.dataset[key] = item?.value || fallback;
    }
  }
  const controlAttributes = ['data-decor-close', 'data-decor-pick', 'data-decor-play', 'data-decor-equip', 'data-decor-buy', 'data-decor-goal-toggle', 'data-decor-retry'];
  function rememberFocus() {
    const node = document.activeElement, attribute = controlAttributes.find(name => dialog.contains(node) && node.hasAttribute(name));
    return attribute ? { node, attribute, value: node.getAttribute(attribute), selected, view: viewRevision, interaction: focusRevision } : null;
  }
  function restoreFocus(saved, fallback = false) {
    if (!saved || !dialog.open || saved.view !== viewRevision || saved.interaction !== focusRevision || ![document.body, saved.node].includes(document.activeElement)) return;
    let target = dialog.querySelector(`[${saved.attribute}${saved.value ? `="${saved.value}"` : ''}]`);
    if ((!target || target.disabled) && fallback && selected === saved.selected) target = dialog.querySelector('[data-decor-play], [data-decor-equip], [data-decor-buy]') || dialog.querySelector(`[data-decor-pick="${selected}"]`);
    if (!target?.disabled) target?.focus({ preventScroll: true });
  }
  function render() {
    const focused = rememberFocus();
    dialog.querySelector('[data-decor-balance]').innerHTML = wallet ? tr(`보유 ${wallet.coins}코인`, `${wallet.coins} shared coins`) : tr('공통 지갑을 열 수 없어요', 'Your wallet is unavailable');
    const picked = PICKS.find(p => p.id === selected) || PICKS[0], playset = picked.id === PICNIC_ID;
    dialog.querySelector('.b-decor-preview').hidden = playset;
    const playPreview = dialog.querySelector('[data-playset-preview]'); playPreview.hidden = !playset;
    if (playset) playPreview.innerHTML = `${picnicScene(picnicRound({ version: 1, seed: 1, completed: [0, 1] }).orders, 3, { preview: true })}<h3>${tr('배운 말로, 우리 셋의 소풍을 완성해요', 'Three orders turn into a picnic together.')}</h3><p>${tr('토끼·다람쥐·사슴에게 음식을 건네면 돗자리 위에 하나씩 모여요. 3번 건네면 친구 셋이 함께하는 장면이 완성돼요.', 'Serve Rabbit, Squirrel and Deer. Your deliveries stay on the mat, one by one, until all three friends can enjoy the picnic.')}</p><p class="b-practice-note">${tr('영구 소유 · 반복 입장 무료 · 아직 처음이면 물과 빵을 그림과 함께 연습해요. 배우던 무료 가게·그림 도움은 그대로예요.', 'Keep forever. Replay freely. New learners begin with guided water and bread orders. Your free shop and picture help remain available.')}</p>`;
    const preview = kind => picked.kind === kind ? picked : PICKS.find(p => p.kind === kind && equipped(p)) || PICKS.find(p => p.kind === kind);
    const sign = preview('order-stall'), tray = preview('order-tray');
    dialog.querySelector('.b-decor-sign').style.backgroundImage = `url("${sign.image}")`;
    dialog.querySelector('.b-decor-sign').dataset.value = sign.value;
    dialog.querySelector('.b-decor-tray').style.backgroundImage = `url("${tray.image}")`;
    const goal = goalInfo?.goal;
    dialog.querySelector('[data-decor-goal]').innerHTML = goal ? `<strong>${tr(wallet?.owned?.includes(goal.id) ? '목표를 이뤘어요!' : '내가 모으는 목표', wallet?.owned?.includes(goal.id) ? 'Your goal is ready!' : 'Saving for my goal')}</strong><p>${tr(PICKS.find(p => p.id === goal.id)?.ko || goal.name, PICKS.find(p => p.id === goal.id)?.en || goal.nameEn || '')}</p><span>${tr(wallet?.owned?.includes(goal.id) ? '보유 중 · 지금 써 볼 수 있어요' : `${wallet?.coins || 0} / ${goal.price}코인 · ${Math.max(0, goal.price - (wallet?.coins || 0))}코인 남았어요`, wallet?.owned?.includes(goal.id) ? 'Owned · Ready to try' : `${Math.max(0, goal.price - (wallet?.coins || 0))} more coins to go`)}</span>` : '';
    rows.innerHTML = [['order-playset', '새로운 놀이', 'A new way to play'], ['order-stall', '가게 간판', 'Shop sign'], ['order-tray', '내 쟁반', 'Serving tray']].map(([kind, ko, en]) => `<section class="b-decor-category"><h3>${tr(ko, en)}</h3><div class="b-decor-grid ${kind === 'order-playset' ? 'playset-grid' : ''}">${PICKS.filter(p => p.kind === kind).map(p => {
      const item = catalog.find(i => i.id === p.id), state = equipped(p) ? ['적용 중', 'In use'] : owned(p) ? ['보유 중', 'Owned'] : item ? [`${item.price}코인`, `${item.price} coins`] : ['준비 중', 'Unavailable'];
      return `<button class="b-decor-card" data-decor-pick="${p.id}" aria-pressed="${selected === p.id}" ${busy ? 'disabled' : ''}><img src="${p.image}" alt=""><strong>${tr(p.ko, p.en)}</strong><span>${tr(...state)}</span></button>`;
    }).join('')}</div></section>`).join('');
    const item = catalog.find(i => i.id === selected);
    let cta;
    if (!wallet || !item) cta = `<button class="chip-btn" data-decor-retry ${busy ? 'disabled' : ''}>${tr('지갑 다시 열기', 'Try again')}</button>`;
    else if (playset && owned(picked)) cta = `<button class="felt-cta coral" data-decor-play ${busy ? 'disabled' : ''}>${tr('친구 3명 초대하기', 'Play three picnic orders')}</button>`;
    else if (equipped(picked)) cta = `<p>${tr('지금 이 모습으로 놀고 있어요', 'This decoration is already in use.')}</p>`;
    else if (owned(picked)) cta = `<button class="felt-cta coral" data-decor-equip ${busy ? 'disabled' : ''}>${tr('이 모습 적용하기', 'Use this decoration')}</button>`;
    else if (wallet.coins < item.price) cta = `<p>${tr(`${item.price - wallet.coins}코인 더 모으면 살 수 있어요`, `You need ${item.price - wallet.coins} more coins.`)}</p>`;
    else cta = `<button class="felt-cta coral" data-decor-buy ${busy ? 'disabled' : ''}>${tr(`${item.price}코인으로 구매하기`, `Buy for ${item.price} coins`)}</button>`;
    action.innerHTML = `<p><strong>${tr(picked.ko, picked.en)}</strong></p>${cta}${wallet && item && (!owned(picked) || goal?.id === picked.id) ? `<button class="chip-btn" data-decor-goal-toggle ${busy ? 'disabled' : ''}>${tr(goal?.id === picked.id ? '목표 해제하기' : '이걸 목표로 모으기', goal?.id === picked.id ? 'Clear this goal' : 'Save for this goal')}</button>` : ''}`;
    restoreFocus(focused);
  }
  async function refresh({ resetSelection = false } = {}) {
    const token = ++revision, view = viewRevision;
    let loaded = null, items = [];
    let nextGoal = null;
    try { [loaded, items, nextGoal] = await Promise.all([api?.load(), api?.catalog(), api?.beginnerProgress?.('order-rush')]); } catch { /* Keep playable defaults. */ }
    if (token !== revision) return false;
    wallet = loaded || null; catalog = Array.isArray(items) ? items : []; goalInfo = nextGoal || null;
    if (resetSelection && view === viewRevision) selected = goalInfo?.goal?.id || PICNIC_ID;
    apply(); onCollectionChange({ wallet, goalInfo }); if (dialog.open) render(); return true;
  }
  function fail(reason, purchased = false) {
    const prefix = purchased ? ['구매는 저장됐어요. ', 'Your purchase was saved. '] : ['', ''];
    const text = reason === 'storage-unavailable' ? ['저장할 수 없어 적용하지 않았어요. 저장 허용 후 다시 눌러 주세요.', 'The change could not be saved or applied. Allow browser storage and try again.'] : reason === 'insufficient' ? ['코인이 부족해요. 잔액을 다시 확인했어요.', 'You do not have enough coins. Your balance has been refreshed.'] : reason === 'owned' ? ['이미 가지고 있어요. 적용하기를 눌러 주세요.', 'You already own this. Choose Use this decoration.'] : ['지갑 연결을 확인하지 못했어요. 다시 눌러 주세요.', 'The wallet is unavailable. Please try again.'];
    say(prefix[0] + text[0], prefix[1] + text[1]);
  }
  document.addEventListener('pointerdown', () => { focusRevision++; }, true);
  document.addEventListener('keydown', () => { focusRevision++; }, true);
  dialog.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-decor-close')) { dialog.close(); return; }
    if (busy) return;
    if (b.hasAttribute('data-decor-play')) { dialog.close(); onPlayPicnic(); return; }
    if (b.hasAttribute('data-decor-goal-toggle')) {
      const itemId = selected, goalId = goalInfo?.goal?.id === itemId ? null : itemId, view = viewRevision, focused = rememberFocus();
      busy = true; render(); let result;
      try { result = await api.setBeginnerGoal('order-rush', goalId); } catch { result = { ok: false, reason: 'unavailable' }; }
      busy = false; const refreshed = await refresh(); if (!refreshed || !dialog.open || view !== viewRevision) return;
      if (!result?.ok) fail(result?.reason); else say(goalId ? '목표를 정했어요. 가게를 마치면 얼마나 모였는지 보여 드릴게요.' : '목표를 해제했어요.', goalId ? 'Goal saved. See your progress after finishing the shop.' : 'Goal cleared.');
      restoreFocus(focused, true); return;
    }
    if (b.dataset.decorPick) { selected = b.dataset.decorPick; viewRevision++; say(); render(); dialog.scrollTo({ top: 0, behavior: 'instant' }); dialog.querySelector(`[data-decor-pick="${selected}"]`)?.focus({ preventScroll: true }); return; }
    if (b.hasAttribute('data-decor-retry')) { const view = viewRevision, focused = rememberFocus(); if (!await refresh() || !dialog.open || view !== viewRevision) return; say(wallet ? '지갑을 다시 확인했어요.' : '이 브라우저에 저장할 수 없어 꾸미기를 사용할 수 없어요.', wallet ? 'Your wallet has been refreshed.' : 'Decorations require browser storage. You can keep playing with the default look.'); restoreFocus(focused, true); return; }
    const buy = b.hasAttribute('data-decor-buy'); if (!buy && !b.hasAttribute('data-decor-equip')) return;
    const itemId = selected, view = viewRevision, focused = rememberFocus();
    busy = true; render(); say('저장하고 있어요…', 'Saving…');
    let result;
    try { result = await (buy ? api.buy(itemId) : api.equip(itemId)); } catch { result = { ok: false, reason: 'unavailable' }; }
    busy = false; const refreshed = await refresh(); if (!refreshed || !dialog.open || view !== viewRevision) return;
    if (!result?.ok) fail(result?.reason);
    else if (buy && itemId === PICNIC_ID) say('초대 세트를 샀어요! 지금 친구 3명에게 음식을 건네 볼까요?', 'Your picnic set is ready! Try three orders with your friends now.');
    else if (buy) say('구매했어요. 적용하기를 누르면 가게에 바뀐 모습이 보여요.', 'Purchased. Choose Use this decoration to change your shop.');
    else say('가게에 적용했어요. 다음에 와도 이 모습이에요.', 'Applied to your shop and saved for your next visit.');
    restoreFocus(focused, true);
  });
  dialog.addEventListener('close', () => { if (dialog.open) return; viewRevision++; say(); if (opener?.isConnected) opener.focus({ preventScroll: true }); });
  window.addEventListener('storage', e => { if (e.key === api?.key && !busy) refresh(); });
  window.addEventListener('pageshow', () => refresh());
  window.addEventListener('synk:collection-change', () => { if(!busy)refresh(); });
  refresh();
  return { open: async (source, itemId) => { const view = ++viewRevision; opener = source || document.activeElement; beforeOpen(); say(); render(); dialog.showModal(); dialog.querySelector('[data-decor-close]').focus(); if (!await refresh({ resetSelection: true }) || !dialog.open || view !== viewRevision) return; if (PICKS.some(p => p.id === itemId)) { selected = itemId; render(); } if (!wallet) fail('storage-unavailable'); }, refresh };
}
