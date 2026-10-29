#!/usr/bin/env node
'use strict';
/**
 * .tmp 한 달 정리 목록 — 앱 예약 작업 synk-tmp-monthly-list(매달 1일 10:00)를 AI 없이 돌리는 판(2026-10-18).
 * 정해진 계산(14일 넘게 손대지 않은 폴더 찾기)이라 모델을 부르지 않는다(운영 원칙: 단순 확인은 AI 없는 조회·알림).
 * 결정의 정본은 docs/_ops/결정.md 「작업 방식 확정 · .tmp 운영」(10-17). 영구 삭제는 어떤 경우에도 하지 않는다.
 *
 * 10-21부터 앱 예약 작업이 이 도구로 목록을 만들고 옮긴다 — 예약은 보여 드리고 승인받는 대화만 맡는다.
 *
 *   node tools/tmp정리목록.js                    목록을 만들어 텔레그램으로 보내고 output/크레딧작업/tmp정리목록/ 에 남긴다
 *   node tools/tmp정리목록.js --보내지않기        화면에만 보여 준다(후보가 30개 넘으면 묶어서, --자세히면 하나씩)
 *   node tools/tmp정리목록.js --json             목록을 JSON으로(예약 작업이 읽는다)
 *   node tools/tmp정리목록.js --옮기기 a,b,c     유호님이 승인한 폴더만 C:\Users\q1212\SYNK_정리대기\<오늘>\ 로 옮긴다
 *   node tools/tmp정리목록.js --옮기기 --묶음 릴리스옛판|이사복사|14일|전부   승인한 묶음을 통째로 옮긴다
 *
 * 후보: ① 14일 넘게 손대지 않은 폴더 ② 릴리스·후보 사본(이름에 -release·-candidate)은 갈래마다 새 판 둘만 남기고 옛 판은
 * 날짜와 상관없이(10-21 유호님 확정). 둘 다 최근·남는 폴더가 경로로 끌어 쓰면 빼고, _보존.txt가 있거나 .tmp 맨 위
 * _정리제외.txt에 이름이 있으면 뺀다(그 폴더가 가리키는 옛 폴더도 남는다 — 10-29 회사 릴리스 계보).
 * 마지막 수정이 노트북 이사 복사 날(10-15~17)인 폴더는 따로 묶어 이름 속 날짜와 같이 보인다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const 저장소 = path.resolve(__dirname, '..');
const 기본 = {
  임시: path.join(저장소, '.tmp'),
  대기: path.join(os.homedir(), 'SYNK_정리대기'),
  기기: '83F5',
  일수: 14,
  남길판: 2, // 릴리스·후보 사본 갈래마다 남기는 새 판 수(10-21)
  // 10-15~17 노트북 이사 때 복사돼 마지막 수정 시각이 이 날짜로 바뀐 폴더가 많다 — 실제로는 더 오래된 것이라 따로 묶어 보인다.
  이사날: ['2026-10-15', '2026-10-16', '2026-10-17'],
};

function 기기모델() {
  const r = spawnSync('powershell', ['-NoProfile', '-Command', '(Get-CimInstance Win32_ComputerSystem).Model'], { encoding: 'utf8', windowsHide: true });
  return String(r.stdout || '').trim();
}

/** 링크(junction·심볼릭)는 따라 들어가지 않고, 가장 늦은 수정 시각·크기·파일 수를 모은다. */
function 훑기(폴더) {
  let 최신 = fs.lstatSync(폴더).mtimeMs, 크기 = 0, 파일 = 0;
  const 쌓기 = [폴더];
  while (쌓기.length) {
    const 지금 = 쌓기.pop();
    let 항목;
    try { 항목 = fs.readdirSync(지금, { withFileTypes: true }); } catch { continue; }
    for (const e of 항목) {
      const p = path.join(지금, e.name);
      let st;
      try { st = fs.lstatSync(p); } catch { continue; }
      if (st.mtimeMs > 최신) 최신 = st.mtimeMs;
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) 쌓기.push(p);
      else { 파일++; 크기 += st.size; }
    }
  }
  return { 최신, 크기, 파일 };
}

