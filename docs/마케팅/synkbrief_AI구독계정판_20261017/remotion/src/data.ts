// 2026-10-17 11:45 개발 창 「지금 확인」으로 읽은 실제 값. 이메일은 앞부분만 쓴다(콘티 v1과 같음).
export type Svc = 'claude' | 'gpt' | 'gemini' | 'higgsfield';
export type Account = { svc: Svc; label: string; name: string; weekly?: number; credits?: number };

export const ACCOUNTS: Account[] = [
  { svc: 'claude', label: 'Claude', name: 'unmet23', weekly: 38 },
  { svc: 'claude', label: 'Claude', name: 'synk.yuh', weekly: 63 },
  { svc: 'claude', label: 'Claude', name: 'founder', weekly: 99 },
  { svc: 'gpt', label: 'GPT', name: 'synk.yuh', weekly: 31 },
  { svc: 'gemini', label: 'Gemini', name: 'Gemini', weekly: 0 },
  { svc: 'higgsfield', label: 'Higgsfield', name: '77yuhbs', credits: 0.22 },
];

export const CHECK = { total: 6, seconds: 14, at: '11:45' };

export const ATTENTION = [
  { level: 1, text: '크레딧 부족 · 77yuhbs Higgsfield · 0.22' },
  { level: 1, text: '주간 99% · founder Claude' },
];
