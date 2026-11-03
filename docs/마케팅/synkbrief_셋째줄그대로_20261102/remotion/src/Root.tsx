import { Composition } from 'remotion';
import './lib/fonts';
import { Film, TOTAL } from './Film';
import { FilmV2 } from './FilmV2';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 하나(인스타 · 유튜브 · 틱톡 같은 영상 — 끝 말이 캡션 · DM · 고정 댓글을 가리키지 않는다) */}
    <Composition id="b23" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    {/* v2(11-04 · 화면 결) — 같은 말 · 소리 · 장면, 겉만 다시 */}
    <Composition id="b23v2" component={FilmV2} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
  </>
);
