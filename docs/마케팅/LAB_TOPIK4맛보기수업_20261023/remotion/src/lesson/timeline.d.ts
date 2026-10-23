// timeline.js 타입 — 셈은 JS 하나(정지컷 도구와 같이 쓴다).
export const SCENE_SPECS: { id: string; lead: number; tail: number; pause?: Record<string, number> }[];
export const SYL: number;
export const GAP: number;
export function buildTimeline(lines: { id: string; scene: string; say: string; mn: string[]; cut?: string[] }[], vo: { dur?: Record<string, number>; words?: Record<string, [string, number, number][]> }, fps: number): { lineTime: Record<string, { from: number; to: number; sec: number; dur: number }>; cues: { from: number; to: number; line: string; text: string }[]; scenes: Record<string, { from: number; to: number }>; total: number };
