# SYNK Apps Script

Google Apps Script 코드와 회사 작업 저장소다. Apps Script에는 `Code.js`(웹 입구·메뉴·트리거)와 `엔진_synkbrief.js`(@synkbrief 자료 DM)만 올라간다. 몽골 오프라인 학원 운영 시스템은 2026-10-02에 지웠다([정리 목록](docs/_ops/옛시스템_정리목록_20261002.md)). `엔진_콘텐츠AI.js`는 Strata 문법 뱅크의 원천이라 저장소에만 둔다. Atlas 엔진은 `atlas/`·`strata/`, 체험은 `experiences/`, 로컬 도구는 `tools/`에 있다.

- 작업 안내: [AGENTS](AGENTS.md)
- 자료: [문서 지도](docs/문서_지도.md)
- 자산: [DESIGN](DESIGN.md)
- 시험: `node --test tests/<파일>`
- 운영 화면: `SYNK 운영 홈.cmd`

라이브 배포가 요청되면 기존 deploy 도구를 사용한다. `clasp pull`은 로컬 작업본을 덮어쓴다.
