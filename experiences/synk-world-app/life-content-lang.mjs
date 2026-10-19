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
  {prompt:'학교에서 처음 만난 직원에게 인사해요.',context:'아직 도움을 받거나 헤어지는 상황은 아니에요.',explanation:'처음 만난 직원에게 정중하게 ‘안녕하세요’라고 해요.'},
  {prompt:'Greet a school staff member you’re meeting for the first time.',context:'You haven’t received any help yet, and you’re not saying goodbye.',explanation:'Say ‘안녕하세요’ politely to a staff member you’ve just met.'},
  {prompt:'Сургуульд анх уулзаж буй ажилтантай мэндэлнэ үү.',context:'Та одоохондоо тусламж аваагүй, салах гэж байгаа ч биш.',explanation:'Анх уулзсан ажилтанд эелдгээр «안녕하세요» гэнэ.'}),
 'greetings-expressions-thanks':q(
  {prompt:'도움을 받았어요. 어떤 말을 할까요?',context:'친구가 떨어진 책을 주워 줬어요.',explanation:'도움을 받은 뒤에는 ‘감사합니다’로 고마움을 전해요.'},
  {prompt:'Someone helped you. What do you say?',context:'A friend picked up the book you dropped.',explanation:'After getting help, say ‘감사합니다’ to show your thanks.'},
  {prompt:'Та тусламж авлаа. Юу гэж хэлэх вэ?',context:'Найз тань таны унагаасан номыг түүж өглөө.',explanation:'Тусламж авсны дараа «감사합니다» гэж талархлаа илэрхийлнэ.'}),
 'greetings-expressions-thanks-transfer':q(
  {prompt:'직원이 잃어버린 우산을 찾아 줬어요.',context:'도움을 준 직원에게 고마움을 전하려고 해요.',explanation:'우산을 찾아 준 도움에 ‘감사합니다’라고 말해요.'},
  {prompt:'A staff member found the umbrella you lost.',context:'You want to thank the staff member who helped you.',explanation:'For the help finding your umbrella, say ‘감사합니다’.'},
  {prompt:'Ажилтан таны гээсэн шүхрийг олж өглөө.',context:'Тусалсан ажилтандаа талархлаа илэрхийлэхийг хүсэж байна.',explanation:'Шүхрийг олж өгч тусалсанд «감사합니다» гэж хэлнэ.'}),
 'greetings-expressions-name':q(
  {prompt:'자기 이름을 소개하는 말을 골라요.',context:'내 이름은 몽글이에요.',explanation:'‘저는 몽글이에요’는 내가 몽글이라는 소개예요.'},
  {prompt:'Choose the sentence that introduces your own name.',context:'Your name is Mongle.',explanation:'‘저는 몽글이에요’ introduces you as Mongle.'},
  {prompt:'Өөрийн нэрээ танилцуулах үгийг сонгоно уу.',context:'Таны нэр Монгль.',explanation:'«저는 몽글이에요» гэдэг нь «Би Монгль» гэж өөрийгөө танилцуулж буй үг.'}),
 'greetings-expressions-name-transfer':q(
  {prompt:'자기 이름을 소개하는 말을 골라요.',context:'내 이름은 마린이에요.',explanation:'‘저는 마린이에요’는 자기 이름을 말하는 소개예요.'},
  {prompt:'Choose the sentence that introduces your own name.',context:'Your name is Marin.',explanation:'‘저는 마린이에요’ is how you say your own name.'},
  {prompt:'Өөрийн нэрээ танилцуулах үгийг сонгоно уу.',context:'Таны нэр Марин.',explanation:'«저는 마린이에요» нь өөрийн нэрээ хэлж танилцуулж буй үг.'}),
 'greetings-story-name':q(
  {prompt:'처음에 ‘저는 몽글이에요’라고 소개한 친구는 누구예요?',context:'',explanation:'몽글이 자기 이름을 말하며 인사했어요.'},
  {prompt:'Who first introduced themself with ‘저는 몽글이에요’?',context:'',explanation:'Mongle said hello while giving their own name.'},
  {prompt:'Хамгийн түрүүнд «저는 몽글이에요» гэж танилцуулсан найз хэн бэ?',context:'',explanation:'Монгль өөрийнхөө нэрийг хэлж мэндэлсэн.'}),
 'greetings-story-name-transfer':q(
  {prompt:'‘저는 까몽이에요.’라고 쓴 이름표의 주인은 누구예요?',context:'새 모임의 이름표를 읽고 있어요.',explanation:'‘저는 까몽이에요’에서 소개한 이름은 까몽이에요.'},
  {prompt:'Whose name tag says ‘저는 까몽이에요.’?',context:'You’re reading the name tags at a new meeting.',explanation:'In ‘저는 까몽이에요’, the name being introduced is Kkamong (까몽).'},
  {prompt:'«저는 까몽이에요.» гэж бичсэн нэрийн шошго хэнийх вэ?',context:'Та шинэ уулзалтын нэрийн шошгуудыг уншиж байна.',explanation:'«저는 까몽이에요» гэсэн өгүүлбэрт танилцуулж буй нэр нь Камон (까몽).'}),
 'greetings-story-thanks':q(
  {prompt:'까몽이 ‘감사합니다’라고 한 이유는 무엇이에요?',context:'',explanation:'마린이 뒤에 붙은 이름표를 떼어 준 도움에 고마움을 전했어요.'},
  {prompt:'Why did Kkamong say ‘감사합니다’?',context:'',explanation:'It was to thank Marin for peeling off the name tag stuck on Kkamong’s back.'},
  {prompt:'Камон яагаад «감사합니다» гэж хэлсэн бэ?',context:'',explanation:'Нуруунд нь наалдсан нэрийн шошгыг Марин салгаж өгсөнд талархсан.'}),
 'greetings-story-thanks-transfer':q(
  {prompt:'몽글이 ‘감사합니다’라고 했어요. 어떤 일이 있었을까요?',context:'마린이 몽글에게 떨어진 이름표를 건네줬어요.',explanation:'이름표를 건네준 도움을 받아서 고마움을 전했어요.'},
  {prompt:'Mongle said ‘감사합니다’. What do you think happened?',context:'Marin handed Mongle a name tag that had fallen.',explanation:'Mongle got help when Marin handed over the name tag, so Mongle said thank you.'},
  {prompt:'Монгль «감사합니다» гэж хэллээ. Юу болсон бол?',context:'Марин унасан нэрийн шошгыг Монгль найздаа өгчээ.',explanation:'Нэрийн шошгыг өгч тусалсанд талархлаа илэрхийлсэн.'}),
 'greetings-story-hello':q(
  {prompt:'모임에서 처음 만난 사람에게 먼저 할 말을 골라요.',context:'',explanation:'모임에서 처음 만난 사람에게는 ‘안녕하세요’라고 인사해요.'},
  {prompt:'Choose what to say first to someone you meet for the first time at a gathering.',context:'',explanation:'Greet someone you meet for the first time at a gathering with ‘안녕하세요’.'},
  {prompt:'Уулзалт дээр анх тааралдсан хүндээ хамгийн түрүүнд хэлэх үгийг сонгоно уу.',context:'',explanation:'Уулзалт дээр анх тааралдсан хүнтэй «안녕하세요» гэж мэндэлнэ.'}),
 'greetings-story-hello-transfer':q(
  {prompt:'새 동아리에서 처음 만난 친구에게 정중하게 인사해요.',context:'지금은 식사하거나 외출했다 돌아온 상황이 아니에요.',explanation:'처음 만난 자리의 인사는 ‘안녕하세요’예요.'},
  {prompt:'Politely greet a friend you’re meeting for the first time at a new club.',context:'You’re not about to eat, and you haven’t just come back home.',explanation:'The greeting for a first meeting is ‘안녕하세요’.'},
  {prompt:'Шинэ дугуйланд анх уулзаж буй найзтайгаа эелдгээр мэндэлнэ үү.',context:'Та одоо хоол идэх гэж байгаа ч биш, гадуур яваад ирсэн ч биш.',explanation:'Анх уулзах үеийн мэндчилгээ бол «안녕하세요».'}),
 'greetings-apply-introduction':q(
  {prompt:'이름을 묻는 말에 답해요.',context:'“이름이 뭐예요?” 내 이름은 수진이에요.',explanation:'이름을 물었으므로 ‘저는 수진이에요’라고 소개해요.'},
  {prompt:'Answer when someone asks your name.',context:'“이름이 뭐예요?” Your name is Sujin.',explanation:'They asked your name, so you say ‘저는 수진이에요’.'},
  {prompt:'Нэрийг тань асуухад хариулна уу.',context:'“이름이 뭐예요?” Таны нэр Сүжин.',explanation:'Нэрийг тань асуусан тул «저는 수진이에요» гэж танилцуулна.'}),
 'greetings-apply-introduction-transfer':q(
  {prompt:'이름을 묻는 말에 답해요.',context:'“성함이 어떻게 되세요?” 내 이름은 지훈이에요.',explanation:'‘성함’은 이름을 높여 말한 표현이에요. 자기 이름을 답해요.'},
  {prompt:'Answer when someone asks your name.',context:'“성함이 어떻게 되세요?” Your name is Jihun.',explanation:'‘성함’ is a polite word for “name”. Answer with your own name.'},
  {prompt:'Нэрийг тань асуухад хариулна уу.',context:'“성함이 어떻게 되세요?” Таны нэр Жихүн.',explanation:'«성함» гэдэг нь «нэр» гэдгийг хүндэтгэлтэй хэлсэн үг. Өөрийн нэрээ хариулна.'}),
 'greetings-apply-thanks':q(
  {prompt:'필요한 말을 골라요.',context:'처음 온 학교에서 직원이 교실 위치를 알려 줬어요. 고마움을 전하려고 해요.',explanation:'위치를 알려 준 도움에 ‘감사합니다’라고 해요.'},
  {prompt:'Choose what you need to say.',context:'At a school you’re visiting for the first time, a staff member showed you where the classroom is. You want to say thanks.',explanation:'For the help finding the classroom, say ‘감사합니다’.'},
  {prompt:'Хэрэгтэй үгийг сонгоно уу.',context:'Анх ирсэн сургуульд тань ажилтан ангийн байршлыг зааж өглөө. Та талархлаа илэрхийлэхийг хүсэж байна.',explanation:'Байршлыг зааж өгч тусалсанд «감사합니다» гэнэ.'}),
 'greetings-apply-thanks-transfer':q(
  {prompt:'지금 필요한 말을 골라요.',context:'카페 직원이 두고 온 가방을 찾아 줬어요. 도움에 고마움을 전하려고 해요.',explanation:'가방을 찾아 준 도움에 고마움을 전하는 말은 ‘감사합니다’예요.'},
  {prompt:'Choose what you need to say now.',context:'A café worker found the bag you left behind. You want to thank them for the help.',explanation:'To thank someone for finding your bag, say ‘감사합니다’.'},
  {prompt:'Одоо хэрэгтэй үгийг сонгоно уу.',context:'Кафены ажилтан таны мартаж орхисон цүнхийг олж өглөө. Тусламжид нь талархлаа илэрхийлэхийг хүсэж байна.',explanation:'Цүнхийг олж өгч тусалсанд талархах үг бол «감사합니다».'}),
 'greetings-apply-hello':q(
  {prompt:'교실 문을 열고 처음 만난 선생님에게 말해요.',context:'아직 대화를 시작하기 전이에요.',explanation:'대화를 시작하기 전에 ‘안녕하세요’로 정중하게 인사해요.'},
  {prompt:'You open the classroom door. Speak to the teacher you’re meeting for the first time.',context:'The conversation hasn’t started yet.',explanation:'Before you start talking, greet politely with ‘안녕하세요’.'},
  {prompt:'Ангийн хаалгыг нээгээд анх уулзаж буй багшдаа хандаж хэлнэ үү.',context:'Яриа хараахан эхлээгүй байна.',explanation:'Яриа эхлэхээс өмнө «안녕하세요» гэж эелдгээр мэндэлнэ.'}),
 'greetings-apply-hello-transfer':q(
  {prompt:'처음 방문한 가게의 직원에게 말을 시작해요.',context:'아직 상품을 고르거나 도움을 받기 전이에요.',explanation:'처음 대화를 시작할 때 정중한 인사는 ‘안녕하세요’예요.'},
  {prompt:'Start talking to a worker at a shop you’re visiting for the first time.',context:'You haven’t picked anything or gotten help yet.',explanation:'When you first start a conversation, the polite greeting is ‘안녕하세요’.'},
  {prompt:'Анх очсон дэлгүүрийн ажилтантай яриа эхлүүлнэ үү.',context:'Та одоохондоо бараа сонгоогүй, тусламж ч аваагүй байна.',explanation:'Анх яриа эхлэхэд хэрэглэх эелдэг мэндчилгээ бол «안녕하세요».'}),
});

