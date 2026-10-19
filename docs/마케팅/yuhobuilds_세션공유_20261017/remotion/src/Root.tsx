import { Composition } from 'remotion';
import './lib/fonts';
import { Film } from './film/Film';
import { TOTAL } from './film/time';
import { Cover } from './full/Cover';
import { FullFilm } from './full/Film';
import { TOTAL_A, TOTAL_E } from './full/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 움직임 시험판(01A·06·09, 12.5초) — 만족 사례 S22 */}
    <Composition id="motion-test" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    {/* 본편: A = 인스타 릴스(훅 「계정 바꿨더니」), E = 유튜브 쇼츠(훅 「1,086번 거절」) */}
    {/* 본편 기본은 배경음 키운 판(10-18 유호님 「오케이. 키운판으로 하자 .」) */}
    <Composition id="full-a" component={FullFilm} durationInFrames={TOTAL_A} fps={30} width={1080} height={1920} defaultProps={{ variant: 'A' as const, bgm: 'up' as const }} />
    <Composition id="full-e" component={FullFilm} durationInFrames={TOTAL_E} fps={30} width={1080} height={1920} defaultProps={{ variant: 'E' as const }} />
    {/* 배경음 비교(10-18): 키운 판 · 뺀 판 */}
    <Composition id="full-a-music-up" component={FullFilm} durationInFrames={TOTAL_A} fps={30} width={1080} height={1920} defaultProps={{ variant: 'A' as const, bgm: 'up' as const }} />
    <Composition id="full-a-no-music" component={FullFilm} durationInFrames={TOTAL_A} fps={30} width={1080} height={1920} defaultProps={{ variant: 'A' as const, bgm: 'none' as const }} />
    {/* 표지(10-18 「전후 비교 표지도 만들어줘」): npx remotion still cover */}
    <Composition id="cover" component={Cover} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);
