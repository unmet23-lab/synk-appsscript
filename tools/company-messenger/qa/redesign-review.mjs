// Responsive design review with an isolated SQLite DB and in-memory Drive provider.
// Never reads production data or credentials and never calls real Google services.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { createMessenger } from '../server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'qa-output');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MESSENGER_PLAYWRIGHT || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const sizes = [
  { width: 1440, height: 960 }, { width: 1280, height: 960 },
  { width: 900, height: 900 }, { width: 768, height: 900 },
  { width: 390, height: 844 }, { width: 320, height: 740 },
];
const report = { passed: false, isolation: 'Temporary SQLite, synthetic accounts, fake Drive only', screenshots: [], checks: [], consoleErrors: [], failedRequests: [], externalRequests: [] };
const dataDir = await mkdtemp(path.join(tmpdir(), 'synk-redesign-review-'));
const remoteFiles = new Map();
let activeConnectionId = 'review-drive-main';
const connections = [
  { id: 'review-drive-main', email: 'team-review@example.test', folderId: 'review-folder-main' },
  { id: 'review-drive-backup', email: 'archive-review@example.test', folderId: 'review-folder-backup' },
];
const drive = {
  async active() { return connections.find(item => item.id === activeConnectionId) || null; },
  async status() {
    const account = await drive.active();
    return {
      provider: account ? 'google-drive' : 'local', activeConnectionId,
      connections: connections.map(c => ({ id: c.id, email: c.email, folderUrl: `https://drive.google.com/drive/folders/${c.folderId}`, active: c.id === activeConnectionId })),
      status: account ? 'connected' : 'local',
      account: account ? { email: account.email, name: 'SYNK 검수 계정', limitBytes: 5497558138880, usedBytes: 452388480123, driveBytes: 398240871211, trashBytes: 224488101 } : null,
      error: null, verifiedAt: '2026-09-27T00:30:00.000Z',
    };
  },
  async setActive(connectionId) { assert.ok(connectionId === null || connections.some(c => c.id === connectionId)); activeConnectionId = connectionId; return drive.status(); },
  async upload({ connectionId, localPath, fileId, md5, size }) {
    const bytes = await readFile(localPath);
    assert.equal(bytes.length, size);
    assert.equal(createHash('md5').update(bytes).digest('hex'), md5);
    const remoteId = `review-file-${fileId}`;
    remoteFiles.set(remoteId, { bytes, connectionId, fileId });
    return { connectionId, remoteId, md5 };
  },
  async download({ connectionId, remoteId, fileId }) {
    const file = remoteFiles.get(remoteId);
    assert.ok(file && file.connectionId === connectionId && file.fileId === fileId);
    return Readable.from(file.bytes);
  },
  async trash({ connectionId, remoteId, fileId }) {
    const file = remoteFiles.get(remoteId);
    assert.ok(!file || (file.connectionId === connectionId && file.fileId === fileId));
    remoteFiles.delete(remoteId);
  },
};
const service = createMessenger({ dataDir, port: 0, driveStorage: drive });
const { url } = await service.listen();
const browser = await chromium.launch({ executablePath: process.env.MESSENGER_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const password = `Review-${randomUUID()}`;
const pages = [];

function check(name, passed, detail) {
  report.checks.push({ name, passed: Boolean(passed), ...(detail !== undefined ? { detail } : {}) });
}
async function newContext() {
  const context = await browser.newContext({ viewport: sizes[0], deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.route('**/*', async route => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith(`${url}/`)) return route.continue();
    report.externalRequests.push(requestUrl);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  pages.push(page);
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => {
    // Native EventSource disconnects when a page reloads or a context closes.
    if (!request.url().endsWith('/api/events') && !request.failure()?.errorText.includes('ERR_ABORTED')) report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText });
  });
  return { context, page };
}
async function api(context, pathname, method = 'GET', data) {
  const response = await context.request.fetch(url + pathname, { method, data, headers: method === 'GET' ? {} : { Origin: url } });
  const body = await response.json();
  assert.ok(response.ok(), `${method} ${pathname}: ${response.status()} ${JSON.stringify(body)}`);
  return body;
}
async function stable(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); })));
  });
  await page.waitForTimeout(70);
}
async function accessibleControl(page, selector, name) {
  const element = page.locator(selector).first();
  check(`${name}: exists`, await element.count() > 0);
  if (!await element.count()) return;
  check(`${name}: visible`, await element.isVisible());
  if (!await element.isVisible()) return;
  const info = await element.evaluate(el => ({
    name: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')?.split(' ').map(id => document.getElementById(id)?.textContent).join(' ') || [...(el.labels || [])].map(label => label.textContent).join(' ') || el.textContent || el.title,
    disabled: Boolean(el.disabled), tabIndex: el.tabIndex,
  }));
  check(`${name}: accessible name`, Boolean(info.name?.trim()));
  if (info.disabled) return;
  check(`${name}: keyboard focusable`, info.tabIndex >= 0);
  try {
    await element.click({ trial: true, timeout: 2500 });
    check(`${name}: pointer reachable`, true);
  } catch (error) { check(`${name}: pointer reachable`, false, error.message.split('\n')[0]); }
  await element.focus();
  check(`${name}: receives focus`, await element.evaluate(el => document.activeElement === el));
}
async function capture(page, state, { controls = [] } = {}) {
  const viewport = page.viewportSize();
  await stable(page);
  const name = `redesign-${state}-${viewport.width}.png`;
  await page.screenshot({ path: path.join(output, name), fullPage: true, animations: 'disabled' });
  report.screenshots.push(name);
  const audit = await page.evaluate(() => ({
    viewport: innerWidth, width: document.documentElement.scrollWidth,
    fonts: document.fonts.check('15px SUIT', '한글') && document.fonts.check('500 15px "Inter Tight"', 'synk'),
    images: [...document.images].filter(img => getComputedStyle(img).display !== 'none').map(img => ({ src: new URL(img.src).pathname, ok: img.complete && img.naturalWidth > 0 })),
  }));
  check(`${state}/${viewport.width}: no horizontal overflow`, audit.width <= audit.viewport + 1, { width: audit.width, viewport: audit.viewport });
  check(`${state}/${viewport.width}: local fonts`, audit.fonts);
  check(`${state}/${viewport.width}: image loads`, audit.images.every(img => img.ok), audit.images);
  for (const selector of controls) await accessibleControl(page, selector, `${state}/${viewport.width}/${selector}`);
}
async function captureAll(page, state, controls = []) {
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.evaluate(() => scrollTo(0, 0));
    await capture(page, state, { controls });
  }
}
async function openSidebarIfNeeded(page) {
  const reachable = await page.locator('#workspace-settings').evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert]');
  });
  if (!reachable) {
    await page.locator('#mobile-menu').click();
    await page.locator('#sidebar.open').waitFor();
  }
}
async function openSettings(page) {
  await openSidebarIfNeeded(page);
  await page.locator('#workspace-settings').click();
  await page.locator('#drive-account-email').waitFor();
}
async function closeModal(page) {
  await page.locator('#close-modal').click();
  await page.locator('#modal').waitFor({ state: 'hidden' });
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    const r = el.getBoundingClientRect();
    const point = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { id: el.id, usable: el !== document.body && !el.closest('dialog, [inert]') && r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && el.contains(point) };
  });
  check(`modal/${page.viewportSize().width}: close restores usable focus`, focused.usable, focused);
}
async function tabState(page, selected, other) {
  const state = async selector => page.locator(selector).evaluate(el => el.getAttribute('aria-selected') ?? el.getAttribute('aria-pressed'));
  return await state(selected) === 'true' && await state(other) === 'false';
}

