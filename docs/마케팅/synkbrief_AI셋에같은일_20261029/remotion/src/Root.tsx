import { Composition } from 'remotion';
import './lib/fonts';
import { Film } from './film/Film';
import { TOTAL } from './film/time';

// 본편 하나를 인스타 · 유튜브 · 틱톡에 같이 쓴다 — 끝 말이 캡션 · 고정 댓글을 가리키지 않아 판마다 다른 렌더가 필요 없다(제작 절차 4 「틱톡 판」).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="brief" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
  </>
);
