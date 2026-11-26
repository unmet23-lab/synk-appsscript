// Atlas 재설계 단계 4 · 4-6 브라우저 확인(단계4_계획 §23-10 「브라우저」). 다시 돌릴 수 있는 대본이다.
//   - WORLD가 여는 열 게임: 리허설 WORLD(atlasNext · atlasNextGuest, 엔진 판 묶음)에서 합성 계정으로 로그인해 셸의 게임 문으로 한 판씩 한다.
//   - 이야기 교실 · 낱말 마법: 그 게임 폴더의 server.mjs를 로컬 주소로 띄워 ?atlas=next(개발 깃발)로 한 판씩 한다.
// 게임마다 보는 것: ① 게임이 열린 동안 위 창에 window.SYNKAtlasGame(문) ② 틀이 그 게임의 atlas-next-play.mjs를 받고 옛 SynkLearning.createGame을
// 부르지 않음 ③ 정답 · 오답을 섞어 판 끝 화면까지 ④ 새 엔진 저장소(IndexedDB synk-atlas:*)에 그 게임 판(setId)의 제시 · 답 사건, 계정이면 리허설
// 서버 trail에 올라감 ⑤ 콘솔 오류 · 페이지 오류 · 4xx/5xx 없음 ⑥ 1440 × 900 · 390 × 844 화면 한 장씩과 가로 넘침.
// 게임 앞 장면 둘(결과의 world): 닫힌 패널에서 연 틀에 문이 선다(closedPanelLaunch). 놀이 목록에서 연 게임을 셸이 문을 세우기 전에
// Escape로 닫으면, 응답이 닫기 전환(160ms) 안에 와도 다시 열리지 않는다(escapeWhileWaiting — 5-3 ② 넷째 검수 GA3 · 설계 주인 11-26).
//
// 띄우기(리허설 서버는 따로 띄운다 — 이 대본은 띄우지 않는다):
//   SYNK_WORLD_MODE=rehearsal SYNK_WORLD_FEATURES=atlasNext,atlasNextGuest SYNK_WORLD_PORT=4392 SYNK_ATLAS_DEV_OUT=<엔진 판 묶음 폴더>
//   SYNK_TALK_ROOT=<SYNK-talk> node experiences/synk-world-app/server.mjs
// 돌리기:
//   node experiences/synk-world-app/qa/atlas-next-games-browser.mjs --out <결과 폴더> [--base http://127.0.0.1:4392]
//     [--games blank-slice,word-magic] [--atlas-out <엔진 판 묶음 폴더 — 혼자 뜨는 두 게임의 /atlas/>] [--media-root <미디어가 있는 공용 작업본>]
//     [--headed] [--gl swiftshader] [--launch closed — 패널이 닫힌 동네 화면에서 연다]
// 이 대본이 하는 손질(제품 코드는 그대로다):
//   - 워크트리에 없는 미디어(.gitignore의 *.glb 등)는 공용 작업본의 같은 파일로 채운다(결과의 mediaFallback에 적는다).
//   - 혼자 뜨는 두 게임의 /atlas/**는 엔진 판 묶음 폴더에서 낸다 — 그 게임 폴더의 server.mjs는 /atlas/를 내지 않는다.
//   - 첫 실행 화면(연습 문장 · 연수 · 연습 공 · 조작 연습 · 박자 맞추기)은 그 게임의 진도 열쇠를 미리 넣어 건너뛴다(기록하지 않는 단계다).
//   - 틀 안 SynkLearning.createGame에 첩자를 단다(부른 횟수만 센다).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const experiences = path.join(repo, 'experiences');

function arg(name, fallback = null) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith('--') ? process.argv[at + 1] : fallback;
}
const flag = name => process.argv.includes(`--${name}`);
const BASE = (arg('base') || process.env.SYNK_WORLD_QA_URL || 'http://127.0.0.1:4392').replace(/\/$/, '');
const OUT = path.resolve(arg('out') || process.env.SYNK_QA_OUT || path.join(os.tmpdir(), 'atlas-next-games-browser'));
const ATLAS_OUT = arg('atlas-out') || process.env.SYNK_ATLAS_DEV_OUT || null;
const MEDIA_ROOT = arg('media-root') || process.env.SYNK_MEDIA_ROOT || path.join(os.homedir(), 'Documents/SYNK-appsscript');
const ONLY = arg('games')?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
const SOLO_PORTS = { 'story-classroom': Number(process.env.SYNK_QA_STORY_PORT || 4393), 'word-magic': Number(process.env.SYNK_QA_MAGIC_PORT || 4394) };
fs.mkdirSync(OUT, { recursive: true });

function loadPlaywright() {
  const tries = [process.env.SYNK_QA_NODE_MODULES && path.join(process.env.SYNK_QA_NODE_MODULES, 'playwright'), 'playwright', path.join(MEDIA_ROOT, 'node_modules/playwright')].filter(Boolean);
  for (const name of tries) {
    try {
      return require(name);
    } catch {
      // 다음 자리
    }
  }
  throw new Error('playwright를 찾지 못했다 — SYNK_QA_NODE_MODULES로 가리킨다');
}
const { chromium } = loadPlaywright();

// 게임 은행 표(셸의 문이 받는 열두 곳)에서 WORLD가 여는 열과 혼자 뜨는 둘을 가른다.
const { GAME_BANKS } = await import(pathToFileURL(path.join(repo, 'experiences/synk-world-app/world-atlas-game.mjs')).href);
const SOLO = ['story-classroom', 'word-magic'];
const WORLD = Object.keys(GAME_BANKS).filter(id => !SOLO.includes(id));
// 셸의 게임 표(app-shell.mjs games)의 짧은 이름 — 셸은 주소의 폴더 이름으로 문을 청한다.
const SHELL_ID = { 'blank-slice': 'blank', 'entry-check': 'entry', 'hangul-stage': 'hangul', 'korean-racing': 'racing', 'korean-rhythm': 'rhythm', 'korean-runner': 'runner', 'order-rush': 'order', 'snap-words': 'snap', 'subway-rush': 'subway', 'talk-rally': 'rally' };
// 첫 실행 화면을 건너뛰는 진도 열쇠(기록하지 않는 단계 — 연습 문장 · 연수 · 연습 공 · 조작 연습 · 박자 맞추기).
const SEEDS = {
  'blank-slice': { 'synk.blank-slice.v1': JSON.stringify({ v: 1, plays: 1, practiced: true, slow: false, best: null }) },
  'entry-check': { 'synk.entry-check.v1': JSON.stringify({ v: 1, stars: {}, plays: 1, tutorial: true, doneDay: null, motion: true }) },
  'talk-rally': { 'synk.talk-rally.v1': JSON.stringify({ v: 1, plays: 1, practiced: true, slow: false, best: null }), 'synk.talk-rally.narration': 'off' },
  // 시범(꼴마다 처음 한 번)을 건너뛰고, 만난 글자가 있어 꼴이 섞이게 한다.
  'hangul-stage': { 'synk.hangul-stage.v1': JSON.stringify({ v: 1, letters: Object.fromEntries(['v-a', 'v-eo', 'v-o', 'v-u', 'v-eu', 'v-i', 'c-g', 'c-n'].map(id => [id, { state: 'met', best: 'met', due: '2026-11-01T00:00:00.000Z', metAt: '2026-11-01T00:00:00.000Z' }])), demoSeen: ['listen_pick', 'see_pick', 'build', 'match', 'pair', 'teach', 'build_final'] }) },
  'korean-racing': { SYNK_RACING_TUTORIAL_V1: JSON.stringify({ version: 1, completed: true }) },
  'korean-rhythm': { 'synk.world.rhythm.calibrated': '1' },
};
const LIMITS = { 'korean-racing': 420000, 'korean-rhythm': 420000, 'korean-runner': 300000, 'subway-rush': 420000 };
// 알려진 것 — 이 확인과 상관없는 오류 · 실패 요청(까닭과 함께).
const KNOWN = [
  // 홈 동네가 첫 그림을 세로판으로 정했다가 가로판으로 바꾸며 끊긴 요청(현장노트 시험_화면확인 「1280 WORLD 확인에 홈 동네 세로 그림」).
  { test: e => e.kind === 'failed' && /town-port-v1/.test(e.text), why: '홈 동네 세로판 그림 요청 끊김(현장노트에 적힌 기존 동작)' },
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, { timeout = 30000, every = 200, what = '조건' } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      // 틀이 바뀌는 사이 — 다시 본다
    }
    await sleep(every);
  }
  throw new Error(`기다림 넘침(${Math.round(timeout / 1000)}초): ${what}`);
}
const shown = (frame, selector) =>
  frame.evaluate(s => {
    const node = document.querySelector(s);
    if (!node || node.hidden || !node.getClientRects().length) return false;
    const style = getComputedStyle(node);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }, selector);

