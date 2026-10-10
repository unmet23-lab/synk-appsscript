# 싱ㅋ 시그널 2 · PC 설치본 반영 기록 (2026-10-10)

유호님 「PC 설치본에 반영해줘 그리고 푸시해줘」에 따라 현재 PC의 **SYNK Platform Preview 0.4.0** 설치본에 2차 화면을 넣었다.

## 한 일

- 설치된 `%LOCALAPPDATA%\Programs\SYNKPlatformPreview\resources\app.asar`를 풀어, 화면 파일 다섯 개만 2차 판으로 바꾸고 다시 묶어 갈아 끼웠다: `renderer/launcher.css`·`member-home.css`·`convenience.css`·`member-home.mjs`·`index.html`.
- 다른 파일은 손대지 않았다. 묶음 안 파일 73개 중 다섯 개만 달라졌고, 나머지 68개는 바이트까지 같다(`install.json`의 `differingPaths`).
- 바꾸기 전 설치본이 그때의 작업본 원본과 같은지 먼저 봤다. 화면 파일 다섯 개와 패키징 때 생기는 `package.json`·`runtime.json`만 달랐다. 곧 직전 설치(v4)의 코드 위에 화면만 얹은 것이다.
- 교체할 때 SYNK 앱은 실행 중이 아니었다. 설치기(NSIS)·등록·바로가기·WORLD·Workspace 설치는 건드리지 않았고, 버전도 0.4.0 그대로다.

| 항목 | 값 |
|---|---|
| 바꾸기 전 app.asar SHA-256 | `eaa006fec10921cbb2681fd52f791fa1ac3ceb008097a951be684209160cf45e`(직전 재설치 기록과 같음) |
| 바꾼 뒤 app.asar SHA-256 | `c715de9ed040dc974127ef95ba6d629ed574a47a3c104b0b10a5182849f200a5` |
| 원래 묶음 백업 | `%LOCALAPPDATA%\SYNK\platform-signal2-backup-20261010\app.asar`(SHA 같음 확인) |
| 바꾼 뒤 대조 | 설치본 ↔ 공용 작업본 `desktop/` 71개 같음, `package.json`(패키징 값)·`runtime.json`(설치 때 생성)만 다름 |

## 확인

- 바꾼 묶음을 풀어 숨김 Electron(합성 계정·외부 요청 차단)으로 열어 첫 화면이 새 디자인으로 뜨고 글꼴·그림이 모두 불러와지는 것을 봤다.
- 데스크톱 시험 `node --test desktop/tests/*.test.cjs` **507/507**, 웹 계정 시험 `experiences/synk-account` **559/559**(바꾸기 전과 같은 수).
- 숨김 Electron 화면 점검 도구 10개 통과(renderer-responsive · member-home · convenience · convenience-home · benefits · platform-library · platform-input · platform-note-management · connection · desktop-preferences). 다른 5개(app-compaction · development-catalog · experience · fortune-platform · continuity-exit)는 **바꾸기 전 원본에서도 같은 항목에서 실패**한다(앱 9→8개 통합·Ctrl+K 동작 변경 뒤의 옛 기대값). 2개(personal · world-play)는 점검용 작업본에 없는 폴더를 읽어 돌지 않았다.
- 실제 계정으로 로그인한 화면, 설치본을 직접 켠 화면은 확인하지 않았다. 다음에 앱을 켜면 새 화면으로 열린다.

## 되돌리기와 주의

- 되돌리려면 앱을 끈 뒤 백업 `app.asar`를 같은 자리에 다시 복사한다.
- `desktop/artifacts/platform-reinstall-20261010/`의 Platform 재설치 파일은 **바꾸기 전(v4) 화면**을 담고 있다. 그 파일로 다시 설치하면 2차 화면이 사라진다. 새 재설치 파일이 필요하면 이 판으로 다시 묶는다.
