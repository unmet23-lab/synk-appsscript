'use strict';
/* 1일 1편 편 폴더의 올릴 묶음(게시/준비.json)을 읽는다(2026-10-21). 읽기만 한다.
 *
 * tools/올리기전검사.js · tools/작업실예약.js · tools/예약큐.js가 같이 쓴다. 07시 예약 작업 셋이 남기는 준비.json은 편마다 모양이
 * 조금씩 다르다 — 경로가 저장소·편 폴더·게시 폴더 어디 기준인지, 게시글이 판별 원고.json·[제목] 칸 txt·md 코드 블록 중
 * 무엇인지, AI 표시·아동용·언어가 판에 있는지 편 머리에 있는지. 여기서 한 모양으로 맞춘다.
 *
 * 판 하나(plate)는 { account, platform, time, video:{path, exists, reduced, from}, cover, texts:{title, caption,
 * firstComment, pinnedComment, source}, language, audioLanguage, ai, kids }로 돌려준다. 못 찾은 칸은 null이다.
 * 판단(무엇이 빠지면 고칠 것인지)은 부르는 쪽이 한다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { 공용작업본 } = require('./공용작업본.js');

const TOOL_REPO = path.resolve(__dirname, '..', '..');
const VIDEO = /\.(mp4|mov|m4v|webm)$/i;
// 크롬 확장 10MB 한도 때문에 화질을 낮춘 사본(v2 §2-4 예외). 서버·API로 올리는 판에는 쓰지 않는다.
const REDUCED = /(?:^|[_-])(?:upload(?:_10MB)?|10MB|phone|휴대폰)(?=[_.-]|$)/i;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

// 편 폴더가 든 저장소(공용 작업본이든 워크트리든). docs/마케팅 위의 폴더다.
function repoOf(dir) {
  let cur = path.resolve(dir);
  for (;;) {
    if (fs.existsSync(path.join(cur, 'docs', '마케팅')) && fs.existsSync(path.join(cur, 'tools'))) return cur;
    const up = path.dirname(cur);
    if (up === cur) return TOOL_REPO;
    cur = up;
  }
}

function loadAccounts(repo) {
  for (const base of [repo, TOOL_REPO]) {
    const file = path.join(base, 'docs', '마케팅', 'sns-계정.json');
    if (fs.existsSync(file)) return readJson(file).accounts || {};
  }
  return {};
}

function load(dirArg) {
  const dir = path.resolve(dirArg);
  const file = path.join(dir, '게시', '준비.json');
  if (!fs.existsSync(file)) throw new Error(`게시/준비.json이 없습니다: ${dir}`);
  const repo = repoOf(dir);
  // git 밖 파일(영상 *.mp4는 .gitignore)은 편을 만든 공용 작업본에만 있다 — 예약 작업이 도는 운영 사본(tools/운영사본.js)이나 세션
  // 워크트리에서 읽어도 거기서 찾는다(10-22, 운영 사본에서 영상이 없어 작업실 등록이 0건이 되지 않게).
  const main = 공용작업본(repo);
  return { dir, name: path.basename(dir), repo, ...(main !== repo ? { mediaRoot: main } : {}), file, prep: readJson(file), accounts: loadAccounts(repo) };
}

// 준비.json 경로는 저장소·편 폴더·게시 폴더 기준이 섞여 있다. 있는 것을 먼저 고른다 — 이 작업본에 없으면 공용 작업본(mediaRoot)에서.
function resolve(bundle, p) {
  if (!p || typeof p !== 'string') return null;
  if (path.isAbsolute(p)) return p;
  const 편 = path.relative(bundle.repo, bundle.dir);
  const tries = [bundle.repo, ...(bundle.mediaRoot ? [bundle.mediaRoot] : [])]
    .flatMap((base) => [path.join(base, p), path.join(base, 편, p), path.join(base, 편, '게시', p)]);
  return tries.find((f) => fs.existsSync(f)) || tries[0];
}

// 저장소 기준 경로(검사 기록과 맞추는 열쇠). 공용 작업본에서 찾은 파일은 그 뿌리 기준이라 같은 글이 된다.
function rel(bundle, file) {
  if (!file) return null;
  const inside = (base) => { const r = path.relative(base, file); return Boolean(r) && !r.startsWith('..') && !path.isAbsolute(r); };
  const base = !inside(bundle.repo) && bundle.mediaRoot && inside(bundle.mediaRoot) ? bundle.mediaRoot : bundle.repo;
  return path.relative(base, file).split(path.sep).join('/');
}

// 「@yuhobuilds」·「https://www.instagram.com/yuhobuilds/」·「facebook.com/synkworld」를 모두 「yuhobuilds」·「synkworld」로 — 작업실 채널과 맞출 때 쓴다.
function handleOf(value) {
  return String(value || '').trim().toLowerCase().replace(/^(https?:\/\/)?(www\.|m\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\//, '').replace(/^@/, '').replace(/[/?#].*$/, '');
}

function platformOf(bundle, account) {
  const known = bundle.accounts[account]?.platform;
  if (known) return known;
  const m = String(account || '').match(/(youtube|instagram|facebook|tiktok|xiaohongshu|naverblog|tistory|threads|linkedin)$/);
  return m ? ({ naverblog: 'naver-blog' }[m[1]] || m[1]) : null;
}

// 화질 낮춘 사본만 적혀 있으면 같은 폴더의 원본 이름을 찾아본다(lock-a_upload ↔ lock-a_master, still-v6_upload ↔ still-v6_final, upload_10MB ↔ video).
function guessOriginal(file) {
  const dir = path.dirname(file), base = path.basename(file);
  const names = [base.replace(/_upload(?=\.)/i, '_master'), base.replace(/_upload(?=\.)/i, '_final'), base.replace(/_phone(?=\.)/i, '_final')];
  if (/^upload_10MB\./i.test(base)) names.push('video.mp4');
  return names.filter((n) => n !== base).map((n) => path.join(dir, n)).find((f) => fs.existsSync(f)) || null;
}

function plateVideo(bundle, plate) {
  const listed = resolve(bundle, plate.원본) || null;
  const file = resolve(bundle, plate.파일);
  if (listed) return { path: listed, exists: fs.existsSync(listed), reduced: REDUCED.test(path.basename(listed)), from: '원본' };
  if (!file || !VIDEO.test(file)) return null;
  if (!REDUCED.test(path.basename(file))) return { path: file, exists: fs.existsSync(file), reduced: false, from: '파일' };
  const guess = guessOriginal(file);
  return guess ? { path: guess, exists: true, reduced: false, from: '추정', listedReduced: file }
    : { path: file, exists: fs.existsSync(file), reduced: true, from: '파일' };
}

// 「켬(내레이션 AI 음성)」·「아님」·true 같은 값을 참·거짓으로. 모르면 null.
function yesNo(value) {
  if (typeof value === 'boolean') return value;
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (/^(켬|켜|예|네|있음|표시)/.test(s) || /^(true|yes|on|o)(?![a-z])/.test(s)) return true;
  if (/^(끔|꺼|아니|아님|없음|해당 없음)/.test(s) || /^(false|no|off|x)(?![a-z])/.test(s)) return false;
  return null;
}

// LAB 판별 txt: [제목]·[설명]·[고정 댓글]·[첫 댓글] 칸. 칸이 없으면 통째로 캡션이다.
function parseBracketText(text) {
  const parts = text.split(/^\[(제목|설명|설명란|캡션|본문|고정 댓글|고정댓글|첫 댓글|첫댓글)\]\s*$/m);
  if (parts.length < 3) return { caption: text.trim() || null };
  const out = {};
  for (let i = 1; i < parts.length; i += 2) {
    const label = parts[i].replace(/\s/g, ''), body = parts[i + 1].trim();
    if (label === '제목') out.title = body;
    else if (/설명|캡션|본문/.test(label)) out.caption = body;
    else if (label === '고정댓글') out.pinnedComment = body;
    else if (label === '첫댓글') out.firstComment = body;
  }
  return out;
}

const PLATFORM_WORDS = {
  instagram: /인스타|instagram|릴스|reels/i,
  youtube: /유튜브|youtube|쇼츠|shorts/i,
  facebook: /페이스북|facebook|페북/i,
  tiktok: /틱톡|tiktok/i,
  xiaohongshu: /샤오훙수|小红书|xiaohongshu|rednote/i,
};

// md 묶음(synkbrief README.md·yuhobuilds 게시글.md): 그 플랫폼 제목(#~###) 아래 **캡션**·**제목**·**설명란**·**첫 댓글**·**고정 댓글** 뒤 코드 블록.
function parseMarkdown(text, platform) {
  // 코드 블록(``` … ```) 안의 「# 주석」·「## 예시」 줄은 제목이 아니다 — 블록 구간을 먼저 찾아 그 안의 제목은 뺀다.
  const fences = [...text.matchAll(/^```[^\n]*\n[\s\S]*?\n```[ \t]*$/gm)].map((m) => [m.index, m.index + m[0].length]);
  const inFence = (at) => fences.some(([a, b]) => at > a && at < b);
  const heads = [...text.matchAll(/^(#{1,4})\s+(.+)$/gm)].filter((m) => !inFence(m.index)).map((m) => ({ level: m[1].length, title: m[2], at: m.index }));
  const word = PLATFORM_WORDS[platform];
  const head = word && heads.find((h) => h.level >= 2 && word.test(h.title) && !/한눈에|올릴 파일|시각|확인/.test(h.title));
  if (!head) return {};
  const next = heads.find((h) => h.at > head.at && h.level <= head.level);
  const section = text.slice(head.at, next ? next.at : text.length);
  const out = {};
  for (const m of section.matchAll(/^(?:\*\*([^*\n]+)\*\*|#{3,5}\s+([^\n]+))[^\n]*\n+```[^\n]*\n([\s\S]*?)\n```/gm)) {
    const label = (m[1] || m[2]).replace(/\s/g, ''), body = m[3].trim();
    if (/^제목/.test(label)) out.title ??= body;
    else if (/^(캡션|설명|본문|게시글)/.test(label)) out.caption ??= body;
    else if (/^첫댓글/.test(label)) out.firstComment ??= body;
    else if (/^고정댓글/.test(label)) out.pinnedComment ??= body;
  }
  return out;
}

// 판 원고(tools/sns-발행.js 묶음 형식의 원고.json)를 찾는다: 판에 적힌 「원고」, 아니면 게시글·파일과 같은 폴더의 원고.json(게시 폴더 바로 아래는 빼고).
function manuscriptFile(bundle, plate) {
  const listed = resolve(bundle, plate.원고);
  if (listed && fs.existsSync(listed)) return listed;
  const top = path.join(bundle.dir, '게시');
  for (const p of [plate.게시글, plate.파일, plate.원본]) {
    const f = resolve(bundle, p);
    if (!f) continue;
    const dir = path.dirname(f);
    if (path.resolve(dir) === path.resolve(top) || !dir.startsWith(path.resolve(bundle.dir))) continue;
    const m = path.join(dir, '원고.json');
    if (fs.existsSync(m)) return m;
  }
  return null;
}

function plateTexts(bundle, plate, platform) {
  const texts = { title: null, caption: null, firstComment: null, pinnedComment: null, source: [] };
  const take = (o, source) => {
    let used = false;
    for (const k of ['title', 'caption', 'firstComment', 'pinnedComment']) if (texts[k] == null && o[k]) { texts[k] = String(o[k]).trim(); used = true; }
    if (used) texts.source.push(source);
  };
  const ms = manuscriptFile(bundle, plate);
  let manuscript = null;
  if (ms) {
    manuscript = readJson(ms);
    take({ title: manuscript.title, caption: manuscript.caption, firstComment: manuscript.firstComment, pinnedComment: manuscript.pinnedComment }, rel(bundle, ms));
    const dir = path.dirname(ms);
    for (const [name, key] of [['제목.txt', 'title'], ['게시문안.txt', null], ['고정댓글.txt', 'pinnedComment']]) {
      const f = path.join(dir, name);
      if (!fs.existsSync(f)) continue;
      take(key ? { [key]: readText(f).trim() } : parseBracketText(readText(f)), rel(bundle, f));
    }
  }
  const post = resolve(bundle, plate.게시글);
  if (post && fs.existsSync(post) && !/\.(mp4|mov|png|jpe?g)$/i.test(post)) {
    const text = readText(post);
    take(/\.md$/i.test(post) ? parseMarkdown(text, platform) : parseBracketText(text), rel(bundle, post));
  }
  return { texts, manuscript, manuscriptFile: ms ? rel(bundle, ms) : null };
}

function plates(bundle) {
  const prep = bundle.prep;
  const brand = prep.브랜드;
  return (prep.판 || []).map((plate, index) => {
    const account = plate.계정 || null;
    const platform = platformOf(bundle, account);
    const blog = ['naver-blog', 'tistory'].includes(platform);
    const { texts, manuscript, manuscriptFile: msFile } = blog ? { texts: {}, manuscript: null, manuscriptFile: null } : plateTexts(bundle, plate, platform);
    const coverPath = resolve(bundle, plate.표지 || (prep.표지 && typeof prep.표지 === 'object' ? prep.표지[account] : prep.표지));
    const lang = plate.언어 || manuscript?.language || (platform === 'youtube' ? prep['유튜브 언어'] : null)
      || (['synkbrief', 'yuhobuilds'].includes(brand) && ['youtube', 'instagram'].includes(platform) ? 'ko' : null);
    const first = (...values) => values.find((v) => v !== undefined && v !== null);
    return {
      index, account, platform, blog, time: plate.시각 || null, raw: plate,
      video: blog ? null : plateVideo(bundle, plate),
      article: blog ? resolve(bundle, plate.파일 || plate.게시글) : null,
      cover: coverPath && fs.existsSync(coverPath) ? coverPath : null,
      texts, manuscriptFile: msFile,
      language: lang || null,
      audioLanguage: first(plate.말언어, plate.동영상언어, manuscript?.audioLanguage, lang) || null,
      ai: yesNo(first(plate.AI표시, plate['AI 표시'], prep['AI 표시'], prep.AI표시, manuscript?.alteredContent)),
      kids: yesNo(first(plate.아동용, prep.아동용, manuscript?.madeForKids, bundle.accounts[account]?.madeForKids)),
    };
  });
}

// 블로그·링크드인 원고는 맨 위 인용(>) 줄에 올리는 세션에게 남긴 메모를 두고 「**제목**」부터가 실제로 올라가는 글이다
// (tools/블로그붙여넣기.js와 같은 틀). 그 앞은 빼고 본다.
function articleText(text) {
  const at = text.search(/^\*\*제목\*\*\s*$/m);
  return at > -1 ? text.slice(at) : text;
}

// 편에 딸린 글(블로그·링크드인 원고) — 숫자 대조와 글 규칙에 쓴다. scheduled는 준비.json 판으로 올라가는 글인지.
function companionTexts(bundle) {
  const out = [];
  const add = (file, kind, scheduled) => { if (file && fs.existsSync(file) && !out.some((x) => x.file === file)) out.push({ file, kind, scheduled, text: articleText(readText(file)) }); };
  for (const plate of bundle.prep.판 || []) {
    const platform = platformOf(bundle, plate.계정);
    if (['naver-blog', 'tistory'].includes(platform)) add(resolve(bundle, plate.파일 || plate.게시글), '블로그', true);
  }
  for (const name of ['링크드인.md', 'linkedin.md']) add(path.join(bundle.dir, '게시', name), '링크드인', false);
  return out;
}

const SKIP_DIRS = new Set(['node_modules', 'out', 'public', '.git', 'build', 'dist']);
// 나레이션 대본: 편 폴더 안 vo*.json·나레이션*.json의 text 칸, 대본*.txt, 자막 .srt. 준비.json 「대본」이 있으면 그것만.
function scriptText(bundle) {
  const listed = bundle.prep.대본 ? [].concat(bundle.prep.대본).map((p) => resolve(bundle, p)).filter((f) => f && fs.existsSync(f)) : null;
  const files = listed || [];
  if (!listed) {
    const walk = (dir, depth) => {
      if (depth > 4) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) || (e.name === 'public' && depth < 3)) walk(f, depth + 1); continue; }
        if (/^(vo|나레이션|narration)[^/]*\.json$/i.test(e.name) || /^대본.*\.txt$/.test(e.name) || /\.srt$/i.test(e.name)) files.push(f);
      }
    };
    walk(bundle.dir, 0);
  }
  const texts = [];
  for (const f of files) {
    try {
      if (/\.json$/i.test(f)) {
        // 나레이션 계획은 text가 소리 나는 대로(「사십이 초」), show가 화면 자막이다 — show가 있으면 그것을 쓴다.
        const collect = (v) => {
          if (typeof v === 'string') return;
          if (Array.isArray(v)) { v.forEach(collect); return; }
          if (!v || typeof v !== 'object') return;
          if (typeof v.show === 'string') texts.push(v.show);
          for (const [k, x] of Object.entries(v)) {
            if (/^(text|글|대사|line)$/i.test(k) && typeof x === 'string') { if (typeof v.show !== 'string') texts.push(x); } else if (k !== 'show') collect(x);
          }
        };
        collect(readJson(f));
      } else texts.push(readText(f));
    } catch { /* 깨진 파일은 대본에서 뺀다 */ }
  }
  return { files: files.map((f) => rel(bundle, f)), text: texts.join('\n') };
}

module.exports = { load, plates, resolve, rel, repoOf, platformOf, handleOf, yesNo, parseBracketText, parseMarkdown, articleText, companionTexts, scriptText, readJson, readText, REDUCED, VIDEO };
