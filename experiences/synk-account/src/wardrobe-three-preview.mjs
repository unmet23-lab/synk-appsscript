import { resolveWardrobeCostume } from '../../mascot-render-lab/three/character-contract.mjs';

// This chunk is built separately. Visiting the account screen never loads Three.
const loadRenderer = () => import(new URL('./dist/wardrobe-three.js', document.baseURI).href);
const element = (tag, text, className) => {
  const el = document.createElement(tag);if (text) el.textContent = text;if (className) el.className = className;return el;
};

/** A single canvas survives wardrobe rerenders; only item IDs cross the storage boundary. */
export function createWardrobeThreePreview({ load = loadRenderer, onPhoto = () => {}, initialMode = 'image' } = {}) {
  const root = element('div', '', 'wardrobe-render-preview');
  const modes = element('div', '', 'wardrobe-render-modes');modes.setAttribute('role', 'group');modes.setAttribute('aria-label', '차림 보기 방식');
  const stage = element('div', '', 'wardrobe-render-stage');
  const fallback = element('div'), host = element('div', '', 'wardrobe-three-stage');
  const status = element('p', '', 'wardrobe-render-note');status.setAttribute('role', 'status');
  const controls = element('div', '', 'wardrobe-three-controls');
  const capture = element('div', '', 'wardrobe-three-capture');capture.hidden = true;
  stage.append(fallback, host);root.append(modes, stage, status, controls, capture);
  let mode = initialMode, outfit, engine, pending = false, disposed = false, generation = 0, fault = '', inView = true;
  let angle = 0, motion = 'still', quality = 'low', fitted = '';
  let downloadedPhoto;
  function clearPhoto() { downloadedPhoto?.dispose();downloadedPhoto = null;capture.replaceChildren();capture.hidden = true; }
  const buttons = [];
  function button(label, action, parent = controls) {
    const b = element('button', label, 'wardrobe-button wardrobe-button-small');b.type = 'button';b.onclick = action;parent.append(b);return b;
  }
  const original = button('원본 그림', () => changeMode('image'), modes);
  const three = button('3D 시험 보기', () => changeMode('three'), modes);
  for (const [label, value] of [['정면', 0], ['옆', 90], ['뒤', 180]]) {
    const b = button(label, () => { angle = value;engine?.setAngle(value);paint(); });buttons.push([b, () => angle === value]);
  }
  const wave = button('앞발 인사', () => { motion = motion === 'wave' ? 'still' : 'wave';engine?.setMotion(motion);paint(); });buttons.push([wave, () => motion === 'wave']);
  const qualityButton = button('품질 · 균형', () => { quality = quality === 'low' ? 'high' : 'low';engine?.setQuality(quality);paint(); });
  const photo = button('3D 사진 내려받기', () => {
    if (!engine || fault || !outfit?.owned) return;
    try {
      clearPhoto();const result = onPhoto({ ...outfit, image: engine.snapshot() });
      downloadedPhoto = result?.url && typeof result.dispose === 'function' ? result : null;
      if (downloadedPhoto) {
        const img = element('img');img.src = downloadedPhoto.url;img.alt = `${outfit.name} · 방금 찍은 3D 사진`;
        const link = element('a', 'PNG 파일 저장', 'wardrobe-button wardrobe-button-small');link.href = downloadedPhoto.url;link.download = downloadedPhoto.filename;
        capture.append(img, link);capture.hidden = false;
      }
      status.textContent = '3D 사진 PNG를 준비했어요. 앨범에는 추가하지 않아요.';
    }
    catch { status.textContent = '사진을 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.'; }
  });
  photo.classList.add('wardrobe-three-photo');
  const syncPause = () => engine?.setPaused(document.hidden || !inView);
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    inView = entries[entries.length - 1]?.isIntersecting !== false;syncPause();
  }, { rootMargin: '120px' }) : null;
  observer?.observe(root);
  document.addEventListener('visibilitychange', syncPause);
  function release() {
    generation++;pending = false;engine?.dispose();engine = null;fitted = '';host.replaceChildren();
  }
  function changeMode(next) {
    if (disposed) return;
    mode = next;fault = '';if (mode === 'image') release();update();
  }
  function fit() {
    const costume = resolveWardrobeCostume(outfit?.costumeId);
    if (!engine || !costume) return;
    const key = `${outfit.costumeId}:${outfit.backgroundId}`;
    if (fitted === key) return;
    engine.setCostume(costume);engine.setBackground(outfit.backgroundId);fitted = key;
    host.dataset.costumeId = outfit.costumeId;host.dataset.backgroundId = outfit.backgroundId;
    host.setAttribute('aria-label', `${outfit.name} · 3D 시제품`);
  }
  function paint() {
    const supported = !!resolveWardrobeCostume(outfit?.costumeId);
    const active = mode === 'three' && supported && !!engine && !fault;
    root.dataset.renderMode = active ? 'three' : 'image';
    original.setAttribute('aria-pressed', String(mode === 'image'));three.setAttribute('aria-pressed', String(mode === 'three'));
    fallback.hidden = active;host.hidden = !active;controls.hidden = !active;
    status.textContent = mode === 'image' ? '' : !supported ? '이 차림은 아직 3D 모델이 없어 원본 그림으로 보여요.' : fault || (pending ? '3D 차림을 준비하고 있어요…' : '까몽 3D 시제품 · 최종 외형은 다듬는 중이에요.');
    status.hidden = !status.textContent;
    for (const [b, selected] of buttons) b.setAttribute('aria-pressed', String(selected()));
    qualityButton.textContent = `품질 · ${quality === 'low' ? '균형' : '경험'}`;
    photo.disabled = !outfit?.owned;photo.title = outfit?.owned ? '현재 각도와 배경으로 PNG 저장 · 앨범에는 추가하지 않아요.' : '받은 차림만 사진으로 저장할 수 있어요.';
  }
  function update() {
    if (disposed) return;
    const supported = !!resolveWardrobeCostume(outfit?.costumeId);
    if (mode !== 'three' || !supported) { if (engine || pending) release();paint();return; }
    if (engine) { fit();paint();return; }
    if (pending || fault) { paint();return; }
    pending = true;const token = ++generation;paint();
    Promise.resolve().then(load).then(module => {
      if (disposed || token !== generation) return;
      engine = module.createThreeLab(host);pending = false;
      engine.setQuality(quality);engine.setView('full');engine.setAngle(angle);engine.setMotion(motion);fit();syncPause();
      engine.canvas.addEventListener('webglcontextlost', () => { if (!disposed && token === generation) { fault = '3D 연결이 끊겨 원본 그림으로 보여요. 복구를 기다리거나 원본 그림을 선택해 주세요.';paint(); } });
      engine.canvas.addEventListener('webglcontextrestored', () => { if (!disposed && token === generation) { fault = '';syncPause();paint(); } });
      paint();
    }).catch(() => {
      if (disposed || token !== generation) return;
      release();fault = '3D를 불러오지 못해 원본 그림으로 보여요. 원본 그림을 누른 뒤 다시 시험할 수 있어요.';paint();
    });
  }
  return {
    element: root,
    update(next, image) { if (disposed) return;if (outfit?.costumeId !== next.costumeId || outfit?.backgroundId !== next.backgroundId) clearPhoto();outfit = { ...next };fallback.replaceChildren(image);update(); },
    react() { if (disposed || !engine || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;motion = 'wave';engine.setMotion(motion);paint(); },
    dispose() { if (disposed) return;disposed = true;clearPhoto();release();observer?.disconnect();document.removeEventListener('visibilitychange', syncPause);root.remove(); },
  };
}
