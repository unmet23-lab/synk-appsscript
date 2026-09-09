# 마스코트 원본 Drive 이관

상태: **진행 중**. 전체 완료 기록이 아니다.

- 원본 폴더: `docs/Loom_자산/옷`
- [Drive 보관 폴더](https://drive.google.com/drive/u/0/folders/1DE-dLlD1FEoUmopDFS0ayTuJpZhINn9B)
- 최초 목록: `옷_manifest.json` — 8,248개, 30,628,437,390바이트, 원본별 SHA-256.
- 이관 계획: `pack-plan.json` — 원본 이미지 6,353개, 30,104,140,261바이트, ZIP 76개.
- 로컬 유지: 앱용 AVIF 및 설명 자료 1,895개. 현재 승인된 본체 자산 `docs/캐릭터/정본_4K`는 제작 코드의 직접 참조를 확인해 유지한다.
- 각 `mascot-NNNN.json`은 묶음 생성·검증 증거이며 업로드 완료 증거가 아니다.
- 각 `mascot-NNNN-reclaimed.jsonl`의 `remote-sha256-verified`는 Drive에서 다시 읽어 묶음 확인값이 일치한 기록이다. `reclaimed`만 실제 로컬 원본 회수 기록이다.
- 원본은 이름·재질·색·해상도를 바꾸지 않은 ZIP에 원래 상대경로로 들어 있다. 각 ZIP의 `MANIFEST.json`에도 원본 확인값이 들어 있다.

실제 원격 복원 시험: 첫 묶음의 `GPT_표정_누끼_틀/까몽_1급배지코트+3급왕관_감동.png`를 기존 경로에 복원해 SHA-256 일치를 확인했다. 이 시험 파일 한 장은 로컬에 남긴다.

작업 전용 `accessibility-20260909` 사본의 동일 PNG를 확인하고 Git 부분 체크아웃으로 불필요한 복제 자산을 회수해 약 3.3GiB를 먼저 확보했다. 다른 작업이 병행되므로 C: 전체 여유 공간 증감을 이번 이관량으로 계산하지 않는다.

## 다시 이어서 진행할 때

Chrome의 Drive 업로드 탭을 유지한다. 전송 중인 `transfer/` ZIP을 먼저 지우지 않는다. 이미 만들어진 묶음 번호와 원격 확인 기록을 읽고 남은 것만 처리한다.

```text
python -B tools/drive-mascot-archive.py pack 다음번호
python -B tools/drive-mascot-archive.py reclaim 업로드완료번호
python -B tools/drive-mascot-archive.py restore "원래/상대경로.png"
```

`reclaim`은 원격 묶음 확인값과 로컬 원본의 크기·수정시각·내용을 확인한 파일만 회수한다. 작업 도중 바뀐 원본은 보존한다. Drive의 ZIP은 삭제하지 않는다. `restore`는 기존 파일을 덮어쓰지 않고 해당 원본의 확인값을 검사한다.

검증: `python -B -m unittest discover -s tests -p test_drive_mascot_archive.py` — 원격 손상·원본 변경 시 보존, 정상 회수·복원, 경로 이탈 차단 4건 통과.
