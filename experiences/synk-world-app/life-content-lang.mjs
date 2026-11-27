// 첫 레슨들(인사 팩)의 화면 언어 글 · 1판(2026-10-19 「WORLD 화면 언어」), 카페 팩(2026-11-24), 편의점 팩(2026-11-25), 길 팩 · 버스 팩(2026-11-26), 약속 팩(2026-11-27).
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
 // 카페 팩(11-24 「만들어 둬」) — 시작
 'cafe-expressions-order':q(
  {prompt:'주문에 맞는 음료를 골라요.',context:'“따뜻한 차 한 잔 주세요.”',explanation:'‘따뜻한 차’가 종류와 온도이고 ‘한 잔’이 수량이에요.'},
  {prompt:'Choose the drink that matches the order.',context:'“따뜻한 차 한 잔 주세요.”',explanation:'‘따뜻한 차’ tells you the kind and temperature (hot tea), and ‘한 잔’ tells you how many (one cup).'},
  {prompt:'Захиалгад тохирох уух зүйлийг сонгоно уу.',context:'«따뜻한 차 한 잔 주세요.»',explanation:'«따뜻한 차» нь ямар уух зүйл болохыг (халуун цай), «한 잔» нь хэдэн аяга болохыг (нэг аяга) заана.'}),
 'cafe-expressions-order-transfer':q(
  {prompt:'주문에 맞는 음료를 골라요.',context:'“차가운 주스 두 잔 주세요.”',explanation:'주스·차가운 온도·두 잔을 모두 확인해요.'},
  {prompt:'Choose the drink that matches the order.',context:'“차가운 주스 두 잔 주세요.”',explanation:'Check all three: juice, cold, and two cups.'},
  {prompt:'Захиалгад тохирох уух зүйлийг сонгоно уу.',context:'«차가운 주스 두 잔 주세요.»',explanation:'Хүйтэн шүүс мөн эсэх, хоёр аяга мөн эсэхийг шалгана.'}),
 'cafe-expressions-here':q(
  {prompt:'‘여기서 마실게요’는 무슨 뜻이에요?',context:'카페 직원이 마실 장소를 물었어요.',explanation:'카페에서 말한 ‘여기서’는 그 카페 안을 가리켜요.'},
  {prompt:'What does ‘여기서 마실게요’ mean?',context:'The café staff asked where you will drink.',explanation:'Said in a café, ‘여기서’ (here) means inside that café.'},
  {prompt:'«여기서 마실게요» гэдэг нь ямар утгатай вэ?',context:'Кафены ажилтан хаана уухыг тань асуулаа.',explanation:'Кафе дотор хэлсэн «여기서» (энд) гэдэг нь тухайн кафе дотор гэсэн үг.'}),
 'cafe-expressions-here-transfer':q(
  {prompt:'‘매장에서 마실게요’는 무슨 뜻이에요?',context:'직원이 포장할지 물었어요.',explanation:'‘매장에서’는 가게 안에서 이용하겠다는 뜻이에요.'},
  {prompt:'What does ‘매장에서 마실게요’ mean?',context:'The staff asked if you want it to go.',explanation:'‘매장에서’ means you’ll have it inside the shop.'},
  {prompt:'«매장에서 마실게요» гэдэг нь ямар утгатай вэ?',context:'Ажилтан авч явах эсэхийг тань асуулаа.',explanation:'«매장에서» гэдэг нь кафед ууна гэсэн үг.'}),
 'cafe-expressions-takeout':q(
  {prompt:'음료를 밖으로 가져가고 싶어요. 어떤 말을 할까요?',context:'',explanation:'음료를 가져갈 때는 ‘포장해 주세요’라고 요청해요.'},
  {prompt:'You want to take your drink outside. What do you say?',context:'',explanation:'When you take a drink with you, ask with ‘포장해 주세요’.'},
  {prompt:'Уух зүйлээ авч явмаар байна. Юу гэж хэлэх вэ?',context:'',explanation:'Уух зүйлээ авч явахдаа «포장해 주세요» гэж хэлнэ.'}),
 'cafe-expressions-takeout-transfer':q(
  {prompt:'주스를 집에 가져가려고 해요. 어떤 말을 할까요?',context:'',explanation:'집에 가져가려면 포장을 요청해요.'},
  {prompt:'You’re going to take juice home. What do you say?',context:'',explanation:'To take it home, ask for it to go.'},
  {prompt:'Шүүсээ гэртээ авч харих гэж байна. Юу гэж хэлэх вэ?',context:'',explanation:'Гэртээ авч харих бол «авч явна» гэж хэлнэ.'}),
 'cafe-story-order':q(
  {prompt:'지호가 주문한 것은 무엇이에요?',context:'',explanation:'지호는 ‘따뜻한 차 네 잔 주세요.’라고 주문했어요. 네 사람이 한 잔씩 마셔요.'},
  {prompt:'What did Jiho order?',context:'',explanation:'Jiho ordered with ‘따뜻한 차 네 잔 주세요.’ There are four of you, one cup each.'},
  {prompt:'Жихо юу захиалсан бэ?',context:'',explanation:'Жихо «따뜻한 차 네 잔 주세요.» гэж захиалсан. Дөрвүүлээ нэг нэг аяга ууна.'}),
 'cafe-story-order-transfer':q(
  {prompt:'주문표에 맞는 음료를 골라요.',context:'새 주문표: “따뜻한 우유 두 잔 주세요.”',explanation:'우유·따뜻한 온도·두 잔을 모두 읽어야 해요.'},
  {prompt:'Choose the drink that matches the order slip.',context:'New order slip: “따뜻한 우유 두 잔 주세요.”',explanation:'You need to read all three: milk, warm, and two cups.'},
  {prompt:'Захиалгын хуудсанд тохирох уух зүйлийг сонгоно уу.',context:'Шинэ захиалгын хуудас: «따뜻한 우유 두 잔 주세요.»',explanation:'Сүү, бүлээн, хоёр аяга гэсэн гурвыг бүгдийг нь унших хэрэгтэй.'}),
 'cafe-story-here':q(
  {prompt:'지호가 말한 ‘여기서 마실게요.’의 ‘여기’는 어디예요?',context:'',explanation:'지호는 카페 안에서 이 말을 했어요. 그래서 ‘여기’는 카페 안이에요.'},
  {prompt:'Jiho said ‘여기서 마실게요.’ Where is ‘여기’?',context:'',explanation:'Jiho said this inside the café, so ‘여기’ means inside the café.'},
  {prompt:'Жихогийн хэлсэн «여기서 마실게요.» гэсэн үгэн дэх «여기» нь хаана гэсэн үг вэ?',context:'',explanation:'Жихо энэ үгийг кафе дотор хэлсэн. Тиймээс «여기» нь кафе дотор гэсэн үг.'}),
 'cafe-story-here-transfer':q(
  {prompt:'주문표를 읽고 마실 장소를 골라요.',context:'“카페 안에서 마실게요. 창가에 앉을게요.”',explanation:'‘카페 안’과 ‘창가’를 함께 확인해요.'},
  {prompt:'Read the order slip and choose where they’ll drink.',context:'“카페 안에서 마실게요. 창가에 앉을게요.”',explanation:'Check both ‘카페 안’ (inside the café) and ‘창가’ (by the window).'},
  {prompt:'Захиалгын хуудсыг уншаад хаана уухыг сонгоно уу.',context:'«카페 안에서 마실게요. 창가에 앉을게요.»',explanation:'«카페 안» (кафе дотор), «창가» (цонхны дэргэд) гэсэн хоёр үгийг хоёуланг нь анхаараарай.'}),
 'cafe-story-takeout':q(
  {prompt:'지호가 직원에게 다시 한 말은 무엇이에요?',context:'',explanation:'태오가 ‘우리 밖에서 마셔요!’라고 해서 지호가 직원에게 다시 ‘포장해 주세요.’라고 했어요. 나머지 두 말은 처음에 주문할 때 한 말이에요.'},
  {prompt:'What did Jiho say to the staff the second time?',context:'',explanation:'Taeo said ‘우리 밖에서 마셔요!’ So Jiho told the staff ‘포장해 주세요.’ The other two are what Jiho said when he first ordered.'},
  {prompt:'Жихо дараа нь ажилтанд юу гэж хэлсэн бэ?',context:'',explanation:'Тэо «우리 밖에서 마셔요!» гэж хэлсэн тул Жихо дараа нь ажилтанд «포장해 주세요.» гэж хэлсэн. Нөгөө хоёр үгийг Жихо анх захиалахдаа хэлсэн.'}),
 'cafe-story-takeout-transfer':q(
  {prompt:'새 장면에서 어떤 말을 할까요?',context:'비가 그쳤어요. 음료를 가지고 공원으로 가려고 해요.',explanation:'음료를 밖의 공원으로 가져가려면 포장을 요청해요.'},
  {prompt:'What do you say in this new scene?',context:'The rain has stopped. You want to take your drink to the park.',explanation:'To take your drink out to the park, ask for it to go.'},
  {prompt:'Энэ тохиолдолд юу гэж хэлэх вэ?',context:'Бороо зогслоо. Уух зүйлээ аваад цэцэрлэгт хүрээлэн рүү явах гэж байна.',explanation:'Уух зүйлээ цэцэрлэгт хүрээлэн рүү авч явах бол «авч явна» гэж хэлнэ.'}),
 'cafe-apply-order':q(
  {prompt:'원하는 주문을 골라요.',context:'친구와 둘이 마실 차가운 주스를 한 잔씩 주문해요.',explanation:'둘이 한 잔씩 마시므로 두 잔이고, 원하는 온도는 차가운 온도예요.'},
  {prompt:'Choose the order you want.',context:'You order cold juice for you and a friend, one cup each.',explanation:'Two people, one cup each, makes two cups, and you want it cold.'},
  {prompt:'Захиалахдаа хэлэх зөв өгүүлбэрийг сонгоно уу.',context:'Та найздаа болон өөртөө нэг нэг аяга хүйтэн шүүс захиална.',explanation:'Хоёулаа нэг нэг аяга уух тул хоёр аяга хүйтэн шүүс захиална.'}),
 'cafe-apply-order-transfer':q(
  {prompt:'원하는 주문을 골라요.',context:'혼자 마실 따뜻한 우유 한 잔을 주문해요.',explanation:'우유·따뜻한 온도·한 잔에 맞는 주문을 선택해요.'},
  {prompt:'Choose the order you want.',context:'You order one warm milk just for yourself.',explanation:'Pick the order that matches milk, warm, and one cup.'},
  {prompt:'Захиалахдаа хэлэх зөв өгүүлбэрийг сонгоно уу.',context:'Өөртөө нэг аяга бүлээн сүү захиална.',explanation:'Нэг аяга бүлээн сүү захиалахдаа хэлэх өгүүлбэрийг сонгоорой.'}),
 'cafe-apply-here':q(
  {prompt:'직원에게 어떻게 답할까요?',context:'“가져가실 건가요?” 카페 안의 테이블에서 마시려고 해요.',explanation:'테이블에서 마시므로 카페 안에서 마신다고 답해요.'},
  {prompt:'How do you answer the staff?',context:'“가져가실 건가요?” You want to drink at a table inside the café.',explanation:'You’re drinking at a table, so answer that you’ll drink inside the café.'},
  {prompt:'Ажилтанд хэрхэн хариулах вэ?',context:'«가져가실 건가요?» Та кафены ширээнд сууж уух гэж байна.',explanation:'Ширээнд суугаад уух тул энд ууна гэж хариулна.'}),
 'cafe-apply-here-transfer':q(
  {prompt:'직원에게 어떻게 답할까요?',context:'“매장에서 드시나요?” 카페 안에서 마시려고 해요.',explanation:'‘매장에서’라는 질문에 카페 안에서 마신다고 답해요.'},
  {prompt:'How do you answer the staff?',context:'“매장에서 드시나요?” You want to drink inside the café.',explanation:'To the ‘매장에서’ question, answer that you’ll drink inside the café.'},
  {prompt:'Ажилтанд хэрхэн хариулах вэ?',context:'«매장에서 드시나요?» Та кафед сууж уух гэж байна.',explanation:'«매장에서» гэж асуухад энд ууна гэж хариулна.'}),
 'cafe-apply-takeout':q(
  {prompt:'상황에 맞는 부탁을 골라요.',context:'주문한 차를 가지고 학교에 가려고 해요.',explanation:'차를 다른 장소로 가져가므로 포장을 요청해요.'},
  {prompt:'Choose the request that fits the situation.',context:'You want to take the tea you ordered to school.',explanation:'You’re taking the tea somewhere else, so ask for it to go.'},
  {prompt:'Энэ тохиолдолд хэлэх зөв өгүүлбэрийг сонгоно уу.',context:'Захиалсан цайгаа аваад сургууль руу явах гэж байна.',explanation:'Цайгаа өөр газар авч явах тул «авч явна» гэж хэлнэ.'}),
 'cafe-apply-takeout-transfer':q(
  {prompt:'상황에 맞는 부탁을 골라요.',context:'친구 집에서 함께 마실 주스를 카페에서 샀어요.',explanation:'친구 집으로 가져갈 주스이므로 포장이 필요해요.'},
  {prompt:'Choose the request that fits the situation.',context:'You bought juice at the café to drink together at a friend’s house.',explanation:'The juice is going to your friend’s house, so ask for it to go.'},
  {prompt:'Энэ тохиолдолд хэлэх зөв өгүүлбэрийг сонгоно уу.',context:'Найзынхаа гэрт хамт уух шүүсийг кафегаас худалдаж авч байна.',explanation:'Шүүсээ найзынхаа гэрт авч очих тул «авч явна» гэж хэлнэ.'}),
 'cafe-visit-taste-drink':q(
  {prompt:'태오가 원하는 음료를 주문해요.',context:'태오: “따뜻한 차를 마시고 싶어요.”',explanation:'태오가 원하는 종류는 차이고 온도는 따뜻한 온도예요. 주스나 차가운 음료와 구분해요.'},
  {prompt:'Order the drink Taeo wants.',context:'Taeo: “따뜻한 차를 마시고 싶어요.”',explanation:'Taeo wants tea, and he wants it hot. Don’t mix it up with juice or a cold drink.'},
  {prompt:'Тэогийн хүссэн уух зүйлийг захиална уу.',context:'Тэо: «따뜻한 차를 마시고 싶어요.»',explanation:'Тэо халуун цай уухыг хүсэж байна. Шүүс эсвэл хүйтэн уух зүйлтэй андуурч болохгүй.'}),
 'cafe-visit-taste-drink-transfer':q(
  {prompt:'서하가 원하는 음료를 주문해요.',context:'서하: “오늘은 차가운 주스를 마시고 싶어요!”',explanation:'서하가 원하는 음료는 ‘차가운 주스’예요. 온도와 음료 종류가 모두 맞는 ‘차가운 주스 한 잔 주세요.’를 골라요.'},
  {prompt:'Order the drink Seoha wants.',context:'Seoha: “오늘은 차가운 주스를 마시고 싶어요!”',explanation:'Seoha wants ‘차가운 주스’ (cold juice). Both the drink and the temperature match in ‘차가운 주스 한 잔 주세요.’'},
  {prompt:'Сөхагийн хүссэн уух зүйлийг захиална уу.',context:'Сөха: «오늘은 차가운 주스를 마시고 싶어요!»',explanation:'Сөха «차가운 주스» (хүйтэн шүүс) уухыг хүсэж байна. Тиймээс «차가운 주스 한 잔 주세요.» гэж захиална. Энэ өгүүлбэрт «шүүс», «хүйтэн» гэсэн хоёр утга хоёулаа орсон байна.'}),
 'cafe-visit-taste-count':q(
  {prompt:'둘이 한 잔씩 마시려면 어떻게 말할까요?',context:'태오와 내가 따뜻한 차를 한 잔씩 마셔요.',explanation:'태오 한 잔과 내 한 잔을 합하면 두 잔이에요.'},
  {prompt:'How do you order so the two of you get a cup each?',context:'You and Taeo each drink a cup of hot tea.',explanation:'One cup for Taeo plus one for you makes two cups.'},
  {prompt:'Хоёулаа нэг нэг аяга уух бол хэрхэн хэлэх вэ?',context:'Та Тэотой хамт нэг нэг аяга халуун цай ууна.',explanation:'Тэогийн нэг аяга, таны нэг аяга нийлээд хоёр аяга цай болно.'}),
 'cafe-visit-taste-count-transfer':q(
  {prompt:'함께 마실 음료를 주문해요.',context:'서하·지호·태오가 차가운 우유를 한 잔씩 마셔요.',explanation:'세 사람이 한 잔씩 마시면 세 잔이고 원하는 음료는 차가운 우유예요.'},
  {prompt:'Order drinks for everyone.',context:'Seoha, Jiho and Taeo each drink a cup of cold milk.',explanation:'Three people, one cup each, makes three cups, and the drink they want is cold milk.'},
  {prompt:'Хамтдаа уух зүйлээ захиална уу.',context:'Сөха, Жихо, Тэо гурав нэг нэг аяга хүйтэн сүү ууна.',explanation:'Гурван хүн нэг нэг аяга уувал гурван аяга сүү хэрэгтэй. Тэдний хүссэн нь хүйтэн сүү.'}),
 'cafe-visit-taste-place':q(
  {prompt:'직원에게 마실 곳을 알려 주세요.',context:'비가 그칠 때까지 카페 안에서 따뜻한 차를 마시며 쉬어요.',explanation:'카페 안에서 쉬면서 마시므로 매장 이용을 말해요.'},
  {prompt:'Tell the staff where you’ll drink.',context:'You rest in the café with hot tea until the rain stops.',explanation:'You’re resting and drinking inside the café, so say you’ll have it in.'},
  {prompt:'Хаана уухаа ажилтанд хэлнэ үү.',context:'Бороо зогстол кафе дотор халуун цай ууж амарна.',explanation:'Кафед амрангаа уух тул ажилтанд энд ууна гэж хэлнэ.'}),
 'cafe-visit-taste-place-transfer':q(
  {prompt:'직원의 말에 어떻게 대답할까요?',context:'서하가 주스를 가지고 집에 가요. 직원: “매장에서 드시나요?”',explanation:'서하는 주스를 가지고 집에 가요. 그래서 ‘아니요, 포장해 주세요.’라고 대답해요.'},
  {prompt:'How do you answer the staff?',context:'Seoha is taking her juice home. Staff: “매장에서 드시나요?”',explanation:'Seoha is taking the juice home, so the answer is ‘아니요, 포장해 주세요.’'},
  {prompt:'Ажилтны асуултад хэрхэн хариулах вэ?',context:'Сөха шүүсээ аваад гэртээ харина. Ажилтан: «매장에서 드시나요?»',explanation:'Сөха шүүсээ аваад гэртээ харина. Тиймээс «아니요, 포장해 주세요.» гэж хариулна.'}),
 'cafe-visit-soldout-menu':q(
  {prompt:'지금 주문할 수 있는 음료를 골라요.',context:'오늘 주스 품절. 따뜻한 차는 주문할 수 있어요.',explanation:'주스는 품절이라 온도를 바꾸어도 주문할 수 없어요. 가능한 음료는 따뜻한 차예요.'},
  {prompt:'Choose a drink you can order now.',context:'Juice is sold out today. Hot tea is available.',explanation:'Juice is sold out, so you can’t order it even at a different temperature. The drink you can get is hot tea.'},
  {prompt:'Одоо захиалж болох уух зүйлийг сонгоно уу.',context:'Өнөөдөр шүүс дууссан. Халуун цай захиалж болно.',explanation:'Шүүс дууссан тул халууныг нь ч, хүйтнийг нь ч захиалж болохгүй. Захиалж болох нь халуун цай.'}),
 'cafe-visit-soldout-menu-transfer':q(
  {prompt:'새 안내판에서 주문할 수 있는 음료를 골라요.',context:'오늘 우유 품절. 차가운 주스는 주문할 수 있어요.',explanation:'이번에는 우유가 품절이고 주스는 주문할 수 있어요. 새 안내를 읽고 골라요.'},
  {prompt:'Choose a drink you can order from the new sign.',context:'Milk is sold out today. Cold juice is available.',explanation:'This time milk is sold out and juice is available. Read the new sign and choose.'},
  {prompt:'Шинэ зарлалыг уншаад захиалж болох уух зүйлийг сонгоно уу.',context:'Өнөөдөр сүү дууссан. Хүйтэн шүүс захиалж болно.',explanation:'Энэ удаа сүү дууссан боловч шүүс захиалж болно. Шинэ зарлалыг уншаад уух зүйлээ сонгоорой.'}),
 'cafe-visit-soldout-count':q(
  {prompt:'직원이 수량을 다시 물어요. 어떻게 답할까요?',context:'혼자 마실 한 잔을 주문했어요. 직원: “따뜻한 차 두 잔 맞나요?”',explanation:'필요한 것은 한 잔이에요. 직원의 두 잔 확인에 아니요라고 답하고 한 잔을 말해요.'},
  {prompt:'The staff checks the number again. How do you answer?',context:'You ordered one cup just for yourself. Staff: “따뜻한 차 두 잔 맞나요?”',explanation:'You need one cup. When the staff says two, answer ‘아니요’ and say one cup.'},
  {prompt:'Ажилтан хэдэн аяга болохыг дахин асууж байна. Хэрхэн хариулах вэ?',context:'Та өөртөө нэг аяга цай захиалсан. Ажилтан: «따뜻한 차 두 잔 맞나요?»',explanation:'Танд нэг аяга цай хэрэгтэй. Ажилтан хоёр аяга уу гэж лавлахад «아니요» гэж хариулаад нэг аяга гэж хэлнэ.'}),
 'cafe-visit-soldout-count-transfer':q(
  {prompt:'새 주문의 수량을 다시 알려 주세요.',context:'친구와 둘이 한 잔씩 마셔요. 직원: “주스 한 잔 맞나요?”',explanation:'이번 주문은 두 사람이 한 잔씩 마실 두 잔이에요. 한 잔이라는 확인을 고쳐요.'},
  {prompt:'Tell the staff the right number for the new order.',context:'You and a friend each drink a cup. Staff: “주스 한 잔 맞나요?”',explanation:'This order is two cups, one for each of you. Correct the staff’s ‘one cup’.'},
  {prompt:'Энэ удаа хэдэн аяга шүүс авахаа ажилтанд дахин хэлнэ үү.',context:'Та найзтайгаа нэг нэг аяга шүүс ууна. Ажилтан: «주스 한 잔 맞나요?»',explanation:'Энэ удаа хоёулаа нэг нэг аяга уух тул хоёр аяга шүүс хэрэгтэй. Ажилтны «нэг аяга» гэснийг засаж хэлнэ.'}),
 'cafe-visit-soldout-takeout':q(
  {prompt:'공원으로 가져가려면 어떤 말을 할까요?',context:'따뜻한 차를 가지고 공원 벤치로 가려고 해요.',explanation:'카페 밖의 공원에 가져갈 차이므로 포장을 부탁해요.'},
  {prompt:'What do you say to take it to the park?',context:'You want to take your hot tea to a bench in the park.',explanation:'The tea is going to the park outside the café, so ask for it to go.'},
  {prompt:'Цэцэрлэгт хүрээлэн рүү авч явах бол юу гэж хэлэх вэ?',context:'Халуун цайгаа аваад цэцэрлэгт хүрээлэнгийн вандан сандал дээр очиж уух гэж байна.',explanation:'Цайгаа кафены гадна байгаа цэцэрлэгт хүрээлэн рүү авч явах тул «авч явна» гэж хэлнэ.'}),
 'cafe-visit-soldout-takeout-transfer':q(
  {prompt:'새 장면에서 마실 곳을 알려 주세요.',context:'비가 많이 와서 카페 안의 테이블에서 주스를 마시려고 해요.',explanation:'이번에는 밖으로 가져가지 않고 카페 안에서 마시므로 매장 이용을 말해요.'},
  {prompt:'In this new scene, tell the staff where you’ll drink.',context:'It’s raining hard, so you want to drink your juice at a table inside the café.',explanation:'This time you’re not taking it out. You’re drinking inside, so say you’ll have it in.'},
  {prompt:'Энэ тохиолдолд хаана уухаа хэлнэ үү.',context:'Бороо их орж байгаа тул шүүсээ кафе доторх ширээнд суугаад уух гэж байна.',explanation:'Энэ удаа авч явахгүй, кафед уух тул ажилтанд энд ууна гэж хэлнэ.'}),
 'cafe-visit-change-drink':q(
  {prompt:'주스를 따뜻한 차로 바꾸어 달라고 말해요.',context:'아직 만들기 전인 따뜻한 주스 두 잔을 따뜻한 차 두 잔으로 바꾸려고 해요.',explanation:'주스 대신이라는 말로 이전 음료를 짚고 따뜻한 차로 바꿔 달라고 부탁해요.'},
  {prompt:'Ask to change the juice to hot tea.',context:'The two warm juices haven’t been made yet, and you want to change them to two hot teas.',explanation:'Use ‘주스 대신’ (instead of juice) to point to the first drink, then ask to change it to hot tea.'},
  {prompt:'Шүүсийг халуун цайгаар сольж өгөөч гэж хэлнэ үү.',context:'Та хоёр аяга бүлээн шүүс захиалсан. Шүүс хараахан бэлэн болоогүй байгаа тул захиалгаа хоёр аяга халуун цайгаар солихыг хүсэж байна.',explanation:'Эхлээд «주스 대신» (шүүсний оронд) гэж хэлээд, дараа нь халуун цай авахаа хэлнэ.'}),
 'cafe-visit-change-drink-transfer':q(
  {prompt:'이번에는 차를 주스로 바꾸고 싶어요.',context:'아직 만들기 전인 따뜻한 차 한 잔을 차가운 주스 한 잔으로 바꾸려고 해요.',explanation:'새 주문은 따뜻한 차에서 차가운 주스로 변경하는 것이에요. 바꿀 종류와 온도를 확인해요.'},
  {prompt:'This time you want to change tea to juice.',context:'The hot tea hasn’t been made yet, and you want to change it to one cold juice.',explanation:'The new order changes hot tea to cold juice. Check the new drink and its temperature.'},
  {prompt:'Энэ удаа та цайгаа шүүсээр солихыг хүсэж байна.',context:'Та нэг аяга халуун цай захиалсан. Цай хараахан бэлэн болоогүй байгаа тул захиалгаа нэг аяга хүйтэн шүүсээр солихыг хүсэж байна.',explanation:'Шинэ захиалгад халуун цайг хүйтэн шүүсээр солино. Ямар уух зүйл болох, халуун уу, хүйтэн үү гэдгийг нь шалгана.'}),
 'cafe-visit-change-count':q(
  {prompt:'지호의 컵 한 잔을 추가해요.',context:'현재 따뜻한 차 두 잔을 주문했어요. 세 사람이 한 잔씩 마실 세 잔이 필요해요.',explanation:'두 잔에 한 잔 더 추가하면 세 잔이에요. 더는 수량을 늘리는 말이에요.'},
  {prompt:'Add one cup for Jiho.',context:'You’ve ordered two hot teas. Three people, one cup each, need three cups.',explanation:'Two cups plus one more is three. ‘더’ is the word that adds to the number.'},
  {prompt:'Жихо ч бас уух тул нэг аяга цай нэмнэ үү.',context:'Одоогоор хоёр аяга халуун цай захиалсан байна. Гурван хүн нэг нэг аяга уух тул гурван аяга цай хэрэгтэй.',explanation:'Хоёр аяга дээр нэгийг нэмбэл гурван аяга цай болно. «더» гэдэг нь «дахиад» гэсэн утгатай үг.'}),
 'cafe-visit-change-count-transfer':q(
  {prompt:'새 주문에 친구의 컵을 추가해요.',context:'현재 주스 한 잔을 주문했어요. 친구와 둘이 한 잔씩 마시려면 두 잔이 필요해요.',explanation:'한 잔에 한 잔을 더하면 두 잔이에요. 새 시작 수량을 읽고 추가해요.'},
  {prompt:'Add a cup for your friend to the new order.',context:'You’ve ordered one juice. For you and a friend to have one each, you need two.',explanation:'One cup plus one more is two. Read the starting number in the new order, then add.'},
  {prompt:'Найз тань ч бас уух тул шинэ захиалгад нэг аяга шүүс нэмнэ үү.',context:'Одоогоор нэг аяга шүүс захиалсан байна. Найзтайгаа хоёулаа нэг нэг аяга уух бол хоёр аяга хэрэгтэй.',explanation:'Нэг аяга дээр нэгийг нэмбэл хоёр аяга шүүс болно. Эхлээд хэдэн аяга захиалсныг шалгаад, түүн дээр нэгийг нэмнэ.'}),
 'cafe-visit-change-place':q(
  {prompt:'매장 이용을 포장으로 바꾸어요.',context:'처음에는 카페 안에서 마시기로 했지만, 이제 음료를 가지고 공원에 가려고 해요.',explanation:'음료는 유지하고 밖으로 가져가므로 매장 이용에서 포장으로 바꿔 달라고 부탁해요.'},
  {prompt:'Change from having it in to taking it out.',context:'At first you planned to drink inside the café, but now you want to take your drinks to the park.',explanation:'Keep the drinks the same and take them outside. Ask to change from having them in to taking them out.'},
  {prompt:'Захиалгаа авч явахаар өөрчилнө үү.',context:'Эхлээд кафе дотор уухаар шийдсэн ч одоо уух зүйлээ аваад цэцэрлэгт хүрээлэн рүү явах гэж байна.',explanation:'Уух зүйл нь хэвээрээ. Харин гадаа гарч уух учраас «авч явахаар өөрчилж өгөөч» гэж хэлнэ.'}),
 'cafe-visit-change-place-transfer':q(
  {prompt:'이번에는 포장을 매장 이용으로 바꾸어요.',context:'주스를 집에 가져가기로 했지만, 친구를 만나 카페 안에서 함께 마시려고 해요.',explanation:'이번 변경 방향은 포장에서 매장 이용이에요. 새로 마실 장소에 맞게 말해요.'},
  {prompt:'This time, change from taking it out to having it in.',context:'You planned to take your juice home, but you met a friend and want to drink together inside the café.',explanation:'This time the change goes from taking it out to having it in. Say it to match where you’ll drink now.'},
  {prompt:'Энэ удаа захиалгаа кафед уухаар өөрчилнө үү.',context:'Шүүсээ гэртээ авч харихаар шийдсэн ч найзтайгаа таараад кафе дотор хамт уух гэж байна.',explanation:'Энэ удаа авч явахгүй, кафед сууж уухаар шийдсэн. Үүнийгээ ажилтанд хэлнэ.'}),
 'cafe-compose-order':q(
  {prompt:'태오와 마실 따뜻한 차 두 잔을 주문해요.',context:'태오와 내가 따뜻한 차를 한 잔씩 마셔요. 음료·온도·잔 수를 직접 골라 주세요.',explanation:'음료는 차, 온도는 따뜻하게, 수량은 두 잔이에요. 세 정보를 연결하면 따뜻한 차 두 잔 주세요가 돼요.'},
  {prompt:'Order two hot teas for you and Taeo.',context:'You and Taeo each drink a cup of hot tea. Choose the drink, temperature and number of cups yourself.',explanation:'The drink is tea, it’s hot, and it’s two cups. Put the three together and you get ‘따뜻한 차 두 잔 주세요’.'},
  {prompt:'Тэотой хамт уух хоёр аяга халуун цай захиална уу.',context:'Та Тэотой хамт нэг нэг аяга халуун цай ууна. Ямар уух зүйл, халуун хүйтний алийг нь, хэдэн аяга авахаа өөрөө сонгоно уу.',explanation:'Цай, халуун, хоёр аяга гэсэн гурван мэдээллийг холбовол «따뜻한 차 두 잔 주세요» болно.'}),
 'cafe-compose-order-transfer':q(
  {prompt:'상황에 맞는 주문 문장을 골라요.',context:'서하·지호·태오가 차가운 주스를 한 잔씩 마셔요.',explanation:'세 사람이 한 잔씩 마시면 세 잔이에요. 차가운 주스와 세 잔을 모두 담은 문장을 골라요.'},
  {prompt:'Choose the order sentence that fits the situation.',context:'Seoha, Jiho and Taeo each drink a cup of cold juice.',explanation:'Three people, one cup each, makes three cups. Choose the sentence that has both cold juice and three cups.'},
  {prompt:'Энэ нөхцөл байдалд захиалга өгөхөд тохирох өгүүлбэрийг сонгоно уу.',context:'Сөха, Жихо, Тэо гурав нэг нэг аяга хүйтэн шүүс ууна.',explanation:'Гурван хүн нэг нэг аяга уувал гурван аяга шүүс хэрэгтэй. Хүйтэн шүүс, гурван аяга гэсэн хоёр зүйлийг хоёуланг нь багтаасан өгүүлбэрийг сонгоорой.'}),
 'cafe-compose-count':q(
  {prompt:'직원의 수량 확인에 답해요.',context:'따뜻한 차 두 잔을 주문했어요. 직원: “따뜻한 차 두 잔 맞나요?”',explanation:'원하는 수량과 직원이 확인한 수량이 모두 두 잔이에요. 네라고 답하고 두 잔을 확인해요.'},
  {prompt:'Answer the staff checking the number.',context:'You ordered two hot teas. Staff: “따뜻한 차 두 잔 맞나요?”',explanation:'What you want and what the staff checked are both two cups. Answer ‘네’ and confirm two cups.'},
  {prompt:'Ажилтан хэдэн аяга авахыг тань лавлаж байна. Хариулна уу.',context:'Та хоёр аяга халуун цай захиалсан. Ажилтан: «따뜻한 차 두 잔 맞나요?»',explanation:'Таны хүссэн нь ч, ажилтны лавласан нь ч хоёр аяга цай. «네» гэж хариулаад хоёр аяга гэдгийг батална.'}),
 'cafe-compose-count-transfer':q(
  {prompt:'새 주문의 수량을 확인해요.',context:'혼자 마실 차가운 차 한 잔을 주문했어요. 직원: “두 잔 맞나요?”',explanation:'이번에는 한 잔이 필요하므로 두 잔이라는 확인을 한 잔으로 고쳐요.'},
  {prompt:'Check the number for the new order.',context:'You ordered one iced tea just for yourself. Staff: “두 잔 맞나요?”',explanation:'This time you need one cup, so correct the staff’s ‘two cups’ to one.'},
  {prompt:'Шинэ захиалгад хэдэн аяга цай байгааг шалгана уу.',context:'Та өөртөө нэг аяга хүйтэн цай захиалсан. Ажилтан: «두 잔 맞나요?»',explanation:'Энэ удаа нэг аяга хэрэгтэй тул ажилтны «хоёр аяга» гэснийг нэг аяга болгож засна.'}),
 'cafe-compose-place':q(
  {prompt:'함께 마실 자리를 정해요.',context:'태오와 카페 안에서 따뜻한 차를 마시며 쉬려고 해요.',explanation:'카페 안에서 함께 마시려면 여기서 마실게요로 매장 이용을 말해요.'},
  {prompt:'Decide where you’ll drink together.',context:'You want to relax with Taeo over hot tea inside the café.',explanation:'To drink together inside the café, say ‘여기서 마실게요’ to have it in.'},
  {prompt:'Тэотой хамт цайгаа хаана уухаа шийднэ үү.',context:'Тэотой кафе дотор халуун цай ууж амрах гэж байна.',explanation:'Кафед хамт цай уух бол «여기서 마실게요» гэж хэлнэ. Энэ нь энд ууна гэсэн үг.'}),
 'cafe-compose-place-transfer':q(
  {prompt:'직원의 말에 어떻게 대답할까요?',context:'지호는 따뜻한 차를 사서 학교에 가지고 가요. 직원: “매장에서 드시나요?”',explanation:'지호는 차를 학교에 가지고 가요. 그래서 ‘아니요, 포장해 주세요.’라고 대답해요.'},
  {prompt:'How do you answer the staff?',context:'Jiho buys hot tea and takes it to school. Staff: “매장에서 드시나요?”',explanation:'Jiho is taking the tea to school, so the answer is ‘아니요, 포장해 주세요.’'},
  {prompt:'Ажилтны асуултад хэрхэн хариулах вэ?',context:'Жихо халуун цай худалдаж аваад сургууль руугаа явна. Ажилтан: «매장에서 드시나요?»',explanation:'Жихо цайгаа сургууль руу авч явна. Тиймээс «아니요, 포장해 주세요.» гэж хариулна.'}),
 // 카페 팩 — 끝
 // 편의점 팩(11-25 「네, 이어가」) — 시작
 'store-expressions-price':q(
  {prompt:'물건의 가격을 알고 싶어요. 어떤 말을 할까요?',context:'',explanation:'가격을 물을 때는 ‘얼마예요’를 사용해요.'},
  {prompt:'You want to know the price of something. What do you say?',context:'',explanation:'To ask a price, use ‘얼마예요’.'},
  {prompt:'Барааны үнийг мэдмээр байна. Юу гэж хэлэх вэ?',context:'',explanation:'Үнэ асуухдаа «얼마예요» гэж хэлнэ.'}),
 'store-expressions-price-transfer':q(
  {prompt:'이 샌드위치의 값을 물어보려고 해요.',context:'',explanation:'물건의 값은 ‘얼마예요’로 물어요.'},
  {prompt:'You want to ask the price of this sandwich.',context:'',explanation:'Ask the price of something with ‘얼마예요’.'},
  {prompt:'Энэ сэндвичийн үнийг асуух гэж байна.',context:'',explanation:'Барааны үнийг «얼마예요» гэж асууна.'}),
 'store-expressions-bag':q(
  {prompt:'‘봉투 하나 주세요’는 무엇을 부탁하는 말이에요?',context:'산 물건을 밖으로 가져가려고 해요.',explanation:'‘봉투’는 산 물건을 담아 가져가는 데 사용해요.'},
  {prompt:'What are you asking for with ‘봉투 하나 주세요’?',context:'You want to take the things you bought outside.',explanation:'A ‘봉투’ (bag) is for carrying the things you bought.'},
  {prompt:'«봉투 하나 주세요» гэдэг нь юу авъя гэсэн үг вэ?',context:'Худалдаж авсан юмаа авч явах гэж байна.',explanation:'«봉투» (уут) нь худалдаж авсан юмаа хийж авч явахад хэрэглэгддэг.'}),
 'store-expressions-bag-transfer':q(
  {prompt:'직원에게 어떤 말을 할까요?',context:'우유와 빵을 한꺼번에 담아 가져갈 봉투가 필요해요.',explanation:'물건을 담을 봉투가 필요하므로 봉투를 요청해요.'},
  {prompt:'What do you say to the staff?',context:'You need a bag to carry the milk and bread together.',explanation:'You need a bag for your things, so you ask for one.'},
  {prompt:'Ажилтанд юу гэж хэлэх вэ?',context:'Сүү, талхаа хамт хийж авч явах уут хэрэгтэй байна.',explanation:'Юмаа хийх уут хэрэгтэй тул уут өгөөч гэж хэлнэ.'}),
 'store-expressions-card':q(
  {prompt:'‘카드로 계산할게요’는 어떻게 값을 내겠다는 말이에요?',context:'',explanation:'‘카드로’는 카드라는 방법을 이용한다는 뜻이에요.'},
  {prompt:'How does ‘카드로 계산할게요’ say you will pay?',context:'',explanation:'‘카드로’ means you use a card to pay.'},
  {prompt:'«카드로 계산할게요» гэдэг нь юугаар төлнө гэсэн үг вэ?',context:'',explanation:'«카드로» гэдэг нь картаар төлнө гэсэн утгатай.'}),
 'store-expressions-card-transfer':q(
  {prompt:'‘현금으로 계산할게요’는 어떻게 값을 내겠다는 말이에요?',context:'',explanation:'지폐나 동전으로 직접 값을 내는 방법은 현금 결제예요.'},
  {prompt:'How does ‘현금으로 계산할게요’ say you will pay?',context:'',explanation:'Paying with bills or coins is paying in cash.'},
  {prompt:'«현금으로 계산할게요» гэдэг нь юугаар төлнө гэсэн үг вэ?',context:'',explanation:'Цаасан мөнгө эсвэл зоосоор шууд төлөхийг бэлнээр төлөх гэнэ.'}),
 'store-story-price':q(
  {prompt:'이야기에서 물 한 병은 얼마예요?',context:'',explanation:'서하가 ‘이거 얼마예요?’라고 물었어요. 가격표를 보면 물 한 병은 1,000원이에요. 2,000원은 라면의 가격이에요.'},
  {prompt:'In the story, how much is one bottle of water?',context:'',explanation:'Seoha asked ‘이거 얼마예요?’ The price tag shows one bottle of water is 1,000 won. 2,000 won is the price of the ramen.'},
  {prompt:'Энэ түүхэнд нэг шил ус ямар үнэтэй вэ?',context:'',explanation:'Сөха «이거 얼마예요?» гэж асуусан. Үнийн шошгоноос харахад нэг шил ус 1,000 вон. 2,000 вон бол рамёны үнэ.'}),
 'store-story-price-transfer':q(
  {prompt:'새 가격표를 읽어요. 우유 한 개는 얼마예요?',context:'우유 한 개 1,500원 / 빵 한 개 2,000원',explanation:'우유 가격은 1,500원이에요. 다른 물건이나 합계와 구분해요.'},
  {prompt:'Read the new price tag. How much is one carton of milk?',context:'Price tag: “우유 한 개 1,500원 / 빵 한 개 2,000원”',explanation:'‘우유’ (milk) is 1,500 won. Don’t mix it up with ‘빵’ (bread) or the total.'},
  {prompt:'Шинэ үнийн шошгыг уншина уу. Нэг сав сүү ямар үнэтэй вэ?',context:'Үнийн шошго: «우유 한 개 1,500원 / 빵 한 개 2,000원»',explanation:'«우유» (сүү) 1,500 вон. Талхны үнэ болон нийт үнэтэй битгий андуураарай.'}),
 'store-story-bag':q(
  {prompt:'지호가 봉투를 부탁한 이유는 무엇이에요?',context:'',explanation:'지호는 ‘봉투 하나 주세요. 라면하고 물을 담을게요.’라고 했어요. 산 라면과 물을 담으려고 봉투를 부탁했어요. 카드로 계산한 사람은 태오예요.'},
  {prompt:'Why did Jiho ask for a bag?',context:'',explanation:'Jiho said ‘봉투 하나 주세요. 라면하고 물을 담을게요.’ He asked for a bag to carry the ramen and water they bought. Taeo is the one who paid by card.'},
  {prompt:'Жихо яагаад уут авахыг хүссэн бэ?',context:'',explanation:'Жихо «봉투 하나 주세요. 라면하고 물을 담을게요.» гэж хэлсэн. Худалдаж авсан рамён, усаа хийх уут авахыг хүссэн. Картаар төлсөн хүн бол Тэо.'}),
 'store-story-bag-transfer':q(
  {prompt:'봉투를 요청하는 장면을 골라요.',context:'봉투 하나 주세요.',explanation:'봉투는 산 빵과 우유를 담아 가져갈 때 필요해요.'},
  {prompt:'Choose the scene where you’d ask for a bag.',context:'“봉투 하나 주세요.”',explanation:'You need a bag to carry the bread and milk you bought.'},
  {prompt:'Уут хэрэг болох тохиолдлыг сонгоно уу.',context:'«봉투 하나 주세요.»',explanation:'Худалдаж авсан талх, сүүгээ хийж авч явахад уут хэрэгтэй.'}),
 'store-story-card':q(
  {prompt:'태오는 어떤 방법으로 계산했어요?',context:'',explanation:'태오는 ‘카드로 계산할게요.’라고 말하고 카드로 계산했어요.'},
  {prompt:'How did Taeo pay?',context:'',explanation:'Taeo said ‘카드로 계산할게요.’ and paid by card.'},
  {prompt:'Тэо юугаар төлсөн бэ?',context:'',explanation:'Тэо «카드로 계산할게요.» гэж хэлээд картаар төлсөн.'}),
 'store-story-card-transfer':q(
  {prompt:'서하는 어떤 방법으로 계산했어요?',context:'서하는 오늘 카드가 없어요. 서하: “현금으로 계산할게요.” 서하가 돈을 냈어요.',explanation:'서하는 오늘 카드가 없어요. 그래서 ‘현금으로 계산할게요.’라고 말하고 돈을 냈어요. 현금으로 계산했어요.'},
  {prompt:'How did Seoha pay?',context:'Seoha doesn’t have her card today. Seoha: “현금으로 계산할게요.” Seoha handed over money.',explanation:'Seoha doesn’t have her card today, so she said ‘현금으로 계산할게요.’ and handed over money. She paid in cash.'},
  {prompt:'Сөха юугаар төлсөн бэ?',context:'Сөха өнөөдөр картгүй байсан. «현금으로 계산할게요.» гэж хэлээд төлбөрөө төлсөн.',explanation:'Сөха өнөөдөр картгүй байсан. Тиймээс «현금으로 계산할게요.» гэж хэлээд бэлэн мөнгөөр төлсөн.'}),
 'store-apply-price':q(
  {prompt:'가격을 물을 문장을 골라요.',context:'도시락에 가격표가 없어요. 직원에게 값을 물어보려고 해요.',explanation:'가격표가 없을 때 ‘얼마예요’로 값을 물어요.'},
  {prompt:'Choose the sentence that asks the price.',context:'The lunch box has no price tag. You want to ask the staff how much it is.',explanation:'When there’s no price tag, ask the price with ‘얼마예요’.'},
  {prompt:'Үнэ асуух өгүүлбэрийг сонгоно уу.',context:'Савтай хоолны үнийн шошго алга. Ажилтнаас үнийг нь асуух гэж байна.',explanation:'Үнийн шошго байхгүй бол «얼마예요» гэж асууна.'}),
 'store-apply-price-transfer':q(
  {prompt:'가격을 물을 문장을 골라요.',context:'우산의 값을 알고 싶어요.',explanation:'우산의 값은 ‘얼마예요’로 물어요.'},
  {prompt:'Choose the sentence that asks the price.',context:'You want to know the price of an umbrella.',explanation:'Ask the price of the umbrella with ‘얼마예요’.'},
  {prompt:'Үнэ асуух өгүүлбэрийг сонгоно уу.',context:'Шүхрийн үнийг мэдмээр байна.',explanation:'Шүхрийн үнийг «얼마예요» гэж асууна.'}),
 'store-apply-bag':q(
  {prompt:'직원에게 어떻게 답할까요?',context:'“봉투 필요하세요?” 산 물건이 많아서 담을 봉투가 필요해요.',explanation:'봉투가 필요하므로 ‘네’라고 답하고 하나를 부탁해요.'},
  {prompt:'How do you answer the staff?',context:'“봉투 필요하세요?” You bought a lot, so you need a bag to carry it all.',explanation:'You need a bag, so answer ‘네’ and ask for one.'},
  {prompt:'Ажилтанд яаж хариулах вэ?',context:'«봉투 필요하세요?» Олон юм худалдаж авсан тул хийх уут хэрэгтэй байна.',explanation:'Уут хэрэгтэй тул «네» гэж хариулаад нэг уут өгөөч гэж хэлнэ.'}),
 'store-apply-bag-transfer':q(
  {prompt:'직원에게 어떻게 답할까요?',context:'“봉투 드릴까요?” 내 가방에 물건을 담을 거예요. 봉투는 필요 없어요.',explanation:'봉투가 필요 없으므로 정중하게 ‘아니요, 괜찮아요’라고 답해요.'},
  {prompt:'How do you answer the staff?',context:'“봉투 드릴까요?” You’ll put your things in your own bag. You don’t need a store bag.',explanation:'You don’t need a bag, so politely answer ‘아니요, 괜찮아요’.'},
  {prompt:'Ажилтанд яаж хариулах вэ?',context:'«봉투 드릴까요?» Та юмаа өөрийнхөө цүнхэнд хийнэ. Уут хэрэггүй.',explanation:'Уут хэрэггүй тул эелдгээр «아니요, 괜찮아요» гэж хариулна.'}),
 'store-apply-card':q(
  {prompt:'카드로 값을 내려고 해요. 어떤 말을 할까요?',context:'',explanation:'카드를 사용할 때는 ‘카드로 계산할게요’라고 해요.'},
  {prompt:'You want to pay by card. What do you say?',context:'',explanation:'When you use a card, say ‘카드로 계산할게요’.'},
  {prompt:'Картаар төлөх гэж байна. Юу гэж хэлэх вэ?',context:'',explanation:'Картаар төлөхдөө «카드로 계산할게요» гэж хэлнэ.'}),
 'store-apply-card-transfer':q(
  {prompt:'현금으로 값을 내려고 해요. 어떤 말을 할까요?',context:'',explanation:'현금을 사용하므로 ‘현금으로 계산할게요’가 상황에 맞아요.'},
  {prompt:'You want to pay in cash. What do you say?',context:'',explanation:'You’re using cash, so ‘현금으로 계산할게요’ fits.'},
  {prompt:'Бэлнээр төлөх гэж байна. Юу гэж хэлэх вэ?',context:'',explanation:'Бэлэн мөнгөөр төлөх тул «현금으로 계산할게요» гэж хэлнэ.'}),
 // 편의점 팩 — 끝
 // 길 팩(11-26 「네, 이어가」) — 시작
 'directions-expressions-where':q(
  {prompt:'공원의 위치를 알고 싶어요. 어떤 말을 할까요?',context:'',explanation:'장소의 위치는 ‘어디에 있어요’로 물어요.'},
  {prompt:'You want to know where the park is. What do you say?',context:'',explanation:'Ask where a place is with ‘어디에 있어요’.'},
  {prompt:'Цэцэрлэгт хүрээлэн хаана байгааг мэдмээр байна. Юу гэж хэлэх вэ?',context:'',explanation:'Аливаа газар хаана байгааг асуухдаа «어디에 있어요» гэж хэлнэ.'}),
 'directions-expressions-where-transfer':q(
  {prompt:'화장실의 위치를 묻는 말을 골라요.',context:'',explanation:'‘어디에’는 장소의 위치를 묻는 표현이에요.'},
  {prompt:'Choose the sentence that asks where the restroom is.',context:'',explanation:'‘어디에’ is used to ask where a place is.'},
  {prompt:'Ариун цэврийн өрөө хаана байгааг асуух өгүүлбэрийг сонгоно уу.',context:'',explanation:'«어디에» гэдэг нь аливаа газар хаана байгааг асуудаг хэллэг юм.'}),
 'directions-expressions-right':q(
  {prompt:'‘오른쪽으로 가세요’라는 안내에 맞는 방향은 무엇이에요?',context:'길을 따라 걷다가 갈림길에 도착했어요.',explanation:'‘오른쪽으로’는 오른쪽 방향으로 움직이라는 뜻이에요.'},
  {prompt:'Which direction does ‘오른쪽으로 가세요’ tell you to go?',context:'You’re walking down the street and come to a fork.',explanation:'‘오른쪽으로’ means to move to the right.'},
  {prompt:'«오른쪽으로 가세요» гэдэг нь аль тийш яв гэсэн заавар вэ?',context:'Зам дагуу алхаж яваад замын салаан дээр ирлээ.',explanation:'«오른쪽으로» гэдэг нь баруун тийш яв гэсэн утгатай.'}),
 'directions-expressions-right-transfer':q(
  {prompt:'갈림길에서 ‘왼쪽으로 가세요’라는 안내를 읽었어요.',context:'어느 방향으로 가야 해요?',explanation:'새 안내의 방향은 왼쪽이에요. 이전 문제의 방향을 그대로 고르지 않아요.'},
  {prompt:'At a fork in the road, you read ‘왼쪽으로 가세요’.',context:'Which way should you go?',explanation:'The new directions say left. Don’t just pick the direction from the last question.'},
  {prompt:'Замын салаан дээр «왼쪽으로 가세요» гэсэн зааврыг уншлаа.',context:'Аль тийш явах ёстой вэ?',explanation:'Шинэ зааварт «왼쪽으로 가세요» гэж бичсэн тул зүүн тийш явна. Өмнөх асуултын хариултыг шууд битгий сонгоорой.'}),
 'directions-expressions-beside':q(
  {prompt:'공원이 어디에 있어요?',context:'“공원은 은행 옆에 있어요.”',explanation:'‘은행 옆’은 은행 가까이 나란히 있는 위치예요.'},
  {prompt:'Where is the park?',context:'“공원은 은행 옆에 있어요.”',explanation:'‘은행 옆’ means close to the bank, side by side with it.'},
  {prompt:'Цэцэрлэгт хүрээлэн хаана байдаг вэ?',context:'«공원은 은행 옆에 있어요.»',explanation:'«은행 옆» гэдэг нь банкны яг хажууд гэсэн утгатай.'}),
 'directions-expressions-beside-transfer':q(
  {prompt:'도서관이 어디에 있어요?',context:'“도서관은 학교 옆에 있어요.”',explanation:'기준 장소가 학교이고 위치는 그 옆이에요.'},
  {prompt:'Where is the library?',context:'“도서관은 학교 옆에 있어요.”',explanation:'The landmark is the school, and the library is next to it.'},
  {prompt:'Номын сан хаана байдаг вэ?',context:'«도서관은 학교 옆에 있어요.»',explanation:'«학교 옆» гэдэг нь сургуулийн яг хажууд гэсэн утгатай.'}),
 'directions-story-where':q(
  {prompt:'서하는 아주머니에게 무엇을 물었어요?',context:'',explanation:'서하는 ‘저기요, 공원이 어디에 있어요?’라고 물었어요. 병원은 태오가 말한 곳이고, 은행은 아주머니가 말한 곳이에요.'},
  {prompt:'What did Seoha ask the woman?',context:'',explanation:'Seoha asked ‘저기요, 공원이 어디에 있어요?’ Taeo mentioned the hospital, and the woman mentioned the bank.'},
  {prompt:'Сөха нэг эмэгтэйгээс юу гэж асуусан бэ?',context:'',explanation:'Сөха «저기요, 공원이 어디에 있어요?» гэж асуусан. Тэо «병원 옆» (эмнэлгийн хажууд), харин тэр эмэгтэй «은행 옆» (банкны хажууд) гэж хэлсэн.'}),
 'directions-story-where-transfer':q(
  {prompt:'지호는 어떤 말을 할까요?',context:'지호는 책을 빌리고 싶어요. 그런데 길을 몰라요.',explanation:'책은 도서관에서 빌려요. 그래서 도서관의 위치를 물어요.'},
  {prompt:'What should Jiho say?',context:'Jiho wants to borrow a book, but he doesn’t know the way.',explanation:'You borrow books at the library, so he asks where the library is.'},
  {prompt:'Жихо юу гэж хэлэх вэ?',context:'Жихо ном зээлж уншихыг хүсэж байна. Гэхдээ хаашаа явахаа мэдэхгүй байна.',explanation:'Номыг номын сангаас зээлж авдаг. Тиймээс номын сан хаана байгааг асууна.'}),
 'directions-story-turn':q(
  {prompt:'친구들은 어느 쪽으로 갔어요?',context:'',explanation:'아주머니가 ‘오른쪽으로 가세요.’라고 말했어요. 그래서 오른쪽으로 갔어요. 왼쪽은 태오가 지도를 잘못 보고 한 말이에요.'},
  {prompt:'Which way did the friends go?',context:'',explanation:'The woman said ‘오른쪽으로 가세요.’ So they went right. Taeo said left because he misread the map.'},
  {prompt:'Найзууд аль тийш явсан бэ?',context:'',explanation:'Тэр эмэгтэй «오른쪽으로 가세요.» гэж хэлсэн. Тиймээс найзууд баруун тийш явсан. Тэо газрын зургийг буруу хараад «왼쪽» (зүүн тийшээ) гэж хэлсэн.'}),
 'directions-story-turn-transfer':q(
  {prompt:'지호는 어느 쪽으로 가야 해요?',context:'지호: “도서관이 어디에 있어요?” 아저씨: “왼쪽으로 가세요. 시장 오른쪽에 있어요.”',explanation:'갈 방향은 ‘왼쪽으로 가세요.’예요. ‘시장 오른쪽’은 도서관이 있는 자리예요.'},
  {prompt:'Which way should Jiho go?',context:'Jiho: “도서관이 어디에 있어요?” Man: “왼쪽으로 가세요. 시장 오른쪽에 있어요.”',explanation:'The man said ‘왼쪽으로 가세요.’ The part ‘시장 오른쪽’ tells you where the library is.'},
  {prompt:'Жихо аль тийш явах ёстой вэ?',context:'Жихо: «도서관이 어디에 있어요?» Эрэгтэй: «왼쪽으로 가세요. 시장 오른쪽에 있어요.»',explanation:'«왼쪽으로 가세요.» гэсэн тул Жихо зүүн тийш явах ёстой. «시장 오른쪽» гэдэг нь номын сан захын баруун талд байдаг гэсэн үг.'}),
 'directions-story-landmark':q(
  {prompt:'이야기에서 공원은 어디 옆에 있어요?',context:'',explanation:'아주머니가 ‘은행 옆에 있어요.’라고 말했어요. 나도 ‘공원이 은행 옆에 있어요!’라고 말했어요. 병원은 태오가, 시장은 지호가 말한 곳이에요.'},
  {prompt:'In the story, what is the park next to?',context:'',explanation:'The woman said ‘은행 옆에 있어요.’ You also said ‘공원이 은행 옆에 있어요!’ Taeo mentioned the hospital, and Jiho mentioned the market.'},
  {prompt:'Энэ түүхэнд цэцэрлэгт хүрээлэн юуны хажууд байдаг вэ?',context:'',explanation:'Тэр эмэгтэй «은행 옆에 있어요.» гэж хэлсэн. Та ч бас «공원이 은행 옆에 있어요!» гэж хэлсэн. Тэо «병원 옆» (эмнэлгийн хажууд), Жихо «시장 옆» (захын хажууд) гэж хэлсэн.'}),
 'directions-story-landmark-transfer':q(
  {prompt:'약국은 어디 옆에 있어요?',context:'서하: “은행 옆에 약국이 있어요?” 아저씨: “아니요, 약국은 병원 옆에 있어요. 학교 앞이에요.”',explanation:'아저씨가 ‘약국은 병원 옆에 있어요.’라고 말했어요. 은행 옆이 아니에요.'},
  {prompt:'What is the pharmacy next to?',context:'Seoha: “은행 옆에 약국이 있어요?” Man: “아니요, 약국은 병원 옆에 있어요. 학교 앞이에요.”',explanation:'The man said ‘약국은 병원 옆에 있어요.’ It is not next to the bank.'},
  {prompt:'Эмийн сан юуны хажууд байдаг вэ?',context:'Сөха: «은행 옆에 약국이 있어요?» Эрэгтэй: «아니요, 약국은 병원 옆에 있어요. 학교 앞이에요.»',explanation:'Тэр эрэгтэй «약국은 병원 옆에 있어요.» гэж хэлсэн. Тэгэхээр эмийн сан банкны хажууд биш.'}),
 'directions-apply-where':q(
  {prompt:'직원에게 무엇을 물을까요?',context:'처음 온 동네에서 약국을 찾고 있어요.',explanation:'찾는 약국의 위치를 ‘어디에 있어요’로 물어요.'},
  {prompt:'What do you ask the staff?',context:'You’re looking for a pharmacy in a neighborhood you’ve never been to.',explanation:'Ask where the pharmacy is with ‘어디에 있어요’.'},
  {prompt:'Ажилтнаас юу гэж асуух вэ?',context:'Анх удаа очсон хороололдоо эмийн сан хайж байна.',explanation:'Эмийн сан хаана байгааг асуухдаа «어디에 있어요» гэж хэлнэ.'}),
 'directions-apply-where-transfer':q(
  {prompt:'지하철역을 찾고 있어요. 무엇을 물을까요?',context:'처음 온 거리라 위치를 몰라요.',explanation:'가려는 장소가 지하철역으로 바뀌어도 위치 질문은 ‘어디에 있어요’예요.'},
  {prompt:'You’re looking for a subway station. What do you ask?',context:'It’s your first time on this street, so you don’t know where it is.',explanation:'Even when the place is now a subway station, you still ask where it is with ‘어디에 있어요’.'},
  {prompt:'Метроны буудал хайж байна. Юу гэж асуух вэ?',context:'Энэ гудамжинд анх удаа ирсэн тул метроны буудал хаана байгааг мэдэхгүй байна.',explanation:'Очих газар нь метроны буудал байсан ч хаана байгааг нь асуухдаа «어디에 있어요» гэж хэлнэ.'}),
 'directions-apply-turn':q(
  {prompt:'안내에 따라 갈림길에서 어느 쪽으로 갈까요?',context:'“오른쪽으로 가세요. 편의점이 보이면 멈추세요.”',explanation:'먼저 갈 방향은 오른쪽이고 편의점은 멈출 기준이에요.'},
  {prompt:'Following the directions, which way do you go at the fork?',context:'“오른쪽으로 가세요. 편의점이 보이면 멈추세요.”',explanation:'The way to go first is right. The convenience store is where you stop.'},
  {prompt:'Зааврын дагуу замын салаанаас аль тийш явах вэ?',context:'«오른쪽으로 가세요. 편의점이 보이면 멈추세요.»',explanation:'Эхлээд баруун тийш явна. Дэлгүүр харагдвал зогсоно.'}),
 'directions-apply-turn-transfer':q(
  {prompt:'안내에 따라 갈림길에서 어느 쪽으로 갈까요?',context:'“왼쪽으로 가세요. 우체국 앞에서 기다리세요.”',explanation:'갈 방향은 왼쪽이에요. 기다릴 장소와 이동 방향을 나누어 읽어요.'},
  {prompt:'Following the directions, which way do you go at the fork?',context:'“왼쪽으로 가세요. 우체국 앞에서 기다리세요.”',explanation:'The way to go is left. Read the place to wait and the way to go separately.'},
  {prompt:'Зааврын дагуу замын салаанаас аль тийш явах вэ?',context:'«왼쪽으로 가세요. 우체국 앞에서 기다리세요.»',explanation:'Зүүн тийш явна. Хүлээх газар, явах чиглэлээ ялгаж уншаарай.'}),
 'directions-apply-landmark':q(
  {prompt:'약국의 위치에 맞는 설명을 골라요.',context:'“약국은 병원 옆에 있어요.”',explanation:'‘옆’과 ‘안’은 다른 위치예요. 병원 옆이 맞아요.'},
  {prompt:'Choose the sentence that fits where the pharmacy is.',context:'“약국은 병원 옆에 있어요.”',explanation:'‘옆’ (next to) and ‘안’ (inside) are different places. Next to the hospital is right.'},
  {prompt:'Эмийн сангийн байршилд тохирох өгүүлбэрийг сонгоно уу.',context:'«약국은 병원 옆에 있어요.»',explanation:'«옆» (хажууд), «안» (дотор) хоёр өөр утгатай. «Эмнэлгийн хажууд» гэсэн нь зөв.'}),
 'directions-apply-landmark-transfer':q(
  {prompt:'우체국의 위치에 맞는 설명을 골라요.',context:'“우체국은 학교 옆에 있어요.”',explanation:'새 기준 장소는 학교이고 우체국은 학교 옆에 있어요.'},
  {prompt:'Choose the sentence that fits where the post office is.',context:'“우체국은 학교 옆에 있어요.”',explanation:'The new landmark is the school, and the post office is next to it.'},
  {prompt:'Шуудангийн байршилд тохирох өгүүлбэрийг сонгоно уу.',context:'«우체국은 학교 옆에 있어요.»',explanation:'Энэ удаад сургуулиар баримжаална. Шуудан сургуулийн хажууд байдаг.'}),
 // 길 팩 — 끝
 // 버스 팩(11-26 저녁 「네, 이어가」) — 시작
 'transit-expressions-route':q(
  {prompt:'버스가 공원으로 가는지 확인하는 말을 골라요.',context:'',explanation:'‘이 버스는 공원에 가요?’는 이 버스가 공원으로 가는지 묻는 말이에요. 다른 보기는 버스가 오는 시간이나 타는 곳을 물어요.'},
  {prompt:'Choose the sentence that checks whether the bus goes to the park.',context:'',explanation:'‘이 버스는 공원에 가요?’ asks whether this bus goes to the park. The other choices ask when the bus comes or where to get on.'},
  {prompt:'Автобус цэцэрлэгт хүрээлэн рүү явдаг эсэхийг асуух өгүүлбэрийг сонгоно уу.',context:'',explanation:'«이 버스는 공원에 가요?» нь энэ автобус цэцэрлэгт хүрээлэн рүү явдаг эсэхийг асуусан өгүүлбэр. Бусад сонголтууд нь автобус хэдэн цагт ирэхийг эсвэл автобусанд хаанаас суухыг асуусан өгүүлбэрүүд.'}),
 'transit-expressions-route-transfer':q(
  {prompt:'버스가 도서관으로 가는지 확인해요.',context:'',explanation:'장소만 도서관으로 바꿔서 ‘이 버스는 도서관에 가요?’라고 물어요. 다른 보기는 타는 곳이나 기다리는 곳을 물어요.'},
  {prompt:'Check whether the bus goes to the library.',context:'',explanation:'Ask ‘이 버스는 도서관에 가요?’ with only the place changed to the library. The other choices ask where to get on or where to wait.'},
  {prompt:'Автобус номын сан руу явдаг эсэхийг асууна уу.',context:'',explanation:'Газрын нэрийг номын сан болгоод «이 버스는 도서관에 가요?» гэж асууна. Бусад сонголтууд нь автобусанд хаанаас суухыг эсвэл хаана хүлээхийг асуусан өгүүлбэрүүд.'}),
 'transit-expressions-alight':q(
  {prompt:'‘다음 정류장에서 내려요’에 맞는 행동은 무엇이에요?',context:'버스가 지금 정류장에 멈췄어요.',explanation:'‘다음 정류장’은 지금 멈춘 정류장 바로 뒤에 오는 정류장이에요. 그래서 한 정류장 더 가서 내려요.'},
  {prompt:'Which action fits ‘다음 정류장에서 내려요’?',context:'The bus has just stopped at a stop.',explanation:'‘다음 정류장’ is the stop right after the one where the bus has stopped now. So ride one more stop and then get off.'},
  {prompt:'«다음 정류장에서 내려요» гэдэгт аль үйлдэл тохирох вэ?',context:'Автобус одоо нэг буудал дээр зогслоо.',explanation:'«다음 정류장» нь автобус одоо зогсож байгаа буудлын яг дараагийн буудал. Тиймээс дахиад нэг буудал яваад бууна.'}),
 'transit-expressions-alight-transfer':q(
  {prompt:'‘이번 정류장에서 내려요’에 맞는 행동은 무엇이에요?',context:'버스가 이번 정류장에 멈췄어요.',explanation:'‘이번’과 ‘다음’은 달라요. 이번 정류장은 지금 멈춘 곳이에요.'},
  {prompt:'Which action fits ‘이번 정류장에서 내려요’?',context:'The bus has stopped at this stop.',explanation:'‘이번’ means this one, and ‘다음’ means next. So get off at the stop where the bus has stopped now.'},
  {prompt:'«이번 정류장에서 내려요» гэдэгт аль үйлдэл тохирох вэ?',context:'Автобус энэ буудал дээр зогслоо.',explanation:'«이번» нь «энэ», «다음» нь «дараагийн» гэсэн үг. Тиймээс автобус одоо зогсож байгаа буудал дээр бууна.'}),
 'transit-expressions-card':q(
  {prompt:'‘교통카드를 찍으세요’에 맞는 행동은 무엇이에요?',context:'버스를 탔어요. 앞에 카드 기계가 있어요.',explanation:'버스에서 ‘카드를 찍다’는 카드 기계에 카드를 댄다는 뜻이에요. 사진을 찍는다는 뜻이 아니에요.'},
  {prompt:'Which action fits ‘교통카드를 찍으세요’?',context:'You got on the bus. There is a card machine in front of you.',explanation:'On a bus, ‘카드를 찍다’ means holding your card to the card machine. It does not mean taking a photo.'},
  {prompt:'«교통카드를 찍으세요» гэдэгт аль үйлдэл тохирох вэ?',context:'Автобусанд суулаа. Урд талд карт уншигч байна.',explanation:'Автобусанд «카드를 찍다» гэдэг нь картаа уншуулахыг хэлнэ. Зураг авах гэсэн үг биш.'}),
 'transit-expressions-card-transfer':q(
  {prompt:'‘내릴 때도 교통카드를 찍으세요’에 맞는 행동을 골라요.',context:'버스가 정류장에 멈췄어요. 문 옆에 안내 글이 있어요.',explanation:'‘내릴 때도 교통카드를 찍으세요’는 내릴 때도 카드 기계에 카드를 대라는 뜻이에요. 가방에 넣거나 사진을 찍는 것이 아니에요.'},
  {prompt:'Choose the action that fits ‘내릴 때도 교통카드를 찍으세요’.',context:'The bus has stopped at a stop. There is a notice by the door.',explanation:'‘내릴 때도 교통카드를 찍으세요’ means to hold your card to the card machine when you get off, too. It does not mean putting it in your bag or taking a photo.'},
  {prompt:'«내릴 때도 교통카드를 찍으세요» гэдэгт тохирох үйлдлийг сонгоно уу.',context:'Автобус буудал дээр зогслоо. Хаалганы хажууд санамж бичиг байна.',explanation:'«내릴 때도 교통카드를 찍으세요» гэдэг нь буухдаа ч картаа уншуулах хэрэгтэй гэсэн үг. Цүнхэндээ хийх эсвэл зураг авах гэсэн үг биш.'}),
 'transit-story-route':q(
  {prompt:'친구들은 버스를 타고 어디에 가요?',context:'',explanation:'친구들은 꽃길 공원에 가요. 기사님도 ‘네, 꽃길 공원에 가요.’라고 했어요. 학교는 버스를 탄 곳이고, 도서관은 내리지 않은 정류장이에요.'},
  {prompt:'Where are your friends going by bus?',context:'',explanation:'Your friends are going to Kkotgil Park. The driver also said ‘네, 꽃길 공원에 가요.’ (Yes, it goes to Kkotgil Park.) They got on in front of the school, and they did not get off at the library.'},
  {prompt:'Найзууд автобусаар хаашаа явж байгаа вэ?',context:'',explanation:'Найзууд Коткил цэцэрлэгт хүрээлэн рүү явж байна. Жолооч «네, 꽃길 공원에 가요.» (Тийм ээ, Коткил цэцэрлэгт хүрээлэн рүү явна.) гэж хэлсэн. Тэд сургуулийн урд талын буудлаас автобусанд суусан бөгөөд номын сангийн буудал дээр буугаагүй.'}),
 'transit-story-route-transfer':q(
  {prompt:'버스 안내표를 읽고 버스가 가는 곳을 골라요.',context:'안내표: “마루 도서관행”',explanation:'안내표의 ‘마루 도서관행’은 마루 도서관으로 간다는 뜻이에요. ‘-행’은 ‘~로 가는’이라는 말이에요. 그래서 이 버스는 마루 카페가 아니라 마루 도서관으로 가요.'},
  {prompt:'Read the bus sign and choose where the bus goes.',context:'Bus sign: “마루 도서관행”',explanation:'‘마루 도서관행’ on the sign means it goes to Maru Library. ‘-행’ means ‘~로 가는’ (going to). So this bus goes to Maru Library, not Maru Café.'},
  {prompt:'Автобусны чиглэлийн самбарыг уншаад автобус хаашаа явдгийг сонгоно уу.',context:'Чиглэлийн самбар: «마루 도서관행»',explanation:'Самбар дээрх «마루 도서관행» нь Мару номын сан руу явна гэсэн утгатай. «-행» нь «~로 가는» (… руу явдаг) гэсэн үг. Тиймээс энэ автобус Мару кафе биш, Мару номын сан руу явна.'}),
 'transit-story-alight':q(
  {prompt:'버스가 도서관 정류장에 왔어요. 친구들은 어떻게 했어요?',context:'',explanation:'서하가 ‘아니요, 다음 정류장에서 내려요.’라고 했어요. 공원은 도서관 다음이라서 한 정류장 더 갔어요.'},
  {prompt:'The bus came to the library stop. What did your friends do?',context:'',explanation:'Seoha said ‘아니요, 다음 정류장에서 내려요.’ (No, we get off at the next stop.) The park is the stop after the library, so they rode one more stop.'},
  {prompt:'Автобус номын сангийн буудал дээр ирсэн. Найзууд юу хийсэн бэ?',context:'',explanation:'Сөха «아니요, 다음 정류장에서 내려요.» (Үгүй, дараагийн буудал дээр бууна.) гэж хэлсэн. Цэцэрлэгт хүрээлэн номын сангийн дараагийн буудал учраас тэд дахиад нэг буудал явсан.'}),
 'transit-story-alight-transfer':q(
  {prompt:'어디에서 내려요?',context:'지금 정류장: 학교 / 다음 정류장: 마루 도서관. 마루 도서관에 가요.',explanation:'‘다음 정류장: 마루 도서관’이고 마루 도서관에 가요. 그래서 다음 정류장에서 내려요. 학교는 지금 있는 정류장이라서 아직 내리지 않아요.'},
  {prompt:'Where do you get off?',context:'This stop: School / Next stop: Maru Library. You are going to Maru Library.',explanation:'It says ‘다음 정류장: 마루 도서관’ (next stop: Maru Library), and you are going to Maru Library. So get off at the next stop. School is the stop you are at now, so you don’t get off yet.'},
  {prompt:'Хаана буух вэ?',context:'Одоогийн буудал: Сургууль / Дараагийн буудал: Мару номын сан. Та Мару номын сан руу явж байна.',explanation:'«다음 정류장: 마루 도서관» (дараагийн буудал: Мару номын сан) гэж бичсэн бөгөөд та Мару номын сан руу явж байна. Тиймээс дараагийн буудал дээр бууна. Одоогийн «Сургууль» буудал дээр буухгүй.'}),
 'transit-story-card':q(
  {prompt:'기사님이 ‘교통카드를 찍으세요.’라고 했어요. 친구들은 어떻게 했어요?',context:'',explanation:'‘교통카드를 찍으세요.’는 카드 기계에 교통카드를 대라는 말이에요. 그래서 친구들은 카드 기계에 교통카드를 댔어요. 기사님에게 카드를 주지 않았어요.'},
  {prompt:'The driver said ‘교통카드를 찍으세요.’ What did your friends do?',context:'',explanation:'‘교통카드를 찍으세요.’ means to hold your transit card to the card machine. So your friends held their transit cards to the card machine. They did not give their cards to the driver.'},
  {prompt:'Жолооч «교통카드를 찍으세요.» гэж хэлсэн. Найзууд юу хийсэн бэ?',context:'',explanation:'«교통카드를 찍으세요.» гэдэг нь нийтийн тээврийн картаа уншуулах хэрэгтэй гэсэн үг. Тиймээс найзууд нийтийн тээврийн картаа уншуулсан. Тэд картаа жолоочид өгөөгүй.'}),
 'transit-story-card-transfer':q(
  {prompt:'안내를 읽고 어떻게 해야 하는지 골라요.',context:'“지하철을 탈 때 교통카드를 찍으세요.”',explanation:'‘교통카드를 찍으세요.’는 교통카드를 카드 기계에 대라는 뜻이에요. 여기에서 ‘찍다’는 사진을 찍는다는 뜻이 아니에요. 역 직원에게 카드를 주지도 않아요.'},
  {prompt:'Read the notice and choose what to do.',context:'“지하철을 탈 때 교통카드를 찍으세요.”',explanation:'‘교통카드를 찍으세요.’ means to hold your transit card to the card machine. Here, ‘찍다’ does not mean taking a photo. You don’t give your card to a station worker either.'},
  {prompt:'Санамжийг уншаад юу хийхээ сонгоно уу.',context:'«지하철을 탈 때 교통카드를 찍으세요.»',explanation:'«교통카드를 찍으세요.» гэдэг нь нийтийн тээврийн картаа уншуулах хэрэгтэй гэсэн үг. Энд «찍다» гэдэг нь зураг авна гэсэн үг биш. Картаа метроны ажилтанд ч өгөхгүй.'}),
 'transit-apply-route':q(
  {prompt:'병원에 가고 싶어요. 이 버스가 병원에 가는지 묻는 말을 골라요.',context:'',explanation:'‘이 버스는 병원에 가요?’는 버스가 병원에 가는지 묻는 말이에요. 다른 보기는 버스가 오는 시간이나 타는 곳을 물어요.'},
  {prompt:'You want to go to the hospital. Choose the question that asks whether this bus goes to the hospital.',context:'',explanation:'‘이 버스는 병원에 가요?’ asks whether the bus goes to the hospital. The other choices ask when the bus comes or where to get on.'},
  {prompt:'Эмнэлэг рүү явмаар байна. Энэ автобус эмнэлэг рүү явдаг эсэхийг асуух өгүүлбэрийг сонгоно уу.',context:'',explanation:'«이 버스는 병원에 가요?» нь автобус эмнэлэг рүү явдаг эсэхийг асуусан өгүүлбэр. Бусад сонголтууд нь автобус хэзээ ирэхийг эсвэл автобусанд хаанаас суухыг асуусан өгүүлбэрүүд.'}),
 'transit-apply-route-transfer':q(
  {prompt:'학교에 가고 싶어요. 정류장에 버스가 왔어요. 버스 기사님에게 무엇을 물어요?',context:'',explanation:'학교에 가고 싶으니까 이 버스가 학교에 가는지 알아야 해요. 그래서 ‘이 버스는 학교에 가요?’라고 물어요. 버스는 벌써 왔고 나는 지금 정류장에 있어요. 그래서 ‘이 버스는 몇 시에 와요?’, ‘버스 정류장이 어디에 있어요?’는 맞지 않아요.'},
  {prompt:'You want to go to school. A bus has come to the stop. What do you ask the driver?',context:'',explanation:'You want to go to school, so you need to know whether this bus goes there. That is why you ask ‘이 버스는 학교에 가요?’ The bus has already come, and you are at the stop now. So ‘이 버스는 몇 시에 와요?’ and ‘버스 정류장이 어디에 있어요?’ don’t fit.'},
  {prompt:'Сургууль руу явмаар байна. Буудал дээр автобус ирлээ. Жолоочоос юу гэж асуух вэ?',context:'',explanation:'Сургууль руу явмаар байгаа учраас энэ автобус сургууль руу явдаг эсэхийг мэдэх хэрэгтэй. Тиймээс «이 버스는 학교에 가요?» гэж асууна. Автобус аль хэдийн ирсэн, та одоо буудал дээр байна. Тиймээс «이 버스는 몇 시에 와요?» болон «버스 정류장이 어디에 있어요?» гэж асуух нь тохирохгүй.'}),
 'transit-apply-alight':q(
  {prompt:'지금 어떻게 할까요?',context:'버스를 타고 병원에 가요. 안내 방송: “이번 정류장은 병원입니다.”',explanation:'이번 정류장이 병원이라서 지금 내려요. 다음 정류장에서 내리면 병원을 지나가요.'},
  {prompt:'What should you do now?',context:'You are riding the bus to the hospital. Announcement: “이번 정류장은 병원입니다.”',explanation:'This stop is the hospital, so get off now. If you get off at the next stop, you will go past the hospital.'},
  {prompt:'Одоо юу хийх вэ?',context:'Та автобусаар эмнэлэг рүү явж байна. Дуут мэдээлэл: «이번 정류장은 병원입니다.»',explanation:'Энэ бол эмнэлгийн буудал. Та эмнэлэг рүү явж байгаа учраас одоо бууна. Дараагийн буудал дээр буувал эмнэлгийг өнгөрчихнө.'}),
 'transit-apply-alight-transfer':q(
  {prompt:'지금 어떻게 할까요?',context:'버스를 타고 학교에 가요. 안내 방송: “이번 정류장은 시장입니다. 다음 정류장은 학교입니다.”',explanation:'‘이번 정류장은 시장입니다. 다음 정류장은 학교입니다.’라고 했어요. 학교에 가니까 다음 정류장에서 내려요. 이번 정류장은 시장이라서 지금 내리면 안 돼요.'},
  {prompt:'What should you do now?',context:'You are riding the bus to school. Announcement: “이번 정류장은 시장입니다. 다음 정류장은 학교입니다.”',explanation:'The announcement said ‘이번 정류장은 시장입니다. 다음 정류장은 학교입니다.’ You are going to school, so get off at the next stop. This stop is the market, so don’t get off now.'},
  {prompt:'Одоо юу хийх вэ?',context:'Та автобусаар сургууль руу явж байна. Дуут мэдээлэл: «이번 정류장은 시장입니다. 다음 정류장은 학교입니다.»',explanation:'Дуут мэдээллээр «이번 정류장은 시장입니다. 다음 정류장은 학교입니다.» гэж зарласан. Та сургууль руу явж байгаа учраас дараагийн буудал дээр бууна. Энэ буудал зах учраас одоо буухгүй.'}),
 'transit-apply-card':q(
  {prompt:'안내에 맞는 행동을 골라요.',context:'“교통카드를 찍고 버스 안으로 들어가세요.”',explanation:'이 상황에서 ‘카드를 찍다’는 버스의 카드 기계에 카드를 대라는 뜻이에요. 카드 사진을 찍는 것이 아니에요.'},
  {prompt:'Choose the action that fits the notice.',context:'“교통카드를 찍고 버스 안으로 들어가세요.”',explanation:'Here, ‘카드를 찍다’ means holding your card to the bus’s card machine. It does not mean taking a photo of the card.'},
  {prompt:'Санамжид тохирох үйлдлийг сонгоно уу.',context:'«교통카드를 찍고 버스 안으로 들어가세요.»',explanation:'Энд «카드를 찍다» гэдэг нь картаа автобусанд уншуулахыг хэлнэ. Картын зураг авах гэсэн үг биш.'}),
 'transit-apply-card-transfer':q(
  {prompt:'버스에서 내릴 때 보는 안내예요. 맞는 행동을 골라요.',context:'“내리기 전에 교통카드를 찍으세요.”',explanation:'‘내리기 전에 교통카드를 찍으세요’는 내리기 전에 카드를 카드 기계에 대라는 뜻이에요. 사진을 찍는 것도, 내린 뒤에 대는 것도 아니에요.'},
  {prompt:'This is a notice you see when getting off a bus. Choose the action that fits.',context:'“내리기 전에 교통카드를 찍으세요.”',explanation:'‘내리기 전에 교통카드를 찍으세요’ means to hold your card to the card machine before you get off. It is not about taking a photo or tapping after you get off.'},
  {prompt:'Автобуснаас буух үед харагдах санамж. Тохирох үйлдлийг сонгоно уу.',context:'«내리기 전에 교통카드를 찍으세요.»',explanation:'«내리기 전에 교통카드를 찍으세요» гэдэг нь буухын өмнө картаа уншуулах хэрэгтэй гэсэн үг. Зураг авах ч биш, буусны дараа уншуулах ч биш.'}),
 // 버스 팩 — 끝
 // 약속 팩(11-27 「남은거 있으면 이어서해」) — 시작
 'plans-expressions-time':q(
  {prompt:'언제 만나는 약속이에요?',context:'“내일 오후 세 시에 만나요.”',explanation:'‘내일’이라는 날짜와 ‘오후 세 시’라는 시간을 함께 읽어요.'},
  {prompt:'When is the meeting?',context:'“내일 오후 세 시에 만나요.”',explanation:'Read the day ‘내일’ (tomorrow) and the time ‘오후 세 시’ (3 p.m.) together.'},
  {prompt:'Хэзээ уулзахаар тохирсон бэ?',context:'«내일 오후 세 시에 만나요.»',explanation:'Өдөр нь «내일» (маргааш), цаг нь «오후 세 시» (өдрийн гурван цаг). Хоёуланг нь хамтад нь харна.'}),
 'plans-expressions-time-transfer':q(
  {prompt:'언제 만나는 약속이에요?',context:'“오늘 오전 열 시에 만나요.”',explanation:'새 약속은 오늘이고 시간은 오전 열 시예요.'},
  {prompt:'When is the meeting?',context:'“오늘 오전 열 시에 만나요.”',explanation:'This meeting is today, and the time is 10 a.m.'},
  {prompt:'Хэзээ уулзахаар тохирсон бэ?',context:'«오늘 오전 열 시에 만나요.»',explanation:'Энэ уулзалт өнөөдөр өглөөний арван цагт болно.'}),
 'plans-expressions-place':q(
  {prompt:'‘어디에서 만날까요?’는 무엇을 정하려는 말이에요?',context:'',explanation:'‘어디에서’는 장소를 묻는 말이에요. 날짜는 ‘언제’, 사람은 ‘누구’로 물어요.'},
  {prompt:'What does ‘어디에서 만날까요?’ try to decide?',context:'',explanation:'‘어디에서’ asks about a place. You ask about a day with ‘언제’ and about a person with ‘누구’.'},
  {prompt:'«어디에서 만날까요?» гэж юуг тохиролцохын тулд асуудаг вэ?',context:'',explanation:'«어디에서» нь хаана гэдгийг асуудаг үг. Өдөр, цаг асуухдаа «언제», хэн болохыг асуухдаа «누구» гэж асууна.'}),
 'plans-expressions-place-transfer':q(
  {prompt:'만날 장소를 물었어요. 알맞은 답을 골라요.',context:'“어디에서 만날까요?”',explanation:'장소를 물었으므로 ‘학교 앞’이라는 장소를 답해요.'},
  {prompt:'Someone asked where to meet. Choose a good answer.',context:'“어디에서 만날까요?”',explanation:'They asked about a place, so you answer with the place ‘학교 앞’ (in front of the school).'},
  {prompt:'Хаана уулзахыг асуулаа. Тохирох хариултыг сонгоно уу.',context:'«어디에서 만날까요?»',explanation:'Уулзах газраа асуусан учраас «학교 앞» (сургуулийн урд) гэж хариулна.'}),
 'plans-expressions-delay':q(
  {prompt:'‘조금 늦을 것 같아요’는 어떤 연락이에요?',context:'친구와 만나기로 한 날에 보낸 메시지예요.',explanation:'아직 도착하기 전이며 약속 시간보다 늦을 가능성을 알리는 말이에요.'},
  {prompt:'What kind of message is ‘조금 늦을 것 같아요’?',context:'A message sent on the day you planned to meet a friend.',explanation:'Before arriving, you let your friend know you may be later than the meeting time.'},
  {prompt:'«조금 늦을 것 같아요» гэдэг нь ямар мессеж вэ?',context:'Найзтайгаа уулзахаар тохирсон өдөр илгээсэн мессеж.',explanation:'Уулзах газартаа очихоосоо өмнө товлосон цагаасаа хоцорч магадгүй гэдгээ найздаа мэдэгдэж байна.'}),
 'plans-expressions-delay-transfer':q(
  {prompt:'약속 시간보다 늦게 도착할 것 같아요. 어떤 연락을 할까요?',context:'',explanation:'늦을 것 같을 때 상황을 미리 알려 주는 표현이에요.'},
  {prompt:'You think you will arrive later than the meeting time. What message do you send?',context:'',explanation:'This expression lets your friend know in advance when you think you will be late.'},
  {prompt:'Товлосон цагаасаа хоцрох юм шиг байна. Ямар мессеж илгээх вэ?',context:'',explanation:'Хоцрох гэж байгаа үед найздаа урьдчилан мэдэгддэг хэллэг.'}),
 'plans-story-time':q(
  {prompt:'처음 정한 약속 시간은 언제예요?',context:'',explanation:'금요일에 서하가 ‘내일 같이 공부해요. 오후 세 시 어때요?’라고 했어요. 금요일의 내일은 토요일이에요. 그래서 약속은 토요일 오후 세 시예요.'},
  {prompt:'When did they first agree to meet?',context:'',explanation:'On Friday, Seoha said ‘내일 같이 공부해요. 오후 세 시 어때요?’ (Let’s study together tomorrow. How about 3 p.m.?) The day after Friday is Saturday. So the meeting is on Saturday at 3 p.m.'},
  {prompt:'Анх хэзээ уулзахаар тохирсон бэ?',context:'',explanation:'Баасан гарагт Сөха «내일 같이 공부해요. 오후 세 시 어때요?» (Маргааш хамт хичээлээ давтъя. Өдрийн гурван цаг болох уу?) гэж хэлсэн. Баасан гарагт «маргааш» гэвэл бямба гараг. Тиймээс тэд бямба гарагт өдрийн гурван цагт уулзана.'}),
 'plans-story-time-transfer':q(
  {prompt:'새 약속 카드에 적힌 시간을 골라요.',context:'약속 카드: “토요일 오전 11시 · 도서관 앞”',explanation:'카드에 ‘토요일 오전 11시’라고 적혀 있어요. ‘11시’는 ‘열한 시’라고 읽어요. ‘오후’도 아니고 ‘일요일’도 아니에요.'},
  {prompt:'Choose the time written on the new plan card.',context:'Plan card: “토요일 오전 11시 · 도서관 앞”',explanation:'The card says ‘토요일 오전 11시’ (Saturday, 11 a.m.). You read ‘11시’ as ‘열한 시’ (eleven o’clock). It is not ‘오후’ (p.m.), and it is not ‘일요일’ (Sunday).'},
  {prompt:'Шинэ уулзалтын карт дээр бичсэн цагийг сонгоно уу.',context:'Уулзалтын карт: «토요일 오전 11시 · 도서관 앞»',explanation:'Карт дээр «토요일 오전 11시» (бямба гараг, өглөөний 11 цаг) гэж бичсэн. «11시» гэдгийг «열한 시» (арван нэгэн цаг) гэж уншина. «오후» (үдээс хойш) ч биш, «일요일» (ням гараг) ч биш.'}),
 'plans-story-place':q(
  {prompt:'친구들은 어디에서 만났어요?',context:'',explanation:'태오가 ‘도서관 앞 벤치에서 만나요!’라고 했어요. 토요일에 모두 도서관 앞 벤치에서 만났어요.'},
  {prompt:'Where did the friends meet?',context:'',explanation:'Taeo said ‘도서관 앞 벤치에서 만나요!’ (Let’s meet at the bench in front of the library!) On Saturday, everyone met at the bench in front of the library.'},
  {prompt:'Найзууд хаана уулзсан бэ?',context:'',explanation:'Тэо «도서관 앞 벤치에서 만나요!» (Номын сангийн урдах вандан сандал дээр уулзъя!) гэж хэлсэн. Бямба гарагт бүгд номын сангийн урдах вандан сандал дээр уулзсан.'}),
 'plans-story-place-transfer':q(
  {prompt:'새 메시지를 읽고 만날 장소를 골라요.',context:'“공원 입구에서 만나요. 안의 벤치가 아니라 입구예요.”',explanation:'‘입구’라는 장소와 ‘안의 벤치가 아니라’라는 확인을 함께 읽어요.'},
  {prompt:'Read the new message and choose where to meet.',context:'“공원 입구에서 만나요. 안의 벤치가 아니라 입구예요.”',explanation:'Read the place ‘입구’ (entrance) together with the check ‘안의 벤치가 아니라’ (not the bench inside).'},
  {prompt:'Шинэ мессежийг уншаад уулзах газрыг сонгоно уу.',context:'«공원 입구에서 만나요. 안의 벤치가 아니라 입구예요.»',explanation:'«입구» (орох хаалга) гэсэн үг болон «안의 벤치가 아니라» (доторх вандан сандал биш) гэсэн хэсгийг холбож ойлгоно.'}),
 'plans-story-delay':q(
  {prompt:'태오가 ‘조금 늦을 것 같아요.’라고 보냈어요. 친구들은 무엇을 했어요?',context:'',explanation:'서하가 ‘괜찮아요. 우리는 여기서 기다릴게요.’라고 했어요. 그래서 친구들은 도서관 안에 들어가지 않고 도서관 앞에서 기다렸어요. 음료수는 태오가 가지고 왔어요.'},
  {prompt:'Taeo sent ‘조금 늦을 것 같아요.’ What did the friends do?',context:'',explanation:'Seoha said ‘괜찮아요. 우리는 여기서 기다릴게요.’ (It’s okay. We’ll wait here.) So the friends did not go into the library. They waited in front of it. Taeo brought the drinks.'},
  {prompt:'Тэо «조금 늦을 것 같아요.» гэж мессеж илгээсэн. Найзууд нь юу хийсэн бэ?',context:'',explanation:'Сөха «괜찮아요. 우리는 여기서 기다릴게요.» (Зүгээр ээ. Бид энд хүлээж байя.) гэж хэлсэн. Тиймээс найзууд номын сан руу ороогүй, урд нь хүлээсэн. Ундааг Тэо авчирсан.'}),
 'plans-story-delay-transfer':q(
  {prompt:'새 메시지를 읽고 도착 상태를 골라요.',context:'“버스를 놓쳤어요. 십 분 늦을 것 같아요.”',explanation:'버스를 놓쳐 약속 시간보다 늦을 것 같다는 연락이에요. 취소라는 말은 없어요.'},
  {prompt:'Read the new message and choose whether the friend has arrived.',context:'“버스를 놓쳤어요. 십 분 늦을 것 같아요.”',explanation:'The friend missed the bus and will probably be later than the meeting time. The message does not say the plan is cancelled.'},
  {prompt:'Шинэ мессежийг уншаад найз ирсэн эсэхийг сонгоно уу.',context:'«버스를 놓쳤어요. 십 분 늦을 것 같아요.»',explanation:'Найз автобуснаасаа хоцорсон тул товлосон цагаасаа хоцрох юм шиг байна. Мессежид уулзалтаа цуцалсан гэж бичээгүй.'}),
 'plans-apply-time':q(
  {prompt:'언제 가야 해요?',context:'친구의 메시지: “내일 오후 두 시에 학교 앞에서 만나요.”',explanation:'날짜는 내일, 시간은 오후 두 시예요.'},
  {prompt:'When should you go?',context:'Friend’s message: “내일 오후 두 시에 학교 앞에서 만나요.”',explanation:'The day is tomorrow, and the time is 2 p.m.'},
  {prompt:'Хэзээ очих вэ?',context:'Найзын мессеж: «내일 오후 두 시에 학교 앞에서 만나요.»',explanation:'Маргааш өдрийн хоёр цагт уулзана.'}),
 'plans-apply-time-transfer':q(
  {prompt:'언제 가야 해요?',context:'친구의 메시지: “오늘 오후 다섯 시에 카페 앞에서 만나요.”',explanation:'메시지에 ‘오늘 오후 다섯 시’라고 했어요. ‘내일’이 아니고 ‘오전’도 아니에요.'},
  {prompt:'When should you go?',context:'Friend’s message: “오늘 오후 다섯 시에 카페 앞에서 만나요.”',explanation:'The message says ‘오늘 오후 다섯 시’ (today at 5 p.m.). It is not ‘내일’ (tomorrow), and it is not ‘오전’ (a.m.).'},
  {prompt:'Хэзээ очих вэ?',context:'Найзын мессеж: «오늘 오후 다섯 시에 카페 앞에서 만나요.»',explanation:'Мессежид «오늘 오후 다섯 시» (өнөөдөр оройн таван цаг) гэж бичсэн. «내일» (маргааш) ч биш, «오전» (үдээс өмнө) ч биш.'}),
 'plans-apply-place':q(
  {prompt:'어디에서 기다릴까요?',context:'“역 안이 아니라 역 앞에서 만나요.”',explanation:'메시지는 ‘역 안’이 아니라 ‘역 앞’이라고 확인해 줘요.'},
  {prompt:'Where should you wait?',context:'“역 안이 아니라 역 앞에서 만나요.”',explanation:'The message makes it clear: not ‘역 안’ (inside the station) but ‘역 앞’ (in front of the station).'},
  {prompt:'Хаана хүлээх вэ?',context:'«역 안이 아니라 역 앞에서 만나요.»',explanation:'Мессежид «역 안» (буудал дотор) биш, «역 앞» (буудлын урд) гэж тодруулсан.'}),
 'plans-apply-place-transfer':q(
  {prompt:'어디에서 기다릴까요?',context:'“학교 안이 아니라 학교 앞에서 만나요.”',explanation:'‘학교 안’이 아니라 ‘학교 앞’에서 만나요.'},
  {prompt:'Where should you wait?',context:'“학교 안이 아니라 학교 앞에서 만나요.”',explanation:'You meet not ‘학교 안’ (inside the school) but ‘학교 앞’ (in front of the school).'},
  {prompt:'Хаана хүлээх вэ?',context:'«학교 안이 아니라 학교 앞에서 만나요.»',explanation:'Мессежид «학교 안» (сургууль дотор) биш, «학교 앞» (сургуулийн урд) гэж бичсэн. Тиймээс сургуулийн урд уулзана.'}),
 'plans-apply-delay':q(
  {prompt:'친구에게 보낼 연락을 골라요.',context:'약속 장소에 가는 버스를 놓쳤어요. 약속 시간보다 늦게 도착할 것 같아요.',explanation:'아직 도착하지 않았고 늦을 것 같으므로 미리 연락해요.'},
  {prompt:'Choose the message to send to your friend.',context:'You missed the bus to the meeting place. You think you will arrive later than the meeting time.',explanation:'You haven’t arrived yet and you think you will be late, so you let your friend know in advance.'},
  {prompt:'Найздаа илгээх мессежийг сонгоно уу.',context:'Уулзах газар луу явах автобуснаасаа хоцорлоо. Товлосон цагаасаа хоцрох юм шиг байна.',explanation:'Та хараахан очоогүй, хоцрох юм шиг байгаа учраас урьдчилан мэдэгдэнэ.'}),
 'plans-apply-delay-transfer':q(
  {prompt:'친구에게 보낼 메시지를 골라요.',context:'세 시에 친구를 만나요. 그런데 길이 막혀서 세 시 십 분에 도착할 것 같아요.',explanation:'세 시 약속인데 세 시 십 분에 도착할 것 같아요. 그래서 ‘십 분 늦을 것 같아요.’라고 미리 메시지를 보내요. 일찍 도착하거나 약속 시간에 맞게 도착하는 것이 아니에요.'},
  {prompt:'Choose the message to send to your friend.',context:'You are meeting a friend at 3:00. But traffic is heavy, so you think you will arrive at 3:10.',explanation:'The meeting is at 3:00, but you think you will arrive at 3:10. So you send ‘십 분 늦을 것 같아요.’ in advance. You will not arrive early or on time.'},
  {prompt:'Найздаа илгээх мессежийг сонгоно уу.',context:'Гурван цагт найзтайгаа уулзана. Гэтэл зам түгжрээд гурван цаг арван минутад очих юм шиг байна.',explanation:'Уулзалт гурван цагт болно. Гэтэл та гурван цаг арван минутад очих юм шиг байна. Тиймээс «십 분 늦을 것 같아요.» гэж урьдчилан мессеж илгээнэ. Та эрт ч, цагтаа ч очихгүй.'}),
 // 약속 팩 — 끝
});

