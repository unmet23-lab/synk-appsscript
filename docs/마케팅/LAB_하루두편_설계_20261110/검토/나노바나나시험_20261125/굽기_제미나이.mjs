// Gemini 웹 /images(카본 높음 · 9:16)로 한 장 굽고 원본을 받는다 — 나노바나나 시험(11-25) 전용 실행기.
// 순서는 현장 노트 gemini_사진 「다른 비율로 넓힐 때는 /images로」(11-16): 모드 → 비율 → 업로드(맨 마지막) → insertText → 2.8초 → 보내기 실제 클릭.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const log = (o) => console.log(JSON.stringify({ t: new Date().toTimeString().slice(0, 8), ...o }));

export async function bake(page, { files, promptFile, out }) {
  const prompt = (await readFile(promptFile, 'utf8')).trim();
  await mkdir(out.replace(/\/[^/]+$/, ''), { recursive: true });
  try { await page.goto('https://gemini.google.com/u/2/images', { timeout: 45000 }); } catch (e) { log({ step: 'goto', err: e.message.slice(0, 120) }); }
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1500);
    const u = await page.url();
    if (/sorry/.test(u)) throw new Error('sorry 화면 — 멈춤');
    const has = await page.evaluate(() => !!document.querySelector('button[aria-label^="모드 선택 도구 열기"]'));
    if (has) break;
  }
  const items = () => page.evaluate(() => [...document.querySelectorAll('gem-menu-item, [role=menuitem], [role=menuitemradio], [role=option]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e.innerText || '').trim().replace(/\s+/g, ' ')));
  const markRe = (re, tag) => page.evaluate(({ re, tag }) => {
    document.querySelectorAll(`[data-synk="${tag}"]`).forEach((e) => e.removeAttribute('data-synk'));
    const r = new RegExp(re);
    const el = [...document.querySelectorAll('gem-menu-item, [role=menuitem], [role=menuitemradio], [role=option], button')].find((e) => r.test((e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')) && e.getBoundingClientRect().width > 0);
    if (el) el.setAttribute('data-synk', tag);
    return !!el;
  }, { re, tag });
  const modeText = () => page.evaluate(() => document.querySelector('button[aria-label^="모드 선택 도구 열기"]')?.innerText.trim().replace(/\s+/g, ' ') || '');
  // ① 모드 — 카본 + 높음
  if (!/카본/.test(await modeText()) || !/높음/.test(await modeText())) {
    await page.click('loc=css:button[aria-label^="모드 선택 도구 열기"]', { timeout: 15000, label: 'open mode menu' });
    await page.waitForTimeout(1300);
    if (!/카본/.test(await modeText()) && (await markRe('(?:^|\\s)4 카본$', 'carbon'))) {
      await page.click('loc=css:[data-synk="carbon"]', { timeout: 15000, label: 'choose Carbon' });
      await page.waitForTimeout(1300);
      await page.click('loc=css:button[aria-label^="모드 선택 도구 열기"]', { timeout: 15000, label: 'open mode menu' });
      await page.waitForTimeout(1300);
    }
    if (await markRe('^사고 수준', 'think')) {
      await page.click('loc=css:[data-synk="think"]', { timeout: 15000, label: 'open thinking submenu' });
      await page.waitForTimeout(1300);
      if (await markRe('^높음', 'lvl')) { await page.click('loc=css:[data-synk="lvl"]', { timeout: 15000, label: 'choose high thinking' }); await page.waitForTimeout(1300); }
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(600);
  }
  const mode = await modeText();
  if (!/카본/.test(mode) || !/높음/.test(mode)) throw new Error('모드가 카본 높음이 아님: ' + mode);
  // ② 비율 9:16
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => /가로세로 비율/.test(b.innerText || b.getAttribute('aria-label') || '') && b.getBoundingClientRect().width > 0); if (b) b.setAttribute('data-synk', 'ar'); });
  await page.click('loc=css:[data-synk="ar"]', { timeout: 15000, label: 'open aspect ratio menu' });
  await page.waitForTimeout(1000);
  if (await markRe('^9:16$', 'ar916')) { await page.click('loc=css:[data-synk="ar916"]', { timeout: 15000, label: 'choose 9:16' }); await page.waitForTimeout(900); }
  const ar = await page.evaluate(() => { const b = document.querySelector('[data-synk="ar"]'); return b ? ((b.getAttribute('aria-label') || '') + ' ' + b.innerText).trim() : ''; });
  if (!/9:16/.test(ar)) throw new Error('비율이 9:16이 아님: ' + ar);
  log({ step: 'mode', mode, ar });
  // ③ 업로드 — 「업로드 및 도구」 → 「파일 업로드」
  if (files.length) {
    const menuText = () => page.evaluate(() => [...document.querySelectorAll('[role=menu]')].map((m) => m.innerText).join(' '));
    let mt = '';
    for (let i = 0; i < 3 && !/파일 업로드/.test(mt); i++) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
      await page.click('loc=css:button[aria-label="업로드 및 도구"]', { timeout: 15000, label: 'open upload menu' }).catch(() => {});
      for (let k = 0; k < 6 && !/파일 업로드/.test(mt); k++) { await page.waitForTimeout(1000); mt = await menuText(); }
    }
    if (!/파일 업로드/.test(mt)) throw new Error('파일 업로드 메뉴가 안 뜸: ' + mt.slice(0, 120));
    await page.evaluate(() => { const el = [...document.querySelectorAll('[role=menu] *')].find((e) => e.childElementCount === 0 && (e.innerText || '').trim() === '파일 업로드'); if (el) el.setAttribute('data-synk', 'upl'); });
    const chooserP = page.waitForFileChooser({ timeout: 15000 });
    await page.click('loc=css:[data-synk="upl"]', { timeout: 15000, label: 'choose file upload' });
    const chooser = await chooserP;
    await chooser.setFiles(files);
    let n = 0;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(1500);
      n = await page.evaluate(() => document.querySelectorAll('[aria-label="첨부파일 닫기"], [aria-label^="파일 삭제"], uploader-file-preview, [class*="file-preview"] img').length);
      const consent = /권리가 있는지 확인/.test(await page.evaluate(() => document.body.innerText));
      if (consent) throw new Error('권리 확인 동의 창 — 누르지 않고 멈춤');
      if (n >= files.length) break;
    }
    log({ step: 'uploaded', n, want: files.length });
    if (n < files.length) throw new Error(`첨부가 ${n}/${files.length}`);
    await page.waitForTimeout(4000);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }
  // ④ 지시문 → 보내기
  await page.click('loc=css:[aria-label="Gemini 프롬프트 입력"]', { timeout: 15000, label: 'focus prompt box' });
  await page.waitForTimeout(400);
  await page.keyboard.insertText(prompt);
  await page.waitForTimeout(2800);
  const len = await page.evaluate(() => (document.querySelector('[aria-label="Gemini 프롬프트 입력"]')?.innerText || '').trim().length);
  if (Math.abs(len - prompt.length) > 5) throw new Error(`지시문 길이가 다름 ${len}/${prompt.length}`);
  const mode2 = await modeText();
  if (!/카본/.test(mode2) || !/높음/.test(mode2)) throw new Error('보내기 직전 모드가 바뀜: ' + mode2);
  await page.evaluate(() => document.querySelector('[aria-label="메시지 보내기"]')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  await page.click('loc=css:[aria-label="메시지 보내기"]', { timeout: 15000, label: 'send prompt' });
  log({ step: 'sent', len });
  // ⑤ 대화 주소와 그림 기다리기(5분까지)
  let conv = '';
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(1500); const u = await page.url(); if (/\/app\/[0-9a-f]+/.test(u)) { conv = u; break; } }
  log({ step: 'conv', conv: conv || await page.url() });
  if (!conv) throw new Error('대화 주소가 안 생김(보내기 튕김일 수 있다): ' + await page.url());
  let got = null;
  for (let i = 0; i < 100; i++) {
    await page.waitForTimeout(3000);
    got = await page.evaluate(() => {
      const r = [...document.querySelectorAll('model-response')].pop();
      if (!r) return null;
      const img = [...r.querySelectorAll('img')].find((im) => im.naturalWidth >= 500);
      const txt = (r.innerText || '').trim().slice(0, 200);
      return img ? { w: img.naturalWidth, h: img.naturalHeight, txt } : (txt && /한도|생성할 수 없|unavailable|도와드릴 수가 없/.test(txt) ? { err: txt } : null);
    });
    if (got) break;
  }
  log({ step: 'image', got });
  if (!got || got.err) throw new Error('그림이 안 나옴: ' + JSON.stringify(got));
  await writeFile(out.replace(/\.[a-z]+$/, '.conv.txt'), conv, 'utf8');
  return { conv, ...got };
}

// 원본 받기(11-25 실측) — 굽던 탭에서 대화 주소를 다시 열면 새 채팅(/app)으로 튕긴다. 새 탭(dl)에서 대화를 열고 그림에 마우스를 올려
// 「원본 크기 이미지 다운로드」를 누르면 download 사건은 안 오고, 자원 기록에 lh3.googleusercontent.com/rd-gg-dl/… 원본(PNG 약 7MB)이 생긴다 — 그 주소를 쿠키와 함께 받는다.
export async function download(dl, { conv, out }) {
  for (let open = 0; open < 3; open++) {
    await dl.goto(conv, { timeout: 45000 }).catch(() => {});
    await dl.waitForTimeout(5000);
    const n = await dl.evaluate(() => [...document.querySelectorAll('model-response img')].filter((i) => i.naturalWidth > 300).length);
    if (n) break;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const box = await dl.evaluate(() => { const img = [...document.querySelectorAll('model-response img')].filter((i) => i.naturalWidth > 300).pop(); if (!img) return null; img.scrollIntoView({ block: 'center' }); const b = img.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    if (!box) { await dl.waitForTimeout(3000); continue; }
    await dl.waitForTimeout(800);
    await dl.mouse.move(box.x, box.y, { label: 'hover generated image' });
    await dl.waitForTimeout(1500);
    const has = await dl.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => /원본 크기 이미지 다운로드/.test(b.getAttribute('aria-label') || b.innerText || '')); if (b) b.setAttribute('data-synk', 'dl'); return !!b; });
    if (has) await dl.click('loc=css:[data-synk="dl"]', { timeout: 15000, label: 'download full image' }).catch(() => {});
    for (let k = 0; k < 8; k++) {
      await dl.waitForTimeout(2000);
      const urls = await dl.evaluate(() => performance.getEntriesByType('resource').map((e) => ({ n: e.name, sz: e.transferSize || e.encodedBodySize || 0 })).filter((e) => /googleusercontent\.com\/rd-gg-dl\//.test(e.n)).sort((a, b) => b.sz - a.sz));
      if (urls.length && urls[0].sz > 100000) {
        const r = await dl.fetch(urls[0].n, { credentials: 'include', saveAs: out });
        if (r.ok) { log({ step: 'saved', out, sz: urls[0].sz }); return out; }
      }
    }
    log({ step: 'dl', what: '원본 주소 없음 — 다시 누름', attempt, has });
  }
  throw new Error('원본 받기 실패');
}
