import { Composition } from 'remotion';
import './lib/fonts';
import { Scene, SCENE_TOTAL } from './Scene';
import { Scene2, SCENE2_TOTAL } from './Scene2';
import { Film, TOTAL } from './Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 하나(인스타 · 유튜브 · 틱톡 같은 영상 — 끝 말이 캡션 · DM · 고정 댓글을 가리키지 않는다) */}
    <Composition id="b32" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    {/* 한 장면(장면 심사용 — 제목 · 해설 없음) v1 · v2 */}
    <Composition id="scene" component={Scene} durationInFrames={SCENE_TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="scene2" component={Scene2} durationInFrames={SCENE2_TOTAL} fps={30} width={1080} height={1920} />
  </>
);
