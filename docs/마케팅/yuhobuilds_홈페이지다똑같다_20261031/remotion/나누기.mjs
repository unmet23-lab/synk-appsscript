// 한 번에 구운 범수 원고(../음성/범수/all.wav · all.json)를 받아쓰기 낱말 시각으로 줄마다 나눈다: node 나누기.mjs  (remotion 폴더에서)
// 줄마다 따로 구우면 억양이 줄마다 처음부터 시작한다(10-29 「AI티」, 현장 노트 영상 「타입캐스트 내레이션이 「AI티 심함」…」) —
// 그래서 원고 전체를 한 번에 읽히고, 낱말 사이 숨 자리 가운데에서 자른다. 자른 줄은 영상에서 원본 박자 자리에 하나씩 놓인다(src/y29/time.ts).
//   → ../음성/범수/<줄>.wav · <줄>.json(낱말 시각은 그 줄 처음 기준) · public/vo/<줄>.wav · src/y29/vo.generated.ts
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VOICE = path.join(HERE, '..', '음성', '범수');
// 원고는 두 번(all1 · all2)에 나눠 굽는다 — 333자 한 번은 Typecast가 22초부터 같은 구절을 되풀이했다(11-01 v8, 받아쓰기로 확인).
const TAKES = ['all1', 'all2'].map((id) => ({ id, ...JSON.parse(fs.readFileSync(path.join(VOICE, `${id}.json`), 'utf8')) }));

// 줄마다 그 줄의 첫 낱말 · 끝 낱말(받아쓰기 글에 들어 있는 말). 원고가 바뀌면 여기도 고친다.
export const SEGS = [
  ['s1', 'all1', '에이아이', '모양.'],
  ['s1b', 'all1', '물건', '바뀌어요.'],
  ['s2', 'all1', '먼저,', '했죠.'],
  ['s3a', 'all1', '확', '달라졌어요.'],
  ['s3b', 'all1', '그런데', '느낌.'],
  ['s4a', 'all1', '종이는', '했어요.'],
  ['s4b', 'all1', '이번엔', '금색.'],
  ['s4c', 'all1', '에이아이한테', '비슷해져요.'],
  ['s5a', 'all2', '그래서', '줬어요.'],
  ['s5b', 'all2', '세무사', '글씨로.'],
  ['s6', 'all2', '이번엔', '나왔어요.'],
  ['s7', 'all2', '하늘색', '필라테스.'],
  ['s8', 'all2', '물건은', '고르세요.'],
];

// 받아쓰기 낱말을 굽기마다 차례로 줄에 나눈다(첫 낱말부터 끝 낱말까지 순서대로 찾는다).
const out = {};
const cutsAll = [];
for (const take of TAKES) {
  const words = take.words.map((w) => ({ text: w.text, start: w.start, end: w.end }));
  const ranges = [];
  let i = 0;
  for (const [id, tk, first, last] of SEGS.filter((x) => x[1] === take.id)) {
    while (i < words.length && !words[i].text.includes(first)) i++;
    if (i >= words.length) throw Error(`첫 낱말을 못 찾음: ${id} 「${first}」(${tk})`);
    const a = i;
    while (i < words.length && !words[i].text.includes(last)) i++;
    if (i >= words.length) throw Error(`끝 낱말을 못 찾음: ${id} 「${last}」(${tk})`);
    ranges.push({ id, a, b: i });
    i++;
  }
  // 자르는 자리: 앞 줄 끝 낱말과 다음 줄 첫 낱말 사이 숨의 가운데(굽기의 첫 줄 앞 · 끝 줄 뒤는 0.06 · 0.12초 여유)
  const cuts = ranges.map((r, k) => {
    const s = k === 0 ? Math.max(0, words[r.a].start - 0.06) : (words[ranges[k - 1].b].end + words[r.a].start) / 2;
    const e = k === ranges.length - 1 ? Math.min(take.dur, words[r.b].end + 0.12) : (words[r.b].end + words[ranges[k + 1].a].start) / 2;
    return { ...r, s, e, take: take.id, words };
  });
  cutsAll.push(...cuts);
}

fs.mkdirSync(path.join(HERE, 'public', 'vo'), { recursive: true });
for (const c of cutsAll) {
  const len = c.e - c.s;
  const wav = path.join(VOICE, `${c.id}.wav`);
  // 숨 자리에서 자르므로 짧은 페이드(20ms)만 — 말소리를 깎지 않는다
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(VOICE, `${c.take}.wav`), '-af', `atrim=start=${c.s.toFixed(4)}:end=${c.e.toFixed(4)},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=${(len - 0.02).toFixed(4)}:d=0.02`, '-ar', '48000', '-c:a', 'pcm_s16le', wav]);
  const ws = c.words.slice(c.a, c.b + 1).map((w) => ({ text: w.text, start: +(w.start - c.s).toFixed(3), end: +(w.end - c.s).toFixed(3) }));
  fs.writeFileSync(path.join(VOICE, `${c.id}.json`), JSON.stringify({ id: c.id, from: `${c.take}.wav`, s: +c.s.toFixed(3), e: +c.e.toFixed(3), dur: +len.toFixed(3), words: ws }, null, 1));
  fs.copyFileSync(wav, path.join(HERE, 'public', 'vo', `${c.id}.wav`));
  out[c.id] = { dur: +len.toFixed(3), words: ws.map((w) => [w.text, w.start, w.end]) };
  console.log(`${c.id.padEnd(4)} ${c.take} ${c.s.toFixed(2)}→${c.e.toFixed(2)} (${len.toFixed(2)}초) ${ws.map((w) => w.text).join(' ')}`);
}
fs.writeFileSync(path.join(HERE, 'src', 'y29', 'vo.generated.ts'), `// node 나누기.mjs가 만든 파일. 고치지 말고 다시 만든다.
export const VOICE = ${JSON.stringify(out, null, 1)} as const;
`);
console.log(`굽기 ${TAKES.map((t) => `${t.id} ${t.dur.toFixed(2)}초`).join(' · ')} → ${cutsAll.length}줄`);
