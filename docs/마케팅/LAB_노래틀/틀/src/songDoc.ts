// 노래 한 편의 정본(public/song.json) 꼴 — LAB 21:00 노래 가사판(리듬 한국어 준비안 「라」 줄, 2026-11-11).
// 시각은 모두 손질본(tools/곡손질.py가 낸 곡) 시각이고, 음절 시각은 tools/노래검수.py가 목소리 갈래에서 잰 음절 시작을
// 손질.json 「대응」으로 옮긴 값이다(가이드 §3 — 글자는 그 소리와 같은 순간에 켠다, 0.07초 안).
import songFile from '../public/song.json';

export type Part =
  | { kind: 'count'; t: number; end: number } // 카운트인 한 마디 — 다리 글
  | { kind: 'chop'; t: number; end: number; at: number[] } // 끊어 부르기 — 한 박에 한 칸
  | { kind: 'whole'; t: number; end: number; at: number[] } // 이어 부르기 — 낱말 전체(at = 낱말을 부른 시각들)
  | { kind: 'rest'; t: number; end: number; mode: 'clap' | 'say' } // 네 차례 — 반주만 흐르는 한 마디
  | { kind: 'real'; t: number; end: number; at: number[] } // 진짜 속도 — 실제 말 속도로 한 번
  | { kind: 'end'; t: number; end: number }; // 끝 물음

export type Loc = {
  lang: string; // sns-계정.json language(판본 언어)
  bridge: string; // 카운트인 동안 다리 글(그 나라 말 — 그 낱말을 쓰는 상황 한 줄)
  mean: string; // 뜻 알약(이어 부르기 뒤)
  read: string[]; // 음절마다 발음 줄(몽골판만 키릴, 다른 판은 로마자 — 표기표를 검수한 문자만 그 나라 글자)
  clap: string; // 첫 네 차례 — 손뼉
  say: string; // 둘째 네 차례 — 말하기
  real: string; // 진짜 속도 딱지
  end: string; // 끝 물음(「너희 말로는 뭐야?」)
};

export type SongDoc = {
  fps: number;
  duration: number;
  audio: string; // public 안 곡 파일
  bpm: number;
  first: number; // 첫 박(손질본 시각)
  word: string; // 한국어 낱말(화면 칸은 이 글자 그대로)
  syl: string[]; // 음절
  parts: Part[];
  stage: { mode: 'mongle' | 'plain'; img?: string; pic?: string; bg?: string };
  loc: Loc;
  _원문?: Record<string, string>; // 판본 글의 한국어 뜻(역번역 대조 기준)
};

export const SONG = songFile as unknown as SongDoc;