try {
  await mkdir(output, { recursive: true });
  const owner = await newContext();
  const page = owner.page;
  await page.goto(url);
  await page.locator('#auth-form').waitFor();
  await captureAll(page, 'setup', ['#workspace-name', '#display-name', '#username', '#password', '#auth-submit']);
  await page.setViewportSize(sizes[0]);
  await page.locator('#workspace-name').fill('SYNK');
  await page.locator('#display-name').fill('유호');
  await page.locator('#username').fill('reviewowner');
  await page.locator('#password').fill(password);
  await page.locator('#auth-submit').click();
  await page.locator('#composer-input').waitFor();
  const bootstrap = await api(owner.context, '/api/bootstrap');
  const lounge = bootstrap.channels.find(c => c.name === '팀 라운지');
  await page.locator(`[data-channel="${lounge.id}"]`).click();
  await captureAll(page, 'chat-empty', ['#composer-input', '#attach-file', '#composer-emoji']);

  const guest = await newContext();
  await guest.page.goto(url);
  await guest.page.locator('#auth-form').waitFor();
  await captureAll(guest.page, 'login', ['#username', '#password', '#auth-submit', '#switch-auth']);
  await guest.page.locator('#switch-auth').click();
  await guest.page.locator('#invite-code').waitFor();
  await captureAll(guest.page, 'join', ['#invite-code', '#display-name', '#username', '#password', '#auth-submit']);

  const teammates = [];
  for (const [username, name] of [['reviewjimin', '지민'], ['reviewseoyeon', '서연']]) {
    const invitation = await api(owner.context, '/api/invites', 'POST', {});
    const member = await browser.newContext();
    const joined = await api(member, '/api/join', 'POST', { code: invitation.code, name, username, password });
    teammates.push({ context: member, user: joined.user });
  }
  const channel = (await api(owner.context, '/api/channels', 'POST', { name: '프로젝트 작업실', description: '이번 주 진행 상황과 함께 볼 자료를 모아요.' })).channel;
  await api(owner.context, '/api/channels', 'POST', { name: '아이디어 노트', description: '다음 작업을 위한 생각' });
  await api(owner.context, '/api/dms', 'POST', { userId: teammates[0].user.id });
  const send = async (context, body, fileIds = []) => (await api(context, `/api/channels/${channel.id}/messages`, 'POST', { body, fileIds })).message;
  await send(owner.context, '이번 주에는 로그인 흐름과 파일 공유부터 확인해요.\n화면에서 막히는 부분이 있으면 이 채널에 남겨 주세요.');
  const firstReply = await send(teammates[0].context, '초대 코드로 가입해 봤어요. 대화방까지 한 번에 들어와서 편하네요.');
  await api(owner.context, `/api/messages/${firstReply.id}/reactions`, 'POST', { emoji: '👍' });
  await api(teammates[1].context, `/api/messages/${firstReply.id}/reactions`, 'POST', { emoji: '👍' });
  await send(teammates[1].context, '검토할 자료는 파일 탭에 모아둘게요. 메모에는 담당자와 확인할 날짜도 적어 두었습니다.');
  const documents = [
    { name: '디자인_검토메모.md', body: '# 디자인 검토\n- 모바일에서 입력창 확인\n- 검색 결과에서 원래 대화로 이동\n', message: '화면 검토 메모예요. 모바일 입력창과 검색 동선을 먼저 봐 주세요.' },
    { name: '이번_주_진행일정.csv', body: '작업,담당,확인일\n로그인 흐름,지민,화요일\n파일 공유,서연,수요일\n', message: '이번 주 일정도 함께 올립니다. 각자 확인한 내용에 체크해 주세요.' },
    { name: '2026_09_프로젝트_회의_액션아이템_담당자별_진행상황과_확인일정_최종검토.txt', body: '오늘 확인할 것\n1. 초대 가입\n2. 파일 업로드와 다운로드\n3. 모바일 메시지 입력\n', message: '회의에서 정한 확인 항목입니다. 완료한 항목은 답글로 알려 주세요.' },
  ];
  for (let i = 0; i < documents.length; i++) {
    const item = documents[i];
    const context = i === 1 ? teammates[0].context : owner.context;
    const response = await context.request.post(`${url}/api/channels/${channel.id}/files`, { headers: { Origin: url, 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(item.name) }, data: Buffer.from(item.body) });
    assert.ok(response.ok());
    const { file } = await response.json();
    await send(context, item.message, [file.id]);
  }
  await send(teammates[0].context, '좋아요. 오늘 오후에 확인하고 결과를 남길게요.');
  const finalMessage = await send(owner.context, '급한 내용은 1:1 대화로 알려 주셔도 좋아요. 같이 써 보면서 하나씩 다듬어 봅시다.');
  await api(teammates[1].context, `/api/messages/${finalMessage.id}/reactions`, 'POST', { emoji: '✅' });
  await page.setViewportSize(sizes[0]);
  await page.reload();
  await page.locator(`[data-channel="${channel.id}"]`).click();
  await page.locator('.message').last().waitFor();
  await page.locator(`[data-channel="${channel.id}"]`).focus();
  const focusProbe = await send(teammates[0].context, '실시간 갱신 중 키보드 초점 확인');
  await page.getByText('실시간 갱신 중 키보드 초점 확인', { exact: true }).waitFor();
  check('realtime: channel navigation retains keyboard focus', await page.locator(`[data-channel="${channel.id}"]`).evaluate(el => document.activeElement === el));
  await api(owner.context, `/api/messages/${focusProbe.id}`, 'DELETE');
  await page.getByText('실시간 갱신 중 키보드 초점 확인', { exact: true }).waitFor({ state: 'detached' });
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.locator('#tab-chat').click();
    check(`tabs/${size.width}: chat selected`, await tabState(page, '#tab-chat', '#tab-files'));
    await capture(page, 'chat', { controls: ['#composer-input', '#attach-file', '#composer-emoji', '#channel-search'] });
    await page.locator('#composer-input').fill('키보드 전송 확인');
    await page.locator('#composer-input').focus();
    let reached = false;
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('Tab');
      if (await page.locator('#send-message').evaluate(el => document.activeElement === el)) { reached = true; break; }
    }
    check(`chat/${size.width}: send button reachable by Tab`, reached);
    if (reached) {
      const focus = await page.locator('#send-message').evaluate(el => { const style = getComputedStyle(el); return { focusVisible: el.matches(':focus-visible'), outline: style.outline, outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth), shadow: style.boxShadow }; });
      check(`chat/${size.width}: keyboard focus visible`, focus.focusVisible && ((focus.outlineStyle !== 'none' && focus.outlineWidth >= 1) || focus.shadow !== 'none'), focus);
      await page.screenshot({ path: path.join(output, `redesign-keyboard-focus-${size.width}.png`), fullPage: true, animations: 'disabled' });
      report.screenshots.push(`redesign-keyboard-focus-${size.width}.png`);
      await page.keyboard.press('Enter');
      await page.getByText('키보드 전송 확인', { exact: true }).waitFor();
      const sent = (await api(owner.context, `/api/channels/${channel.id}/messages`)).messages.find(m => m.body === '키보드 전송 확인');
      await api(owner.context, `/api/messages/${sent.id}`, 'DELETE');
      await page.getByText('키보드 전송 확인', { exact: true }).waitFor({ state: 'detached' });
    } else { await page.locator('#composer-input').fill(''); }
    await page.locator('#tab-files').click();
    await page.locator('#files-view .file-card').first().waitFor();
    check(`tabs/${size.width}: files selected`, await tabState(page, '#tab-files', '#tab-chat'));
    await capture(page, 'files', { controls: ['#files-view .file-card'] });
    if (size.width <= 390) {
      const longFile = page.locator('#files-view .file-card').filter({ hasText: documents[2].name });
      await longFile.scrollIntoViewIfNeeded();
      const readable = await longFile.evaluate(card => {
        const label = card.querySelector('.file-name');
        const text = label?.firstChild;
        if (!text?.textContent) return false;
        const range = document.createRange();
        range.setStart(text, text.textContent.length - 1);
        range.setEnd(text, text.textContent.length);
        const last = range.getBoundingClientRect(), frame = card.getBoundingClientRect();
        return last.width > 0 && last.left >= frame.left && last.right <= frame.right && last.bottom <= frame.bottom;
      });
      check(`files/${size.width}: long filename ending remains visible`, readable);
      check(`files/${size.width}: original download filename preserved`, await longFile.getAttribute('download') === documents[2].name);
    }
    await page.locator('#tab-chat').click();
    if (size.width <= 768) {
      await openSidebarIfNeeded(page);
      await page.locator('#global-search').click();
    } else { await page.locator('#channel-search').click(); }
    await page.locator('#search-input').fill('확인');
    await page.locator('.search-result').first().waitFor();
    await capture(page, 'search', { controls: ['#search-input', '#search-scope', '#close-drawer', '.search-result'] });
    await page.locator('#close-drawer').click();
    await openSettings(page);
    assert.equal((await page.locator('#drive-account-email').innerText()).trim(), 'team-review@example.test');
    await capture(page, 'settings-drive', { controls: ['#drive-account-select', '#drive-refresh', '#drive-folder-link', '#logout-button', '#close-modal'] });
    await closeModal(page);
    // Use the always-available settings entry on narrower layouts as well.
    await openSettings(page);
    await page.locator('#settings-invite').click();
    await page.locator('#generate-invite').click();
    await page.locator('#new-invite-code').waitFor();
    await capture(page, 'invite', { controls: ['#generate-invite', '#copy-code', '#close-modal'] });
    await closeModal(page);
    if (await page.locator('#sidebar').evaluate(el => el.classList.contains('open'))) {
      await page.keyboard.press('Escape');
      await page.locator('#sidebar.open').waitFor({ state: 'hidden' });
    }
    if (size.width <= 768) {
      await page.locator('#composer-input').focus();
      const inaccessibleFocus = [];
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press('Tab');
        const trapped = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el.closest('#sidebar')) return null;
          const r = el.getBoundingClientRect();
          return r.right <= 0 || r.left >= innerWidth || el.closest('[inert]') ? el.id || el.getAttribute('aria-label') || el.textContent.trim() : null;
        });
        if (trapped) inaccessibleFocus.push(trapped);
      }
      check(`mobile/${size.width}: hidden sidebar omitted from Tab order`, inaccessibleFocus.length === 0, inaccessibleFocus);
    }
  }
  check('no browser console errors', report.consoleErrors.length === 0, report.consoleErrors);
  check('no failed browser requests', report.failedRequests.length === 0, report.failedRequests);
  check('no external browser requests', report.externalRequests.length === 0, report.externalRequests);
  report.passed = report.checks.every(item => item.passed);
  await writeFile(path.join(output, 'redesign-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, screenshots: report.screenshots.length, checks: report.checks.length, failed: report.checks.filter(item => !item.passed), report: path.join(output, 'redesign-report.json') }, null, 2));
  assert.equal(report.passed, true, 'responsive design review found failures; inspect redesign-report.json');
} catch (error) {
  report.error = error.message;
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'redesign-report.json'), JSON.stringify(report, null, 2));
  for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: path.join(output, `redesign-failure-${i}.png`), fullPage: true }).catch(() => {});
  console.error(JSON.stringify({ error: error.message, completedScreenshots: report.screenshots.length, failed: report.checks.filter(item => !item.passed), report: path.join(output, 'redesign-report.json') }, null, 2));
  throw error;
} finally {
  await browser.close();
  await service.close();
  assert.ok(path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(dataDir).startsWith('synk-redesign-review-'));
  await rm(dataDir, { recursive: true, force: true });
}
