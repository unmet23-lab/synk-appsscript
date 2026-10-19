# SYNK Apps Script

Google Apps Script 코드와 회사 작업 저장소다. Apps Script에는 `Code.js`(웹 입구·메뉴·트리거)와 `엔진_synkbrief.js`(@synkbrief 자료 DM)만 올라간다. 몽골 오프라인 학원 운영 시스템은 2026-10-02에 지웠다([정리 목록](docs/_ops/옛시스템_정리목록_20261002.md)). `엔진_콘텐츠AI.js`는 Strata 문법 뱅크의 원천이라 저장소에만 둔다. Atlas 엔진은 `atlas/`·`strata/`, 체험은 `experiences/`, 로컬 도구는 `tools/`에 있다.

- 작업 안내: [AGENTS](AGENTS.md)
- 역할과 작업 방식: [GPT 기초 구현 · Claude 고도화·마감 · 마케팅 제작 Claude 전담](docs/AI_운영원칙.md)
- 자료: [문서 지도](docs/문서_지도.md)
- 자산: [DESIGN](DESIGN.md)
- 시험: `node --test tests/<파일>`
- 운영 화면: `SYNK 운영 홈.cmd`

반복 작업 도구(2026-10-17):

| 작업 | 사용 위치 |
| --- | --- |
| 백업 감시 | Windows **SYNK 백업 상태 확인**이 15분마다·로그온 때 로컬 실행 기록을 확인한다. 기존 **SYNK 매일 백업**은 그대로이며, 상태는 운영 홈과 원본창고의 `backup-monitor.json`에서 읽는다. |
| 만족 사례 보존 | 같은 확인 작업이 장부 변경 또는 24시간 경과 때 로컬 원본과 기존 보관 기록을 대조한다. 수동 실행은 `npm run check:preservation`, 결과는 `.tmp/preservation/latest.json`. OneDrive 지문 보류와 현재 원격 존재·실제 복원 미확인을 구분한다. |

보관 위치는 [운영 원칙](docs/AI_운영원칙.md#보관-위치)을 따른다. `node tools/이어하기꾸러미.js --재기 --원드라이브`로 문서와 시스템 소스의 복사 후보·제외 사유를 확인한다. `--재기`를 빼면 OneDrive에 사본을 갱신한다. 범위는 SYNK-appsscript·SYNK-talk·SYNK-website의 현재 소스와 원본창고 최상위 운영 스크립트이며, 미디어·비밀값·빌드·캐시·Git 이력은 제외한다. 실제 클라우드 동기화 완료는 별도로 확인한다.

라이브 배포가 요청되면 기존 deploy 도구를 사용한다. `clasp pull`은 로컬 작업본을 덮어쓴다.
