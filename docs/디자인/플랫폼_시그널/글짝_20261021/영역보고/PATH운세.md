# 영역 보고 · path-fortune (SYNK PATH 면접 연습 + 무료 운세) · 2026-10-21

작업본: `C:\Users\q1212\Documents\SYNK-appsscript\.claude\worktrees\platform-copy-audit-20261021` (커밋·push 안 함)
맵: `C:\Users\q1212\AppData\Local\Temp\claude\C--Users-q1212-Documents-SYNK-appsscript\02aa6936-0224-4f26-b038-67402e4b2d0c\scratchpad\maps\path-fortune\` (01~13, 짝 204개 · 211곳, 모두 적용됨 — `apply.cjs … --check` 다시 돌리면 「바꾼 곳 0 · 문제 0」)
캡처: 같은 scratchpad의 `shots\path-fortune\before\`·`after\`

---

## ① 범위

### 무엇이 실제로 공개돼 있나 (PATH)
synk-policy `origin/main`(10-21 06:59) `path/` 목록과 `tools/package-path-interview.mjs`의 `PAGES_RUNTIME`으로 정했다.

| 구분 | 파일 | 처리 |
|---|---|---|
| **공개 · 화면에 글이 나오는 것** | `interview/film/rehearsal.html`(입구) · `rehearsal.mjs` · `rehearsal-session.mjs` · `answer-followup.mjs` · `strict-vr.mjs` · `voice-assessment.mjs` · `interview/voice.mjs` · `interview/film-player.mjs` · `listening-sequence.mjs` · `room-space.mjs` | **다시 씀** |
| 공개지만 이 화면에 글이 안 나오는 것 | `interview/dialogue.mjs`(분류 함수만 씀) · `content.mjs` · `xr.mjs` · `whisper-*.mjs`(한글 없음) | 그대로(아래 ⑤) |
| 공개 안 됨 | `interview/index.html`·`app.mjs`·`audio.mjs`·`room.mjs`·`actors.mjs`(옛 3D 시제품), `film/index.html`·`preview.mjs`·`compare.*`·`nanobanana.html`(제작·비교), `production/`, path-vr 뿌리 `index.html`·`app.mjs`·`scene.mjs`·`model.mjs` | 고치지 않음 |

- synk.im `/path/index.html`은 path-vr 뿌리 index.html이 아니라 **SYNK-website의 PATH 소개 페이지**다(묶음 도구가 일부러 덮지 않는다).
- **도구 이름 노출:** 공개본 글(html·mjs·json·txt)에 nanobanana·Seedance·Higgsfield·Gemini·GPT·Claude 없음. 소스 rehearsal.html 머리글의 `./nanobanana.html`「영상 비교」 링크와 바닥글 「기존 3D 연습」은 공개 묶음 도구가 통째로 바꿔서 공개본엔 안 보인다(고친 소스로 변환을 다시 돌려 확인 — 아래 ⑥). 단 **공개 720p 영상 파일 속 C2PA 메타데이터**에 `dreamina-seedance-2-5`·`byteplus-modelark`가 들어 있다(화면엔 안 보임, 파일 정보로만 보임 — ④ P3).

### 글 수 (조사표 inventory.json 기준)
| 묶음 | 파일 | 보이는 글 | GPT·들여옴 | 바뀐 글 |
|---|---|---|---|---|
| PATH 전체(interview/) | 22 | 593(요약표) · 655(행 기준) | 410 | — |
| PATH 공개·화면 글 | 10 | 364 | 229 | 186 (GPT 163) |
| PATH 공개·화면에 안 쓰임(dialogue·content) | 2 | 54 | 28 | 0 |
| PATH 비공개(옛 3D·비교) | 10 | 237 | 153 | 0 |
| 무료 운세 | 15 | 1,758 | 0 | 60(HTML 덩어리 기준) |

공개 화면 글 중 GPT 글로 남은 66개는 면접관 대사(녹화 영상과 묶임)·단추 이름(「질문 다시 듣기」「이 부분이 맞아요」 등 그대로 써도 되는 말)·정규식 조각이다.

---

## ② 고친 글

PATH 170곳(맵 01~09 + 바닥글), 무료 운세 41곳(맵 10~13). 합쇼체는 공개 화면 글에서 0으로(면접관 대사만 합쇼체). 대표 전후:

### PATH 면접 연습 (`experiences/path-vr/interview/…`)
| 파일:줄 | 전 | 후 |
|---|---|---|
| film/rehearsal.html:3 | `SYNK PATH · Quest 면접실` (탭 제목) | `SYNK PATH · 요양보호사 면접 연습` |
| film/rehearsal.html:10 | 자리에 앉으면, / 면접이 시작됩니다. | 세 면접관 앞에서 / 미리 답해 봐요. |
| film/rehearsal.html:13 | 고개를 돌려 방을 둘러보고, 질문에 소리 내어 답하세요. 말하는 동안에도 세 면접관의 시선과 필기는 이어집니다. | 요양보호사에 지원한 이유를 묻는 질문에 말이나 글로 답해요. 첫 답을 들은 면접관이 후속 질문을 하나 더 해요. |
| film/rehearsal.html:32 | 테스트 이용 | 무료 연습 |
| film/rehearsal.html:45 | 주변 벽·창문·천장은 재질 디테일을 새로 보강한 4K 이미지로 이어집니다. 재생이 버거우면 영상은 720p로 선택할 수 있습니다. | 4K는 720p 영상을 크게 늘린 화질이에요. 재생이 끊기면 720p를 골라 주세요. 면접 중에는 화질을 바꿀 수 없어요. |
| film/rehearsal.html:47 | 마이크만 씁니다. 카메라는 켜지 않습니다. … 저장하거나 서버로 보내지 않습니다. | 마이크만 쓰고 카메라는 켜지 않아요. … 답과 목소리는 저장하지 않고 서버로 보내지도 않아요. |
| film/rehearsal.html:52 | 이번 테스트에서는 실제 경험·준비 계획을 구분해 녹화된 두 후속 질문 중 하나를 고릅니다. **추가 질문 영상 제작은 보류 중입니다.** 채용 점수나 합격 여부를 판단하지 않습니다. | 첫 답에 직접 해 본 일이 있으면 경험 질문을, 없으면 준비 질문을 골라요. 채용 점수나 합격 여부는 매기지 않아요. |
| film/rehearsal.html:55 | (5문장 GPT 덩어리) 질문과 전환을 포함해 약 60~90초를 연습합니다. … 진행 중인 필기는 끝나는 구간까지 기다립니다. | 질문을 듣고 두 번 답하는 데 60~90초쯤 걸려요. … 누가 했는지, 경험이 있는지처럼 뜻이 애매하게 들린 부분만 다시 묻고, 그 부분만 고치거나 다시 말하면 돼요. |
| film/rehearsal.html:56 | … 면접관은 단안 영상이라 … **착용감과 프레임 성능은 실제 Quest에서 다시 확인해야 합니다.** | PC에서는 「방 둘러보기」에서 30°씩 돌아보고 … 면접관은 평면 영상이라 몸을 옮겨도 옆모습은 보이지 않아요. (개발 메모 삭제) |
| film/rehearsal.html:57 | Quest에서는 세 단계로 들어갑니다 | Quest에서는 세 단계로 들어가요 |
| film/rehearsal.mjs:56 | error: '연결 확인' (오류 상태 칩) | '진행 멈춤' (연결 문제가 아닌 오류에도 맞게) |
| film/rehearsal.mjs:99 | 화면에서는 직접 입력하거나 마이크로 연습할 수 있습니다. | 답은 글로 써도 되고, 마이크로 말해도 돼요. |
| film/rehearsal.mjs:99 | 마이크 확인 완료. 앉은 상태에서 면접실에 입장하세요. (VR 없는 PC에서도) | VR 되는 기기: 마이크 확인을 마쳤어요. 의자에 앉아 「Quest 면접실 입장」을 눌러 주세요. / PC: 마이크 확인을 마쳤어요. 준비되면 「면접 시작」을 눌러 주세요. |
| film/rehearsal.mjs:101 | 말씀하세요. 답변을 마치면 자동으로 이어지며, 애매한 부분만 확인합니다. | 이제 말로 답해 주세요. 말을 마치면 알아서 넘어가고, 애매하게 들린 부분만 다시 물어요. |
| film/rehearsal.mjs:106 | 진행을 멈췄습니다. 이어서 진행하면 마이크를 다시 엽니다. (글 입력에도) | 글: 잠시 멈췄어요. 준비되면 「이어서 진행」을 눌러 주세요. / 마이크: 잠시 멈추고 마이크도 껐어요. 「이어서 진행」을 누르면 다시 켜요. |
| film/rehearsal.mjs:108 | 결과 줄 이름 「내 답변」「질문 의도」 | 「첫 답변에서」「고른 이유」 |
| film/rehearsal.mjs:196 | 목소리가 들리지 않았습니다. 마이크 권한과 음소거를 확인한 뒤 다시 시도하세요. | 목소리가 들리지 않았어요. 마이크가 음소거돼 있지 않은지 보고 다시 눌러 주세요. |
| film/rehearsal.mjs:210 | 면접 영상 목록을 불러오지 못했습니다. | 면접 영상을 불러오지 못했어요. 인터넷 연결을 확인하고 「처음부터 다시」를 눌러 주세요. |
| film/rehearsal-session.mjs:124 | 음성을 정확히 확인하지 못했습니다. 내용을 직접 입력하거나 다시 답변해 주세요. (VR에선 입력 불가) | 말을 제대로 알아듣지 못했어요. 「다시 답변」을 눌러 한 번 더 말해 주세요. |
| film/rehearsal-session.mjs:126 | 답변을 이어서 준비하거나 질문을 다시 들을 수 있습니다. | 천천히 생각해도 괜찮아요. 떠오른 계기 하나로 다시 답하거나 질문을 다시 들어 보세요. |
| film/answer-followup.mjs:151 | 본인이 경험했다고 말한 내용을 구체적으로 묻습니다. | 직접 해 본 일을 말해서, 그 일을 자세히 물어요. |
| film/answer-followup.mjs:152·167 | 답변에서 밝힌 준비나 앞으로의 행동을 구체적으로 묻습니다. / 본인의 실제 경험으로 단정하지 않고 현장 투입 전 준비를 묻습니다. | 직접 해 본 일이 답에 없어서, 현장에 나가기 전 준비를 물어요. |
| film/voice-assessment.mjs:116 | 본인의 경험이 있는지 없는지를 이 부분만 확인해 주세요. 반대로 들렸다면 고쳐 주세요. | 경험이 있다고 했는지, 없다고 했는지 맞게 들렸나요? (화면이 뒤에 「맞으면 … 다르면 …」을 붙이고, VR은 단추가 맡는다) |
| film/voice-assessment.mjs:133 | 다음 질문에 영향을 주는 이 부분이 맞는지 확인해 주세요. 다르면 이 부분만 고쳐 주세요. | 다음 질문을 고를 때 쓰는 부분이에요. 맞게 들렸나요? |
| film/strict-vr.mjs:350 | 이 브라우저에서 VR 기기를 찾지 못했습니다. 화면에서 방을 둘러볼 수 있습니다. | 이 브라우저에서는 VR을 쓸 수 없어요. 「방 둘러보기」로 화면에서 면접실을 볼 수 있어요. |
| film/strict-vr.mjs:352 | VR 사용 가능 · 주변 방은 공간 기하, 면접관은 원본 단안 영상으로 표현합니다. | VR을 쓸 수 있어요. 음성 준비와 마이크 확인을 마치면 입장 단추가 켜져요. |
| film/strict-vr.mjs:346 | PC에서는 화면으로 연습할 수 있습니다. VR은 Quest의 HTTPS 환경에서 지원 여부를 확인합니다. | PC에서는 화면으로 연습해요. VR은 Quest 브라우저에서 이 페이지를 열면 쓸 수 있어요. |
| film/strict-vr.mjs:171 | 화면 연습으로 돌아가기 (방 둘러보기 닫기 단추) | 둘러보기 닫기 |
| film/strict-vr.mjs (안내판) | 계속하기 · 답변 마침 · 일시정지 · VR 나가기 | 이어서 진행 · 답변 완료 · 일시 정지 · 나가기 (화면 단추 이름과 같게) |
| voice.mjs:10 | 마이크 사용이 허용되지 않았어요. 브라우저의 마이크 권한을 확인해 주세요. | 마이크 권한이 꺼져 있어요. 주소창의 사이트 설정에서 마이크를 허용한 뒤 다시 눌러 주세요. |
| film-player.mjs:153 | 영상 파일을 읽거나 재생하지 못했습니다. 실제 MP4/WebM 파일을 확인해 주세요. | 면접 영상을 재생하지 못했어요. 인터넷 연결을 확인하고 「처음부터 다시」를 눌러 주세요. |
| film-player.mjs:126 | 이 브라우저는 영상 프레임 확인을 지원하지 않습니다. | 이 브라우저에서는 면접 영상을 재생할 수 없어요. 최신 Chrome이나 Safari에서 다시 열어 주세요. |

이름 맞춤: 총괄이 바꾼 PC 카드(「면접 연습 열기」·「웹에서 연습」·「세 면접관 앞에서 미리 해 보는 60~90초 면접 연습이에요.」)에 맞춰 공개 화면을 **면접 연습**으로 부른다(탭 제목·큰 제목·로컬 바닥글 `SYNK PATH · 면접 연습`). 「실사 면접실」은 화면·접근성 이름에서 모두 뺐다(`면접실`은 둘러보는 방 이름으로만).

### 무료 운세 (`experiences/daily-fortune/…`)
| 파일:줄 | 전 | 후 |
|---|---|---|
| app.mjs:55 | 오늘의 좋은 기운, / 내 방식으로. | 오늘 운세를 / 별자리나 사주로 봐요. |
| app.mjs:56 | … 맞았는지 남겨 두면 다음에 더 재밌어져요. | 오늘의 기운과 해 보면 좋은 일, 행운의 색을 알려 줘요. 이번 달 흐름과 궁합, 올해 운세도 볼 수 있어요. |
| app.mjs:58 | 무료 · 광고 없음 · 비회원도 바로 · 로그인하면 기록 보관 (가운뎃점 넷) | 무료 · 광고 없음 · 로그인 없이 바로 |
| app.mjs:136 | 한 달의 흐름을 / 미리 살펴봐요. | 앞으로 30일의 / 좋은 날을 찾아 줘요. |
| app.mjs:140 | 한 달의 흐름, / 가볍게 미리. | 앞으로 30일 중 / 좋은 날과 천천히 갈 날 |
| app.mjs:153 | 우리 둘은 / 어떤 결일까요? | 두 사람이 / 얼마나 잘 맞을까요? |
| app.mjs:175 | 2026년, / 나의 한 해. | 2026년 / 한 해 운세 |
| app.mjs:183 | 맞았는지, / 남겨 두면 재밌어요. · [SYNK ID로 이어가기] | 담아 둔 운세가 / 맞았는지 표시해요. · [SYNK ID로 로그인] |
| app.mjs:123 | 시각 확인 필요 (「시간 모름」을 고른 시주에도) | 시간을 알면 나와요 |
| app.mjs:79 | 일간 칸 비었을 때 「확인 필요」 | 알 수 없음 |
| app.mjs:206 | 비회원 입력은 이 화면 메모리에만 있어요. | 로그인하지 않고 입력한 정보는 이 화면에만 있어요. |
| app.mjs:302·360 | 입력을 확인해 주세요. / 계정 연결을 확인해 주세요. | 입력한 날짜와 시간을 다시 적어 주세요. / 계정에 연결하지 못했어요. 잠시 뒤 다시 해 주세요. |
| index.html:49 | 내 운세 이어가기 (계정 판 제목) | 로그인과 내 기록 |
| index.html:7 | … SYNK 회원 무료 혜택. (비회원도 쓰는데) | 별자리나 한국 사주로 오늘의 기운과 궁합, 올해 운세를 무료로 봐요. |
| account.mjs:6 | 계정 서버에 연결하지 못했어요. 연결이 돌아오면 다시 확인해 주세요. | … 인터넷 연결을 확인한 뒤 다시 해 주세요. |
| account.mjs:11·33 | 운세 계정 저장 서비스가 아직 준비되지 않았어요. 연결 후 다시 불러와 주세요. | 운세 기록 저장은 아직 준비 중이에요. 운세 보기는 그대로 할 수 있어요. |
| account.mjs:137·159 | 계정 연결 설정 전이에요. 운세는 바로 볼 수 있어요. | 이 화면에서는 아직 로그인할 수 없어요. 운세는 바로 볼 수 있어요. |
| account.mjs:223·231 | 이 화면에서 로그아웃했어요. 기기 저장과 서버의 로그인 종료는 다시 확인해 주세요. | 이 화면에서는 로그아웃했어요. 서버 쪽 로그인 종료는 확인하지 못했으니, 공용 기기라면 브라우저를 닫아 주세요. |
| core.mjs:45·47 | 날짜 형식이 올바르지 않습니다. / 존재하지 않는 날짜입니다. | 날짜 형식이 맞지 않아요. … / 없는 날짜예요. 날짜를 다시 골라 주세요. |

운세 풀이 본문(daily·year·tarot·compat 문장)은 콘텐츠라 손대지 않았다. 「~하는 날」 제목들은 운세 카드 제목 형식이라 그대로 둔다.

---

## ③ 고친 화면·기능 문제

| # | 심각도 | 파일:줄 | 문제 → 고침 | 근거 캡처 |
|---|---|---|---|---|
| 1 | P2 | path-vr/interview/film/rehearsal.mjs:195 | **마이크 확인이 소리만으로 통과:** 가짜 마이크(삐 소리)에 Whisper가 「(놀람)」을 내자 「마이크 확인 완료 · 인식: “(놀람)”」, 말 없이 VR 입장이 열렸다. 괄호·대괄호 비음성 표기를 뺀 글로 판정하게 한 줄 고침 → 「소리는 들렸는데 말로 알아듣지 못했어요…」 | before/20-mic-no-speech-390 → after/20-mic-no-speech-390 |
| 2 | P2 | rehearsal.mjs:167 | 마이크 권한 거부 때 같은 오류 글이 음성 상태 줄과 마이크 확인 칸에 **두 번** 보임 → 확인 중 오류는 확인 칸에만 | before/17-mic-denied-1440 → after |
| 3 | P2 | rehearsal.mjs:99 | VR 없는 PC에도 「앉은 상태에서 면접실에 입장하세요」 → VR 가능 여부로 나눔. 음성 준비만 끝난 상태는 「「2. 마이크 확인」을 누르고…」 | after/16-voice-ready |
| 4 | P2 | rehearsal.mjs:106 | 글 입력으로 연습 중 일시 정지해도 「마이크를 다시 엽니다」 → 답변 방식별 안내, 일시 정지 덮개도 「「이어서 진행」을 누르면 다시 이어져요」 | after/11-paused |
| 5 | P2 | rehearsal.mjs:77 | 글로 답할 때 질문 자막이 사라져 **무슨 질문인지 안 보인 채** 답을 씀 → 답변 칸 이름에 「질문 · {지금 질문}」 | after/05-answer-typed-390 |
| 6 | P2 | strict-vr.mjs:114 | VR 안내판이 면접관이 질문하는 중에도 「선택 버튼으로 시작합니다」 → 시작 전이면 「준비되면 아래 「면접 시작」을 눌러 주세요」, 진행 중이면 「질문이 끝나면 바로 답할 수 있어요」. 다시 답하기 때 안내판에도 화면과 같은 이유 글(repair 메시지)을 보이고, 안내판 다시 그리기 열쇠에 그 글을 넣음 | after/hud-2-question, hud-6-repair |
| 7 | P2 | strict-vr.mjs:53 | PC 방 둘러보기의 책상 안내판 셋째 단추가 「VR 나가기」인데 실제로는 둘러보기를 닫음 → 「나가기」 | after/hud-* |
| 8 | P2 | rehearsal.html:52·56 | 사용자에게 보이던 개발 메모 삭제: 「추가 질문 영상 제작은 보류 중입니다」(소스에 남아 공개 도구가 지우던 것), 「착용감과 프레임 성능은 실제 Quest에서 다시 확인해야 합니다」, 「공간 기하」「단안 영상」「HTTPS 환경」 같은 기술 말 | before/after 01-idle |
| 9 | P2(속도) | assets/PathSans-ui.woff2 외 | 새 글에 첫 화면 글꼴 조각에 없던 음절 20자(쯤·돼·써·끊·꿔 등)가 생겨, 그대로면 첫 화면이 나머지 조각(521KB)까지 받는다. README 규칙대로 `python -X utf8 tools/build-path-fonts.py`를 돌려 다시 나눔(화면판 645→649자, 공개 파일·공개 머리글·바닥글 글자 중 빠진 글자 0) | — |
| 10 | P2 | daily-fortune/app.css:11 | 휴대폰(390) 별자리 카드에서 영어 이름이 옆 칸을 차지해 「사/수/자/리」가 한 글자씩, 날짜가 「11.2/2–/12.2/1」로 꺾임 → 560px 이하에서 영어 이름을 윗줄로 | before/f01-intro-390 → after |
| 11 | P2 | daily-fortune/flow.mjs:22·24, app.mjs:143·144 | 이번 달 「기운이 좋은 날」 목록이 별자리에서 여섯 날 모두 「같은 기운이 도는 날」만 되풀이 → 흐름 항목에 그날 카드 제목(headline)을 넣고 목록에 보임(없으면 예전 꼬리표). flow 시험 16/16 | before/f07-month → after/f07-month |

---

## ④ 제안 (고치지 않음 · 유호님이 고를 일)

| 우선 | 무엇 | 왜 |
|---|---|---|
| P2 | 결과 판에 「다음 연습 한 줄」 넣기 — 옛 3D 시제품의 `content.mjs` NEXT_PRACTICE(「직접 한 일 한 가지를 골라, 상황 → 본인의 행동 → 확인한 결과 순서로…」)를 갈래별로 | 지금 결과는 고른 후속 질문만 보여 줘서 다음에 무엇을 고칠지 알려 주지 않는다. 둘째 답은 결과에 전혀 안 나온다 |
| P2 | 음성 답에서도 Whisper 비음성 표기((놀람)·[음악])를 걸러 내기 | ③-1은 마이크 확인만 고쳤다. 답변 중 소음이 「(놀람)」으로 적히면 두 글자 이상이라 말 끝 감지가 답으로 보고 넘어간다. 걸러 내려면 낱말 위치(offset)와 함께 손봐야 해서 이번엔 두었다(whisper-worker·mergeVoiceResults) |
| P3 | 공개 720p 원본 영상(strict-question-720p·strict-followup-plan-720p 등, 다시 인코딩한 4K·경청 꼬리 영상엔 없음)의 C2PA 메타데이터(`dreamina-seedance-2-5`, `byteplus-modelark`) 처리 결정 | 화면엔 안 보이지만 파일 정보로 도구 이름이 보인다. 지우면 AI 생성 출처 표시도 사라진다 — 두는 쪽·지우는 쪽 중 결정 필요 |
| P3 | 로컬 rehearsal.html 머리글의 「영상 비교」(nanobanana.html)·바닥글 「기존 3D 연습」 링크를 공개본과 같게(`/path/`) | 공개본은 도구가 바꿔서 안 보이지만, 로컬·Quest 전용 묶음(`.tmp/path-interview-quest`)에는 그대로 나간다 |
| P3 | 비공개 옛 페이지(옛 3D·비교·제작, GPT 글 153개) 정리 또는 보관 | 공개 안 되는 시제품이라 이번에 손대지 않았다 |
| P3 | 4K(720p 확대)가 PC 기본 화질 | 새 세부 없이 파일만 3~4배 크다. 기본을 720p로 두고 4K를 고르게 하는 안 |

---

## ⑤ 남긴 것과 이유

- **면접관 대사:** `QUESTIONS`·`FOLLOWUP_CATALOG`(rehearsal-session.mjs:9~11, answer-followup.mjs:7~16)의 질문은 녹화 영상과 묶인 말이라 합쇼체 그대로. 아직 영상이 없는 계획 질문 8개도 면접관 말투라 그대로.
- **마이크 확인 예문** 「“면접 연습을 시작하겠습니다”」는 사용자가 소리 내 읽는 면접 말투라 그대로.
- **content.mjs·dialogue.mjs의 안내 글**(「자유 대화 AI나 취업 평가가 아닙니다」 등)은 옛 3D 시제품에서만 보이고 공개 면접 연습 화면엔 나오지 않는다(공개 파일이지만 분류 함수만 쓰임). 시제품이 비공개라 손대지 않음. interview-dialogue 시험이 이 글을 본다.
- **xr.mjs** 안내(「PC 3D 미리보기…」)는 옛 시제품용이고 공개 면접 연습은 쓰지 않는다.
- **voice.mjs의 상태 알림 글**(「듣고 있어요…」 등)은 면접 연습 화면이 자기 문구로 바꿔 보여서 화면에 안 나온다. 화면에 나오는 오류 글 4개만 고쳤다.
- **영상 재생기 개발용 점검 글**은 화면에 거의 안 나와 해요체로만 맞췄다.
- **운세:** 사주 한계 안내의 「지장간·합충·신강신약·용신·대운」 나열은 가운뎃점이 다섯이지만 시험(saju-core.test.mjs:114, insights.test.mjs:159)이 이 낱말을 지키고, 사주를 아는 사람에게 필요한 범위 고지라 그대로. 운세 풀이·카드 제목 문장은 콘텐츠라 그대로.
- **운세 「계정 상태」 거절 글**은 시험이 「계정 상태」「다시 불러」「삭제 요청」을 보므로 그 낱말을 살려 다시 썼다.

---

## ⑥ 시험 (기준선 → 지금)

| 묶음 | 기준선 | 지금 | 실패 이유 |
|---|---|---|---|
| `experiences/path-vr/tests/*.test.mjs` | 281 중 271 통과 · 10 실패 | 271 · 10 (같은 10개) | 93·94·95·99·100·101·102·103·166·173 — git이 무시하는 큰 영상(mp4)·Vosk 모델(tar.gz)이 워크트리에 없어서 ENOENT. 글과 무관 |
| `experiences/daily-fortune/tests/*.test.mjs` + 뿌리 `tests/path-travel-account`·`synk-personal-data`·`prepare-personal-public` | 163 중 162 · 1 실패 | 162 · 1 (같은 것) | 134 「고정한 MIT 공급자 원본…해시」 — 윈도 워크트리가 `vendor/lunar-javascript-1.7.7/lunar.mjs`를 CRLF로 꺼내 해시가 다름(i/lf w/crlf). 글과 무관 |

추가 확인:
- 미디어가 없어 공개 묶음 시험(100~103)이 기준선부터 못 도는 대신, **고친 rehearsal.html을 `tools/package-path-interview.mjs`의 `pagesRuntimeFile`로 직접 변환**해 그 시험의 글 조건을 확인했다: 머리글·바닥글 교체, CSP, `href="/path/"`, 「생성 영상」 고지 있음, `nanobanana|기존 3D|영상 비교|추가 질문 영상 제작은 보류` 없음, 고친 공개 모듈 9개 모두 `Higgsfield|Seedance|nano banana|edge-tts` 없음 → 전부 ok (`path-fortune-work\check-pages.mjs`).
- 실제 화면 흐름(Playwright, 실제 Chrome): 글 입력으로 질문→답→후속 질문→답→결과 완주, 다시 답하기·일시 정지, 방 둘러보기(WebGL), 음성 모델 내려받기(약 103MB, 로컬)·마이크 권한 거부·가짜 마이크, 영상 목록 404 오류까지 전후 모두 콘솔 오류 없이 돎(404 오류 흐름의 의도한 404 두 건만).
- VR 책상 안내판 8개 상태를 캔버스로 그려 글 넘침 없음 확인(after/hud-*).

---

## ⑦ 바꾼 파일 (24)

PATH (14)
- `experiences/path-vr/interview/film/rehearsal.html`
- `experiences/path-vr/interview/film/rehearsal.mjs`
- `experiences/path-vr/interview/film/rehearsal-session.mjs`
- `experiences/path-vr/interview/film/answer-followup.mjs`
- `experiences/path-vr/interview/film/strict-vr.mjs`
- `experiences/path-vr/interview/film/voice-assessment.mjs`
- `experiences/path-vr/interview/film/listening-sequence.mjs`
- `experiences/path-vr/interview/film/room-space.mjs`
- `experiences/path-vr/interview/voice.mjs`
- `experiences/path-vr/interview/film-player.mjs`
- 생성물(`tools/build-path-fonts.py`로 다시 만듦): `experiences/path-vr/assets/PathSans-ui.woff2` · `PathSans-rest.woff2` · `PathSans.json` · `experiences/path-vr/interview/film/rehearsal.css`(글꼴 unicode-range 한 줄만. 도구가 LF로 써서 git이 「LF→CRLF」 경고를 내지만 내용 변화는 그 줄뿐)

무료 운세 (10)
- `experiences/daily-fortune/app.mjs` · `app.css` · `index.html` · `account.mjs` · `account-state.mjs` · `core.mjs` · `saju-core.mjs` · `insights.mjs` · `tarot.mjs` · `flow.mjs`

시험 파일은 바꾸지 않았다(옛 글을 들고 있는 시험이 없었다).

---

## ⑧ 캡처 (`C:\Users\q1212\AppData\Local\Temp\claude\C--Users-q1212-Documents-SYNK-appsscript\02aa6936-0224-4f26-b038-67402e4b2d0c\scratchpad\shots\path-fortune\`)

before·after 같은 이름, 폭 1440·390(일부 순간 상태는 1440만):
- PATH: 01-idle · 02-preparing · 03-question · 04-listening · 05-answer-typed · 06-reviewing · 07-followup · 08-listening-2 · 09-complete · 10-repair · 11-paused · 12-room-preview · 13-room-closed · 14-voice-mode · 15-voice-preparing · 16-voice-ready · 17-mic-denied · 18-error · 19-mic-checking · 20-mic-no-speech (상태별 글은 각 폴더 `states.txt`)
- VR 책상 안내판(after만): hud-1-idle … hud-8-paused
- 무료 운세: f01-intro · f02-month-noprofile · f03-year-noprofile · f04-vault-signedout · f05-account-sheet · f06-today-zodiac · f07-month · f08-year · f09-match-empty · f10-match-result · f11-saju-time-error · f12-today-saju (`fortune-states.txt`)

확인용 서버: PATH는 워크트리 파일 + 공용 작업본의 git 밖 큰 영상만 읽는 scratchpad 서버(4391), 운세는 워크트리 `server.mjs`의 createServer를 4392로.

---

## 총괄에게

1. **공개 묶음 도구 문구(`tools/package-path-interview.mjs:91~93`, 맡지 않은 파일):** 공개본 바닥글이 「SYNK PATH · 생성 영상으로 연습하는 첫 면접」, 머리글이 「PATH로 돌아가기」다. PC 카드 이름에 맞추려면 바닥글을 예컨대 「SYNK PATH · 면접 연습 · 면접관은 생성 영상이에요」로(interview-pages.test.mjs:106이 `/생성 영상/`을 요구하니 이 말은 남긴다). 93줄의 「추가 질문 영상 제작은 보류 중입니다.」 지우기는 이제 소스에 그 글이 없어 아무 일도 안 한다(지워도 됨).
2. **계정 포털 PATH 항목(`experiences/synk-account/src/applications.mjs:8`, 포털 담당 영역):** tags에 금지어 「실사 면접실」, subtitle 「세 면접관 앞에서 미리 연습하는 첫 면접」(PC 카드와 다름), description 「무거운 면접실의 분위기 속에서…」(GPT 투), available 「실제 후속 대사는 경험·준비 두 종류이며…」(내부 말). PC 카드 문구로 맞추길 권함.
3. **synk.im/path/ 소개 페이지(SYNK-website 원천, 이 저장소 밖):** VR 절 note에 개발 메모 「Quest 실기기 검증은 아직 남아 있습니다」가 공개돼 있고, 상태가 「면접 테스트 이용」「테스트 이용」, 단추가 「60~90초 면접 시작」이다. 「면접 연습 열기」로 맞추고 메모는 빼길 권함.
4. **글꼴 조각 다시 만듦:** 면접 연습 글을 바꿔 `python -X utf8 tools/build-path-fonts.py`를 돌렸다(결정적 출력, path-vr 안 4파일). 이후 누가 `interview/` 글을 또 바꾸면 이 도구를 다시 돌려야 첫 화면이 가볍게 유지된다.
5. **공개 반영은 안 함:** PATH는 `tools/package-path-interview.mjs`(Pages 덮개) → `tools/공개.js`, 운세는 `tools/prepare-personal-public.mjs fortune` 경로다. 운세 README대로 SYNK-talk 운세 규칙 v2 배포 전에는 로그인한 사람의 저장이 거절되며, 그때 보이는 글을 「운세 기록 저장은 아직 준비 중이에요. 운세 보기는 그대로 할 수 있어요.」로 바꿨다(라이브에서 그 상태는 확인 못 함).
6. **오래된 QA 스크립트:** `experiences/daily-fortune/qa/browser-smoke.mjs`는 10-07 화면(#account-status, data-pillar)을 보던 것이라 10-14 시그널 판과 안 맞는다(지금 화면에선 못 돎). 운세 시험 134번 실패는 윈도 CRLF 체크아웃 때문이니 `vendor/**` 에 `-text`(또는 `eol=lf`) .gitattributes를 권함.
