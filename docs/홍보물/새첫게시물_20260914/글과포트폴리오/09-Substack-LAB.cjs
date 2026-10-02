'use strict';

// LAB 편지의 독립 편집 원천. 기존 SHIFT 계열 8편과 카드 제작물을 변경하지 않는다.
const page={
  id:'09-Substack-LAB',brand:'lab',platform:'Substack · LAB 갈래',author:'SYNK LAB',
  kind:'학생 편지 · 가족과 이어 읽는 한국어',
  title:'아직 정하지 않았어요. 먼저 해보고 싶은 일을 말해요.',
  titleMn:'Эхлээд юу хийж үзмээр байна вэ?',
  deck:'두 문장으로 말해 보고, 작은 일 하나로 이어가는 편지',
  blocks:[],
  handoff:{account:'기존 Substack 발행물의 LAB 교육 편지 갈래. SHIFT 제작 편지와 대상·목적을 분리한다.',media:[],tags:[],notes:['몽골어는 기존 AI 초안을 바탕으로 새로 편집한 원고다. 제공 문구에 대한 Gemini AI 언어검토 제안을 부분 반영했으며 원어민 감수는 미확인이다.','학습용 예시이며 실제 학생 발화·후기·성과가 아니다.','계정·공개 URL·답장 수집 통로를 새로 만들지 않았다. 학생은 공개 제출 없이 종이와 혼자 말하기로 끝낼 수 있다.']},
  languageStatus:{korean:'current canonical examples retained',mongolian:'AI draft and source comparison; relevant Gemini wording suggestion partly incorporated; native review unverified',geminiReview:'Provided wording reviewed by gemini-3.1-pro-high; not native review or verification of the entire new letter',nativeReviewed:false,published:false,officialMongolianVision:false}
};
const text={
  intro:'Өнөөдөр хоёр өгүүлбэрээр өөрийн сонголтоо хэлж үзье. Сурах мэргэжлээ сонгож байгаа бол эхлээд хийж үзмээр зүйлээ хэлээрэй.',
  introKo:'오늘은 두 문장으로 내 선택을 말해 봐요. 아직 전공을 고르는 중이라면, 먼저 해보고 싶은 일을 말할 수 있어요.',
  start:'Шийдээгүй байгаа бол ингэж хэлж болно.',
  question:{ko:'어떤 전공을 배우고 싶어요?',mn:'Ямар мэргэжлээр сурахыг хүсэж байна вэ?'},
  answer:{ko:'아직 정하지 않았어요. 먼저 게임을 만들어 보고 싶어요.',mn:'Одоохондоо шийдээгүй байна. Эхлээд тоглоом хийж үзмээр байна.'},
  replace:'“게임을 만들어” гэдэг хэсгийг бүхэлд нь солино. Оронд нь “영상을 만들어” эсвэл “그림을 그려” гэж хэлээрэй.',
  instruction:'Доорх гурван хэсгээс нэгийг нь хоосон зайд оруулаад, өгүүлбэрээ бүтнээр нь хэлээрэй.',
  privatePractice:'Ганцаараа чангаар хэлж болно. Хариугаа сэтгэгдэлд бичих, дуу хоолойгоо бичиж нийтлэх шаардлагагүй.',
  next:'Дараа нь хийж үзэх нэг жижиг зүйлээ сонгоорой.',
  familyQuestion:'Сүүлийн үед өөрөө юу хийж үзмээр санагдаж байна вэ?',
  familyListen:'Хүүхдийнхээ сонирхлыг өөрийнх нь үгээр сонсоорой.',
  familyReflect:'Дараа нь юу нь сонирхолтой байсан, юуг илүү мэдэхийг хүсэж байгааг нь ярилцаарай. Нэг удаа хийж үзсэнээр мэргэжлийг нь шууд шийдэх эсвэл ямар салбарт тохирохыг нь дүгнэх шаардлагагүй.',
  familyCheck:'Харин сургууль, сургалтын хөтөлбөрийг харьцуулахдаа юу заах, амьдрах нөхцөл, зардал, бэлтгэх зүйл болон шаардлагыг албан ёсны мэдээллээс хамт шалгаарай.',
  role:'SYNK LAB нь хүн өөрийн зорих чиглэлээ тодруулж, юу сурч, ямар туршлага хуримтлуулахаа сонгох замуудыг судалдаг. Энэ бол тэр чиглэлийг солонгосоор илэрхийлж үзэх сургалтын жишээ юм.'
};
const choices=[
  {phrase:'게임을 만들어',full:'아직 정하지 않았어요. 먼저 게임을 만들어 보고 싶어요.',meaning:'Одоохондоо шийдээгүй байна. Эхлээд тоглоом хийж үзмээр байна.',activity:'Тоглоомын нэг хэсгийг зурах',activityKo:'게임 장면 하나 그리기'},
  {phrase:'영상을 만들어',full:'아직 정하지 않았어요. 먼저 영상을 만들어 보고 싶어요.',meaning:'Одоохондоо шийдээгүй байна. Эхлээд видео хийж үзмээр байна.',activity:'Богино видеоны нэг хэсгийг бичиж авах',activityKo:'짧은 영상 한 장면 찍기'},
  {phrase:'그림을 그려',full:'아직 정하지 않았어요. 먼저 그림을 그려 보고 싶어요.',meaning:'Одоохондоо шийдээгүй байна. Эхлээд зураг зурж үзмээр байна.',activity:'Дуртай эд зүйлээ зурах',activityKo:'좋아하는 물건 그리기'}
];
function render({css,logo,vision,colors}){
 const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const mn=s=>`<p class="mn" lang="mn">${esc(s)}</p>`;
 const meaning=s=>`<p class="meaning" lang="mn">${esc(s)}</p>`;
 const dialogue=(speaker,ko,m)=>`<div class="line"><p class="speaker" lang="mn">${esc(speaker)}</p><p class="say" lang="ko">${esc(ko)}</p>${meaning(m)}</div>`;
 const lessonCss=`body.lab-letter{font-size:19px}.lab-letter [lang=mn]{font-family:'Inter Tight','SUIT Variable',sans-serif;letter-spacing:-.01em}.lab-letter .mn{font-size:1.04em;line-height:1.8;word-break:normal;overflow-wrap:break-word}.lab-letter h1[lang=mn]{font-size:44px;font-weight:700;line-height:1.18;word-break:normal}.lab-letter h2[lang=mn]{font-size:29px;font-weight:700;line-height:1.3;word-break:normal}.lab-letter .deck{font-size:20px}.lab-letter .vision p{font-size:28px}.lab-letter .status{font-size:13px}.lab-letter .article-body p{margin:18px 0}.lab-letter .toc{margin:32px 0;padding:20px 24px;border-left:3px solid ${colors['Coral 3']};background:${colors.Oat}}.lab-letter .toc p{font-size:16px;font-weight:700;margin:0 0 10px}.lab-letter .toc a{display:flex;text-decoration:none;font-size:18px;min-height:44px;line-height:1.5;color:${colors.Ink}}.lab-letter .line{margin:20px 0;padding:24px 26px;background:${colors.Oat};border-left:3px solid ${colors['Coral 3']}}.lab-letter .speaker{font-size:16px;font-weight:700;color:${colors['Deep Wool']}}.lab-letter .line .say{font-size:29px;font-weight:800;line-height:1.5;letter-spacing:-.03em;margin:12px 0}.lab-letter .meaning{font-size:19.76px;line-height:1.65;word-break:normal}.lab-letter .choices{margin:24px 0;display:grid;gap:16px}.lab-letter .choice{border-bottom:1px solid ${colors.Stone};padding:4px 0 20px}.lab-letter .choice .phrase{font-size:24px;font-weight:800;margin:8px 0}.lab-letter .practice{margin:28px 0;padding:24px 26px;border:1px solid ${colors.Stone};background:${colors.Paper}}.lab-letter .practice .pattern{font-size:28px;font-weight:800;line-height:1.6;letter-spacing:-.03em}.lab-letter .blank{display:inline-block;border-bottom:2px solid ${colors.Ink};padding:0 8px;min-width:140px;text-align:center;font-size:24px;color:${colors['Deep Wool']}}.lab-letter .family{margin-top:54px;padding-top:4px;border-top:2px solid ${colors.Stone}}.lab-letter .role{border-top:1px solid ${colors.Stone};margin-top:44px;padding-top:20px}.lab-letter .review{border:1px solid ${colors.Stone};padding:20px 24px;margin-top:45px;font-size:16px;background:${colors.Oat}}.lab-letter .review summary{min-height:44px;cursor:pointer;font-weight:800}.lab-letter .review li{margin:12px 0}.lab-letter .small{font-size:16px;line-height:1.7;color:${colors['Deep Wool']}}@media(max-width:600px){body.lab-letter{font-size:18px}.lab-letter h1[lang=mn]{font-size:36px}.lab-letter h2[lang=mn]{font-size:26px}.lab-letter .vision p{font-size:24px}.lab-letter .line,.lab-letter .practice{padding:20px}.lab-letter .line .say{font-size:26px}.lab-letter .meaning{font-size:18.72px}.lab-letter .practice .pattern{font-size:25px}.lab-letter .blank{font-size:21px;min-width:120px}.lab-letter .toc{padding:16px 20px}}`;
 const body=`<article>
 <p class="eyebrow">Substack · SYNK LAB</p>
 <h1 lang="mn">${esc(page.titleMn)}</h1>
 <p class="deck" lang="ko">아직 정하지 않았어요.<br>먼저 해보고 싶은 일을 말해요.</p>
 <section class="vision" aria-label="SYNK LAB 공식 비전"><div class="brand">SYNK LAB</div><p lang="ko">${esc(vision)}</p></section>
 <div class="article-body">
 <p class="mn" lang="mn" data-font-probe="mn">${esc(text.intro)}</p>
 <p class="small" lang="mn">Солонгос өгүүлбэрийг хэлж үзнэ. Монгол тайлбар нь утга, хэрэглэх аргыг заана.</p>
 <nav class="toc" aria-label="Энэ захидалд"><p lang="mn">Энэ захидалд</p><a href="#conversation" lang="mn">Яриаг унших</a><a href="#my-sentence" lang="mn">Өөрийн өгүүлбэрээ хэлэх</a><a href="#small-step" lang="mn">Нэг жижиг зүйл хийж үзэх</a><a href="#family" lang="mn">Гэр бүлээрээ үргэлжлүүлэн ярилцах</a></nav>
 <section id="conversation" class="lab-dialogue"><h2 lang="mn">Яриаг уншаад, хариулж үзье.</h2>${mn('Сургалтын жишээ яриа. '+text.start)}${dialogue('Ярилцаж буй хүн',text.question.ko,text.question.mn)}${dialogue('Би',text.answer.ko,text.answer.mn)}${mn('Дараа нь хийж үзмээр байгаа зүйлээ хэлээрэй.')}</section>
 <section id="my-sentence" class="lab-practice"><h2 lang="mn">Одоо өөрийн өгүүлбэрээ хэлээрэй.</h2>${mn(text.replace)}<div class="choices">${choices.map(c=>`<div class="choice"><p class="phrase" lang="ko">${esc(c.phrase)}</p><p lang="ko">${esc(c.full)}</p>${meaning(c.meaning)}</div>`).join('')}</div><div class="practice"><p class="mn" lang="mn">${esc(text.instruction)}</p><p class="pattern" lang="ko" data-font-probe="ko">아직 정하지 않았어요.<br>먼저 <span class="blank">선택한 구절</span> 보고 싶어요.</p><p class="small" lang="ko">게임을 만들어 / 영상을 만들어 / 그림을 그려</p></div>${mn(text.privatePractice)}</section>
 <section id="small-step"><h2 lang="mn">Хэлсэн зүйлээ жижиг ажлаар үргэлжлүүлье.</h2>${mn(text.next)}<ul>${choices.map(c=>`<li lang="mn" class="mn">${esc(c.activity)}</li>`).join('')}</ul>${mn('Сонгосон ажлаа өөрийн дэвтэрт тэмдэглэж болно. Хийж үзсэний дараа юуг илүү мэдэхийг хүсэж байгаагаа бодоорой.')}</section>
 <section id="family" class="family lab-family"><p class="eyebrow" lang="mn">Гэр бүлээрээ унших хэсэг</p><h2 lang="mn">Эхлээд хүүхдийнхээ үгийг сонсоорой.</h2>${mn(text.familyListen)}<div class="line"><p class="say mn" lang="mn">${esc(text.familyQuestion)}</p></div>${mn(text.familyReflect)}${mn(text.familyCheck)}<p class="small" lang="mn">Сурах агуулга · Амьдрах нөхцөл · Зардал · Бэлтгэх зүйл, шаардлага</p></section>
 <section class="role"><p class="eyebrow">SYNK LAB</p>${mn(text.role)}<p class="mn" lang="mn">Өөрийн өгүүлбэрээ хэлээд, хийж үзэх нэг жижиг зүйлээ сонгоорой. Энэ захидлыг уншиж, ганцаараа дадлага хийхэд хариу илгээх шаардлагагүй.</p></section>
 </div></article>`;
 const reviewer=`<details class="review"><summary>제작·언어 검토 안내 · 공개 본문과 구분</summary><p>몽골어는 AI 초안을 바탕으로 편집했습니다. 제공 문구에 대한 Gemini AI 언어검토 제안을 부분 반영했으며, 원어민 감수와 학생 독해 확인은 수행하지 않았습니다. 미발행이며 공개 URL은 없습니다.</p><p>한국어는 직접 말할 문장, 몽골어는 상황의 뜻과 사용법입니다. 공식 LAB 비전은 한국어 전문으로 보존했으며 공식 몽골어 번역이나 새 서브텍스트를 만들지 않았습니다.</p><p>한국어 의미: ${esc(text.introKo)}</p><ul><li>학생 혼자: 완성 예시 → 구절 전체 교체 → 두 문장 말하기 → 작은 활동 하나. 종이에 적거나 혼자 말하면 끝납니다.</li><li>함께 읽는 보호자: 자녀가 고른 일을 먼저 듣고, 해본 뒤 느낀 점을 이야기합니다. 학교·과정 비교는 가족이 공식 조건을 따로 확인합니다.</li><li>검토 우선: 새 몽골어 제목·목차·연결 문장, ‘전공’의 뜻, 게임/영상의 의미, 교체 범위와 공개 제출이 필요 없다는 안내를 몽골어만 읽고 확인합니다.</li></ul><p>카드 이미지·문안 원천과 기존 8편은 변경하지 않았습니다. 이 글은 수강 혜택·개강일·입학·취업 보장이나 학생 성과를 안내하지 않습니다.</p></details>`;
 const html=`<!doctype html><html lang="mn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.titleMn)} — SYNK LAB</title><style>${css}\n${lessonCss}</style></head><body class="lab-letter"><header><a href="index.html" aria-label="원고 목록으로"><img src="${logo.src}" width="${logo.width}" height="${logo.height}" alt="SYNK LAB"></a><div class="status"><strong lang="mn">Хянуулах ноорог</strong><br>미발행 · 몽골어 감수 전</div></header><main class="wrap">${body}${reviewer}<footer class="footer"><a href="index.html">원고 목록으로</a><p lang="mn">Монгол хэлний эхийг төрөлх хэлтэй хүнээр хянуулаагүй. Энэ бол сургалтын жишээ юм.</p></footer></main></body></html>`;
 const markdown=`# ${page.titleMn}\n\n${page.title}\n\n> 미발행 · 몽골어 AI 초안, 원어민 감수 미확인. Хянуулах ноорог.\n\n${vision}\n\n${text.intro}\n\nСолонгос өгүүлбэрийг хэлж үзнэ. Монгол тайлбар нь утга, хэрэглэх аргыг заана.\n\n## Энэ захидалд\n\n- Яриаг унших\n- Өөрийн өгүүлбэрээ хэлэх\n- Нэг жижиг зүйл хийж үзэх\n- Гэр бүлээрээ үргэлжлүүлэн ярилцах\n\n## Яриаг уншаад, хариулж үзье.\n\nСургалтын жишээ яриа. ${text.start}\n\nЯрилцаж буй хүн\n\n> ${text.question.ko}\n\n${text.question.mn}\n\nБи\n\n> ${text.answer.ko}\n\n${text.answer.mn}\n\nДараа нь хийж үзмээр байгаа зүйлээ хэлээрэй.\n\n## Одоо өөрийн өгүүлбэрээ хэлээрэй.\n\n${text.replace}\n\n${choices.map(c=>`### ${c.phrase}\n\n${c.full}\n\n${c.meaning}`).join('\n\n')}\n\n${text.instruction}\n\n아직 정하지 않았어요.\n먼저 [선택한 구절] 보고 싶어요.\n\n게임을 만들어 / 영상을 만들어 / 그림을 그려\n\n${text.privatePractice}\n\n## Хэлсэн зүйлээ жижиг ажлаар үргэлжлүүлье.\n\n${text.next}\n\n${choices.map(c=>'- '+c.activity).join('\n')}\n\nСонгосон ажлаа өөрийн дэвтэрт тэмдэглэж болно. Хийж үзсэний дараа юуг илүү мэдэхийг хүсэж байгаагаа бодоорой.\n\n## Гэр бүлээрээ унших хэсэг\n\nЭхлээд хүүхдийнхээ үгийг сонсоорой.\n\n${text.familyListen}\n\n> ${text.familyQuestion}\n\n${text.familyReflect}\n\n${text.familyCheck}\n\nСурах агуулга · Амьдрах нөхцөл · Зардал · Бэлтгэх зүйл, шаардлага\n\n## SYNK LAB\n\n${text.role}\n\nӨөрийн өгүүлбэрээ хэлээд, хийж үзэх нэг жижиг зүйлээ сонгоорой. Энэ захидлыг уншиж, ганцаараа дадлага хийхэд хариу илгээх шаардлагагүй.\n`;
 return {html,markdown};
}
async function audit(browserPage,width,dir,session,domRoot){
 const path=require('node:path');const fonts={};
 for(const lang of ['mn','ko']){const {nodeId}=await session.send('DOM.querySelector',{nodeId:domRoot.nodeId,selector:`[data-font-probe="${lang}"]`});fonts[lang]=(await session.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;}
 if(width===390)for(const [label,selector] of [['대화','.lab-dialogue'],['구절교체','.lab-practice'],['연습','.practice'],['보호자','.lab-family']]){await browserPage.locator(selector).evaluate(e=>e.scrollIntoView({block:'start'}));await browserPage.screenshot({path:path.join(dir,'qa',`09-Substack-LAB-${label}-390.png`)});}
 return {width,fonts,hasMongolianFont:fonts.mn.some(f=>/InterTight/.test(f.postScriptName)),hasKoreanFont:fonts.ko.some(f=>/SUIT/.test(f.postScriptName)),fallback:[...fonts.mn,...fonts.ko].filter(f=>!f.isCustomFont)};
}
module.exports={page,text,choices,render,audit};
