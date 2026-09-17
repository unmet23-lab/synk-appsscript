# SYNK Apps Script

Google Apps Script 학습·운영 코드다. `Code.js`와 `엔진_*.js`는 전역 이름공간을 공유한다. 콘텐츠는 `contents_*.js`, 로컬 도구는 `tools/`에 있다.

- 작업 안내: [AGENTS](AGENTS.md)
- 자료: [문서 지도](docs/문서_지도.md)
- 자산: [DESIGN](DESIGN.md)
- 시험: `node --test tests/<파일>`
- 운영 화면: `SYNK 운영 홈.cmd`

라이브 배포가 요청되면 기존 deploy 도구를 사용한다. `clasp pull`은 로컬 작업본을 덮어쓴다.
