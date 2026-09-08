/* 이 시안만의 재현 스크립트. 공용 제작 도구는 수정하지 않는다. */
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = path.resolve(__dirname, '../../..');
const original = path.join(root, 'tools/캐러셀굽기.js');
let source = fs.readFileSync(original, 'utf8');
const start = source.indexOf('const 꼬리 =');
const end = source.indexOf('/* ── 지면');
if (start < 0 || end < 0) throw new Error('공용 제작 도구의 구조가 달라졌습니다.');
source = source.slice(0, start) + "const 총쪽 = 7; const 꼬리 = 'SYNK LAB · 한국어 한마디';\n" + source.slice(end);
source = source.slice(0, source.lastIndexOf('\nmain();'));
source += '\nmodule.exports = { 지면짓기, 브랜드폰트, 색 };';
const renderer = new Module(original, module);
renderer.filename = original;
renderer.paths = Module._nodeModulePaths(path.dirname(original));
renderer._compile(source, original);
const { 지면짓기, 브랜드폰트, 색 } = renderer.exports;
const k = (s) => `<span class="kr">${s}</span>`;
const cards = [
  {제목:k('괜찮아요'), 몽골:'Кофе ууна гэсэн үг үү?', 한국:'커피를 권했는데 “괜찮아요.”<br>마신다는 뜻일까요?', 몽글:true, 실땀:true},
  {제목:'Эелдгээр татгалзах', 몽골:`${k('커피 드릴까요?')}<br>${k('아니요, 괜찮아요.')}<br><span class="meaning">Одоо авахгүй гэсэн үг.</span>`, 한국:'커피 드릴까요? → 아니요, 괜찮아요.<br>이때는 정중하게 사양하는 말이에요.'},
  {제목:'Кофе авах', 몽골:`${k('네, 주세요.')}<br><span class="meaning">Ингэж хэлбэл санаа тань<br>илүү тодорхой болно.</span>`, 한국:'네, 주세요.<br>받고 싶다면 이렇게 말해 보세요.'},
  {제목:'Тайвшруулах', 몽골:`${k('늦어서 미안해요.')}<br>${k('괜찮아요.')}<br><span class="meaning">Санаа зоволтгүй гэсэн үг.</span>`, 한국:'늦어서 미안해요. → 괜찮아요.<br>이때는 상대를 안심시키는 말이에요.'},
  {제목:'Бие, байдлыг асуух', 몽골:`${k('괜찮아요?')}<br>${k('네, 괜찮아요.')}<br><span class="meaning">Зүгээр үү? → Тийм ээ, зүгээр.</span>`, 한국:'괜찮아요? → 네, 괜찮아요.<br>상대의 상태를 묻고 답하는 말이에요.'},
  {제목:'Та юу гэж хэлэх вэ?', 몽골:`${k('더 드릴까요?')}<br><span class="meaning">Та цадсан бол?</span><br>${k('A  네, 주세요.')}<br>${k('B  아니요, 괜찮아요.')}`, 한국:'더 드릴까요?<br>배가 부를 때는 어느 쪽으로 답할까요?'},
  {제목:'Хариулт: B', 몽골:`${k('아니요, 괜찮아요.')}<br><span class="meaning">Утга нь нөхцөл байдал,<br>өмнөх ба дараах үгээс хамаарна.</span>`, 한국:'커피를 권받으면 뭐라고 답할까요?<br>몽골어로 답해도 좋아요.', 몽글:true}
];
const fontRoot = path.join(root, 'docs/브랜드_폰트/InterTight');
const fonts = [['Regular',400],['Medium',500],['SemiBold',600],['Bold',700]].map(([n,w])=>`@font-face{font-family:'Inter Tight';font-weight:${w};src:url(data:font/ttf;base64,${fs.readFileSync(path.join(fontRoot,`InterTight-${n}.ttf`)).toString('base64')}) format('truetype');}`).join('');
for (const [i,c] of cards.entries()) {
  let html = 지면짓기({...c,쪽:i+1,틀:'글'}).원고;
  html=html.replace('</style>',`${fonts}\n.kr{font-family:'SUIT Variable';font-weight:800;letter-spacing:-.025em}.제목{font-size:78px}.몽골{font-size:56px;line-height:1.55}.몽골 .kr{font-size:68px}.meaning{display:inline-block;margin-top:26px;font-size:44px;line-height:1.42}.한국{font-size:32px;color:${색('Deep Wool')};margin-top:40px;line-height:1.6}.꼬리{font-family:'Inter Tight','SUIT Variable';color:${색('Deep Wool')}}.판{padding-bottom:240px}.몽글{bottom:125px;width:230px}${i===0?`.제목{font-size:144px;color:${색('Coral 3')}}.몽골{font-size:72px;line-height:1.12;max-width:760px}.한국{font-size:39px}`:''}</style>`);
  html=브랜드폰트.심기(html).html;
  fs.writeFileSync(path.join(__dirname, `${String(i+1).padStart(2,'0')}.html`),html);
}
fs.writeFileSync(path.join(__dirname,'몽골어검문.txt'), '커피를 마신다는 뜻인가요?\n정중하게 사양하기. 지금은 받지 않겠다는 뜻.\n커피 받기. 이렇게 말하면 뜻이 더 분명해져요.\n안심시키기. 걱정하지 않아도 된다는 뜻.\n상태 묻기. 괜찮아요? 네, 괜찮아요.\n뭐라고 말할까요? 배가 부르다면?\n정답 B. 뜻은 상황과 앞뒤 말에 따라 달라져요.\n---\nКофе ууна гэсэн үг үү?\nЭелдгээр татгалзах. Одоо авахгүй гэсэн үг.\nКофе авах. Ингэж хэлбэл санаа тань илүү тодорхой болно.\nТайвшруулах. Санаа зоволтгүй гэсэн үг.\nБие, байдлыг асуух. Зүгээр үү? Тийм ээ, зүгээр.\nТа юу гэж хэлэх вэ? Та цадсан бол?\nХариулт: B. Утга нь нөхцөл байдал, өмнөх ба дараах үгээс хамаарна.');
console.log('7/7 카드 HTML 생성. 공용 펠트 자산 + SUIT/Inter Tight 서체 내장.');
