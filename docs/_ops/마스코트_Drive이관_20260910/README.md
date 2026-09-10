# 마스코트 원본 Drive 이관

상태: **완료**. 2026-09-10에 76개 묶음의 원격 확인값을 모두 검증하고 로컬 정리를 마쳤다.

- 원본 폴더: `docs/Loom_자산/옷`
- [Drive 보관 폴더](https://drive.google.com/drive/u/0/folders/1DE-dLlD1FEoUmopDFS0ayTuJpZhINn9B)
- 최초 목록: `옷_manifest.json` — 8,248개, 30,628,437,390바이트, 원본별 SHA-256.
- 이관 계획: `pack-plan.json` — 고해상도 원본 이미지 6,353개, 30,104,140,261바이트, ZIP 76개.
- 원격 결과: ZIP 76개, 30,106,659,027바이트. 76개 모두 Drive에서 다시 읽은 크기와 SHA-256이 영수증과 일치한다.
- 로컬 회수: 6,352개, 30,097,763,805바이트(28.031GiB). 빈 폴더 28개와 모든 전송용 ZIP·임시 파일도 정리했다.
- 안전 보존: `GPT_표정_누끼_틀/까몽_1급배지코트+3급왕관_감동.png` 1개, 6,376,456바이트. 최초 목록 뒤 수정시각이 바뀌어 작업 보호 규칙에 따라 남겼다. 현재 내용은 보관본 SHA-256과 같다.
- 상시 로컬 유지: 앱용 AVIF와 JSON 등 1,895개, 524,297,129바이트. 현재 승인 본체 `docs/캐릭터/정본_4K`, 제작 후보 `docs/캐릭터/정본_4K_후보`, 요소 공방 `docs/캐릭터/요소공방_0822`도 직접 제작 참조가 있어 이번 이관에서 제외했다.
- 기계 판독 완료 기록: `MIGRATION-COMPLETE.json`.

각 `mascot-NNNN.json`은 묶음의 파일 목록·크기·SHA-256을 담은 영수증이다. 각 `mascot-NNNN-reclaimed.jsonl`의 `remote-sha256-verified`는 Drive에서 다시 읽은 묶음 확인값이 일치한 기록이며, `reclaimed`만 실제 로컬 원본 회수 기록이다. ZIP은 이름·재질·색·해상도를 바꾸지 않고 원래 상대경로를 유지하며 내부 `MANIFEST.json`에도 파일별 확인값이 들어 있다.

실제 원격 왕복 시험은 `편집시험/까몽_몽골모자_kontext.png` 40,626바이트를 `mascot-0075.zip`에서 자동 복원하고 SHA-256 `533fa504a723d72cbdf29dc93ea2c6a2609b2e3288d6c213e1306415e4d27c6d`을 확인한 뒤 다시 회수하는 방식으로 통과했다. 기존 파일은 자동 복원이 덮어쓰지 않는다.

작업 전용 `accessibility-20260909` 사본의 동일 PNG를 확인하고 Git 부분 체크아웃으로 불필요한 복제 자산을 회수해 약 3.3GiB를 먼저 확보했다. 다른 작업이 병행되므로 C: 전체 여유 공간 증감을 이번 이관량으로 계산하지 않는다.

## 복원과 다음 작업

PNG/JPG/WebP 원본이 필요한 제작 도구는 `tools/mascot_originals.py` 또는 `tools/lib/마스코트원본.js`를 통해 필요한 파일만 원래 경로로 복원한다. 현재 로컬 파일이 있으면 항상 그 파일을 우선하며, Drive 연결이나 확인값 검사가 실패하면 제작을 중단한다.

```text
python -B tools/drive-mascot-archive.py restore "GPT_표정_누끼_틀/실제파일명.png"
python -B tools/drive-mascot-archive.py restore-many "상대경로1.png" "상대경로2.png"
python -B tools/drive-mascot-archive.py restore-prefix "GPT_표정_누끼"
```

`restore`와 자동 복원은 기존 파일을 덮어쓰지 않는다. `restore-many`는 요청 중 보관 목록에 없는 파일이 하나라도 있으면 아무것도 쓰기 전에 거절한다. `restore-prefix`는 폴더 단위 제작에 쓴다. 복원 전에 필요한 용량과 512MiB 여유 공간을 확인한다.

검증 결과:

- 이관 안전·복원 단위 시험 7건 통과.
- 의상 경로·모델 고정·이어하기·라디오 런타임 Node 시험 31건 통과.
- 의상 알파·표정·라디오 합성 Python 시험 44건 실행: 40건 통과, 실물 원본 비상주 조건 4건 건너뜀.
- 관련 Python 19개 구문 검사와 Node 7개 구문 검사 통과.
- 실제 Drive 원본 1개 복원 → SHA-256 대조 → 재회수 왕복 시험 통과.
