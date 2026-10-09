import { createWardrobeController } from './generated/wardrobe-client.cjs';
import { COSTUMES, BACKGROUNDS } from './generated/wardrobe-catalog.cjs';
import { createWardrobeThreePreview } from './wardrobe-three-preview.mjs';

// These are reviewed, whole-character images. A costume ID is never a layer.
export const COSTUME_IMAGES = Object.freeze({
  'mongle-basic': 'mongle-basic.webp', 'marin-basic': 'marin-basic.webp',
  'kkamong-basic': 'kkamong-base.webp', 'kkamong-scarf': 'kkamong-scarf.webp',
  'kkamong-headphones': 'kkamong-headphones.webp', 'kkamong-apron': 'kkamong-apron.webp',
  'kkamong-deel-summer': 'kkamong-summer-deel.webp', 'kkamong-deel-winter': 'kkamong-winter-deel.webp',
});
const costumeById = id => COSTUMES.find(row => row.id === id);
const backgroundById = id => BACKGROUNDS.find(row => row.id === id) || BACKGROUNDS[0];
const source = id => `./assets/wardrobe/${COSTUME_IMAGES[id] || COSTUME_IMAGES['mongle-basic']}`;
const texture = id => `./assets/wardrobe/felt-${['night', 'lapis'].includes(id) ? id : 'paper'}.webp`;
const copy = value => JSON.parse(JSON.stringify(value));
const sameOutfit = (a, b) => a?.costumeId === b?.costumeId && a?.backgroundId === b?.backgroundId;
const node = (tag, text, className) => { const result = document.createElement(tag);if (text != null) result.textContent = text;if (className) result.className = className;return result; };
const isoNow = () => new Date().toISOString();
const shortDate = value => { const d = new Date(value);return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }); };
function image(id, className = '', description = '') {
  const img = node('img', null, className);img.src = source(id);img.alt = description;img.width = 768;img.height = 768;img.decoding = 'async';return img;
}
function installStyle() {
  if (!document.head || document.getElementById('world-wardrobe-style')) return;
  const link = node('link');link.id = 'world-wardrobe-style';link.rel = 'stylesheet';link.href = './wardrobe.css';document.head.append(link);
}
function loadImage(url) {
  return new Promise((resolve, reject) => { const img = new Image();img.onload = () => resolve(img);img.onerror = () => reject(new Error('사진에 쓸 그림을 불러오지 못했어요. 연결을 확인하고 다시 눌러 주세요.'));img.src = url; });
}
function fit(ctx, img, x, y, width, height) {
  const ratio = Math.min(width / img.width, height / img.height), w = img.width * ratio, h = img.height * ratio;
  ctx.drawImage(img, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

/** Export the same reviewed image, with a light matte on every photo background. */
export async function createCostumePhotoBlob(photo) {
  if (!costumeById(photo.costumeId)) throw new Error('사진의 차림을 확인해 주세요.');
  const [mascot, felt] = await Promise.all([loadImage(source(photo.costumeId)), loadImage(texture(photo.backgroundId))]);
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');canvas.width = 1200;canvas.height = 1500;
  const ctx = canvas.getContext('2d');if (!ctx) throw new Error('이 브라우저에서 사진을 만들지 못했어요. 다른 브라우저에서 다시 열어 주세요.');
  ctx.fillStyle = backgroundById(photo.backgroundId).color;ctx.fillRect(0, 0, 1200, 1500);
  const scale = Math.max(1200 / felt.width, 1500 / felt.height);
  ctx.drawImage(felt, (1200 - felt.width * scale) / 2, (1500 - felt.height * scale) / 2, felt.width * scale, felt.height * scale);
  // The matte is mandatory: the reviewed legacy cutouts have bright edge pixels.
  ctx.fillStyle = '#fffdf9';ctx.fillRect(80, 90, 1040, 1315);
  fit(ctx, mascot, 130, 115, 940, 990);
  ctx.fillStyle = '#1b2434';ctx.textAlign = 'center';ctx.font = '800 55px "SUIT Variable", sans-serif';
  const title = String(photo.name || costumeById(photo.costumeId).name).slice(0, 30);
  let first = '', second = '';
  for (const char of title) { if (!second && ctx.measureText(first + char).width <= 890) first += char;else second += char; }
  ctx.fillText(first, 600, 1160);if (second) ctx.fillText(second, 600, 1230);
  ctx.fillStyle = '#5b6170';ctx.font = '500 28px "SUIT Variable", sans-serif';ctx.fillText(shortDate(photo.createdAt || isoNow()), 600, 1325);
  ctx.font = '700 24px "Inter Tight", sans-serif';ctx.fillText('SYNK WORLD  ·  MY WARDROBE', 600, 1370);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('사진 파일을 만들지 못했어요. 다시 눌러 주세요.')), 'image/png'));
}

