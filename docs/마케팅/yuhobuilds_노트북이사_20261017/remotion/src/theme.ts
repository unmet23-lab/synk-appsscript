// SNS 키트 builds 테마(kit.css [data-acc="builds"])와 9:16 배치 숫자. 강조색은 버터 하나, 새 색을 들이지 않는다.
import { EN, KO, MONO } from './lib/fonts';

export const C = {
  field: '#0a0a0a',
  onField: '#ffffff',
  onField2: 'rgba(255,255,255,.78)',
  onField3: 'rgba(255,255,255,.52)',
  butter: '#f5c445',
  butterSoft: '#ffebb0',
  ink: '#0a0a0a',
  muted: '#4f535a',
  paper: '#ffffff',
  paperLine: '#eceef1',
  screen: '#121418',
  screenBar: '#1c1f25',
  screenDim: '#8b93a3',
};

// cover916: 위 안전선 269·본문 350·좌우 84/160. 이 편은 키트 기본 180 대신 120만 내린다(자막 아래끝 1356, 기획·README).
export const SHIFT = 120;
export const L = { W: 1080, H: 1920, X: 84, R: 160, IN: 836, HEAD_Y: 273 + SHIFT, TOP: 350 + SHIFT, CAP_BOTTOM: 1236 + SHIFT };

export const F = { ko: KO, en: EN, mono: MONO };
