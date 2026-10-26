import { Composition } from 'remotion';
import './lib/fonts';
import { B, TEMPO, TOTAL } from './film/timeline';
import { KidsFilm } from './kids/KidsFilm';

// 관용구 퀴즈 #7 몽골판(10-26)도 퀴즈 #2 v5b 틀(100 BPM, 끝 4.5초 판 33.3초)만 쓴다 — REMOTION_TEMPO=100으로 번들할 때만 판을 등록한다(템포가 다른 판을 잘못 렌더하지 않게).
// 0초 화면: 물통에 빠진 생쥐부터, 문제 순서 물에 빠진 생쥐 → 불 보듯 뻔하다 → 물 건너가다.
// 10-26: 10-23 이해 시험의 「따라 말할 틈」 — SAY IT 알약을 한 박 반 당긴다(11박 → 10.5박 = 6.3초, 해요체 줄 6.36초와 같은 자리).
const V5B = { bgm: 'bgm_kids_100.wav', motion: true, stamp: 'label' as const, tease: true, sayAt: Math.round(10.5 * B), yourTurn: true, shortOptions: true, hook: true };

export const RemotionRoot: React.FC = () => {
  if (TEMPO !== 100) return null;
  return (
    <>
      {/* 관용구 퀴즈 #7 몽골판(틱톡 @synk.mn · 텔레그램 SYNK LAB): 화면 글 몽골어(i18n.ts MN), 나레이션은 한국어로만(판 q7ko).
          퀴즈 #6 몽골판 버림의 교훈 — 한국어 진행 소리를 그 박에 몽골어로 옮기는 몽글 말풍선과 정답 때 「왜 그 뜻인지」 한 줄(KidsQuestion HostBubble) */}
      <Composition id="q7-mn" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'q7ko' as const, lang: 'mn' as const, order: [0, 1, 2], hookLine: 'ШУУД УТГААРАА БИШ!', listRecap: true }} />
    </>
  );
};
