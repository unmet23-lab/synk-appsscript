import { Audio, Composition, staticFile } from 'remotion';
import './lib/fonts';
import { Film, TOTAL } from './Film';
import { Reveal, REVEAL_LEN } from './Reveal';

// 장면 심사용 — 핵심 장면만, 제목 · 이름표 · 말 없이 그 장면의 소리째(제작 절차 「한 장면 먼저」 ①).
const SceneOnly: React.FC = () => (
  <>
    <Reveal />
    <Audio src={staticFile('bgm.mp3')} volume={0.22} />
  </>
);

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 하나(인스타 · 유튜브 · 틱톡 같은 영상 — 끝 말이 캡션 · DM · 고정 댓글을 가리키지 않는다) */}
    <Composition id="b18" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="scene" component={SceneOnly} durationInFrames={REVEAL_LEN} fps={30} width={1080} height={1920} />
  </>
);