// ── 모든 창(위 창 · 틀)에 다는 첩자: 틀의 옛 엔진 createGame 호출을 위 창 목록에 적는다 ─────────────────────────
function spyScript(seeds) {
  try {
    if (window === window.top && seeds) for (const [key, value] of Object.entries(seeds)) if (localStorage.getItem(key) == null) localStorage.setItem(key, value);
  } catch {
    // 저장소를 못 쓰는 판
  }
  const top = (() => {
    try {
      return window.top.location.href ? window.top : window;
    } catch {
      return window;
    }
  })();
  const note = entry => {
    try {
      (top.__qaOld ??= []).push({ at: Date.now(), path: location.pathname, ...entry });
    } catch {
      // 다른 출처
    }
  };
  let lib;
  try {
    Object.defineProperty(window, 'SynkLearning', {
      configurable: true,
      get: () => lib,
      set(value) {
        if (value && typeof value.createGame === 'function') {
          const original = value.createGame;
          lib = { ...value, createGame: (...args) => (note({ kind: 'createGame', gameId: args[0]?.gameId ?? null }), original.apply(value, args)) };
        } else lib = value;
      },
    });
  } catch {
    // 이미 정의됨
  }
}

// ── 저장소 읽기(그 출처의 synk-atlas:* IndexedDB 전부) ─────────────────────────────────────────────
async function readStores(page) {
  return page.evaluate(async () => {
    const list = (await indexedDB.databases?.()) ?? [];
    const out = {};
    for (const { name } of list) {
      if (!name?.startsWith('synk-atlas:')) continue;
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!db.objectStoreNames.contains('log')) {
        db.close();
        continue;
      }
      out[name] = await new Promise((resolve, reject) => {
        const request = db.transaction('log').objectStore('log').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
    }
    return out;
  });
}
function eventsOf(stores, gameId, since) {
  const all = [];
  for (const [store, rows] of Object.entries(stores)) for (const row of rows) {
    const event = row?.event ?? row;
    if (event?.type) all.push({ store, ...event });
  }
  const after = event => !event.at || Date.parse(event.at) >= since - 5000;
  const presented = all.filter(e => e.type === 'practice.presented' && String(e.setId).includes(`.${gameId}.`) && after(e));
  const ids = new Set(presented.map(e => e.id));
  const linked = type => all.filter(e => e.type === type && ids.has(e.presentationId));
  const attempted = linked('practice.attempted');
  const count = (list, key) => list.reduce((acc, e) => ((acc[e[key]] = (acc[e[key]] ?? 0) + 1), acc), {});
  return {
    stores: [...new Set(presented.map(e => e.store))],
    presented: presented.length,
    attempted: attempted.length,
    helped: linked('practice.helped').length,
    delivery: linked('practice.delivery').length,
    verdicts: count(attempted, 'verdict'),
    arms: count(presented, 'arm'),
    sets: [...new Set(presented.map(e => e.setId))],
    // 이번 판의 기기 사건 번호 — 제시와 그 제시에 딸린 답 · 도움 · 전달(계정 실행은 이 번호가 모두 서버에 받아들여져야 한다).
    eventIds: [...ids, ...['practice.attempted', 'practice.helped', 'practice.delivery'].flatMap(type => linked(type).map(e => e.id))],
    items: [...new Set(presented.map(e => e.itemKey))].slice(0, 20),
  };
}

// ── 한 창(페이지)의 기록: 요청 · 오류 · trail 올림 ─────────────────────────────────────────────
function watch(page, log) {
  page.on('console', message => {
    if (message.type() === 'error') log.push({ at: Date.now(), kind: 'console', text: message.text().slice(0, 400), url: message.location()?.url ?? '' });
  });
  page.on('pageerror', error => log.push({ at: Date.now(), kind: 'pageerror', text: String(error?.message ?? error).slice(0, 400) }));
  page.on('requestfailed', request => {
    const reason = request.failure()?.errorText ?? '';
    // 소리 · 그림의 범위 요청을 다른 곳으로 옮기며 끊긴 것(ERR_ABORTED)은 따로 센다.
    log.push({ at: Date.now(), kind: 'failed', text: `${reason} ${request.url()}`, aborted: /ERR_ABORTED/.test(reason) });
  });
  page.on('response', response => {
    if (response.status() >= 400) log.push({ at: Date.now(), kind: 'http', text: `${response.status()} ${response.request().method()} ${response.url()}` });
  });
  page.on('request', request => {
    const frame = request.frame();
    let frameUrl = '';
    try {
      frameUrl = frame?.url() ?? '';
    } catch {
      frameUrl = '';
    }
    log.push({ at: Date.now(), kind: 'request', text: request.url(), method: request.method(), frame: frameUrl, top: frame === page.mainFrame() });
  });
  page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
}
const problems = (log, from, to) =>
  log
    .filter(e => e.at >= from && e.at <= to && ['console', 'pageerror', 'http', 'failed'].includes(e.kind))
    .filter(e => !(e.kind === 'failed' && e.aborted))
    .map(e => ({ ...e, known: KNOWN.find(k => k.test(e))?.why ?? null }));

// 워크트리에 없는 미디어(*.glb 등 git 밖)를 공용 작업본의 같은 파일로 채운다.
const MEDIA = /\.(glb|mp3|mp4|wav|webp|jpg|png|ktx2|bin)$/i;
async function mediaFallback(context, origin, folderOf, used) {
  await context.route(url => url.origin === origin && MEDIA.test(url.pathname), async route => {
    const { pathname } = new URL(route.request().url());
    const local = folderOf(decodeURIComponent(pathname));
    if (local && !fs.existsSync(local.worktree) && fs.existsSync(local.shared)) {
      used.push(pathname);
      const type = { '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' }[path.extname(pathname).toLowerCase()] ?? 'application/octet-stream';
      return route.fulfill({ status: 200, body: fs.readFileSync(local.shared), contentType: type });
    }
    return route.continue();
  });
}
const worldMedia = pathname => {
  const [, first, ...rest] = pathname.split('/');
  if (!GAME_BANKS[first] && !['brand-opening', 'synk-world-home'].includes(first)) return null;
  return { worktree: path.join(experiences, first, ...rest), shared: path.join(MEDIA_ROOT, 'experiences', first, ...rest) };
};

// ── 화면 찍기와 가로 넘침 ─────────────────────────────────────────────────────────────
async function overflow(page, frame) {
  const measure = target => target.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
  return { top: await measure(page).catch(() => null), frame: frame && frame !== page.mainFrame() ? await measure(frame).catch(() => null) : null };
}
async function shoot(run, label, width) {
  const file = path.join(OUT, `${run.game}-${width}-${label}.png`);
  await run.page.screenshot({ path: file }).catch(error => run.notes.push(`찍기 실패 ${label} ${width}: ${error.message.split('\n')[0]}`));
  run.shots.push(file);
  run.widths[width] = { ...(run.widths[width] ?? {}), [label]: await overflow(run.page, run.frame()) };
}
// 판 가운데에서 두 폭을 한 장씩: 1440 × 900에서 찍고, 390 × 844로 줄여 찍은 뒤 1440으로 돌린다.
async function midShots(run, label = 'play') {
  if (run.midDone) return;
  run.midDone = true;
  await shoot(run, label, 1440);
  await run.page.setViewportSize({ width: 390, height: 844 });
  await sleep(1200);
  await shoot(run, label, 390);
  await run.page.setViewportSize({ width: 1440, height: 900 });
  await sleep(700);
}

// ── 게임마다 한 판 ────────────────────────────────────────────────────────────────
// 판 끝까지 가면 { ended: true, plan }을 돌려준다. plan은 대본이 고른 답(정답 · 오답).
const DRIVERS = {
  async 'blank-slice'(run) {
    const f = run.frame;
    await until(async () => (await f().evaluate(() => document.querySelector('#btn-start')?.textContent ?? '')).length > 0, { what: '시작 단추' });
    await sleep(2500); // 무대 데우기(qa/demo.cjs)
    await f().evaluate(() => {
      window.__qaLive = [];
      const live = document.querySelector('#sr-live');
      new MutationObserver(() => window.__qaLive.push(live.textContent)).observe(live, { childList: true, characterData: true, subtree: true });
    });
    await f().locator('#btn-start').click();
    const plan = [];
    let last = 0;
    for (let guard = 0; guard < 20; guard += 1) {
      const next = await until(
        async () => {
          if (await shown(f(), '#results')) return { done: true };
          const said = await f().evaluate(() => [...window.__qaLive].reverse().find(t => /번 문장\..*보기:/.test(t)) ?? '');
          const index = Number(/(\d+)번 문장\./.exec(said)?.[1] ?? 0);
          return index > last ? { index, said } : null;
        },
        { timeout: 30000, what: `${last + 1}번 문장` },
      );
      if (next.done) break;
      last = next.index;
      const options = next.said.split('보기:')[1].split(',').map(s => s.trim().replace(/^\d+\s+/, ''));
      const answer = await f().evaluate(async () => {
        const { ITEMS } = await import('./content.mjs');
        const text = document.querySelector('#s-text')?.dataset.text;
        return ITEMS.find(item => item.text === text)?.answer ?? null;
      });
      const right = options.indexOf(answer);
      const wrong = [2, 5].includes(next.index) && right >= 0;
      const key = wrong ? (right + 1) % options.length : Math.max(0, right);
      plan.push({ n: next.index, answer, options, chose: options[key], wrong });
      const before = await f().evaluate(() => window.__qaLive.length);
      await until(
        async () => {
          if ((await shown(f(), '#explain')) || (await shown(f(), '#answer-check'))) return true;
          const fresh = await f().evaluate(n => window.__qaLive.slice(n), before);
          if (fresh.some(t => t.startsWith('맞았어요'))) return true;
          await run.page.keyboard.press(`Digit${key + 1}`);
          return false;
        },
        { timeout: 20000, every: 300, what: `${next.index}번 문장 베기` },
      );
      if (next.index === 2) await midShots(run);
      if (await shown(f(), '#answer-check')) await f().locator(`#check-options button[data-word="${answer}"]`).click();
      if (await until(() => shown(f(), '#explain'), { timeout: 1500, what: '설명' }).catch(() => false)) {
        await sleep(300);
        await f().locator('#btn-next').click();
      }
    }
    await until(() => shown(f(), '#results'), { timeout: 20000, what: '결과 화면' });
    return { ended: true, plan };
  },

  async 'entry-check'(run) {
    const f = run.frame;
    await until(() => f().evaluate(() => document.querySelectorAll('#venues .venue').length > 0), { timeout: 60000, what: '근무지 목록' });
    await sleep(600);
    await f().locator('#rec-start').click();
    if (await until(() => shown(f(), '#btn-begin'), { timeout: 5000 }).catch(() => false)) {
      await f().locator('#btn-begin').click();
      await sleep(700);
    }
    if (await shown(f(), '#coach-skip')) await f().locator('#coach-skip').click();
    const plan = [];
    for (let guest = 1; guest <= 12; guest += 1) {
      const state = await until(
        async () => {
          if (await shown(f(), '#results')) return { done: true };
          if (await shown(f(), '#btn-alert')) {
            await f().locator('#btn-alert').click();
            await sleep(600);
            return null;
          }
          if ((await shown(f(), '#feedback')) || !(await shown(f(), '#btn-pass'))) return null;
          return f().evaluate(() => ({ venue: document.querySelector('#g-venue')?.textContent?.trim(), line: document.querySelector('#line')?.textContent?.trim(), who: document.querySelector('#who')?.textContent?.trim() }));
        },
        { timeout: 20000, what: `${guest}번째 손님` },
      );
      if (state.done) break;
      const answer = await f().evaluate(async ({ venue, line, who }) => {
        const { VENUES, CAST } = await import('./content.mjs');
        const place = VENUES.find(v => v.name === venue) ?? VENUES.find(v => v.cases?.some(c => c.line === line));
        const cases = place?.cases?.filter(c => c.line === line) ?? [];
        return (cases.find(c => CAST[c.who]?.name === who) ?? cases[0])?.answer ?? null;
      }, state);
      const wrong = [2, 4].includes(guest);
      await sleep(550); // 단추의 입력 막이(450ms)
      const rejectWith = async rule => {
        await f().locator('#btn-reject').click();
        await sleep(350);
        const target = rule ? `#notice .rule[data-rule="${rule}"]` : '#notice .rule';
        await f().locator(target).first().click();
      };
      if (!answer || answer === 'pass') {
        if (wrong) await rejectWith(null);
        else await f().locator('#btn-pass').click();
      } else if (wrong) await f().locator('#btn-pass').click();
      else await rejectWith(answer);
      plan.push({ guest, answer, wrong });
      await until(() => shown(f(), '#feedback'), { timeout: 8000, what: `${guest}번째 손님 판정` });
      if (guest === 2) await midShots(run);
      await sleep(300);
      await f().locator('#btn-next').click();
      await sleep(500);
    }
    await until(() => shown(f(), '#results'), { timeout: 20000, what: '결과 화면' });
    return { ended: true, plan };
  },

  async 'korean-racing'(run) {
    const f = run.frame;
    await until(() => f().evaluate(() => window.__racing?.snapshot()?.ready === true || window.__racingError), { timeout: 180000, every: 500, what: '3D 준비' });
    const error = await f().evaluate(() => window.__racingError ?? null);
    if (error) throw new Error(`레이싱을 열지 못함: ${error}`);
    await f().locator('#start').click();
    const plan = [];
    const answered = new Set();
    const started = Date.now();
    while (Date.now() - started < 360000) {
      const s = await f().evaluate(() => {
        const snap = window.__racing.snapshot();
        const q = document.querySelector('#question');
        return { screen: snap.screen, paused: snap.paused, coast: snap.coastDrive?.phase, gate: snap.gate?.questionId ?? null, phase: q?.dataset.phase ?? '', answers: snap.answers?.length ?? 0 };
      });
      if (s.screen === 'results') break;
      if (s.paused && (await shown(f(), '#resume'))) await f().locator('#resume').click();
      if (s.coast === 'drive' && (await shown(f(), '#cruise-results'))) {
        await f().locator('#cruise-results').click();
        await sleep(800);
        continue;
      }
      if (s.phase === 'choose' && s.gate && !answered.has(s.gate)) {
        answered.add(s.gate);
        const wrong = answered.size === 2;
        const tag = `#lane-choices .lane-tag[data-word$="${wrong ? 'o1' : 'o0'}"]`;
        await f().locator(tag).first().click().catch(async () => f().locator('#lane-choices .lane-tag').first().click());
        plan.push({ gate: s.gate, wrong });
        if (answered.size === 2) await midShots(run);
      }
      await sleep(250);
    }
    await until(() => shown(f(), '#results'), { timeout: 30000, what: '결과 화면' });
    return { ended: true, plan };
  },

  async 'korean-rhythm'(run) {
    const f = run.frame;
    await until(() => f().evaluate(() => !!window.synkRhythm), { timeout: 60000, what: '리듬 준비' });
    await sleep(800);
    await f().locator('#start-button').click();
    if (await until(() => shown(f(), '[data-w-skip]'), { timeout: 3000 }).catch(() => false)) await f().locator('[data-w-skip]').click();
    const plan = [];
    const pressed = new Set();
    const started = Date.now();
    while (Date.now() - started < 380000) {
      const s = await f().evaluate(() => {
        const snap = window.synkRhythm.snapshot();
        return { screen: snap.screen, paused: snap.paused, loading: snap.loading, time: snap.time, questions: (snap.questions ?? []).map(q => ({ time: q.time, answerOpen: q.answerOpen, options: q.options, answer: q.answer, response: q.response ?? null })) };
      });
      if (s.screen === 'results') break;
      if (s.paused && (await shown(f(), '#resume-button'))) await f().locator('#resume-button').click();
      for (const [i, q] of s.questions.entries()) {
        if (pressed.has(i) || s.time < q.answerOpen || s.time > q.time + 0.5) continue;
        pressed.add(i);
        const right = Math.max(0, q.options.indexOf(q.answer));
        const wrong = i === 1;
        const lane = wrong ? 1 - right : right;
        await f().locator(`#pad-${lane}`).click();
        plan.push({ q: i, answer: q.answer, wrong });
        if (i === 1) await midShots(run);
      }
      await sleep(150);
    }
    await until(() => shown(f(), '#results'), { timeout: 30000, what: '결과 화면' });
    return { ended: true, plan };
  },

  async 'korean-runner'(run) {
    const f = run.frame;
    await until(() => f().evaluate(() => !!window.synkRunner), { timeout: 60000, what: '바람길 준비' });
    await sleep(800);
    await f().locator('#start').click();
    const plan = [];
    const missions = new Map();
    const started = Date.now();
    let lastKey = 0;
    while (Date.now() - started < 200000) {
      if (await shown(f(), '#results')) break;
      if (await f().evaluate(() => document.querySelector('#audio-dialog')?.open === true)) throw new Error('소리를 받지 못해 달리기가 멈춤(#audio-dialog)');
      const info = await f().evaluate(() => {
        const i = window.synkRunner.info;
        return { running: i.running, paused: i.paused, finished: i.model?.finished, lane: i.model?.lane, current: i.model?.current ?? null };
      });
      if (info.paused && (await shown(f(), '#resume'))) await f().locator('#resume').click();
      if (info.finished) break;
      const mission = info.current;
      if (mission) {
        if (!missions.has(mission.id)) missions.set(mission.id, { n: missions.size + 1, wrong: missions.size + 1 === 2 });
        const me = missions.get(mission.id);
        const step = mission.steps.find(s => !s.resolved);
        if (step && !me.wrong && Date.now() - lastKey > 120) {
          let key = null;
          if (step.action === 'lane' && info.lane !== step.target) key = info.lane > step.target ? 'ArrowLeft' : 'ArrowRight';
          else if (step.action === 'jump' && step.remaining < 7 && step.remaining > 1.5) key = 'ArrowUp';
          else if (step.action === 'slide' && step.remaining < 7 && step.remaining > 1) key = 'ArrowDown';
          if (key) {
            await run.page.keyboard.press(key);
            lastKey = Date.now();
          }
        }
        if (me.n === 2) await midShots(run);
      }
      await sleep(60);
    }
    await until(() => shown(f(), '#results'), { timeout: 30000, what: '달리기 결과' });
    // 달리기가 끝난 까닭(tour — 90초를 다 달림, collision — 하트를 다 잃음: 대본은 장애물을 피하지 않는다)
    run.notes.push(`달리기 끝: ${await f().evaluate(() => window.synkRunner.info.model?.reason ?? null)}`);
    for (const [id, m] of missions) plan.push({ mission: id, wrong: m.wrong });
    // 판정하는 문항은 듣기 확인 셋이다(달리기 부탁의 동작 답은 판정하지 않는다).
    await f().locator('#result-listening-check').click();
    for (let n = 1; n <= 3; n += 1) {
      await until(() => f().evaluate(() => !!document.querySelector('#check-choices button:not(:disabled)')), { timeout: 30000, what: `듣기 확인 ${n} 소리 끝` });
      const correct = await f().evaluate(async () => {
        const { LISTENING_CHECKS } = await import('./listening-check.mjs');
        const id = document.querySelector('#listening-check-dialog')?.dataset.item;
        return LISTENING_CHECKS.find(x => x.id === id)?.correct ?? 0;
      });
      const wrong = n === 2;
      await f().locator(`#check-choices button[data-choice="${wrong ? (correct + 1) % 3 : correct}"]`).click();
      plan.push({ check: n, wrong });
      await sleep(400);
      await f().locator('#check-next').click();
      await sleep(600);
    }
    await until(async () => !(await f().evaluate(() => document.querySelector('#listening-check-dialog')?.open === true)), { timeout: 8000, what: '듣기 확인 닫힘' });
    return { ended: true, plan };
  },

  async 'order-rush'(run) {
    const f = run.frame;
    await until(() => f().evaluate(() => !!window.synkCafe && document.documentElement.classList.contains('w-ready')), { timeout: 60000, what: '카페 준비' });
    await sleep(800);
    await f().locator('#start').click();
    const plan = [];
    const recipeOf = id =>
      f().evaluate(async orderId => {
        const m = await import('./core.mjs');
        return [...m.ORDERS, ...(m.REVIEW ?? []), ...(m.DELAYED_ORDERS ?? [])].find(o => o.id === orderId)?.cups ?? null;
      }, id);
    const clear = async () => {
      await f().locator('#remove-cup').click();
      await f().locator('#remove-cup').click();
    };
    const build = async cups => {
      await clear();
      for (const [i, cup] of cups.entries()) {
        if (i > 0) await f().locator('#add-cup').click();
        await f().locator(`[data-ingredient="${cup.base}"]`).click();
        if (cup.milk) await f().locator('[data-ingredient="milk"]').click();
        if (cup.temp === 'cold') await f().locator(`[data-ingredient="${cup.ice === false ? 'cold' : 'ice'}"]`).click();
        if (cup.sugar === true) await f().locator('[data-ingredient="sugar"]').click();
      }
    };
    let lastPid = null;
    for (let n = 1; n <= 12; n += 1) {
      const current = await until(
        async () => {
          if (await shown(f(), '#results')) return { done: true };
          const c = await f().evaluate(() => window.synkCafe.current);
          return c && c.presentationId !== lastPid ? c : null;
        },
        { timeout: 30000, what: `${n}번째 손님` },
      );
      if (current.done) break;
      lastPid = current.presentationId;
      const heard = await until(() => f().evaluate(() => window.synkCafe.current?.audioCompleted), { timeout: 15000, what: `${n}번째 주문 듣기` }).catch(() => false);
      if (!heard) {
        await f().locator('#listen').click().catch(() => {});
        await until(() => f().evaluate(() => window.synkCafe.current?.audioCompleted), { timeout: 15000, what: `${n}번째 주문 다시 듣기` }).catch(() => false);
      }
      const cups = await recipeOf(current.id);
      const wrong = n === 2;
      if (wrong) {
        await clear();
        await f().locator('#serve').click();
        await until(() => shown(f(), '#b-note'), { timeout: 8000, what: '다른 조건 안내' });
        await midShots(run);
      }
      await build(cups ?? []);
      await f().locator('#serve').click();
      plan.push({ n, order: current.id, wrong });
      await until(async () => (await shown(f(), '#results')) || (await f().evaluate(pid => window.synkCafe.current?.presentationId !== pid, current.presentationId)), { timeout: 15000, what: `${n}번째 서빙` });
    }
    await until(() => shown(f(), '#results'), { timeout: 20000, what: '결과 화면' });
    return { ended: true, plan };
  },

  // 한글 만나기(4-7): 첫 보기를 골라 맞고 틀림이 섞인다. 만나기 카드는 다음, 짝 맞추기는 짝이 맞을 때까지 카드를 차례로 본다.
  async 'hangul-stage'(run) {
    const f = run.frame;
    await until(() => shown(f(), '#start'), { timeout: 60000, what: '한글 입구' });
    await until(() => f().evaluate(() => !document.querySelector('#start').disabled), { timeout: 30000, what: '시작 단추' });
    await f().locator('#start').click();
    const plan = [];
    for (let guard = 0; guard < 60; guard += 1) {
      const kind = await until(
        () => f().evaluate(() => {
          const vis = s => { const n = document.querySelector(s); return !!n && !!n.getClientRects().length; };
          if (vis('#finish') || vis('#graduation')) return 'end';
          if (!vis('#session')) return null;
          if (document.querySelector('#stage .reason') || document.querySelector('#stage .meet')) return 'card';
          if (document.querySelector('#stage .opt.sound')) return 'see';
          if (document.querySelector('#stage .opt')) return 'listen';
          if (document.querySelector('#stage .pieces')) return 'build';
          if (document.querySelector('#stage .match')) return 'match';
          return null;
        }),
        { timeout: 30000, what: '다음 걸음' },
      );
      if (kind === 'end') break;
      const next = async () => { await until(() => shown(f(), '#dock .felt-cta:not([disabled])'), { timeout: 20000, what: '다음 단추' }); await f().locator('#dock .felt-cta').click(); };
      if (kind === 'card') { await sleep(600); await next(); await sleep(400); continue; }
      plan.push({ kind });
      await sleep(2500); // 소리가 끝까지 난 뒤에 답한다
      if (kind === 'listen') await f().locator('#stage .opt').first().click();
      else if (kind === 'see') { await f().locator('#stage .opt').first().click(); await sleep(1800); await next(); }
      else if (kind === 'build') { for (let i = 0; i < await f().locator('#stage .piece-row').count(); i += 1) await f().locator('#stage .piece-row').nth(i).locator('.piece').first().click(); await next(); }
      else for (let tries = 0; tries < 24 && !(await shown(f(), '#dock .felt-cta')); tries += 1) {
        const sound = f().locator('#stage .match .col').nth(0).locator('.card:not(:disabled)').first();
        const letters = f().locator('#stage .match .col').nth(1).locator('.card:not(:disabled)');
        await sound.click();
        await sleep(1800);
        await letters.nth(tries % Math.max(1, await letters.count())).click();
        await sleep(900);
      }
      if (!run.midDone) await midShots(run);
      await sleep(1500);
      if (await shown(f(), '#dock .felt-cta:not([disabled])')) await f().locator('#dock .felt-cta').click();
      await sleep(400);
    }
    await until(() => f().evaluate(() => ['#finish', '#graduation'].some(s => document.querySelector(s)?.getClientRects().length)), { timeout: 15000, what: '마무리 화면' });
    return { ended: true, plan };
  },

  async 'snap-words'(run) {
    const f = run.frame;
    await until(() => f().evaluate(() => !!window.__snap), { timeout: 60000, what: '찰칵 준비' });
    await sleep(1400);
    await f().locator('[data-go=start]').click();
    await until(() => f().evaluate(() => window.__snap.S.screen === 'shoot' && !window.__snap.S.busy && !document.querySelector('#msg').hidden), { timeout: 30000, what: '둘러보기' });
    await sleep(700);
    const focus = source => f().evaluate(s => window.__snap.focusOn(window.__snap.S.items.find(eval(s))), source);
    if (!(await shown(f(), '#msg .pill'))) {
      // 처음 온 사람: 세 장 둘러 찍은 뒤 부탁 단추가 나온다
      const picks = await f().evaluate(() => window.__snap.S.items.slice(0, 6).map(i => i.id));
      for (const id of picks.slice(0, 3)) {
        await focus(`(i)=>i.id===${JSON.stringify(id)}`);
        await sleep(800);
        await f().locator('#shutter').click();
        await sleep(900);
      }
      if (await shown(f(), '#step-back')) await f().locator('#step-back').click();
      await until(() => shown(f(), '#msg .pill'), { timeout: 10000, what: '부탁 단추' });
    }
    await f().locator('#msg .pill').click();
    await sleep(1200);
    const plan = [];
    let first = true;
    for (let g = 0; g < 8; g += 1) {
      const st = await f().evaluate(() => {
        const { S } = window.__snap;
        const m = S.missions[S.mi];
        return { phase: S.phase, mi: S.mi, kind: m?.kind, word: m?.word };
      });
      if (st.phase !== 'mission') break;
      if (first) {
        first = false;
        await focus(st.kind === 'word' ? "(i)=>i.kind==='plate'" : `(i)=>i.kind==='plate'&&i.word!==${JSON.stringify(st.word)}`);
        await sleep(700);
        await f().locator('#shutter').click();
        plan.push({ mission: st.mi, word: st.word, wrong: true });
        await sleep(1200);
        await midShots(run);
      }
      await f().evaluate(({ kind, word }) => {
        const { S } = window.__snap;
        window.__snap.focusOn(S.items.find(i => (kind === 'word' ? i.kind === 'thing' : i.kind === 'plate') && i.word === word));
      }, st);
      await sleep(700);
      await f().locator('#shutter').click();
      plan.push({ mission: st.mi, word: st.word, wrong: false });
      await until(() => f().evaluate(mi => window.__snap.S.mi !== mi || window.__snap.S.phase !== 'mission', st.mi), { timeout: 15000, what: `부탁 ${st.mi + 1}` });
      await sleep(300);
    }
    await until(() => f().evaluate(() => ['develop', 'result'].includes(window.__snap.S.screen)), { timeout: 15000, what: '인화' });
    for (let i = 0; i < 3; i += 1) {
      if (await f().evaluate(() => window.__snap.S.screen !== 'develop')) break;
      await until(() => f().evaluate(() => !!document.querySelector('.dev-opt:not([disabled])')), { timeout: 15000, what: `인화 ${i + 1}` });
      const right = await f().evaluate(() => window.__snap.answerNow());
      const count = await f().locator('.dev-opt').count();
      const wrong = i === 1;
      await f().locator('.dev-opt').nth(wrong ? (right + 1) % count : right).click();
      plan.push({ recall: i + 1, wrong });
      await sleep(1700);
    }
    await until(() => f().evaluate(() => window.__snap.S.screen === 'result'), { timeout: 15000, what: '결과 화면' });
    return { ended: true, plan };
  },

  async 'subway-rush'(run) {
    const f = run.frame;
    await until(() => f().evaluate(() => document.documentElement.hasAttribute('data-ready') || document.body.dataset.error), { timeout: 90000, what: '환승 러시 준비' });
    const error = await f().evaluate(() => document.body.dataset.error || null);
    if (error) throw new Error(`환승 러시를 열지 못함: ${error}`);
    await sleep(1200);
    await f().locator('#reader').click();
    const plan = [];
    let picks = 0;
    const started = Date.now();
    while (Date.now() - started < 400000) {
      await sleep(600);
      const st = await f().evaluate(() => ({ done: document.documentElement.dataset.done || '', err: document.body.dataset.error || '', zones: !document.getElementById('zones').hidden, replies: !document.getElementById('replies').hidden, voice: document.getElementById('voice-dialog')?.open === true }));
      if (st.err) throw new Error(`환승 러시 오류: ${st.err}`);
      if (st.voice) throw new Error('소리를 받지 못함(#voice-dialog)');
      if (st.done) break;
      if (st.replies) {
        await f().locator('#replies button').first().click();
        plan.push({ meet: true });
        await sleep(400);
        continue;
      }
      if (st.zones) {
        await sleep(400);
        const labels = await f().evaluate(() => [...document.querySelectorAll('#zones button')].map(b => b.getAttribute('aria-label')));
        const i = picks % 3;
        picks += 1;
        await f().locator('#zones button').nth(i).click();
        plan.push({ pick: picks, label: labels[i] });
        if (picks === 2) await midShots(run);
      }
    }
    await until(() => f().evaluate(() => document.documentElement.dataset.done === '1'), { timeout: 30000, what: '결과 화면' });
    await sleep(1500);
    return { ended: true, plan };
  },

  async 'talk-rally'(run) {
    const f = run.frame;
    await until(() => f().evaluate(() => /한 판/.test(document.querySelector('#btn-start')?.textContent ?? '')), { timeout: 60000, what: '시작 단추' });
    await sleep(600);
    await f().locator('#btn-start').click();
    const plan = [];
    let ball = 0;
    let lastWords = '';
    const started = Date.now();
    while (Date.now() - started < 240000) {
      if (await shown(f(), '#results')) break;
      if (await shown(f(), '#explain')) {
        await sleep(300);
        await f().locator('#btn-next').click();
        await sleep(500);
        continue;
      }
      const cards = await f().evaluate(() => ({
        locked: document.querySelector('#cards')?.classList.contains('locked') ?? true,
        hint: !!document.querySelector('#cards .card.hint'),
        words: [...document.querySelectorAll('#cards .card')].map(c => (c.getAttribute('aria-label') ?? '').replace(/^\d+번 대답:\s*/, '')),
      }));
      const key = cards.words.join('|');
      if (!cards.locked && cards.words.length && key !== lastWords) {
        if (cards.hint) {
          await f().locator('#cards .card.hint').click();
          lastWords = key;
          continue;
        }
        const answer = await f().evaluate(async words => {
          const { ITEMS } = await import('./content.mjs');
          const same = item => item.options?.length === words.length && words.every(w => item.options.includes(w));
          const item = ITEMS.find(same);
          return item ? (item.answer ?? item.options[0]) : null;
        }, cards.words);
        ball += 1;
        const right = Math.max(0, cards.words.indexOf(answer));
        const wrong = [3, 7].includes(ball);
        const lane = wrong ? (right + 1) % cards.words.length : right;
        await f().locator(`#cards .card[data-lane="${lane}"]`).click().catch(() => f().locator('#cards .card').nth(lane).click());
        plan.push({ ball, answer, chose: cards.words[lane], wrong });
        lastWords = key;
        if (ball === 3) await midShots(run);
      }
      await sleep(200);
    }
    await until(() => shown(f(), '#results'), { timeout: 20000, what: '결과 화면' });
    return { ended: true, plan };
  },

  async 'story-classroom'(run) {
    const page = run.page;
    const S = () => page.evaluate(() => window.__story.state());
    await until(() => page.evaluate(() => !!window.__story), { timeout: 60000, what: '이야기 교실 준비' });
    await sleep(800);
    const idle = () => until(async () => !(await S()).busy, { timeout: 10000, what: '움직임 끝' });
    const press = async selector => {
      await page.locator(selector).first().click();
      await sleep(120);
    };
    const readUntil = async phase => {
      for (let i = 0; i < 60; i += 1) {
        const s = await S();
        if (s.phase === phase && !s.busy) return s;
        await press('#dialogue-next');
      }
      throw new Error(`${phase}까지 넘기지 못함`);
    };
    const move = async (actor, object, destination) => {
      let s = await S();
      if (s.actor !== actor) await press(`[data-actor="${actor}"]`);
      s = await S();
      if (s.held !== object) await press(`[data-object="${object}"]`);
      await press(`[data-destination="${destination}"] > .name`);
      await sleep(100);
      await idle();
      return S();
    };
    await press('#start');
    await until(async () => (await S()).screen === 'game', { what: '이야기 시작' });
    await readUntil('play');
    const plan = [];
    await move('kkamong', 'paper', 'bin');
    plan.push({ mission: 'cleanup-paper', wrong: true });
    await midShots(run);
    await press('#undo');
    await idle();
    await press('[data-destination="drawer"] > .name');
    await idle();
    plan.push({ mission: 'cleanup-paper', wrong: false });
    await move('marin', 'snacks', 'box');
    await readUntil('play');
    await move('marin', 'flowers', 'table');
    await move('kkamong', 'letter', 'board');
    await readUntil('play');
    await move('kkamong', 'cake', 'table');
    await move('marin', 'ribbon', 'board');
    await readUntil('review');
    await move('kkamong', 'snacks', 'shelf');
    await move('marin', 'paper', 'box');
    await move('marin', 'cake', 'shelf');
    for (const id of ['cleanup-snacks', 'clue-flowers', 'clue-letter', 'surprise-cake', 'surprise-ribbon', 'review-snacks', 'review-paper', 'review-cake']) plan.push({ mission: id, wrong: false });
    await until(() => shown(page.mainFrame(), '#results'), { timeout: 15000, what: '결과 화면' });
    return { ended: true, plan };
  },

  async 'word-magic'(run) {
    const page = run.page;
    const S = () => page.evaluate(() => window.__wordMagic.state());
    const ready = () => until(() => page.evaluate(() => window.__wordMagic && !window.__wordMagic.state().busy), { timeout: 30000, what: '움직임 끝' });
    await until(() => page.evaluate(() => !!window.__wordMagic), { timeout: 60000, what: '낱말 마법 준비' });
    await ready();
    await page.click('#start');
    await until(async () => ['tutorial', 'puzzle', 'checkpoint'].includes((await S()).screen), { timeout: 30000, what: '첫 장면(소리 받기)' });
    const plan = [];
    let checks = 0;
    for (let guard = 0; guard < 40; guard += 1) {
      await ready();
      const s = await S();
      if (s.screen === 'ending') break;
      if (s.screen === 'tutorial') {
        const ids = await page.locator('#spells button').evaluateAll(nodes => nodes.map(n => n.dataset.spell));
        for (const id of ids) {
          await page.click(`[data-spell="${id}"]`);
          await ready();
        }
        await page.click('#next');
      } else if (s.screen === 'puzzle') {
        const moves = await page.evaluate(() => window.__wordMagic.solution());
        for (const move of moves) {
          await page.click(`[data-spell="${move.spell}"]`);
          await ready();
          await page.click(`[data-object="${move.objectId}"]`);
        }
        await ready();
        await page.click('#next');
      } else if (s.screen === 'checkpoint') {
        await until(() => page.evaluate(() => window.__wordMagic.state().heard && !window.__wordMagic.state().busy), { timeout: 20000, what: '확인 소리 끝' });
        await sleep(900);
        const check = (await S()).check;
        checks += 1;
        if (checks === 2) {
          const wrong = check.choices.find(x => x !== check.spell);
          await page.click(`[data-spell="${wrong}"]`);
          plan.push({ check: check.id, wrong: true });
          await midShots(run);
        }
        await page.click(`[data-spell="${check.spell}"]`);
        plan.push({ check: check.id, wrong: false });
        await ready();
        await page.click('#next');
      } else throw new Error(`모르는 화면 ${s.screen}`);
    }
    await until(async () => (await S()).screen === 'ending', { timeout: 15000, what: '장 끝 화면' });
    return { ended: true, plan };
  },
};

// ── WORLD 입장(현장노트 시험_화면확인 「리허설 WORLD 시험의 입장은 화면 상태를 보며 차례로 처리한다」) ───────────────
async function enterWorld(page, account) {
  await page.goto(`${BASE}/mobile.html?opening=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__synkWorld?.client, null, { timeout: 60000 });
  for (let i = 0; i < 160; i += 1) {
    const state = await page.evaluate(() => {
      const vis = s => [...document.querySelectorAll(s)].some(n => n.getClientRects().length > 0);
      const entry = document.querySelector('.world-shell')?.dataset.entry;
      if (vis('[data-lang-picker]')) return 'lang';
      if (vis('dialog[open] [data-world="device-records"][data-choice="keep"]')) return 'records';
      if (vis('dialog[open] [data-first-hangul="reads"]')) return 'hangul';
      if (vis('dialog[open] .tutor-option')) return 'tutor';
      if (vis('[data-world="guest"]')) return 'welcome';
      const signed = !!window.__synkWorld.client.snapshot;
      if (entry === 'ready' && !document.querySelector('dialog[open]')) return signed ? 'ready' : 'guest';
      return 'wait';
    });
    if (state === 'ready' || (state === 'guest' && account === 'guest')) return;
    if (state === 'lang') {
      await page.locator('[data-lang-choice="ko"]').click();
      await page.locator('[data-lang-confirm]').click();
    } else if (state === 'hangul') await page.locator('dialog[open] [data-first-hangul="reads"]').click();
    else if (state === 'records') await page.locator('dialog[open] [data-world="device-records"][data-choice="keep"]').click();
    else if (state === 'tutor') {
      await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').click();
      await page.locator('.tutor-primary').click();
      await page.locator('.tutor-primary[data-tutor-action="finish"]').click();
    } else if (state === 'welcome' && account === 'guest') await page.locator('[data-world="guest"]').click();
    else if (state === 'welcome' || state === 'guest') {
      await page.evaluate(button => {
        document.querySelector('#qa-login')?.remove();
        document.body.insertAdjacentHTML('beforeend', `<button data-world="${button}" id="qa-login" hidden></button>`);
        document.getElementById('qa-login').click();
      }, account);
      await page.waitForFunction(() => window.__synkWorld.client.snapshot !== null, null, { timeout: 60000 });
    }
    await sleep(300);
  }
  throw new Error('입장 단계가 끝나지 않았다');
}
// 놀이 패널을 연 채(실제 길 — 홈 「놀이」에서 카드를 누를 때처럼) 셸의 [data-world-game] 단추로 게임을 연다.
async function launchFromPanel(page, shellId) {
  const play = page.locator('[data-view="play"]').filter({ visible: true }).first();
  if (await play.count()) await play.click();
  else await page.evaluate(() => window.__synkHome.showPanel('놀이', '<p>놀이</p>', { type: 'world' }));
  await page.waitForFunction(() => document.querySelector('#world-panel, #panel')?.open === true, null, { timeout: 10000 });
  await page.evaluate(id => {
    document.querySelector('#qa-game')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<button data-world-game="${id}" id="qa-game" hidden></button>`);
    document.getElementById('qa-game').click();
  }, shellId);
}
// 셸의 게임 튜터가 띄우는 「조작 연습」(바람길 · 리듬 처음) · 조작법 창은 틀을 inert로 막는다 — 닫고(×) 게임 시작 화면으로 간다.
async function dismissTutor(page, wait = 6000) {
  const started = Date.now();
  while (Date.now() - started < wait) {
    for (const selector of ['.practice-exit', '.game-tutor-continue']) {
      const button = page.locator(selector).filter({ visible: true }).first();
      if (await button.count()) {
        await button.click().catch(() => {});
        await sleep(600);
        return selector;
      }
    }
    await sleep(300);
  }
  return null;
}
const frameOf = (page, game) => () => {
  const found = page.frames().find(fr => {
    try {
      return fr !== page.mainFrame() && new URL(fr.url()).pathname.startsWith(`/${game}/`);
    } catch {
      return false;
    }
  });
  if (!found) throw new Error('게임 틀이 없다');
  return found;
};

