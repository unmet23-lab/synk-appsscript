#!/usr/bin/env node
/**
 * 「내부 시연본」 한 묶음을 만든다 — 영상 · 표지 · 대조 프레임 · 판정 쪽지.
 *
 * 🔑 왜 묶는가 — 영상 파일 하나만 드리면 유호님이 판정할 재료가 모자란다.
 *   표지가 따로 있다는 것도, 자막이 대본과 같은지도, 규격이 맞는지도 파일 하나로는 안 보인다.
 *   이 스크립트는 **판정에 필요한 것만** 한 폴더에 모은다.
 *
 * ⚠ 이것은 «발행»이 아니다. 발행 확정본은 `docs/홍보물/` 이 쥐고 그건 유호님이 직접 올리신다
 *   (그 폴더 README: 「발행은 유호님이 직접 하신다 — 외부 발행은 세션이 실행하지 않는다」).
 *   여기 산출물은 `영상/out/` 아래라 git 밖이고, 언제든 다시 만들어진다.
 *
 * 쓰기: node 영상/시연묶기.js <컴포지션id> <표지id> <대본md경로> <묶음이름>
 * 보기: node 영상/시연묶기.js clip-01-annyeong cover-01-annyeong \
 *         ".claude/skills/synk-content/references/리드크루클립/01_첫인사_자기소개.md" 01_안녕하세요
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const 방 = __dirname;
const 저장소 = path.resolve(방, '..');
const 산출방 = path.join(방, 'out');

const [컴포지션, 표지컴포지션, 대본상대, 묶음이름] = process.argv.slice(2);
if (!컴포지션 || !표지컴포지션 || !대본상대 || !묶음이름) {
  console.error('쓰기: node 영상/시연묶기.js <컴포지션id> <표지id> <대본md경로> <묶음이름>');
  process.exit(2);
}

const 묶음 = path.join(산출방, `시연_${묶음이름}`);
fs.mkdirSync(묶음, { recursive: true });

function 실행(명령, 인자들) {
  const r = spawnSync(명령, 인자들, { cwd: 저장소, encoding: 'utf8', shell: false });
  return { 종료: r.status, 로그: `${r.stdout || ''}\n${r.stderr || ''}` };
}

/* ── ① 영상을 굽는다(게이트를 지나서) ─────────────────────────────────── */
console.log('① 영상');
const 영상파일 = `${묶음이름}.mp4`;
const 구움 = 실행(process.execPath, [path.join(방, '굽기.js'), 컴포지션, 영상파일]);
process.stdout.write(구움.로그.split('\n').filter((l) => /✅|🔴|자산 모으기/.test(l)).join('\n') + '\n');
if (구움.종료 !== 0) {
  console.error('🔴 영상 굽기가 실패했다 — 묶음을 만들지 않는다.');
  process.exit(1);
}
fs.copyFileSync(path.join(산출방, 영상파일), path.join(묶음,영상파일));

/* ── ② 표지를 굽는다 ──────────────────────────────────────────────────── */
console.log('② 표지');
const 표지 = 실행('npx', ['remotion', 'still', 'src/index.ts', 표지컴포지션, `out/표지_${묶음이름}.png`]);
if (표지.종료 !== 0) {
  /* npx 는 shell 없이 못 부르는 기계가 있다 — 그때는 cmd 로 한 번 더 */
  const 재시도 = spawnSync(
    'npx',
    ['remotion', 'still', 'src/index.ts', 표지컴포지션, `out/표지_${묶음이름}.png`],
    { cwd: 방, encoding: 'utf8', shell: true },
  );
  if (재시도.status !== 0) {
    console.error('🔴 표지 굽기 실패:', (재시도.stderr || '').slice(0, 400));
    process.exit(1);
  }
}
const 표지원 = path.join(산출방, `표지_${묶음이름}.png`);
if (!fs.existsSync(표지원)) {
  console.error('🔴 표지 파일이 안 생겼다 — 종료코드만 보고 넘기지 않는다.');
  process.exit(1);
}
fs.copyFileSync(표지원, path.join(묶음, `표지.png`));

/* ── ③ 눈으로 볼 대조 프레임 ──────────────────────────────────────────── */
console.log('③ 대조 프레임');
실행(process.execPath, [path.join(방, '프레임뽑기.js'), 영상파일, '6']);
const 프레임원 = path.join(산출방, `${묶음이름}_프레임.png`);
if (fs.existsSync(프레임원)) fs.copyFileSync(프레임원, path.join(묶음, '프레임_여섯장.png'));

/* ── ④ 대본에서 «영상 밖으로 나가는 글»을 뽑는다 ──────────────────────── */
const 대본 = fs.readFileSync(path.join(저장소, 대본상대), 'utf8');
const 첫편 = 대본.split(/^## /m)[1] || 대본;
const 해시 = (첫편.match(/\*\*\[해시태그[^\]]*\]\*\*\s*\n([^\n]+)/) || [])[1] || '(대본에 없다)';
const 훅 = (첫편.match(/\*\*\[훅 자막\]\*\*[^\n]*\n>\s*([^\n]+)/) || [])[1] || '(대본에 없다)';
const 캡션 = (첫편.match(/\*\*\[캡션\]\*\*\s*\n([^\n]+)/) || [])[1] || null;

