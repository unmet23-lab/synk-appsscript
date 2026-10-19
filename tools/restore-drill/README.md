# 격리 복원 시험

원격에서 내려받은 암호문을 새 로컬 폴더에 복호화하고, 크기·SHA-256·인증 태그를 확인한다. 운영 데이터나 기존 복원 파일을 덮어쓰지 않는다. Windows의 PowerShell 7(`pwsh`)과 Node.js가 필요하다.

## 실행 순서

1. `%LOCALAPPDATA%\SYNK-Restore-Tests\<새 회차>`에 새 폴더를 만든다. OneDrive·Google Drive 동기화 폴더를 쓰지 않는다. ACL 상속을 끄고 현재 사용자와 필요한 SYSTEM/관리자만 접근하도록 설정한 뒤 `Get-Acl -LiteralPath <폴더>`로 확인한다. **이 도구는 ACL을 자동으로 설정하지 않는다.**
2. 기존 백업 영수증에 따라 원격 계정·소유자·휴지통 여부·크기·해시를 확인하고, 암호문을 해당 회차 폴더에 내려받아 다시 대조한다. 공개키와 암호로 잠긴 개인키는 검증된 OneDrive 복구열쇠 사본을 사용한다. 잠금 해제한 개인키나 암호를 파일에 쓰지 않는다.
3. 아래 필드로 `restore-plan.json`을 만든다. 모든 경로는 절대 경로다. `vault`의 코드를 불러오므로 직접 준비하고 검토한 신뢰할 수 있는 계획만 실행한다.
4. 저장소 루트에서 아래 명령을 실행하고, 마스킹된 로컬 창에 암호를 **한 번만** 입력한다. 한 계획에 담긴 모든 대상이 같은 입력으로 처리된다. 암호는 자식 프로세스의 stdin으로만 전달하며 명령 인수·채팅·파일에 넣지 않는다.

```powershell
pwsh -NoProfile -File .\tools\restore-drill\request-key.ps1 -PlanPath "$env:LOCALAPPDATA\SYNK-Restore-Tests\<새 회차>\restore-plan.json"
```

`root`와 대상 경로에 junction/symlink가 있거나 출력 파일·`.part`·`decrypt-result.json`이 이미 있으면 거부한다. 재시험은 기존 증거를 보존하고 새 회차 폴더에서 준비한다. 완료된 실제 복원을 문서 수정이나 합성 회귀 시험 때문에 다시 실행할 필요는 없다.

## 계획 필드

| 필드 | 값 |
| --- | --- |
| `root` | 위 개인 ACL을 적용한 새 회차 폴더 |
| `vault` | 검증된 `암호.js`가 있는 원본창고 경로 |
| `keyDir` | `공개키.pem`, `비밀키_잠금.json`이 있는 검증된 복구열쇠 폴더 |
| `targets[].kind` | 결과에서 대상을 구분할 이름 |
| `targets[].cipherPath` | `root` 내부의 내려받은 암호문 |
| `targets[].outputPath` | `root` 내부의 아직 존재하지 않는 평문 출력 경로 |
| `targets[].encryptedBytes`, `encryptedSha256` | 백업 영수증의 암호문 크기와 SHA-256 |
| `targets[].plaintextBytes`, `plaintextSha256` | 원본 manifest의 평문 크기와 SHA-256 |

## 완료 증거와 평문 정리

완료 판단은 창이 닫혔는지가 아니라 `root/decrypt-result.json`의 `status: success`, 대상 수, 각 파일의 `authenticatedDecrypt`, 크기·해시로 한다. 키 출처와 원격 보관 계정 검증은 준비 단계 증거를 함께 보존한다. JSON·아카이브 열기, Git 무결성, DB 실제 적재 등 각 형식의 복원 가능 여부는 별도로 확인해야 한다. 복호화 성공만으로 전체 앱 복원이 완료됐다고 하지 않는다.

복원 평문에는 인증 자료나 서버 데이터가 들어 있을 수 있다. 검증이 끝날 때까지 개인 ACL 아래에만 두고 Git·OneDrive·공유 폴더에 복사하지 않는다. 후속 복원 검증과 결과 보존을 마친 뒤 **이번 회차에서 만든 평문과 추출물의 정확한 경로만** 확인해 정리한다. 원격 백업, 잠긴 키, 원래 문서, 복원 영수증은 보존한다. 이 도구는 평문을 자동 삭제하지 않는다.
