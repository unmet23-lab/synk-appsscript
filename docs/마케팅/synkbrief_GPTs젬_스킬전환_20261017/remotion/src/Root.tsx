import { Composition } from 'remotion';
import './lib/fonts';
import { Film, filmFrames } from './film/Film';
import { MotionTest, MOTION_TEST_FRAMES } from './MotionTest';

// synkbrief 「GPTs·젬, 올해 둘 다 사라집니다」
// film-a: 인스타 릴스(훅 A 결과), film-c: 유튜브 쇼츠(훅 C 틀린 것). 나레이션 범수(지피티에스).
// motion-test: 처음 움직임 시안(흰 무대, 10-17) — 본편은 같은 채널 「AI 구독 계정판」 v5의 청금석 무대 문법으로 바꿨다.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="film-a" component={Film} defaultProps={{ cut: 'A' as const }} durationInFrames={filmFrames('A')} fps={30} width={1080} height={1920} />
    <Composition id="film-c" component={Film} defaultProps={{ cut: 'C' as const }} durationInFrames={filmFrames('C')} fps={30} width={1080} height={1920} />
    <Composition id="motion-test" component={MotionTest} durationInFrames={MOTION_TEST_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
