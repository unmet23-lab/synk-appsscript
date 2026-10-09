'use strict';
// 해설 연출 — 게임마다 해설 목소리 한 명(하나·소진)을 정하고, 줄마다 보통/감정(smart)을 골라 tools/minigame-voice-casting.json에 적는다.
// 10-09 유호님 「감정이 재미있긴 한데 너무 오바인 것 같기도 하고. 니가 매번 판단해서 적합한 나레이션을 골라 줄 수 있어?
// 한 컨텐츠당 하나 OR 소진을 골라서 보통·감정 둘 중 하나를 쓰면 돼(두 명을 섞어 쓰지 말고)」.
// 감정(smart)은 칭찬·축하·위로·놀람·이야기 장면처럼 상황이 분명한 줄에만 쓰고, 낱말·문제·풀이·규칙 안내는 보통으로 둔다.
// smart의 앞뒤 글은 소리로 나오지 않고 감정을 읽는 데만 쓰이며 값에 들지 않는다(10-08 실측). 과장 없이 상황만 적는다.
//   node tools/미니게임_목소리_연출.cjs           → 바뀔 내용만 보여 준다
//   node tools/미니게임_목소리_연출.cjs --write   → 배역 파일에 적는다(같은 게임의 해설 줄별 설정은 새로 쓴다)
const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');
const V = require('./lib/미니게임목소리.cjs'), G = require('./lib/미니게임목소리_게임.cjs');

const HANA = { id: 'tc_61659cc118732016a95fe7c6', name: '하나', preview: 'https://static2.typecast.ai/c/audio_QA-approved_1761021415637/250929142725_61659cc118732016a95fe7c6_SSFM-V3_0.mp3',
  measure: '음높이 281Hz · 밝기 1433Hz · 억양 폭 17반음 · 빠르기 5.08 · 숏폼', why: '억양 폭이 가장 넓은 상큼한 목소리, 읽는 속도는 느긋하다' };
const SOJIN = { id: 'tc_666a9871abcf27a5169850d0', name: '소진', preview: 'https://static2.typecast.ai/c/audio_QA-approved_1761021415637/250929141735_666a9871abcf27a5169850d0_SSFM-V3_0.mp3',
  measure: '음높이 356Hz · 밝기 1547Hz · 억양 폭 12.6반음 · 빠르기 5.62 · 오디오북·라디오·광고', why: '높고 밝은 이야기꾼 목소리, 하나보다 15~30% 빨리 읽는다' };

// 게임(콘텐츠)마다 해설 한 명. 섞지 않는다.
const GAME_VOICE = {
  'korean-racing': [SOJIN, '달리는 게임이라 빨리 읽는 쪽 — 낱말 2,000개·풀이가 흐름을 붙잡지 않는다'],
  'story-classroom': [SOJIN, '이야기꾼(오디오북) 목소리 — 몽글(선하)보다 높아 해설과 몽글이 갈린다'],
  'talk-rally': [SOJIN, '안내 4.5초 한도에 여유가 있고, 몽글(선하)과 음높이가 갈린다'],
  'entry-check': [HANA, '읽는 게임이라 느긋하게(초급) — 손님 사고 이야기에 억양 폭이 산다'],
  'korean-rhythm': [HANA, '듣고 뜻을 가리는 문장이라 느긋하고 또렷하게'],
};

