# PULSE 의뢰서 탭 시안(2026-11-13) — 실제 의뢰서 코드 두 파일을 over/에 베껴 세 가지를 얹는다. 운영 코드는 건드리지 않는다.
#   ① 느낌: 「웃음으로 퍼지게」 + 「얼마나 과감하게」  ② 글자: 꼭 붙일 표시(업종)  ③ 소리: 목소리 고르기 + 소리 파일 칸
# 다시 돌리면 over/를 원본에서 새로 만든다.
from pathlib import Path

원본 = Path(__file__).resolve().parents[2] / "온라인마케팅지도/engagement/company/public/pulse-app"
여기 = Path(__file__).resolve().parent
over = 여기 / "over"; over.mkdir(exist_ok=True)


def 고치기(이름, 바꿈):
    t = (원본 / 이름).read_bytes().decode("utf-8").replace("\r\n", "\n")
    for 옛, 새, *몇 in 바꿈:
        기대 = 몇[0] if 몇 else 1
        assert t.count(옛) == 기대, (이름, 옛[:70], t.count(옛))
        t = t.replace(옛, 새)
    (over / 이름).write_bytes(t.encode("utf-8"))
    print(이름, "고침", len(바꿈))


고치기("request-data.mjs", [
    # 소리 파일 칸 — 있으면만
    ("export const SLOTS=Object.freeze({",
     "// 11-13 시안: 소리 파일. 있으면만 받는다 — 없으면 영상에 맞춰 새로 만든다.\n"
     "const SOUND={id:'sound',label:k('브랜드 음악 · 로고 소리'),accept:'audio/*,video/*',why:k('늘 쓰시는 음악이나 끝에 나오는 로고 소리가 있으면 그대로 써요. 없으면 영상에 맞춰 새로 만들어요.'),kind:'sound',multiple:true};\n"
     "export const SLOTS=Object.freeze({"),
    ("\n    ETC,\n", "\n    SOUND,\n    ETC,\n", 5),
    # 웃음
    ("  {id:'impact',label:k('한 장면의 임팩트로'),note:k('한 번 보면 잊히지 않는 그림 하나로 이겨요.'),work:'霜の肌理',poster:'./assets/request/w-gift-sphere.webp',film:'./assets/request/film-gift.mp4',kind:k('15초 · 9:16'),ratio:'9:16'},\n]);",
     "  {id:'impact',label:k('한 장면의 임팩트로'),note:k('한 번 보면 잊히지 않는 그림 하나로 이겨요.'),work:'霜の肌理',poster:'./assets/request/w-gift-sphere.webp',film:'./assets/request/film-gift.mp4',kind:k('15초 · 9:16'),ratio:'9:16'},\n"
     "  // 11-13 시안: 제작 규칙의 셋째 「웃김」. 예시는 매진 임박(홈쇼핑 × 공포 코미디).\n"
     "  {id:'laugh',label:k('웃음으로 퍼지게'),note:k('보다가 웃고, 친구에게 보내고 싶어져요.'),work:k('매진 임박'),poster:'./assets/request/w-maejin-laugh.webp',film:'./assets/request/film-maejin-laugh.mp4',kind:k('1분 15초 · 16:9'),ratio:'16:9'},\n"
     "]);\n"
     "// 11-13 시안: 얼마나 과감하게. 고르지 않으면 저희가 제안한다. 무엇을 고르든 제품 사실과 피할 말은 지킨다.\n"
     "export const BOLD=Object.freeze([\n"
     "  {id:'safe',label:k('정석대로'),note:k('이 업종 광고가 익숙하게 쓰는 장면 안에서, 제품을 정확하고 보기 좋게 보여 드려요.')},\n"
     "  {id:'twist',label:k('조금 다르게'),note:k('같은 업종 광고가 잘 하지 않는 장면을 하나 넣어요. 방향 두 안 가운데 하나는 정석으로 함께 보내 드려요.')},\n"
     "  {id:'wild',label:k('확 다르게'),note:k('말이 안 되는 설정까지 가 봐요. 그래도 제품 사실과 피할 말은 그대로 지켜요.')},\n"
     "]);\n"
     "// 11-13 시안: 광고에 꼭 붙여야 하는 표시가 있는 업종(업종마다 자주 해당하는 것만 꺼낸다). 저장값은 한국어 그대로.\n"
     "export const NOTICE_KINDS=Object.freeze({\n"
     "  food:['건강기능식품','주류'], // i18n-skip\n"
     "  beauty:['기능성 화장품','미용 기기'], // i18n-skip\n"
     "  living:['의료기기','살균 · 소독 제품'], // i18n-skip\n"
     "  fashion:['어린이 제품'], // i18n-skip\n"
     "  app:['금융 · 투자','게임'], // i18n-skip\n"
     "  place:['병의원','학원'], // i18n-skip\n"
     "  brand:['금융 · 투자','의료 · 제약'], // i18n-skip\n"
     "});\n"
     "// 11-13 시안: 목소리. 「모델이 직접」은 사람이 나올 때만 보인다.\n"
     "export const VOICES=Object.freeze([\n"
     "  {id:'narration',label:k('내레이션이 이끌어요'),note:k('화면 밖 목소리가 처음부터 끝까지 이끌어요. 대사는 글 콘티에서 먼저 보여 드려요.')},\n"
     "  {id:'model',label:k('모델이 직접 말해요'),note:k('모델이 카메라를 보고 말해요. 입 모양이 보이는 컷이라 대사는 짧게 가요.')},\n"
     "  {id:'none',label:k('말 없이 음악과 자막으로'),note:k('소리를 끄고 보는 곳에 잘 맞아요. 음악과 화면 글자로 전해요.')},\n"
     "]);"),
    ("  screenText:'',avoid:[],avoidNote:'',facts:'',\n  win:'',refs:", "  screenText:'',avoid:[],avoidNote:'',facts:'',notice:'',noticeText:'',\n  win:'',bold:'',refs:"),
    ("  models:[],modelChoice:'',hair:'',outfit:'',\n", "  models:[],modelChoice:'',hair:'',outfit:'',voice:'',\n"),
    ("const LATER_FIELDS=['hair','outfit',", "const LATER_FIELDS=['bold','notice','noticeText','voice','hair','outfit',"),
    # 보내기 전 확인의 줄
    ("    {key:k('자랑할 사실'),step:'words',",
     "    {key:k('꼭 붙일 표시'),step:'words',value:a.notice==='none'?t('해당 없음'):a.notice==='unsure'?t('잘 모르겠어요 · 저희가 확인해요'):[a.notice&&t(a.notice),a.noticeText].filter(Boolean).join(' · '),missing:a.notice?'':k('저희가 확인해요')},\n"
     "    {key:k('자랑할 사실'),step:'words',"),
    ("    {key:k('참고 광고'),step:'feel',",
     "    {key:k('얼마나 과감하게'),step:'feel',value:a.bold&&BOLD.find(item=>item.id===a.bold)?t(BOLD.find(item=>item.id===a.bold).label):undefined,missing:a.bold?'':k('저희가 제안해요')},\n"
     "    {key:k('참고 광고'),step:'feel',"),
    ("    {key:k('받고 싶은 날'),step:'contact',",
     "    {key:k('목소리'),step:'model',value:a.voice&&VOICES.find(item=>item.id===a.voice)?t(VOICES.find(item=>item.id===a.voice).label):undefined,missing:a.voice?'':k('저희가 제안해요')},\n"
     "    {key:k('받고 싶은 날'),step:'contact',"),
])