function git정보(폴더) {
  if (!fs.existsSync(path.join(폴더, '.git'))) return null;
  const 실행 = (args) => spawnSync('git', ['--no-optional-locks', '-C', 폴더, ...args], { encoding: 'utf8', windowsHide: true });
  const 상태 = 실행(['status', '--porcelain']);
  const 안올림 = 실행(['rev-list', '--count', 'HEAD', '--not', '--remotes']);
  return {
    미커밋: 상태.status === 0 ? String(상태.stdout).split(/\r?\n/).filter(Boolean).length : null,
    안올린커밋: 안올림.status === 0 ? Number(String(안올림.stdout).trim()) : null,
  };
}

// 코드와 설정·기록 json만 본다. 문서·로그·소스 사본은 경로를 적어도 도구를 깨뜨리지 않고, 읽기만 오래 걸린다.
// 회사 릴리스 기록 json은 수십~수백 KB라 1MiB까지 본다(10-29 — 64KB로 자르다 76KB 기록의 경로를 놓쳤다).
const 참조확장자 = new Map([['.cjs', 512 * 1024], ['.mjs', 512 * 1024], ['.js', 512 * 1024], ['.py', 512 * 1024], ['.ps1', 512 * 1024], ['.sh', 512 * 1024], ['.json', 1024 * 1024]]);
const 건너뛸폴더 = new Set(['node_modules', '.git', 'isolated-source', 'candidate', 'candidates', 'source', 'sources', 'snapshot', 'snapshots',
  'dist', 'build', 'out', 'payload', 'images', 'frames', 'media', 'renders', '__pycache__']);
