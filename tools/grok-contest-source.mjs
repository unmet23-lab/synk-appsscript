// Executed by the Ego browser CLI to download only the Grok contest reports named below.
const { botUrl, detailsName, pageTitle, downloadLock, importedIds } = contestSource;
const fs = await import('node:fs/promises');
const { randomUUID } = await import('node:crypto');
const spaceName = 'Grok contest map';
const existing = (await listTaskSpaces()).find((space) => space.name === spaceName);
if (existing?.ownership === 'agentDelegatedToUser') throw Error('공모 지도용 Ego 창을 사용자가 제어하고 있습니다.');
const task = existing?.ownership === 'user' ? await claimTaskSpace(existing.id) : await taskSpace(existing?.id ?? spaceName);
const page = (await task.pages())[0] ?? await task.adopt((await task.tabs())[0].page);
await page.goto(botUrl, { timeout: 16000 });


async function pageFeed() {
  await page.waitForSelector('loc=css:[role=log]', { timeout: 14000 });
  await page.waitForFunction(() => document.querySelector('[role=log]')?.innerText?.trim().length > 30, undefined, { timeout: 12000 });
  const card = 'loc=css:[role=log] button[aria-label=' + JSON.stringify(pageTitle + ' 열기') + '] >> nth=-1';
  const openLabel = pageTitle + ' 열기';
  const visible = (label) => [...document.querySelectorAll('[role=log] button[aria-label]')]
    .some((button) => button.getAttribute('aria-label') === label && button.getClientRects().length);
  for (let i = 0; i < 9 && !(await page.evaluate(visible, openLabel)); i++) {
    const moved = await page.evaluate(() => {
      const log = document.querySelector('[role=log] [data-has-overflow-y]');
      if (!log || log.scrollTop <= 0) return false;
      log.scrollBy(0, -Math.max(log.clientHeight * 1.2, 450));
      return true;
    });
    if (!moved) break;
    await page.waitForFunction(visible, openLabel, { timeout: 850 }).catch(() => {});
  }
  if (!(await page.evaluate(visible, openLabel))) return null;
  await page.click(card, { label: 'Open private contest feed' });

  const { gunzipSync } = await import('node:zlib');
  const { createHash } = await import('node:crypto');
  const header = /^SYNKGROKFEED-v1:([a-f0-9]{64}):([1-9]\d{0,4})$/;
  const part = /^SYNKGROKPART:([1-9]\d{0,4}):([A-Za-z0-9+/=]{1,120})$/;
  for (let attempt = 0; attempt < 4; attempt++) {
    const snapshot = String(await page.snapshot({ scope: 'full_page' })).split('\n');
    const index = snapshot.findIndex((line, i) => line.includes('region "' + pageTitle + '"') &&
      snapshot.slice(i, i + 12).some((item) => item.includes('button "Close"')));
    const frameRef = index < 0 ? null : snapshot.slice(index, index + 22)
      .map((line) => /iframe \[ref=(\d+)\]/.exec(line)?.[1]).find(Boolean);
    if (frameRef) {
      const embedded = String(await page.snapshot({ scope: 'subtree', root: '@' + frameRef }));
      const texts = embedded.split('\n').map((line) => /^\s*text "(.*)"\s*$/.exec(line)?.[1]).filter(Boolean);
      const h = texts.map((line) => header.exec(line)).find(Boolean);
      const parts = texts.map((line) => part.exec(line)).filter(Boolean);
      if (h && parts.length === Number(h[2]) && parts.every((piece, i) => Number(piece[1]) === i + 1)) {
        const raw = gunzipSync(Buffer.from(parts.map((piece) => piece[2]).join(''), 'base64'), { maxOutputLength: 2 * 1024 * 1024 });
        if (createHash('sha256').update(raw).digest('hex') === h[1]) {
          const feed = JSON.parse(raw.toString('utf8'));
          if (feed.schema === 'synk-grok-contest-feed-v1' && Array.isArray(feed.reports) && feed.reports.length) return feed.reports;
        }
      }
    }
    await page.waitForTimeout(350);
  }
  return null;
}

const pageReports = await pageFeed().catch(() => null);
if (pageReports) {
  const known = new Set(importedIds);
  console.log('SYNKGROKDATA=' + JSON.stringify({
    receipts: pageReports.length, reports: pageReports.filter((report) => !known.has(report.reportId)), failures: [],
  }));
} else {
  await page.goto(botUrl, { timeout: 16000 });
  await libraryFeed();
}

