# 서울 하루 장소 자료 표본 — 2026-10-07~09 확인 판

`experiences/path-travel/`의 `places-v2.mjs`·`real-places.mjs`·`real-course-data.mjs`를 2026-11-07 재확인 직전 커밋(9467e34035) 그대로 옮겨 둔 것이다. 공개 앱은 쓰지 않고 시험만 쓴다.

엔진 규칙 시험(운영기간·부분 관람·공휴일·무료일·체류·일정 짜기)은 그 시점의 실제 예외로 짜여 있다. 장소 자료는 30일마다 다시 확인해 날짜·예외가 바뀌므로, 그 시험들은 [use-snapshot.mjs](use-snapshot.mjs) 고리로 이 표본을 읽는다. 지금 자료는 `tests/path-travel-live-catalog.test.mjs`가 확인일 기준으로 검사한다.

이 표본은 고치지 않는다. 엔진 규칙을 새 예외로 시험하려면 새 표본 폴더를 더한다.
