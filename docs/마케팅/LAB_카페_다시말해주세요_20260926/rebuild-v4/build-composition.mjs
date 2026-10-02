import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.dirname(fileURLToPath(import.meta.url));
const parent = path.dirname(project);
const assets = path.join(project, 'assets');
const compositions = path.join(project, 'compositions');
fs.mkdirSync(assets, { recursive: true });
fs.mkdirSync(compositions, { recursive: true });
for (const file of ['SUIT-Variable.woff2', 'gsap.min.js', 'lab-logo.png']) {
  fs.copyFileSync(path.join(parent, 'rebuild-v3', 'assets', file), path.join(assets, file));
}
const sourceName = 'test-09-age-match-cafe.mp4';
fs.copyFileSync(path.join(parent, 'google-vids', sourceName), path.join(assets, sourceName));
const fps = 24;
const scenes = [
  { id: 'dialogue', label: '카페 대화', startFrame: 0, durationFrames: 240, sourceStartFrame: 0 },
  { id: 'repeat', label: '핵심 문장 다시 듣기', startFrame: 240, durationFrames: 56, sourceStartFrame: 0 },
  { id: 'practice', label: '직접 말하기', startFrame: 296, durationFrames: 69, sourceStartFrame: 171 },
];
const duration = 365 / fps;
const escape = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const clip = (id, start, length, body, className, track = 3) => `<div id="${id}" class="clip ${className}" data-start="${start}" data-duration="${length}" data-track-index="${track}">${body}</div>`;
const captions = [
  { id: 'say-again', start: 0, end: 2.23, text: '다시 말해 주세요.', speaker: 'customer' },
  { id: 'receipt', start: 2.4, end: 4.3, text: '영수증 필요하세요?', speaker: 'barista' },
  { id: 'decline', start: 5, end: 6.08, text: '아, 괜찮아요.', speaker: 'customer' },
  { id: 'thanks', start: 6.45, end: 7.25, text: '감사합니다!', speaker: 'customer' },
  { id: 'repeat-phrase', start: 10, end: 296 / fps, text: '다시 말해 주세요.', speaker: 'customer' },
  { id: 'practice-phrase', start: 296 / fps, end: duration, text: '다시 말해 주세요.', speaker: 'customer' },
];

for (const scene of scenes) {
  const seconds = scene.durationFrames / fps;
  const sourceStart = scene.sourceStartFrame / fps;
  fs.writeFileSync(path.join(compositions, `${scene.id}.html`), `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"></head><body><template>
<style>#root{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}.footage{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}</style>
<div id="root" data-composition-id="${scene.id}" data-width="1080" data-height="1920" data-duration="${seconds}">
<video id="${scene.id}-video" class="clip footage" data-start="0" data-duration="${seconds}" data-media-start="${sourceStart}" data-track-index="0" src="assets/${sourceName}" muted playsinline></video>
</div><script>window.__timelines["${scene.id}"]=gsap.timeline({paused:true});</script>
</template></body></html>`, 'utf8');
}

const hosts = scenes.map((s) => `<div id="${s.id}" class="clip scene" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.startFrame / fps}" data-duration="${s.durationFrames / fps}" data-width="1080" data-height="1920" data-track-index="0"></div>`).join('\n');
const audio = scenes.map((s) => `<audio id="${s.id}-audio" class="clip" src="assets/${sourceName}" data-start="${s.startFrame / fps}" data-duration="${s.durationFrames / fps}" data-media-start="${s.sourceStartFrame / fps}" data-track-index="1"></audio>`).join('\n');
const subtitleMarkup = captions.map((c) => clip(c.id, c.start, c.end - c.start, `<span class="caption-inner">${escape(c.text)}</span>`, `caption ${c.speaker}`)).join('\n');
const labels = [
  clip('hook-label', 0, 2.33, '<span>못 들었을 때는?</span>', 'lesson-label', 4),
  clip('repeat-label', 10, 56 / fps, '<span>한 번 더 들어보세요</span>', 'lesson-label', 4),
  clip('practice-label', 296 / fps, 69 / fps, '<span>이제 직접 말해 보세요</span>', 'lesson-label', 4),
].join('\n');