// 리허설 서버 trail: 이 판의 사건이 올라갔는지(올림 요청의 사건과 받은 번호) · 계정 요약.
async function trailSummary(page) {
  return page.evaluate(async () => {
    const client = window.__synkWorld.client;
    const headers = { 'X-Synk-Contract': '1', 'X-Synk-Product': 'world', ...(client.accessToken ? { Authorization: `Bearer ${client.accessToken}` } : {}), ...(client.tabId ? { 'X-Synk-Rehearsal-Tab': client.tabId } : {}) };
    const account = await fetch('/api/world/rehearsal/trail-account', { headers }).then(r => r.json()).catch(error => ({ error: String(error) }));
    const revision = account?.learning?.revision ?? account?.revision ?? null;
    if (revision == null) return { account, summary: null };
    const read = await fetch(`/api/world/rehearsal/trail?revision=${revision}`, { headers }).then(r => r.json()).catch(error => ({ error: String(error) }));
    return { revision, path: account?.learning?.path ?? null, trail: account?.trail ?? null, writes: account?.capabilities?.learningSync ?? null, summary: read?.summary ?? read };
  });
}
function uploadsOf(log, from, to) {
  return log.filter(e => e.kind === 'trail-post' && e.at >= from && e.at <= to);
}

async function escapeWhileWaiting(page, game, account, log, result) {
  // 붙잡은 요청은 Escape 뒤에 장면이 놓는다(시간으로 놓으면 페이지가 서는 동안 끝나 장면이 서지 않았다). 늦어도 limit 뒤에는 놓는다.
  const limit = Number(arg('hold-ms', 60000));
  const gets = [];
  let release;
  const gate = new Promise(resolve => (release = resolve));
  const holdLife = async route => {
    if (route.request().method() !== 'GET') return route.continue().catch(() => {});
    const row = { at: Date.now(), released: null };
    gets.push(row);
    await Promise.race([gate, sleep(limit)]);
    row.released = Date.now();
    return route.continue().catch(() => {});
  };
  const scene = (result.world.escapeWhileWaiting = { game, holdLimitMs: limit });
  const t0 = Date.now();
  const ofGame = e => {
    try {
      return new URL(e.text).pathname.startsWith(`/${game}/`);
    } catch {
      return false;
    }
  };
  try {
    // 입장은 생활 세션이 선 뒤에 끝난다 — 입장을 마친 뒤에 붙잡는다. 창으로 돌아옴(focus)은 패널이 닫혀 있을 때 계정 진도를 다시 읽어
    // 생활 세션을 새로 세운다(셸 refreshTutorAccount → life.refresh → reload). 그 진도 읽기를 붙잡은 사이에 게임을 연다.
    await enterWorld(page, account);
    await page.route('**/api/world/life-progress*', holdLife);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    scene.reloadHeld = await until(() => gets.length > 0, { timeout: 10000, what: '진도 다시 읽기' }).then(() => true, () => false);
    await launchFromPanel(page, SHELL_ID[game]);
    await sleep(800);
    scene.lifeHeldAtEscape = gets.some(r => r.released === null);
    scene.atEscape = await page.evaluate(() => ({ frame: !!document.querySelector('.game-frame'), panel: window.__synkHome?.openPanel?.() ?? null }));
    // 닫기 전환(160ms) 안에 진도 응답이 끝나야 셸의 gameLaunch가 아직 그대로다 — Escape 바로 뒤에 놓는다(4c 검수 GA3의 재현).
    const answered = [];
    const onResponse = response => { if (response.url().includes('/api/world/life-progress')) answered.push(Date.now()); };
    page.on('response', onResponse);
    await page.keyboard.press('Escape');
    const escapedAt = Date.now();
    release();
    await until(() => answered.length > 0, { timeout: 10000, what: '진도 응답' }).catch(() => false);
    page.off('response', onResponse);
    scene.answerAfterEscapeMs = answered.length ? answered[0] - escapedAt : null;
    await until(() => gets.every(r => r.released !== null), { timeout: 15000, what: '생활 진도 놓기' }).catch(() => false);
    await sleep(5000); // 셸이 기다림 뒤 차례를 마칠 때까지
    scene.after = await page.evaluate(() => ({
      frame: !!document.querySelector('.game-frame'),
      door: typeof window.SYNKAtlasGame?.open === 'function',
      panelOpen: document.querySelector('#world-panel, #panel')?.open === true,
      panel: window.__synkHome?.openPanel?.() ?? null,
    }));
    scene.gameRequestsAfterEscape = log.filter(e => e.kind === 'request' && e.at >= escapedAt && ofGame(e)).map(e => e.text).slice(0, 10);
  } catch (error) {
    scene.error = String(error?.message ?? error).split('\n')[0];
  } finally {
    release();
    scene.lifeGets = gets.map(r => ({ at: r.at - t0, released: r.released == null ? null : r.released - t0 }));
    await page.unroute('**/api/world/life-progress*', holdLife).catch(() => {});
  }
  // 장면이 섰고(붙잡은 동안 · 틀이 아직 없을 때 Escape, 응답이 닫기 전환 160ms 안), 놓은 뒤에도 틀 · 문 · 패널이 없고 그 게임 파일을 받지 않았다.
  scene.stood = scene.lifeHeldAtEscape === true && scene.atEscape?.frame === false && scene.answerAfterEscapeMs != null && scene.answerAfterEscapeMs < 160;
  scene.pass = scene.stood && !scene.error && scene.after?.frame === false && scene.after?.door === false && scene.after?.panelOpen === false && (scene.gameRequestsAfterEscape ?? []).length === 0;
  console.log(`Escape 장면(${game}): ${scene.pass ? '통과' : scene.stood ? '틀림 — 다시 열림' : '장면이 서지 않음'} ${JSON.stringify({ reload: scene.reloadHeld, held: scene.lifeHeldAtEscape, answerAfterEscapeMs: scene.answerAfterEscapeMs, gets: scene.lifeGets, atEscape: scene.atEscape, after: scene.after, requests: scene.gameRequestsAfterEscape?.length, error: scene.error })}`);
}