// `../../옛폴더/…`·`.tmp/옛폴더/…`처럼 다른 .tmp 폴더를 가리키는 경로. 점으로 시작하는 이름(`..`)은 폴더 이름이 아니다.
// json 안의 Windows 경로는 역슬래시가 겹으로 적혀(`.tmp\\옛폴더\\…`) 구분자를 하나 이상으로 본다(10-29 회사 사슬 38이 놓친 꼴).
const 참조식 = /(?:(?:\.\.[\\/]+)+|\.tmp[\\/]+)([^.\\/'"`\s)\]][^\\/'"`\s)\]]*)/g;
// path.join(작업, '..', '옛폴더')처럼 따옴표 낱말로 잇는 앞 판(10-29).
const 이어붙인참조식 = /(['"`])\.\.\1\s*,\s*(['"`])([^.\\/'"`\s][^\\/'"`\s]*)\2/g;
// .tmp 맨 위의 이 파일에 적은 폴더(줄마다 이름 하나, # 뒤는 설명)는 _보존.txt처럼 남기고, 그 폴더가 가리키는 옛 폴더도 남긴다.
// 10-29 공간 정리가 회사 릴리스 계보를 옮겨 사슬 38 생성기가 MODULE_NOT_FOUND로 멈춘 뒤, 그 세션이 되돌린 폴더를 적었다.
const 제외파일 = '_정리제외.txt';
function 제외읽기(임시) {
  try { return new Set(fs.readFileSync(path.join(임시, 제외파일), 'utf8').split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)); }
  catch { return new Set(); }
}

/**
 * 주어진 폴더들의 코드·설정 파일에서 다른 .tmp 폴더를 가리키는 경로를 모은다(이름 → 가리킨 폴더들).
 * 10-19: 회사 서버 릴리스 도구가 10-11~14 폴더(서버 접속 고정 정보·도우미)를 경로로 끌어 써서,
 * 날짜만 보고 옮기면 최근 작업이 깨진다. 읽기만 하며 폴더마다·전체 파일 수에 상한을 둔다.
 */
function 참조모으기(임시, 폴더들, 이름들, 상한 = { 폴더당: 2000, 전체: 60000 }) {
  const 찾은 = new Map();
  let 전체 = 0;
  for (const 폴더 of 폴더들) {
    const 쌓기 = [path.join(임시, 폴더)];
    let 본파일 = 0;
    while (쌓기.length && 본파일 < 상한.폴더당 && 전체 < 상한.전체) {
      const 지금 = 쌓기.pop();
      let 항목;
      try { 항목 = fs.readdirSync(지금, { withFileTypes: true }); } catch { continue; }
      for (const e of 항목) {
        if (e.isSymbolicLink()) continue;
        const p = path.join(지금, e.name);
        if (e.isDirectory()) { if (!건너뛸폴더.has(e.name)) 쌓기.push(p); continue; }
        const 최대 = 참조확장자.get(path.extname(e.name).toLowerCase());
        if (!최대) continue;
        let 글;
        try { if (fs.statSync(p).size > 최대) continue; 글 = fs.readFileSync(p, 'utf8'); } catch { continue; }
        본파일++; 전체++;
        for (const 이름 of [...[...글.matchAll(참조식)].map((m) => m[1]), ...[...글.matchAll(이어붙인참조식)].map((m) => m[3])]) {
          if (이름 === 폴더 || !이름들.has(이름)) continue;
          if (!찾은.has(이름)) 찾은.set(이름, new Set());
          찾은.get(이름).add(폴더);
        }
      }
    }
  }
  return 찾은;
}

/* 릴리스·후보 사본의 갈래(10-21) — 「<갈래>-release…」·「<갈래>-candidate…」 이름 앞부분. 판은 이름 속 날짜와 -vN으로 가른다. */
function 갈래(이름) {
  const m = 이름.match(/^(.+?)[-_](release|candidate)(?=$|[-_.])/i);
  return m ? m[1].toLowerCase() : null;
}
function 이름날짜(이름) {
  const m = 이름.match(/(20\d{2})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
function 판번호(이름) {
  const m = 이름.match(/[-_]v(\d+)(?=$|[-_.])/i);
  return m ? Number(m[1]) : 1;
}
/** 묶어 보일 때 쓰는 이름 앞말(첫 낱말). */
function 앞말(이름) { return 이름.split(/[-_]/)[0].toLowerCase() || 이름; }
function 지역날짜(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const 새판먼저 = (a, b) => (이름날짜(b.이름) || 지역날짜(b.잰것.최신)).localeCompare(이름날짜(a.이름) || 지역날짜(a.잰것.최신))
  || 판번호(b.이름) - 판번호(a.이름) || b.잰것.최신 - a.잰것.최신 || b.이름.localeCompare(a.이름);

function 목록만들기(옵션 = {}) {
  const { 임시, 대기, 일수, 남길판, 이사날 } = { ...기본, ...옵션 };
  const 지금 = 옵션.지금 || Date.now();
  const 기준 = 지금 - 일수 * 24 * 60 * 60 * 1000;
  let 후보 = [];
  const 최근 = [];
  let 오래된파일 = 0, 오래된파일크기 = 0;
  const 폴더들 = [];
  const 제외 = 제외읽기(임시);
  for (const e of fs.existsSync(임시) ? fs.readdirSync(임시, { withFileTypes: true }) : []) {
    const p = path.join(임시, e.name);
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) continue;
    if (!st.isDirectory()) {
      if (st.mtimeMs < 기준) { 오래된파일++; 오래된파일크기 += st.size; }
      continue;
    }
    if (fs.existsSync(path.join(p, '_보존.txt')) || 제외.has(e.name)) { 최근.push(e.name); continue; }
    폴더들.push({ 이름: e.name, p, 잰것: 훑기(p) });
  }
  // 릴리스·후보 사본은 갈래마다 새 판 둘만 남기고, 그보다 옛 판은 14일이 안 됐어도 후보로 보인다(10-21 유호님 확정).
  const 갈래별 = new Map();
  for (const f of 폴더들) { const g = 갈래(f.이름); if (g) (갈래별.get(g) || 갈래별.set(g, []).get(g)).push(f); }
  const 옛판 = new Set();
  for (const 판들 of 갈래별.values()) for (const f of 판들.sort(새판먼저).slice(남길판)) 옛판.add(f.이름);
  for (const f of 폴더들) {
    const 오래됨 = f.잰것.최신 < 기준;
    if (!오래됨 && !옛판.has(f.이름)) { 최근.push(f.이름); continue; }
    const g = 갈래(f.이름);
    후보.push({
      이름: f.이름, MB: +(f.잰것.크기 / 1048576).toFixed(1), 파일: f.잰것.파일, 마지막: new Date(f.잰것.최신).toISOString().slice(0, 10), git: git정보(f.p),
      까닭: [...(오래됨 ? ['14일'] : []), ...(옛판.has(f.이름) ? ['릴리스옛판'] : [])],
      갈래: g || 앞말(f.이름), 릴리스: Boolean(g), 이사복사: 이사날.includes(지역날짜(f.잰것.최신)), 이름날짜: 이름날짜(f.이름),
    });
  }
  // 최근·보존 폴더가 끌어 쓰는 옛 폴더는 남긴다. 남긴 폴더가 다시 가리키는 폴더도 따라가며 남긴다.
  const 참조로남김 = [];
  let 볼곳 = 최근;
  while (볼곳.length && 후보.length) {
    const 찾은 = 참조모으기(임시, 볼곳, new Set(후보.map((c) => c.이름)));
    if (!찾은.size) break;
    for (const [이름, 가리킨] of 찾은) 참조로남김.push({ 이름, 가리킨: [...가리킨].sort() });
    후보 = 후보.filter((c) => !찾은.has(c.이름));
    볼곳 = [...찾은.keys()];
  }
  후보.sort((a, b) => b.MB - a.MB);
  참조로남김.sort((a, b) => a.이름.localeCompare(b.이름));
  let 대기폴더 = 0, 대기MB = 0;
  if (fs.existsSync(대기)) {
    for (const e of fs.readdirSync(대기, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      대기폴더++;
      대기MB += 훑기(path.join(대기, e.name)).크기 / 1048576;
    }
  }
  // 릴리스 갈래마다 남긴 새 판(보이기용) — 옛 판을 고를 때 무엇이 남는지 같이 보인다.
  const 남긴판 = {};
  for (const [g, 판들] of 갈래별) if (판들.some((f) => 옛판.has(f.이름) && 후보.some((c) => c.이름 === f.이름))) 남긴판[g] = 판들.slice(0, 남길판).map((f) => f.이름);
  return { 후보, 참조로남김, 남긴판, 오래된파일, 오래된파일MB: +(오래된파일크기 / 1048576).toFixed(1), 대기폴더, 대기MB: +대기MB.toFixed(1), 일수, 남길판, 이사날 };
}

/** 고르기 묶음 셋 — 릴리스 옛 판 · 이사 복사 시각 · 14일. 이름 목록을 돌려준다. */
function 묶음(목록, 이름) {
  const 고르기 = { 릴리스옛판: (c) => c.까닭.includes('릴리스옛판'), 이사복사: (c) => c.이사복사 && !c.릴리스, '14일': (c) => c.까닭.includes('14일'), 전부: () => true }[이름];
  if (!고르기) throw new Error(`모르는 묶음: ${이름} (릴리스옛판·이사복사·14일·전부)`);
  return 목록.후보.filter(고르기).map((c) => c.이름);
}

const MB합 = (cs) => +cs.reduce((a, c) => a + c.MB, 0).toFixed(1);
const 크기글 = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${mb}MB`);

function 글로(목록, 옵션 = {}) {
  const 열넷 = 목록.후보.filter((c) => (c.까닭 || ['14일']).includes('14일'));
  const 옛판들 = 목록.후보.filter((c) => (c.까닭 || []).includes('릴리스옛판'));
  const 줄 = [`[.tmp 한 달 정리] ${목록.일수}일 넘게 손대지 않은 폴더 ${열넷.length}개` + (옛판들.length ? ` · 릴리스·후보 사본의 옛 판 ${옛판들.length}개` : '') + (목록.후보.length ? ` — 합계 ${크기글(MB합(목록.후보))}` : '')];
  if (!목록.후보.length) 줄.push('이번 달 정리할 폴더 없음');
  const 한줄 = (c) => {
    const g = c.git ? ` · git(미커밋 ${c.git.미커밋 ?? '?'} · 안 올린 커밋 ${c.git.안올린커밋 ?? '?'})` : '';
    const 이사 = c.이사복사 ? ` · 이사 복사 시각${c.이름날짜 ? `(이름 날짜 ${c.이름날짜})` : ''}` : '';
    return `- ${c.이름} · ${c.MB}MB · ${c.파일}개 · 마지막 ${c.마지막}${이사}${g}`;
  };
  // 후보가 적으면 하나씩, 많으면(30개 넘게) 묶어서 보인다 — 텔레그램 한 통·한 화면에 들어가게.
  const 묶어보기 = 옵션.자세히 !== true && 목록.후보.length > 30;
  const 릴리스 = 목록.후보.filter((c) => c.릴리스);
  if (릴리스.length) {
    줄.push(`① 릴리스·후보 사본 ${릴리스.length}개 · ${크기글(MB합(릴리스))}` + (옛판들.length ? ` — 갈래마다 새 판 ${목록.남길판 ?? 2}개만 남기면 옛 판 ${옛판들.length}개 · ${크기글(MB합(옛판들))}` : ''));
    const 갈래들 = new Map();
    for (const c of 릴리스) (갈래들.get(c.갈래) || 갈래들.set(c.갈래, []).get(c.갈래)).push(c);
    const 접을것 = [];
    for (const [g, cs] of [...갈래들].sort((a, b) => MB합(b[1]) - MB합(a[1]))) {
      const 남김 = 목록.남긴판?.[g];
      // 묶어 볼 때는 옛 판이 있거나 10MB 넘는 갈래만 한 줄씩, 나머지 한 판짜리 작은 사본은 한 줄로 접는다.
      if (묶어보기 && !남김 && MB합(cs) < 10) { 접을것.push(...cs); continue; }
      줄.push(`  · ${g}: ${cs.length}개 · ${크기글(MB합(cs))}${남김 ? ` (남기는 새 판: ${남김.join(', ')})` : ''}`);
      if (!묶어보기) for (const c of cs) 줄.push('  ' + 한줄(c));
    }
    if (접을것.length) 줄.push(`  · 그 밖의 작은 사본 ${접을것.length}개 · ${크기글(MB합(접을것))} (예: ${접을것.slice(0, 3).map((c) => c.이름).join(', ')}${접을것.length > 3 ? ' …' : ''})`);
  }
  const 나머지 = 목록.후보.filter((c) => !c.릴리스);
  const 이사 = 나머지.filter((c) => c.이사복사);
  if (이사.length) {
    const 날짜들 = 이사.map((c) => c.이름날짜).filter(Boolean).sort();
    줄.push(`② 마지막 수정이 노트북 이사 복사 날(${(목록.이사날 || []).join('·')})인 폴더 ${이사.length}개 · ${크기글(MB합(이사))}` + (날짜들.length ? ` — 이름 속 날짜로는 ${날짜들[0]} ~ ${날짜들[날짜들.length - 1]}` : ''));
  }
  if (나머지.length) {
    if (묶어보기) {
      줄.push(`③ 그 밖의 폴더 ${나머지.length}개 · ${크기글(MB합(나머지))} — 이름 앞말로 묶음`);
      const 앞말들 = new Map();
      for (const c of 나머지) (앞말들.get(c.갈래) || 앞말들.set(c.갈래, []).get(c.갈래)).push(c);
      const 차례 = [...앞말들].sort((a, b) => MB합(b[1]) - MB합(a[1]));
      for (const [g, cs] of 차례.slice(0, 12)) {
        const git있음 = cs.filter((c) => c.git && (c.git.미커밋 || c.git.안올린커밋)).length;
        줄.push(`  · ${g}: ${cs.length}개 · ${크기글(MB합(cs))} (예: ${cs.slice(0, 3).map((c) => c.이름).join(', ')}${cs.length > 3 ? ' …' : ''})${git있음 ? ` · git 미커밋·안 올린 커밋 있는 사본 ${git있음}개` : ''}`);
      }
      const 남은갈래 = 차례.slice(12);
      if (남은갈래.length) {
        const cs = 남은갈래.flatMap(([, x]) => x);
        const git있음 = cs.filter((c) => c.git && (c.git.미커밋 || c.git.안올린커밋)).length;
        줄.push(`  · 그 밖의 앞말 ${남은갈래.length}갈래 · ${cs.length}개 · ${크기글(MB합(cs))} (예: ${남은갈래.slice(0, 4).map(([g]) => g).join(', ')} …)${git있음 ? ` · git 미커밋·안 올린 커밋 있는 사본 ${git있음}개` : ''}`);
      }
    } else for (const c of 나머지) 줄.push(한줄(c));
  }
  if (목록.참조로남김?.length) 줄.push(`오래됐지만 최근 작업이 경로로 끌어 써서 목록에서 뺀 폴더 ${목록.참조로남김.length}개: ${목록.참조로남김.slice(0, 8).map((x) => x.이름).join(', ')}${목록.참조로남김.length > 8 ? ' 외' : ''}`);
  if (목록.오래된파일) 줄.push(`맨 위 파일 중 ${목록.일수}일 넘은 것 ${목록.오래된파일}개 · ${목록.오래된파일MB}MB`);
  if (목록.대기폴더) 줄.push(`정리 대기(C:\\Users\\q1212\\SYNK_정리대기)에 지난 폴더 ${목록.대기폴더}개 · ${목록.대기MB}MB — 확인이 끝났으면 직접 지우시면 돼요.`);
  if (목록.후보.length) {
    const 고를것 = [옛판들.length ? '「릴리스 옛 판 정리」' : null, 이사.length ? '「이사 사본 일괄」' : null, '「하나씩 고르기(전부·일부·없음)」'].filter(Boolean);
    줄.push(`정리할 폴더를 알려 주세요 — ${고를것.join(' · ')}. git 사본 중 미커밋·안 올린 커밋이 있는 폴더는 한 번 더 확인할게요.`);
    줄.push('승인하신 폴더만 정리 대기 폴더로 옮기고(이름만 바뀌는 이동), 지우지는 않아요.');
  }
  return 줄.join('\n');
}

function 옮기기(이름들, 옵션 = {}) {
  const { 임시, 대기 } = { ...기본, ...옵션 };
  const 지금목록 = new Set(목록만들기(옵션).후보.map((c) => c.이름));
  const 날 = new Date(옵션.지금 || Date.now());
  const 오늘 = `${날.getFullYear()}${String(날.getMonth() + 1).padStart(2, '0')}${String(날.getDate()).padStart(2, '0')}`;
  const 목적 = path.join(대기, 오늘);
  const 결과 = { 옮김: [], 남김: [] };
  for (const 이름 of 이름들) {
    if (!지금목록.has(이름) || 이름.includes('/') || 이름.includes('\\') || 이름 === '..') { 결과.남김.push({ 이름, 이유: '지금 후보가 아님' }); continue; }
    fs.mkdirSync(목적, { recursive: true });
    try { fs.renameSync(path.join(임시, 이름), path.join(목적, 이름)); 결과.옮김.push(이름); }
    catch (e) { 결과.남김.push({ 이름, 이유: e.code || e.message }); }
  }
  return { ...결과, 위치: 목적 };
}

module.exports = { 목록만들기, 글로, 옮기기, 묶음, 훑기, 참조모으기, 갈래 };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const 모델 = 기기모델();
  if (모델 !== 기본.기기) {
    console.error(`이 PC(${모델 || '모름'})는 새 노트북(${기본.기기})이 아니라서 아무것도 하지 않았다.`);
    process.exitCode = 2;
  } else if (argv[0] === '--옮기기') {
    const 묶음자리 = argv.indexOf('--묶음');
    let 이름들;
    try {
      이름들 = 묶음자리 >= 0
        ? String(argv[묶음자리 + 1] || '').split(',').flatMap((m) => 묶음(목록만들기(), m.trim()))
        : String(argv[1] || '').split(',').map((s) => s.trim()).filter(Boolean);
    } catch (e) { console.error(`${e.message} — 아무것도 옮기지 않았다.`); process.exit(1); }
    const r = 옮기기([...new Set(이름들)]);
    console.log(`옮긴 폴더 ${r.옮김.length}개 → ${r.위치}${r.남김.length ? `\n남긴 것: ${r.남김.map((x) => `${x.이름}(${x.이유})`).join(', ')}` : ''}`);
  } else if (argv.includes('--json')) {
    console.log(JSON.stringify(목록만들기(), null, 1));
  } else {
    const 글 = 글로(목록만들기(), { 자세히: argv.includes('--자세히') });
    console.log(글);
    const 방 = path.join(저장소, 'output', '크레딧작업', 'tmp정리목록');
    fs.mkdirSync(방, { recursive: true });
    fs.writeFileSync(path.join(방, `${new Date().toISOString().slice(0, 10)}.md`), 글 + '\n');
    if (!argv.includes('--보내지않기')) require('./크레딧실행.js').텔레그램보내기(글);
  }
}
