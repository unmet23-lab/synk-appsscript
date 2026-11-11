import { Composition } from 'remotion';
import './fonts';
import { SONG } from './songDoc';
import { Song } from './Song';
import { 판본들 } from './판본';

// 한 편(public/song.json — 소리 · 박자 · 음절 · 무대, 원본 동결) + 판본마다 컴포지션 하나(song-<KEY>, src/판본/<KEY>.json의 loc).
// 「song」은 song.json에 든 loc(만들 때 쓴 판 — 시안 · 확인용). 판본 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
const frames = Math.round(SONG.duration * SONG.fps);
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="song" component={Song} durationInFrames={frames} fps={SONG.fps} width={1080} height={1920} defaultProps={{ doc: SONG }} />
    {판본들(SONG.syl.length).map(({ key, pack }) => (
      <Composition key={key} id={`song-${key}`} component={Song} durationInFrames={frames} fps={SONG.fps} width={1080} height={1920}
        defaultProps={{ doc: { ...SONG, loc: pack } }} />
    ))}
  </>
);
