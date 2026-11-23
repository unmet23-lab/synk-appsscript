// 첫 레슨들(인사 팩)의 화면 언어 글 · 1판(2026-10-19 「WORLD 화면 언어」).
// 학습 내용(보기·표현·이야기 대사·레슨 제목)은 life-content.mjs의 한국어 그대로다. 여기에는 문제 지시(prompt)·상황(context)·해설(explanation),
// 표현 설명(meaning)과 답한 뒤 누르는 「뜻 보기」의 보기 뜻만 둔다. 문장 속 ‘한국어 인용’은 학습 내용이라 한국어로 남긴다.
// ko는 원문의 사본이다: 원문을 고치면 qa/life-content-lang.test.mjs가 이 표가 낡았다고 알린다(번역을 같이 고친다).
// 몽골어는 tools/몽골어대조.js로 검문했다(결과는 brand-opening/world-strings-check.json).
const q=(ko,en,mn)=>({ko,en,mn});

export const LIFE_QUESTION_TEXT=Object.freeze({
 'greetings-expressions-hello':q(
  {prompt:'처음 만난 선생님에게 어떤 인사를 할까요?',context:'교실에 들어가 선생님을 처음 만났어요.',explanation:'새로 만난 사람에게는 ‘안녕하세요’라고 인사해요.'},
  {prompt:'How do you greet a teacher you’re meeting for the first time?',context:'You walk into the classroom and meet the teacher for the first time.',explanation:'To someone you’ve just met, say ‘안녕하세요’.'},
  {prompt:'Анх уулзаж буй багштайгаа хэрхэн мэндлэх вэ?',context:'Та анги руу орж, багштайгаа анх удаа уулзлаа.',explanation:'Шинээр уулзсан хүнтэй «안녕하세요» гэж мэндэлнэ.'}),
 'greetings-expressions-hello-transfer':q(
  {prompt:'처음 만난 직원에게 어떤 인사를 할까요?',context:'학교 사무실에 처음 가서 직원을 만났어요.',explanation:'처음 만난 사람에게는 ‘안녕하세요’라고 인사해요. ‘다녀왔어요’는 밖에 나갔다가 집이나 회사에 돌아왔을 때 하는 말이에요. ‘감사합니다’는 고마운 일이 있을 때 하는 말이에요.'},
  {prompt:'How do you greet a staff member you’re meeting for the first time?',context:'You go to the school office for the first time and meet a staff member.',explanation:'Say ‘안녕하세요’ to someone you’re meeting for the first time. ‘다녀왔어요’ is what you say when you get back home or to work. ‘감사합니다’ is what you say when you’re thankful for something.'},
  {prompt:'Анх уулзаж буй ажилтантай хэрхэн мэндлэх вэ?',context:'Та сургуулийн захиргаанд анх удаа очиж, тэндхийн нэг ажилтантай уулзлаа.',explanation:'Анх уулзаж буй хүнтэйгээ «안녕하세요» гэж мэндэлнэ. «다녀왔어요» гэдэг нь гадуур явж байгаад гэртээ эсвэл ажилдаа буцаж ирэхдээ хэлдэг үг. «감사합니다» гэдэг нь талархах сэтгэл төрсөн үед хэлдэг үг.'}),
 'greetings-expressions-thanks':q(
  {prompt:'도움을 받았어요. 어떤 말을 할까요?',context:'친구가 떨어진 책을 주워 줬어요.',explanation:'도움을 받은 뒤에는 ‘감사합니다’로 고마움을 전해요.'},
  {prompt:'Someone helped you. What do you say?',context:'A friend picked up the book you dropped.',explanation:'After getting help, say ‘감사합니다’ to show your thanks.'},
  {prompt:'Та тусламж авлаа. Юу гэж хэлэх вэ?',context:'Найз тань таны унагаасан номыг авч өглөө.',explanation:'Тусламж авсны дараа «감사합니다» гэж талархлаа илэрхийлнэ.'}),
 'greetings-expressions-thanks-transfer':q(
  {prompt:'도움을 준 직원에게 고마움을 전하려고 해요. 어떤 말을 할까요?',context:'직원이 잃어버린 우산을 찾아 줬어요.',explanation:'우산을 찾아 준 도움에 ‘감사합니다’라고 말해요.'},
  {prompt:'You want to thank the staff member who helped you. What do you say?',context:'A staff member found the umbrella you lost.',explanation:'For the help finding your umbrella, say ‘감사합니다’.'},
  {prompt:'Танд тусалсан ажилтанд талархлаа илэрхийлэх гэж байна. Юу гэж хэлэх вэ?',context:'Ажилтан таны гээсэн шүхрийг олж өглөө.',explanation:'Шүхрийг тань олж өгсөн ажилтанд «감사합니다» гэж хэлнэ.'}),
 'greetings-expressions-name':q(
  {prompt:'자기 이름을 소개하는 말을 골라요.',context:'처음 만난 친구에게 내 이름을 말해요.',explanation:'자기 이름을 말할 때는 ‘저는 수진이에요’라고 해요. ‘안녕하세요’는 인사, ‘감사합니다’는 고마움을 전하는 말이에요.'},
  {prompt:'Choose the sentence that introduces your own name.',context:'You tell a friend you just met your name.',explanation:'To say your own name, say ‘저는 수진이에요’. ‘안녕하세요’ is a greeting, and ‘감사합니다’ is how you say thank you.'},
  {prompt:'Өөрийгөө танилцуулах үгийг сонгоно уу.',context:'Анх уулзаж буй хүндээ нэрээ хэлж байна.',explanation:'Нэрээ хэлэхдээ «저는 수진이에요» гэж хэлнэ. «안녕하세요» нь мэндчилгээ, «감사합니다» нь талархал илэрхийлэх үг.'}),
 'greetings-expressions-name-transfer':q(
  {prompt:'자기 이름을 소개하는 말을 골라요.',context:'내 이름은 준영이에요.',explanation:'‘저는 준영이에요’는 자기 이름을 말하는 소개예요.'},
  {prompt:'Choose the sentence that introduces your own name.',context:'Your name is Junyoung.',explanation:'‘저는 준영이에요’ is how you say your own name.'},
  {prompt:'Өөрийгөө танилцуулах үгийг сонгоно уу.',context:'Таны нэр Жүнёон.',explanation:'«저는 준영이에요» гэдэг нь нэрээ хэлж өөрийгөө танилцуулж буй үг.'}),
 'greetings-story-name':q(
  {prompt:'처음 인사한 사람의 이름은 무엇이에요?',context:'',explanation:'서하가 가장 먼저 ‘안녕하세요! 저는 서하예요.’라고 인사했어요. 지호와 태오는 그다음에 말했어요.'},
  {prompt:'What is the name of the person who greeted you first?',context:'',explanation:'Seoha greeted you first: ‘안녕하세요! 저는 서하예요.’ Jiho and Taeo spoke after her.'},
  {prompt:'Хамгийн түрүүнд мэндэлсэн хүний нэр хэн бэ?',context:'',explanation:'Сөха хамгийн түрүүнд «안녕하세요! 저는 서하예요.» гэж мэндэлсэн. Жихо, Тэо хоёр дараа нь ярьсан.'}),
 'greetings-story-name-transfer':q(
  {prompt:'자기 이름을 소개한 사람은 누구예요?',context:'준호: “안녕하세요.” 민지: “저는 민지예요.” 하나: “감사합니다.”',explanation:'‘저는 민지예요’는 자기 이름을 소개하는 말이에요. 준호는 인사했고, 하나는 고마움을 전했어요.'},
  {prompt:'Who introduced their own name?',context:'Junho: “안녕하세요.” Minji: “저는 민지예요.” Hana: “감사합니다.”',explanation:'‘저는 민지예요’ is how you say your own name. Junho said hello, and Hana said thank you.'},
  {prompt:'Өөрийгөө танилцуулсан хүн хэн бэ?',context:'Жүнхо: “안녕하세요.” Минжи: “저는 민지예요.” Хана: “감사합니다.”',explanation:'«저는 민지예요» нь өөрийгөө танилцуулж буй үг. Жүнхо мэндэлсэн, Хана талархал илэрхийлсэн.'}),
 'greetings-story-thanks':q(
  {prompt:'내가 ‘감사합니다’라고 한 이유는 무엇이에요?',context:'',explanation:'태오가 내 이름표를 찾아서 줬어요. 그래서 고마움을 전했어요.'},
  {prompt:'Why did you say ‘감사합니다’?',context:'',explanation:'Taeo found your name tag and gave it to you. So you thanked him.'},
  {prompt:'Та яагаад «감사합니다» гэж хэлсэн бэ?',context:'',explanation:'Тэо таны нэрийн пайзыг олоод өгсөн. Тиймээс та талархсан.'}),
 'greetings-story-thanks-transfer':q(
  {prompt:'민지가 준호에게 ‘감사합니다’라고 했어요. 왜 그렇게 말했을까요?',context:'준호가 교실에 왔어요. 민지는 볼펜이 없어요. 준호가 민지에게 볼펜을 줬어요.',explanation:'준호가 볼펜을 준 도움에 민지가 ‘감사합니다’라고 고마움을 전했어요. ‘준호가 교실에 왔어요’는 감사 인사를 한 이유가 아니에요.'},
  {prompt:'Minji said ‘감사합니다’ to Junho. Why did she say it?',context:'Junho came into the classroom. Minji has no pen. Junho gave Minji a pen.',explanation:'Minji said ‘감사합니다’ to thank Junho for giving her a pen. ‘준호가 교실에 왔어요’ (Junho came into the classroom) is not the reason she thanked him.'},
  {prompt:'Минжи Жүнход «감사합니다» гэж хэлсэн. Яагаад тэгж хэлсэн бэ?',context:'Жүнхо ангид ирсэн. Минжид үзэг байгаагүй. Жүнхо Минжид үзэг өгсөн.',explanation:'Жүнхо үзэг өгсөнд Минжи «감사합니다» гэж талархсан. «준호가 교실에 왔어요» (Жүнхо ангид ирсэн) нь талархсан шалтгаан биш.'}),
 'greetings-story-hello':q(
  {prompt:'학교에서 처음 만난 사람에게 먼저 할 말을 골라요.',context:'',explanation:'처음 만난 사람에게는 먼저 ‘안녕하세요’라고 인사해요.'},
  {prompt:'Choose what to say first to someone you meet at school for the first time.',context:'',explanation:'To someone you’re meeting for the first time, first say ‘안녕하세요’.'},
  {prompt:'Сургууль дээр анх уулзаж буй хүндээ хамгийн түрүүнд хэлэх үгийг сонгоно уу.',context:'',explanation:'Анх уулзаж буй хүнтэйгээ эхлээд «안녕하세요» гэж мэндэлнэ.'}),
 'greetings-story-hello-transfer':q(
  {prompt:'새 동아리에서 처음 만난 친구에게 정중하게 인사해요.',context:'동아리 첫 모임에 왔어요. 처음 보는 친구가 있어요.',explanation:'처음 만난 사람에게는 ‘안녕하세요’라고 인사해요. ‘잘 먹겠습니다’는 밥을 먹기 전에, ‘다녀왔습니다’는 집에 돌아왔을 때 하는 말이에요.'},
  {prompt:'Greet a friend you meet for the first time at a new club, politely.',context:'You’ve come to the club’s first meeting. There is a friend you’ve never seen before.',explanation:'Say ‘안녕하세요’ to someone you meet for the first time. ‘잘 먹겠습니다’ is said before eating, and ‘다녀왔습니다’ when you get home.'},
  {prompt:'Шинэ клубт анх уулзаж буй хүнтэйгээ эелдгээр мэндэлнэ үү.',context:'Та клубын анхны уулзалтад ирлээ. Тэнд таны анх удаа уулзаж буй хүн байна.',explanation:'Анх уулзаж буй хүнтэйгээ «안녕하세요» гэж мэндэлнэ. «잘 먹겠습니다» нь хоол идэхийн өмнө, «다녀왔습니다» нь гэртээ ирэхдээ хэлдэг үг.'}),
 'greetings-apply-introduction':q(
  {prompt:'이름을 묻는 말에 답해요.',context:'“이름이 뭐예요?” 내 이름은 수진이에요.',explanation:'이름을 물었으므로 ‘저는 수진이에요’라고 소개해요.'},
  {prompt:'Answer when someone asks your name.',context:'“이름이 뭐예요?” Your name is Sujin.',explanation:'They asked your name, so you say ‘저는 수진이에요’.'},
  {prompt:'Нэрийг тань асуухад хариулна уу.',context:'“이름이 뭐예요?” Таны нэр Сүжин.',explanation:'Нэрийг тань асуусан тул «저는 수진이에요» гэж танилцуулна.'}),
 'greetings-apply-introduction-transfer':q(
  {prompt:'이름을 묻는 말에 답해요.',context:'“성함이 어떻게 되세요?” 내 이름은 지훈이에요.',explanation:'‘성함’은 이름을 높여 말한 표현이에요. 자기 이름을 답해요.'},
  {prompt:'Answer when someone asks your name.',context:'“성함이 어떻게 되세요?” Your name is Jihun.',explanation:'‘성함’ is a polite word for “name”. Answer with your own name.'},
  {prompt:'Нэрийг тань асуухад хариулна уу.',context:'“성함이 어떻게 되세요?” Таны нэр Жихүн.',explanation:'«성함» гэдэг нь «нэр» гэдгийг хүндэтгэлтэй хэлсэн үг. Өөрийн нэрээ хэлж хариулна.'}),
 'greetings-apply-thanks':q(
  {prompt:'필요한 말을 골라요.',context:'처음 온 학교에서 직원이 교실 위치를 알려 줬어요. 고마움을 전하려고 해요.',explanation:'위치를 알려 준 도움에 ‘감사합니다’라고 해요.'},
  {prompt:'Choose what you need to say.',context:'At a school you’re visiting for the first time, a staff member showed you where the classroom is. You want to say thanks.',explanation:'For the help finding the classroom, say ‘감사합니다’.'},
  {prompt:'Тохирох үгийг сонгоно уу.',context:'Анх удаа очсон сургуулийн ажилтан танд ангийн байршлыг зааж өглөө. Та талархлаа илэрхийлэхийг хүсэж байна.',explanation:'Байршлыг зааж өгч тусалсанд «감사합니다» гэнэ.'}),
 'greetings-apply-thanks-transfer':q(
  {prompt:'지금 필요한 말을 골라요.',context:'카페 직원이 두고 온 가방을 찾아 줬어요. 도움에 고마움을 전하려고 해요.',explanation:'가방을 찾아 준 도움에 고마움을 전하는 말은 ‘감사합니다’예요.'},
  {prompt:'Choose what you need to say now.',context:'A café worker found the bag you left behind. You want to thank them for the help.',explanation:'To thank someone for finding your bag, say ‘감사합니다’.'},
  {prompt:'Одоо тохирох үгийг сонгоно уу.',context:'Кафены ажилтан таны мартаж орхисон цүнхийг олж өглөө. Тусламжид нь талархлаа илэрхийлэхийг хүсэж байна.',explanation:'Цүнхийг олж өгч тусалсанд талархах үг бол «감사합니다».'}),
 'greetings-apply-hello':q(
  {prompt:'교실 문을 열고 처음 만난 선생님에게 말해요.',context:'아직 대화를 시작하기 전이에요.',explanation:'대화를 시작하기 전에 ‘안녕하세요’로 정중하게 인사해요.'},
  {prompt:'You open the classroom door. Speak to the teacher you’re meeting for the first time.',context:'The conversation hasn’t started yet.',explanation:'Before you start talking, greet politely with ‘안녕하세요’.'},
  {prompt:'Ангийн хаалгыг нээгээд анх уулзаж буй багшдаа хэлэх үгээ сонгоно уу.',context:'Яриа хараахан эхлээгүй байна.',explanation:'Яриа эхлэхээс өмнө «안녕하세요» гэж эелдгээр мэндэлнэ.'}),
 'greetings-apply-hello-transfer':q(
  {prompt:'처음 방문한 가게의 직원에게 말을 시작해요.',context:'아직 상품을 고르거나 도움을 받기 전이에요.',explanation:'처음 대화를 시작할 때 정중한 인사는 ‘안녕하세요’예요.'},
  {prompt:'Start talking to a worker at a shop you’re visiting for the first time.',context:'You haven’t picked anything or gotten help yet.',explanation:'When you first start a conversation, the polite greeting is ‘안녕하세요’.'},
  {prompt:'Анх очсон дэлгүүрийн ажилтантай яриа эхлүүлнэ үү.',context:'Та одоохондоо бараа сонгоогүй, тусламж ч аваагүй байна.',explanation:'Анх яриа эхлэхэд хэрэглэх эелдэг мэндчилгээ бол «안녕하세요».'}),
});

