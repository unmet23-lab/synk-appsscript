// 판 안에 쓰는 실제 값. 출처는 ../../기획.md §2 「사실 대조」.
//  · 실행 기록: gh run list / gh run view(비공개 저장소, 10-22 07시대 다시 읽음) — 시각은 KST로 옮김, 저장소 이름·실행 번호·커밋 메시지는 화면에 내지 않음
//  · 결제 화면 값: 현장 노트 시험·화면 확인 94행(10-21 로그인 화면에서 읽음)
//  · 무료 규칙: GitHub 공식 문서 「GitHub Actions billing」(10-22 확인)

/** 10-20 19:20 ~ 10-21 23:08 KST, verify 단계 0개로 끝난 CI 실행 18번(시각 · 걸린 초). */
export const DEAD_RUNS: readonly (readonly [string, number])[] = [
  ['10/20 19:20', 2], ['10/20 20:01', 2], ['10/20 20:42', 3], ['10/21 01:10', 2], ['10/21 10:42', 2], ['10/21 11:32', 1],
  ['10/21 11:35', 2], ['10/21 14:07', 2], ['10/21 14:12', 2], ['10/21 14:12', 2], ['10/21 17:20', 2], ['10/21 17:20', 2],
  ['10/21 17:41', 3], ['10/21 21:03', 2], ['10/21 21:06', 2], ['10/21 21:12', 2], ['10/21 21:34', 2], ['10/21 23:08', 1],
];
/** 위 18번의 시각(10-20 19:20을 0으로 한 시간). 시간 띠에 놓는다. */
export const DEAD_HOURS = [0, 0.68, 1.37, 5.83, 15.37, 16.2, 16.25, 18.78, 18.87, 18.87, 22.0, 22.0, 22.35, 25.72, 25.77, 25.87, 26.23, 27.8] as const;
export const SPAN_HOURS = 28.1; // 10-20 19:20 → 10-21 23:25(첫 초록)

export const ANNOTATION_A = 'The job was not started because recent account payments have failed';
export const ANNOTATION_B = ' or your spending limit needs to be increased.';
export const USAGE = { used: 2000, included: 2000 } as const;
export const RED_TESTS = 16; // 되살린 첫 전체 시험(자체 실행기) # fail 16 — 그중 3개는 PC 동시 실행 시간 초과
export const RED_BY_PC = 3;
export const TESTS_AFTER = 4451;
export const TESTS_PUBLIC = 1940; // 10-19 다른 저장소를 공개로 바꾼 뒤 첫 실행
export const SELF_RUN = { at: '10/21 23:25', took: '9분 44초' } as const;

export const DOC_QUOTE = 'GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners.';
export const BILLING_URL = 'github.com/settings/billing';