// 표현 익히기 카드의 설명(표현 자체는 한국어 그대로).
export const LIFE_EXPRESSION_TEXT=Object.freeze({
 'greet-hello':q('처음 만난 사람이나 아는 사람에게 정중하게 인사해요.','A polite greeting for anyone you meet, even for the first time.','Хэнтэй уулзсан ч, бүр анх удаа ч гэсэн эелдгээр мэндлэх үг.'),
 'greet-thanks':q('도움을 받았을 때 정중하게 고마움을 전해요.','Politely says thank you when someone helps you.','Тусламж авахдаа эелдгээр талархлаа илэрхийлнэ.'),
 'greet-name':q('자기 이름을 소개해요. 이름 끝에 받침이 있으면 ‘이에요’, 없으면 ‘예요’를 써요.','Introduces your own name. If the name ends in a final consonant (받침), use ‘이에요’; if not, use ‘예요’.','Өөрийгөө танилцуулахад хэрэглэнэ. Нэр тань гийгүүлэгчээр (받침) төгссөн бол «이에요»-г, үгүй бол «예요»-г хэрэглэнэ.'),
 // 카페 팩(11-24 「만들어 둬」) — 시작
 'cafe-order':q('음료의 종류·온도·수를 함께 말하며 주문해요.','Order by saying the kind of drink, its temperature and how many cups, all together.','Ямар уух зүйл, халуун хүйтний алийг нь, хэдэн аяга авахаа нэг дор хэлж захиална.'),
 'cafe-here':q('카페 안에서 마시겠다고 말해요.','Says you will drink inside the café.','Кафе дотор ууна гэдгээ хэлнэ.'),
 'cafe-takeout':q('음료를 밖으로 가져가겠다고 말해요.','Says you will take your drink out with you.','Уух зүйлээ авч явна гэдгээ хэлнэ.'),
 'cafe-preference':q('친구가 원하는 음료의 종류와 온도를 알아봐요.','Find out what kind of drink your friend wants, and how hot or cold.','Найз тань ямар уух зүйл, халуун хүйтний алийг нь хүсэж байгааг мэдэж авна.'),
 'cafe-soldout':q('품절은 오늘 더 주문할 수 없다는 뜻이에요. 가능한 다른 음료를 골라요.','‘품절’ means sold out: you can’t order it any more today. Pick another drink that is available.','«품절» гэдэг нь дууссан, өнөөдөр дахиж захиалах боломжгүй гэсэн үг. Захиалж болох өөр уух зүйл сонгоно.'),
 'cafe-change':q('이미 주문한 음료를 다른 음료로 바꾸어 달라고 부탁해요.','Ask to change a drink you already ordered to a different one.','Захиалсан уух зүйлээ өөр зүйлээр солиулахыг хүснэ.'),
 'cafe-add':q('주문한 수량에 한 잔을 추가해요.','Adds one more cup to what you ordered.','Захиалга дээрээ дахиад нэг аяга нэмүүлнэ.'),
 'cafe-compose':q('음료·온도·잔 수를 직접 골라 한 문장으로 주문해요.','Choose the drink, temperature and number of cups yourself and order in one sentence.','Ямар уух зүйл, халуун хүйтний алийг нь, хэдэн аяга авахаа өөрөө сонгоод нэг өгүүлбэрээр захиална.'),
 // 카페 팩 — 끝
 // 편의점 팩(11-25 「네, 이어가」) — 시작
 'store-price':q('물건의 가격을 물어요.','Asks the price of something.','Барааны үнийг асууна.'),
 'store-bag':q('산 물건을 담을 봉투를 부탁해요.','Asks for a bag to carry what you bought.','Худалдаж авсан юмаа хийх уут өгөөч гэж хэлнэ.'),
 'store-card':q('카드로 값을 내겠다고 말해요.','Says you will pay by card.','Картаар төлнө гэдгээ хэлнэ.'),
 // 편의점 팩 — 끝
 // 길 팩(11-26 「네, 이어가」) — 시작
 'directions-where':q('가려는 장소의 위치를 물어요.','Asks where the place you want to go is.','Очих газар хаана байгааг асууна.'),
 'directions-right':q('오른쪽 방향으로 이동하라는 안내예요.','Directions that tell you to go to the right.','Баруун тийш яв гэсэн заавар.'),
 'directions-beside':q('은행 바로 옆에 있는 장소를 설명해요.','Describes a place right next to the bank.','Банкны яг хажууд байдаг газрыг хэлэхэд хэрэглэнэ.'),
 // 길 팩 — 끝
 // 버스 팩(11-26 저녁 「네, 이어가」) — 시작
 'transit-destination':q('타려는 버스가 가려는 곳으로 가는지 물어요.','Asks whether the bus you want to take goes to the place you want to go.','Суух гэж буй автобус очих газар луу тань явдаг эсэхийг асууна.'),
 'transit-alight':q('지금 정류장이 아니라 그다음 정류장에서 내려요.','You get off at the stop after this one, not this stop.','Энэ буудал биш, дараагийн буудал дээр бууна.'),
 'transit-card':q('버스의 카드 기계에 교통카드를 대라는 안내예요.','An instruction to hold your transit card to the bus’s card machine.','Автобусанд нийтийн тээврийн картаа уншуулах хэрэгтэй гэсэн санамж.'),
 // 버스 팩 — 끝
 // 약속 팩(11-27 「남은거 있으면 이어서해」) — 시작
 'plans-time':q('만날 날짜와 시간을 정해요.','Sets the day and time to meet.','Уулзах өдөр, цагаа тохирно.'),
 'plans-place':q('만날 장소를 함께 정하려고 물어요.','Asks so you can decide together where to meet.','Уулзах газраа тохиролцохын тулд асуудаг асуулт.'),
 'plans-delay':q('약속 시간보다 늦게 도착할 것 같다고 알려요.','Lets someone know you think you will arrive later than the meeting time.','Товлосон цагаасаа хоцорч магадгүй гэдгээ мэдэгдэнэ.'),
 // 약속 팩 — 끝
});

