# 가족 앨범 원본 참조·재시도 회귀

2026-10-06. 코어 읽기 검수 P1-A의 삭제 → 되돌리기 실패와 불필요한 재업로드를 수정했다. 실제 Chrome과 합성 계정/Storage를 사용했으며 원격 공급자 업로드·운영 배포는 하지 않았다.

## 수정 계약

- `family-album/account-media.mjs`는 서버 저장의 검증된 성공 ACK 뒤에만 이전 manifest에서 빠진 원본 참조를 캐시에서 제거한다. 저장 실패나 아직 끝나지 않은 변환은 정상 참조를 지우지 않는다. 공유하는 사진은 마지막 페이지 참조가 사라질 때만 제거한다.
- 계정 앨범 전체 삭제가 성공하면 캐시도 비운다. 계정 전환·로그아웃은 진행 중인 이전 계정 파일 작업의 캐시 반영을 막는다.
- 서버 `ASSET_NOT_FOUND`/`ASSET_NOT_CONFIRMED`는 요청에 들어온 해당 `assetId`만 반환한다. 브라우저·네이티브·동기화 모듈에서 UUID만 보존하고 **저장 다시 시도**는 그 참조만 다시 업로드한다. 다른 원본과 임의의 공급자 오류 필드는 복사하지 않는다.
- 앨범이 아닌 페이지·원본 삭제를 되돌릴 때도 같은 규칙을 따른다. 서버가 이미 지운 원본은 열린 앨범의 실제 바이트로 다시 보관하며 옛 참조를 되살리지 않는다.

## 확인 결과

| 범위 | 결과 | 확인 내용 |
|---|---|---|
| 실제 Chrome 개인 3앱 회귀 | 76/76 | [결과](personal-apps-20261006/results.json), 브라우저 예외·실패 리소스 0 |
| 앨범 캐시·서버 공개 경로·브라우저 계정/미디어 | 22/22 | 캐시 7, 서버 3, 계정 4, 미디어 8개 |
| 네이티브 인증·미디어 브리지 | 48/48 | PKCE 기존 회귀와 UUID 오류 전달·공급자 필드 제외 |

브라우저 mock도 성공한 저장에서 빠진 원본을 즉시 지우고, 미참조 업로드를 포함한 **20MiB·60개** 한도를 적용한다. 각 5MiB의 서로 다른 실제 바이트를 가진 사진 세 장을 넣었다. 한 장 삭제 후 10MiB, 되돌리기 후 15MiB/3파일이었으며 다시 올린 파일은 한 개였다. 사진 빼기 후 같은 파일 추가, 서버에서 사라진 한 원본의 명시 재시도, 앨범 전체 삭제 후 같은 JSON 가져오기도 15MiB/3파일로 저장됐다. 정상 두 사진의 assetId는 유지했다.

단위 시험은 늦은 삭제 ACK보다 먼저 변환된 되돌리기 문서, 저장 실패 후 되돌리기, 공유 사진, 계정 전환 중 늦은 업로드, 같은 사진의 동시 변환도 확인한다. 기존 미저장 기록은 한 개라도 직접 선택하고, 비로그인 상태에서는 복구 파일 내보내기·삭제를 숨기는 최신 계정 계약을 브라우저 회귀에 반영했다.

```powershell
node --test experiences/family-album/tests/account-media.test.mjs experiences/family-album/tests/server.test.mjs experiences/synk-account/tests/personal-account.test.mjs experiences/synk-account/tests/personal-media.test.mjs
node --test desktop/tests/auth.test.cjs desktop/tests/personal-account.test.cjs
node experiences/synk-account/qa/personal-apps-smoke.cjs
```

backend의 오류 `assetId` 수정과 소유·revision 유지 검사는 공용 작업본/분리 릴리스 후보 양쪽에 반영했다. 최종 runtime 재생성과 전체 backend 검사·코어 재검수는 루트 담당의 통합 결과를 따른다. 이 문서는 운영 정리 작업이나 실제 알림·실기기 성공의 증거가 아니다.
