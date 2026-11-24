// 첫 레슨들(인사 팩)의 화면 언어 글 · 1판(2026-10-19 「WORLD 화면 언어」), 카페 팩(2026-11-24).
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
  {prompt:'In Jiho’s ‘여기서 마실게요.’, where is ‘여기’?',context:'',explanation:'Jiho said this inside the café, so ‘여기’ means inside the café.'},
  {prompt:'Жихогийн хэлсэн «여기서 마실게요.» гэсэн үгэн дэх «여기» нь хаана гэсэн үг вэ?',context:'',explanation:'Жихо энэ үгийг кафе дотор хэлсэн. Тиймээс «여기» нь кафе дотор гэсэн үг.'}),
 'cafe-story-here-transfer':q(
  {prompt:'주문표를 읽고 마실 장소를 골라요.',context:'“카페 안에서 마실게요. 창가에 앉을게요.”',explanation:'‘카페 안’과 ‘창가’를 함께 확인해요.'},
  {prompt:'Read the order slip and choose where they’ll drink.',context:'“카페 안에서 마실게요. 창가에 앉을게요.”',explanation:'Check both ‘카페 안’ (inside the café) and ‘창가’ (by the window).'},
  {prompt:'Захиалгын хуудсыг уншаад хаана уухыг сонгоно уу.',context:'«카페 안에서 마실게요. 창가에 앉을게요.»',explanation:'«카페 안» (кафе дотор), «창가» (цонхны дэргэд) гэсэн хоёр үгийг хоёуланг нь анхаараарай.'}),
 'cafe-story-takeout':q(
  {prompt:'지호가 직원에게 다시 한 말은 무엇이에요?',context:'',explanation:'태오가 ‘우리 밖에서 마셔요!’라고 해서 지호가 직원에게 다시 ‘포장해 주세요.’라고 했어요. 나머지 두 말은 처음에 주문할 때 한 말이에요.'},
  {prompt:'What did Jiho say to the staff the second time?',context:'',explanation:'Taeo said ‘우리 밖에서 마셔요!’, so Jiho told the staff ‘포장해 주세요.’ The other two are what Jiho said when he first ordered.'},
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
  {prompt:'Order the drink Seoha wants.',context:'Seoha: “오늘은 차가운 주스를 마시고 싶어요!”',explanation:'Seoha wants ‘차가운 주스’ (cold juice). Choose ‘차가운 주스 한 잔 주세요.’, where both the drink and the temperature match.'},
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
