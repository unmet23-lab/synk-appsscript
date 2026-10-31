import { Composition } from 'remotion';
import './lib/fonts';
import { Film, TOTAL } from './Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 하나(인스타 · 유튜브 · 틱톡 같은 영상 — 끝 말이 캡션 · DM · 고정 댓글을 가리키지 않는다) */}
    <Composition id="b21" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
  </>
);
