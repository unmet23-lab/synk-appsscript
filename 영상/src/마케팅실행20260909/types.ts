export type Cue = {text: string; startMs: number; endMs: number; timestampMs: number | null; confidence: number | null};
export type Scene = {id?: string; durationSec: number; title: string; body?: string; tip?: string; eyebrow?: string; lines?: string[]; asset?: string; kr?: string; mn?: string; narration?: string; audioFile?: string; audioDurationSec?: number; pauseForPracticeSec?: number; cues?: Cue[]};
export type ContentItem = {id: string; brand?: string; title?: string; format: string; scenes: Scene[]; width?: number; height?: number; sourceScriptSha256?: string};
export const videoIds = ['01-lab-youtube','03-lab-tiktok','04-yuhobuilds-youtube','05-yuhobuilds-instagram','06-yuhobuilds-tiktok','07-synkbrief-youtube','09-synkbrief-tiktok','shift-public-class-01','shift-public-clinic-demo-01'] as const;

