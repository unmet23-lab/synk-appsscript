import { ITEMS, COUNTS, STAGES, GUESTS, VOICE_LINES, SAVE_KEY, stageOrders, judge, observation, summary, metadata, newProgress, readProgress, shuffle } from './beginner-core.js';
import { BeginnerVoice } from './beginner-voice.js';
import { CafeAudio } from './beginner-effects.js';
import { createBeginnerShop } from './beginner-shop.js';
import { PICNIC_ID, picnicRound, picnicScene, createPicnicVisits } from './beginner-picnic.js';

// Restore the verified account before reading progress or enabling play.
await globalThis.SynkPlayAccount.ready();
const progressStorage = globalThis.SynkPlayAccount.storage();

const root = document.querySelector('#beginner'), pauseDialog = document.querySelector('#b-pause'), menuButton = document.querySelector('#menu-button');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const image = (item, cls = '') => `<img class="${cls}" src="${ITEMS[item].image}" alt="${ITEMS[item].name} · ${ITEMS[item].english}">`;
const images = (item, count) => `<div class="b-display-items">${Array.from({ length: count }, () => image(item)).join('')}</div>`;
const otherGames = () => '<button class="chip-btn b-bilingual" data-action="decorate">소풍·가게 상점<small class="b-en" lang="en">Picnic and shop</small></button><a class="chip-btn b-bilingual b-other-games" href="/try/learning-hub/#beginner-title">다른 입문 놀이 보기<small class="b-en" lang="en">Try another beginner game</small></a>';
const voice = new BeginnerVoice(), effects = new CafeAudio(() => {}); let storageOK = true, coach = null;
try { coach = globalThis.SynkLearning?.createGame({ gameId: 'order-rush', storage: localStorage }) || null; } catch { /* Local play can continue. */ }
const learn = (method, ...args) => { if (['answer', 'help', 'delivery'].includes(method) && !args[0]) return null; try { return coach?.[method]?.(...args); } catch { return null; } };
let progress; try { progress = readProgress(JSON.parse(progressStorage.getItem(SAVE_KEY))); } catch { progress = newProgress(); }
const picnicStorage = progressStorage;
const picnicVisits = createPicnicVisits(picnicStorage, progress.seed);
let screen = 'home', stageIndex = progress.stage, phase = 'demo', index = 0, orders = [], current = null, tray = [], attempt = null, solved = false, busy = false, paused = false, presentation = null, message = '', messageEnglish = '', error = '', hint = false, rush = false, seconds = 60, rushRecords = [], lastTick = 0, raf = 0, viewToken = 0;
let picnic = null, collectionSnapshot = null;
let theme = 'cream', inputMode = 'pointer'; try { theme = ['cream', 'coral', 'blue'].includes(progressStorage.getItem(`${SAVE_KEY}.theme`)) ? progressStorage.getItem(`${SAVE_KEY}.theme`) : 'cream'; } catch { /* Default. */ }
const shop = createBeginnerShop({ beforeOpen: () => { if (screen === 'play') pause(); viewToken++; voice.stop(); busy = false; }, onPlayPicnic: () => prepareAndStart('picnic'), onCollectionChange: snapshot => { collectionSnapshot = snapshot; renderCollectionPanels(); if (screen === 'picnic-ready' && !busy) renderPicnicEntrance(snapshot.wallet); } });
function announce(text) { const el = document.querySelector('#b-live'); el.textContent = ''; requestAnimationFrame(() => { el.textContent = text; }); }
function save() { try { progressStorage.setItem(SAVE_KEY, JSON.stringify(progress)); storageOK = true; } catch { storageOK = false; } }
function focusHeading() { window.scrollTo({ top: 0, behavior: 'instant' }); root.querySelector('h1,h2')?.setAttribute('tabindex', '-1'); root.querySelector('h1,h2')?.focus({ preventScroll: true }); }
function focusControl(node) { node?.focus({ preventScroll: inputMode !== 'keyboard' }); }
function focusTrayAction() { focusControl(root.querySelector(tray.length ? '[data-action="undo"]' : '[data-item]')); }
function translateUI() {
  const labels = { start: 'Start / resume', visit: '9 customers · no timer', rush: 'Optional · 60 seconds', results: 'My first shop', listen: 'Listen again', hint: 'Picture help', undo: 'Remove one', serve: 'Give the order', next: 'Continue', home: 'Back to the shop', continue: 'Open the next chapter' };
  const append = (node, text) => { if (!node || !text) return; const small = document.createElement('small'); small.className = 'b-en'; small.lang = 'en'; small.textContent = text; node.append(small); };
  for (const b of root.querySelectorAll('[data-action]')) { append(b, labels[b.dataset.action]); b.classList.add('b-bilingual'); }
  for (const b of root.querySelectorAll('[data-item]')) b.setAttribute('aria-label', `${ITEMS[b.dataset.item].name} 하나 담기 · Add one ${ITEMS[b.dataset.item].english}`);
  for (const b of root.querySelectorAll('[data-remove]')) b.setAttribute('aria-label', `${b.getAttribute('aria-label')} · Remove this item`);
  for (const a of root.querySelectorAll('a[href="./"]')) { append(a, 'Explore harder drink orders'); a.classList.add('b-bilingual'); }
  for (const n of root.querySelectorAll('.b-error')) append(n, 'Check your sound and connection, then try again.');
  const first = root.querySelector('.b-hero .intro'); append(first, 'Your first Korean shop. Listen, fill your tray, and make a friend. No reading needed.');
  const intro = root.querySelector('.b-start-card>p'); append(intro, progress.finished ? 'Play again at your own pace, or try the optional rush.' : 'Watch and try first. The customers will wait for you.');
  append(root.querySelector('.b-start-card .b-practice-note'), progress.finished ? 'The timer pauses while you listen or take a break.' : 'Turn your sound on. All Korean audio loads before you begin.');
  append(root.querySelector('.b-saved'), storageOK ? (globalThis.SynkPlayAccount.status().mode==='account'?'Your SYNK account keeps progress across devices. Check the save status above.':'This is browser-only guest progress. Sign in to continue across devices.') : 'Progress cannot be saved here. Keep this page open to continue.');
  if (screen === 'play') {
    append(root.querySelector('.b-instruction'), solved ? 'Delivered! Keep the same words and meet the next friend.' : phase === 'demo' || picnic?.guided ? `Put ${current.count} matching item${current.count > 1 ? 's' : ''} on the tray. Then give the order.` : 'Listen. Choose the items and number. Then give the order.');
    append(root.querySelector('.b-audio-label'), error ? 'Sound did not finish.' : busy ? 'Listen to the Korean.' : solved ? 'Thank you!' : phase === 'demo' || picnic?.guided ? `${current.count > 1 ? current.count + ' × ' : ''}${ITEMS[current.item].english}` : 'What does this customer want?');
    append(root.querySelector('.b-tray-label>span'), `Tray · ${tray.length} item${tray.length === 1 ? '' : 's'}`);
    append(root.querySelector('.b-feedback'), message ? messageEnglish : phase === 'demo' || picnic?.guided ? 'This is practice together, not a listening test.' : !storageOK ? 'Progress cannot be saved here. Keep this page open to continue.' : hint ? 'Picture help is on. This is guided practice.' : '');
    if (hint && phase !== 'demo' && !picnic?.guided) append(root.querySelector('.b-hint'), 'Picture help — this answer is guided practice.');
    const steps = ['Listen', 'Match the picture', 'Give the order']; root.querySelectorAll('.b-demo-steps li').forEach((li, i) => append(li, steps[i]));
  }
}
function closeObservation() { if (presentation && attempt && !attempt.attempts) learn('answer', presentation, { correct: null, assessable: false, reason: 'unanswered' }); presentation = null; }
function moveScreen(next) { viewToken++; voice.stop(); closeObservation(); screen = next; busy = false; error = ''; menuButton.hidden = !['play'].includes(next); }
function home() { if (screen === 'play') writeCheckpoint(true); cancelAnimationFrame(raf); moveScreen('home'); picnic = null; paused = false; if (pauseDialog.open) pauseDialog.close(); renderHome(); focusHeading(); }
const picnicSaveNote = stored => stored === false ? '<p class="b-picnic-save-note" role="status">소풍 순서를 저장하지 못했어요. 지금은 계속 놀 수 있지만 새로고침하면 같은 소풍이 다시 나올 수 있어요.<small class="b-en" lang="en">You can keep playing. The next order could repeat after a reload because this visit could not be saved.</small></p>' : '';
function renderPicnicEntrance(wallet, loading = false) {
  const owned = wallet?.owned?.includes(PICNIC_ID), preview = picnicRound(progress);
  root.innerHTML = `<section class="b-picnic-entry"><span class="kicker">MY PICNIC · THREE FRIENDS</span><h1>오늘은 어떤<br>소풍이 될까요?</h1>${picnicScene(preview.orders, 0, { preview: true })}<article class="paper"><h2>${owned ? '친구들이 기다리고 있어요' : loading ? '내 초대 세트를 확인해요' : '소풍 친구 초대 세트'}</h2><p>${owned ? '배운 말 안에서 주문과 친구 순서가 조금씩 달라져요. 소리를 켜고 세 친구를 만나 보세요.' : loading ? '보유한 물건을 불러오고 있어요.' : wallet ? '상점에서 초대 세트를 모으면 세 친구와 소풍을 완성할 수 있어요. 기본 가게와 그림 도움은 계속 무료예요.' : '브라우저 저장에서 보유한 세트를 확인하지 못했어요. 저장을 허용한 뒤 다시 확인해 주세요.'}<small class="b-en" lang="en">${owned ? 'Familiar words, changing orders and friends. Turn on your sound, then invite all three.' : loading ? 'Checking your collection…' : wallet ? 'Collect this playset in the shop to invite three friends. Your basic shop and picture help stay free.' : 'Your collection could not be read. Allow browser storage, then try again.'}</small></p>${owned ? `<p class="b-practice-note">${preview.guided ? '처음이면 물과 빵을 그림과 함께 만나요.' : '이미 배운 낱말과 요청만 다시 써 봐요.'} 소풍은 무료로 다시 놀 수 있어요.<small class="b-en" lang="en">${preview.guided ? 'Your first visit includes picture help for water and bread.' : 'Practice only the words and requests you have already learned.'} Replay this set freely.</small></p><button class="felt-cta coral b-bilingual" data-action="picnic">소리 켜고 소풍 시작<small class="b-en" lang="en">Start with sound</small></button>` : loading ? '' : wallet ? '<button class="felt-cta coral b-bilingual" data-action="picnic-shop">초대 세트 보러 가기<small class="b-en" lang="en">See the picnic playset</small></button>' : '<button class="felt-cta coral b-bilingual" data-action="picnic-ready">보유 세트 다시 확인<small class="b-en" lang="en">Check my collection again</small></button>'}<p id="b-load-status" class="b-status" role="status"></p><div class="b-link-row"><button class="chip-btn b-bilingual" data-action="home">무료 가게로 돌아가기<small class="b-en" lang="en">Back to the free shop</small></button></div></article></section>`;
}
async function showPicnicEntrance() {
  moveScreen('picnic-ready'); const token = viewToken; renderPicnicEntrance(null, true); focusHeading();
  let wallet; try { wallet = await globalThis.SynkPlayCollection?.load(); } catch { /* Keep an honest retry state. */ }
  if (token === viewToken && screen === 'picnic-ready') renderPicnicEntrance(wallet);
}
function renderCollectionPanels() {
  if (!['home', 'results', 'stage-end', 'picnic-end'].includes(screen)) return;
  if (!collectionSnapshot) return;
  let host = root.querySelector('[data-collection-status]'); if (!host) { host = document.createElement('section'); host.className = 'b-collection-card'; host.dataset.collectionStatus = ''; root.append(host); }
  const wallet = collectionSnapshot?.wallet, goal = collectionSnapshot?.goalInfo?.goal, owned = wallet?.owned?.includes(PICNIC_ID), goalOwned = goal && wallet?.owned?.includes(goal.id);
  const remaining = goal ? Math.max(0, goal.price - (wallet?.coins || 0)) : Math.max(0, 15 - (wallet?.coins || 0));
  const goalImage = !goal || goal.id === PICNIC_ID ? 'beginner-assets/picnic/rolled-mat.webp' : goal.kind === 'order-stall' ? ({ default: 'beginner-kit/felt/slab-cream-long.webp', blush: 'beginner-kit/felt/cushion-blush-strip.webp', lapis: 'beginner-kit/felt/cushion-lapis-strip.webp' }[goal.value]) : ({ cream: 'beginner-assets/felt/cushion-cream-mid.webp', butter: 'beginner-kit/felt/cushion-butter-wide.webp', coral: 'beginner-kit/felt/slab-coral-long.webp' }[goal.value]);
  host.innerHTML = `<img src="${goalImage}" alt=""><div><span class="kicker">${goalOwned ? 'MY GOAL · READY' : goal ? 'MY NEXT GOAL' : 'A LITTLE ADVENTURE'}</span><h2>${esc(goal?.name || '소풍 친구 초대 세트')}</h2><p>${goal ? goalOwned ? '목표를 이뤘어요. 원하던 보상을 바로 써 보세요.' : `${wallet?.coins || 0} / ${goal.price}코인 · ${remaining ? `${remaining}코인 더 모으면 돼요.` : '이제 살 수 있어요.'}` : '배운 말로 친구 3명의 소풍을 완성해요. 첫 가게 완주 코인으로 만날 수 있어요.'}<small class="b-en" lang="en">${goal ? goalOwned ? 'Goal achieved. Your reward is ready to use.' : `${remaining} more coins for your goal.` : 'Three friends, three orders, one picnic. Keep the set and replay freely.'}</small></p>${!wallet ? '<p class="b-practice-note">저장 공간을 사용할 수 없어 상점 정보를 읽지 못했어요. 무료 가게는 계속할 수 있어요.<small class="b-en">The shop needs browser storage. Your free shop is still available.</small></p>' : ''}<div class="b-link-row">${owned && (!goal || goal.id === PICNIC_ID) ? '<button class="felt-cta coral b-bilingual" data-action="picnic">친구 3명 초대하기<small class="b-en">Play three picnic orders</small></button>' : '<button class="chip-btn b-bilingual" data-action="goal-shop">목표와 상점 보기<small class="b-en">See my goal and shop</small></button>'}${!goal && wallet && !owned ? '<button class="chip-btn b-bilingual" data-action="goal-picnic">소풍을 목표로 모으기<small class="b-en">Save for the picnic</small></button>' : ''}${owned && goal && goal.id !== PICNIC_ID ? '<button class="chip-btn b-bilingual" data-action="picnic">내 소풍 놀이<small class="b-en">Play my picnic</small></button>' : ''}</div></div>`;
}
function renderHome() {
  const chapter = progress.finished ? null : STAGES[progress.stage];
  root.innerHTML = `<section class="b-hero"><div><span class="kicker">FIRST WORDS · MY LITTLE SHOP</span><h1>처음 여는<br>작은 가게</h1><p class="intro">물과 빵, 두 가지부터 천천히.<br>듣고 담고 건네면 친구가 생겨요.</p><p class="b-home-promise">한국어 처음이어도 괜찮아요 · 시간 제한 없이</p></div><div class="b-hero-art" aria-hidden="true"><span class="hero-note">오늘, 첫 영업<small>OPEN FOR FRIENDS</small></span><img src="beginner-kit/brand/mongle-cheer.webp" alt=""><div class="b-hero-counter"></div>${image('water', 'food')}${image('bread', 'food last')}<span class="b-hero-caption">물 · 빵부터 시작해요</span></div></section>
  <section class="b-start-grid"><article class="paper b-start-card"><span class="tag">${progress.finished ? '우리 가게가 문을 열었어요' : progress.checkpoint || progress.completed.length ? '지난번부터 이어서' : '첫날에는 이렇게'}</span><h2>${progress.finished ? '이제 어떻게 놀까요?' : chapter.title}</h2><p>${progress.finished ? '다시 편하게 손님을 만나거나, 60초 동안 배운 말로 작은 러시에 도전해요.' : '먼저 그림과 소리를 함께 만나요. 물건을 담아 손님에게 건네는 방법도 같이 해 봐요. 손님은 기다려 줘요.'}</p>
  <button class="felt-cta coral" data-action="${progress.finished ? 'visit' : 'start'}">${progress.finished ? '동네 축제 다시 열기' : progress.checkpoint || progress.completed.length ? '이어서 가게 열기' : '물과 빵 만나기'}</button>
  ${progress.finished ? '<button class="felt-cta" data-action="rush">60초 작은 러시</button><p class="b-practice-note">러시는 선택이에요. 주문을 듣거나 쉬는 동안 시계가 멈춰요.</p>' : '<p class="b-practice-note">소리가 꼭 필요해요. 소리를 모두 준비한 뒤 시작해요.</p>'}
  <p id="b-load-status" class="b-status" role="status"></p><p class="b-saved">${storageOK ? (globalThis.SynkPlayAccount.status().mode==='account'?'게임 진도를 계정에 이어 저장해요. 화면 위의 저장 상태를 확인해 주세요.':'비회원 체험 기록이에요. 로그인하면 다른 기기에서 이어갈 수 있어요.') : '저장 공간을 사용할 수 없어요. 이 화면 안에서는 계속할 수 있어요.'}</p>
  <div class="b-link-row">${otherGames()}${progress.finished ? '<button class="chip-btn" data-action="results">첫 영업 기록</button>' : ''}<a href="./" class="chip-btn">더 어려운 카페 주문 보기</a></div></article>
  <ol class="b-chapters">${STAGES.map((s, i) => `<li class="b-chapter ${progress.completed.includes(i) ? 'done' : ''}">${progress.completed.includes(i) ? '<img src="beginner-kit/felt/badge-check.webp" alt="완료 · Complete">' : `<b class="b-number">${i + 1}</b>`}<div><strong>${s.title}</strong><small>${s.subtitle}</small><small lang="en">${['First words: water & bread', 'Fruit and polite requests', 'One, two, three items', 'The neighborhood festival'][i]}</small></div></li>`).join('')}</ol></section>`;
  translateUI(); renderCollectionPanels();
}
async function prepareAndStart(kind = 'story') {
  if (busy) return; busy = true;
  const launchToken = ++viewToken;
  effects.unlock();
  const status = document.querySelector('#b-load-status');
  if (status) { status.className = 'b-status'; status.textContent = '한국어 소리를 준비하고 있어요… Preparing Korean audio…'; }
  for (const b of root.querySelectorAll('button')) b.disabled = true;
  try { await voice.prepare(); } catch (e) {
    if (launchToken !== viewToken) return;
    busy = false; if (status) { status.className = 'b-error'; status.textContent = `${e.message} Audio is not ready. Please try again.`; }
    for (const b of root.querySelectorAll('button')) b.disabled = false;
    announce(e.message); return;
  }
  if (launchToken !== viewToken || document.hidden) { busy = false; return; }
  if (kind === 'picnic') {
    let wallet; try { wallet = await globalThis.SynkPlayCollection?.load(); } catch { /* Check ownership again at the actual entrance. */ }
    if (launchToken !== viewToken || document.hidden) { busy = false; return; }
    if (!wallet?.owned?.includes(PICNIC_ID)) { busy = false; for (const b of root.querySelectorAll('button')) b.disabled = false; if (status) status.textContent = '초대 세트 보유를 확인하지 못했어요. 상점에서 다시 확인해 주세요. / Please check your picnic set in the shop.'; return; }
    busy = false; rush = false; cancelAnimationFrame(raf); if (pauseDialog.open) pauseDialog.close(); paused = false;
    const visit = picnicVisits.next(progress); picnic = { ...visit.round, stored: visit.stored }; stageIndex = picnic.stage; orders = picnic.orders; index = 0; phase = 'order'; rushRecords = []; startPlay(true); return;
  }
  busy = false; rush = kind === 'rush';
  picnic = null;
  if (kind !== 'story' && !progress.finished) return;
  if (!progress.roundId) { progress.roundId = globalThis.SynkPlayCollection?.roundId('order-rush') || `order-rush:beginner-${crypto.randomUUID()}`; save(); }
  stageIndex = kind === 'story' ? progress.stage : 3;
  orders = stageOrders(stageIndex, progress.seed + stageIndex);
  if (rush) { seconds = 60; rushRecords = []; index = 0; phase = 'order'; startPlay(); lastTick = performance.now(); raf = requestAnimationFrame(tick); }
  else if (kind === 'visit') { phase = 'order'; index = 0; rushRecords = []; startPlay(true); }
  else { const checkpoint = progress.checkpoint; phase = checkpoint?.phase || (STAGES[stageIndex].demos.length ? 'demo' : 'order'); index = checkpoint?.index || 0; startPlay(false, checkpoint?.touched === true); }
}
let visiting = false;
function demoOrder(id) {
  const count = /-[123]$/.test(id) ? Number(id.at(-1)) : 1;
  const item = id.startsWith('count-') ? 'bread' : id.split('-')[0];
  return { item, count, voice: id, text: VOICE_LINES.find(v => v.id === id).text, guest: 'mongle', serial: `demo-${index}` };
}
function writeCheckpoint(touched = false) {
  if (rush || visiting || progress.finished || solved) return;
  progress.checkpoint = { stage: stageIndex, phase, index, touched, attempts: attempt?.attempts || 0, firstCorrect: attempt?.firstCorrect ?? null, helped: !!attempt?.help, replayed: !!attempt?.replay, tray: [...tray], hint };
  save();
}
function startPlay(visit = visiting, resumed = false) {
  visiting = visit; moveScreen('play'); solved = false; hint = phase === 'demo' || !!picnic?.guided; tray = []; message = ''; messageEnglish = ''; paused = false;
  const checkpoint = progress.checkpoint;
  if (resumed) { tray = [...(checkpoint?.tray || [])]; hint ||= checkpoint?.hint === true; message = tray.length ? '담아 둔 쟁반을 가져왔어요. 주문을 다시 듣고 이어서 건네 주세요.' : ''; messageEnglish = tray.length ? 'Your tray is back. Listen again and continue.' : ''; }
  current = phase === 'demo' ? demoOrder(STAGES[stageIndex].demos[index]) : orders[index];
  attempt = { stage: stageIndex, demo: phase === 'demo' || !!picnic?.guided, heard: false, help: resumed || phase === 'demo' || !!picnic?.guided, replay: false, resumed, attempts: 0, firstCorrect: null };
  if (resumed) { attempt.attempts = checkpoint?.attempts || 0; attempt.firstCorrect = checkpoint?.firstCorrect ?? null; attempt.help ||= checkpoint?.helped; attempt.replay = !!checkpoint?.replayed; }
  // A first submission already stored before reload is not a new Atlas item.
  if (phase === 'order' && !picnic?.guided && !attempt.attempts) { presentation = learn('present', metadata(current)); if (resumed) learn('help', presentation, 'text'); }
  writeCheckpoint(resumed); renderPlay(); focusHeading(); playCurrent();
}
function guest() { const g = GUESTS.find(g => g.id === current?.guest) || { name: '몽글', arrival: '먼저 같이 해 봐요.', thanks: '맞아요. 이렇게 건네면 돼요!', reaction: '같이 해 봤어요' }; return picnic ? { ...g, arrival: '소풍 자리를 함께 준비해요.', thanks: '여기 두고 함께 먹어요!', reaction: '소풍에 한 자리 더' } : g; }
function renderPlay() {
  if (screen !== 'play') return;
  const stage = STAGES[stageIndex], g = guest(), demo = phase === 'demo' || !!picnic?.guided;
  const shelfItems = demo ? [...new Set([current.item, ...(picnic?.items || stage.items)])].slice(0, 3) : shuffle(picnic?.items || stage.items, progress.seed + index + stageIndex * 71);
  const label = error ? '소리를 다시 준비해 주세요' : busy ? '한국어를 듣고 있어요…' : solved ? g.reaction : demo ? current.text : '손님은 무엇을 원할까요?';
  root.innerHTML = `<section class="b-stage-head"><div><p>${picnic ? picnic.guided ? '그림과 함께 · 소풍 시범' : '배운 말 다시 쓰기 · 소풍 복습' : rush ? '배운 말로 즐기는 60초' : `첫 영업 · ${stageIndex + 1} / 4`}</p><h1>${picnic ? '소풍 친구 초대' : rush ? '60초 작은 러시' : stage.title}</h1></div><div class="b-counter"><span>${picnic ? `친구 ${index + 1}/3` : demo ? `같이 해 보기 ${index + 1}/${stage.demos.length}` : rush ? `<b id="b-time">${Math.ceil(seconds)}</b>초` : `손님 ${index + 1}/${orders.length}`}</span>${rush ? `<span>${rushRecords.length}명 서빙</span>` : '<span>천천히 해도 돼요</span>'}</div></section>
  ${picnic ? picnicSaveNote(picnic.stored) : ''}${rush ? `<progress class="b-rush-meter" max="60" value="${seconds}" aria-label="남은 영업 시간"></progress>` : ''}
  <section class="b-shop b-theme-${theme}"><div class="b-scene ${stage.scene}" data-demo="${demo}">${picnic ? picnicScene(orders, index + (solved ? 1 : 0), { active: solved ? null : current.guest }) : `<div class="b-scene-view"><span class="b-shop-sign">${stageIndex ? ['작은 가게', '소풍 도시락 가게', '함께 먹는 가게', '우리 동네 축제'][stageIndex] : '작은 가게'}</span>${stageIndex > 0 ? '<img class="b-lantern" src="beginner-assets/progress/lantern.webp" alt="가게에 켜진 새 등">' : ''}<img class="b-guest" src="${demo ? 'beginner-kit/brand/mongle-smile.webp' : `beginner-assets/cast/${current.guest}.webp`}" alt="${g.name} 손님"><div class="b-scene-counter" aria-hidden="true"></div><span class="b-guest-label">${g.name}</span>${stageIndex > 0 ? `<img class="b-store-photo" src="beginner-assets/cast/face/${GUESTS[(stageIndex - 1) * 2].id}.webp" alt="지난 손님의 기념사진">` : ''}</div>`}
  <div class="b-bubble paper"><p class="b-arrival">${g.arrival}</p><p class="b-audio-label" id="b-audio-status">${esc(label)}</p>${solved ? `<p>${g.thanks}</p>` : ''}
  ${hint ? `<div class="b-hint">${images(current.item, current.count)}${!demo ? `<strong>${esc(current.text)}</strong>` : ''}</div>` : ''}
  <div class="b-tools">${!solved ? `<button class="chip-btn" data-action="listen" ${busy ? 'disabled' : ''}>${error ? '소리 다시 시도' : attempt.heard ? '다시 듣기' : '소리 듣기'}</button>${!demo ? `<button class="chip-btn" data-action="hint" ${busy ? 'disabled' : ''}>그림 도움</button>` : ''}` : ''}</div>${error ? `<p class="b-error">${esc(error)}</p>` : ''}</div>
  </div>
  <div class="b-workstation">
  ${demo ? `<ol class="b-demo-steps"><li class="${!attempt.heard ? 'active' : ''}"><b>1</b>소리 듣기</li><li class="${attempt.heard && !tray.length ? 'active' : ''}"><b>2</b>같은 물건 담기</li><li class="${tray.length ? 'active' : ''}"><b>3</b>손님에게 주기</li></ol>` : ''}
  <p class="b-instruction">${solved ? `<strong>${picnic ? '음식이 소풍 돗자리에 모였어요!' : demo ? '직접 건네 봤어요!' : '주문한 물건이 손님에게 갔어요!'}</strong>` : demo ? `<strong>그림과 같은 물건 ${current.count}개</strong>를 담아 건네 주세요.` : '들었던 물건을 담고 손님에게 건네 주세요.'}</p>
  <div class="b-shelf ${shelfItems.length === 2 ? 'two' : ''}" role="group" aria-label="진열된 물건">${shelfItems.map((item, n) => `<button class="b-item ${demo && item === current.item ? 'demo-target' : ''}" data-item="${item}" aria-label="${ITEMS[item].name} 하나 담기" ${!attempt.heard || busy || solved ? 'disabled' : ''}><span class="b-key" aria-hidden="true">${n + 1}</span>${image(item)}${demo ? `<span class="b-word">${ITEMS[item].name}</span>` : ''}</button>`).join('')}</div>
  <div class="b-tray-label"><span>내 쟁반 · ${tray.length}개</span><button class="chip-btn" data-action="undo" ${!tray.length || solved || busy ? 'disabled' : ''}>하나 빼기</button></div>
  <div class="b-tray ${solved ? 'delivered' : ''}" aria-label="내가 담은 물건">${tray.map((item, i) => `<button data-remove="${i}" aria-label="${ITEMS[item].name} 빼기" ${solved || busy ? 'disabled' : ''}>${image(item)}</button>`).join('')}</div>
  ${!solved ? `<p class="b-gesture">${stageIndex >= 2 ? '같은 그림을 두 번 누르면 두 개가 담겨요.' : '위의 물건 그림을 누르면 쟁반에 담겨요.'} 쟁반의 물건을 누르면 빠져요.<small class="b-en" lang="en">${stageIndex >= 2 ? 'Tap twice for two items.' : 'Tap a picture above to fill your tray.'} Tap an item on the tray to remove it.</small></p>` : ''}
  <p class="b-feedback" role="status">${esc(message || (demo ? '시범은 듣기 정답으로 세지 않아요.' : !storageOK ? '진도를 저장할 수 없어요. 이 화면에서는 계속할 수 있어요.' : hint ? '그림 도움을 보고 연습하고 있어요.' : ''))}</p>
  <button class="felt-cta coral b-primary" data-action="${solved ? 'next' : 'serve'}" ${!solved && (!attempt.heard || busy || !tray.length) ? 'disabled' : ''}>${solved ? picnic ? index === 2 ? '완성한 소풍 보기' : '다음 친구 초대하기' : demo ? '다음으로' : index === orders.length - 1 && !rush ? '오늘의 가게 보기' : '다음 손님' : '손님에게 주기'}</button>
  <details class="b-shortcuts"><summary>키보드로 놀기 · Keyboard controls</summary><p>1–3 담기 · Backspace 빼기 · R 듣기 · H 도움 · G 건네기/다음 · Enter 선택 · Esc 쉬기</p></details></div></section>`;
  translateUI();
}
async function playCurrent() {
  if (screen !== 'play' || paused || solved || busy) return;
  const token = viewToken, order = current, retry = !!error, alreadyHeard = attempt.heard;
  if (attempt.heard) { attempt.replay = true; learn('help', presentation, 'replay'); }
  busy = true; error = ''; writeCheckpoint(true); renderPlay();
  if (retry) {
    try { await voice.prepare({ refresh: true }); }
    catch (e) { if (token !== viewToken || screen !== 'play' || paused) return; busy = false; error = e.message; renderPlay(); focusControl(root.querySelector('[data-action="listen"]')); return; }
    if (token !== viewToken || screen !== 'play' || paused) return;
  }
  if (!alreadyHeard) learn('delivery', presentation, { audio: 'pending' });
  const heard = await voice.play(order.voice);
  if (token !== viewToken || screen !== 'play' || paused || current !== order) return;
  busy = false;
  if (heard) { attempt.heard = true; if (!alreadyHeard) learn('delivery', presentation, { audio: 'completed' }); }
  else { error = '소리를 끝까지 듣지 못했어요. 소리 다시 시도를 눌러 주세요.'; if (!alreadyHeard) learn('delivery', presentation, { audio: 'failed' }); }
  renderPlay(); if (inputMode === 'keyboard' || !heard) focusControl(root.querySelector(heard ? '[data-item]' : '[data-action="listen"]'));
}
function addItem(item) {
  if (screen !== 'play' || paused || solved || busy || !attempt.heard || !ITEMS[item]) return;
  if (stageIndex < 2 && current.count === 1) tray = [item];
  else if (tray.length < 3) tray.push(item);
  else { message = '쟁반에는 세 개까지 담을 수 있어요. 하나 빼고 담아 주세요.'; messageEnglish = 'The tray holds three items. Remove one before adding another.'; announce(`${message} ${messageEnglish}`); renderPlay(); focusTrayAction(); return; }
  effects.tone('tap'); message = ''; messageEnglish = ''; writeCheckpoint(true); renderPlay(); focusControl(root.querySelector(`[data-item="${item}"]`)); announce(`${ITEMS[item].name}. 쟁반 ${tray.length}개. Tray: ${tray.length}.`);
}
function showHint() {
  if (screen !== 'play' || paused || solved || busy || phase === 'demo') return;
  hint = true; attempt.help = true; learn('help', presentation, 'text'); writeCheckpoint(true); renderPlay(); focusControl(root.querySelector('[data-action="hint"]')); root.querySelector('.b-hint')?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); announce('주문 그림과 글을 보여 줬어요. 도움을 받은 연습으로 남겨요. Picture help is shown. This is guided practice.');
}
function serve() {
  if (screen !== 'play' || paused || solved || busy || !attempt.heard || !tray.length) return;
  const result = judge(current, tray); attempt.attempts++;
  if (attempt.firstCorrect === null) { attempt.firstCorrect = result.correct; if (phase === 'order') learn('answer', presentation, { correct: result.correct, assessable: attempt.heard, reason: attempt.heard ? undefined : 'audio' }); }
  if (!result.correct) {
    attempt.help = true; hint = true; learn('help', presentation, 'hint');
    message = result.itemMismatch ? '손님이 기다리는 물건을 그림으로 다시 볼까요? 쟁반에서 빼고 바꿀 수 있어요.' : `물건은 맞아요. 그림의 수만큼 담아 볼까요?`;
    messageEnglish = result.itemMismatch ? 'Check the picture. Remove the wrong items from your tray and try again.' : 'The item is right. Match the number of items in the picture and try again.';
    writeCheckpoint(true); renderPlay(); focusControl(root.querySelector('[data-action="hint"], [data-item]')); root.querySelector('.b-hint')?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); announce(`${message} ${messageEnglish}`); return;
  }
  solved = true; voice.stop(); busy = false; effects.tone('serve');
  message = phase === 'demo' ? '이 소리와 물건을 함께 만났어요. 다음에는 직접 들어 봐요.' : attempt.firstCorrect && !attempt.help && !attempt.replay && !attempt.resumed ? '첫 소리만 듣고 딱 맞게 건넸어요.' : '다시 듣거나 도움을 보며 끝까지 건넸어요.';
  messageEnglish = phase === 'demo' ? 'You matched the sound and picture. Ready for the next one?' : attempt.firstCorrect && !attempt.help && !attempt.replay && !attempt.resumed ? 'You delivered the right order after one listen.' : 'You worked through the order and delivered it. Keep going!';
  if (phase === 'order') {
    const record = observation(current, attempt); if (rush || visiting) rushRecords.push(record); else progress.records.push(record);
  }
  if (!rush && !visiting) {
    if (phase === 'demo') progress.checkpoint = index + 1 < STAGES[stageIndex].demos.length ? { stage: stageIndex, phase: 'demo', index: index + 1 } : { stage: stageIndex, phase: 'order', index: 0 };
    else if (index + 1 < orders.length) progress.checkpoint = { stage: stageIndex, phase: 'order', index: index + 1 };
    else { if (!progress.completed.includes(stageIndex)) progress.completed.push(stageIndex); progress.stage = Math.min(stageIndex + 1, 3); progress.finished = progress.completed.length === 4; progress.checkpoint = null; }
    save();
  }
  renderPlay(); announce(`${guest().thanks} ${message}`); root.querySelector('[data-action="next"]')?.focus({ preventScroll: true });
}
function next() {
  if (!solved || paused) return;
  if (phase === 'demo') { index++; if (index >= STAGES[stageIndex].demos.length) { phase = 'order'; index = 0; } startPlay(); return; }
  index++;
  if (rush) { if (index >= orders.length) { orders = stageOrders(3, progress.seed + rushRecords.length + 991); index = 0; } startPlay(); return; }
  if (index >= orders.length) { if (visiting) finishVisit(); else stageComplete(); return; }
  startPlay();
}
function stageComplete() {
  moveScreen('stage-end'); effects.tone('done');
  if (stageIndex === 3) { renderResults(); return; }
  const s = STAGES[stageIndex], nextStage = STAGES[stageIndex + 1], stats = summary(progress.records.filter(r => r.stage === stageIndex));
  root.innerHTML = `<section class="b-finish"><img class="b-mongle" src="beginner-kit/brand/mongle-cheer.webp" alt="기뻐하는 몽글"><span class="kicker">오늘의 작은 변화</span><h1>${s.title}<br>잘 마쳤어요!</h1><article class="paper"><div class="b-gallery">${orders.slice(0, 6).map(o => `<img src="beginner-assets/cast/face/${o.guest}.webp" alt="${GUESTS.find(g => g.id === o.guest).name} 손님 사진">`).join('')}</div><p class="intro">${s.reward}</p><div class="b-stats"><div class="b-stat"><b>${stats.total}</b><span>끝까지 건넨 주문</span></div><div class="b-stat"><b>${stats.independent}</b><span>도움 없이 첫 정답</span></div></div><p class="b-practice-note">시범은 위 숫자에 넣지 않았어요. 도움과 재시도도 가게를 완성하는 연습이에요.</p><button class="felt-cta coral" data-action="continue">${nextStage.title} 열기</button><div class="b-link-row"><button class="chip-btn" data-action="home">여기서 쉬기</button>${otherGames()}</div></article></section>`;
  translateUI(); renderCollectionPanels(); focusHeading();
}
function renderResults() {
  moveScreen('results'); const s = summary(progress.records);
  root.innerHTML = `<section class="b-finish"><span class="kicker">FIRST SHOP COMPLETE</span><h1>우리 동네에<br>가게가 생겼어요!</h1><div class="b-gallery">${GUESTS.map(g => `<img src="beginner-assets/cast/face/${g.id}.webp" alt="${g.name} 손님">`).join('')}</div><article class="paper"><h2>한국어로 건넨 첫 주문들</h2><div class="b-stats"><div class="b-stat"><b>${s.total}</b><span>끝까지 건넨 주문</span></div><div class="b-stat"><b>${s.independent}</b><span>도움 없이 첫 정답</span></div><div class="b-stat"><b>${s.retried}</b><span>고쳐서 건넨 주문</span></div></div><p class="b-explain">물·빵·사과, 한 개·두 개·세 개, 그리고 “주세요”를 만났어요. 같은 말을 다른 손님에게도 써 봤어요.</p><p class="b-practice-note">그림 도움·다시 듣기·이어 하기 후 답은 혼자 이해한 근거에 넣지 않아요. ${s.helped}개는 도움을 받았어요. 이 숫자는 TOPIK 점수나 한국어 숙달 판정이 아니에요.</p><div class="b-learned">${Object.keys(ITEMS).map(id => `<button data-rehear="${id}" aria-label="${ITEMS[id].name} 다시 듣기">${image(id)}<span>${ITEMS[id].name}</span></button>`).join('')}</div><p class="b-coins" id="b-coins" role="status"></p><p id="b-load-status" class="b-status" role="status"></p><button class="felt-cta coral" data-action="visit">시간 제한 없이 축제 다시 열기</button><button class="felt-cta" data-action="rush">60초 작은 러시</button><div class="b-link-row"><button class="chip-btn" data-action="home">가게 입구로</button>${otherGames()}</div><div class="b-bridge"><strong>다음에는 음료를 만들어 볼까요?</strong><br>카페에서는 커피·차·우유와 따뜻하게·차갑게를 새로 배워요.<br>처음에는 ‘한가한 오픈’의 글 도움과 메뉴판을 함께 보세요.<a class="felt-cta" href="./">카페 음료 주문 둘러보기</a></div></article></section>`;
  translateUI(); renderCollectionPanels(); focusHeading(); awardStory();
}
async function awardStory() {
  const s = summary(progress.records), el = root.querySelector('#b-coins');
  if (!progress.finished || s.total !== STAGES.reduce((n, stage) => n + stage.rounds, 0) || !progress.roundId || !el || !globalThis.SynkPlayCollection) return;
  try { const result = await globalThis.SynkPlayCollection.award({ game: 'order-rush', total: s.total, correct: s.independent, completed: true, automatic: false, roundId: progress.roundId }); el.textContent = globalThis.SynkPlayCollection.rewardText(result); await shop.refresh(); } catch { el.textContent = '코인 연결을 확인하지 못했어요. 영업 진도는 저장돼 있어요.'; }
}
function finishPicnic() {
  const completed = picnic; cancelAnimationFrame(raf); closeObservation(); moveScreen('picnic-end'); rush = false; visiting = false; picnic = null;
  root.innerHTML = `<section class="b-finish b-picnic-finish"><span class="kicker">THREE FRIENDS · ONE PICNIC</span><h1>배운 말로<br>소풍을 완성했어요!</h1>${picnicScene(completed.orders, 3)}${picnicSaveNote(completed.stored)}<article class="paper"><h2>내가 건넨 음식이 모였어요</h2><p class="b-explain">토끼·다람쥐·사슴이 모두 모였어요. ${completed.guided ? '그림과 소리를 함께 보며 물과 빵을 건넸어요.' : '가게에서 배운 말을 다른 장소에서도 써 봤어요.'}<small class="b-en">Rabbit, Squirrel and Deer are all here. ${completed.guided ? 'You practiced water and bread with pictures and sound.' : 'You used familiar Korean orders in a new place.'}</small></p><p class="b-practice-note">${completed.guided ? '이 소풍은 시범이에요. 본편 주문 기록이나 혼자 이해한 정답으로 세지 않아요.' : '같은 표현을 다시 쓰는 복습이에요. 본편 진도와 첫 영업 숫자는 그대로예요.'} 소풍 반복은 추가 코인을 주지 않아요.<small class="b-en">${completed.guided ? 'Guided practice does not count as an independent listening result.' : 'This repeats familiar expressions and keeps your main story progress unchanged.'} Picnic replays earn no extra coins.</small></p><p id="b-load-status" class="b-status" role="status"></p><button class="felt-cta coral b-bilingual" data-action="picnic">친구들과 한 번 더<small class="b-en">Replay the picnic · Free</small></button><div class="b-link-row"><button class="chip-btn" data-action="home">무료 가게로 돌아가기</button>${otherGames()}</div></article></section>`;
  translateUI(); renderCollectionPanels(); focusHeading(); effects.tone('done');
}
function finishVisit() {
  if (picnic) { finishPicnic(); return; }
  const wasRush = rush; cancelAnimationFrame(raf); closeObservation(); moveScreen('visit-end'); const s = summary(rushRecords); rush = false; visiting = false;
  root.innerHTML = `<section class="b-finish"><img class="b-mongle" src="beginner-kit/brand/mongle-smile.webp" alt="몽글"><h1>${wasRush ? '바쁜 영업도 마쳤어요!' : '축제가 따뜻하게 끝났어요!'}</h1><article class="paper"><div class="b-stats"><div class="b-stat"><b>${s.total}</b><span>건넨 주문</span></div><div class="b-stat"><b>${s.independent}</b><span>도움 없이 첫 정답</span></div></div><p class="b-explain">${wasRush ? '시계가 끝날 때 기다리던 손님은 다음 영업에 와요. 미처 못 건넨 주문은 듣기 오답으로 세지 않아요.' : '같은 말을 다른 순서로 다시 써 봤어요. 새 학습 문제나 독립된 새 성공으로 부풀리지 않아요.'}</p><p class="b-practice-note">선택 복습과 작은 러시는 추가 코인을 주지 않아요. 가게에 더 익숙해지는 놀이예요.</p><p id="b-load-status" class="b-status" role="status"></p><button class="felt-cta coral" data-action="visit">천천히 한 번 더</button><div class="b-link-row"><button class="chip-btn" data-action="home">가게 입구로</button><button class="chip-btn" data-action="rush">60초 다시 도전</button>${otherGames()}</div></article></section>`; translateUI(); focusHeading();
}
function tick(now) {
  const delta = Math.min(.25, Math.max(0, (now - lastTick) / 1000)); lastTick = now;
  if (rush && screen === 'play' && !paused && !busy && !document.hidden && attempt?.heard) {
    seconds = Math.max(0, seconds - delta); const time = document.querySelector('#b-time'), meter = root.querySelector('progress'); if (time) time.textContent = Math.ceil(seconds); if (meter) meter.value = seconds;
    if (!seconds) { finishVisit(); return; }
  }
  if (rush) raf = requestAnimationFrame(tick);
}
function pause() {
  if (screen !== 'play' || paused) return; paused = true; viewToken++; voice.stop(); busy = false; writeCheckpoint(true);
  document.querySelector('#b-pause-status').innerHTML = storageOK ? `천천히 해도 괜찮아요. ${rush || visiting ? '복습은 이 창에서 이어 할 수 있어요. 입구로 나가면 복습을 새로 시작해요.' : '진도와 담아 둔 쟁반을 저장했어요.'}<small class="b-en">${rush || visiting ? 'Resume here. Returning home starts a new practice round.' : 'Your progress and tray are saved. Take your time.'}</small>` : '지금 화면에서 이어 할 수 있어요. 이 브라우저에 진도를 저장하지 못했어요.<small class="b-en">You can continue here, but progress could not be saved.</small>';
  pauseDialog.showModal(); document.querySelector('#b-resume').focus();
}
function resume() {
  if (!paused) return; paused = false; pauseDialog.close(); if (!attempt.heard && !solved) playCurrent(); else { renderPlay(); root.querySelector(solved ? '[data-action="next"]' : '[data-item]')?.focus({ preventScroll: true }); }
}
root.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.action === 'decorate') { shop.open(b); return; }
  if (b.dataset.action === 'picnic-shop') { shop.open(b, PICNIC_ID); return; }
  if (b.dataset.action === 'picnic-ready') { showPicnicEntrance(); return; }
  if (b.dataset.action === 'goal-shop') { shop.open(b, collectionSnapshot?.goalInfo?.goal?.id || PICNIC_ID); return; }
  if (b.dataset.action === 'goal-picnic') { b.disabled = true; (async () => { let result; try { result = await globalThis.SynkPlayCollection?.setBeginnerGoal('order-rush', PICNIC_ID); } catch { /* Leave the game usable. */ } if (result?.ok) await shop.refresh(); else { b.disabled = false; const host = b.closest('[data-collection-status]'); let message = host?.querySelector('[data-goal-error]'); if (host && !message) { message = document.createElement('p'); message.dataset.goalError = ''; message.className = 'b-error'; message.setAttribute('role', 'status'); host.append(message); } if (message) message.textContent = '목표를 저장하지 못했어요. 상점에서 다시 확인해 주세요. / Your goal could not be saved. Try again in the shop.'; } })(); return; }
  if (b.dataset.item) { addItem(b.dataset.item); return; }
  if (b.dataset.remove !== undefined && !solved && !busy) { tray.splice(Number(b.dataset.remove), 1); message = ''; messageEnglish = ''; writeCheckpoint(true); renderPlay(); focusTrayAction(); return; }
  if (b.dataset.rehear) { const token = ++viewToken; voice.stop(); (async () => { try { await voice.prepare(); if (token === viewToken && screen === 'results' && !document.hidden) await voice.play(b.dataset.rehear); } catch (err) { if (token === viewToken) { const status = document.querySelector('#b-load-status'); if (status) status.textContent = err.message; } } })(); return; }
  const actions = { start: () => prepareAndStart(), visit: () => prepareAndStart('visit'), rush: () => prepareAndStart('rush'), picnic: () => prepareAndStart('picnic'), listen: playCurrent, hint: showHint, serve, next, home, results: renderResults,
    undo: () => { if (!solved && !busy) { tray.pop(); message = ''; messageEnglish = ''; writeCheckpoint(true); renderPlay(); focusTrayAction(); } },
    continue: () => { stageIndex = progress.stage; orders = stageOrders(stageIndex, progress.seed + stageIndex); phase = STAGES[stageIndex].demos.length ? 'demo' : 'order'; index = 0; startPlay(false); } };
  actions[b.dataset.action]?.();
});
document.addEventListener('keydown', e => {
  inputMode = 'keyboard';
  if (screen !== 'play' || paused || e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.target.closest?.('input,textarea,select')) return;
  if (e.code === 'Escape') { e.preventDefault(); pause(); return; }
  if (e.code === 'Space' && e.target.closest('button,a')) return;
  const numbers = { Digit1: 0, Digit2: 1, Digit3: 2 };
  if (e.code in numbers) { e.preventDefault(); root.querySelectorAll('[data-item]')[numbers[e.code]]?.click(); }
  else if (e.code === 'KeyR') { e.preventDefault(); playCurrent(); }
  else if (e.code === 'KeyH') { e.preventDefault(); showHint(); }
  else if (e.code === 'KeyG') { e.preventDefault(); solved ? next() : serve(); }
  else if (e.code === 'Backspace') { e.preventDefault(); root.querySelector('[data-action="undo"]')?.click(); }
  else if (e.code === 'Space') { e.preventDefault(); solved ? next() : serve(); }
});
menuButton.addEventListener('click', pause); document.querySelector('#b-resume').addEventListener('click', resume); document.querySelector('#b-home').addEventListener('click', home);
document.querySelector('#b-decor-open').addEventListener('click', e => shop.open(e.currentTarget));
pauseDialog.addEventListener('cancel', e => { e.preventDefault(); resume(); });
document.addEventListener('pointerdown', () => { inputMode = 'pointer'; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (screen === 'play') pause(); else { viewToken++; voice.stop(); busy = false; for (const b of root.querySelectorAll('button')) b.disabled = false; } } });
window.addEventListener('pagehide', () => { viewToken++; voice.stop(); if (screen === 'play') writeCheckpoint(true); learn('flush'); });
renderHome();
const entryParams = new URLSearchParams(location.search);
if (entryParams.get('shop') === '1') shop.open(root.querySelector('[data-action="decorate"]'));
else if (entryParams.get('play') === 'picnic') showPicnicEntrance();
