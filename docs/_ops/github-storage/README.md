# Git 자산 보관과 복원

소스·승인 정본·생성 입력·복원 목록은 Git에 남긴다. 반복 생성되는 검수 캡처와 정본의 중복 출력은 Git 이력에 계속 넣지 않는다. Git 추적 제외는 로컬 원본 삭제가 아니다.

## 2026-10-17 보관본

[비공개 GitHub Release](https://github.com/unmet23-lab/synk-appsscript/releases/tag/storage-artifacts-20261017)에 ZIP 3개와 [파일별 복원 목록](archive-20261017.json)을 보관한다. 저장소 접근 권한과 해당 계정으로 로그인한 GitHub CLI(`gh`)가 필요하다.

| 구분 | 파일 수 | 압축 전 바이트 |
|---|---:|---:|
| WORLD 앱 과거 검수 캡처 | 495 | 158,590,595 |
| WORLD 홈 과거 검수 캡처 | 144 | 106,094,685 |
| 캐릭터 교정 출력 사본·작은 검수판 | 36 | 314,979,951 |
| 합계 | 675 | 579,665,231 |

18개 4K 출력은 승인 정본과 Git blob이 같은 사본이고, 18개 작은 검수판은 파생 출력이다. 승인 `docs/캐릭터/정본_4K/`, 교정 입력 40개(생성 원본·이전 판·마스크), 앱이 실제로 읽는 자산과 검수 JSON·문서·코드는 유지한다. `qa/`에 있어도 실제 제작 입력으로 확인된 4개 이미지는 제외 규칙의 예외다.

원격에서 ZIP 3개를 다시 내려받아 내부 675개 전체의 SHA-256을 대조하고, 별도 폴더에 675개를 실제 복원했다. 압축 전후 이미지 바이트는 같다. 현재 노트북의 675개 파일도 그대로 남긴다. 상세 결과는 [검증 기록](verification-20261017.json)에 있다.

기존 문서 정리 복구 ZIP과 `codex/document-cleanup-20261017` 브랜치, 기존 모든 브랜치·태그·과거 커밋은 유지한다. 이번 작업은 기본 브랜치의 현재 파일 구성과 앞으로의 누적을 정리한 것이다. 과거 이력을 다시 쓰지 않았으므로 기존 Git 이력의 전체 용량은 줄지 않는다. 전체 이력이 필요한 경우는 기존 clone을 그대로 쓰고, 새 업무용 clone에서 과거 큰 blob이 당장 필요 없으면 `git clone --filter=blob:none --single-branch --branch master git@github.com:unmet23-lab/synk-appsscript.git`을 사용할 수 있다. 과거 파일을 읽을 때는 해당 blob 다운로드가 발생할 수 있다.

## 필요한 파일 복원

저장소 루트에서 Python 3 표준 라이브러리만으로 실행한다. 기본 실행은 목록 요약만 표시하며 다운로드·복원을 하지 않는다.

```powershell
python tools/git-storage-restore.py
python tools/git-storage-restore.py --path "experiences/synk-world-home/qa/graphics-v4-export/roundtrip.png"
python tools/git-storage-restore.py --all
```

`--path`는 목록에 있는 정확한 경로이며 여러 번 지정할 수 있다. 복원한 파일은 계속 Git에서 제외한다. 과거 검수 문서의 이미지 링크나 `graphics-v4-export/manifest.cjs`를 다시 사용할 때 해당 이미지를 먼저 복원한다.

같은 해시의 기존 파일은 건너뛰고 누락 파일이 있는 ZIP만 받는다. 기존 파일이 다른 내용이면 덮어쓰지 않고 전체 복원 전에 중단한다. 다른 폴더로 비교 복원하려면 `--destination .tmp/restored-evidence`를 지정한다. `--cache`로 다운로드 캐시 위치를, `--archive-dir`로 이미 보관한 ZIP 폴더를 지정할 수 있다. `--verify-archives`는 ZIP과 내부 모든 파일을 검증하며 목적지 파일을 만들지 않는다.

ZIP 크기·SHA-256·내부 파일 크기·SHA-256을 모두 확인한다. 경로 이탈·중복 경로·심볼릭 링크 및 Windows reparse point를 거부하고 기존 파일을 덮어쓰지 않는다.

## 앞으로 커밋할 때

```powershell
npm run check:storage
node tools/git-storage-check.cjs --base origin/master --head HEAD
```

첫 명령은 실제 staged 파일, 두 번째는 원격 기준 이후 모든 커밋을 검사한다. 커밋 중간에 추가했다가 지운 큰 파일도 검사한다. 별도 인덱스를 쓸 때는 같은 `GIT_INDEX_FILE`과 `--base <기준커밋>`을 지정한다. 정책은 작업 폴더의 미커밋 내용이 아니라 검사 대상 인덱스·커밋에서 읽는다.

[정책](../../../tools/git-storage-policy.json)은 새 blob 하나 10MiB, 한 범위의 고유 새 blob 합계 50MiB를 기본 한도로 둔다. QA 이미지, 지정한 교정 파생 사본, 영상·ZIP·3D 결과물은 크기가 작아도 새 Git 이력에 넣지 않는다. 기존에 있던 큰 정본은 그대로 두며, 새로 변경되는 큰 파일은 검사 대상이다. `.gitignore`는 아직 추적하지 않는 파일을 막고 검사는 이미 추적하던 파일의 변경도 잡는다.

꼭 필요한 새 원본은 원본 창고·해당 작업의 보관 위치에 먼저 안전하게 보관한다. Git에도 필요한 파일이면 용도·실제 참조를 확인하고 정책의 `exceptions`에 정확한 `path`, `sha256`, `reason`을 기록한다. 폴더 전체를 예외로 풀거나 원본을 지워서 검사를 통과시키지 않는다. 새로운 검수 결과 중 보존할 기록은 필요한 것만 검증 가능한 보관본과 목록으로 남긴다.

부분 복제에서 검사할 Git 객체가 없으면 기본 검사는 실패한다. 설정된 원격의 객체 다운로드를 허용할 때만 `--allow-lazy-fetch`를 사용한다. 기존 `syntax-check` 워크플로에 검사·도구 시험을 연결했고, `blob:none` 체크아웃에는 이 옵션을 명시한다. 이 비공개 저장소의 기존 `SYNK_SELFHOSTED` 실행 조건을 유지했으므로 CI가 항상 실행된다는 뜻은 아니다. 자동 hook·유료 러너·계정 설정은 추가하지 않는다.
