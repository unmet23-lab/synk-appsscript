import { Composition } from 'remotion';
import './lib/fonts';
import { Film, Scene, TOTAL, SCENE_TOTAL } from './Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 하나(인스타 · 유튜브 같은 영상 — 끝 말이 캡션 · DM · 고정 댓글을 가리키지 않는다) */}
    <Composition id="b60" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    {/* 한 장면 먼저(장면 심사용 — 글 · 말 없이 소리째) */}
    <Composition id="scene" component={Scene} durationInFrames={SCENE_TOTAL} fps={30} width={1080} height={1920} />
  </>
);