/** Account-scoped wardrobe, mounted in the actual WORLD learning/account host. */
export function createWardrobeView({ owner, client, guard = () => {}, preview = false, storage: suppliedStorage, controllerFactory = createWardrobeController } = {}) {
  installStyle();
  const root = node('section', null, 'wardrobe-section');root.id = 'world-wardrobe';root.setAttribute('aria-label', '마스코트 옷장');
  let stopped = false, controller, state, candidate, previousEquipped, selectedCharacter = '모두', lookName = '', feedback = '', localBusy = false, previewEnvelope = null;
  let reactionId = '', refreshAt = 0, focusToRestore = null, preparedPhoto = null;
  const threePreview = createWardrobeThreePreview({ onPhoto: photo => {
    guard();if (stopped || blocked() || !owns(photo.costumeId)) return;
    const png = Uint8Array.from(atob(photo.image.split(',')[1]), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([png], { type: 'image/png' })), link = node('a');
    link.href = url;link.download = `SYNK-WORLD-3D-${photo.costumeId}-${isoNow().slice(0, 10)}.png`;
    document.body.append(link);link.click();link.remove();
    return { url, filename: link.download, dispose: () => URL.revokeObjectURL(url) };
  } });
  const storageKey = `synk.world.wardrobe.v1.${encodeURIComponent(owner)}`;
  const storage = suppliedStorage || {
    async read() { guard();if (preview) return previewEnvelope;const raw = localStorage.getItem(storageKey);return raw ? JSON.parse(raw) : null; },
    async write(value) { guard();if (preview) { previewEnvelope = copy(value);return; }localStorage.setItem(storageKey, JSON.stringify(value)); },
  };
  const owns = id => (state?.wardrobe?.grants || []).some(grant => grant.costumeId === id);
  const blocked = () => !state?.ready || state?.busy || localBusy || !!state?.conflict;
  const onChange = next => {
    if (stopped) return;
    state = next;
    if (!candidate || sameOutfit(candidate, previousEquipped)) candidate = copy(next.wardrobe.equipped);
    previousEquipped = copy(next.wardrobe.equipped);render();
  };
  const run = async fn => {
    if (stopped || localBusy) return;
    try { guard();feedback = '';localBusy = true;render();await fn();guard(); }
    catch (error) { if (!stopped) feedback = error.message || '차림을 저장하지 못했어요. 다시 눌러 주세요.'; }
    finally { localBusy = false;if (!stopped) render(); }
  };
  const button = (label, handler, className = 'wardrobe-button', disabled = false) => {
    const b = node('button', label, className);b.type = 'button';b.disabled = disabled;b.onclick = handler;if (label) b.dataset.wardrobeFocus = label;return b;
  };
  function rememberFocus() {
    const active = document.activeElement;
    if (root.contains?.(active)) {
      focusToRestore = { element: active, key: active.dataset?.wardrobeFocus, fallback: active.dataset?.wardrobeFocusFallback,
        start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection };
    } else if (active && active !== document.body && active !== document.documentElement) focusToRestore = null;
  }
  function restoreFocus() {
    if (!focusToRestore || !root.querySelectorAll) return;
    const saved = focusToRestore, find = key => [...root.querySelectorAll('[data-wardrobe-focus]')].find(el => el.dataset.wardrobeFocus === key);
    let target = saved.key ? find(saved.key) : root.contains(saved.element) ? saved.element : null;
    // Saving temporarily disables actions. Restore only after the action settles;
    // a user who moves elsewhere during the wait must keep that new focus.
    if ((!target || target.disabled) && (localBusy || state.busy)) return;
    if (!target || target.disabled) target = saved.fallback ? find(saved.fallback) : null;
    focusToRestore = null;
    if (!target || target.disabled) return;
    target.focus({ preventScroll: true });
    if (typeof saved.start === 'number' && target.setSelectionRange) target.setSelectionRange(saved.start, saved.end, saved.direction);
  }
  // A click/touch on empty, non-focusable space also means the user moved on.
  // Do not return them to a disabled action when its pending save finishes.
  const discardPendingFocus = () => { focusToRestore = null; };
  document.addEventListener('pointerdown', discardPendingFocus, true);
  function clearPreparedPhoto() { if (preparedPhoto) URL.revokeObjectURL(preparedPhoto.url);preparedPhoto = null; }
  function preparePhotoDownload(blob, photo) {
    let url;
    try { url = URL.createObjectURL(blob); }
    catch { throw new Error('PNG 파일을 준비하지 못했어요. 앨범의 사진 내려받기를 다시 눌러 주세요.'); }
    clearPreparedPhoto();
    preparedPhoto = { url, name: photo.name, filename: `SYNK-WORLD-${photo.costumeId}-${photo.createdAt.slice(0, 10)}.png` };
    const link = node('a');link.href = url;link.download = preparedPhoto.filename;document.body.append(link);
    // Browsers may block an automatic save after async image/account work. Keep
    // the same PNG behind a visible link until another photo is prepared or exit.
    try { link.click(); } catch {} finally { link.remove(); }
  }
  const sectionTitle = (title, text) => { const heading = node('div', null, 'wardrobe-section-title');heading.append(node('h3', title));if (text) heading.append(node('p', text));return heading; };
  const picture = (outfit, small = false) => {
    const frame = node('div', null, `wardrobe-picture wardrobe-bg-${outfit.backgroundId}${small ? ' wardrobe-picture-small' : ''}`);
    const matte = node('div', null, 'wardrobe-matte');matte.append(image(outfit.costumeId, 'wardrobe-mascot', small ? '' : costumeById(outfit.costumeId)?.name || '마스코트'));frame.append(matte);return frame;
  };
  const selectedGrant = () => state.wardrobe.grants.find(grant => grant.costumeId === candidate.costumeId);
  const grantText = item => item.requiredActivities ? `계정에 서로 다른 연습 ${item.requiredActivities}개를 저장하면 받아요.` : '옷장을 처음 열 때 받는 선물이에요.';
  async function download(photo) {
    const blob = await createCostumePhotoBlob(photo);guard();if (stopped) return;
    preparePhotoDownload(blob, photo);feedback = 'PNG 파일을 준비했어요. 파일 저장을 눌러 보관할 수 있어요.';
  }
  async function wear(outfit) {
    await controller.save({ equipped: outfit });candidate = copy(outfit);reactionId = outfit.costumeId;feedback = `${costumeById(outfit.costumeId).character}이 새 차림을 입었어요.`;
  }
  function render() {
    if (!state || stopped) return;
    rememberFocus();
    const wardrobe = state.wardrobe, selected = costumeById(candidate?.costumeId) || COSTUMES[0], current = costumeById(wardrobe.equipped.costumeId) || COSTUMES[0];
    const busy = blocked(), owned = owns(selected.id), isCurrent = sameOutfit(candidate, wardrobe.equipped);
    const header = node('div', null, 'wardrobe-heading');header.append(node('p', 'WORLD · MY WARDROBE', 'wardrobe-eyebrow'), node('h2', '오늘은 어떤 차림?'), node('p', '마음에 드는 옷을 입고, 오늘의 모습을 남겨요.'));
    const worn = node('div', null, 'wardrobe-worn');worn.append(image(current.id, '', ''), node('span', `지금 입은 차림 · ${current.name}`));header.append(worn);
    const sync = node('div', null, 'wardrobe-sync');const syncText = node('p', preview ? '미리보기 옷장이에요. 실제 계정에 저장하지 않아요.' : state.notice || (!state.ready ? state.phase === 'error' ? '옷장 기록 확인이 필요해요.' : '옷장을 불러오고 있어요.' : state.busy ? '옷장의 저장 상태를 확인하고 있어요.' : state.phase === 'account' && !state.pending ? '계정에 옷장을 저장했어요.' : '이 계정의 차림을 이 기기에 보관해요.'));
    syncText.setAttribute('aria-live', 'polite');sync.append(syncText);
    if (!preview) sync.append(button('옷장 다시 확인', () => void run(() => controller.refresh()), 'wardrobe-button wardrobe-button-small', busy));
    if (state.conflict) {
      const conflict = node('div', null, 'wardrobe-conflict');conflict.append(node('p', '다른 기기의 옷장이 바뀌었어요. 이 기기의 변경은 보관하고 있어요. 사용할 옷장을 골라 주세요.'));
      conflict.append(button('이 기기의 차림 저장', () => void run(() => controller.resolveConflict('device')), 'wardrobe-button', state.busy || localBusy), button('계정의 차림 불러오기', () => void run(() => controller.resolveConflict('account')), 'wardrobe-button', state.busy || localBusy));sync.append(conflict);
    }
    const layout = node('div', null, 'wardrobe-layout'), fitting = node('div', null, 'wardrobe-fitting');
    const stage = picture(candidate);stage.dataset.costumeId = selected.id;
    threePreview.update({ ...candidate, name: selected.name, owned: owned && !busy }, stage);
    if (reactionId === selected.id) { stage.className += ' wardrobe-react';threePreview.react();reactionId = ''; }
    fitting.append(node('p', isCurrent ? '지금 함께하는 차림' : owned ? '미리 입어 보는 중' : '선물을 미리 입어 보는 중', 'wardrobe-stage-label'), threePreview.element, node('h3', selected.name), node('p', selected.story, 'wardrobe-story'));
    const grant = selectedGrant();
    fitting.append(node('p', owned ? `${selected.requiredActivities ? '연습하고 받은 선물' : '첫 옷장 선물'}${grant?.earnedAt ? ` · ${shortDate(grant.earnedAt)}` : ''}` : grantText(selected), 'wardrobe-acquired'));
    const backgrounds = node('div', null, 'wardrobe-backgrounds');backgrounds.setAttribute('role', 'group');backgrounds.setAttribute('aria-label', '사진 배경');
    for (const bg of BACKGROUNDS) {
      const b = button(bg.name, () => { candidate = { ...candidate, backgroundId: bg.id };reactionId = '';feedback = '';render(); }, 'wardrobe-button wardrobe-background', !state.ready || localBusy);
      b.setAttribute('aria-pressed', String(candidate.backgroundId === bg.id));b.dataset.backgroundId = bg.id;backgrounds.append(b);
    }
    fitting.append(backgrounds);
    const actions = node('div', null, 'wardrobe-fitting-actions');
    const apply = button(isCurrent ? '이 차림을 입고 있어요' : owned ? '이 차림 입기' : '연습하고 선물 받기', () => void run(() => wear(copy(candidate))), 'wardrobe-button wardrobe-primary', busy || !owned || isCurrent);apply.dataset.action = 'equip';apply.dataset.wardrobeFocus = 'equip';apply.dataset.wardrobeFocusFallback = `costume:${selected.id}`;
    const takePhoto = button('원본 그림 사진 남기기', () => void run(async () => {
      const photo = { id: crypto.randomUUID(), name: lookName.trim() || selected.name, ...copy(candidate), createdAt: isoNow() };
      const blob = await createCostumePhotoBlob(photo);guard();
      await controller.save({ photos: [...state.wardrobe.photos, photo] });guard();if (stopped) return;
      try { preparePhotoDownload(blob, photo);feedback = '사진을 앨범에 남겼어요. PNG 파일 저장을 눌러 파일을 보관할 수 있어요.'; }
      catch { feedback = '사진은 앨범에 남겼어요. PNG를 준비하지 못했으니 앨범의 사진 내려받기를 다시 눌러 주세요.'; }
    }), 'wardrobe-button', busy || !owned || wardrobe.photos.length >= 30);takePhoto.dataset.wardrobeFocus = 'photo-create';takePhoto.dataset.wardrobeFocusFallback = 'look-name';
    actions.append(apply, takePhoto);
    fitting.append(actions);
    const response = node('p', feedback, 'wardrobe-feedback');response.setAttribute('role', 'status');response.setAttribute('aria-live', 'polite');fitting.append(response);
    if (preparedPhoto) {
      const downloadPanel = node('div', null, 'wardrobe-photo-download'), thumb = node('img');thumb.src = preparedPhoto.url;thumb.alt = `${preparedPhoto.name} · 저장할 사진`;
      const link = node('a', 'PNG 파일 저장', 'wardrobe-button wardrobe-button-small');link.href = preparedPhoto.url;link.download = preparedPhoto.filename;link.dataset.wardrobeFocus = 'photo-file';
      downloadPanel.append(thumb, link);fitting.append(downloadPanel);
    }
    const closet = node('div', null, 'wardrobe-closet');closet.append(sectionTitle('나의 옷장', `${wardrobe.grants.length}개 차림과 함께하고 있어요.`));
    const filters = node('div', null, 'wardrobe-filters');filters.setAttribute('role', 'group');filters.setAttribute('aria-label', '마스코트 고르기');
    for (const character of ['모두', '몽글', '까몽', '마린']) { const b = button(character, () => { selectedCharacter = character;render(); }, 'wardrobe-button wardrobe-button-small');b.setAttribute('aria-pressed', String(selectedCharacter === character));filters.append(b); }closet.append(filters);
    const items = node('div', null, 'wardrobe-items');
    for (const item of COSTUMES.filter(row => selectedCharacter === '모두' || row.character === selectedCharacter)) {
      const available = owns(item.id), active = wardrobe.equipped.costumeId === item.id;
      const b = button(null, () => { candidate = { ...candidate, costumeId: item.id };reactionId = '';feedback = '';render(); }, 'wardrobe-item', !state.ready || localBusy);
      b.setAttribute('aria-pressed', String(selected.id === item.id));b.setAttribute('aria-label', `${item.name} · ${available ? active ? '입고 있어요' : '입을 수 있어요' : `연습 ${item.requiredActivities}개 후 선물`}`);b.dataset.costumeId = item.id;b.dataset.wardrobeFocus = `costume:${item.id}`;
      const thumb = node('span', null, 'wardrobe-thumb'), img = image(item.id);img.loading = 'lazy';thumb.append(img);
      b.append(thumb, node('span', item.name, 'wardrobe-item-name'), node('span', available ? active ? '입고 있어요' : '입을 수 있어요' : `연습 ${item.requiredActivities}개 후 선물`, 'wardrobe-item-state'));items.append(b);
    }
    closet.append(items);
    const progress = node('div', null, 'wardrobe-progress');
    progress.append(node('h4', '연습이 차림으로 남아요'), node('p', state.phase === 'account' ? `계정에서 확인한 서로 다른 연습 ${state.progress?.completedActivities || 0}개` : '연습 선물은 계정에 저장된 기록을 확인한 뒤 받을 수 있어요.'));
    for (const item of COSTUMES.filter(row => row.requiredActivities)) progress.append(node('p', `${owns(item.id) ? '받았어요' : `연습 ${item.requiredActivities}개`} · ${item.name}`, 'wardrobe-milestone'));
    closet.append(progress);layout.append(fitting, closet);
    const saved = node('section', null, 'wardrobe-saved');saved.append(sectionTitle('좋아하는 차림', '이름을 붙여 두고, 다시 꺼내 입어요.'));
    const form = node('form', null, 'wardrobe-save-form'), label = node('label', '차림 이름');const input = node('input');input.type = 'text';input.maxLength = 30;input.value = lookName;input.placeholder = '예: 포근한 오후';input.dataset.wardrobeFocus = 'look-name';input.oninput = () => { lookName = input.value; };label.append(input);
    const save = button('차림 저장', null, 'wardrobe-button', busy || !owned || wardrobe.looks.length >= 12);save.type = 'submit';save.dataset.wardrobeFocusFallback = 'look-name';form.append(label, save);
    form.onsubmit = event => { event.preventDefault();if (busy || !owned || wardrobe.looks.length >= 12) return;void run(async () => { await controller.save({ looks: [...state.wardrobe.looks, { id: crypto.randomUUID(), name: lookName.trim() || selected.name, ...copy(candidate) }] });lookName = '';feedback = '좋아하는 차림에 보관했어요.'; }); };saved.append(form);
    if (wardrobe.looks.length >= 12) saved.append(node('p', '차림 12개를 보관 중이에요. 하나를 지우면 새 차림을 저장할 수 있어요.', 'wardrobe-small'));
    const lookGrid = node('div', null, 'wardrobe-memory-grid');
    for (const look of wardrobe.looks) {
      const entry = node('article', null, 'wardrobe-memory');entry.append(picture(look, true), node('h4', look.name));
      const wearLook = button('다시 입기', () => void run(() => wear({ costumeId: look.costumeId, backgroundId: look.backgroundId })), 'wardrobe-button wardrobe-button-small', busy || !owns(look.costumeId));wearLook.dataset.wardrobeFocus = `look:${look.id}:wear`;
      const removeLook = button('지우기', () => void run(() => controller.save({ looks: state.wardrobe.looks.filter(row => row.id !== look.id) })), 'wardrobe-remove', busy);removeLook.dataset.wardrobeFocus = `look:${look.id}:remove`;removeLook.dataset.wardrobeFocusFallback = 'look-name';
      entry.append(wearLook, removeLook);lookGrid.append(entry);
    }
    saved.append(wardrobe.looks.length ? lookGrid : node('p', '마음에 드는 첫 차림을 저장해 보세요.', 'wardrobe-empty'));
    const album = node('section', null, 'wardrobe-album');album.append(sectionTitle('나의 차림 앨범', '원본 그림으로 남긴 사진이에요. 3D 사진은 별도 PNG로 내려받아요.'));
    if (wardrobe.photos.length >= 30) album.append(node('p', '사진 30장을 보관 중이에요. 하나를 지우면 새 사진을 남길 수 있어요.', 'wardrobe-small'));
    const photos = node('div', null, 'wardrobe-memory-grid');
    for (const photo of [...wardrobe.photos].reverse()) {
      const entry = node('article', null, 'wardrobe-memory');entry.append(picture(photo, true), node('h4', photo.name), node('p', shortDate(photo.createdAt), 'wardrobe-small'));
      const downloadPhoto = button('사진 내려받기', () => void run(() => download(photo)), 'wardrobe-button wardrobe-button-small', busy);downloadPhoto.dataset.wardrobeFocus = `photo:${photo.id}:download`;
      const removePhoto = button('지우기', () => void run(() => controller.save({ photos: state.wardrobe.photos.filter(row => row.id !== photo.id) })), 'wardrobe-remove', busy);removePhoto.dataset.wardrobeFocus = `photo:${photo.id}:remove`;removePhoto.dataset.wardrobeFocusFallback = 'photo-create';
      entry.append(downloadPhoto, removePhoto);photos.append(entry);
    }
    album.append(wardrobe.photos.length ? photos : node('p', '위에서 차림 사진을 남기면 여기에 모여요.', 'wardrobe-empty'));
    root.replaceChildren(header, sync, layout, saved, album);
    restoreFocus();
  }
  controller = controllerFactory({ owner, storage, client: preview ? {} : client, guard, onChange });
  state = controller.snapshot();onChange(state);
  const ready = controller.init().catch(error => { if (!stopped) { feedback = error.message;render(); } });
  return {
    element: root, ready,
    refresh() { if (stopped || localBusy || state?.busy || Date.now() - refreshAt < 1500) return Promise.resolve();refreshAt = Date.now();return controller.refresh().catch(error => { if (!stopped) { feedback = error.message;render(); } }); },
    stop() { stopped = true;document.removeEventListener('pointerdown', discardPendingFocus, true);clearPreparedPhoto();focusToRestore = null;threePreview.dispose();controller.dispose();root.replaceChildren(); },
  };
}