async function runWorld(browser, games, result) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  context.setDefaultTimeout(15000);
  const seeds = Object.assign({}, ...games.map(g => SEEDS[g] ?? {}));
  await context.addInitScript(spyScript, seeds);
  const used = [];
  await mediaFallback(context, new URL(BASE).origin, worldMedia, used);
  const page = await context.newPage();
  const log = [];
  watch(page, log);
  // 올린 사건(POST /api/world/rehearsal/trail)과 받은 번호
  page.on('response', async response => {
    if (response.request().method() !== 'POST' || !response.url().endsWith('/api/world/rehearsal/trail')) return;
    let sent = [];
    try {
      sent = response.request().postDataJSON()?.events ?? [];
    } catch {
      sent = [];
    }
    const body = await response.json().catch(() => null);
    log.push({ at: Date.now(), kind: 'trail-post', status: response.status(), sent: sent.map(e => ({ id: e.id, type: e.type, setId: e.setId ?? null, presentationId: e.presentationId ?? null })), accepted: body?.accepted?.length ?? 0, acceptedIds: (body?.accepted ?? []).map(row => row?.id ?? row), rejected: body?.rejected ?? null });
  });
  const account = flag('guest') ? 'guest' : arg('account', 'login-a');
  await enterWorld(page, account);
  result.world = { account, mediaFallback: used };

  // 닫힌 패널에서 게임을 열면(홈 「맞춤 연습 시작」 · ?drama=1처럼 패널 없이 launchGame을 부르는 길): 틀이 열리고 문이 서야 한다.
  {
    const id = SHELL_ID[games[0]];
    await page.evaluate(shellId => window.__synkHome.openLearningGame(shellId), id);
    const opened = await until(() => page.evaluate(() => !!document.querySelector('.game-frame')), { timeout: 15000, what: '닫힌 패널에서 연 틀' }).catch(() => false);
    result.world.closedPanelLaunch = await page.evaluate(() => ({ frame: document.querySelector('.game-frame')?.getAttribute('src') ?? null, door: typeof window.SYNKAtlasGame?.open === 'function', panelOpen: document.querySelector('#world-panel, #panel')?.open === true }));
    result.world.closedPanelLaunch.opened = Boolean(opened);
    if (result.world.closedPanelLaunch.panelOpen) {
      await page.locator('#panel-close').click().catch(() => page.keyboard.press('Escape'));
      await sleep(1500);
    }
  }
  // 놀이 목록에서 연 게임을, 셸이 문을 세우기 전(생활 세션을 기다리는 사이)에 Escape로 닫으면 게임이 다시 열리지 않는다(5-3 ② 넷째 검수 GA3 ·
  // 설계 주인 11-26). 생활 진도 요청(GET /api/world/life-progress)을 잠시 붙잡아 그 사이를 만든다. 붙잡은 동안 Escape를 눌렀는지도 적는다(장면이 섰는가).
  await escapeWhileWaiting(page, games[0], account, log, result);
  // --launch closed: 게임마다 패널이 닫힌 동네 화면에서 연다(openLearningGame). 기본은 놀이 패널을 연 채 연다.
  const launchClosed = arg('launch') === 'closed';

  for (const game of games) {
    const record = (result.games[game] = { path: 'world', account });
    const started = Date.now();
    const run = { game, page, frame: frameOf(page, game), shots: [], widths: {}, notes: [], midDone: false };
    try {
      await enterWorld(page, account); // 판마다 새 문서(앞 게임이 남긴 것이 없게)
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(() => (window.__qaOld = []));
      if (launchClosed) await page.evaluate(shellId => window.__synkHome.openLearningGame(shellId), SHELL_ID[game]);
      else await launchFromPanel(page, SHELL_ID[game]);
      await page.waitForSelector('.game-frame', { timeout: 30000 });
      await until(() => run.frame(), { timeout: 20000, what: '게임 틀' });
      record.frameSrc = await page.locator('.game-frame').getAttribute('src');
      record.doorAtOpen = await page.evaluate(() => typeof window.SYNKAtlasGame?.open === 'function');
      record.tutorClosed = await dismissTutor(page, ['korean-runner', 'korean-rhythm'].includes(game) ? 8000 : 1500);
      const doorCheck = setInterval(() => {
        page.evaluate(() => typeof window.SYNKAtlasGame?.open === 'function').then(v => (record.doorSeen = (record.doorSeen ?? true) && v)).catch(() => {});
      }, 3000);
      try {
        const played = await Promise.race([
          DRIVERS[game](run),
          sleep(LIMITS[game] ?? 240000).then(() => {
            throw new Error('판 시간 넘침');
          }),
        ]);
        record.ended = played.ended;
        record.plan = played.plan;
      } finally {
        clearInterval(doorCheck);
      }
      record.doorAtEnd = await page.evaluate(() => typeof window.SYNKAtlasGame?.open === 'function');
      await midShots(run, 'play'); // 판 가운데에서 못 찍었으면 여기서
      await sleep(1200);
      await shoot(run, 'end', 1440);
      await page.setViewportSize({ width: 390, height: 844 });
      await sleep(1000);
      await shoot(run, 'end', 390);
      await page.setViewportSize({ width: 1440, height: 900 });
    } catch (error) {
      record.error = String(error?.message ?? error).split('\n')[0];
      await shoot(run, 'fail', 1440).catch(() => {});
    }
    record.oldCreateGame = await page.evaluate(game => (window.__qaOld ?? []).filter(e => e.path.startsWith(`/${game}/`)), game).catch(() => null);
    await sleep(2500); // 마지막 답의 저장 · 올림
    // 패널을 닫으면 문을 치운다(§23-2 수명)
    await page.locator('#panel-close').click().catch(() => page.keyboard.press('Escape'));
    await sleep(2500);
    record.doorAfterClose = await page.evaluate(() => typeof window.SYNKAtlasGame?.open === 'function').catch(() => null);
    const ended = Date.now();
    const requests = log.filter(e => e.kind === 'request' && e.at >= started && e.at <= ended);
    record.requests = {
      newPathModule: requests.some(e => e.text.includes(`/${game}/atlas-next-play.mjs`)),
      oldBundle: requests.some(e => e.text.includes(`/${game}/atlas-learning.js`)),
      frameAtlasLoader: requests.some(e => !e.top && /\/atlas\/loader/.test(e.text)),
    };
    record.records = eventsOf(await readStores(page).catch(() => ({})), game, started);
    // 계정이면 이번 판의 기기 사건(제시 · 답 · 도움 · 전달)이 모두 서버에 받아들여질 때까지 정한 기한 안에서 기다린 뒤, 그때까지 온 올림 응답
    // 한 벌로 통계와 판정을 함께 낸다. 다른 판의 받아들임이나 같은 판의 거절된 사건으로 통과하지 않게 사건 번호로 맞춘다(4-7 검수 -b GA1 · GA2 · -c GA1 · GA2).
    const want = record.records.eventIds ?? [];
    const acceptedBy = list => new Set(list.flatMap(u => u.acceptedIds ?? []));
    if (account !== 'guest') await until(() => want.length && want.every(id => acceptedBy(uploadsOf(log, started, Infinity)).has(id)), { timeout: 20000, what: '이번 판 사건의 받아들임' }).catch(() => {});
    const uploads = uploadsOf(log, started, Date.now());
    const accepted = acceptedBy(uploads);
    const mine = new Set(want);
    const sent = uploads.flatMap(u => u.sent).filter(e => mine.has(e.id));
    record.uploaded = {
      posts: uploads.length,
      events: sent.length,
      presented: sent.filter(e => e.type === 'practice.presented').length,
      accepted: want.filter(id => accepted.has(id)).length,
      missing: want.filter(id => !accepted.has(id)).length,
      rejected: uploads.filter(u => u.rejected).map(u => u.rejected),
    };
    record.problems = problems(log, started, ended);
    record.shots = run.shots;
    record.widths = run.widths;
    record.notes = run.notes;
    record.seconds = Math.round((ended - started) / 1000);
    console.log(`${game}: ${record.error ? `실패 — ${record.error}` : '끝'} · 제시 ${record.records.presented} · 답 ${record.records.attempted} · ${record.seconds}초`);
    fs.writeFileSync(path.join(OUT, 'atlas-next-games-result.json'), JSON.stringify(result, null, 2));
  }
  result.world.trail = await trailSummary(page).catch(error => ({ error: String(error) }));
  // 접힌 요약에 그 게임의 문항이 들었는가(이름 또는 이번 판 문항 열쇠)
  const folded = JSON.stringify(result.world.trail?.summary ?? '');
  result.world.trailMentions = Object.fromEntries(games.map(g => [g, folded.includes(g) || (result.games[g]?.records?.items ?? []).some(key => folded.includes(key))]));
  result.world.trailSummaryKeys = Object.keys(result.world.trail?.summary ?? {});
  await context.close();
}