// 레이싱: 보상·응원 줄만 감정. 낱말·보기·문제·풀이·길 이름·고르기 안내는 보통.
const RACING = {
  intro: '레이스가 시작됐어요.',
  correct: '고른 길에 정답이 있었어요.',
  boost: '정답을 맞혀서 차가 빨라져요.',
  retry: '이번 문제는 틀렸어요. 정답을 알려 줬어요.',
  finish: '결승선을 지나 레이스를 끝까지 달렸어요.',
  'shield-ready': '세 문제를 이어서 맞혔어요.',
  'shield-block': '장애물에 부딪혔는데 보호막이 막아 줬어요.',
  'garage-earned': '오늘의 레이스를 마치고 보상을 받았어요.',
  'garage-wish': '레이스를 끝까지 달려 완주 보상을 받았어요.',
  'mission-complete': '오늘의 미션을 해냈어요.',
  'finale-unlock': '결승전을 통과했어요.',
  'tutorial-welcome': '레이싱을 처음 하는 친구가 들어왔어요.',
  'tutorial-right': '왼쪽으로 잘 움직였어요.',
  'tutorial-retry': '사과가 아닌 다른 길로 갔어요.',
  'tutorial-correct': '사과 쪽으로 가서 정답을 맞혔어요.',
  'tutorial-finish': '연습을 모두 마쳤어요.',
};
// 말 랠리: 결과·축하는 감정, 하루 도전 규칙 안내는 보통.
const RALLY = {
  intro: ['말 랠리를 시작해요.', '안녕하세요?'],
  'practice-done': ['연습 랠리를 마쳤어요.', ''],
  'daily-best': ['하루 도전이 끝났어요. 지금까지 가운데 가장 높은 기록이에요.', ''],
  'result-3': ['랠리가 끝났어요. 공을 하나도 놓치지 않았어요.', ''],
  'result-2': ['랠리가 끝났어요. 공을 거의 다 받아쳤어요.', ''],
  'result-1': ['랠리가 끝났어요. 공을 몇 개 놓쳤어요.', ''],
  'result-0': ['랠리가 끝났어요. 공을 거의 받아치지 못했어요.', ''],
};
// 입장 검사: 첫 근무 연수의 칭찬·놀람, 새 알림, 결과, 손님 사고 이야기는 감정. 규칙·화면 안내와 근무지 소개는 보통.
const ENTRY = {
  'nar-tut-guest': ['오늘 첫 근무를 시작했어요.', ''],
  'nar-tut-why': ['보리 씨를 통과시켰고, 맞는 판단이었어요.', ''],
  'nar-tut-tray': ['다음 손님 구리 씨가 짐을 보여 줬어요.', '안내문의 두 번째 규칙을 봐요. 음식은 가지고 들어갈 수 없어요.'],
  'nar-tut-why2': ['구리 씨를 거절하고 알맞은 이유를 골랐어요.', ''],
  'nar-memo': ['근무하는 중에 새 알림이 도착했어요.', ''],
  'nar-result-3': ['근무가 끝났어요. 놓친 손님이 한 명도 없어요.', ''],
  'nar-result-2': ['근무가 끝났어요. 거의 모든 손님을 바르게 맞이했어요.', ''],
  'nar-result-1': ['근무가 끝났어요. 몇 명은 놓쳤어요.', ''],
  'nar-result-0': ['근무가 끝났어요. 놓친 손님이 많았어요.', ''],
};
const importFile = file => import(pathToFileURL(file).href);

async function direction(repo = G.REPO) {
  const out = {};   // "게임/id" → [앞 글, 뒤 글]
  for (const [id, prev] of Object.entries(RACING)) out[`korean-racing/${id}`] = [prev, ''];
  for (const [id, pn] of Object.entries(RALLY)) out[`talk-rally/${id}`] = pn;
  for (const [id, pn] of Object.entries(ENTRY)) out[`entry-check/${id}`] = pn;
  // 손님 사고 이야기: 손님의 말과 무엇을 잘못했는지(들여보냄/거절)만 앞 글로.
  const { VENUES } = await importFile(path.join(G.gameDir('entry-check', repo), 'content.mjs'));
  for (const v of VENUES) for (const c of v.cases.filter(c => !c.textOnly && c.oops)) {
    out[`entry-check/nar-oops-${c.id}`] = [`손님이 말했어요. “${c.line}” ${c.answer === 'pass' ? '규칙을 다 지킨 손님인데 거절했어요.' : '규칙을 어긴 손님인데 그냥 들여보냈어요.'}`, ''];
  }
  // 이야기 교실: 해설 줄의 앞뒤 대사를 그대로.
  const story = JSON.parse(fs.readFileSync(path.join(G.gameDir('story-classroom', repo), 'assets', 'voice', 'jobs.json'), 'utf8')).lines;
  story.forEach((l, i) => { if (l.speaker === 'narrator') out[`story-classroom/${l.id}`] = [story[i - 1]?.text || '', story[i + 1]?.text || '']; });
  return out;
}

