# 이미지 생성·영상 비용 검토·H3 신청 종료 기록

작업일: 2026-10-07, 한국 시간. 사용자의 「종료하고 커밋해줘」 요청으로 정리했다.

## 완료와 확인 범위

- Higgsfield에서 표시하는 GPT Image 2.5 / `sunburst`로 이미지 5장을 생성했다. 본인 얼굴 참고 이미지 1장은 `high / 2k`, 새 성인 여성 2명·남성 2명은 각각 `low / 1k`다. 저장된 생성 작업 JSON 5개 모두 `completed`이며, 생성 설정을 다시 확인했다. 동일한 품질 설정으로 만든 비교 자료는 아니다.
- 월 목표는 완성 영상 100초 × 20편 = 2,000초다. 10초 컷을 가정하면 채택 컷 200개이며, 컷마다 3번 생성하는 비용 시나리오는 600회다. 편집·이미지·저장 공간 비용과 실제 채택률은 별도다.
- Higgsfield·MiniMax API·GPU 대여의 비용 구조를 검토했다. GPU 대여가 항상 더 저렴하다고 확정하지 않았으며, 실제 H3 실행 시간과 채택 품질은 측정하지 않았다.
- 한국에서 직접 실행하기 위한 MiniMax H3 공식 신청서를 작성했다. 필수 약정 내용을 보여드린 뒤 사용자의 「웅 제출해」 승인을 받아 제출했다. 공식 화면의 **Request Submitted**와 신청 이메일로 회신하겠다는 안내를 확인했다.
- 현재 신청 기록은 `submitted_awaiting_review`, `submitted: true`, `license_granted: false`다. **접수 완료이며 라이선스 승인 완료는 아니다.** 신규 GPU 대여·결제·구독·모델 설치는 진행하지 않았다.

## 로컬 결과와 재개 위치

이미지 원본: `output/imagegen/20261007-sunburst-models/`

| 파일 | 대상 | 생성 설정 |
|---|---|---|
| `01-yuho-sunburst-high-2k.png` | 본인 얼굴 참고 이미지 | high / 2k |
| `02-woman-a-sunburst-low-1k.png` | 새로운 성인 여성 A | low / 1k |
| `03-woman-b-sunburst-low-1k.png` | 새로운 성인 여성 B | low / 1k |
| `04-man-a-sunburst-low-1k.png` | 새로운 성인 남성 A | low / 1k |
| `05-man-b-sunburst-low-1k.png` | 새로운 성인 남성 B | low / 1k |

같은 폴더의 `*-job.json`, `prompts/`, `all-prompts.txt`에 생성 기록과 지시문이 있다. 이 폴더는 기존 `.gitignore`의 `/output/` 규칙대로 로컬에 보존한다.

H3 신청의 로컬 기록: `output/licensing/minimax-h3/20261007/application-status.json`, 접수 증거: `application-submitted.jpg`. 신청자 연락처와 신청서 화면은 이 Git 기록에 복사하지 않는다. 원본 파일의 경로·해시와 생성 결과 메타데이터는 [artifact-manifest.json](artifact-manifest.json)에 기록했다.

## 남은 일

1. 신청 이메일로 도착하는 MiniMax 회신에서 승인 여부, 허용 범위, 추가 조건과 비용을 확인한다. 공식 화면에는 구체적인 회신 기한이나 신청 비용이 표시되지 않았다.
2. 승인된 조건을 확인한 뒤 GPU 대여 후보의 당시 가격·VRAM·저장 비용을 비교한다. 비용이 드는 시험은 예상 비용과 한도를 먼저 확인한다.
3. 같은 입력 이미지와 설정으로 짧은 H3 시험을 실행해 실제 생성 시간·사용 가능한 구간·전체 비용을 측정한다. 이 결과로 월 2,000초 제작 예산을 다시 계산한다.

## 확인한 공식 경로

- [MiniMax H3 라이선스 Q&A](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/QA-about-License.md)
- [MiniMax H3 라이선스 원문](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE)
- [한국 등 제외 지역의 공식 신청서](https://platform.minimax.io/h3-license)

작업 종료 시 이미지 5개의 생성 상태·설정, PNG 크기, 원본 해시와 신청 접수 상태를 확인했다. 이미지 생성 결과가 영상 품질을 보장하지 않으며, GPU 성능·영상 재생 품질·라이선스 승인 여부는 후속 확인 사항이다.
