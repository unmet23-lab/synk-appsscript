// 이 편이 쓰는 보유 자산을 public/ 에 복사하고 배경음을 자른다: node 준비.mjs  (remotion 폴더에서)
// 원본은 고치지 않는다. public/ 은 언제든 다시 만든다(git 밖). 화면은 node ../자료/폰찍기.mjs, 목소리는 node 나누기.mjs가 넣는다.
//  · 서체: LAB_TOPIK관용구 사본(Y5와 같음)
//  · 작업 소리: 실제 녹음 효과음(Pixabay Content License — 상업 사용 · 수정 가능, 표기 의무 없음). media-use 스킬 묶음
//    (~/.claude/skills/media-use/audio/assets/sfx, CREDITS.md)에서 가져온다 — 저장소에는 낱개 효과음을 올리지 않는다(단독 배포 금지 조항).
//  · 배경음: 보유곡 「밝은_052」(Suno Pro) 원곡에서 영상 길이만큼(v14 46.2초 — 아래 이어 붙이기) — 지난 두 편(Y9 Building Momentum · Y28 테크팝)과 다른 곡.
//    v11(37.5초): 10.5초부터 자르면 곡 가운데 쉼(29.2~29.9초)이 영상 18.7~19.4초(마지막 요청을 보내는 자리)에 오고, 곡이 다시 터지는
//    30.0초가 19.5초(빨간 우체통 세무사가 덮이는 자리)에 온다. 곡은 48초부터 사그라지니 영상 끝(곡 48.0초)까지 꽉 찬 채로 끝난다.
//    (v10은 7.4초부터 · 40초) v8까지는 5.6초부터였는데 v9에서 결과가
//    22.5초로 당겨지며 쉼이 결과 뒤로 밀려 24.0~24.3초가 −48~−53dB로 비었다(11-01 아르곤 듣기 지적 → 실측 확인). 원곡은 48초부터 사그라진다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(HERE, 'public');
const S16 = 'docs/마케팅/LAB_TOPIK관용구_20261013/remotion/public';
const SFX = path.join(os.homedir(), '.claude/skills/media-use/audio/assets/sfx');

const 목록 = [
  ...['SUIT-Variable.woff2', 'InterTight-Bold.ttf', 'InterTight-SemiBold.ttf', 'InterTight-Medium.ttf', 'DMMono-Medium.ttf'].map((n) => [path.join(REPO, S16, 'fonts', n), `fonts/${n}`]),
  ...['typing', 'click', 'click-soft', 'key-press', 'whoosh', 'whoosh-short', 'pop'].map((n) => [path.join(SFX, `${n}.mp3`), `sfx/${n}.mp3`]),
];
for (const [from, to] of 목록) {
  const dst = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(from, dst);
}

const BGM = path.join(REPO, 'docs/홍보물/BGM/밝은_052.wav');
// v14(46.2초): 끝에 한 줄 카드가 더해져 곡(52.2초, 48초부터 사그라짐)이 모자란다 — 곡 35.76초에서 두 마디(5.046초, 95.7BPM) 앞
// 30.714초로 되돌아가 이어 붙인다(같은 두 마디 반복 — 0.25초 파형 상관 0.77로 고른 자리, 40ms 겹침). 영상에서는 25.3초(물건 셋이 나오는 자리)이고,
// 곡의 끝(48초부터 사그라짐)이 영상 42.5초에 와서 한 줄 카드 끝에서 곡도 자연스럽게 끝난다.
const FROM = 10.5;
const SPLICE = 35.76;
const BACK = 5.046;
const mix = `[0:a]atrim=start=${FROM}:end=${SPLICE},asetpts=PTS-STARTPTS[a];[0:a]atrim=start=${SPLICE - BACK},asetpts=PTS-STARTPTS[b];[a][b]acrossfade=d=0.04:c1=tri:c2=tri[o]`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', BGM, '-filter_complex', mix, '-map', '[o]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', path.join(OUT, 'bgm.wav')]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(OUT, 'bgm.wav')]).toString().trim();
console.log(`public/ 에 ${목록.length}개 복사 · bgm.wav ${(+dur).toFixed(2)}초(밝은_052 ${FROM}초부터 · ${SPLICE}초에서 ${BACK}초 되돌림)`);