// 표현 익히기 카드의 설명(표현 자체는 한국어 그대로).
export const LIFE_EXPRESSION_TEXT=Object.freeze({
 'greet-hello':q('처음 만나거나 만난 사람에게 정중하게 인사해요.','A polite greeting for anyone you meet, even for the first time.','Хэнтэй уулзсан ч, бүр анх удаа ч гэсэн эелдгээр мэндлэх үг.'),
 'greet-thanks':q('도움을 받았을 때 정중하게 고마움을 전해요.','Politely says thank you when someone helps you.','Тусламж авахдаа эелдгээр талархлаа илэрхийлнэ.'),
 'greet-name':q('자기 이름을 소개해요. 이름 끝에 받침이 있으면 ‘이에요’를 써요.','Introduces your own name. If the name ends in a final consonant (받침), use ‘이에요’.','Өөрийн нэрийг танилцуулна. Нэр нь гийгүүлэгчээр (받침) төгссөн бол «이에요»-г хэрэглэнэ.'),
});

// 「뜻 보기」: 답한 뒤에만 보이는 보기의 뜻. 키는 보기 글자 그대로다.
export const LIFE_CHOICE_MEANINGS=Object.freeze({
 '안녕하세요.':{en:'Hello. (a polite greeting)',mn:'Сайн байна уу? (эелдэг мэндчилгээ)'},
 '감사합니다.':{en:'Thank you.',mn:'Баярлалаа.'},
 '다녀왔어요.':{en:'I’m back. (said when you get home)',mn:'Ирлээ. (гэртээ ирэхдээ хэлдэг)'},
 '다녀왔습니다.':{en:'I’m back. (said politely when you get home)',mn:'Ирлээ. (гэртээ ирэхдээ эелдгээр хэлдэг)'},
 '저는 몽글이에요.':{en:'I’m Mongle.',mn:'Би Монгль.'},
 '저는 마린이에요.':{en:'I’m Marin.',mn:'Би Марин.'},
 '저는 수진이에요.':{en:'I’m Sujin.',mn:'Би Сүжин.'},
 '저는 지훈이에요.':{en:'I’m Jihun.',mn:'Би Жихүн.'},
 '처음 뵙겠습니다.':{en:'Nice to meet you. (very polite, at a first meeting)',mn:'Танилцсандаа таатай байна. (анх уулзахдаа хэлдэг, маш эелдэг)'},
 '저는 학교에 가요.':{en:'I go to school.',mn:'Би сургууль руу явна.'},
 '몽글은 어디에 있어요?':{en:'Where is Mongle?',mn:'Монгль хаана байна?'},
 '마린은 어디에 있어요?':{en:'Where is Marin?',mn:'Марин хаана байна?'},
 '마린은 학교에 가요.':{en:'Marin goes to school.',mn:'Марин сургууль руу явна.'},
 '까몽':{en:'Kkamong (a name)',mn:'Камон (нэр)'},
 '몽글':{en:'Mongle (a name)',mn:'Монгль (нэр)'},
 '마린':{en:'Marin (a name)',mn:'Марин (нэр)'},
 '마린이 이름표를 찾아 줬어요.':{en:'Marin found the name tag and gave it back.',mn:'Марин нэрийн шошгыг олж өгсөн.'},
 '몽글이 먼저 집에 갔어요.':{en:'Mongle went home first.',mn:'Монгль түрүүлээд гэртээ харьсан.'},
 '까몽이 자기 이름을 잊었어요.':{en:'Kkamong forgot their own name.',mn:'Камон өөрийнхөө нэрийг мартсан.'},
 '마린이 자기 이름을 소개했어요.':{en:'Marin introduced themself.',mn:'Марин өөрийгөө танилцуулсан.'},
 '마린이 모임 시간을 물었어요.':{en:'Marin asked what time the meeting is.',mn:'Марин уулзалтын цагийг асуусан.'},
 '잘 먹겠습니다.':{en:'Thank you for the food. (said before eating)',mn:'Хоол идэхийн өмнө хэлдэг талархлын үг.'},
 '학교에 있어요.':{en:'(I’m) at school.',mn:'(Би) сургууль дээр байна.'},
 '저는 학생이에요.':{en:'I’m a student.',mn:'Би сурагч.'},
 '지훈은 집에 있어요.':{en:'Jihun is at home.',mn:'Жихүн гэртээ байна.'},
 '저는 식사했어요.':{en:'I’ve eaten.',mn:'Би хоолоо идсэн.'},
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
