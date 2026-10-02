const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = 'C:/Users/q1212/.codex/visualizations/2026/09/27/01a0e247-e6df-7b72-af5d-20238b73ce68';
const fragment = path.join(base, 'synk-lesson-screen.html');
const preview = path.join(base, 'synk-lesson-screen-preview.html');
const source = fs.readFileSync(fragment, 'utf8');
const report = { fragmentBytes: Buffer.byteLength(source), screens: [], errors: [] };
if (report.fragmentBytes >= 1000000) throw new Error('Fragment over 1 MB');
if (/<(?:!doctype|html|head|body)\b/i.test(source)) throw new Error('Not a fragment');
if (/\\"|\\n/.test(source)) throw new Error('Escaped markup found');
const intersects = (a, b) => a.x < b.x + b.width - .5 && a.x + a.width > b.x + .5 && a.y < b.y + b.height - .5 && a.y + a.height > b.y + .5;
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 768, height: 1100 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto('file:///' + preview.replaceAll('\\', '/'));
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForSelector('#synk-lesson-screen');
  await frame.evaluate(() => document.fonts.ready);
  for (const width of [320, 736]) {
    await page.setViewportSize({ width: width + 32, height: 1100 });
    await page.waitForTimeout(150);
    for (const mode of ['standard', 'pronunciation', 'material']) {
      await frame.locator('#synk-lesson-mode').selectOption(mode);
      const data = await frame.evaluate(() => {
        const root = document.getElementById('synk-lesson-screen');
        const stage = root.querySelector('.lesson-stage');
        const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const teacher = root.querySelector('.lesson-teacher');
        const lines = [...root.querySelectorAll('.lesson-material p, .lesson-material h3, .lesson-cue h3, .lesson-cue p')].filter(el => el.getClientRects().length);
        return {
          mode: root.dataset.mode,
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          root: rect(root), stage: rect(stage),
          fontLoaded: document.fonts.check('14px "SUIT Variable"'),
          teacher: teacher.hidden ? null : rect(teacher),
          lines: lines.map(el => ({ text: el.textContent, box: rect(el), font: parseFloat(getComputedStyle(el).fontSize), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })),
          state: root.querySelector('.lesson-state').textContent
        };
      });
      if (Math.abs(data.root.width - width) > 1) throw new Error('Width differs: ' + JSON.stringify(data.root));
      if (data.scrollWidth > data.width + 1) throw new Error('Horizontal overflow');
      if (data.mode !== mode) throw new Error('Select did not update mode');
      if (Math.abs(data.stage.width / data.stage.height - 16 / 9) > .01) throw new Error('Aspect ratio changed');
      if (!data.fontLoaded) throw new Error('Embedded SUIT font not loaded');
      for (const line of data.lines) {
        if (line.font < 11) throw new Error('Tiny text: ' + line.text);
        if (line.scrollWidth > line.clientWidth + 1) throw new Error('Text overflow: ' + line.text);
        if (data.teacher && intersects(line.box, data.teacher)) throw new Error('Teacher covers text: ' + line.text + ' in ' + mode + ' at ' + width);
        if (line.box.y < data.stage.y - .5 || line.box.y + line.box.height > data.stage.y + data.stage.height + .5) throw new Error('Text outside frame: ' + line.text);
      }
      for (let i = 0; i < data.lines.length; i++) for (let j = i + 1; j < data.lines.length; j++) {
        if (intersects(data.lines[i].box, data.lines[j].box)) throw new Error('Text overlap: ' + data.lines[i].text + ' / ' + data.lines[j].text);
      }
      await frame.locator('#synk-lesson-screen').screenshot({ path: path.join(__dirname, `lesson-preview-${width}-${mode}.png`) });
      report.screens.push(data);
    }
  }
  const model = await frame.locator('#synk-lesson-screen').evaluate(el => el.lessonLayoutData);
  const standard = model.modes.standard;
  if (intersects(standard.textSafe, standard.teacher)) throw new Error('Base coordinate text overlaps teacher');
  if (intersects(model.modes.pronunciation.material, model.modes.pronunciation.teacher)) throw new Error('Base pronunciation areas overlap');
  for (const mode of Object.values(model.modes)) for (const area of [mode.material, mode.teacher, mode.textSafe].filter(Boolean)) {
    if (area.x < 0 || area.y < 0 || area.x + area.width > 1920 || area.y + area.height > 1080) throw new Error('Coordinate outside canvas');
  }
  report.coordinates = model;
  await frame.locator('#synk-lesson-mode').selectOption('standard');
  await page.setViewportSize({ width: 768, height: 1100 });
  await page.waitForTimeout(150);
  await frame.locator('#synk-lesson-screen').screenshot({ path: path.join(__dirname, 'SYNK_온라인수업_화면구성.png') });
  await page.emulateMedia({ colorScheme: 'dark' });
  await frame.locator('#synk-lesson-screen').screenshot({ path: path.join(__dirname, 'lesson-preview-dark.png') });
  report.keyboard = {};
  await frame.locator('#synk-lesson-mode').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  report.keyboard.modeAfterArrowDown = await frame.locator('#synk-lesson-screen').getAttribute('data-mode');
  if (report.keyboard.modeAfterArrowDown !== 'pronunciation') throw new Error('Keyboard select failed');
  await frame.evaluate(() => window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { widgetState: { modelContent: { lessonMode: 'material' } } } } })));
  report.stateRestore = await frame.locator('#synk-lesson-screen').getAttribute('data-mode');
  if (report.stateRestore !== 'material') throw new Error('State restore failed');
  await frame.evaluate(() => window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { widgetState: { modelContent: { lessonMode: 'invalid' } } } } })));
  if (await frame.locator('#synk-lesson-screen').getAttribute('data-mode') !== 'standard') throw new Error('Invalid saved state fallback failed');
  if (report.errors.length) throw new Error(report.errors.join('\n'));
  fs.writeFileSync(path.join(__dirname, 'lesson-screen-verification.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  console.log(JSON.stringify({ bytes: report.fragmentBytes, layoutsChecked: report.screens.length, widths: [320,736], keyboard: report.keyboard, stateRestore: report.stateRestore, errors: report.errors }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