async function libraryFeed() {
  const details = 'loc=role:button[name=' + JSON.stringify(detailsName) + ']';
  const library = 'loc=role:tab[name="라이브러리"]';
  const libraryShown = await page.evaluate(() => [...document.querySelectorAll('[role=tab]')]
    .some((tab) => tab.innerText.trim() === '라이브러리' && tab.getClientRects().length));
  if (!libraryShown) {
    await page.waitForSelector(details, { timeout: 16000 });
    await page.click(details, { label: 'Open bot library' });
  }
  await page.waitForSelector(library, { timeout: 10000 });
  await page.click(library, { label: 'Read contest file library' });
  const files = 'loc=css:[role=tabpanel] button:text-is("Files")';
  await page.waitForSelector(files, { timeout: 10000 });
  await page.click(files, { label: 'Show files only' });

  const partition = (label) => /^(synk-contest-feed-(\d{4}-\d{2}-\d{2}_(?:0830|1430|2000))\.json|bootstrap-20261117-20261118\.json) 다운로드$/.exec(label);
  const more = 'loc=css:[role=tabpanel] button:text-is("Show more") >> nth=0';
  for (let i = 0; i < 5; i++) {
    const available = await page.evaluate(() => [...document.querySelectorAll('[role=tabpanel] button')]
      .some((button) => button.innerText.trim() === 'Show more' && button.getClientRects().length));
    if (!available) break;
    await page.click(more, { label: 'Read older contest receipts' });
  }
  const names = await page.evaluate(() => [...document.querySelectorAll('[role=tabpanel] button[aria-label]')]
    .map((button) => button.getAttribute('aria-label')));
  const receipts = [...new Set(names.filter((label) => partition(label)))].slice(0, 24);
  if (!receipts.length) throw Error('비공개 그록 라이브러리에 공모 보고서 파일이 없습니다.');

  const imported = new Set(importedIds);
  const pending = receipts.filter((label) => !imported.has(partition(label)[2] || 'bootstrap-20261117-20261118'));
  const result = [];
  const failures = [];
  async function download(label, expected, wantedId) {
    const owner = 'synk-grok-contests-' + randomUUID();
    const limit = Date.now() + 30000;
    while (true) {
      try {
        await fs.writeFile(downloadLock, owner + ' grok contests ' + new Date().toISOString(), { flag: 'wx' });
        break;
      } catch (error) {
        if (error.code !== 'EEXIST' || Date.now() >= limit) throw error;
        await page.waitForTimeout(1200);
      }
    }
    try {
      const selector = 'loc=css:[role=tabpanel] button[aria-label=' + JSON.stringify(label) + '] >> nth=0';
      await page.hover(selector, { label: 'Find contest report file' });
      const download = page.waitForEvent('download', { timeout: 20000 }).then((file) => ({ file }), (error) => ({ error }));
      await page.click(selector, { label: 'Download contest report' });
      const { file, error } = await download;
      if (error) throw error;
      if (file.suggestedFilename() !== expected) throw Error('다른 다운로드가 들어와 회차를 다시 받습니다.');
      const temporary = await file.path();
      const info = await fs.stat(temporary);
      if (info.size > 2 * 1024 * 1024) throw Error('그록 보고서 용량이 예상 범위를 넘습니다.');
      const report = JSON.parse((await fs.readFile(temporary, 'utf8')).replace(/^\uFEFF/, ''));
      if (report.schema !== 'synk-grok-contests-v1' || report.reportId !== wantedId || !Array.isArray(report.items)) {
        throw Error('내려받은 보고서의 형식 또는 회차가 맞지 않습니다.');
      }
      return report;
    } finally {
      if ((await fs.readFile(downloadLock, 'utf8').catch(() => '')).startsWith(owner + ' ')) {
        await fs.unlink(downloadLock);
      }
    }
  }

  for (const label of pending) {
    const match = partition(label);
    const wantedId = match[2] || 'bootstrap-20261117-20261118';
    try {
      result.push(await download(label, match[1], wantedId));
    } catch {
      failures.push(wantedId);
    }
  }
  console.log('SYNKGROKDATA=' + JSON.stringify({ receipts: receipts.length, reports: result, failures }));
}
