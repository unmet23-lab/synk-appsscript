# synk.im Pages 배포 유실 · 1GB 넘김 실측 (2026-11-10 Claude)

11-10 새벽 Vellum 낫표 공개(synk-policy `b2e8f31f`)의 Pages 배포가 여섯 번 연달아 시간 초과로 취소돼, 사이트가 Pages 한도(1GB)를 넘긴 탓인지 가렸다. 결론은 [결정](../../결정.md) 11-10 「synk.im Pages 배포 유실」, 증상 · 고침 · 다시 확인은 [현장 노트 · 배포·공개](../../../현장노트/배포_공개.md) 「syncing_files」 절의 11-10 원인 · 고침에 있다. 여기는 그 숫자의 원자료다.

## 자료

- `deploy시도.tsv` — 11-01부터 11-10 07:12 KST(`5663f740` 배포)까지 Pages 실행의 deploy 작업(모든 시도) 한 줄씩. 칸: 실행 첫줄시각 · 실행 · 커밋 · 실행결론 · 시도 · deploy결론 · deploy시작 · 묶음크기(1GiB를 넘어 `Uploaded artifact size … exceeds the allowed size of 1 GB` 경고가 붙을 때만) · 상태줄(`Current status:` 값이 바뀐 차례, 빈 값은 「(빈칸)」) · 끝줄.
- `날짜별크기.tsv` — 날마다 마지막으로 성공한 배포 커밋의 공개본 파일 수 · 원본 크기(`.github` 뺌, GitHub git trees API의 blob 크기 합) · mp4 합.
- `모으기.sh` — `deploy시도.tsv`를 다시 만든다(`bash docs/_ops/qa/pages-배포유실-20261110/모으기.sh [부터] [출력 폴더]`, gh 로그인 필요). 2,000개 넘는 실행 목록은 `gh run list -L`을 늘린다.

## 숫자 (11-10 07:12 KST까지)

| 본 것 | 값 |
|---|---|
| 08-06~11-03 Pages 실행 817개 | 배포 시간 초과 0 — 실패는 11-01 겹친 공개의 `in progress deployment` 거절(실행 2개 · 시도 4번)뿐(다른 원인) |
| 11-04부터 커밋별 첫 배포 | 121번 중 유실 8번(6.6%) — 빈칸 꼴 5 · 멈춤 꼴(`syncing_files` · `updating_pages`) 3 |
| 1GiB 경고 붙은 첫 배포 / 없던 첫 배포 | 40번 중 유실 2(5%) / 81번 중 유실 6(7.4%) |
| 1GiB 넘은 구간의 연속 성공 | 11-05 04:35~17:31 UTC 19번(실패 없음) · 11-08 20:37~ 17번(11-09 19:14 `ac88c2b2`까지) |
| 유실 뒤 같은 커밋 재시도(`rerun --failed` · `POST pages/builds`) | 빈칸 꼴 뒤 9번 모두 실패 · 멈춤 꼴 뒤 2번 중 1번 성공 |
| 유실 뒤 다음 새 커밋의 첫 시도 | 8번 중 7번 성공(16~104분 뒤) |
| 실패 직전 1시간 Pages 빌드 수 | 1~5개(문서의 시간당 10개 한도와 무관) |
| 11-10 공개본 | 13,321파일 · 원본 1,312.6MB · 묶음 1,155,554,099바이트 |

공개본 파일 수는 11-03 9,494 → 11-04 13,012로 하루에 3,518개 늘었다(`world/korean-racing/assets` +2,505). 유실이 시작된 날과 겹치지만, 같은 때(11-06 · 11-07) 662MB 사이트를 포함한 다른 저장소에도 같은 꼴이 보고됐고 새 커밋으로 풀려([ozirix-dev/Reseptit#348](https://github.com/ozirix-dev/Reseptit/issues/348) · [glojournal-cmyk.github.io#257](https://github.com/glojournal-cmyk/glojournal-cmyk.github.io/issues/257)) GitHub 쪽 문제로 본다. 파일 수 탓을 가르려면 유실률을 파일 수를 줄인 뒤와 견줘야 한다 — 이번에는 하지 않았다.

GitHub 문서(11-10 읽음): 공개 사이트 1GB 상한 · 배포 10분 시간 초과 · 시간당 빌드 10개(브랜치 빌드에만) — <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>.
