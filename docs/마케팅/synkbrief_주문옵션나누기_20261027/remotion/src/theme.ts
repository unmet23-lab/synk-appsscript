// SNS 키트 synkbrief 테마 값(kit.css [data-acc="brief"])과 9:16 배치 숫자. 새 색을 들이지 않는다.
import { KO, MONO } from './lib/fonts';

export const C = {
  field: '#3d6bc9',
  onField: '#ffffff',
  onField2: 'rgba(255,255,255,.86)',
  markField: '#ffebb0',
  ink: '#0a0a0a',
  muted: '#4f535a',
  hair: '#dfe3e9',
  acc: '#24448c',
  accSoft: '#c5d6f5',
  mark: '#ffe07a',
  crayon: '#f96859',
  screen: '#0b0d12',
};

// cover916: 위 안전선 269, 본문 시작 350, 좌우 84/160. .k-center로 180 내린 값을 바로 쓴다.
export const L = { W: 1080, H: 1920, SHIFT: 180, X: 84, R: 160, HEAD_Y: 273 + 180, TOP: 350 + 180, CAP_BOTTOM: 1236 + 180 };

export const F = { ko: KO, mono: MONO };

// 계정판(member-subs)이 기대하는 플랫폼 토큰 — desktop/renderer/launcher.css 밤 테마 값
export const BOARD_TOKENS: Record<string, string> = {
  '--sans': KO,
  '--mono': MONO,
  '--line': 'rgba(255,255,255,.075)',
  '--line-2': 'rgba(255,255,255,.14)',
  '--ink': '#FAFAF9',
  '--ink-2': 'rgba(250,250,249,.72)',
  '--ink-3': 'rgba(250,250,249,.52)',
  '--ink-4': 'rgba(250,250,249,.22)',
  '--on-ink': '#08090C',
  '--surface-1': '#121317',
  '--surface-2': '#191A1F',
  '--surface-3': '#222329',
  '--panel': '#0C0D10',
  '--r-md': '14px',
  // 색 면 결(launcher.css --grain 그대로)
  '--grain': `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .7 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
  '--r-xl': '22px',
  '--r-lg': '18px',
  '--studio': 'radial-gradient(120% 85% at 28% -10%,rgba(255,255,255,.16),transparent 58%),linear-gradient(180deg,transparent 55%,rgba(0,0,0,.1))',
};
