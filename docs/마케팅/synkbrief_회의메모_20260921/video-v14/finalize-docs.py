from pathlib import Path
import json,re
root=Path(__file__).resolve().parent;base=root.parent;marketing=base.parent
meta=json.loads((root/'verification/video-metadata.json').read_text(encoding='utf-8'))
qa=json.loads((root/'verification/preview-qa.json').read_text(encoding='utf-8'))
assert all(not x['errors'] and not x['horizontalOverflow'] and all(y['status']==200 for y in x['downloads']) for x in qa)
assert (root/'verification/full-decode.log').stat().st_size==0
assert (root/'verification/webm-decode.log').stat().st_size==0
log=(root/'verification/audio-loudness.log').read_text(encoding='utf-8');loud=json.loads(log[log.rfind('{'):log.rfind('}')+1])
title='v12 차분한 여성 내레이션'
(root/'README.md').write_text(f'''# synkbrief 01 · {title}

2026-09-23 · {float(meta['format']['duration']):.2f}초·18장면 · 음성 포함 검토본.

[영상 보기](http://127.0.0.1:5197/video-v12/preview.html?revision=15) · [MP4](synkbrief-meeting-v12.mp4) · [10쪽 PDF·자료 ZIP](../follow-along-v11/README.md) · [낭독 대본](낭독대본.md) · [낭독 자막](narration.srt)

사용자가 요청한 차분하고 부드러운 여자 목소리로 Typecast 은경을 사용했다. ssfm-v30, tonedown 0.5, 템포 1.04, 18구간·930자를 합성했다. 기존 Typecast Lite 연결과 크레딧 잔량, 현재 목소리 제공 여부를 확인했다. 원본 WAV와 단어별 시각은 audio/에 보존했다. 직접 청취에 의한 음색 평가는 아직 확인하지 않았으며 사용자가 검토할 수 있도록 실제 음성 샘플과 영상을 제공한다.

음성을 압축하지 않고 실제 길이에 맞춰 112초 영상을 약 140.33초로 조정했다. 자막 47개는 단어 타이밍에 맞췄다. 여덟 UI 장면의 클릭·붙여넣기·저장 효과를 실제 발화 시점으로 옮겼다. 프로젝트 개념, 회의 전용 폴더 비유, 프로젝트별 지침과 계정 전체 지침 구분, 원본과 결과 비교, PDF·댓글 synk 엔딩은 유지했다.

기존 Suno BGM은 유지했다. HyperFrames voiceover carve 0.45로 말소리와 겹치는 음악 대역·볼륨을 자동 조정한다. 뒤쪽 음악 연결은 같은 음원의 시작 부분을 2초 겹쳐 이어 붙이고 마지막 3초를 줄인다. 효과음도 클릭 시점과 함께 이동했다.

## 확인

1080×1920·30fps H.264/AAC. MP4/WebM 전체 디코드 통과. 47자막의 표시·장면 내 위치·음성 잘림 없음, 8개 카메라 장면 28시점의 타깃·커서 일치 확인. 1280/390px 미리보기의 재생·소리 토글·장면 이동·다운로드 통과. HyperFrames check 통과, 오류 0, 기존 단일 HTML 타임라인 등 구조 경고 21건. 음량 {loud['input_i']} LUFS / {loud['input_tp']} dBTP. 검사 기록은 verification/에 있다.

실제 청취 품질 승인·SNS 게시·댓글 자료 자동 전달은 완료하지 않았다. 이전 v11 이하와 PDF 원본을 보존한다. PDF 내용은 v11과 같아 기존 10쪽 자료를 연결한다.

## 재제작

기존 음성을 쓸 때는 추가 합성 없이 `node prepare-voice.cjs`, `npm run build`, HyperFrames 렌더, `node build-preview.mjs` 순으로 진행한다. prepare-voice는 action-markers.json의 실제 발화 위치를 유지한다. 목소리·문장이 달라지면 기존 파일을 덮어쓰지 않고 별도 수정본을 만든다.

새 합성이 필요할 때만 `node voice-connection.cjs`로 localhost 연결 화면을 연다. 키는 메모리에만 보관한다. `node synthesize.cjs`는 이 편의 고정 대본만 생성하며 매 요청 전 월 크레딧 잔량을 확인한다. 연결 여부만 확인하려면 /status를 읽는다. 키를 로그·문서·채팅에 기록하지 않는다.

[Typecast 공식 타임스탬프 API](https://typecast.ai/docs/api-reference/text-to-speech/text-to-speech-with-timestamps), [구독 잔량 API](https://typecast.ai/docs/api-reference/subscription/get-subscription). 확인일 2026-09-23. ChatGPT 내용 근거는 [v11 자료 검토](../video-v11/research-and-review.md)를 따른다.
''',encoding='utf-8')
p=base/'README.md';s=p.read_text(encoding='utf-8');i=s.index('## 이전 v3');s='''# synkbrief 01 · 두서없는 회의 기록을 읽기 쉬운 회의록으로

2026-09-23 최신 · [140.33초 v12 차분한 여성 내레이션](video-v12/README.md). 직접 쓴 메모와 음성 전사 기록을 읽기 쉬운 회의록으로 정리하고, 프로젝트 개념과 규칙 저장·다음 회의 재사용까지 설명한다. Typecast 은경 여성 내레이션, 발음에 맞춘 자막 47개, 클릭·입력 위치 확대와 Suno BGM·효과음 포함. 사용자 음색·최종 검토와 외부 발행 전이다.

[v12 영상 보기](http://127.0.0.1:5197/video-v12/preview.html?revision=15) · [10쪽 PDF와 한글 파일 키트](follow-along-v11/README.md) · [현재 낭독 대본](video-v12/낭독대본.md) · [정보 검토](video-v11/research-and-review.md)

'''+s[i:];p.write_text(s,encoding='utf-8')
p=marketing/'제작양식/AI_활용법.md';s=p.read_text(encoding='utf-8');s=re.sub(r'\| 제작 상태 \|.*', '| 제작 상태 | 2026-09-23 v12: 140.33초·18장면·자막 47개. 차분하고 부드러운 여성 내레이션(Typecast 은경), Suno BGM·효과음, 10쪽 PDF·자료 ZIP. 사용자 음색·최종 검토 및 발행 전. |',s);s=s.replace('현재 v11은 BGM·효과음 포함, 내레이션은 사용자 검토·보고 뒤 마지막 단계다.','현재 v12는 사용자가 요청한 차분하고 부드러운 여성 내레이션·BGM·효과음을 포함한다.');s=s.replace('[v11 프로젝트 개념부터 이해하기](../synkbrief_회의메모_20260921/video-v11/README.md)','[v12 차분한 여성 내레이션](../synkbrief_회의메모_20260921/video-v12/README.md)').replace('112초·18장면은 이번 편의 구현','140.33초·18장면은 이번 편의 구현').replace('[현재 112초 v11 검토본](../synkbrief_회의메모_20260921/video-v11/README.md)','[현재 140.33초 v12 검토본](../synkbrief_회의메모_20260921/video-v12/README.md)').replace('최종 낭독 대본은 다음 단계에서 작성한다.','[v12 낭독 대본](../synkbrief_회의메모_20260921/video-v12/낭독대본.md)을 따른다.');s+='\n## 2026-09-23 이번 편의 음성 방향\n\n사용자는 차분하고 부드러운 여성 목소리를 요청했다. v12는 Typecast 은경 tonedown 0.5로 합성했다. 자연스러운 말하기 속도에 맞춰 장면을 늘리고 낭독 타이밍으로 자막과 클릭을 맞췄다. 음색의 최종 승인은 아직 받지 않았다.\n';p.write_text(s,encoding='utf-8')
p=marketing/'채널과_발행.md';s=p.read_text(encoding='utf-8');s=re.sub(r'2026-09-23 활용법 편 최신:.*','2026-09-23 활용법 편 최신: [140.33초 v12 여성 내레이션](synkbrief_회의메모_20260921/video-v12/README.md). 기록 준비·같은 메모 전후 비교·프로젝트 개념·프로젝트별 지침 저장·다음 회의 재사용으로 이어진다. 사용자가 요청한 차분하고 부드러운 여성 목소리(Typecast 은경), 낭독 자막 47개, 클릭 위치 확대, 기존 Suno BGM·효과음 포함. [10쪽 PDF와 한글 키트](synkbrief_회의메모_20260921/follow-along-v11/README.md)를 제공한다. 사용자 음색·최종 검토와 외부 발행 전이며 이전 영상은 보존한다.',s,count=1);s=s.replace('[현재 v11](synkbrief_회의메모_20260921/video-v11/README.md)','[현재 v12](synkbrief_회의메모_20260921/video-v12/README.md)');p.write_text(s,encoding='utf-8')
p=marketing/'synkbrief_아이디어_창고.md';s=p.read_text(encoding='utf-8').replace('v11 프로젝트 개념 설명 검토 · 음성 전','v12 여성 내레이션 검토').replace('[112초 v11 기록부터 시작하는 검토본](synkbrief_회의메모_20260921/video-v11/README.md)','[140.33초 v12 여성 내레이션 검토본](synkbrief_회의메모_20260921/video-v12/README.md)').replace('내레이션은 이번 검토·보고 뒤 진행.','차분하고 부드러운 여성 내레이션을 v12에 삽입했으며 음색·최종 검토 전.');p.write_text(s,encoding='utf-8')
p=marketing.parent/'_ops/트랙.md';s=p.read_text(encoding='utf-8');s=re.sub(r'- 2026-09-23 \*\*synkbrief 프로젝트 개념 설명 v11\*\*:.*','- 2026-09-23 **synkbrief 차분한 여성 내레이션 v12**: [140.33초·18장면 영상](../마케팅/synkbrief_회의메모_20260921/video-v12/README.md). 사용자 요청에 따라 Typecast 은경 여성 tonedown 0.5·1.04배, 18구간·930자 합성. 실제 발음에 맞춘 47자막과 클릭·붙여넣기·저장 시점, BGM 덕킹 적용. 음성 잘림·자막 위치·카메라 28시점·MP4/WebM 디코드·1280/390px 재생과 다운로드 확인. 기존 10쪽 PDF·ZIP 유지. 사용자 음색·최종 승인·외부 발행 전, v11 이하 보존.',s,count=1);p.write_text(s,encoding='utf-8')
