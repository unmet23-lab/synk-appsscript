// Optional local fixture check: node tests/browser-smoke.mjs <playwright module directory>
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const errors = [], requests = [];
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
await context.route('**/*', async route => {
  const url = new URL(route.request().url());requests.push(url.href);
  if (url.origin !== 'http://127.0.0.1:4280' || !url.pathname.startsWith('/synk-account/')) throw new Error(`Unexpected fixture network: ${url.href}`);
  const relative = decodeURIComponent(url.pathname.slice('/synk-account/'.length)) || 'index.html';
  const target = path.resolve(root, relative);if (!target.startsWith(root + path.sep)) return route.fulfill({ status: 404, body: '' });
  try {
    const body = await fs.readFile(target), ext = path.extname(target);
    await route.fulfill({ status: 200, body, contentType: ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' })[ext] || 'application/octet-stream' });
  } catch { await route.fulfill({ status: 404, body: '' }); }
});
try {
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4280/synk-account/index.html');
  await page.locator('#setup').waitFor({ state: 'visible' });assert.equal(await page.locator('#auth-panel').isVisible(), false);
  assert.equal(await page.locator('#notice').innerText(), '계정 서비스 설정 전 · 기본 학습은 계속 사용할 수 있어요.');
  await page.goto('http://127.0.0.1:4280/synk-account/preview.html');await page.locator('#auth-panel').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '처음이에요 · 가입' }).click();assert.equal(await page.locator('#auth-submit').innerText(), '이메일로 가입');
  await page.getByRole('button', { name: '비밀번호 찾기' }).click();assert.equal(await page.locator('#password-label').isVisible(), false);
  await page.getByRole('button', { name: '로그인으로' }).click();
  await page.locator('#email').fill('synthetic@example.invalid');await page.locator('#password').fill('preview-only-password');await page.locator('#auth-submit').click();
  await page.locator('#account').waitFor({ state: 'visible' });assert.match(await page.locator('#notice').innerText(), /합성/);
  assert.match(await page.locator('#account').innerText(), /email · 합성/);assert.match(await page.locator('#account').innerText(), /기본 학습 예시 · world/);
  assert.equal(await page.locator('#world-games').isVisible(), false);
  await page.goto('http://127.0.0.1:4280/synk-account/preview.html?authorization_id=synthetic');await page.locator('#consent').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#scopes li').count(), 3);await page.locator('#deny').click();assert.match(await page.locator('#notice').innerText(), /합성/);
  await page.goto('http://127.0.0.1:4280/synk-account/preview.html?account=world');await page.locator('#world-games').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.game-links button').count(), 4);assert.equal(await page.evaluate(() => !!window.SYNKLearningHost), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('.game-links button').first().click();assert.match(await page.locator('#notice').innerText(), /실제 게임 계정 연결을 시작하지/);
  await page.locator('.toggle input').uncheck();assert.equal(await page.locator('.toggle input').isChecked(), false);
  await fs.mkdir(path.join(root, 'qa'), { recursive: true });await page.screenshot({ path: path.join(root, 'qa/preview-world-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });await page.goto('http://127.0.0.1:4280/synk-account/preview.html');await page.locator('#auth-panel').waitFor({ state: 'visible' });await page.screenshot({ path: path.join(root, 'qa/preview-login-desktop.png'), fullPage: true });
  await page.goto('http://127.0.0.1:4280/synk-account/preview.html?account=world&disabled&rollout-off');await page.locator('#account').waitFor({ state: 'visible' });assert.equal(await page.locator('.toggle input').isDisabled(), true);
  await page.goto('http://127.0.0.1:4280/synk-account/preview.html?account=world&rollout-off');await page.locator('#account').waitFor({ state: 'visible' });assert.equal(await page.locator('.toggle input').isDisabled(), false);await page.locator('.toggle input').uncheck();assert.equal(await page.locator('.toggle input').isDisabled(), true);
  await page.goto('http://127.0.0.1:4280/synk-account/preview.html?account=world');await page.locator('#account').waitFor({ state: 'visible' });await page.getByRole('button', { name: '계정 삭제 요청', exact: true }).click();await page.getByRole('button', { name: '삭제 요청 보내기' }).click();await page.getByRole('button', { name: '계정 삭제 요청 접수됨' }).waitFor();assert.equal(await page.locator('.toggle input').isDisabled(), true);assert.match(await page.locator('#notice').innerText(), /실제 삭제 완료 여부/);
  await page.getByRole('button', { name: '모든 제품의 로그인 종료' }).click();assert.match(await page.locator('#notice').innerText(), /일부 기존 앱의 로그인 종료는 확인하지 못/);assert.doesNotMatch(await page.locator('#notice').innerText(), /상태가 바뀌/);
  await page.goto('http://127.0.0.1:4280/synk-account/preview.html?account=platform&fail-user');await page.locator('#auth-panel').waitFor({ state: 'visible' });assert.match(await page.locator('#notice').innerText(), /로그인 상태를 확인하지 못/);
  await page.goto('http://127.0.0.1:4280/synk-account/client.html?product=world');await page.locator('#setup').waitFor({ state: 'visible' });
  assert.match(await page.locator('#notice').innerText(), /SSO 설정 전/);assert.deepEqual(errors, []);
  assert.equal(requests.some(url => url.includes('preview.invalid')), false);
  console.log('14 browser fixture scenarios passed, including final account fields, auth event/login race, rollout/deletion gate, stable deletion UUID, incomplete global revocation, and re-login after verification failure. No remote auth requests.');
} finally { await context.close();await browser.close(); }