/* ── ⑤ 규격 실측 ──────────────────────────────────────────────────────── */
function ffprobe(인자들) {
  const r = spawnSync('ffprobe', 인자들, { encoding: 'utf8' });
  return (r.stdout || '').trim();
}
const 영상경로 = path.join(묶음, 영상파일);
const 규격 = ffprobe([
  '-v', 'error',
  '-show_entries', 'format=duration,size',
  '-show_entries', 'stream=width,height,codec_name,r_frame_rate',
  '-of', 'default=noprint_wrappers=1',
  영상경로,
]);
const 크기MB = (fs.statSync(영상경로).size / 1024 / 1024).toFixed(2);

/* ── ⑥ 판정 쪽지 ──────────────────────────────────────────────────────── */
const 쪽지 = `# 시연본 — ${묶음이름}

> ⚠ **내부 시연본이다. 아직 발행하지 않는다.**
> 이름 「몽글」이 대외 층(SNS·인쇄물·앱 화면)에 아직 못 나가는 상태라(synk-brand 「확정 ≠ 전파」 ·
> 말가이 원어민 검수 대기) 화면 어디에도 이름이 없다. 발행은 그 검수가 끝난 뒤 별건이다.

## 이 폴더에 있는 것

| 파일 | 무엇 | 어떻게 보나 |
|---|---|---|
| \`${영상파일}\` | 본편 | 그냥 재생 |
| \`표지.png\` | 썸네일 | ⚠ 올릴 때 **직접 지정**한다 — 안 하면 플랫폼이 첫 프레임(거의 빈 화면)을 쓴다 |
| \`프레임_여섯장.png\` | 장면 여섯을 한 장으로 | 한글·키릴이 네모칸(□□□)이 아닌지 **눈으로** |

## 영상 밖으로 함께 나가는 글

- **훅**: ${훅}
- **해시태그**: ${해시}
- **캡션**: ${캡션 || '🔴 대본 md 에 `[캡션]` 블록이 **없다** — synk-content SKILL.md §2 는 그 블록을 형식에 넣어 뒀는데 실제 대본 45편에는 안 적혀 있다. 올리기 전에 유호님이 한 줄 정하시거나, 대본 쪽을 먼저 채운다.'}

## 규격 실측

\`\`\`
${규격}
크기: ${크기MB} MB
\`\`\`

## ⚠ 이 편에서 «감수를 안 지난» 것

- 클로징 몽골어 \`Дууслаа — өчигдрийн би +1\` 은 **대본 md 에 없는 문장입니다** — 코드가 지어냈습니다.
  저장소 전수 검색 히트가 코드 그 한 줄뿐이고, 정본 대본의 클로징 행에는 몽골어 칸이 아예 없습니다.
  나머지 다섯 장면의 몽골어는 대본 md 그대로입니다. 이 한 줄은 말가이 검수 목록에 올립니다.
- 소리 배치를 정본(형제 저장소 \`SYNK-talk/lib/몽글목소리.js\`)대로 맞바꿨습니다 —
  「모오옹」(완료축하 전용·하루 한 번)이 «따라하기»에 있었고 «완료» 자리엔 앱 UI 알림음이 있었습니다.
  지금은 제자리입니다.

## 볼 때 이 다섯을 봐 주시면 됩니다

1. **읽히나** — 한국어가 어절로 끊겨 들어오는데 속도가 맞는지. 몽골어가 작지 않은지.
2. **몽글이 살아 있나** — 말은 안 하고 표정·몸짓만으로 반응한다. 그게 «무언의 선생님»으로 보이는지.
3. **길이** — 지금 30초다. 정본이 둘로 갈려 있다(synk-content 15~30초 / 제작가이드 30~40초).
4. **표지** — 피드에서 이 한 장이 손가락을 멈추게 하는지.
5. **소리** — 끝까지 깔림이 끊기지 않는지, 효과음이 깔림 «위에 떠 있지» 않고 안에 사는지.

## 다시 만들려면

\`\`\`bash
node 영상/시연묶기.js ${컴포지션} ${표지컴포지션} "${대본상대}" ${묶음이름}
\`\`\`
`;
fs.writeFileSync(path.join(묶음, '판정_쪽지.md'), 쪽지, 'utf8');

console.log(`\n✅ 시연 묶음 — ${path.relative(저장소, 묶음)}`);
for (const f of fs.readdirSync(묶음)) {
  const st = fs.statSync(path.join(묶음, f));
  console.log(`   · ${f}  (${(st.size / 1024).toFixed(0)} KB)`);
}
