# LiveKit 브라우저 SDK 사본

직원 통화 화면(`../../voice.js`)이 통화를 시작할 때만 불러오는 공식 배포 파일이다. 별도 빌드나 수정 없이 npm 패키지의 `dist` 파일을 옮겼다.

| 항목 | 값 |
|---|---|
| 패키지 | `livekit-client@2.22.4` (2026-10-09 배포, Apache-2.0) |
| 받은 곳 | `https://registry.npmjs.org/livekit-client/-/livekit-client-2.22.4.tgz` |
| 패키지 무결성 | `sha512-UJ5K8gqP8uIO+tjhGeF+s6SzgLfxZKPxQjSqzzkF298QNYMnhYmXGQRMMh3GnsfaeswnsHHMSogMeb7SocH2zw==` (npm 레지스트리 값과 일치 확인) |
| `livekit-client.esm.js` | 원본 `dist/livekit-client.esm.mjs`, SHA-256 `13dba7e174d59892a6cd8f0647fc132fe56da4e065c60d7bd7aaa3ce15009d54` |
| `livekit-client.e2ee.worker.js` | 원본 `dist/livekit-client.e2ee.worker.js`(일반 worker용), SHA-256 `dc707d8e2b2174a92f3f8152e64a29d23cc9817a30f7169697f0a546999999cc` |
| `LICENSE` | 패키지의 Apache-2.0 원문 |

메신저 서버의 정적 파일 MIME 목록에 `.mjs`가 없어 ESM 파일만 `.js`로 이름을 바꿨다. 내용은 바이트 단위로 같다. 소스맵은 넣지 않았다. 원본 ESM에는 CRLF 줄이 섞여 있어, 저장소의 `.gitattributes`가 이 폴더를 `-text -diff`로 두어 Git이 줄끝을 바꾸지 않게 한다.

2.23.0(2026-10-16)은 확인일 기준 하루 전 배포라 쓰지 않았다. 2.22.3과 2.22.4의 `src/e2ee`는 같고, 2.22.4는 연결·신호 쪽 수정이 더해진 판이다. 판을 올릴 때는 같은 방식으로 무결성과 해시를 다시 적고 [QA](../../../QA.md)의 통화 화면 시험을 다시 돌린다.
