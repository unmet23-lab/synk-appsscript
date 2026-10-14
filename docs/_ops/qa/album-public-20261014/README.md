# 가족 이야기 앨범 공개 · synk.im/album · 2026-10-14

유호님 「앨범도 synk.im/album으로 공개해 줘」. 운세·플레저·리허설과 같은 시그널 판 공개 빌드로 [synk.im/album](https://synk.im/album/)을 열었다. 공개 커밋은 synk-policy `63186643`이고, 「synk.im 배포 점검」 38555097783이 성공했다.

## 바꾼 것

| 곳 | 내용 |
| --- | --- |
| 운영 SYNK ID | 기존 `family-album-browser` 공개 클라이언트(`0f9f91d5-…`, 제품 매핑 `platform`)에 콜백 `https://synk.im/album/` 하나만 더했다. 새 클라이언트, 제품 매핑(`SYNK_OAUTH_CLIENT_PRODUCTS`), 운세 허용 목록은 바꾸지 않았다. 적용 전에 대응표 지문·전체 클라이언트 23개 지문·콜백 충돌을 대조했고, 요청 전에 공용 기록에 남긴 뒤 PUT 한 번, 다시 읽어 확인했다([계획](callback-plan.json)). 공용 기록 `tools/synk-id/state/provision-production.json`에는 새 키 `publicAlbum`만 늘었다. |
| synk.im/id/config.json | 앨범 클라이언트의 동의 목록에 같은 콜백 한 줄. |
| synk.im/album/ | `tools/prepare-personal-public.mjs album` 결과 27개 파일([빌드 기록](album-build-manifest.json)). Core 두 원본(`atlas/ask.js`·`atlas/domain.js`)은 고전 스크립트 대신 묶음 안에 넣고 같은 전역 이름으로 둔다. 소장본 스타일은 `takehome.mjs`의 `BOOK_CSS`를 `takehome.css`로. CSP는 사진 `data:`, 목소리 `blob:`·`data:`만 더 연다. 다른 세션의 미커밋 계정 모듈이 섞이지 않게 원격 master 사본으로 빌드했다. |
| 웹 플랫폼 `account/dist/platform.js` | 앨범 혜택 항목의 상태 글·`publicUrl`·이용 안내와 공개 주소 허용 목록(`PUBLIC_ENTRIES`)만 바꿨다. 「가족 이야기 앨범 웹에서 시작」 링크가 생긴다. |
| 설치 앱 | `desktop/renderer/benefits.mjs` 앨범 항목, `desktop/src/public-apps.cjs`·`member-benefits.mjs` 허용 목록. 같은 날 [Platform 0.4.13](../platform-auto-update-20261014/album-0.4.13/README.md)으로 공개해 앱의 앨범 소개도 공개 웹을 연다. |
| 앨범 앱 | 사진·목소리를 담을 때 안내가 「목소리을」로 나오던 조사 오류를 고쳤다. |

## 확인

- 시험: 공개 빌드 11개(앨범 2개 추가), 앨범 앱 103개(+서버 4개는 작업본에서), 혜택·공개 앱·미리보기 24개, 0.4.12 동결 원문 사본에 새 혜택 글을 얹은 런처·미리보기 93개 통과. 작업본의 일부 시험은 다른 세션의 미커밋 변경 때문에 깨져서 원격 master·동결 원문 사본에서 돌렸다.
- 공개 전: 헤드리스 Chrome에서 synk.im의 세 경로만 후보로 바꿔 끼우고 PC·휴대폰 폭, 로그인 이동, 플랫폼 링크를 확인했다. 앱 미리보기에서는 비회원으로 이야기 주인 정하기 → 오늘의 질문 → 사진·목소리 담기 → 저장 → 소장본까지 열었다.
- 공개 뒤([결과](live-check.json)): PC·휴대폰 폭 모두 오류 0·가로 넘침 없음([PC](album-1440.png), [휴대폰](album-390.png)). 「SYNK ID로 로그인」은 운영 인증 서버에 `client_id=0f9f91d5-…`·`redirect_uri=https://synk.im/album/`·S256으로 요청하고, 인증 서버가 받아들여 SYNK ID 로그인 화면(synk.im/id/)으로 넘어갔다. 공개 `index.html`·`app.mjs`·`config.json`·`platform.js`는 커밋한 바이트와 같다. [플랫폼 앨범 소개](platform-album.png)에 공개 링크가 보인다.
- 실제 계정으로 로그인해 저장·원본 보관을 해 보는 확인은 하지 않았다(계정 입력은 유호님 몫).
