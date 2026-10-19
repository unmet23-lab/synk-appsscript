# Git 자산 보관과 복원

소스·승인 정본·생성 입력·복원 목록은 Git에 남긴다. 반복 생성되는 검수 캡처와 정본의 중복 출력은 Git 이력에 계속 넣지 않는다. Git 추적 제외는 로컬 원본 삭제가 아니다.

2026-10-17부터 클라우드 보관 위치는 [AI 운영 원칙 · 보관 위치](../../AI_운영원칙.md#보관-위치)를 따른다. OneDrive에는 문서·시스템 소스, Google Drive 두 계정에는 미디어 원본을 둔다. 기존 Git 승인 자산과 복구 릴리스는 유지하며, 새 미디어를 OneDrive로 복제하지 않는다.

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

첫 명령은 실제 staged 파일, 두 번째는 원격 기준 이후 모든 커밋을 검사한다. 커밋 중간에 추가했다가 지운 큰 파일도 검사한다. 별도 인덱스를 쓸 때는 같은 `GIT_INDEX_FILE`과 `--base <기준커밋>`을 지정한다. 정책은 작업 폴더의 미커밋 내용이 아니라 검사 대상 인덱스·커밋에서 읽는다. `node tools/내커밋.js`의 `커밋`·`올리기`는 이 두 검사를 같은 기준으로 안에서 돌린다([git 노트](../../현장노트/git_줄끝_잠금.md#절차--공용-작업본에서-내-것만-커밋하기)).

[정책](../../../tools/git-storage-policy.json)은 새 blob 하나 10MiB, 한 범위의 고유 새 blob 합계 50MiB를 기본 한도로 둔다. QA 이미지, 지정한 교정 파생 사본, 영상·ZIP·3D 결과물은 크기가 작아도 새 Git 이력에 넣지 않는다. 기존에 있던 큰 정본은 그대로 두며, 새로 변경되는 큰 파일은 검사 대상이다. `.gitignore`는 아직 추적하지 않는 파일을 막고 검사는 이미 추적하던 파일의 변경도 잡는다.

꼭 필요한 새 원본은 원본 창고·해당 작업의 보관 위치에 먼저 안전하게 보관한다. Git에도 필요한 파일이면 용도·실제 참조를 확인하고 정책의 `exceptions`에 정확한 `path`, `sha256`, `reason`을 기록한다. 폴더 전체를 예외로 풀거나 원본을 지워서 검사를 통과시키지 않는다. 새로운 검수 결과 중 보존할 기록은 필요한 것만 검증 가능한 보관본과 목록으로 남긴다.

부분 복제에서 검사할 Git 객체가 없으면 기본 검사는 실패한다. 설정된 원격의 객체 다운로드를 허용할 때만 `--allow-lazy-fetch`를 사용한다. 기존 `syntax-check` 워크플로에 검사·도구 시험을 연결했고, `blob:none` 체크아웃에는 이 옵션을 명시한다. 이 비공개 저장소의 기존 `SYNK_SELFHOSTED` 실행 조건을 유지했으므로 CI가 항상 실행된다는 뜻은 아니다. 자동 hook·유료 러너·계정 설정은 추가하지 않는다.

## 임시 사본 정리 후속 확인(2026-10-17)

검증용 사본 678파일·1,156,681,695B와 추가 Electron 중복 9파일·97,889,040B는 삭제하지 않았다. 원본·복구본을 다시 대조했지만 삭제 명령은 실행 전에 `blocked by policy`로 거절됐으며, 세부 사유는 제공되지 않았다. [Claude 인계문](임시사본정리_Claude인계_20261017.txt)과 [검토 요약·후보 목록](cleanup-review-20261017.json)에 보존 근거·실제 오류·남은 일을 기록한다. 원본과 GitHub 복구 릴리스는 유지한다.

## 자동 커밋 이력 보존(2026-10-18)

`node tools/GitHub백업.cjs --apply`는 Documents 바로 아래 Git 저장소의 모든 로컬 가지·stash·연결 worktree HEAD를 원격 참조와 대조한다. 기존 `백업.js`의 master 전용 강제 push를 예약에 쓰지 않는다. 현재 작업 파일을 커밋하거나 공용 HEAD·인덱스·기본 가지를 이동하지 않는다. 미커밋 문서·소스의 최신 사본은 OneDrive 백업이 맡는다.

- 원격에 없는 기존 커밋만 비공개 원래 저장소의 `refs/synk-backup/<커밋 SHA>`에 보존하고 정확한 원격 SHA를 다시 조회한다. branch/tag 밖의 고정 참조이므로 일반 배포 가지를 갱신하지 않으며 force·덮어쓰기·자동 삭제를 하지 않는다.
- 새 객체는 커밋된 Git 용량·산출물 정책으로 검사한다. 앱이 사용하는 정본 그림·음성·WASM은 정책 내에서 보존하며, 새 QA 출력·큰 묶음·실제 자격증명이 포함된 이력은 보류한다. 중간 커밋에서 추가했다가 지운 파일도 검사한다. 더미 자격 문자열은 경로와 값 SHA로 검토한 예외만 허용하고 실제 공급자 키 서명은 계속 막는다.
- 비공개 저장소의 정책상 보류된 가지·stash·detached HEAD는 `Git보관묶음.cjs`가 Git bundle 표준출력을 기존 사용자 공개키로 바로 암호화해 원본창고 `Git-보관`에 추가한다. 평문 bundle 파일을 쓰지 않는다. 같은 ref·SHA 선택은 기존 암호문을 재사용하며 파일을 덮어쓰지 않는다. 매일 Drive 20TB 원본 백업이 암호문과 manifest를 전송한다. detached HEAD는 별도 임시 bare 메타데이터가 원 저장소의 객체를 읽게 하고 그 임시 장소에만 `refs/synk-detached/<SHA>`를 만들어 담는다. 원 작업본의 refs·HEAD·인덱스는 바꾸지 않으며 manifest의 `sourceMappings`에 원래 detached 표시와 bundle ref를 연결한다.
- 대체 보존은 Drive `Git-보관/verify-status.json`의 두 파일 모두 소유 계정·파일 ID·크기·MD5·가능한 SHA256이 실제로 일치하고, 생성 이후 36시간 이내 검증됐을 때만 `encrypted-drive-verified`로 기록한다. 그 전에는 보존 성공으로 기록하지 않는다. 복원에 필요한 GitHub 선행 커밋도 `refs/synk-backup`에 고정하고 매번 원격 SHA를 다시 확인한다.
- OneDrive가 민감값 때문에 평문 사본에서 제외한 현재 시스템 텍스트도 `보호소스보관.cjs`가 기존 공개키로 암호화해 `Git-보관/protected-sources`에 보존한다. 매회 OneDrive의 `상태/OneDrive/protected-sources.json`을 읽고 허용 scope 또는 실제 등록 worktree, 원본 경로·크기·전후 SHA, reparse 경계를 검사한다. 같은 내용은 재사용하고 내용이 바뀌면 새 암호문·manifest를 추가한다. 원문·공용 Git 인덱스를 바꾸지 않는다. 파일별 원격 검증은 `protected-source-backup-status.json`에 기록하고, OneDrive는 현재 경로·SHA·크기가 그 검증과 정확히 같을 때에만 보호 원문의 보존 완료로 본다.
- `--apply`가 생성된 암호문의 원격 검증 대기를 발견하면 Windows의 `SYNK Git 암호문 백업` 작업을 시작한다. 이미 실행 중이면 중복 시작하지 않는다. 이 작업은 기존 Drive 전송잠금을 공유해 `Git-보관`만 계획·전송·검증하고 `--check`로 상태를 갱신한다. 따라서 다음 날 미디어 백업까지 기다리지 않는다. 작업이 실제 활성·실행 중이고 시작 후 6시간 이내이며 다른 문제가 없는 검증 대기는 `pending`으로 기록한다. 완료 전에는 성공으로 세지 않지만 정상 전송을 실패로 알리지 않는다. 작업 누락·비활성·시작 실패·6시간 초과 대기와 실제 원본 변경·원격 지문 불일치는 오류로 남긴다. `--check`는 작업 상태를 조회할 수 있지만 전송 작업을 시작하지 않는다.
- 공개 저장소에는 push하지 않는다. 미게시 가지·stash·detached 커밋이 생기면 같은 암호화 Drive 경로로 보존한다. 공개 branch/tag가 나중에 바뀌어도 복원할 수 있도록 선행 커밋이 필요 없는 완전 bundle을 만들며, 공개 원격에 새 ref를 만들지 않는다. 전체 조상 이력을 포함해 증분보다 클 수 있지만 같은 선택은 재사용하고 미게시 커밋이 없으면 만들지 않는다. 등록된 소유자의 GitHub 원격만 다루며, 다른 원격·인증 실패·누락 객체는 성공으로 세지 않는다.
- 상태는 원본창고 `github-backup-status.json`에 실행 PID·현재 상태·검사 시각·마지막 전체 성공·원격 검증과 보류 사유를 기록한다. PID 잠금으로 동시 실행을 막는다. 원격 쓰기 없이 검사하려면 `--check`를 쓴다. 반복 예약·실패 알림은 [복원 안내](../../컴퓨터를%20잃어버렸을%20때.md)의 네 보관처 운영을 따른다.

일반 clone은 이 사용자 정의 참조를 자동으로 가져오지 않는다. 별도로 복제한 복원 폴더에서 아래 순서로 원하는 SHA를 가져온다. 기존 작업본에서 checkout하지 않는다.

```powershell
git ls-remote origin "refs/synk-backup/*"
git fetch origin refs/synk-backup/<40자리-커밋-SHA>
git switch -c recovered-YYYYMMDD FETCH_HEAD
```

10-18 실제 쓰기·원격 재조회, 기존 기본 가지 유지 및 새 Actions 실행이 생기지 않은 기록은 `.tmp/backup-four-20261018/github/`에 있다. 최초 검사 커밋 `28696f1e6275102dccd4ed4a2e8867b922196f9b`의 기존 storage 검사도 299개 새 blob·27,741,623바이트로 통과했다. 이후 정기 실행이 보존한 `537a31b7c9d542b85b16ad05c13dd47d0b202624` 참조는 별도 bare 저장소에 `--filter=blob:none --depth=1`로 실제 fetch해 커밋 SHA가 일치하고 원래 HEAD·refs·인덱스가 그대로임을 확인했다(`remote-fetch-restore.json`). 이는 참조 fetch 검증이며 전체 작업 파일의 복원 검증과는 구분한다. 개별 보관 완료와 과거 보류 이력은 상태 JSON에서 구분한다.

### 암호화된 과거 Git 이력 복원

10-18의 과거 가지 5개와 stash 1개는 고유 새 객체 약 348MB이며, 암호문 151,791,082바이트로 보존했다. 로컬 영수증은 `C:/Users/q1212/Documents/SYNK_원본창고/Git-보관/SYNK-appsscript/e5359b49738f2abdb861818a54d02367b7dd01eb14111732d6bb59180a59ae57.manifest.json`이다. 원문·암호문 SHA256, 원래 6개 ref와 SHA, 선행 커밋 5개와 원격 고정 ref를 기록한다. Drive ID와 실제 전송 상태는 원본창고 `서버_복원목록.json` 및 `상태/Git-보관/verify-status.json`에서 확인한다.

별도 복원 폴더에 암호문과 manifest를 내려받고, 기존 잠긴 비밀키와 사용자의 암호로 푼다. 암호는 자동화에 저장하지 않는다. `암호.js`와 공개키·잠긴 비밀키의 복원 위치는 [컴퓨터 분실 복원 안내](../../컴퓨터를%20잃어버렸을%20때.md)를 따른다.

```powershell
node 암호.js 풀기 <다운로드한.bundle.enc> <복원.bundle>
git clone git@github.com:unmet23-lab/synk-appsscript.git 복원저장소
cd 복원저장소
# manifest.prerequisites의 각 ref를 모두 가져온다.
git fetch origin refs/synk-backup/<선행-커밋-SHA>
git bundle verify <복원.bundle의-절대경로>
git fetch <복원.bundle의-절대경로> refs/heads/<원래-가지>:refs/heads/recovered-YYYYMMDD
# stash도 manifest의 refs/stash에서 별도의 복원 가지로 가져올 수 있다.
# detached는 sourceMappings의 bundleRef를 원래 ref 대신 쓴다.
```

복호화 결과의 SHA256을 manifest의 `plaintext.sha256`과 비교하고, 복원 가지의 SHA가 `heads`의 원래 SHA와 일치하는지 확인한다. 실제 자료는 개인키를 열지 않고 스트림의 bundle 헤더·선행 객체·PACK 체크섬을 검사했다. 임시 열쇠와 가상 저장소로 암호화→복호화→별도 clone에서 원래 파일과 커밋 복원까지 시험했다.

공개 저장소의 미게시 이력 보관본은 `selfContained: true`, `prerequisites: []`다. 이 경우 원격에서 선행 ref를 가져올 필요 없이 새 `git init` 저장소에서 bundle을 검증하고 원하는 ref를 가져올 수 있다. 공개 원격 쓰기 0회, 빈 저장소에서 가지·stash·detached 원문 복원, 원격 검증 전 대기와 검증 후 완료 전환을 가상 저장소로 시험했다. 10-18 현재 공개 3개 저장소는 미게시 이력이 없어 불필요한 bundle을 생성하지 않았다.

`protected-sources`의 개별 `.source.enc`는 Git bundle이 아닌 원래 텍스트 바이트다. 해당 manifest의 `source.scope/root/path`로 복원할 위치를 확인하고, `node 암호.js 풀기 <파일.source.enc> <별도-복원-출력>`으로 푼 뒤 `source.sha256`·`source.bytes`와 비교한다. 원래 경로의 현재 작업 파일은 확인 없이 덮어쓰지 않는다. manifest와 상태에는 경로·지문·보관 증거만 기록하며 민감값은 넣지 않는다.