async function plan(repo = G.REPO) {
  const casting = V.loadCasting(path.join(repo, 'tools', 'minigame-voice-casting.json'));
  const smart = await direction(repo);
  const jobs = await V.allJobs({ casting, repo, games: Object.keys(GAME_VOICE) });
  const narrator = jobs.filter(j => j.role === 'narrator');
  const missing = Object.keys(smart).filter(k => !narrator.some(j => `${j.game}/${j.id}` === k));
  if (missing.length) throw Error('해설 줄에 없는 id: ' + missing.join(', '));
  // 기본값은 소진, 후보는 하나와 옛 해설(서현) 둘(배역마다 기본 + 후보 둘).
  const r = casting.roles.narrator, earlier = [r.voice, ...(r.alternates || [])].filter(v => ![HANA.id, SOJIN.id].includes(v.id));
  r.voice = SOJIN;
  r.alternates = [HANA, ...earlier.map(v => v.id === 'tc_69f2e455ea79fd197aa0476f' ? { ...v, why: '10-09까지의 해설 — 유호님 「힘 빠지는 목소리」로 하나·소진으로 바꿈' } : v)].slice(0, 2);
  r.fixed = '유호님이 고른 하나·소진(10-09 「한 컨텐츠당 하나 OR 소진, 두 명을 섞어 쓰지 말고」) — 게임마다 한 명(games), 줄마다 보통/감정은 Claude 판단(lines의 smart, tools/미니게임_목소리_연출.cjs)';
  r.character = '밝고 상큼한 해설 — 칭찬·위로·놀람·이야기 장면만 감정, 뜻을 전하는 줄은 보통';
  r.why = '10-09 유호님 「목소리가 힘 빠지는 목소리야. 다른 애로 바꿔, 상큼한 애로」 → 견본·게임 문장 들어 보기 → 「하나 또는 소진」. 게임마다 한 목소리: '
    + Object.entries(GAME_VOICE).map(([g, [v, why]]) => `${G.GAMES[g].label} ${v.name}(${why})`).join(' · ') + '. 다른 게임은 기본값 소진.';
  casting.games ||= {};
  for (const [g, [v]] of Object.entries(GAME_VOICE)) casting.games[g] = { ...(casting.games[g] || {}), narrator: { ...(casting.games[g]?.narrator || {}), voice: { id: v.id, name: v.name } } };
  casting.lines ||= {};
  for (const k of Object.keys(casting.lines)) if (k.split('/')[0] in GAME_VOICE && casting.lines[k].emotion === V.SMART && narrator.some(j => `${j.game}/${j.id}` === k)) delete casting.lines[k];
  for (const [k, [prev, next]] of Object.entries(smart)) casting.lines[k] = { ...(casting.lines[k] || {}), emotion: V.SMART, previousText: prev, nextText: next };
  if (!casting.note.includes('10-09')) casting.note += ' 10-09 해설은 하나·소진 가운데 게임마다 한 명(games), 칭찬·위로·놀람·이야기 줄만 감정 smart(lines, tools/미니게임_목소리_연출.cjs) — 나머지 배역·줄은 지금처럼 normal.';
  const after = await V.allJobs({ casting, repo, games: Object.keys(GAME_VOICE) });
  const summary = Object.keys(GAME_VOICE).map(g => {
    const mine = after.filter(j => j.game === g && j.role === 'narrator');
    return { game: g, voice: [...new Set(mine.map(j => j.voice.voice.name))].join('+'), lines: mine.length, smart: mine.filter(j => j.voice.emotion === V.SMART).length };
  });
  return { casting, summary, smart };
}

if (require.main === module) (async () => {
  const { casting, summary } = await plan();
  for (const s of summary) console.log(`${G.GAMES[s.game].label.padEnd(6)} 해설 ${s.voice} · ${s.lines}줄 가운데 감정 ${s.smart}줄`);
  if (process.argv.includes('--write')) { fs.writeFileSync(V.CASTING_FILE, JSON.stringify(casting, null, 2) + '\n'); console.log('적음: ' + path.relative(G.REPO, V.CASTING_FILE)); }
  else console.log('(보기만 — 적으려면 --write)');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { GAME_VOICE, HANA, SOJIN, direction, plan };