fs.writeFileSync(path.join(project, 'index.html'), `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>SYNK LAB · 다시 말해 주세요</title><script src="assets/gsap.min.js"></script>
<style>
@font-face{font-family:SUIT;src:url('assets/SUIT-Variable.woff2') format('woff2');font-weight:100 900;font-display:block}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff}
#cafe{position:relative;width:100%;height:100%;overflow:hidden;font-family:SUIT,sans-serif;color:#111}
.scene{position:absolute;inset:0;width:100%;height:100%}
.brand{position:absolute;left:72px;top:120px;width:222px;height:68px;padding:10px 13px;background:#fff;border-radius:10px;display:flex;align-items:center}
.brand img{width:100%;height:100%;object-fit:contain}
.lesson-label{position:absolute;left:72px;top:214px;right:110px;font-size:39px;font-weight:700;line-height:1.25;letter-spacing:-.5px}
.lesson-label span{display:inline-block;background:#fff;color:#111;padding:14px 21px;border-radius:10px}
.caption{position:absolute;left:72px;right:110px;bottom:304px;text-align:center;font-size:62px;font-weight:780;line-height:1.23;letter-spacing:-1.8px}
.caption-inner{display:inline-block;max-width:100%;background:#111;color:#fff;padding:21px 28px 25px;border-radius:15px}
.customer .caption-inner{background:#fff;color:#111;border:2px solid #111}
</style></head><body>
<main id="cafe" data-composition-id="cafe" data-width="1080" data-height="1920" data-duration="${duration}" data-fps="24">
${hosts}
${audio}
${clip('brand', 0, duration, '<img src="assets/lab-logo.png" alt="synk LAB">', 'brand', 10)}
${subtitleMarkup}
${labels}
</main><script>window.__timelines.cafe=gsap.timeline({paused:true});</script></body></html>`, 'utf8');

fs.writeFileSync(path.join(project, 'edit-timeline.json'), JSON.stringify({fps, duration, videoFrames:365, source:sourceName, note:'ASR-guided boundaries. Auditory review and continuous-playback appearance verification pending.', scenes:scenes.map(s=>({...s,start:s.startFrame/fps,duration:s.durationFrames/fps,sourceStart:s.sourceStartFrame/fps})), captions}, null, 2));
fs.writeFileSync(path.join(project, 'BRIEF.md'), `---\nworkflow: general-video\nflow: automation\nstoryboard: no\n---\n\n# 카페 한국어 · 다시 말해 주세요\n\n승인된 age-match-v2 사진으로 만든 test-09 영상 한 개를 사용한다. 10초 상황을 보고, 같은 발화를 정상 속도로 한 번 더 듣고, 실제 움직이는 미소 화면에서 직접 말해 보는 약 15.2초 영상이다. 기존 v3는 보존한다.\n\n사용자가 완성 영상 제작을 위임했다. 추가 렌더 승인 질문 없이 로컬 결과까지 만든다. 게시·결제는 범위 밖이다.\n\n1080×1920, 24fps. 원본 색·피부·음성을 유지한다. 원본 동영상을 세 구간으로 재사용하고 정지 배경은 쓰지 않는다. SUIT와 기존 LAB 로고를 재사용한다.\n\n## 검증 상태\n\n오프라인 ASR로 대사를 확인했고 원본 8개 프레임을 승인 사진과 비교했다. 최종 편집의 연속 재생·청취·얼굴 외형은 검증 대기다. 자동 인식은 정확한 입모양 또는 연기 품질을 보증하지 않는다.\n`, 'utf8');
fs.writeFileSync(path.join(project, 'README.md'), `# 카페 한국어 v4 검토본\n\n새 test-09 영상만으로 구성한 365프레임, 약 15.208초 검토본이다. 대화 10초 → 첫 문장 정상 속도 반복 → 움직이는 미소와 직접 말하기 순서다.\n\n- 출력: \`SYNK_LAB_CAFE_AGE_MATCH_v4.mp4\`\n- 편집 원본: \`index.html\`, \`compositions/\`\n- 재생성: \`node build-composition.mjs\`\n- 검사: \`npm run check\`\n- 출력: \`npm run render -- --fps 24 --quality delivery --output SYNK_LAB_CAFE_AGE_MATCH_v4.mp4\`\n- 시간표: \`edit-timeline.json\`\n\n## 확인 상태\n\n영상 외형 검증 대기. 실제 끝까지 재생과 청취는 부모 작업에서 확인한다. 원본 음성·색·피부를 수정하지 않았으며 생성 워터마크는 보존한다. 본인 음성 복제본이라고 주장하지 않는다. 게시하지 않았다.\n`, 'utf8');
fs.writeFileSync(path.join(project, 'qa-report.json'), JSON.stringify({status:'영상 외형 검증 대기',render:'pending',fps,duration,videoFrames:365,source:sourceName,sourceAsr:'four requested Korean lines confirmed by local faster-whisper; exact word boundaries unverified by listening',sourceVisual:'8 sampled frames compared with approved reference; not continuous playback',check:'pending',snapshots:'pending',browserPlayback:'pending — parent task owns playback review',listening:'not performed',publication:'not posted'}, null, 2));
fs.copyFileSync(path.join(project, 'watch-template.html'), path.join(project, 'watch.html'));
console.log(`Built ${scenes.length} scenes; ${duration.toFixed(3)} seconds, 365 frames.`);