// 표현 익히기 카드의 설명(표현 자체는 한국어 그대로).
export const LIFE_EXPRESSION_TEXT=Object.freeze({
 'greet-hello':q('처음 만난 사람이나 아는 사람에게 정중하게 인사해요.','A polite greeting for anyone you meet, even for the first time.','Хэнтэй уулзсан ч, бүр анх удаа ч гэсэн эелдгээр мэндлэх үг.'),
 'greet-thanks':q('도움을 받았을 때 정중하게 고마움을 전해요.','Politely says thank you when someone helps you.','Тусламж авахдаа эелдгээр талархлаа илэрхийлнэ.'),
 'greet-name':q('자기 이름을 소개해요. 이름 끝에 받침이 있으면 ‘이에요’, 없으면 ‘예요’를 써요.','Introduces your own name. If the name ends in a final consonant (받침), use ‘이에요’; if not, use ‘예요’.','Өөрийгөө танилцуулахад хэрэглэнэ. Нэр тань гийгүүлэгчээр (받침) төгссөн бол «이에요»-г, үгүй бол «예요»-г хэрэглэнэ.'),
});

// 「뜻 보기」: 답한 뒤에만 보이는 보기의 뜻. 키는 보기 글자 그대로다.
export const LIFE_CHOICE_MEANINGS=Object.freeze({
 '안녕하세요.':{en:'Hello. (a polite greeting)',mn:'Сайн байна уу? (эелдэг мэндчилгээ)'},
 '감사합니다.':{en:'Thank you.',mn:'Баярлалаа.'},
 '다녀왔어요.':{en:'I’m back. (said when you get home)',mn:'Ирлээ. (гэртээ ирэхдээ хэлдэг)'},
 '다녀왔습니다.':{en:'I’m back. (said politely when you get home)',mn:'Ирлээ. (гэртээ ирэхдээ эелдгээр хэлдэг)'},
 '저는 수진이에요.':{en:'I’m Sujin.',mn:'Би Сүжин.'},
 '저는 지훈이에요.':{en:'I’m Jihun.',mn:'Би Жихүн.'},
 '처음 뵙겠습니다.':{en:'Nice to meet you. (very polite, at a first meeting)',mn:'Танилцсандаа таатай байна. (анх уулзахдаа хэлдэг, маш эелдэг)'},
 '잘 먹겠습니다.':{en:'Thank you for the food. (said before eating)',mn:'Хоол идэхийн өмнө хэлдэг талархлын үг.'},
 '학교에 있어요.':{en:'(I’m) at school.',mn:'(Би) сургууль дээр байна.'},
 '저는 학생이에요.':{en:'I’m a student.',mn:'Би сурагч.'},
 '지훈은 집에 있어요.':{en:'Jihun is at home.',mn:'Жихүн гэртээ байна.'},
 '서하':{en:'Seoha (a name)',mn:'Сөха (нэр)'},
 '지호':{en:'Jiho (a name)',mn:'Жихо (нэр)'},
 '태오':{en:'Taeo (a name)',mn:'Тэо (нэр)'},
 '준호':{en:'Junho (a name)',mn:'Жүнхо (нэр)'},
 '민지':{en:'Minji (a name)',mn:'Минжи (нэр)'},
 '하나':{en:'Hana (a name)',mn:'Хана (нэр)'},
 '태오가 이름표를 줬어요.':{en:'Taeo gave me the name tag.',mn:'Тэо надад нэрийн пайз өгсөн.'},
 '지호가 이름표를 줬어요.':{en:'Jiho gave me the name tag.',mn:'Жихо надад нэрийн пайз өгсөн.'},
 '태오가 자기 이름을 말했어요.':{en:'Taeo said his own name.',mn:'Тэо нэрээ хэлсэн.'},
 '준호가 볼펜을 줬어요.':{en:'Junho gave a pen.',mn:'Жүнхо үзэг өгсөн.'},
 '준호가 교실에 왔어요.':{en:'Junho came into the classroom.',mn:'Жүнхо ангид ирсэн.'},
 '민지가 볼펜을 줬어요.':{en:'Minji gave a pen.',mn:'Минжи үзэг өгсөн.'},
 '안녕히 계세요.':{en:'Goodbye. (said when you leave and the other person stays)',mn:'Баяртай. (та явж, нөгөө хүн үлдэх үед хэлдэг)'},
 '죄송합니다.':{en:'I’m sorry.',mn:'Уучлаарай.'},
 '저는 준영이에요.':{en:'I’m Junyoung.',mn:'Би Жүнёон.'},
 '준영은 어디에 있어요?':{en:'Where is Junyoung?',mn:'Жүнёон хаана байна вэ?'},
 '준영은 학교에 가요.':{en:'Junyoung goes to school.',mn:'Жүнёон сургууль руу явж байна.'},
});

