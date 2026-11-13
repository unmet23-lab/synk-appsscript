#!/usr/bin/env node
'use strict';
/* 영상 세션 재기 — 영상 규칙이 실제로 읽히고 검사가 실제로 도는지를 Claude 세션 기록에서 센다(2026-11-10).
 *
 * 왜: 유호님 11-10 「지적했던 걸 까먹고 같은 실수를 반복 … 이 과정이 알아서 학습이 되고 있는 건지」. 그날 재 보니 규칙은 다 적혀 있는데 읽히지 않았다
 *   (11-07~10에 영상을 구운 세션 14개 가운데 지시문 틀을 읽은 세션 1개 · 굽기 제출 명령 115번 가운데 같은 문맥에서 지시문 검사가 돈 것 많아야 10번 · 세션마다 문맥 압축 1.5번).
 *   「반영됐다」를 말이 아니라 이 숫자로 본다 — 진단: docs/마케팅/제작양식/영상작업_진단_20261110.md, 입구: .claude/skills/synk-video/SKILL.md.
 *
 *   node tools/영상세션재기.js [--부터 2026-11-07] [--까지 2026-11-11] [--json] [--모두]
 *     --부터 · --까지: 세션이 시작한 날(한국 시각, 기본 부터 = 7일 전). --모두: 굽기 제출이 없는 영상 세션도 줄로 보인다.
 *
 * 읽는 것: %USERPROFILE%/.claude/projects/<이 저장소 · 그 워크트리>/*.jsonl — 읽기만 한다. 사람 말 · 도구 결과의 내용은 찍지 않고 수만 센다.
 * 세는 것(세션마다):
 *   압축    — 「This session is being continued from a previous conversation」로 문맥이 다시 시작된 횟수. 압축 앞에 읽은 규칙은 그 뒤 문맥에 없다.
 *   스킬    — synk-video 스킬을 부른 횟수(11-13부터 압축 뒤 훅 tools/압축뒤입구.js가 한 장을 넣은 것도 센다), 「압축뒤」는 압축 뒤 다시 부른 문맥 수 / 압축 수.
 *   읽음    — 지시문 틀(영상양식/지시문_틀.md · 옛 굽기 시트 47~61줄) · 제작 규칙 · 슬롭 점검표를 연 횟수.
 *   검사    — 컷연속성검사 · 꾸러미점검 · 편집전점검 · 사람움직임 · 미학맹검을 돌린 횟수.
 *   제출    — 크레딧내기 · 드리미나내기 `--실행` 명령 수. 「규칙」 = 그 문맥(마지막 압축 뒤) 안에 스킬 호출이나 지시문 틀 읽기가 있던 제출,
 *             「검사」 = 그 문맥 안에 컷연속성검사 · 꾸러미점검이 돈 제출(11-10부터는 내기 도구가 스스로 검사하므로 제출 = 검사다 — 이 칸은 그 전 기록과 견주려고 둔다),
 *             「무시」 = --걸림무시로 낸 제출.
 * 한계: 웹에서 손으로 낸 판(Flow · 힉스필드 웹)과 GPT가 낸 판은 기록에 없다. 같은 문맥이라는 것은 「그 검사가 그 판을 봤다」는 뜻까지는 아니다.
 *   검사 횟수는 명령 글에 도구 이름이 든 횟수라 그 파일을 읽기만 한 명령(grep · sed)도 센다 — 「많아야」로 읽는다.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const 인자 = process.argv.slice(2);
const 값 = (k, d) => (인자.includes(k) ? 인자[인자.indexOf(k) + 1] : d);
const 날 = s => new Date(`${s}T00:00:00+09:00`);
const 부터 = 인자.includes('--부터') ? 날(값('--부터')) : new Date(Date.now() - 7 * 864e5);
const 까지 = 인자.includes('--까지') ? 날(값('--까지')) : new Date(Date.now() + 864e5);
const JSON출력 = 인자.includes('--json');
const 모두 = 인자.includes('--모두');

const 뿌리 = path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'projects');
const 큰줄 = 300 * 1024; // 그림이 든 줄 — 우리가 세는 것은 여기에 없다
const 사이 = '[' + String.fromCharCode(92) + String.fromCharCode(92) + '/]';
const 틀읽기 = new RegExp('영상양식' + 사이 + '지시문_틀[.]md');
const 옛틀읽기 = new RegExp('시댄스무제한' + 사이 + 'README[.]md');
const 규칙읽기 = /AI광고영상_제작규칙[.]md/;
const 점검표읽기 = /광고영상_슬롭점검표[.]md/;
const 검사들 = { 컷연속성: /컷연속성검사[.]py/, 꾸러미점검: /꾸러미점검[.]py/, 편집전: /편집전점검[.]py|사람움직임[.]py/, 미학맹검: /미학맹검[.]js/ };
const 제출식 = /(드리미나내기[.]py|크레딧내기[.]py)[^\n]*--실행/;
const 영상낱말 = /드리미나내기|크레딧내기|dreamina-canvas|꾸러미|컷순서|컷표|시댄스|이미지지시문/;
const 압축식 = /^This session is being continued from a previous conversation/;
const 한국 = ts => new Date(new Date(ts).getTime() + 9 * 36e5).toISOString().slice(5, 16).replace('T', ' ');

async function 한세션(파일) {
  const 줄들 = readline.createInterface({ input: fs.createReadStream(파일, { encoding: 'utf8' }), crlfDelay: Infinity });
  const 일 = []; // {ts, 꼴, …}
  let 시작 = null, 끝 = null, 영상수 = 0;
  for await (const 줄 of 줄들) {
    if (!줄 || 줄[0] !== '{' || 줄.length > 큰줄) continue;
    let o;
    try { o = JSON.parse(줄); } catch { continue; }
    const ts = o.timestamp;
    if (ts) { if (!시작) 시작 = ts; 끝 = ts; }
    // 11-13 압축 뒤 훅(tools/압축뒤입구.js)이 한 장을 넣은 것도 「스킬을 다시 부름」으로 센다 — 하네스가 넣어 세션이 Skill을 부르지 않는다
    if (!o.isSidechain && o.type === 'attachment' && o.attachment && o.attachment.type === 'hook_additional_context' && 줄.includes('압축 뒤 영상 입구')) { 일.push({ ts, 꼴: '스킬' }); continue; }
    if (o.isSidechain || !o.message) continue;
    const c = o.message.content;
    if (o.type === 'user') {
      const 글 = typeof c === 'string' ? c : Array.isArray(c) ? c.filter(b => b && b.type === 'text').map(b => b.text).join('\n') : '';
      if (압축식.test(글.trim())) 일.push({ ts, 꼴: '압축' });
    } else if (o.type === 'assistant' && Array.isArray(c)) {
      for (const b of c) {
        if (!b || b.type !== 'tool_use' || !b.input) continue;
        const i = b.input;
        if (b.name === 'Skill' && /synk-video/.test(String(i.skill || ''))) 일.push({ ts, 꼴: '스킬' });
        if (b.name === 'Read' && i.file_path) {
          const f = String(i.file_path);
          const 처음 = Number(i.offset || 1), 줄수 = i.limit ? Number(i.limit) : null;
          if (틀읽기.test(f)) 일.push({ ts, 꼴: '틀' });
          else if (옛틀읽기.test(f) && 처음 <= 47 && (줄수 === null || 처음 + 줄수 > 47)) 일.push({ ts, 꼴: '틀' });
          else if (규칙읽기.test(f)) 일.push({ ts, 꼴: '규칙' });
          else if (점검표읽기.test(f)) 일.push({ ts, 꼴: '점검표' });
          if (영상낱말.test(f)) 영상수++;
        }
        const 명령 = String(i.command || '');
        if (명령) {
          if (영상낱말.test(명령)) 영상수++;
          for (const [이름, 식] of Object.entries(검사들)) if (식.test(명령)) 일.push({ ts, 꼴: '검사', 이름 });
          if (제출식.test(명령)) 일.push({ ts, 꼴: '제출', 무시: /--걸림무시/.test(명령) });
        }
      }
    }
  }
  if (!시작) return null;
  일.sort((a, b) => (a.ts < b.ts ? -1 : 1));
  const r = { 세션: path.basename(파일, '.jsonl').slice(0, 8), 시작, 끝, 영상수, 압축: 0, 스킬: 0, 압축뒤스킬: 0, 틀: 0, 규칙: 0, 점검표: 0, 검사: {}, 제출: 0, 제출_규칙: 0, 제출_검사: 0, 제출_무시: 0 };
  let 창 = { 규칙: false, 검사: false, 스킬: false }, 압축뒤 = false;
  for (const e of 일) {
    if (e.꼴 === '압축') { r.압축++; 창 = { 규칙: false, 검사: false, 스킬: false }; 압축뒤 = true; }
    else if (e.꼴 === '스킬') { r.스킬++; if (압축뒤 && !창.스킬) r.압축뒤스킬++; 창.스킬 = true; 창.규칙 = true; }
    else if (e.꼴 === '틀') { r.틀++; 창.규칙 = true; }
    else if (e.꼴 === '규칙') r.규칙++;
    else if (e.꼴 === '점검표') r.점검표++;
    else if (e.꼴 === '검사') { r.검사[e.이름] = (r.검사[e.이름] || 0) + 1; if (e.이름 === '컷연속성' || e.이름 === '꾸러미점검') 창.검사 = true; }
    else if (e.꼴 === '제출') { r.제출++; if (창.규칙) r.제출_규칙++; if (창.검사) r.제출_검사++; if (e.무시) r.제출_무시++; }
  }
  return r;
}

(async () => {
  if (!fs.existsSync(뿌리)) { console.error(`세션 기록 폴더가 없다: ${뿌리}`); process.exit(2); }
  const 파일들 = [];
  for (const d of fs.readdirSync(뿌리, { withFileTypes: true })) {
    if (!d.isDirectory() || !/SYNK-appsscript/i.test(d.name)) continue;
    const 폴더 = path.join(뿌리, d.name);
    for (const n of fs.readdirSync(폴더)) {
      if (!n.endsWith('.jsonl')) continue;
      const f = path.join(폴더, n);
      if (fs.statSync(f).mtime >= 부터) 파일들.push(f);
    }
  }
  const 줄 = [];
  for (const f of 파일들) {
    let r;
    try { r = await 한세션(f); } catch (e) { console.error(`못 읽음 ${path.basename(f)}: ${e.message}`); continue; }
    if (!r) continue;
    const 시 = new Date(r.시작);
    if (시 < 부터 || 시 >= 까지) continue;
    if (r.제출 === 0 && !(모두 && r.영상수 >= 5)) continue;
    줄.push(r);
  }
  줄.sort((a, b) => (a.시작 < b.시작 ? -1 : 1));
  const 합 = { 세션: 줄.length, 압축: 0, 스킬부른세션: 0, 틀읽은세션: 0, 압축뒤스킬: 0, 제출: 0, 제출_규칙: 0, 제출_검사: 0, 제출_무시: 0 };
  for (const r of 줄) {
    합.압축 += r.압축; 합.압축뒤스킬 += r.압축뒤스킬; 합.제출 += r.제출; 합.제출_규칙 += r.제출_규칙; 합.제출_검사 += r.제출_검사; 합.제출_무시 += r.제출_무시;
    if (r.스킬) 합.스킬부른세션++;
    if (r.틀) 합.틀읽은세션++;
  }
  if (JSON출력) { console.log(JSON.stringify({ 부터: 부터.toISOString(), 까지: 까지.toISOString(), 합, 줄 }, null, 1)); return; }
  console.log(`영상 세션 ${합.세션}개(${한국(부터)} ~ ${한국(까지)} 시작, 굽기 제출이 있는 세션${모두 ? ' + 영상 도구를 쓴 세션' : ''})`);
  for (const r of 줄) {
    const 검사 = Object.entries(r.검사).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음';
    console.log(`${r.세션} ${한국(r.시작)} · 압축 ${r.압축} · 스킬 ${r.스킬}(압축뒤 ${r.압축뒤스킬}/${r.압축}) · 읽음 틀 ${r.틀} 규칙 ${r.규칙} 점검표 ${r.점검표} · 검사 ${검사} · 제출 ${r.제출}(규칙 ${r.제출_규칙} · 검사 ${r.제출_검사} · 무시 ${r.제출_무시})`);
  }
  const 몫 = (a, b) => (b ? `${a}/${b}(${Math.round((a / b) * 100)}%)` : '0/0');
  console.log(`합: 스킬을 부른 세션 ${몫(합.스킬부른세션, 합.세션)} · 지시문 틀을 읽은 세션 ${몫(합.틀읽은세션, 합.세션)} · 압축 ${합.압축}번(세션마다 ${합.세션 ? (합.압축 / 합.세션).toFixed(1) : 0}) · 압축 뒤 스킬을 다시 부른 문맥 ${몫(합.압축뒤스킬, 합.압축)}`);
  console.log(`    굽기 제출 ${합.제출}번 — 같은 문맥에 스킬 · 지시문 틀 ${몫(합.제출_규칙, 합.제출)} · 같은 문맥에 지시문 검사 ${몫(합.제출_검사, 합.제출)} · 걸림무시 ${합.제출_무시}번`);
})();