고치기("request-flow.mjs", [
    ("ACTIONS,WIN,REFERENCE_POINTS,", "ACTIONS,WIN,BOLD,NOTICE_KINDS,VOICES,REFERENCE_POINTS,"),
    # 세 덩이의 그리기(뷰 표 앞에)
    ("const views={\n  what(a,step,i,n){",
     "// ── 11-13 시안: 과감함 · 꼭 붙일 표시 · 목소리. 모두 눌러 고르고, 고르지 않아도 넘어간다. ──\n"
     "const boldNote=a=>{const note=BOLD.find(item=>item.id===a.bold)?.note;return note?t(note):'';};\n"
     "const boldBlock=a=>`<div class=\"sx-sub\" data-in><span class=\"sx-small\">${esc(t('얼마나 과감하게 갈까요? · 선택'))}</span><div class=\"sx-chips\" role=\"group\" aria-label=\"${esc(t('얼마나 과감하게'))}\">${BOLD.map(item=>chip(t(item.label),a.bold===item.id,`data-do=\"bold\" data-id=\"${item.id}\"`)).join('')}</div><small class=\"sx-small sx-q-hint\" data-bold-note${boldNote(a)?'':' hidden'}>${esc(boldNote(a))}</small></div>`;\n"
     "const noticeOn=a=>!!a.notice&&a.notice!=='none'&&a.notice!=='unsure';\n"
     "const noticeMore=a=>!a.notice||a.notice==='none'?'':a.notice==='unsure'?`<small class=\"sx-small sx-q-hint\">${esc(t('괜찮아요. 저희가 확인해 보고, 필요하면 그때 여쭤볼게요.'))}</small>`:`<small class=\"sx-small sx-q-hint\">${esc(t('표시나 심의가 따로 정해진 업종이에요. 들어갈 문구와 자리를 1차안에 함께 넣어 보여 드리고, 최종 문구는 확인을 받아요.'))}</small>${field({bind:'noticeText',label:t('이미 쓰시는 고지 문구 · 심의 번호 · 선택'),value:a.noticeText,placeholder:t('예) 늘 넣으시는 안내 문구, 받아 두신 심의 번호'),max:300})}`;\n"
     "const noticeBlock=a=>{const list=NOTICE_KINDS[a.kind]||NOTICE_KINDS.brand;return `<div class=\"sx-sub\" data-in><span class=\"sx-small\">${esc(t('광고에 꼭 붙여야 하는 표시가 있는 업종인가요?'))}</span><div class=\"sx-chips\" role=\"group\" aria-label=\"${esc(t('꼭 붙일 표시'))}\">${[...list.map(item=>[item,t(item)]),['none',t('해당 없어요')],['unsure',t('잘 모르겠어요')]].map(([id,label])=>chip(label,a.notice===id,`data-do=\"notice\" data-id=\"${esc(id)}\"`)).join('')}</div><div data-notice-more>${noticeMore(a)}</div></div>`;};\n"
     "const voiceNote=a=>{const note=VOICES.find(item=>item.id===a.voice)?.note;return note?t(note):'';};\n"
     "const voiceBlock=a=>`<div class=\"sx-sub\" data-in data-voice-block><span class=\"sx-small\">${esc(t('목소리는 어떻게 할까요? · 선택'))}</span><div class=\"sx-chips\" role=\"group\" aria-label=\"${esc(t('목소리'))}\">${VOICES.filter(item=>item.id!=='model'||a.modelChoice!=='none').map(item=>chip(t(item.label),a.voice===item.id,`data-do=\"voice\" data-id=\"${item.id}\"`)).join('')}</div><small class=\"sx-small sx-q-hint\" data-voice-note${voiceNote(a)?'':' hidden'}>${esc(voiceNote(a))}</small></div>`;\n"
     "\n"
     "const views={\n  what(a,step,i,n){"),
    # 글자 화면: 피할 말 다음에 꼭 붙일 표시
    ("      field({bind:'avoidNote',label:t('그 밖에 피할 말이나 표현'),value:a.avoidNote,placeholder:t('예) 경쟁사 이름, 과한 표정'),max:300})+\n",
     "      field({bind:'avoidNote',label:t('그 밖에 피할 말이나 표현'),value:a.avoidNote,placeholder:t('예) 경쟁사 이름, 과한 표정'),max:300})+\n"
     "      noticeBlock(a)+\n"),
    # 느낌 화면: 셋 중 하나 + 과감함
    ("t('광고는 보통 둘 중 하나로 이겨요. 기획 첫 줄에 이것부터 정해요.')", "t('광고는 보통 셋 중 하나로 이겨요. 기획 첫 줄에 이것부터 정해요.')"),
    ("on:a.win==='ask',attr:'data-do=\"win\" data-id=\"ask\"'})}</div>`+\n      field({bind:'refUrl',",
     "on:a.win==='ask',attr:'data-do=\"win\" data-id=\"ask\"'})}</div>`+\n      boldBlock(a)+\n      field({bind:'refUrl',"),
    # 모델 화면: 목소리
    ("      modelDetail(a,ctx));\n  },", "      modelDetail(a,ctx)+voiceBlock(a));\n  },"),
    # 적은 내용(크레딧)
    ("  if(a.win)rows.push([k('무엇으로'),t(WIN.find(item=>item.id===a.win)?.label||k('맡길게요'))]);\n",
     "  if(a.win)rows.push([k('무엇으로'),t(WIN.find(item=>item.id===a.win)?.label||k('맡길게요'))]);\n"
     "  if(a.bold&&BOLD.find(item=>item.id===a.bold))rows.push([k('과감함'),t(BOLD.find(item=>item.id===a.bold).label)]);\n"),
    ("  if(a.date||a.dateFree)rows.push([k('받고 싶은 날'),a.dateFree?t('미정'):a.date]);\n",
     "  if(a.voice&&VOICES.find(item=>item.id===a.voice))rows.push([k('목소리'),t(VOICES.find(item=>item.id===a.voice).label)]);\n"
     "  if(a.date||a.dateFree)rows.push([k('받고 싶은 날'),a.dateFree?t('미정'):a.date]);\n"),
    # 모니터: 글자 화면의 틀 아래쪽에 고지 문구 자리
    ("<div class=\"sx-q-copy${id==='words'?' is-top':''}\" data-copy></div>`)}",
     "<div class=\"sx-q-copy${id==='words'?' is-top':''}\" data-copy></div>${id==='words'?'<p class=\"sx-q-notice sx-small\" data-notice-line hidden></p>':''}`)}"),
    ("updateCopy();return;}\n    if(id==='feel')", "updateCopy();updateNoticeLine();return;}\n    if(id==='feel')"),
    ("  function updateDateAdvice(){",
     "  function updateNoticeLine(){const line=$('[data-notice-line]');if(!line)return;const on=noticeOn(a);line.hidden=!on;line.textContent=on?(a.noticeText||t('고지 문구가 들어갈 자리')):'';}\n"
     "  function redrawVoice(){const old=form.querySelector('[data-voice-block]');if(!old)return;const box=document.createElement('div');box.innerHTML=voiceBlock(a);old.replaceWith(box.firstElementChild);}\n"
     "  function updateDateAdvice(){"),
    # 누르기
    ("    refpoint(el){",
     "    bold(el){a.bold=a.bold===el.dataset.id?'':el.dataset.id;form.querySelectorAll('[data-do=\"bold\"]').forEach(item=>setChip(item,item.dataset.id===a.bold));const note=$('[data-bold-note]');if(note){note.textContent=boldNote(a);note.hidden=!boldNote(a);}renderSlate();saved();},\n"
     "    notice(el){a.notice=a.notice===el.dataset.id?'':el.dataset.id;form.querySelectorAll('[data-do=\"notice\"]').forEach(item=>setChip(item,item.dataset.id===a.notice));const more=$('[data-notice-more]');if(more){more.innerHTML=noticeMore(a);if(more.firstElementChild)rise(more,{y:6});}updateNoticeLine();saved();},\n"
     "    voice(el){a.voice=a.voice===el.dataset.id?'':el.dataset.id;form.querySelectorAll('[data-do=\"voice\"]').forEach(item=>setChip(item,item.dataset.id===a.voice));const note=$('[data-voice-note]');if(note){note.textContent=voiceNote(a);note.hidden=!voiceNote(a);}renderSlate();saved();},\n"
     "    refpoint(el){"),
    ("a.modelChoice=a.modelChoice===el.dataset.id?'':el.dataset.id;a.models=[];",
     "a.modelChoice=a.modelChoice===el.dataset.id?'':el.dataset.id;a.models=[];if(a.modelChoice==='none'&&a.voice==='model')a.voice='';"),
    ("swapDetail();showChoice();renderSlate();saved();},", "swapDetail();redrawVoice();showChoice();renderSlate();saved();},"),
    ("    if(bind==='screenText'||bind==='oneThing'||bind==='name')updateCopy();\n",
     "    if(bind==='screenText'||bind==='oneThing'||bind==='name')updateCopy();\n    if(bind==='noticeText')updateNoticeLine();\n"),
])

(over / "extra.css").write_text(
    "/* 11-13 시안: 글자 화면 모니터의 고지 문구 자리 — 광고 틀 아래쪽에 얇게. 본 구현 때 film.css로 옮긴다. */\n"
    ".sx-q-frame .sx-q-notice{position:absolute;left:0;right:0;bottom:0;margin:0;padding:.55em .9em .7em;text-align:center;color:rgba(255,255,255,.86);background:linear-gradient(to top,rgba(0,0,0,.62),rgba(0,0,0,0));font-size:clamp(11px,.9vw,13px);line-height:1.45;letter-spacing:0;white-space:pre-line}\n"
    ".sx-q-frame .sx-q-notice[hidden]{display:none}[data-notice-more]>.sx-q-hint{display:block;margin-top:.7rem}[data-notice-more]>.sx-field{margin-top:1.1rem}\n",
    encoding="utf-8")
print("extra.css 씀")
