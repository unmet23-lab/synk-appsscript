// SNS 키트 synkbrief 테마 값(kit.css [data-acc="brief"])과 9:16 배치 숫자. 같은 채널의 「AI 구독 계정판」 v5와 같은 값이다(새 색 없음).
import { KO, MONO } from './lib/fonts';

export const C = {
  field: '#3d6bc9',
  onField: '#ffffff',
  onField2: 'rgba(255,255,255,.86)',
  markField: '#ffebb0',
  ink: '#0a0a0a',
  muted: '#4f535a',
  acc: '#24448c',
  ok: '#2f8a4b',
  no: '#c2412e',
  screen: '#0b0d12',
};

// cover916: 위 안전선 269, 본문 시작 350, 좌우 84/160(오른쪽 160은 쇼츠 단추 자리). .k-center로 180 내린 값을 바로 쓴다.
// 글자 오른끝은 x 920(= W - R) 안. 자막 아래끝 1416.
export const L = { W: 1080, H: 1920, X: 84, R: 160, CW: 836, HEAD_Y: 273 + 180, TOP: 350 + 180, CAP_BOTTOM: 1236 + 180 };

export const F = { ko: KO, mono: MONO, latin: "'Inter Tight', 'SUIT', sans-serif" };