// 문제 한 개의 화면 언어 글. 이 표에 없는 문제(1판 밖의 팩)는 원문 그대로다.
export function lifeQuestionText(question,field,lang){
 const original=question?.[field]??'';
 if(lang==='ko'||!question)return original;
 const entry=LIFE_QUESTION_TEXT[question.id];
 if(!entry||entry.ko[field]!==original)return original;
 return entry[lang]?.[field]??original;
}
export function lifeExpressionText(expression,lang){
 const original=expression?.meaning??'';
 if(lang==='ko'||!expression)return original;
 const entry=LIFE_EXPRESSION_TEXT[expression.id];
 return entry&&entry.ko===original?entry[lang]??original:original;
}
// 문제에 「뜻 보기」를 붙일 수 있으면 보기마다 뜻을, 아니면 null(한국어 화면 · 1판 밖 문제 · 뜻이 빠진 보기).
export function lifeChoiceMeanings(question,lang){
 if(lang==='ko'||!question||!LIFE_QUESTION_TEXT[question.id])return null;
 const rows=question.choices.map(choice=>({id:choice.id,text:choice.text,meaning:LIFE_CHOICE_MEANINGS[choice.text]?.[lang]||null}));
 return rows.every(row=>row.meaning)?rows:null;
}

// 답한 뒤 보기마다 붙는 한 줄(2026-11-22 유호님 「틀렸으면 "아니에요 이 뜻은 언제 사용하는거에요"」).
// 고른 오답 보기 아래에 그 말을 언제 쓰는지(또는 왜 이 자리의 답이 아닌지)를 화면 언어로 연다. 맞힌 뒤에는 「다른 보기는 언제 쓰나요?」로 나머지를 연다.
// 문항 × 보기로 단다: 같은 보기 글도 문항마다 할 말이 다를 수 있다. text는 그 보기의 지금 글 사본이다 — 원문 보기가 바뀌면 이 줄은 쓰지 않는다.
// 몽골어는 tools/몽골어대조.js로 검문한다.
const note=(text,ko,en,mn)=>({text,ko,en,mn});
const N={
 thanks:['고마운 일이 있을 때 하는 말이에요.','You say this when someone has done something for you.','Хэн нэгэн танд тусалсан үед хэлдэг үг.'],
 back:['밖에 나갔다가 집이나 회사에 돌아왔을 때 하는 말이에요.','You say this when you come back home or to work after going out.','Гадуур явж байгаад гэртээ эсвэл ажилдаа буцаж ирэхдээ хэлдэг үг.'],
 backPolite:['밖에 나갔다가 집에 돌아왔을 때 정중하게 하는 말이에요.','You say this politely when you come back home after going out.','Гадуур явж байгаад гэртээ буцаж ирэхдээ эелдгээр хэлдэг үг.'],
 hello:['사람을 만났을 때 하는 인사예요.','This is the greeting you say when you meet someone.','Хүнтэй уулзахдаа хэлдэг мэндчилгээ.'],
 myName:['자기 이름을 말할 때 써요.','You use this to say your own name.','Нэрээ хэлэхдээ хэрэглэдэг.'],
 firstMeet:['처음 만난 사람에게 정중하게 하는 인사예요. 고마움을 전하는 말은 아니에요.','A polite greeting for someone you meet for the first time. It does not say thank you.','Анх уулзаж буй хүндээ хэлдэг эелдэг мэндчилгээ. Талархал илэрхийлдэггүй.'],
 byeStay:['내가 떠나고 상대가 남을 때 하는 인사예요.','A goodbye you say when you leave and the other person stays.','Та явж, нөгөө хүн үлдэх үед хэлдэг салах ёсны үг.'],
 goPlace:['어디에 가는지 말할 때 써요.','You use this to say where you are going.','Хаашаа явж байгаагаа хэлэхдээ хэрэглэдэг.'],
 whereOther:['다른 사람이 어디에 있는지 물을 때 써요.','You use this to ask where someone else is.','Өөр хүн хаана байгааг асуухдаа хэрэглэдэг.'],
 otherGoes:['다른 사람이 어디에 가는지 말할 때 써요.','You use this to say where someone else is going.','Өөр хүн хаашаа явж байгааг хэлэхдээ хэрэглэдэг.'],
 place:['있는 곳을 말할 때 써요. 이름을 묻는 말의 답이 아니에요.','You use this to say where someone is. It does not answer a question about your name.','Хаана байгааг хэлэхдээ хэрэглэдэг. Нэр асуусан асуултын хариулт биш.'],
 otherAt:['다른 사람이 있는 곳을 말할 때 써요.','You use this to say where someone else is.','Өөр хүн хаана байгааг хэлэхдээ хэрэглэдэг.'],
 whoAmI:['내가 누구인지 말할 때 써요.','You use this to say who you are.','Өөрийгөө хэн болохыг хэлэхдээ хэрэглэдэг.'],
 sorry:['잘못했을 때 미안한 마음을 전하는 말이에요.','You say this to apologize when you did something wrong.','Буруу зүйл хийсэн үедээ уучлал гуйж хэлдэг үг.'],
 eat:['밥을 먹기 전에 하는 말이에요.','You say this before you start eating.','Хоол идэхийн өмнө хэлдэг үг.'],
};
const n=(text,key)=>note(text,...N[key]);