// ── 혼자 뜨는 두 게임(개발 깃발) ─────────────────────────────────────────────────────────
function startSolo(game, port) {
  const env = { ...process.env, ...(game === 'story-classroom' ? { SYNK_STORY_PORT: String(port) } : { PORT: String(port) }) };
  const child = spawn(process.execPath, [path.join(experiences, game, 'server.mjs')], { env, cwd: path.join(experiences, game), stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}
async function runSolo(browser, game, result) {
  const record = (result.games[game] = { path: 'solo' });
  const port = SOLO_PORTS[game];
  const child = startSolo(game, port);
  const origin = `http://localhost:${port}`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  context.setDefaultTimeout(15000);
  await context.addInitScript(spyScript, null);
  const atlasServed = [];
  if (ATLAS_OUT)
    await context.route(url => url.origin === origin && url.pathname.startsWith('/atlas/'), route => {
      const { pathname } = new URL(route.request().url());
      const file = path.join(ATLAS_OUT, ...pathname.split('/').filter(Boolean));
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      atlasServed.push(pathname);
      const type = /\.m?js$/.test(file) ? 'text/javascript; charset=utf-8' : file.endsWith('.json') ? 'application/json' : 'application/octet-stream';
      return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: type });
    });
  const used = [];
  await mediaFallback(context, origin, pathname => ({ worktree: path.join(experiences, game, ...pathname.split('/').filter(Boolean)), shared: path.join(MEDIA_ROOT, 'experiences', game, ...pathname.split('/').filter(Boolean)) }), used);
  const page = await context.newPage();
  const log = [];
  watch(page, log);
  const run = { game, page, frame: () => page.mainFrame(), shots: [], widths: {}, notes: [], midDone: false };
  const started = Date.now();
  try {
    await until(() => fetch(`http://127.0.0.1:${port}/`).then(r => r.ok), { timeout: 15000, what: `${game} 서버` });
    // 그 게임 서버가 /atlas/를 내는가(개발 깃발이 싣는 입구)
    record.serverServesAtlas = await fetch(`http://127.0.0.1:${port}/atlas/loader.js`).then(r => r.status).catch(() => null);
    const url = `${origin}/?atlas=next&qa${game === 'story-classroom' ? '&reading=1' : ''}`;
    record.url = url;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const played = await Promise.race([
      DRIVERS[game](run),
      sleep(240000).then(() => {
        throw new Error('판 시간 넘침');
      }),
    ]);
    record.ended = played.ended;
    record.plan = played.plan;
    await midShots(run, 'play');
    await sleep(1200);
    await shoot(run, 'end', 1440);
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(1000);
    await shoot(run, 'end', 390);
    await page.setViewportSize({ width: 1440, height: 900 });
  } catch (error) {
    record.error = String(error?.message ?? error).split('\n')[0];
    await shoot(run, 'fail', 1440).catch(() => {});
  }
  record.oldCreateGame = await page.evaluate(() => window.__qaOld ?? []).catch(() => null);
  if (game === 'story-classroom') record.learningStatus = await page.evaluate(() => window.__storyLearning?.status ?? null).catch(() => null);
  await sleep(2000);
  const ended = Date.now();
  const requests = log.filter(e => e.kind === 'request' && e.at >= started && e.at <= ended);
  record.requests = {
    newPathModule: requests.some(e => e.text.includes('/atlas-next-play.mjs')),
    atlasLoader: requests.some(e => /\/atlas\/loader\.js/.test(e.text)),
    atlasServedByHarness: atlasServed.length,
  };
  record.records = eventsOf(await readStores(page).catch(() => ({})), game, started);
  record.problems = problems(log, started, ended);
  record.mediaFallback = used;
  record.shots = run.shots;
  record.widths = run.widths;
  record.notes = run.notes;
  record.seconds = Math.round((ended - started) / 1000);
  console.log(`${game}: ${record.error ? `실패 — ${record.error}` : '끝'} · 제시 ${record.records.presented} · 답 ${record.records.attempted} · ${record.seconds}초`);
  await context.close();
  child.kill();
}