// 「뜻 보기」: 답한 뒤에만 보이는 보기의 뜻. 키는 보기 글자 그대로다.
export const LIFE_CHOICE_MEANINGS=Object.freeze({
 '안녕하세요.':{en:'Hello. (a polite greeting)',mn:'Сайн байна уу? (эелдэг мэндчилгээ)'},
 '감사합니다.':{en:'Thank you.',mn:'Баярлалаа.'},
 '다녀왔어요.':{en:'I’m back. (said when you get home)',mn:'Ирлээ. (гэртээ ирэхдээ хэлдэг)'},
 '다녀왔습니다.':{en:'I’m back. (said politely when you get home)',mn:'Ирлээ. (гэртээ ирэхдээ эелдгээр хэлдэг)'},
 '저는 수진이에요.':{en:'I’m Sujin.',mn:'Намайг Сүжин гэдэг.'},
 // 보기에는 없는 배울 표현(표현 판의 뜻 줄로 쓴다, 11-26)
 '저는 서하예요.':{en:'I’m Seoha.',mn:'Намайг Сөха гэдэг.'},
 '따뜻한 차를 마시고 싶어요.':{en:'I’d like to drink hot tea.',mn:'Халуун цай уумаар байна.'},
 '주스는 품절이에요.':{en:'The juice is sold out.',mn:'Шүүс дууссан.'},
 '저는 지훈이에요.':{en:'I’m Jihun.',mn:'Намайг Жихүн гэдэг.'},
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
 '저는 준영이에요.':{en:'I’m Junyoung.',mn:'Намайг Жүнёон гэдэг.'},
 '준영은 어디에 있어요?':{en:'Where is Junyoung?',mn:'Жүнёон хаана байна вэ?'},
 '준영은 학교에 가요.':{en:'Junyoung goes to school.',mn:'Жүнёон сургууль руу явж байна.'},
 // 카페 팩(11-24 「만들어 둬」) — 시작
 '차가운 차 두 잔':{en:'two iced teas',mn:'хоёр аяга хүйтэн цай'},
 '따뜻한 차 한 잔':{en:'one hot tea',mn:'нэг аяга халуун цай'},
 '따뜻한 물 세 잔':{en:'three cups of warm water',mn:'гурван аяга бүлээн ус'},
 '차가운 주스 두 잔':{en:'two cold juices',mn:'хоёр аяга хүйтэн шүүс'},
 '따뜻한 주스 두 잔':{en:'two warm juices',mn:'хоёр аяга бүлээн шүүс'},
 '차가운 차 한 잔':{en:'one iced tea',mn:'нэг аяга хүйтэн цай'},
 '밖으로 가져갈게요.':{en:'I’ll take it outside.',mn:'Авч явна.'},
 '음료를 주문하지 않을게요.':{en:'I won’t order a drink.',mn:'Уух зүйл захиалахгүй.'},
 '카페 안에서 마실게요.':{en:'I’ll drink it inside the café.',mn:'Кафе дотор ууна.'},
 '집으로 가져갈게요.':{en:'I’ll take it home.',mn:'Гэртээ авч харина.'},
 '컵을 돌려드릴게요.':{en:'I’ll give the cup back.',mn:'Аягаа буцааж өгье.'},
 '포장해 주세요.':{en:'To go, please.',mn:'Савлаж өгөөрэй. (авч явна)'},
 '여기서 마실게요.':{en:'I’ll drink it here.',mn:'Энд ууна.'},
 '따뜻하게 마실게요.':{en:'I’ll have it hot.',mn:'Халуунаар нь ууна.'},
 '잘 마셨습니다.':{en:'Thank you, I enjoyed it. (said after drinking)',mn:'Сайхан байлаа, баярлалаа. (уусны дараа хэлдэг)'},
 '따뜻한 차 네 잔':{en:'four hot teas',mn:'дөрвөн аяга халуун цай'},
 '차가운 물 네 잔':{en:'four cups of cold water',mn:'дөрвөн аяга хүйтэн ус'},
 '차가운 우유 두 잔':{en:'two cold milks',mn:'хоёр аяга хүйтэн сүү'},
 '따뜻한 차 두 잔':{en:'two hot teas',mn:'хоёр аяга халуун цай'},
 '따뜻한 우유 두 잔':{en:'two warm milks',mn:'хоёр аяга бүлээн сүү'},
 '카페 앞 벤치':{en:'the bench in front of the café',mn:'кафены урдах вандан сандал'},
 '카페 안':{en:'inside the café',mn:'кафе дотор'},
 '학교 교실':{en:'a classroom at school',mn:'сургуулийн анги'},
 '카페 창가':{en:'a window seat in the café',mn:'кафены цонхны дэргэдэх суудал'},
 '강가 벤치':{en:'a bench by the river',mn:'голын эрэг дээрх вандан сандал'},
 '집의 창가':{en:'by the window at home',mn:'гэрийн цонхны дэргэд'},
 '따뜻한 차 네 잔 주세요.':{en:'Four hot teas, please.',mn:'Дөрвөн аяга халуун цай өгөөрэй.'},
 '매장에서 마실게요.':{en:'I’ll have it here in the café.',mn:'Кафед ууна.'},
 '컵을 비워 주세요.':{en:'Please empty the cup.',mn:'Аяган доторх зүйлийг асгаж өгөөрэй.'},
 '차가운 주스 한 잔 주세요.':{en:'One cold juice, please.',mn:'Нэг аяга хүйтэн шүүс өгөөрэй.'},
 '차가운 주스 두 잔 주세요.':{en:'Two cold juices, please.',mn:'Хоёр аяга хүйтэн шүүс өгөөрэй.'},
 '따뜻한 주스 두 잔 주세요.':{en:'Two warm juices, please.',mn:'Хоёр аяга бүлээн шүүс өгөөрэй.'},
 '따뜻한 우유 한 잔 주세요.':{en:'One warm milk, please.',mn:'Нэг аяга бүлээн сүү өгөөрэй.'},
 '차가운 우유 한 잔 주세요.':{en:'One cold milk, please.',mn:'Нэг аяга хүйтэн сүү өгөөрэй.'},
 '따뜻한 차 두 잔 주세요.':{en:'Two hot teas, please.',mn:'Хоёр аяга халуун цай өгөөрэй.'},
 '아직 안 마셨어요.':{en:'I haven’t drunk it yet.',mn:'Хараахан уугаагүй байна.'},
 '아니요, 포장해 주세요.':{en:'No, to go, please.',mn:'Үгүй, савлаж өгөөрэй.'},
 '네, 여기서 마실게요.':{en:'Yes, I’ll drink it here.',mn:'Тийм, энд ууна.'},
 '네, 집에서 마실게요.':{en:'Yes, I’ll drink it at home.',mn:'Тийм, гэртээ ууна.'},
 '주문을 취소할게요.':{en:'I’ll cancel my order.',mn:'Захиалгаа цуцалъя.'},
 '컵은 필요 없어요.':{en:'I don’t need a cup.',mn:'Аяга хэрэггүй.'},
 '따뜻한 주스 한 잔 주세요.':{en:'One warm juice, please.',mn:'Нэг аяга бүлээн шүүс өгөөрэй.'},
 '따뜻한 차 한 잔 주세요.':{en:'One hot tea, please.',mn:'Нэг аяга халуун цай өгөөрэй.'},
 '차가운 차 한 잔 주세요.':{en:'One iced tea, please.',mn:'Нэг аяга хүйтэн цай өгөөрэй.'},
 '따뜻한 차 세 잔 주세요.':{en:'Three hot teas, please.',mn:'Гурван аяга халуун цай өгөөрэй.'},
 '차가운 우유 두 잔 주세요.':{en:'Two cold milks, please.',mn:'Хоёр аяга хүйтэн сүү өгөөрэй.'},
 '차가운 우유 세 잔 주세요.':{en:'Three cold milks, please.',mn:'Гурван аяга хүйтэн сүү өгөөрэй.'},
 '따뜻한 우유 세 잔 주세요.':{en:'Three warm milks, please.',mn:'Гурван аяга бүлээн сүү өгөөрэй.'},
 '네, 창가에서 마실게요.':{en:'Yes, I’ll drink it by the window.',mn:'Тийм, цонхны дэргэд ууна.'},
 '세 잔 주세요.':{en:'Three cups, please.',mn:'Гурван аяга өгөөрэй.'},
 '네, 두 잔 주세요.':{en:'Yes, two cups, please.',mn:'Тийм, хоёр аяга өгөөрэй.'},
 '아니요, 한 잔 주세요.':{en:'No, one cup, please.',mn:'Үгүй, нэг аяга өгөөрэй.'},
 '네, 한 잔 주세요.':{en:'Yes, one cup, please.',mn:'Тийм, нэг аяга өгөөрэй.'},
 '아니요, 두 잔 주세요.':{en:'No, two cups, please.',mn:'Үгүй, хоёр аяга өгөөрэй.'},
 '아니요, 세 잔 주세요.':{en:'No, three cups, please.',mn:'Үгүй, гурван аяга өгөөрэй.'},
 '취소해 주세요.':{en:'Please cancel it.',mn:'Миний захиалгыг цуцалж өгөөрэй.'},
 '주스 대신 따뜻한 차로 바꿔 주세요.':{en:'Please change the juice to hot tea instead.',mn:'Шүүсийг халуун цайгаар сольж өгөөрэй.'},
 '따뜻한 주스로 준비해 주세요.':{en:'Please make it a warm juice.',mn:'Бүлээн шүүс болгож өгөөрэй.'},
 '차가운 주스로 바꿔 주세요.':{en:'Please change it to cold juice.',mn:'Хүйтэн шүүсээр сольж өгөөрэй.'},
 '따뜻한 차로 준비해 주세요.':{en:'Please make it a hot tea.',mn:'Халуун цай болгож өгөөрэй.'},
 '차가운 차로 바꿔 주세요.':{en:'Please change it to iced tea.',mn:'Хүйтэн цайгаар сольж өгөөрэй.'},
 '차 대신 차가운 주스로 바꿔 주세요.':{en:'Please change the tea to cold juice instead.',mn:'Цайг хүйтэн шүүсээр сольж өгөөрэй.'},
 '한 잔 빼 주세요.':{en:'Please take one cup off.',mn:'Нэг аягыг нь хасаж өгөөрэй.'},
 '한 잔 더 주세요.':{en:'One more cup, please.',mn:'Дахиад нэг аяга өгөөрэй.'},
 '그대로 두 잔 주세요.':{en:'Keep it at two cups, please.',mn:'Тоог нь өөрчлөлгүй хоёр аяга өгөөрэй.'},
 '그대로 한 잔 주세요.':{en:'Keep it at one cup, please.',mn:'Тоог нь өөрчлөлгүй нэг аяга өгөөрэй.'},
 '그대로 매장에서 마실게요.':{en:'I’ll still have it here in the café.',mn:'Өөрчлөхгүй, энд ууна.'},
 '포장으로 바꿔 주세요.':{en:'Please change it to go.',mn:'Авч явахаар өөрчилж өгөөрэй.'},
 '매장 이용으로 바꿔 주세요.':{en:'Please change it to have here.',mn:'Энд уухаар өөрчилж өгөөрэй.'},
 '그대로 포장해 주세요.':{en:'Keep it to go, please.',mn:'Өөрчлөхгүй, авч явна.'},
 '주문 조건을 모두 맞췄어요.':{en:'The order matches everything.',mn:'Захиалга бүрэн зөв байна.'},
 '필요한 수량과 달라요.':{en:'It’s not the number of cups you need.',mn:'Аяганы тоо таарахгүй байна.'},
 '음료나 온도가 달라요.':{en:'The drink or the temperature is different.',mn:'Уух зүйл нь эсвэл халуун, хүйтний сонголт нь өөр байна.'},
 '따뜻한 주스 세 잔 주세요.':{en:'Three warm juices, please.',mn:'Гурван аяга бүлээн шүүс өгөөрэй.'},
 '차가운 차 두 잔 주세요.':{en:'Two iced teas, please.',mn:'Хоёр аяга хүйтэн цай өгөөрэй.'},
 '차가운 주스 세 잔 주세요.':{en:'Three cold juices, please.',mn:'Гурван аяга хүйтэн шүүс өгөөрэй.'},
 // 카페 팩 — 끝
 // 편의점 팩(11-25 「네, 이어가」) — 시작
 '이거 어디에 있어요?':{en:'Where is this?',mn:'Энэ хаана байдаг вэ?'},
 '이거 몇 개예요?':{en:'How many of these are there?',mn:'Энэ хэдэн ширхэг вэ?'},
 '이거 얼마예요?':{en:'How much is this?',mn:'Энэ ямар үнэтэй вэ?'},
 '이거 언제 먹어요?':{en:'When do you eat this?',mn:'Үүнийг хэзээ иддэг вэ?'},
 '이거 누구 거예요?':{en:'Whose is this?',mn:'Энэ хэний юм бэ?'},
 '물건의 가격':{en:'the price of an item',mn:'барааны үнэ'},
 '물건을 담을 봉투':{en:'a bag to carry your things',mn:'юм хийх уут'},
 '현금으로 결제하기':{en:'paying in cash',mn:'бэлнээр төлөх'},
 '봉투 하나 주세요.':{en:'One bag, please.',mn:'Нэг уут өгөөрэй.'},
 '우유 하나 더 주세요.':{en:'One more milk, please.',mn:'Дахиад нэг сүү өгөөрэй.'},
 '현금으로 계산할게요.':{en:'I’ll pay in cash.',mn:'Бэлнээр төлье.'},
 '카드로 내요.':{en:'You pay by card.',mn:'Картаар төлнө.'},
 '현금으로 내요.':{en:'You pay in cash.',mn:'Бэлнээр төлнө.'},
 '다음에 내요.':{en:'You pay next time.',mn:'Дараа төлнө.'},
 '내일 내요.':{en:'You pay tomorrow.',mn:'Маргааш төлнө.'},
 '2,000원':{en:'2,000 won',mn:'2,000 вон'},
 '1,000원':{en:'1,000 won',mn:'1,000 вон'},
 '3,000원':{en:'3,000 won',mn:'3,000 вон'},
 '3,500원':{en:'3,500 won',mn:'3,500 вон'},
 '1,500원':{en:'1,500 won',mn:'1,500 вон'},
 '라면과 물을 담으려고요.':{en:'To carry the ramen and water.',mn:'Рамён, усаа уутанд хийх гэсэн юм.'},
 '물을 사려고요.':{en:'To buy water.',mn:'Ус авах гэсэн юм.'},
 '카드로 계산하려고요.':{en:'To pay by card.',mn:'Картаар төлөх гэсэн юм.'},
 '가격표를 다시 읽어요.':{en:'You read the price tag again.',mn:'Үнийн шошгыг дахин уншина.'},
 '산 빵과 우유를 담아요.':{en:'You pack the bread and milk you bought.',mn:'Худалдаж авсан талх, сүүгээ уутанд хийнэ.'},
 '교통카드를 충전해요.':{en:'You top up your transit card.',mn:'Нийтийн тээврийн картаа цэнэглэнэ.'},
 '휴대폰으로 계산했어요.':{en:'Paid with a phone.',mn:'Утсаар төлсөн.'},
 '카드하고 현금으로 계산했어요.':{en:'Paid with a card and cash.',mn:'Карт болон бэлэн мөнгөөр төлсөн.'},
 '현금으로 계산했어요.':{en:'Paid in cash.',mn:'Бэлнээр төлсөн.'},
 '카드로 계산했어요.':{en:'Paid by card.',mn:'Картаар төлсөн.'},
 '이 도시락은 얼마예요?':{en:'How much is this lunch box?',mn:'Энэ савтай хоол ямар үнэтэй вэ?'},
 '이 도시락은 어디에서 만들어요?':{en:'Where is this lunch box made?',mn:'Энэ савтай хоолыг хаана бэлтгэдэг вэ?'},
 '이 도시락은 누가 만들어요?':{en:'Who makes this lunch box?',mn:'Энэ савтай хоолыг хэн бэлтгэдэг вэ?'},
 '우산은 누가 샀어요?':{en:'Who bought the umbrella?',mn:'Шүхрийг хэн авсан бэ?'},
 '우산은 얼마예요?':{en:'How much is the umbrella?',mn:'Шүхэр ямар үнэтэй вэ?'},
 '우산은 언제 써요?':{en:'When do you use the umbrella?',mn:'Шүхрийг хэзээ хэрэглэдэг вэ?'},
 '아니요, 괜찮아요.':{en:'No, I’m fine.',mn:'Үгүй ээ, зүгээр.'},
 '가격은 얼마예요?':{en:'What’s the price?',mn:'Үнэ нь хэд вэ?'},
 '네, 봉투 하나 주세요.':{en:'Yes, one bag, please.',mn:'Тийм ээ, нэг уут өгөөрэй.'},
 '네, 봉투 두 개 주세요.':{en:'Yes, two bags, please.',mn:'Тийм ээ, хоёр уут өгөөрэй.'},
 '카드로 계산할게요.':{en:'I’ll pay by card.',mn:'Картаар төлье.'},
 '나중에 계산할게요.':{en:'I’ll pay later.',mn:'Дараа төлье.'},
 '가격표를 붙여 주세요.':{en:'Please put a price tag on it.',mn:'Үнийн шошго нааж өгөөрэй.'},
 // 편의점 팩 — 끝
 // 길 팩(11-26 「네, 이어가」) — 시작
 '공원은 몇 시에 열어요?':{en:'What time does the park open?',mn:'Цэцэрлэгт хүрээлэн хэдэн цагт нээгддэг вэ?'},
 '공원이 어디에 있어요?':{en:'Where is the park?',mn:'Цэцэрлэгт хүрээлэн хаана байдаг вэ?'},
 '공원에는 나무가 많아요?':{en:'Are there many trees in the park?',mn:'Цэцэрлэгт хүрээлэнд мод олон байдаг уу?'},
 '화장실이 어디에 있어요?':{en:'Where is the restroom?',mn:'Ариун цэврийн өрөө хаана байдаг вэ?'},
 '화장실은 청소 중이에요?':{en:'Is the restroom being cleaned?',mn:'Ариун цэврийн өрөөг цэвэрлэж байна уу?'},
 '화장실은 깨끗해요?':{en:'Is the restroom clean?',mn:'Ариун цэврийн өрөө цэвэрхэн үү?'},
 '왼쪽':{en:'left',mn:'зүүн тал'},
 '뒤쪽':{en:'back',mn:'ар тал'},
 '오른쪽':{en:'right',mn:'баруун тал'},
 '은행 옆':{en:'next to the bank',mn:'банкны хажууд'},
 '은행 안':{en:'inside the bank',mn:'банк дотор'},
 '학교 뒤':{en:'behind the school',mn:'сургуулийн ард'},
 '학교 안':{en:'inside the school',mn:'сургууль дотор'},
 '은행 앞':{en:'in front of the bank',mn:'банкны урд'},
 '학교 옆':{en:'next to the school',mn:'сургуулийн хажууд'},
 '병원이 어디에 있어요?':{en:'Where is the hospital?',mn:'Эмнэлэг хаана байдаг вэ?'},
 '은행이 어디에 있어요?':{en:'Where is the bank?',mn:'Банк хаана байдаг вэ?'},
 '도서관이 어디에 있어요?':{en:'Where is the library?',mn:'Номын сан хаана байдаг вэ?'},
 '병원':{en:'hospital',mn:'эмнэлэг'},
 '시장':{en:'market',mn:'зах'},
 '은행':{en:'bank',mn:'банк'},
 '학교':{en:'school',mn:'сургууль'},
 '약국은 몇 시에 닫아요?':{en:'What time does the pharmacy close?',mn:'Эмийн сан хэдэн цагт хаадаг вэ?'},
 '약국이 어디에 있어요?':{en:'Where is the pharmacy?',mn:'Эмийн сан хаана байдаг вэ?'},
 '약국에서 약을 샀어요?':{en:'Did you buy medicine at the pharmacy?',mn:'Эмийн сангаас эм авсан уу?'},
 '지하철은 몇 시에 와요?':{en:'What time does the subway come?',mn:'Метро хэдэн цагт ирдэг вэ?'},
 '지하철 표는 얼마예요?':{en:'How much is a subway ticket?',mn:'Метроны тасалбар ямар үнэтэй вэ?'},
 '지하철역이 어디에 있어요?':{en:'Where is the subway station?',mn:'Метроны буудал хаана байдаг вэ?'},
 '병원 안에 있어요.':{en:'It’s inside the hospital.',mn:'Эмнэлэг дотор байдаг.'},
 '학교 뒤에 있어요.':{en:'It’s behind the school.',mn:'Сургуулийн ард байдаг.'},
 '병원 옆에 있어요.':{en:'It’s next to the hospital.',mn:'Эмнэлгийн хажууд байдаг.'},
 '학교 옆에 있어요.':{en:'It’s next to the school.',mn:'Сургуулийн хажууд байдаг.'},
 '학교 안에 있어요.':{en:'It’s inside the school.',mn:'Сургууль дотор байдаг.'},
 '은행 뒤에 있어요.':{en:'It’s behind the bank.',mn:'Банкны ард байдаг.'},
 '오른쪽으로 가세요.':{en:'Go right.',mn:'Баруун тийш яваарай.'},
 '은행 옆에 있어요.':{en:'It’s next to the bank.',mn:'Банкны хажууд байдаг.'},
 // 길 팩 — 끝
 // 버스 팩(11-26 저녁 「네, 이어가」) — 시작
 '이 버스는 공원에 가요?':{en:'Does this bus go to the park?',mn:'Энэ автобус цэцэрлэгт хүрээлэн рүү явдаг уу?'},
 '이 버스는 도서관에 가요?':{en:'Does this bus go to the library?',mn:'Энэ автобус номын сан руу явдаг уу?'},
 '지금 정류장에서 내려요.':{en:'Get off at this stop now.',mn:'Одоо зогсож байгаа буудал дээр бууна.'},
 '한 정류장 더 가서 내려요.':{en:'Ride one more stop, then get off.',mn:'Дахиад нэг буудал яваад бууна.'},
 '한 정류장 더 가요.':{en:'Ride one more stop.',mn:'Дахиад нэг буудал явна.'},
 '지금 내려요.':{en:'Get off now.',mn:'Одоо бууна.'},
 '버스를 다시 타요.':{en:'Get on the bus again.',mn:'Автобусанд дахин сууна.'},
 '교통카드를 카드 기계에 대요.':{en:'Hold the transit card to the card machine.',mn:'Нийтийн тээврийн картаа уншуулна.'},
 '교통카드 사진을 찍어요.':{en:'Take a photo of the transit card.',mn:'Нийтийн тээврийн картынхаа зургийг авна.'},
 '학교':{en:'school',mn:'сургууль'},
 '도서관':{en:'library',mn:'номын сан'},
 '꽃길 공원':{en:'Kkotgil Park',mn:'Коткил цэцэрлэгт хүрээлэн'},
 '마루 도서관':{en:'Maru Library',mn:'Мару номын сан'},
 '마루 카페':{en:'Maru Café',mn:'Мару кафе'},
 '한 정류장 더 갔어요.':{en:'They rode one more stop.',mn:'Дахиад нэг буудал явсан.'},
 '도서관에서 내렸어요.':{en:'They got off at the library.',mn:'Номын сангийн буудал дээр буусан.'},
 '두 정류장 더 갔어요.':{en:'They rode two more stops.',mn:'Дахиад хоёр буудал явсан.'},
 '학교에서 내려요.':{en:'Get off at the school.',mn:'Сургуулийн буудал дээр бууна.'},
 '다음 정류장에서 내려요.':{en:'Get off at the next stop.',mn:'Дараагийн буудал дээр бууна.'},
 '기사님에게 교통카드를 줬어요.':{en:'They gave their transit cards to the driver.',mn:'Нийтийн тээврийн картаа жолоочид өгсөн.'},
 '카드 기계에 교통카드를 댔어요.':{en:'They held their transit cards to the card machine.',mn:'Нийтийн тээврийн картаа уншуулсан.'},
 '도서관에서 교통카드를 샀어요.':{en:'They bought transit cards at the library.',mn:'Номын сангаас нийтийн тээврийн карт худалдаж авсан.'},
 '이 버스는 병원에 가요?':{en:'Does this bus go to the hospital?',mn:'Энэ автобус эмнэлэг рүү явдаг уу?'},
 '이 버스는 학교에 가요?':{en:'Does this bus go to school?',mn:'Энэ автобус сургууль руу явдаг уу?'},
 '이번 정류장에서 내려요.':{en:'Get off at this stop.',mn:'Энэ буудал дээр бууна.'},
 '시장에서 기다려요.':{en:'Wait at the market.',mn:'Зах дээр хүлээнэ.'},
 '카드 사진을 찍고 들어가요.':{en:'Take a photo of the card and go in.',mn:'Картынхаа зургийг аваад орно.'},
 '카드를 카드 기계에 대고 들어가요.':{en:'Hold the card to the card machine and go in.',mn:'Картаа уншуулаад орно.'},
 '내리기 전에 카드를 카드 기계에 대요.':{en:'Hold the card to the card machine before getting off.',mn:'Буухын өмнө картаа уншуулна.'},
 '이 버스는 몇 시에 와요?':{en:'What time does this bus come?',mn:'Энэ автобус хэдэн цагт ирдэг вэ?'},
 '공원에서 버스를 타요?':{en:'Do you get on the bus at the park?',mn:'Цэцэрлэгт хүрээлэнгээс автобусанд суудаг уу?'},
 '이 버스는 어디에서 타요?':{en:'Where do you get on this bus?',mn:'Энэ автобусанд хаанаас суух вэ?'},
 '도서관 앞에서 버스를 기다려요?':{en:'Do you wait for the bus in front of the library?',mn:'Номын сангийн өмнө автобус хүлээх үү?'},
 '두 정류장 더 가서 내려요.':{en:'Ride two more stops, then get off.',mn:'Дахиад хоёр буудал яваад бууна.'},
 '교통카드를 기사님께 드려요.':{en:'Give the transit card to the driver.',mn:'Нийтийн тээврийн картаа жолоочид өгнө.'},
 '내릴 때 카드를 가방에 넣어요.':{en:'Put the card in your bag when you get off.',mn:'Буухдаа картаа цүнхэндээ хийнэ.'},
 '내릴 때 교통카드 사진을 찍어요.':{en:'Take a photo of the transit card when you get off.',mn:'Буухдаа нийтийн тээврийн картынхаа зургийг авна.'},
 '내릴 때 카드 기계에 카드를 대요.':{en:'Hold the card to the card machine when you get off.',mn:'Буухдаа картаа уншуулна.'},
 '탈 때 카드 사진을 찍어요.':{en:'Take a photo of the card when you get on.',mn:'Суухдаа картынхаа зургийг авна.'},
 '탈 때 역 직원에게 카드를 줘요.':{en:'Give the card to a station worker when you get on.',mn:'Суухдаа картаа метроны ажилтанд өгнө.'},
 '탈 때 카드를 카드 기계에 대요.':{en:'Hold the card to the card machine when you get on.',mn:'Суухдаа картаа уншуулна.'},
 '이 버스는 언제 와요?':{en:'When does this bus come?',mn:'Энэ автобус хэзээ ирэх вэ?'},
 '병원에서 버스를 타요?':{en:'Do you get on the bus at the hospital?',mn:'Эмнэлгээс автобусанд суудаг уу?'},
 '내리기 전에 카드 사진을 찍어요.':{en:'Take a photo of the card before getting off.',mn:'Буухын өмнө картынхаа зургийг авна.'},
 '내린 뒤에 카드를 카드 기계에 대요.':{en:'Hold the card to the card machine after getting off.',mn:'Буусны дараа картаа уншуулна.'},
 '카드를 가방에 넣고 들어가요.':{en:'Put the card in your bag and go in.',mn:'Картаа цүнхэндээ хийгээд орно.'},
 '버스 정류장이 어디에 있어요?':{en:'Where is the bus stop?',mn:'Автобусны буудал хаана байна вэ?'},
 '교통카드를 찍으세요.':{en:'Tap your transit card.',mn:'Нийтийн тээврийн картаа уншуулна уу.'},
 // 버스 팩 — 끝
 // 약속 팩(11-27 「남은거 있으면 이어서해」) — 시작
 '오늘 오후 세 시':{en:'today at 3 p.m.',mn:'өнөөдөр өдрийн гурван цаг'},
 '내일 오후 세 시':{en:'tomorrow at 3 p.m.',mn:'маргааш өдрийн гурван цаг'},
 '내일 오전 세 시':{en:'tomorrow at 3 a.m.',mn:'маргааш шөнийн гурван цаг'},
 '토요일 오전 세 시':{en:'Saturday at 3 a.m.',mn:'бямба гарагт шөнийн гурван цагт'},
 '금요일 오후 세 시':{en:'Friday at 3 p.m.',mn:'баасан гарагт өдрийн гурван цагт'},
 '토요일 오후 세 시':{en:'Saturday at 3 p.m.',mn:'бямба гарагт өдрийн гурван цагт'},
 '내일 오전 열 시':{en:'tomorrow at 10 a.m.',mn:'маргааш өглөөний арван цаг'},
 '오늘 오후 열 시':{en:'today at 10 p.m.',mn:'өнөөдөр оройн арван цаг'},
 '오늘 오전 열 시':{en:'today at 10 a.m.',mn:'өнөөдөр өглөөний арван цаг'},
 '만날 장소':{en:'the place to meet',mn:'уулзах газар'},
 '만날 날짜':{en:'the day to meet',mn:'уулзах өдөр'},
 '만날 사람':{en:'the person to meet',mn:'уулзах хүн'},
 '내일 만나요.':{en:'See you tomorrow.',mn:'Маргааш уулзъя.'},
 '학교 앞에서 만나요.':{en:'Let’s meet in front of the school.',mn:'Сургуулийн урд уулзъя.'},
 '오후 두 시에 만나요.':{en:'Let’s meet at 2 p.m.',mn:'Өдрийн хоёр цагт уулзъя.'},
 '약속을 정하지 않겠다는 연락':{en:'a message saying you won’t make plans',mn:'уулзалт товлохгүй гэсэн мессеж'},
 '일찍 도착했다는 연락':{en:'a message saying you arrived early',mn:'эрт ирсэн гэсэн мессеж'},
 '약속 시간보다 늦을 것 같다는 연락':{en:'a message saying you may be later than the meeting time',mn:'товлосон цагаас хоцрох юм шиг байна гэсэн мессеж'},
 '조금 늦을 것 같아요.':{en:'I think I’ll be a little late.',mn:'Жаахан хоцрох юм шиг байна.'},
 '벌써 도착했어요.':{en:'I’ve already arrived.',mn:'Аль хэдийн ирчихлээ.'},
 '일찍 왔어요.':{en:'I came early.',mn:'Эрт ирлээ.'},
 '토요일 오후 열한 시':{en:'Saturday at 11 p.m.',mn:'бямба гарагт шөнийн арван нэгэн цагт'},
 '토요일 오전 열한 시':{en:'Saturday at 11 a.m.',mn:'бямба гарагт өглөөний арван нэгэн цагт'},
 '일요일 오전 열한 시':{en:'Sunday at 11 a.m.',mn:'ням гарагт өглөөний арван нэгэн цагт'},
 '도서관 앞 벤치':{en:'the bench in front of the library',mn:'номын сангийн урдах вандан сандал'},
 '도서관 안 교실':{en:'a classroom inside the library',mn:'номын сан доторх анги'},
 '도서관 뒤 벤치':{en:'the bench behind the library',mn:'номын сангийн арын вандан сандал'},
 '공원 안 벤치':{en:'a bench inside the park',mn:'цэцэрлэгт хүрээлэн доторх вандан сандал'},
 '도서관 입구':{en:'the library entrance',mn:'номын сангийн орох хаалга'},
 '공원 입구':{en:'the park entrance',mn:'цэцэрлэгт хүрээлэнгийн орох хаалга'},
 '음료수를 사러 갔어요.':{en:'They went to buy drinks.',mn:'Ундаа авахаар явсан.'},
 '도서관 앞에서 기다렸어요.':{en:'They waited in front of the library.',mn:'Номын сангийн урд хүлээсэн.'},
 '먼저 도서관 안에 들어갔어요.':{en:'They went into the library first.',mn:'Түрүүлээд номын сан руу орсон.'},
 '아직 도착 전이고 늦을 것 같아요.':{en:'They haven’t arrived yet and will probably be late.',mn:'Хараахан ирээгүй, хоцрох юм шиг байна.'},
 '벌써 약속 장소에 도착했어요.':{en:'They have already arrived at the meeting place.',mn:'Уулзах газартаа аль хэдийн ирчихсэн.'},
 '약속이 취소됐어요.':{en:'The plan was cancelled.',mn:'Уулзалт цуцлагдсан.'},
 '내일 오후 두 시':{en:'tomorrow at 2 p.m.',mn:'маргааш өдрийн хоёр цаг'},
 '오늘 오후 두 시':{en:'today at 2 p.m.',mn:'өнөөдөр өдрийн хоёр цаг'},
 '내일 오전 두 시':{en:'tomorrow at 2 a.m.',mn:'маргааш шөнийн хоёр цаг'},
 '내일 오후 다섯 시':{en:'tomorrow at 5 p.m.',mn:'маргааш оройн таван цаг'},
 '오늘 오전 다섯 시':{en:'today at 5 a.m.',mn:'өнөөдөр үүрийн таван цаг'},
 '오늘 오후 다섯 시':{en:'today at 5 p.m.',mn:'өнөөдөр оройн таван цаг'},
 '역 안':{en:'inside the station',mn:'буудал дотор'},
 '역 뒤':{en:'behind the station',mn:'буудлын ард'},
 '역 앞':{en:'in front of the station',mn:'буудлын урд'},
 '학교 앞':{en:'in front of the school',mn:'сургуулийн урд'},
 '일찍 도착했어요.':{en:'I arrived early.',mn:'Эрт ирчихлээ.'},
 '십 분 늦을 것 같아요.':{en:'I think I’ll be ten minutes late.',mn:'Арван минут хоцрох юм шиг байна.'},
 '십 분 일찍 도착할 것 같아요.':{en:'I think I’ll arrive ten minutes early.',mn:'Арван минут эрт очих юм шиг байна.'},
 '약속 시간에 도착할 것 같아요.':{en:'I think I’ll arrive on time.',mn:'Товлосон цагтаа очих юм шиг байна.'},
 '내일 오후 세 시에 만나요.':{en:'Let’s meet tomorrow at 3 p.m.',mn:'Маргааш өдрийн гурван цагт уулзъя.'},
 '어디에서 만날까요?':{en:'Where shall we meet?',mn:'Хаана уулзах вэ?'},
 // 약속 팩 — 끝
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
 'cafe-expressions-order':{a:note('차가운 차 두 잔','주문은 따뜻한 차 한 잔이에요. 이것은 차가운 차 두 잔이에요.','The order is one cup of hot tea. This is two cups of iced tea.','Захиалга нь нэг аяга халуун цай. Энэ бол хоёр аяга хүйтэн цай.'),c:note('따뜻한 물 세 잔','주문은 따뜻한 차 한 잔이에요. 이것은 따뜻한 물 세 잔이에요.','The order is one cup of hot tea. This is three cups of warm water.','Захиалга нь нэг аяга халуун цай. Энэ бол гурван аяга бүлээн ус.')},
 'cafe-expressions-order-transfer':{b:note('따뜻한 주스 두 잔','주문은 차가운 주스 두 잔이에요. 이것은 따뜻한 주스예요.','The order is two cups of cold juice. This is warm juice.','Захиалга нь хоёр аяга хүйтэн шүүс. Энэ бол бүлээн шүүс.'),c:note('차가운 차 한 잔','주문은 차가운 주스 두 잔이에요. 이것은 차가운 차 한 잔이에요.','The order is two cups of cold juice. This is one cup of iced tea.','Захиалга нь хоёр аяга хүйтэн шүүс. Энэ бол нэг аяга хүйтэн цай.')},
 'cafe-expressions-here':{a:note('밖으로 가져갈게요.','음료를 가지고 밖으로 나가겠다는 말이에요.','This means you will take your drink outside.','Уух зүйлээ авч гарна гэсэн үг.'),b:note('음료를 주문하지 않을게요.','음료를 사지 않겠다는 말이에요.','This means you will not buy a drink.','Юу ч захиалахгүй гэсэн үг.')},
 'cafe-expressions-here-transfer':{a:note('집으로 가져갈게요.','음료를 가지고 집에 가겠다는 말이에요.','This means you will take your drink home.','Уух зүйлээ гэртээ авч явна гэсэн үг.'),c:note('컵을 돌려드릴게요.','다 마신 컵을 직원에게 줄 때 하는 말이에요.','You say this when you give your empty cup back to the staff.','Хоосон аягаа ажилтанд буцааж өгөхдөө хэлдэг үг.')},
 'cafe-expressions-takeout':{b:note('여기서 마실게요.','카페 안에서 마실 때 하는 말이에요.','You say this when you will drink inside the café.','Кафе дотор уух бол ингэж хэлнэ.'),c:note('따뜻하게 마실게요.','음료를 따뜻하게 마시겠다는 말이에요. 가지고 나갈지 묻는 말의 답이 아니에요.','This means you will drink it warm. It does not say whether you will take it out.','Халуунаар нь ууна гэсэн үг. Авч явах уу гэсэн асуултын хариулт биш.')},
 'cafe-expressions-takeout-transfer':{a:note('여기서 마실게요.','카페 안에서 마실 때 하는 말이에요.','You say this when you will drink inside the café.','Кафе дотор уух бол ингэж хэлнэ.'),b:note('잘 마셨습니다.','다 마신 뒤에 고마움을 전하는 말이에요.','You say this to thank someone after you finish your drink.','Ууж дууссаны дараа талархлаа илэрхийлэх үг.')},
 'cafe-story-order':{b:note('차가운 물 네 잔','지호는 물이 아니라 따뜻한 차를 주문했어요.','Jiho ordered hot tea, not water.','Жихо ус биш, халуун цай захиалсан.'),c:note('따뜻한 차 한 잔','네 사람이 한 잔씩 마셔서 네 잔이에요.','Four people each have a cup, so it is four cups.','Дөрвөн хүн тус бүр нэг аяга уух тул дөрвөн аяга захиалсан.')},
 'cafe-story-order-transfer':{a:note('차가운 우유 두 잔','주문표에는 따뜻한 우유가 있어요. 이것은 차가운 우유예요.','The order slip says warm milk. This is cold milk.','Захиалгын хуудсанд бүлээн сүү гэж бичсэн байна. Энэ бол хүйтэн сүү.'),b:note('따뜻한 차 두 잔','주문표에는 우유가 있어요. 이것은 차예요.','The order slip says milk. This is tea.','Захиалгын хуудсанд сүү гэж бичсэн байна. Энэ бол цай.')},
 'cafe-story-here':{a:note('카페 앞 벤치','처음에는 카페 안이었어요. 벤치에는 나중에 갔어요.','At first you were inside the café. You went to the bench later.','Эхлээд бид кафе дотор байсан. Дараа нь вандан сандал руу явсан.'),c:note('학교 교실','이야기에서 우리는 교실에 가지 않아요. 지호는 이 말을 카페에서 했어요.','You don’t go to a classroom in the story. Jiho said this in the café.','Бид анги руу яваагүй. Жихо энэ үгийг кафе дотор хэлсэн.')},
 'cafe-story-here-transfer':{b:note('강가 벤치','‘카페 안’이라고 했어요. 벤치는 카페 밖이에요.','It says ‘카페 안’ (inside the café). A bench is outside.','«카페 안» буюу кафе дотор гэж хэлсэн. Вандан сандал кафены гадна байдаг.'),c:note('집의 창가','카페 창가예요. 집이 아니에요.','It is a window seat in the café, not at home.','Энэ бол гэрийн биш, кафе доторх цонхны дэргэдэх суудал.')},
 'cafe-story-takeout':{a:note('여기서 마실게요.','지호가 처음에 한 말이에요. 카페 안에서 마실 때 하는 말이에요.','Jiho said this first. You say it when you will drink inside the café.','Жихо үүнийг эхэлж хэлсэн. Кафе дотор уух бол ингэж хэлнэ.'),b:note('따뜻한 차 네 잔 주세요.','지호가 처음에 주문할 때 한 말이에요.','Jiho said this first, when he ordered.','Жихогийн анх захиалахдаа хэлсэн үг.')},
 'cafe-story-takeout-transfer':{b:note('매장에서 마실게요.','‘매장’은 카페 안이에요. 카페 안에서 마실 때 하는 말이에요.','‘매장’ means inside the café. You say this when you will drink there.','«매장» гэдэг нь кафе дотор гэсэн үг. Кафе дотор уух бол ингэж хэлнэ.'),c:note('컵을 비워 주세요.','컵 안에 있는 것을 버려 달라는 말이에요.','This asks someone to empty the cup.','Аяган доторх зүйлийг асгаж өгөөч гэж гуйх үг.')},
 'cafe-apply-order':{a:note('차가운 주스 한 잔 주세요.','한 사람이 마실 때의 주문이에요. 둘이 한 잔씩이면 두 잔이에요.','This is an order for one person. Two people having one cup each need two cups.','Нэг хүний захиалга. Хоёр хүн тус бүр нэг аяга уух бол хоёр аяга захиална.'),c:note('따뜻한 주스 두 잔 주세요.','따뜻한 주스예요. 우리는 차가운 주스를 마시고 싶어요.','This is warm juice. You want cold juice.','Энэ бол бүлээн шүүс. Бид хүйтэн шүүс уумаар байна.')},
 'cafe-apply-order-transfer':{b:note('차가운 우유 한 잔 주세요.','차가운 우유예요. 따뜻한 우유를 주문해요.','This is cold milk. You are ordering warm milk.','Энэ бол хүйтэн сүү. Бүлээн сүү захиалах хэрэгтэй.'),c:note('따뜻한 차 두 잔 주세요.','음료도 잔 수도 달라요. 우유 한 잔이에요.','Both the drink and the number of cups are different. It is one cup of milk.','Уух зүйл ч, аяганы тоо ч өөр. Нэг аяга сүү хэрэгтэй.')},
 'cafe-apply-here':{a:note('포장해 주세요.','음료를 가지고 밖으로 나갈 때 하는 말이에요.','You say this when you take your drink out of the café.','Уух зүйлээ авч явахдаа хэлдэг үг.'),b:note('아직 안 마셨어요.','음료를 아직 마시지 않았다는 말이에요. 어디에서 마실지 묻는 말의 답이 아니에요.','This means you haven’t drunk it yet. It does not say where you will drink.','Хараахан уугаагүй гэсэн үг. Хаана уух вэ гэсэн асуултын хариулт биш.')},
 'cafe-apply-here-transfer':{a:note('아니요, 포장해 주세요.','카페에서 마시지 않고 가지고 나갈 때 하는 대답이에요.','This is the answer when you will take your drink out instead of drinking in the café.','Кафед уухгүй, авч явах бол ингэж хариулна.'),c:note('네, 집에서 마실게요.','‘매장’은 카페 안이에요. 집에서 마시는 것과 맞지 않아요.','‘매장’ means inside the café, so drinking at home does not fit.','«매장» гэдэг нь кафе дотор гэсэн үг. Тиймээс гэртээ уух гэсэн хариулт таарахгүй.')},
 'cafe-apply-takeout':{b:note('매장에서 마실게요.','‘매장’은 카페 안이에요. 카페 안에서 마실 때 하는 말이에요.','‘매장’ means inside the café. You say this when you will drink there.','«매장» гэдэг нь кафе дотор гэсэн үг. Кафе дотор уух бол ингэж хэлнэ.'),c:note('주문을 취소할게요.','주문을 그만둘 때 하는 말이에요.','You say this when you want to stop your order.','Захиалгаа цуцлахдаа хэлдэг үг.')},
 'cafe-apply-takeout-transfer':{a:note('여기서 마실게요.','카페 안에서 마실 때 하는 말이에요.','You say this when you will drink inside the café.','Кафе дотор уух бол ингэж хэлнэ.'),b:note('컵은 필요 없어요.','컵을 받지 않겠다는 말이에요.','This means you don’t need a cup.','Аяга хэрэггүй гэсэн үг.')},
 'cafe-visit-taste-drink':{a:note('따뜻한 주스 한 잔 주세요.','태오는 주스가 아니라 차를 마시고 싶어요.','Taeo wants tea, not juice.','Тэо шүүс биш, цай уухыг хүсэж байна.'),c:note('차가운 주스 한 잔 주세요.','차가운 주스예요. 태오는 따뜻한 차를 마시고 싶어요.','This is cold juice. Taeo wants hot tea.','Энэ бол хүйтэн шүүс. Тэо халуун цай уухыг хүсэж байна.')},
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
 'cafe-visit-change-drink-transfer':{a:note('따뜻한 차로 준비해 주세요.','차를 그대로 두는 말이에요. 주스로 바꾸는 말이 아니에요.','This keeps the tea. It does not change it to juice.','Цайгаа хэвээр нь авна гэсэн үг. Шүүс болгож өөрчлөхгүй.'),b:note('차가운 차로 바꿔 주세요.','차가운 차로 바꾸는 말이에요. 주스로 바꾸는 말이 아니에요.','This changes it to iced tea, not to juice.','Хүйтэн цай болгож өгөөч гэсэн үг. Шүүс болгож өөрчлөхгүй.')},
 'cafe-visit-change-count':{a:note('한 잔 빼 주세요.','잔 수를 하나 줄일 때 하는 말이에요.','You say this to take one cup off the order.','Аяганы тоог нэгээр хасахдаа хэлдэг үг.'),c:note('그대로 두 잔 주세요.','잔 수를 바꾸지 않을 때 하는 말이에요.','You say this when you keep the same number of cups.','Аяганы тоог өөрчлөхгүй үед хэлдэг үг.')},
 'cafe-visit-change-count-transfer':{a:note('한 잔 빼 주세요.','잔 수를 하나 줄일 때 하는 말이에요.','You say this to take one cup off the order.','Аяганы тоог нэгээр хасахдаа хэлдэг үг.'),c:note('그대로 한 잔 주세요.','잔 수를 바꾸지 않을 때 하는 말이에요.','You say this when you keep the same number of cups.','Аяганы тоог өөрчлөхгүй үед хэлдэг үг.')},
 'cafe-visit-change-place':{a:note('그대로 매장에서 마실게요.','처음 정한 대로 카페 안에서 마신다는 말이에요.','This means you will still drink inside the café, as first planned.','Анх төлөвлөсөн ёсоороо кафе дотор ууна гэсэн үг.'),b:note('주문을 취소할게요.','주문을 그만둘 때 하는 말이에요.','You say this when you want to stop your order.','Захиалгаа цуцлахдаа хэлдэг үг.')},
 'cafe-visit-change-place-transfer':{b:note('그대로 포장해 주세요.','처음 정한 대로 가지고 나간다는 말이에요.','This means you will still take it out, as first planned.','Анх төлөвлөсөн ёсоороо авч явна гэсэн үг.'),c:note('주문을 취소할게요.','주문을 그만둘 때 하는 말이에요.','You say this when you want to stop your order.','Захиалгаа цуцлахдаа хэлдэг үг.')},
 'cafe-compose-order-transfer':{a:note('따뜻한 주스 세 잔 주세요.','따뜻한 주스예요. 세 사람은 차가운 주스를 마셔요.','This is warm juice. The three of them are having cold juice.','Энэ бол бүлээн шүүс. Тэр гурав хүйтэн шүүс ууна.'),b:note('차가운 차 두 잔 주세요.','음료도 잔 수도 달라요. 차가운 주스 세 잔이에요.','Both the drink and the number of cups are different. It is three cups of cold juice.','Уух зүйл ч, аяганы тоо ч өөр. Гурван аяга хүйтэн шүүс хэрэгтэй.')},
 'cafe-compose-count':{a:note('아니요, 한 잔 주세요.','한 잔이 필요할 때 고쳐 말하는 대답이에요.','This is how you correct the order when you need one cup.','Нэг аяга хэрэгтэй бол ингэж засаж хэлнэ.'),c:note('아니요, 세 잔 주세요.','세 잔이 필요할 때 고쳐 말하는 대답이에요.','This is how you correct the order when you need three cups.','Гурван аяга хэрэгтэй бол ингэж засаж хэлнэ.')},
 'cafe-compose-count-transfer':{a:note('네, 두 잔 주세요.','직원이 말한 두 잔이 맞을 때 하는 대답이에요.','This is the answer when the two cups the staff said are right.','Ажилтан «хоёр аяга» гэж хэлсэн нь зөв бол ингэж хариулна.'),c:note('아니요, 세 잔 주세요.','세 잔이 필요할 때 고쳐 말하는 대답이에요.','This is how you correct the order when you need three cups.','Гурван аяга хэрэгтэй бол ингэж засаж хэлнэ.')},
 'cafe-compose-place':{b:note('아니요, 포장해 주세요.','카페에서 마시지 않고 가지고 나갈 때 하는 대답이에요.','This is the answer when you will take your drink out instead of drinking in the café.','Кафед уухгүй, авч явах бол ингэж хариулна.'),c:note('주문을 취소할게요.','주문을 그만둘 때 하는 말이에요.','You say this when you want to stop your order.','Захиалгаа цуцлахдаа хэлдэг үг.')},
 'cafe-compose-place-transfer':{a:note('네, 여기서 마실게요.','카페 안에서 마실 때 하는 대답이에요.','This is the answer when you will drink inside the café.','Кафе дотор уух бол ингэж хариулна.'),b:note('네, 창가에서 마실게요.','카페 창가에서 마실 때 하는 대답이에요.','This is the answer when you will drink at a window seat in the café.','Кафед цонхны дэргэд сууж уух бол ингэж хариулна.')},
 // 편의점 팩(11-25 「네, 이어가」) — 시작
 'store-expressions-price':{a:note('이거 어디에 있어요?','물건이 있는 곳을 물을 때 하는 말이에요.','You say this to ask where something is.','Энэ бол ямар нэг зүйл хаана байгааг асуудаг өгүүлбэр.'),b:note('이거 몇 개예요?','물건의 수를 물을 때 하는 말이에요. 가격을 묻는 말이 아니에요.','You say this to ask how many there are. It does not ask the price.','Энэ бол хэдэн ширхэг байгааг асуудаг өгүүлбэр. Үнэ асуудаг өгүүлбэр биш.')},
 'store-expressions-price-transfer':{b:note('이거 언제 먹어요?','먹는 때를 물을 때 하는 말이에요.','You say this to ask when to eat something.','Энэ бол хэзээ идэхийг асуудаг өгүүлбэр.'),c:note('이거 누구 거예요?','물건의 주인을 물을 때 하는 말이에요.','You say this to ask who something belongs to.','Энэ бол хэний юм болохыг асуудаг өгүүлбэр.')},
 'store-expressions-bag':{a:note('물건의 가격','가격은 ‘이거 얼마예요?’로 물어요.','You ask the price with ‘이거 얼마예요?’','Үнийг «이거 얼마예요?» гэж асууна.'),c:note('현금으로 결제하기','현금으로 낼 때는 ‘현금으로 계산할게요.’라고 해요.','To pay in cash, you say ‘현금으로 계산할게요.’','Бэлнээр төлөх бол «현금으로 계산할게요.» гэж хэлнэ.')},
 'store-expressions-bag-transfer':{b:note('우유 하나 더 주세요.','우유를 하나 더 살 때 하는 말이에요.','You say this when you want one more milk.','Дахиад нэг сүү авах бол ингэж хэлнэ.'),c:note('현금으로 계산할게요.','현금으로 값을 낼 때 하는 말이에요.','You say this when you pay in cash.','Бэлнээр төлөхдөө хэлдэг үг.')},
 'store-expressions-card':{b:note('현금으로 내요.','지폐나 동전으로 낼 때예요. 그때는 ‘현금으로 계산할게요.’라고 해요.','This is paying with bills or coins. For that, you say ‘현금으로 계산할게요.’','Цаасан мөнгө эсвэл зоосоор төлөх бол «현금으로 계산할게요.» гэж хэлнэ.'),c:note('다음에 내요.','지금 내지 않고 나중에 낸다는 뜻이에요.','This means you will not pay now but later.','Одоо биш, дараа төлнө гэсэн утгатай.')},
 'store-expressions-card-transfer':{a:note('카드로 내요.','카드로 낼 때는 ‘카드로 계산할게요.’라고 해요.','To pay by card, you say ‘카드로 계산할게요.’','Картаар төлөх бол «카드로 계산할게요.» гэж хэлнэ.'),b:note('내일 내요.','오늘 내지 않고 내일 낸다는 뜻이에요.','This means you will pay tomorrow, not today.','Өнөөдөр биш, маргааш төлнө гэсэн утгатай.')},
 'store-story-price':{a:note('2,000원','2,000원은 라면의 가격이에요.','2,000 won is the price of the ramen.','2,000 вон бол рамёны үнэ.'),c:note('3,000원','3,000원은 라면하고 물을 더한 값이에요.','3,000 won is the ramen and the water added together.','3,000 вон бол рамён, ус хоёрын нийт үнэ.')},
 'store-story-price-transfer':{a:note('2,000원','2,000원은 빵 한 개의 가격이에요.','2,000 won is the price of one bread.','2,000 вон бол нэг талхны үнэ.'),b:note('3,500원','3,500원은 우유하고 빵을 더한 값이에요.','3,500 won is the milk and the bread added together.','3,500 вон бол сүү, талх хоёрын нийт үнэ.')},
 'store-story-bag':{b:note('물을 사려고요.','물을 사자고 한 사람은 서하예요. 지호는 산 물건을 담으려고 봉투를 부탁했어요.','Seoha is the one who said to buy water. Jiho asked for a bag to carry what they bought.','Ус авъя гэсэн хүн бол Сөха. Жихо худалдаж авсан юмаа хийх уут авахыг хүссэн.'),c:note('카드로 계산하려고요.','카드로 계산한 사람은 태오예요. 지호는 봉투를 부탁했어요.','Taeo is the one who paid by card. Jiho asked for a bag.','Картаар төлсөн хүн бол Тэо. Жихо уут авахыг хүссэн.')},
 'store-story-bag-transfer':{a:note('가격표를 다시 읽어요.','가격을 볼 때예요. 봉투는 필요 없어요.','This is when you check a price. You don’t need a bag for that.','Үнэ харах үед уут хэрэггүй.'),c:note('교통카드를 충전해요.','교통카드에 돈을 넣을 때예요. 봉투는 필요 없어요.','This is when you add money to a transit card. You don’t need a bag for that.','Нийтийн тээврийн картаа цэнэглэх үед уут хэрэггүй.')},
 'store-story-card':{a:note('휴대폰으로 계산했어요.','태오는 휴대폰이 아니라 카드를 냈어요.','Taeo used a card, not his phone.','Тэо утсаар биш, картаар төлсөн.'),b:note('현금으로 계산했어요.','태오는 현금을 내지 않았어요. ‘카드로 계산할게요.’라고 했어요.','Taeo didn’t hand over any cash. He said ‘카드로 계산할게요.’','Тэо бэлэн мөнгө өгөөгүй. «카드로 계산할게요.» гэж хэлсэн.')},
 'store-story-card-transfer':{b:note('카드로 계산했어요.','서하는 오늘 카드가 없어요. 그래서 ‘현금으로’라고 했어요.','Seoha doesn’t have her card today. That’s why she said ‘현금으로’ (in cash).','Сөха өнөөдөр картгүй байсан. Тиймээс «현금으로» (бэлнээр) гэж хэлсэн.'),c:note('카드하고 현금으로 계산했어요.','서하는 카드를 쓰지 않았어요. 현금만 냈어요.','Seoha didn’t use a card. She only paid in cash.','Сөха карт ашиглаагүй. Зөвхөн бэлэн мөнгө өгсөн.')},
 'store-apply-price':{b:note('이 도시락은 어디에서 만들어요?','도시락을 만드는 곳을 물을 때 하는 말이에요.','You say this to ask where the lunch box is made.','Энэ бол савтай хоолыг хаана бэлтгэдгийг асуудаг өгүүлбэр.'),c:note('이 도시락은 누가 만들어요?','도시락을 만드는 사람을 물을 때 하는 말이에요.','You say this to ask who makes the lunch box.','Энэ бол савтай хоолыг хэн бэлтгэдгийг асуудаг өгүүлбэр.')},
 'store-apply-price-transfer':{a:note('우산은 누가 샀어요?','우산을 산 사람을 물을 때 하는 말이에요.','You say this to ask who bought the umbrella.','Энэ бол шүхрийг хэн авсныг асуудаг өгүүлбэр.'),c:note('우산은 언제 써요?','우산을 쓰는 때를 물을 때 하는 말이에요.','You say this to ask when to use the umbrella.','Энэ бол шүхрийг хэзээ хэрэглэхийг асуудаг өгүүлбэр.')},
 'store-apply-bag':{a:note('아니요, 괜찮아요.','봉투가 필요 없을 때 하는 대답이에요.','This is the answer when you don’t need a bag.','Уут хэрэггүй бол ингэж хариулна.'),b:note('가격은 얼마예요?','가격을 물을 때 하는 말이에요. 봉투를 묻는 말의 대답이 아니에요.','You say this to ask the price. It doesn’t answer a question about a bag.','Энэ бол үнэ асуудаг өгүүлбэр. Уут хэрэгтэй эсэхийг асуухад өгөх хариулт биш.')},
 'store-apply-bag-transfer':{a:note('네, 봉투 두 개 주세요.','봉투가 두 개 필요할 때 하는 대답이에요.','This is the answer when you need two bags.','Хоёр уут хэрэгтэй бол ингэж хариулна.'),c:note('카드로 계산할게요.','카드로 값을 낼 때 하는 말이에요. 봉투를 묻는 말의 대답이 아니에요.','You say this when you pay by card. It doesn’t answer a question about a bag.','Картаар төлөхдөө хэлдэг үг. Уут хэрэгтэй эсэхийг асуухад өгөх хариулт биш.')},
 'store-apply-card':{a:note('현금으로 계산할게요.','현금으로 값을 낼 때 하는 말이에요.','You say this when you pay in cash.','Бэлнээр төлөхдөө хэлдэг үг.'),c:note('나중에 계산할게요.','지금 내지 않고 나중에 내겠다는 말이에요.','This means you won’t pay now, but later.','Одоо биш, дараа төлнө гэсэн үг.')},
 'store-apply-card-transfer':{b:note('카드로 계산할게요.','카드로 값을 낼 때 하는 말이에요.','You say this when you pay by card.','Картаар төлөхдөө хэлдэг үг.'),c:note('가격표를 붙여 주세요.','물건에 가격표를 붙여 달라는 부탁이에요. 값을 내는 말이 아니에요.','This asks someone to put a price tag on something. It isn’t about paying.','Бараанд үнийн шошго нааж өгөөч гэсэн үг. Төлбөртэй холбоотой үг хэллэг биш.')},
 // 편의점 팩 — 끝
 // 길 팩(11-26 「네, 이어가」) — 시작
 'directions-expressions-where':{a:note('공원은 몇 시에 열어요?','공원이 문을 여는 시간을 물을 때 하는 말이에요.','You say this to ask what time the park opens.','Энэ бол цэцэрлэгт хүрээлэн хэдэн цагт нээгддэгийг асуусан өгүүлбэр.'),c:note('공원에는 나무가 많아요?','공원에 나무가 많은지 물을 때 하는 말이에요. 위치를 묻는 말이 아니에요.','You say this to ask whether the park has many trees. It does not ask where the park is.','Энэ бол цэцэрлэгт хүрээлэнд олон мод байгаа эсэхийг асуусан өгүүлбэр. Хаана байгааг нь асуусан өгүүлбэр биш.')},
 'directions-expressions-where-transfer':{b:note('화장실은 청소 중이에요?','지금 화장실을 청소하는지 물을 때 하는 말이에요.','You say this to ask whether the restroom is being cleaned now.','Энэ бол ариун цэврийн өрөөг одоо цэвэрлэж байгаа эсэхийг асуусан өгүүлбэр.'),c:note('화장실은 깨끗해요?','화장실이 깨끗한지 물을 때 하는 말이에요.','You say this to ask whether the restroom is clean.','Энэ бол ариун цэврийн өрөө цэвэрхэн эсэхийг асуусан өгүүлбэр.')},
 'directions-expressions-right':{a:note('왼쪽','왼쪽으로 안내할 때는 ‘왼쪽으로 가세요.’라고 해요.','To send someone left, you say ‘왼쪽으로 가세요.’','«Зүүн тийш яваарай» гэдгийг солонгосоор «왼쪽으로 가세요.» гэж хэлнэ.'),b:note('뒤쪽','뒤쪽으로 안내할 때는 ‘뒤로 가세요.’라고 해요.','To send someone back, you say ‘뒤로 가세요.’','«Арагшаа яваарай» гэдгийг солонгосоор «뒤로 가세요.» гэж хэлнэ.')},
 'directions-expressions-right-transfer':{a:note('오른쪽','오른쪽으로 안내할 때는 ‘오른쪽으로 가세요.’라고 해요.','To send someone right, you say ‘오른쪽으로 가세요.’','«Баруун тийш яваарай» гэдгийг солонгосоор «오른쪽으로 가세요.» гэж хэлнэ.'),c:note('뒤쪽','뒤쪽으로 안내할 때는 ‘뒤로 가세요.’라고 해요.','To send someone back, you say ‘뒤로 가세요.’','«Арагшаа яваарай» гэдгийг солонгосоор «뒤로 가세요.» гэж хэлнэ.')},
 'directions-expressions-beside':{b:note('은행 안','은행 안은 은행 건물 속이에요. 그때는 ‘은행 안에 있어요.’라고 해요.','‘은행 안’ is inside the bank. For that, you say ‘은행 안에 있어요.’','«은행 안» гэдэг нь банк дотор гэсэн үг. Банк дотор байвал «은행 안에 있어요.» гэж хэлнэ.'),c:note('학교 뒤','학교 뒤에 있을 때는 ‘학교 뒤에 있어요.’라고 해요.','If something is behind the school, you say ‘학교 뒤에 있어요.’','Сургуулийн ард байвал «학교 뒤에 있어요.» гэж хэлнэ.')},
 'directions-expressions-beside-transfer':{a:note('학교 안','학교 안은 학교 건물 속이에요. 그때는 ‘학교 안에 있어요.’라고 해요.','‘학교 안’ is inside the school. For that, you say ‘학교 안에 있어요.’','«학교 안» гэдэг нь сургууль дотор гэсэн үг. Сургууль дотор байвал «학교 안에 있어요.» гэж хэлнэ.'),b:note('은행 앞','은행 앞에 있을 때는 ‘은행 앞에 있어요.’라고 해요.','If something is in front of the bank, you say ‘은행 앞에 있어요.’','Банкны урд байвал «은행 앞에 있어요.» гэж хэлнэ.')},
 'directions-story-where':{b:note('병원이 어디에 있어요?','병원은 태오가 말한 곳이에요. 서하는 공원을 찾아요.','Taeo mentioned the hospital. Seoha is looking for the park.','Эмнэлэг бол Тэогийн хэлсэн газар. Сөха цэцэрлэгт хүрээлэн хайж байна.'),c:note('은행이 어디에 있어요?','은행은 아주머니가 말한 곳이에요. 공원이 은행 옆에 있어요.','The woman mentioned the bank. The park is next to the bank.','Банк бол эмэгтэйн хэлсэн газар. Цэцэрлэгт хүрээлэн банкны хажууд байна.')},
 'directions-story-where-transfer':{a:note('은행이 어디에 있어요?','은행은 돈을 찾는 곳이에요. 책은 도서관에서 빌려요.','A bank is where you take out money. You borrow books at a library.','Банкнаас мөнгө авдаг. Номыг номын сангаас зээлж авдаг.'),c:note('공원이 어디에 있어요?','공원은 산책하는 곳이에요. 책은 도서관에서 빌려요.','A park is where you take a walk. You borrow books at a library.','Цэцэрлэгт хүрээлэнд зугаалдаг. Номыг номын сангаас зээлж авдаг.')},
 'directions-story-turn':{a:note('왼쪽','왼쪽은 태오가 지도를 잘못 보고 한 말이에요.','Taeo said left because he misread the map.','Тэо газрын зургийг буруу хараад «зүүн тийшээ» гэж хэлсэн.'),c:note('뒤쪽','뒤쪽으로 가라는 말은 이야기에 없어요.','Nobody in the story says to go back.','Энэ түүхэнд хэн ч «арагшаа яв» гэж хэлээгүй.')},
 'directions-story-turn-transfer':{a:note('오른쪽','‘시장 오른쪽’은 도서관이 있는 자리예요. 갈 방향은 왼쪽이에요.','‘시장 오른쪽’ is where the library is. The way to go is left.','«시장 오른쪽» гэдэг нь номын сан захын баруун талд байдаг гэсэн үг. Жихо зүүн тийш явах ёстой.'),b:note('뒤쪽','아저씨는 ‘왼쪽으로 가세요.’라고 했어요. 뒤쪽이 아니라 왼쪽이에요.','The man said ‘왼쪽으로 가세요.’ The way is left, not back.','Тэр хүн «왼쪽으로 가세요» (зүүн тийш яваарай) гэж хэлсэн. Арагшаа биш, зүүн тийш явна.')},
 'directions-story-landmark':{a:note('병원','병원은 태오가 말한 곳이에요. 태오는 지도를 잘못 봤어요.','Taeo mentioned the hospital. He misread the map.','Тэо газрын зургийг буруу хараад «эмнэлгийн хажууд» гэж хэлсэн.'),b:note('시장','시장은 지호가 물어본 곳이에요. 공원은 은행 옆에 있어요.','Jiho asked about the market. The park is next to the bank.','Жихо захын хажууд биш үү гэж асуусан. Цэцэрлэгт хүрээлэн банкны хажууд байдаг.')},
 'directions-story-landmark-transfer':{b:note('은행','서하가 은행 옆인지 물었어요. 아저씨는 ‘아니요’라고 했어요.','Seoha asked whether it was next to the bank. The man said ‘아니요’ (no).','Сөха эмийн сан банкны хажууд байдаг эсэхийг асуусан. Тэр эрэгтэй «아니요» (үгүй) гэж хариулсан.'),c:note('학교','약국은 학교 앞에 있어요. 학교 옆이 아니에요.','The pharmacy is in front of the school, not next to it.','Эмийн сан сургуулийн хажууд биш, урд нь байдаг.')},
 'directions-apply-where':{a:note('약국은 몇 시에 닫아요?','약국이 문을 닫는 시간을 물을 때 하는 말이에요.','You say this to ask what time the pharmacy closes.','Энэ бол эмийн сан хэдэн цагт хаадгийг асуусан өгүүлбэр.'),c:note('약국에서 약을 샀어요?','약을 샀는지 물을 때 하는 말이에요. 위치를 묻는 말이 아니에요.','You say this to ask whether someone bought medicine. It does not ask where the pharmacy is.','Энэ бол эм авсан эсэхийг асуусан өгүүлбэр. Эмийн сан хаана байгааг асуусан өгүүлбэр биш.')},
 'directions-apply-where-transfer':{a:note('지하철은 몇 시에 와요?','지하철이 오는 시간을 물을 때 하는 말이에요.','You say this to ask what time the subway comes.','Энэ бол метро хэдэн цагт ирдгийг асуусан өгүүлбэр.'),b:note('지하철 표는 얼마예요?','지하철 표의 가격을 물을 때 하는 말이에요.','You say this to ask the price of a subway ticket.','Энэ бол метроны тасалбарын үнийг асуусан өгүүлбэр.')},
 'directions-apply-turn':{b:note('왼쪽','왼쪽으로 안내할 때는 ‘왼쪽으로 가세요.’라고 해요.','To send someone left, you say ‘왼쪽으로 가세요.’','«Зүүн тийш яваарай» гэдгийг солонгосоор «왼쪽으로 가세요.» гэж хэлнэ.'),c:note('뒤쪽','뒤쪽으로 안내할 때는 ‘뒤로 가세요.’라고 해요.','To send someone back, you say ‘뒤로 가세요.’','«Арагшаа яваарай» гэдгийг солонгосоор «뒤로 가세요.» гэж хэлнэ.')},
 'directions-apply-turn-transfer':{a:note('뒤쪽','뒤쪽으로 안내할 때는 ‘뒤로 가세요.’라고 해요.','To send someone back, you say ‘뒤로 가세요.’','«Арагшаа яваарай» гэдгийг солонгосоор «뒤로 가세요.» гэж хэлнэ.'),c:note('오른쪽','오른쪽으로 안내할 때는 ‘오른쪽으로 가세요.’라고 해요.','To send someone right, you say ‘오른쪽으로 가세요.’','«Баруун тийш яваарай» гэдгийг солонгосоор «오른쪽으로 가세요.» гэж хэлнэ.')},
 'directions-apply-landmark':{a:note('병원 안에 있어요.','병원 건물 속에 있다는 말이에요. 약국은 병원 옆에 있어요.','This means it is inside the hospital. The pharmacy is next to the hospital.','Энэ бол эмнэлэг дотор байдаг гэсэн үг. Эмийн сан эмнэлгийн хажууд байдаг.'),b:note('학교 뒤에 있어요.','학교 뒤에 있다는 말이에요. 안내에 학교는 없어요.','This means it is behind the school. The directions don’t mention a school.','Энэ бол сургуулийн ард байдаг гэсэн үг. Зааварт сургуулийг дурдаагүй.')},
 'directions-apply-landmark-transfer':{b:note('학교 안에 있어요.','학교 건물 속에 있다는 말이에요. 우체국은 학교 옆에 있어요.','This means it is inside the school. The post office is next to the school.','Энэ бол сургууль дотор байдаг гэсэн үг. Шуудан сургуулийн хажууд байдаг.'),c:note('은행 뒤에 있어요.','은행 뒤에 있다는 말이에요. 안내에 은행은 없어요.','This means it is behind the bank. The directions don’t mention a bank.','Энэ бол банкны ард байдаг гэсэн үг. Зааварт банкийг дурдаагүй.')},
 // 길 팩 — 끝
 // 버스 팩(11-26 저녁 「네, 이어가」) — 시작
 'transit-expressions-route':{a:note('이 버스는 몇 시에 와요?','버스가 오는 시간을 물을 때 하는 말이에요. 버스가 가는 곳을 묻는 말이 아니에요.','You say this to ask what time the bus comes. It does not ask where the bus goes.','Энэ бол автобус хэдэн цагт ирэхийг асуусан өгүүлбэр. Автобус хаашаа явдгийг асуусан өгүүлбэр биш.'),c:note('공원에서 버스를 타요?','공원에서 버스를 타는지 물을 때 하는 말이에요. 버스가 가는 곳을 묻는 말이 아니에요.','You say this to ask whether you get on the bus at the park. It does not ask where the bus goes.','Энэ бол цэцэрлэгт хүрээлэнгээс автобусанд суудаг эсэхийг асуусан өгүүлбэр. Автобус хаашаа явдгийг асуусан өгүүлбэр биш.')},
 'transit-expressions-route-transfer':{b:note('이 버스는 어디에서 타요?','이 버스를 어디에서 타는지 물을 때 하는 말이에요.','You say this to ask where to get on this bus.','Энэ бол энэ автобусанд хаанаас суухыг асуусан өгүүлбэр.'),c:note('도서관 앞에서 버스를 기다려요?','도서관 앞에서 버스를 기다리는지 물을 때 하는 말이에요.','You say this to ask whether you wait for the bus in front of the library.','Энэ бол номын сангийн өмнө автобус хүлээх эсэхийг асуусан өгүүлбэр.')},
 'transit-expressions-alight':{a:note('지금 정류장에서 내려요.','‘이번 정류장에서 내려요’일 때 하는 행동이에요.','This is what you do for ‘이번 정류장에서 내려요’ (get off at this stop).','Энэ бол «이번 정류장에서 내려요» (энэ буудал дээр бууна) гэж хэлэх үед хийдэг үйлдэл.'),b:note('두 정류장 더 가서 내려요.','두 정류장이 아니에요. ‘다음 정류장’은 바로 뒤에 오는 정류장 하나예요.','Not two stops. ‘다음 정류장’ is just the one stop right after this one.','Хоёр буудал явахгүй. Яг дараагийн буудал дээр бууна.')},
 'transit-expressions-alight-transfer':{a:note('한 정류장 더 가요.','‘다음 정류장에서 내려요’일 때 하는 행동이에요.','This is what you do for ‘다음 정류장에서 내려요’ (get off at the next stop).','Энэ бол «다음 정류장에서 내려요» (дараагийн буудал дээр бууна) гэж хэлэх үед хийдэг үйлдэл.'),c:note('버스를 다시 타요.','버스에서 내린 뒤 다시 탈 때 하는 행동이에요.','This is what you do when you get back on after getting off.','Энэ бол автобуснаас буугаад дахиж суух үед хийдэг үйлдэл.')},
 'transit-expressions-card':{b:note('교통카드 사진을 찍어요.','버스에서 ‘카드를 찍다’는 사진을 찍는 것이 아니에요. 카드 기계에 카드를 대요.','On a bus, ‘카드를 찍다’ does not mean taking a photo. You hold the card to the card machine.','Автобусанд «카드를 찍다» гэдэг нь зураг авахыг хэлэхгүй. Картаа уншуулахыг хэлнэ.'),c:note('교통카드를 기사님께 드려요.','기사님께 카드를 드리지 않아요. 카드 기계에 카드를 대요.','You don’t give the card to the driver. You hold it to the card machine.','Картаа жолоочид өгөхгүй. Картаа уншуулна.')},
 'transit-expressions-card-transfer':{a:note('내릴 때 카드를 가방에 넣어요.','카드를 가방에 넣기만 하면 안 돼요. 내릴 때도 카드 기계에 카드를 대요.','Just putting the card in your bag is not enough. When you get off, you hold the card to the card machine too.','Картаа зүгээр л цүнхэндээ хийчихэж болохгүй. Буухдаа ч картаа уншуулна.'),b:note('내릴 때 교통카드 사진을 찍어요.','버스에서 ‘카드를 찍다’는 사진을 찍는 것이 아니에요. 카드 기계에 카드를 대요.','On a bus, ‘카드를 찍다’ does not mean taking a photo. You hold the card to the card machine.','Автобусанд «카드를 찍다» гэдэг нь зураг авахыг хэлэхгүй. Картаа уншуулахыг хэлнэ.')},
 'transit-story-route':{a:note('학교','학교는 친구들이 버스를 탄 곳이에요.','The school is where your friends got on the bus.','Найзууд сургуулийн урд талын буудлаас автобусанд суусан.'),b:note('도서관','도서관은 버스가 멈춘 정류장이에요. 친구들은 거기에서 내리지 않았어요.','The bus stopped at the library, but your friends did not get off there.','Автобус номын сангийн буудал дээр зогссон ч найзууд тэнд буугаагүй.')},
 'transit-story-route-transfer':{a:note('꽃길 공원','꽃길 공원은 이야기 속 버스가 간 곳이에요. 이 안내표는 ‘마루 도서관행’이에요.','Kkotgil Park is where the bus in the story went. This sign says ‘마루 도서관행’ (to Maru Library).','Энэ түүхэнд автобус Коткил цэцэрлэгт хүрээлэн рүү явсан. Харин энэ чиглэлийн самбарт «마루 도서관행» (Мару номын сан руу) гэж бичсэн байна.'),c:note('마루 카페','안내표에 카페는 없어요. ‘마루 도서관행’이에요.','The sign does not say café. It says ‘마루 도서관행’ (to Maru Library).','Самбарт кафе гэж бичээгүй. «마루 도서관행» (Мару номын сан руу) гэж бичсэн байна.')},
 'transit-story-alight':{b:note('도서관에서 내렸어요.','도서관에서 내리려고 한 사람은 태오예요. 서하가 ‘아니요’라고 했어요.','Taeo was the one who wanted to get off at the library. Seoha said ‘아니요’ (no).','Тэо л номын сангийн буудал дээр буух гэсэн. Харин Сөха «아니요» (үгүй) гэж хэлсэн.'),c:note('두 정류장 더 갔어요.','두 정류장이 아니에요. 공원은 도서관 바로 다음 정류장이라서 한 정류장만 더 갔어요.','Not two stops. The park is the very next stop after the library, so they rode only one more stop.','Хоёр буудал яваагүй. Цэцэрлэгт хүрээлэн номын сангийн яг дараагийн буудал учраас дахиад нэг л буудал явсан.')},
 'transit-story-alight-transfer':{a:note('학교에서 내려요.','학교는 지금 정류장이에요. 마루 도서관은 다음 정류장이에요.','School is the stop you are at now. Maru Library is the next stop.','Одоо сургуулийн буудал дээр байна. Дараагийн буудал бол Мару номын сангийн буудал.'),b:note('두 정류장 더 가서 내려요.','두 정류장이 아니에요. 마루 도서관은 바로 다음 정류장이에요.','Not two stops. Maru Library is the very next stop.','Хоёр буудал явахгүй. Мару номын сангийн буудал яг дараагийнх нь.')},
 'transit-story-card':{a:note('기사님에게 교통카드를 줬어요.','기사님에게 카드를 주지 않았어요. 카드 기계에 댔어요.','They did not give their cards to the driver. They held them to the card machine.','Тэд картаа жолоочид өгөөгүй. Картаа уншуулсан.'),c:note('도서관에서 교통카드를 샀어요.','도서관에서 카드를 사지 않았어요. 버스를 탈 때 카드 기계에 댔어요.','They did not buy cards at the library. They held their cards to the card machine when they got on.','Тэд номын сангаас карт аваагүй. Автобусанд суухдаа картаа уншуулсан.')},
 'transit-story-card-transfer':{a:note('탈 때 카드 사진을 찍어요.','여기에서 ‘찍다’는 사진을 찍는 것이 아니에요. 카드 기계에 카드를 대요.','Here, ‘찍다’ does not mean taking a photo. You hold the card to the card machine.','Энд «찍다» гэдэг нь зураг авна гэсэн үг биш. Картаа уншуулна гэсэн үг.'),b:note('탈 때 역 직원에게 카드를 줘요.','역 직원에게 카드를 주지 않아요. 카드 기계에 카드를 대요.','You don’t give the card to a station worker. You hold it to the card machine.','Картаа метроны ажилтанд өгөхгүй. Картаа уншуулна.')},
 'transit-apply-route':{b:note('이 버스는 언제 와요?','버스가 언제 오는지 물을 때 하는 말이에요. 버스가 가는 곳을 묻는 말이 아니에요.','You say this to ask when the bus comes. It does not ask where the bus goes.','Энэ бол автобус хэзээ ирэхийг асуусан өгүүлбэр. Автобус хаашаа явдгийг асуусан өгүүлбэр биш.'),c:note('병원에서 버스를 타요?','병원에서 버스를 타는지 물을 때 하는 말이에요. 버스가 가는 곳을 묻는 말이 아니에요.','You say this to ask whether you get on the bus at the hospital. It does not ask where the bus goes.','Энэ бол эмнэлгээс автобусанд суудаг эсэхийг асуусан өгүүлбэр. Автобус хаашаа явдгийг асуусан өгүүлбэр биш.')},
 'transit-apply-route-transfer':{a:note('이 버스는 몇 시에 와요?','버스는 벌써 왔어요. 오는 시간을 물을 필요가 없어요.','The bus has already come. You don’t need to ask when it comes.','Автобус аль хэдийн ирсэн. Хэдэн цагт ирэхийг асуух шаардлагагүй.'),c:note('버스 정류장이 어디에 있어요?','지금 정류장에 있어요. 정류장이 어디인지 물을 필요가 없어요.','You are already at the stop. You don’t need to ask where the stop is.','Та буудал дээрээ ирчихсэн байна. Буудал хаана байгааг асуух шаардлагагүй.')},
 'transit-apply-alight':{a:note('한 정류장 더 가요.','이번 정류장이 병원이에요. 한 정류장 더 가면 지나가요.','This stop is the hospital. If you ride one more stop, you will go past it.','Энэ бол эмнэлгийн буудал. Дахиад нэг буудал явбал өнгөрчихнө.'),b:note('다음 정류장에서 내려요.','다음 정류장에서 내리면 병원을 지나가요. 병원은 이번 정류장이에요.','If you get off at the next stop, you will go past the hospital. The hospital is this stop.','Дараагийн буудал дээр буувал эмнэлгийг өнгөрчихнө. Эмнэлгийн буудал бол энэ буудал.')},
 'transit-apply-alight-transfer':{b:note('이번 정류장에서 내려요.','이번 정류장은 시장이에요. 학교는 다음 정류장이에요.','This stop is the market. School is the next stop.','Энэ бол захын буудал. Дараагийн буудал бол сургуулийн буудал.'),c:note('시장에서 기다려요.','시장에서 기다리지 않아요. 학교까지 가요.','You don’t wait at the market. You ride on to school.','Зах дээр хүлээхгүй. Сургууль хүртэл явна.')},
 'transit-apply-card':{a:note('카드 사진을 찍고 들어가요.','버스에서 ‘카드를 찍다’는 사진을 찍는 것이 아니에요. 카드 기계에 카드를 대요.','On a bus, ‘카드를 찍다’ does not mean taking a photo. You hold the card to the card machine.','Автобусанд «카드를 찍다» гэдэг нь зураг авахыг хэлэхгүй. Картаа уншуулахыг хэлнэ.'),c:note('카드를 가방에 넣고 들어가요.','카드를 가방에 넣으면 찍지 않은 거예요. 카드 기계에 카드를 대고 들어가요.','If you put the card in your bag, you haven’t tapped it. Hold it to the card machine and go in.','Картаа цүнхэндээ хийвэл уншуулаагүй гэсэн үг. Картаа уншуулаад орно.')},
 'transit-apply-card-transfer':{a:note('내리기 전에 카드 사진을 찍어요.','여기에서 ‘찍다’는 사진을 찍는 것이 아니에요. 카드 기계에 카드를 대요.','Here, ‘찍다’ does not mean taking a photo. You hold the card to the card machine.','Энд «찍다» гэдэг нь зураг авна гэсэн үг биш. Картаа уншуулна гэсэн үг.'),b:note('내린 뒤에 카드를 카드 기계에 대요.','내린 뒤에는 늦어요. 안내는 내리기 전에 카드를 대라고 했어요.','After you get off is too late. The notice says to tap your card before you get off.','Буусны дараа уншуулбал оройтно. Санамжид буухын өмнө картаа уншуулна уу гэж бичсэн байна.')},
 // 버스 팩 — 끝
 // 약속 팩(11-27 「남은거 있으면 이어서해」) — 시작
 'plans-expressions-time':{a:note('오늘 오후 세 시','‘오늘’이 아니라 ‘내일’이에요.','It is not ‘오늘’ (today) but ‘내일’ (tomorrow).','«오늘» (өнөөдөр) биш, «내일» (маргааш).'),c:note('내일 오전 세 시','‘오전’이 아니라 ‘오후’예요.','It is not ‘오전’ (a.m.) but ‘오후’ (p.m.).','«오전» (үдээс өмнө) биш, «오후» (үдээс хойш).')},
 'plans-expressions-time-transfer':{a:note('내일 오전 열 시','‘내일’이 아니라 ‘오늘’이에요.','It is not ‘내일’ (tomorrow) but ‘오늘’ (today).','«내일» (маргааш) биш, «오늘» (өнөөдөр).'),b:note('오늘 오후 열 시','‘오후’가 아니라 ‘오전’이에요.','It is not ‘오후’ (p.m.) but ‘오전’ (a.m.).','«오후» (үдээс хойш) биш, «오전» (үдээс өмнө).')},
 'plans-expressions-place':{b:note('만날 날짜','날짜는 ‘언제’로 물어요.','You ask about the day with ‘언제’ (when).','Өдөр, цаг асуухдаа «언제» (хэзээ) гэж асууна.'),c:note('만날 사람','사람은 ‘누구’로 물어요.','You ask about a person with ‘누구’ (who).','Хэн болохыг асуухдаа «누구» (хэн) гэж асууна.')},
 'plans-expressions-place-transfer':{a:note('내일 만나요.','날짜를 말하는 답이에요. 장소를 묻는 말에는 맞지 않아요.','This answer gives a day. It does not fit a question about a place.','Энэ нь өдөр заасан хариулт. Хаана гэдгийг асуусан асуултад тохирохгүй.'),c:note('오후 두 시에 만나요.','시간을 말하는 답이에요. 장소를 묻는 말에는 맞지 않아요.','This answer gives a time. It does not fit a question about a place.','Энэ нь цаг заасан хариулт. Хаана гэдгийг асуусан асуултад тохирохгүй.')},
 'plans-expressions-delay':{a:note('약속을 정하지 않겠다는 연락','약속을 안 하겠다는 말은 없어요. 늦는다고 알리는 말이에요.','It does not say you won’t make plans. It says you will be late.','Уулзалт товлохгүй гэсэн утга байхгүй. Хоцорно гэдгээ мэдэгдэж байна.'),b:note('일찍 도착했다는 연락','일찍 온 것이 아니에요. 늦을 것 같다는 말이에요.','It is not about coming early. It says you will probably be late.','Эрт ирсэн тухай биш. Хоцрох юм шиг байна гэсэн үг.')},
 'plans-expressions-delay-transfer':{b:note('벌써 도착했어요.','도착했을 때 하는 말이에요. 아직 도착하지 않았어요.','You say this when you have arrived. You haven’t arrived yet.','Ирсэн үедээ хэлдэг үг. Та хараахан очоогүй байна.'),c:note('일찍 왔어요.','일찍 왔을 때 하는 말이에요. 지금은 늦을 것 같아요.','You say this when you came early. Now you think you will be late.','Эрт ирсэн үедээ хэлдэг үг. Одоо хоцрох юм шиг байна.')},
 'plans-story-time':{a:note('토요일 오전 세 시','‘오전’이 아니라 ‘오후 세 시’예요.','It is not ‘오전’ (a.m.) but ‘오후 세 시’ (3 p.m.).','«오전» (үдээс өмнө) биш, «오후 세 시» (өдрийн гурван цаг).'),b:note('금요일 오후 세 시','금요일은 약속을 정한 날이에요. 약속은 다음 날인 토요일이에요.','Friday is the day they made the plan. The meeting is the next day, Saturday.','Баасан гарагт тэд ярилцаж цагаа тохирсон. Харин маргааш нь буюу бямба гарагт уулзана.')},
 'plans-story-time-transfer':{a:note('토요일 오후 열한 시','‘오후’가 아니라 ‘오전’이에요.','It is not ‘오후’ (p.m.) but ‘오전’ (a.m.).','«오후» (үдээс хойш) биш, «오전» (үдээс өмнө).'),c:note('일요일 오전 열한 시','‘일요일’이 아니라 ‘토요일’이에요.','It is not ‘일요일’ (Sunday) but ‘토요일’ (Saturday).','«일요일» (ням гараг) биш, «토요일» (бямба гараг).')},
 'plans-story-place':{b:note('도서관 안 교실','도서관 안이 아니라 도서관 앞 벤치에서 만났어요.','They met not inside the library but at the bench in front of it.','Номын сан дотор биш, урдах вандан сандал дээр нь уулзсан.'),c:note('도서관 뒤 벤치','뒤가 아니라 앞이에요. 태오가 ‘도서관 앞 벤치’라고 했어요.','Not behind but in front. Taeo said ‘도서관 앞 벤치’ (the bench in front of the library).','Ард биш, урд. Тэо «도서관 앞 벤치» (номын сангийн урдах вандан сандал) гэж хэлсэн.')},
 'plans-story-place-transfer':{a:note('공원 안 벤치','메시지에 ‘안의 벤치가 아니라’라고 했어요.','The message says ‘안의 벤치가 아니라’ (not the bench inside).','Мессежид «안의 벤치가 아니라» (доторх вандан сандал биш) гэж бичсэн.'),b:note('도서관 입구','도서관이 아니라 공원 입구예요.','It is not the library but the park entrance.','Номын сан биш, цэцэрлэгт хүрээлэнгийн орох хаалга.')},
 'plans-story-delay':{a:note('음료수를 사러 갔어요.','음료수는 태오가 가지고 왔어요. 친구들은 기다렸어요.','Taeo brought the drinks. The friends waited.','Ундааг Тэо авчирсан. Найзууд хүлээсэн.'),c:note('먼저 도서관 안에 들어갔어요.','도서관 안에 들어가지 않았어요. 앞에서 기다렸어요.','They did not go into the library. They waited in front of it.','Тэд номын сан руу ороогүй. Урд нь хүлээсэн.')},
 'plans-story-delay-transfer':{b:note('벌써 약속 장소에 도착했어요.','‘늦을 것 같아요’라고 했어요. 아직 도착하지 않았어요.','The message says ‘늦을 것 같아요’ (I think I’ll be late). They haven’t arrived yet.','Мессежид «늦을 것 같아요» (хоцрох юм шиг байна) гэж бичсэн. Найз хараахан ирээгүй байна.'),c:note('약속이 취소됐어요.','취소한다는 말은 없어요. 늦게 온다는 말이에요.','Nothing says the plan is cancelled. It says they will come late.','Цуцалсан гэсэн утга байхгүй. Хоцорч ирнэ гэсэн үг.')},
 'plans-apply-time':{b:note('오늘 오후 두 시','‘오늘’이 아니라 ‘내일’이에요.','It is not ‘오늘’ (today) but ‘내일’ (tomorrow).','«오늘» (өнөөдөр) биш, «내일» (маргааш).'),c:note('내일 오전 두 시','‘오전’이 아니라 ‘오후’예요.','It is not ‘오전’ (a.m.) but ‘오후’ (p.m.).','«오전» (үдээс өмнө) биш, «오후» (үдээс хойш).')},
 'plans-apply-time-transfer':{a:note('내일 오후 다섯 시','‘내일’이 아니라 ‘오늘’이에요.','It is not ‘내일’ (tomorrow) but ‘오늘’ (today).','«내일» (маргааш) биш, «오늘» (өнөөдөр).'),b:note('오늘 오전 다섯 시','‘오전’이 아니라 ‘오후’예요.','It is not ‘오전’ (a.m.) but ‘오후’ (p.m.).','«오전» (үдээс өмнө) биш, «오후» (үдээс хойш).')},
 'plans-apply-place':{a:note('역 안','메시지에 ‘역 안이 아니라’라고 했어요.','The message says ‘역 안이 아니라’ (not inside the station).','Мессежид «역 안이 아니라» (буудал дотор биш) гэж бичсэн.'),b:note('역 뒤','메시지에 ‘역 뒤’는 없어요. ‘역 앞’이에요.','The message does not say ‘역 뒤’ (behind the station). It says ‘역 앞’ (in front of the station).','Мессежид «역 뒤» (буудлын ард) гэж бичээгүй. «역 앞» (буудлын урд) гэж бичсэн.')},
 'plans-apply-place-transfer':{a:note('학교 안','메시지에 ‘학교 안이 아니라’라고 했어요.','The message says ‘학교 안이 아니라’ (not inside the school).','Мессежид «학교 안이 아니라» (сургууль дотор биш) гэж бичсэн.'),c:note('학교 뒤','메시지에 ‘학교 뒤’는 없어요. ‘학교 앞’이에요.','The message does not say ‘학교 뒤’ (behind the school). It says ‘학교 앞’ (in front of the school).','Мессежид «학교 뒤» (сургуулийн ард) гэж бичээгүй. «학교 앞» (сургуулийн урд) гэж бичсэн.')},
 'plans-apply-delay':{a:note('벌써 도착했어요.','아직 도착하지 않았어요. 버스를 놓쳤어요.','You haven’t arrived yet. You missed the bus.','Та хараахан очоогүй байна. Автобуснаасаа хоцорчихсон.'),c:note('일찍 도착했어요.','일찍 온 것이 아니에요. 늦을 것 같아요.','You didn’t come early. You think you will be late.','Та эрт очоогүй. Хоцрох юм шиг байна.')},
 'plans-apply-delay-transfer':{b:note('십 분 일찍 도착할 것 같아요.','일찍 도착하지 않아요. 세 시 십 분에 도착하니까 늦어요.','You will not arrive early. You will arrive at 3:10, so you will be late.','Та эрт очихгүй. Гурван цаг арван минутад очих учраас хоцорно.'),c:note('약속 시간에 도착할 것 같아요.','세 시에 도착하지 못해요. 십 분 늦어요.','You can’t arrive at 3:00. You will be ten minutes late.','Гурван цагт очиж чадахгүй. Арван минут хоцорно.')},
 // 약속 팩 — 끝
});

/** 그 문항 보기의 한 줄(화면 언어, 없으면 한국어). 문항이나 보기 글이 바뀌었으면 null. */
export function lifeChoiceNote(question,choiceId,lang='ko'){
 const row=question?.id&&LIFE_CHOICE_NOTES[question.id]?.[choiceId];
 const choice=question?.choices?.find(c=>c.id===choiceId);
 if(!row||!choice||row.text!==choice.text)return null;
 return row[lang]||row.ko;
}