export const LIFE_CHOICE_NOTES=Object.freeze({
 'greetings-expressions-hello':{b:n('감사합니다.','thanks'),c:n('다녀왔어요.','back')},
 'greetings-expressions-hello-transfer':{a:n('다녀왔어요.','back'),c:n('감사합니다.','thanks')},
 'greetings-expressions-thanks':{a:n('저는 수진이에요.','myName'),b:n('안녕하세요.','hello')},
 'greetings-expressions-thanks-transfer':{b:n('처음 뵙겠습니다.','firstMeet'),c:n('안녕히 계세요.','byeStay')},
 'greetings-expressions-name':{a:n('안녕하세요.','hello'),c:n('감사합니다.','thanks')},
 'greetings-expressions-name-transfer':{a:n('준영은 어디에 있어요?','whereOther'),c:n('준영은 학교에 가요.','otherGoes')},
 'greetings-apply-introduction':{a:n('학교에 있어요.','place'),c:n('감사합니다.','thanks')},
 'greetings-apply-introduction-transfer':{b:n('지훈은 집에 있어요.','otherAt'),c:n('안녕하세요.','hello')},
 'greetings-apply-thanks':{a:n('저는 학생이에요.','whoAmI'),b:n('안녕하세요.','hello')},
 'greetings-apply-thanks-transfer':{a:n('안녕하세요.','hello'),c:n('죄송합니다.','sorry')},
 'greetings-apply-hello':{b:n('안녕히 계세요.','byeStay'),c:n('감사합니다.','thanks')},
 'greetings-apply-hello-transfer':{a:n('감사합니다.','thanks'),b:n('잘 먹겠습니다.','eat')},
 'greetings-story-name':{b:note('지호','지호는 서하 다음에 말했어요. 여기에서 이름표를 찾으라고 했어요.','Jiho spoke after Seoha and asked you to find your name tag here.','Жихо Сөхагийн дараа ярьсан. Тэр танд «Нэрийн пайзаа эндээс хайгаарай» гэж хэлсэн.'),c:note('태오','태오는 나중에 이름표를 찾아 줬어요.','Taeo came later and found your name tag.','Тэо дараа нь таны нэрийн пайзыг олж өгсөн.')},
 'greetings-story-name-transfer':{a:note('준호','준호는 ‘안녕하세요’라고 인사만 했어요.','Junho only said hello: ‘안녕하세요’.','Жүнхо зөвхөн «안녕하세요» гэж мэндэлсэн.'),c:note('하나','하나는 ‘감사합니다’라고 고마움을 전했어요.','Hana said thank you: ‘감사합니다’.','Хана «감사합니다» гэж талархал илэрхийлсэн.')},
 'greetings-story-thanks':{b:note('지호가 이름표를 줬어요.','지호는 이름표를 찾으라고 했어요. 이름표를 준 사람은 태오예요.','Jiho asked you to find your name tag. The person who gave it to you was Taeo.','Жихо танд «Нэрийн пайзаа хайгаарай» гэж хэлсэн. Пайзыг өгсөн хүн нь Тэо.'),c:note('태오가 자기 이름을 말했어요.','태오는 자기 이름을 말하지 않았어요. 내 이름표를 줬어요.','Taeo did not say his own name. He gave you your name tag.','Тэо өөрийн нэрээ хэлээгүй. Таны нэрийн пайзыг танд өгсөн.')},
 'greetings-story-thanks-transfer':{b:note('준호가 교실에 왔어요.','준호가 교실에 온 것은 고마움을 전할 이유가 아니에요.','Junho coming into the classroom is not a reason to say thank you.','Жүнхо ангид ирсэн нь талархах шалтгаан биш.'),c:note('민지가 볼펜을 줬어요.','볼펜을 준 사람은 준호예요. 민지는 볼펜이 없었어요.','The person who gave the pen was Junho. Minji had no pen.','Үзэг өгсөн хүн нь Жүнхо. Минжид үзэг байгаагүй.')},
 'greetings-story-hello':{a:n('감사합니다.','thanks'),b:n('다녀왔습니다.','backPolite')},
 'greetings-story-hello-transfer':{b:n('잘 먹겠습니다.','eat'),c:n('다녀왔습니다.','backPolite')},
 // 카페 팩(11-23 「카페 팩 이어서」). 내 말로 주문하기의 본문항(cafe-compose-order)은 보기가 주문 판정이라 줄을 달지 않는다.
 'cafe-expressions-order':{a:note('차가운 차 두 잔','주문은 따뜻한 차 한 잔이에요. 이것은 차가운 차 두 잔이에요.','The order is one cup of warm tea. This is two cups of cold tea.','Захиалга нь нэг аяга халуун цай. Энэ бол хоёр аяга хүйтэн цай.'),c:note('따뜻한 물 세 잔','주문은 따뜻한 차 한 잔이에요. 이것은 따뜻한 물 세 잔이에요.','The order is one cup of warm tea. This is three cups of warm water.','Захиалга нь нэг аяга халуун цай. Энэ бол гурван аяга бүлээн ус.')},
 'cafe-expressions-order-transfer':{b:note('따뜻한 주스 두 잔','주문은 차가운 주스 두 잔이에요. 이것은 따뜻한 주스예요.','The order is two cups of cold juice. This is warm juice.','Захиалга нь хоёр аяга хүйтэн шүүс. Энэ бол бүлээн шүүс.'),c:note('차가운 차 한 잔','주문은 차가운 주스 두 잔이에요. 이것은 차가운 차 한 잔이에요.','The order is two cups of cold juice. This is one cup of cold tea.','Захиалга нь хоёр аяга хүйтэн шүүс. Энэ бол нэг аяга хүйтэн цай.')},
 'cafe-expressions-here':{a:note('밖으로 가져갈게요.','음료를 가지고 밖으로 나가겠다는 말이에요.','This means you will take your drink outside.','Уух зүйлээ авч гарна гэсэн үг.'),b:note('음료를 주문하지 않을게요.','음료를 사지 않겠다는 말이에요.','This means you will not buy a drink.','Юу ч захиалахгүй гэсэн үг.')},
 'cafe-expressions-here-transfer':{a:note('집으로 가져갈게요.','음료를 가지고 집에 가겠다는 말이에요.','This means you will take your drink home.','Уух зүйлээ гэртээ авч явна гэсэн үг.'),c:note('컵을 돌려드릴게요.','다 마신 컵을 직원에게 줄 때 하는 말이에요.','You say this when you give your empty cup back to the staff.','Хоосон аягаа ажилтанд буцааж өгөхдөө хэлдэг үг.')},
 'cafe-expressions-takeout':{b:note('여기서 마실게요.','카페 안에서 마실 때 하는 말이에요.','You say this when you will drink inside the café.','Кафе дотор уух бол ингэж хэлнэ.'),c:note('따뜻하게 마실게요.','음료를 따뜻하게 마시겠다는 말이에요. 가지고 나갈지 묻는 말의 답이 아니에요.','This means you will drink it warm. It does not say whether you will take it out.','Халуунаар нь ууна гэсэн үг. Авч явах уу гэсэн асуултын хариулт биш.')},
 'cafe-expressions-takeout-transfer':{a:note('여기서 마실게요.','카페 안에서 마실 때 하는 말이에요.','You say this when you will drink inside the café.','Кафе дотор уух бол ингэж хэлнэ.'),b:note('잘 마셨습니다.','다 마신 뒤에 고마움을 전하는 말이에요.','You say this to thank someone after you finish your drink.','Ууж дууссаны дараа талархлаа илэрхийлэх үг.')},
 'cafe-story-order':{b:note('차가운 물 네 잔','지호는 물이 아니라 따뜻한 차를 주문했어요.','Jiho ordered warm tea, not water.','Жихо ус биш, халуун цай захиалсан.'),c:note('따뜻한 차 한 잔','네 사람이 한 잔씩 마셔서 네 잔이에요.','Four people each have a cup, so it is four cups.','Дөрвөн хүн тус бүр нэг аяга уух тул дөрвөн аяга захиалсан.')},
 'cafe-story-order-transfer':{a:note('차가운 우유 두 잔','주문표에는 따뜻한 우유가 있어요. 이것은 차가운 우유예요.','The order slip says warm milk. This is cold milk.','Захиалгын хуудсанд бүлээн сүү гэж бичсэн байна. Энэ бол хүйтэн сүү.'),b:note('따뜻한 차 두 잔','주문표에는 우유가 있어요. 이것은 차예요.','The order slip says milk. This is tea.','Захиалгын хуудсанд сүү гэж бичсэн байна. Энэ бол цай.')},
 'cafe-story-here':{a:note('카페 앞 벤치','처음에는 카페 안이었어요. 벤치에는 나중에 갔어요.','At first you were inside the café. You went to the bench later.','Эхлээд бид кафе дотор байсан. Дараа нь вандан сандал руу явсан.'),c:note('학교 교실','이야기에서 우리는 교실에 가지 않아요. 지호는 이 말을 카페에서 했어요.','We don’t go to a classroom in the story. Jiho said this in the café.','Бид анги руу яваагүй. Жихо энэ үгийг кафе дотор хэлсэн.')},
 'cafe-story-here-transfer':{b:note('강가 벤치','‘카페 안’이라고 했어요. 벤치는 카페 밖이에요.','It says ‘카페 안’ (inside the café). A bench is outside.','«카페 안» буюу кафе дотор гэж хэлсэн. Вандан сандал кафены гадна байдаг.'),c:note('집의 창가','카페 창가예요. 집이 아니에요.','It is a window seat in the café, not at home.','Энэ бол гэрийн биш, кафе доторх цонхны дэргэдэх суудал.')},
 'cafe-story-takeout':{a:note('여기서 마실게요.','지호가 처음에 한 말이에요. 카페 안에서 마실 때 하는 말이에요.','Jiho said this first. You say it when you will drink inside the café.','Жихо үүнийг эхэлж хэлсэн. Кафе дотор уух бол ингэж хэлнэ.'),b:note('따뜻한 차 네 잔 주세요.','지호가 처음에 주문할 때 한 말이에요.','Jiho said this first, when he ordered.','Жихогийн анх захиалахдаа хэлсэн үг.')},
 'cafe-story-takeout-transfer':{b:note('매장에서 마실게요.','‘매장’은 카페 안이에요. 카페 안에서 마실 때 하는 말이에요.','‘매장’ means inside the café. You say this when you will drink there.','«매장» гэдэг нь кафе дотор гэсэн үг. Кафе дотор уух бол ингэж хэлнэ.'),c:note('컵을 비워 주세요.','컵 안에 있는 것을 버려 달라는 말이에요.','This asks someone to empty the cup.','Аяган доторх зүйлийг асгаж өгөөч гэж гуйх үг.')},
 'cafe-apply-order':{a:note('차가운 주스 한 잔 주세요.','한 사람이 마실 때의 주문이에요. 둘이 한 잔씩이면 두 잔이에요.','This is an order for one person. Two people having one cup each need two cups.','Нэг хүний захиалга. Хоёр хүн тус бүр нэг аяга уух бол хоёр аяга захиална.'),c:note('따뜻한 주스 두 잔 주세요.','따뜻한 주스예요. 우리는 차가운 주스를 마시고 싶어요.','This is warm juice. We want cold juice.','Энэ бол бүлээн шүүс. Бид хүйтэн шүүс уумаар байна.')},
 'cafe-apply-order-transfer':{b:note('차가운 우유 한 잔 주세요.','차가운 우유예요. 따뜻한 우유를 주문해요.','This is cold milk. You are ordering warm milk.','Энэ бол хүйтэн сүү. Бүлээн сүү захиалах хэрэгтэй.'),c:note('따뜻한 차 두 잔 주세요.','음료도 잔 수도 달라요. 우유 한 잔이에요.','Both the drink and the number of cups are different. It is one cup of milk.','Уух зүйл ч, аяганы тоо ч өөр. Нэг аяга сүү хэрэгтэй.')},
 'cafe-apply-here':{a:note('포장해 주세요.','음료를 가지고 밖으로 나갈 때 하는 말이에요.','You say this when you take your drink out of the café.','Уух зүйлээ авч явахдаа хэлдэг үг.'),b:note('아직 안 마셨어요.','음료를 아직 마시지 않았다는 말이에요. 어디에서 마실지 묻는 말의 답이 아니에요.','This means you haven’t drunk it yet. It does not say where you will drink.','Хараахан уугаагүй гэсэн үг. Хаана уух вэ гэсэн асуултын хариулт биш.')},
 'cafe-apply-here-transfer':{a:note('아니요, 포장해 주세요.','카페에서 마시지 않고 가지고 나갈 때 하는 대답이에요.','This is the answer when you will take your drink out instead of drinking in the café.','Кафед уухгүй, авч явах бол ингэж хариулна.'),c:note('네, 집에서 마실게요.','‘매장’은 카페 안이에요. 집에서 마시는 것과 맞지 않아요.','‘매장’ means inside the café, so drinking at home does not fit.','«매장» гэдэг нь кафе дотор гэсэн үг. Тиймээс гэртээ уух гэсэн хариулт таарахгүй.')},
 'cafe-apply-takeout':{b:note('매장에서 마실게요.','‘매장’은 카페 안이에요. 카페 안에서 마실 때 하는 말이에요.','‘매장’ means inside the café. You say this when you will drink there.','«매장» гэдэг нь кафе дотор гэсэн үг. Кафе дотор уух бол ингэж хэлнэ.'),c:note('주문을 취소할게요.','주문을 그만둘 때 하는 말이에요.','You say this when you want to stop your order.','Захиалгаа цуцлахдаа хэлдэг үг.')},
 'cafe-apply-takeout-transfer':{a:note('여기서 마실게요.','카페 안에서 마실 때 하는 말이에요.','You say this when you will drink inside the café.','Кафе дотор уух бол ингэж хэлнэ.'),b:note('컵은 필요 없어요.','컵을 받지 않겠다는 말이에요.','This means you don’t need a cup.','Аяга хэрэггүй гэсэн үг.')},
 'cafe-visit-taste-drink':{a:note('따뜻한 주스 한 잔 주세요.','태오는 주스가 아니라 차를 마시고 싶어요.','Taeo wants tea, not juice.','Тэо шүүс биш, цай уухыг хүсэж байна.'),c:note('차가운 주스 한 잔 주세요.','차가운 주스예요. 태오는 따뜻한 차를 마시고 싶어요.','This is cold juice. Taeo wants warm tea.','Энэ бол хүйтэн шүүс. Тэо халуун цай уухыг хүсэж байна.')},
 'cafe-visit-taste-drink-transfer':{a:note('따뜻한 주스 한 잔 주세요.','서하는 차가운 주스를 마시고 싶어요. 이것은 따뜻한 주스예요.','Seoha wants cold juice. This is warm juice.','Сөха хүйтэн шүүс уухыг хүсэж байна. Энэ бол бүлээн шүүс.'),b:note('차가운 차 한 잔 주세요.','서하는 차가 아니라 주스를 마시고 싶어요.','Seoha wants juice, not tea.','Сөха цай биш, шүүс уухыг хүсэж байна.')},
 'cafe-visit-taste-count':{a:note('따뜻한 차 한 잔 주세요.','한 사람이 마실 때의 주문이에요.','This is an order for one person.','Нэг хүний захиалга.'),b:note('따뜻한 차 세 잔 주세요.','세 사람이 마실 때의 주문이에요.','This is an order for three people.','Гурван хүний захиалга.')},
 'cafe-visit-taste-count-transfer':{a:note('차가운 우유 두 잔 주세요.','두 사람이 마실 때의 주문이에요.','This is an order for two people.','Хоёр хүний захиалга.'),c:note('따뜻한 우유 세 잔 주세요.','따뜻한 우유예요. 세 사람은 차가운 우유를 마셔요.','This is warm milk. The three of them are having cold milk.','Энэ бол бүлээн сүү. Тэр гурав хүйтэн сүү ууна.')},
 'cafe-visit-taste-place':{b:note('포장해 주세요.','음료를 가지고 밖으로 나갈 때 하는 말이에요.','You say this when you take your drink out of the café.','Уух зүйлээ авч явахдаа хэлдэг үг.'),c:note('주문을 취소할게요.','주문을 그만둘 때 하는 말이에요.','You say this when you want to stop your order.','Захиалгаа цуцлахдаа хэлдэг үг.')},
 'cafe-visit-taste-place-transfer':{a:note('네, 여기서 마실게요.','카페 안에서 마실 때 하는 대답이에요.','This is the answer when you will drink inside the café.','Кафе дотор уух бол ингэж хариулна.'),c:note('네, 창가에서 마실게요.','카페 창가에서 마실 때 하는 대답이에요.','This is the answer when you will drink at a window seat in the café.','Кафед цонхны дэргэд сууж уух бол ингэж хариулна.')},
 'cafe-visit-soldout-menu':{b:note('차가운 주스 한 잔 주세요.','오늘 주스는 품절이라 주문할 수 없어요.','Juice is sold out today, so you can’t order it.','Өнөөдөр шүүс дууссан тул захиалах боломжгүй.'),c:note('따뜻한 주스 한 잔 주세요.','따뜻한 주스도 주스예요. 오늘 주스는 품절이에요.','Warm juice is still juice. Juice is sold out today.','Бүлээн шүүс ч гэсэн шүүс. Өнөөдөр шүүс дууссан.')},
 'cafe-visit-soldout-menu-transfer':{a:note('따뜻한 우유 한 잔 주세요.','오늘 우유는 품절이라 주문할 수 없어요.','Milk is sold out today, so you can’t order it.','Өнөөдөр сүү дууссан тул захиалах боломжгүй.'),c:note('차가운 우유 한 잔 주세요.','차가운 우유도 우유예요. 오늘 우유는 품절이에요.','Cold milk is still milk. Milk is sold out today.','Хүйтэн сүү ч гэсэн сүү. Өнөөдөр сүү дууссан.')},
 'cafe-visit-soldout-count':{a:note('세 잔 주세요.','세 잔이 필요할 때 하는 말이에요.','You say this when you need three cups.','Гурван аяга хэрэгтэй үед хэлдэг үг.'),b:note('네, 두 잔 주세요.','직원이 말한 두 잔이 맞을 때 하는 대답이에요.','This is the answer when the two cups the staff said are right.','Ажилтан «хоёр аяга» гэж хэлсэн нь зөв бол ингэж хариулна.')},
 'cafe-visit-soldout-count-transfer':{a:note('네, 한 잔 주세요.','직원이 말한 한 잔이 맞을 때 하는 대답이에요.','This is the answer when the one cup the staff said is right.','Ажилтан «нэг аяга» гэж хэлсэн нь зөв бол ингэж хариулна.'),c:note('아니요, 세 잔 주세요.','세 잔이 필요할 때 고쳐 말하는 대답이에요.','This is how you correct the order when you need three cups.','Гурван аяга хэрэгтэй бол ингэж засаж хэлнэ.')},
 'cafe-visit-soldout-takeout':{a:note('여기서 마실게요.','카페 안에서 마실 때 하는 말이에요.','You say this when you will drink inside the café.','Кафе дотор уух бол ингэж хэлнэ.'),c:note('주문을 취소할게요.','주문을 그만둘 때 하는 말이에요.','You say this when you want to stop your order.','Захиалгаа цуцлахдаа хэлдэг үг.')},
 'cafe-visit-soldout-takeout-transfer':{a:note('포장해 주세요.','음료를 가지고 밖으로 나갈 때 하는 말이에요.','You say this when you take your drink out of the café.','Уух зүйлээ авч явахдаа хэлдэг үг.'),b:note('취소해 주세요.','주문을 그만둘 때 하는 말이에요.','You say this when you want to stop your order.','Захиалгаа цуцлахдаа хэлдэг үг.')},
 'cafe-visit-change-drink':{b:note('따뜻한 주스로 준비해 주세요.','주스를 그대로 두는 말이에요. 차로 바꾸는 말이 아니에요.','This keeps the juice. It does not change it to tea.','Шүүсээ хэвээр нь авна гэсэн үг. Цай болгож өөрчлөхгүй.'),c:note('차가운 주스로 바꿔 주세요.','차가운 주스로 바꾸는 말이에요. 차로 바꾸는 말이 아니에요.','This changes it to cold juice, not to tea.','Хүйтэн шүүс болгож өгөөч гэсэн үг. Цай болгож өөрчлөхгүй.')},
 'cafe-visit-change-drink-transfer':{a:note('따뜻한 차로 준비해 주세요.','차를 그대로 두는 말이에요. 주스로 바꾸는 말이 아니에요.','This keeps the tea. It does not change it to juice.','Цайгаа хэвээр нь авна гэсэн үг. Шүүс болгож өөрчлөхгүй.'),b:note('차가운 차로 바꿔 주세요.','차가운 차로 바꾸는 말이에요. 주스로 바꾸는 말이 아니에요.','This changes it to cold tea, not to juice.','Хүйтэн цай болгож өгөөч гэсэн үг. Шүүс болгож өөрчлөхгүй.')},
 'cafe-visit-change-count':{a:note('한 잔 빼 주세요.','잔 수를 하나 줄일 때 하는 말이에요.','You say this to take one cup off the order.','Аяганы тоог нэгээр хасахдаа хэлдэг үг.'),c:note('그대로 두 잔 주세요.','잔 수를 바꾸지 않을 때 하는 말이에요.','You say this when you keep the same number of cups.','Аяганы тоог өөрчлөхгүй үед хэлдэг үг.')},
 'cafe-visit-change-count-transfer':{a:note('한 잔 빼 주세요.','잔 수를 하나 줄일 때 하는 말이에요.','You say this to take one cup off the order.','Аяганы тоог нэгээр хасахдаа хэлдэг үг.'),c:note('그대로 한 잔 주세요.','잔 수를 바꾸지 않을 때 하는 말이에요.','You say this when you keep the same number of cups.','Аяганы тоог өөрчлөхгүй үед хэлдэг үг.')},
 'cafe-visit-change-place':{a:note('그대로 매장에서 마실게요.','처음 정한 대로 카페 안에서 마신다는 말이에요.','This means you will still drink inside the café, as first planned.','Анх төлөвлөсөн ёсоороо кафе дотор ууна гэсэн үг.'),b:note('주문을 취소할게요.','주문을 그만둘 때 하는 말이에요.','You say this when you want to stop your order.','Захиалгаа цуцлахдаа хэлдэг үг.')},
 'cafe-visit-change-place-transfer':{b:note('그대로 포장해 주세요.','처음 정한 대로 가지고 나간다는 말이에요.','This means you will still take it out, as first planned.','Анх төлөвлөсөн ёсоороо авч явна гэсэн үг.'),c:note('주문을 취소할게요.','주문을 그만둘 때 하는 말이에요.','You say this when you want to stop your order.','Захиалгаа цуцлахдаа хэлдэг үг.')},
 'cafe-compose-order-transfer':{a:note('따뜻한 주스 세 잔 주세요.','따뜻한 주스예요. 세 사람은 차가운 주스를 마셔요.','This is warm juice. The three of them are having cold juice.','Энэ бол бүлээн шүүс. Тэр гурав хүйтэн шүүс ууна.'),b:note('차가운 차 두 잔 주세요.','음료도 잔 수도 달라요. 차가운 주스 세 잔이에요.','Both the drink and the number of cups are different. It is three cups of cold juice.','Уух зүйл ч, аяганы тоо ч өөр. Гурван аяга хүйтэн шүүс хэрэгтэй.')},
 'cafe-compose-count':{a:note('아니요, 한 잔 주세요.','한 잔이 필요할 때 고쳐 말하는 대답이에요.','This is how you correct the order when you need one cup.','Нэг аяга хэрэгтэй бол ингэж засаж хэлнэ.'),c:note('아니요, 세 잔 주세요.','세 잔이 필요할 때 고쳐 말하는 대답이에요.','This is how you correct the order when you need three cups.','Гурван аяга хэрэгтэй бол ингэж засаж хэлнэ.')},
 'cafe-compose-count-transfer':{a:note('네, 두 잔 주세요.','직원이 말한 두 잔이 맞을 때 하는 대답이에요.','This is the answer when the two cups the staff said are right.','Ажилтан «хоёр аяга» гэж хэлсэн нь зөв бол ингэж хариулна.'),c:note('아니요, 세 잔 주세요.','세 잔이 필요할 때 고쳐 말하는 대답이에요.','This is how you correct the order when you need three cups.','Гурван аяга хэрэгтэй бол ингэж засаж хэлнэ.')},
 'cafe-compose-place':{b:note('아니요, 포장해 주세요.','카페에서 마시지 않고 가지고 나갈 때 하는 대답이에요.','This is the answer when you will take your drink out instead of drinking in the café.','Кафед уухгүй, авч явах бол ингэж хариулна.'),c:note('주문을 취소할게요.','주문을 그만둘 때 하는 말이에요.','You say this when you want to stop your order.','Захиалгаа цуцлахдаа хэлдэг үг.')},
 'cafe-compose-place-transfer':{a:note('네, 여기서 마실게요.','카페 안에서 마실 때 하는 대답이에요.','This is the answer when you will drink inside the café.','Кафе дотор уух бол ингэж хариулна.'),b:note('네, 창가에서 마실게요.','카페 창가에서 마실 때 하는 대답이에요.','This is the answer when you will drink at a window seat in the café.','Кафед цонхны дэргэд сууж уух бол ингэж хариулна.')},
});

/** 그 문항 보기의 한 줄(화면 언어, 없으면 한국어). 문항이나 보기 글이 바뀌었으면 null. */
export function lifeChoiceNote(question,choiceId,lang='ko'){
 const row=question?.id&&LIFE_CHOICE_NOTES[question.id]?.[choiceId];
 const choice=question?.choices?.find(c=>c.id===choiceId);
 if(!row||!choice||row.text!==choice.text)return null;
 return row[lang]||row.ko;
}