// ── 게임마다 1~6 판정 ───────────────────────────────────────────────────────────────
function verdicts(result) {
  for (const [game, r] of Object.entries(result.games)) {
    const v = r.records?.verdicts ?? {};
    const unknownProblems = (r.problems ?? []).filter(p => !p.known);
    const overflowFree = ['1440', '390'].every(w => Object.values(r.widths?.[w] ?? {}).every(o => !o?.top && !o?.frame));
    r.pass = {
      1: r.path === 'solo' ? 'n/a(문 없이 개발 깃발)' : r.doorAtOpen === true && r.doorSeen !== false,
      2: r.requests?.newPathModule === true && (r.oldCreateGame ?? []).length === 0,
      3: r.ended === true && (v.correct ?? 0) > 0 && (v.incorrect ?? 0) > 0,
      // 계정 실행은 이번 판의 기기 사건이 하나도 빠짐없이 서버 trail에 받아들여졌는지 번호로 본다(4-7 검수 GB4 · -b GA1 · -c GA1).
      4: (r.records?.presented ?? 0) > 0 && (r.records?.attempted ?? 0) > 0 && (r.path === 'solo' ? r.records.stores.includes('synk-atlas:guest') : r.account === 'guest' || (r.uploaded?.accepted > 0 && r.uploaded?.missing === 0)),
      5: unknownProblems.length === 0,
      6: Boolean(r.widths?.['1440'] && r.widths?.['390']) && overflowFree,
    };
  }
}

const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'msedge' : 'chrome',
  headless: !flag('headed'),
  args: ['--autoplay-policy=no-user-gesture-required', ...(arg('gl') === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'])],
});
const result = { checkedAt: new Date().toISOString(), base: BASE, out: OUT, games: {} };
try {
  const world = WORLD.filter(g => !ONLY || ONLY.includes(g));
  if (world.length) await runWorld(browser, world, result);
  for (const game of SOLO.filter(g => !ONLY || ONLY.includes(g))) await runSolo(browser, game, result);
} finally {
  verdicts(result);
  fs.writeFileSync(path.join(OUT, 'atlas-next-games-result.json'), JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.games).map(([g, r]) => [g, r.pass])), null, 1));
