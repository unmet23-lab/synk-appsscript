export type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
  pageBreakAfter?: boolean;
};

export type Visual = 'hook' | 'payment' | 'setting' | 'translation' | 'inquiries' | 'purpose' | 'tools' | 'confusion' | 'screenshots' | 'loop' | 'hours' | 'joke' | 'lesson' | 'prompt' | 'action' | 'ending';

export type SceneTiming = {id: string; start: number; duration: number; visual: Visual; text: string};
export type Timing = {fps: number; durationInFrames: number; audioFile: string | null; audioStartFrame: number; scenes: SceneTiming[]};
export type VideoProps = {timing: Timing; captions: Caption[]};
export type SceneProps = {scene: SceneTiming; index: number; total: number};
