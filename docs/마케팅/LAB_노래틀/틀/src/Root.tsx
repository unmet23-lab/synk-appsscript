import { Composition } from 'remotion';
import './fonts';
import { SONG } from './songDoc';
import { Song } from './Song';

// 한 편(public/song.json) — 판본마다 song.json의 loc만 바꿔 렌더한다(렌더.mjs가 판본 글을 song.json에 덮어 쓴다).
export const RemotionRoot: React.FC = () => (
  <Composition id="song" component={Song} durationInFrames={Math.round(SONG.duration * SONG.fps)} fps={SONG.fps} width={1080} height={1920} defaultProps={{ doc: SONG }} />
);
