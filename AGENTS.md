# SYNK — 저장소 안내

공통 기준은 [AI 운영 원칙](docs/AI_운영원칙.md)이다.

- `Code.js`·`엔진_*.js`는 전역 이름공간을 공유한다. 콘텐츠는 `contents_*.js`, 도구는 `tools/`, 관련 시험은 `node --test tests/<파일>`이다.
- Apps Script 라이브 배포가 요청됐을 때만 `deploy`의 실행 정보를 사용한다. `clasp pull`로 작업본을 덮어쓰지 않는다.
- `tools/codex-build.js`로 호출된 실행자만 발주서의 범위·시험·출력 계약을 따른다.

## Code Review Rules

실제 문제만 파일·줄·깨지는 동작·재현 근거와 함께 적는다. P0는 데이터·인증·라이브 손상, P1은 기능 오류, P2는 품질 문제, P3는 추가 확인이 필요한 의심이다. 읽지 못한 범위는 밝히고 지적을 만들지 않는다.
