// 게임 원고(빈칸 베기 · 싱크타운 읽기)에서 온 문항의 해설 — 영어 · 몽골어(2026-11-26). 동아리 튜터의 첫 실력 파악이 읽는다(world-front-club.mjs explainOf).
// 열쇠 = 원고의 한국어 해설 글 그대로다. 원고를 고치면 열쇠가 어긋나 그 문항은 한국어로 보이고, 시험(qa/world-front-club.test.mjs)이 알려 준다.
// 몽골어는 사람 검수 전이다. 인용한 한국어는 「 」 안에 그대로 두고 뜻을 괄호에 적는다(문항 은행 해설과 같은 꼴).
export const WHY = Object.freeze({
  '무엇을 먹는지 말할 때는 ‘을/를’을 붙여요. ‘빵’은 받침이 있어서 ‘빵을’이에요.': {
    en: 'To say what you eat, add 「을/를」 after it. 「빵」 (bread) ends in a final consonant, so it is 「빵을」.',
    mn: 'Юу идэж байгаагаа хэлэхдээ ард нь 「을/를」 залгана. 「빵」 (талх) нь дэвсгэр үсэгтэй тул 「빵을」 болно.'},
  '목이 마를 때는 물을 마셔요. 빵은 먹고, 옷은 입고, 책은 읽어요.': {
    en: 'When you are thirsty, you drink water (「물」). You eat bread (「빵」), wear clothes (「옷」) and read a book (「책」).',
    mn: 'Цангасан үедээ ус (「물」) уудаг. Талх (「빵」) иднэ, хувцас (「옷」) өмсөнө, ном (「책」) уншина.'},
  '무엇을 하는 장소 뒤에는 ‘에서’를 붙여요. 친구를 만나는 곳이 학교니까 ‘학교에서’예요.': {
    en: 'Add 「에서」 after the place where you do something. You meet a friend at school, so it is 「학교에서」 (at school).',
    mn: 'Үйл хийж буй газрыг заасан үгийн ард 「에서」 залгана. Найзтайгаа сургууль дээр уулздаг тул 「학교에서」 (сургууль дээр) болно.'},
  '코트 같은 옷은 ‘입어요’. 모자는 ‘써요’, 신발은 ‘신어요’.': {
    en: 'For clothes like a coat, say 「입어요」. For a hat it is 「써요」, and for shoes 「신어요」.',
    mn: 'Пальто мэтийн хувцас өмсөхийг 「입어요」 гэнэ. Малгай өмсөхийг 「써요」, гутал өмсөхийг 「신어요」 гэнэ.'},
  '사과는 ‘개’로 세요. 사람은 ‘명’, 책은 ‘권’, 종이는 ‘장’으로 세요.': {
    en: 'Count apples with 「개」. Count people with 「명」, books with 「권」 and sheets of paper with 「장」.',
    mn: 'Алим тоолохдоо 「개」 хэрэглэнэ. Хүн тоолохдоо 「명」, ном тоолохдоо 「권」, цаас тоолохдоо 「장」 хэрэглэнэ.'},
  '‘있어요’ 앞에는 ‘이/가’를 붙여요. ‘동생’은 받침이 있어서 ‘동생이’예요.': {
    en: 'Before 「있어요」 (have, there is), add 「이/가」 to the noun. 「동생」 (younger sibling) ends in a final consonant, so it is 「동생이」.',
    mn: '「있어요」 (бий) гэдгийн өмнөх үгэнд 「이/가」 залгана. 「동생」 (дүү) нь дэвсгэр үсэгтэй тул 「동생이」 болно.'},
  '어제 일이니까 지나간 일을 말하는 ‘쉬었어요’를 써요.': {
    en: 'It happened yesterday, so use the past form 「쉬었어요」 (rested).',
    mn: 'Өчигдрийн явдал тул өнгөрсөн цагаар 「쉬었어요」 (амарсан) гэнэ.'},
  '더 싼 가방을 찾는 걸 보면 이 가방은 비싸요.': {
    en: 'The speaker asks for a cheaper bag, so this bag is 「비싸요」 (expensive).',
    mn: 'Арай хямд цүнх хайж байгаагаас харахад энэ цүнх үнэтэй (「비싸요」) байна.'},
  '무엇을 타고 가는지 말할 때는 ‘(으)로’를 붙여요. 버스로 가요.': {
    en: 'To say what you ride to get somewhere, add 「(으)로」: 「버스로 가요」 (I go by bus).',
    mn: 'Юугаар явж байгаагаа хэлэхдээ 「(으)로」 залгана: 「버스로 가요」 (автобусаар явна).'},
  '몸이 아플 때는 병원에 가요.': {
    en: 'When you are sick, you go to a hospital (「병원」).',
    mn: 'Бие өвдвөл эмнэлэгт (「병원」) очдог.'},
  '누구와 함께 했는지 말할 때는 ‘와/과’를 붙여요. ‘친구’는 받침이 없어서 ‘친구와’예요.': {
    en: 'To say who you did something with, add 「와/과」. 「친구」 (friend) has no final consonant, so it is 「친구와」.',
    mn: 'Хэнтэй хамт хийснээ хэлэхдээ 「와/과」 залгана. 「친구」 (найз) нь дэвсгэр үсэггүй тул 「친구와」 болно.'},
  '비가 올 때 우산이 없으면 옷이 젖어요. 가방·수건·책으로는 비를 막지 못해요.': {
    en: 'Without an umbrella (「우산」), your clothes get wet in the rain. A bag, a towel or a book can’t keep the rain off.',
    mn: 'Бороонд шүхэр (「우산」) байхгүй бол хувцас норно. Цүнх, алчуур, номоор бороог халхалж чадахгүй.'},
  '걷고 뛰는 것은 운동이에요. 공원에서 운동해요.': {
    en: 'Walking and running are exercise, so it is 「운동해요」 (exercise).',
    mn: 'Алхах, гүйх нь дасгал хөдөлгөөн тул 「운동해요」 (дасгал хийдэг) нь зөв.'},
  '‘물 좀 주세요’라고 했으니까 김치찌개가 매워서 물을 찾는 거예요. ‘싱거워요’, ‘맛있어요’, ‘차가워요’는 물을 찾을 까닭이 아니에요.': {
    en: 'The speaker says 「물 좀 주세요」 (some water, please), so the kimchi stew is too spicy: 「매워요」. 「싱거워요」 (bland), 「맛있어요」 (tasty) and 「차가워요」 (cold) are no reason to ask for water.',
    mn: '「물 좀 주세요」 (ус өгөөч) гэснээс харахад кимчитэй шөл халуун ногоотой (「매워요」) учраас ус гуйж байна. 「싱거워요」 (давс багатай), 「맛있어요」 (амттай), 「차가워요」 (хүйтэн) нь ус гуйх шалтгаан биш.'},
  '아침을 안 먹은 것이 배가 고픈 이유예요. 이유와 결과를 이을 때는 ‘그래서’를 써요.': {
    en: 'Not having breakfast is why the speaker is hungry. To link a reason and its result, use 「그래서」 (so).',
    mn: 'Өглөөний цайгаа уугаагүй нь өлссөн шалтгаан юм. Шалтгаан, үр дагаврыг холбохдоо 「그래서」 (тиймээс) хэрэглэнэ.'},
  '어렵다는 말 뒤에 반대되는 좋은 점이 나오니까 ‘하지만’을 써요.': {
    en: 'After saying the book is hard, the speaker adds a contrasting good point, so use 「하지만」 (but).',
    mn: 'Хэцүү гэсний дараа эсрэгээрээ сайн талыг нь хэлж байгаа тул 「하지만」 (гэхдээ) хэрэглэнэ.'},
  '무엇을 하러 가는지 말할 때는 ‘-(으)러 가요’를 써요. 영화를 보러 극장에 갔어요.': {
    en: 'To say what you go somewhere to do, use 「-(으)러 가요」: 「영화를 보러 극장에 갔어요」 (I went to the theater to see a movie).',
    mn: 'Юу хийхээр явж байгаагаа хэлэхдээ 「-(으)러 가요」 хэрэглэнэ: 「영화를 보러 극장에 갔어요」 (кино үзэхээр кино театр явсан).'},
  '커피 같은 마실 것은 ‘잔’으로 세요. 사람은 ‘명’, 책은 ‘권’, 동물은 ‘마리’로 세요.': {
    en: 'Count drinks like coffee with 「잔」 (cup). Count people with 「명」, books with 「권」 and animals with 「마리」.',
    mn: 'Кофе мэтийн уух зүйл тоолохдоо 「잔」 (аяга) хэрэглэнэ. Хүн тоолохдоо 「명」, ном тоолохдоо 「권」, амьтан тоолохдоо 「마리」 хэрэглэнэ.'},
  '편지는 우체국에서 보내요.': {
    en: 'You send a letter at the post office (「우체국」).',
    mn: 'Захидлыг шуудангаас (「우체국」) илгээдэг.'},
  '하고 싶은 일은 ‘-고 싶어요’로 말해요. 배가 고프니까 먹고 싶어요.': {
    en: 'Say what you want to do with 「-고 싶어요」. The speaker is hungry, so it is 「먹고 싶어요」 (want to eat).',
    mn: 'Хийхийг хүсэж буй зүйлээ хэлэхдээ 「-고 싶어요」 хэрэглэдэг. Өлссөн тул 「먹고 싶어요」 (идмээр байна) гэнэ.'},
  '날짜를 말하고 있으니까 생일이에요.': {
    en: 'The sentence gives a date, so it is 「생일」 (birthday).',
    mn: 'Өгүүлбэрт сар, өдөр хэлж байгаа тул 「생일」 (төрсөн өдөр) нь зөв.'},
  '도서관에서는 다른 사람을 위해 조용히 말해요.': {
    en: 'In a library, you speak quietly (「조용히」) for the sake of others.',
    mn: 'Номын санд бусдыг бодож аяархан (「조용히」) ярьдаг.'},
  '‘시간이 있으면’은 ‘시간이 있는 경우에는’이라는 뜻이에요. ‘같이 먹을까요?’처럼 함께 하자고 할 때는 앞에 ‘-아서/어서’를 쓰지 않아요.': {
    en: '「시간이 있으면」 means “if you have time”. When you suggest doing something together, as in 「같이 먹을까요?」 (Shall we eat together?), you don’t use 「-아서/어서」 before it.',
    mn: '「시간이 있으면」 нь «зав байвал» гэсэн утгатай. 「같이 먹을까요?」 (хамт идэх үү?) гэх мэтээр аливаа зүйлийг хамт хийхийг санал болгох үед түүний өмнө 「-아서/어서」 хэрэглэдэггүй.'},
  '아파서 할 수 없었던 일은 ‘못’으로 말해요. 감기 때문에 학교에 못 갔어요.': {
    en: 'Use 「못」 for something you couldn’t do because you were sick: 「감기 때문에 학교에 못 갔어요」 (I couldn’t go to school because of a cold).',
    mn: 'Өвдөөд хийж чадаагүй зүйлээ хэлэхдээ 「못」 хэрэглэдэг: 「감기 때문에 학교에 못 갔어요」 (ханиад хүрээд сургуульдаа явж чадаагүй).'},
  '옷이 커서 더 작은 옷을 찾아요.': {
    en: 'The clothes are too big, so the speaker wants smaller ones: 「작은」 (small).',
    mn: 'Хувцас том байгаа тул арай жижиг (「작은」) хувцас хайж байна.'},
  '‘끝난 후에’는 ‘끝나고 나서’라는 뜻이에요. ‘전에’를 쓰려면 ‘끝나기 전에’라고 해요.': {
    en: '「끝난 후에」 means “after it ends”. To use 「전에」 (before), you say 「끝나기 전에」 (before it ends).',
    mn: '「끝난 후에」 нь «дууссаны дараа» гэсэн утгатай. 「전에」 (өмнө) хэрэглэх бол 「끝나기 전에」 (дуусахаас өмнө) гэнэ.'},
  '‘아직’ 뒤에는 ‘안 했어요’처럼 하지 않은 일이 와요. 그래서 ‘아직 숙제를 안 했어요’가 맞아요. ‘했어요’와 ‘다 했어요’는 숙제를 끝냈다는 뜻이고, ‘할게요’는 앞으로 하겠다는 말이라서 ‘아직’과 맞지 않아요.': {
    en: 'After 「아직」 (yet, still) comes something not done, like 「안 했어요」, so 「아직 숙제를 안 했어요」 (I haven’t done my homework yet) is correct. 「했어요」 and 「다 했어요」 mean the homework is finished, and 「할게요」 says you will do it, so they don’t fit 「아직」.',
    mn: '「아직」 (хараахан) гэсний дараа 「안 했어요」 шиг хийгээгүйг илтгэх үг ордог. Тиймээс 「아직 숙제를 안 했어요」 (гэрийн даалгавраа хараахан хийгээгүй) нь зөв. 「했어요」, 「다 했어요」 нь даалгавраа хийж дууссан гэсэн утгатай, 「할게요」 нь цаашид хийнэ гэсэн үг тул 「아직」 гэдэгтэй таарахгүй.'},
  '길이 많이 막히니까 지하철을 타라고 권하는 말이에요. 그래서 ‘타세요’가 맞아요. ‘타지 마세요’는 반대 뜻이고, ‘타면’과 ‘타고’로는 문장이 끝나지 않아요.': {
    en: 'The road is jammed, so the speaker advises taking the subway: 「타세요」 (take). 「타지 마세요」 (don’t take) means the opposite, and a sentence can’t end with 「타면」 or 「타고」.',
    mn: 'Зам их түгжирсэн тул метронд суухыг зөвлөж байна. Тиймээс 「타세요」 (суугаарай) нь зөв. 「타지 마세요」 (битгий суугаарай) нь эсрэг утгатай, 「타면」, 「타고」 гэж өгүүлбэр төгсдөггүй.'},
  '앞으로 할 일은 ‘-(으)ㄹ 거예요’로 말해요. 그래서 ‘제가 도와줄 거예요’가 맞아요. ‘도와주고’, ‘도와줘서’, ‘도와주면’은 ‘거예요’ 앞에 올 수 없어요.': {
    en: 'Say what you are going to do with 「-(으)ㄹ 거예요」, so 「제가 도와줄 거예요」 (I’m going to help) is correct. 「도와주고」, 「도와줘서」 and 「도와주면」 can’t come before 「거예요」.',
    mn: 'Ирээдүйд хийх зүйлээ хэлэхдээ 「-(으)ㄹ 거예요」 хэрэглэдэг. Тиймээс 「제가 도와줄 거예요」 (би тусална) нь зөв. 「도와주고」, 「도와줘서」, 「도와주면」 нь 「거예요」 гэдгийн өмнө орж болохгүй.'},
  '비가 온 것이 소풍을 못 간 이유예요. 이유를 말할 때는 ‘-아서/어서’를 써요. 비가 와서 못 갔어요.': {
    en: 'The rain is why the picnic didn’t happen. To give a reason, use 「-아서/어서」: 「비가 와서 못 갔어요」 (we couldn’t go because it rained).',
    mn: 'Бороо орсон нь зугаалгаар явж чадаагүй шалтгаан юм. Шалтгааныг хэлэхдээ 「-아서/어서」 хэрэглэнэ: 「비가 와서 못 갔어요」 (бороо орсон тул явж чадаагүй).'},
  '좋은 점을 하나 더 말하니까 ‘그리고’예요.': {
    en: 'The speaker adds one more good point, so it is 「그리고」 (and).',
    mn: 'Бас нэг давуу талыг нь нэмж хэлж байгаа тул 「그리고」 (мөн) нь зөв.'},
  '하지 말아야 하는 일은 ‘-(으)면 안 돼요’로 말해요.': {
    en: 'Use 「-(으)면 안 돼요」 for something you must not do.',
    mn: 'Хийж болохгүй зүйлийг хэлэхдээ 「-(으)면 안 돼요」 хэрэглэдэг.'},
  '‘여행하는 동안’은 ‘여행하는 그 시간 내내’라는 뜻이에요.': {
    en: '「여행하는 동안」 means “the whole time I am traveling”.',
    mn: '「여행하는 동안」 нь «аялж байх хугацааны турш» гэсэн утгатай.'},
  '‘오늘 시험이 있어요’라고 했으니까 어젯밤에 공부를 많이 한 거예요. 그래서 ‘열심히’가 맞아요. ‘별로’와 ‘전혀’는 ‘안’, ‘못’ 같은 말과 같이 쓰고, ‘가끔’은 하룻밤의 일인 ‘어젯밤에’와 맞지 않아요.': {
    en: 'The speaker says 「오늘 시험이 있어요」 (I have an exam today), so they studied a lot last night: 「열심히」 (hard). 「별로」 (not really) and 「전혀」 (not at all) go with words like 「안」 and 「못」, and 「가끔」 (sometimes) doesn’t fit 「어젯밤에」 (last night), a single night.',
    mn: '「오늘 시험이 있어요」 (өнөөдөр шалгалттай) гэсэн тул өчигдөр шөнө их хичээллэсэн гэсэн үг. Тиймээс 「열심히」 (хичээнгүйлэн) нь зөв. 「별로」 (төдийлөн), 「전혀」 (огт) нь 「안」, 「못」 шиг үгүйсгэх үгтэй хамт хэрэглэгддэг, 「가끔」 (хааяа) нь ганц шөнийн тухай 「어젯밤에」 (өчигдөр шөнө) гэдэгтэй таарахгүй.'},
  '‘좋아해요’ 앞에는 ‘을/를’을 붙여요. ‘음식’은 받침이 있어서 ‘음식을’이에요. ‘이’는 ‘좋아요’ 앞에 붙이고, ‘에’와 ‘에서’는 때나 곳 뒤에 붙여요.': {
    en: 'Before 「좋아해요」 (like), add 「을/를」. 「음식」 (food) ends in a final consonant, so it is 「음식을」. 「이」 goes before 「좋아요」, and 「에」 and 「에서」 follow a time or a place.',
    mn: '「좋아해요」 (дуртай) гэдгийн өмнөх үгэнд 「을/를」 залгана. 「음식」 (хоол) нь дэвсгэр үсэгтэй тул 「음식을」 болно. 「이」 нь 「좋아요」 гэдгийн өмнөх үгэнд, 「에」, 「에서」 нь цаг хугацаа, газрын нэрийн ард залгагдана.'},
  '‘생일이라서’는 친구에게 줄 선물을 준비하는 상황이에요. 그래서 ‘샀어요’가 맞아요. ‘팔았어요’는 생일 선물과 이어지지 않고, 꽃은 입거나 먹는 것이 아니에요.': {
    en: '「생일이라서」 (because it’s their birthday) means the speaker is getting a gift for a friend, so 「샀어요」 (bought) is correct. 「팔았어요」 (sold) has nothing to do with a birthday gift, and flowers are not something you wear or eat.',
    mn: '「생일이라서」 (төрсөн өдөр нь тул) гэснээс найздаа өгөх бэлэг бэлдэж байгааг мэдэж болно. Тиймээс 「샀어요」 (худалдаж авсан) нь зөв. 「팔았어요」 (зарсан) нь төрсөн өдрийн бэлэгтэй холбоогүй, цэцэг бол өмсөх, идэх зүйл биш.'},
  '글에서 “오늘 쉼터는 찻집 안에 있습니다”라고 했어요. 밖의 자리는 “내일부터” 이용할 수 있어서 오늘은 찻집 밖에서 쉴 수 없어요.': {
    en: 'The notice says 「오늘 쉼터는 찻집 안에 있습니다」 (today the rest area is inside the tea house). The seats outside can be used 「내일부터」 (from tomorrow), so you can’t rest outside today.',
    mn: 'Эхэд 「오늘 쉼터는 찻집 안에 있습니다」 (өнөөдөр амрах газар цайны газрын дотор байна) гэжээ. Гаднах суудлыг 「내일부터」 (маргаашаас) ашиглаж болох тул өнөөдөр гадаа амрах боломжгүй.'},
  '“안내판 앞에서는 차를 마시지 마세요”라고 했어요. 쉼터의 의자와 찻집 안의 자리에서는 마셔도 돼요.': {
    en: 'It says 「안내판 앞에서는 차를 마시지 마세요」 (don’t drink tea in front of the sign). You may drink it on the rest-area chairs or at the seats inside the tea house.',
    mn: '「안내판 앞에서는 차를 마시지 마세요」 (мэдээллийн самбарын өмнө цай битгий уугаарай) гэжээ. Амрах газрын сандал болон цайны газрын доторх суудалд сууж ууж болно.'},
  '안내판의 그림을 먼저 확인한 뒤 쉼터로 와요.': {
    en: 'First you check the picture on the sign, and then you come to the rest area.',
    mn: 'Эхлээд мэдээллийн самбар дээрх зургийг үзээд, дараа нь амрах газарт ирнэ.'},
  '꽃 시장은 빵집 옆에서 열립니다.': {
    en: 'The flower market is held next to the bakery (「빵집 옆」).',
    mn: 'Цэцгийн зах талхны дэлгүүрийн хажууд (「빵집 옆」) байна.'},
  '한국어 책은 2층에 있습니다.': {
    en: 'The Korean books are on the second floor (「2층」).',
    mn: 'Солонгос хэл дээрх номууд 2-р давхарт (「2층」) байна.'},
  '글에서 “우산은 관리실에” 있다고 했어요. 안내 데스크에는 우산이 아니라 가방이 있어요.': {
    en: 'The notice says the umbrellas are 「관리실에」 (in the management office). At the information desk there are bags, not umbrellas.',
    mn: 'Эхэд шүхэр 「관리실에」 (жижүүрийн өрөөнд) байгаа гэжээ. Мэдээллийн ширээнд шүхэр биш, цүнх байна.'},
  '음악 공연은 무대 왼쪽에서 합니다.': {
    en: 'The music performance is on the left side of the stage (「무대 왼쪽」).',
    mn: 'Хөгжмийн тоглолт тайзны зүүн талд (「무대 왼쪽」) болно.'},
  '컵 만들기 수업은 오후 2시에 시작합니다.': {
    en: 'The cup-making class starts at 2 p.m. (「오후 2시」).',
    mn: 'Аяга хийх хичээл өдрийн 2 цагт (「오후 2시」) эхэлнэ.'},
  '꽃을 꺾지 말라고 했어요. 구경과 사진 촬영은 할 수 있어요.': {
    en: 'The notice says not to pick the flowers (「꽃은 꺾지 마세요」). Looking at them and taking photos are fine.',
    mn: 'Цэцэг битгий таслаарай (「꽃은 꺾지 마세요」) гэжээ. Харж, зураг авч болно.'},
  '글에서 “책장에 직접 꽂지 마세요”라고 했어요. 그래서 책장에 직접 꽂으면 안 돼요. “파란 바구니에 놓아 주세요”라고 했으니까 파란 바구니에 놓는 것은 해야 하는 행동이에요.': {
    en: 'The notice says 「책장에 직접 꽂지 마세요」 (don’t put them back on the shelf yourself), so that is what you must not do. It asks you to 「파란 바구니에 놓아 주세요」 (put them in the blue basket), so that is what you should do.',
    mn: 'Эхэд 「책장에 직접 꽂지 마세요」 (номын тавиурт өөрөө битгий тавиарай) гэсэн тул өөрөө тавиурт тавьж болохгүй. 「파란 바구니에 놓아 주세요」 (цэнхэр сагсанд хийнэ үү) гэсэн тул харин цэнхэр сагсанд хийх ёстой.'},
  '다리에서는 자전거를 타면 안 되고, 내려서 걸어가야 해요.': {
    en: 'On the bridge you must not ride a bicycle. You have to get off and walk.',
    mn: 'Гүүрэн дээр дугуй унаж болохгүй, буугаад алхах ёстой.'},
  '가위는 사용할 수 있지만 가져가면 안 됩니다.': {
    en: 'You may use the scissors, but you must not take them away.',
    mn: 'Хайч хэрэглэж болно, харин авч явж болохгүй.'},
  '“버스 문 앞에 서 있지 마세요”라고 했어요. 노란 선 뒤나 정류장의 의자 옆에서 기다리면 돼요.': {
    en: 'It says 「버스 문 앞에 서 있지 마세요」 (don’t stand in front of the bus door). You can wait behind the yellow line or next to the bench at the stop.',
    mn: '「버스 문 앞에 서 있지 마세요」 (автобусны хаалганы өмнө битгий зогсоорой) гэжээ. Шар шугамын ард эсвэл буудлын сандлын хажууд хүлээж болно.'},
  '“먼저 이름을 적어 주세요. 그다음 우산을 하나 고르고”라고 했어요. 그래서 우산을 고르기 전에 이름을 적어야 해요. 밖으로 나가는 것은 우산을 고른 다음이고, 우산을 돌려주는 것은 돌아올 때예요.': {
    en: 'It says 「먼저 이름을 적어 주세요. 그다음 우산을 하나 고르고」 (first write your name; then choose an umbrella), so you write your name before choosing one. You go outside after choosing it, and you give it back when you return.',
    mn: '「먼저 이름을 적어 주세요. 그다음 우산을 하나 고르고」 (эхлээд нэрээ бичнэ үү, дараа нь нэг шүхэр сонгоод) гэсэн тул шүхэр сонгохоосоо өмнө нэрээ бичих ёстой. Шүхрээ сонгосны дараа гадагш гардаг бөгөөд эргэж ирээд шүхрээ буцааж өгдөг.'},
  '“앞치마를 입고 나서 재료를 받으세요”라고 했어요. 손 씻기는 앞치마를 입기 전에 하는 일이고, 앞치마는 이미 입었어요.': {
    en: 'It says 「앞치마를 입고 나서 재료를 받으세요」 (after putting on the apron, get the materials). Washing your hands comes before the apron, and the apron is already on.',
    mn: '「앞치마를 입고 나서 재료를 받으세요」 (хормогчоо өмссөний дараа материалаа аваарай) гэжээ. Хормогчоо өмсөхөөс өмнө гараа угаадаг. Хормогчоо аль хэдийн өмсчихсөн байгаа.'},
  '선물을 넣고 상자를 닫은 뒤, 마지막에 이름을 씁니다.': {
    en: 'You put the gift in, close the box, and write the name last (「마지막에」).',
    mn: 'Бэлгээ хийж, хайрцгаа хаасны дараа хамгийн сүүлд (「마지막에」) нэрийг нь бичнэ.'},
  '화분에 흙을 “먼저” 넣고 “그다음” 씨앗을 심어요. 물은 씨앗을 심은 뒤에 줘요.': {
    en: 'You put soil in the pot 「먼저」 (first) and 「그다음」 (next) plant the seeds. You water them after planting.',
    mn: 'Цэцгийн саванд 「먼저」 (эхлээд) шороо хийгээд, 「그다음」 (дараа нь) үр тарина. Үрээ тарьсны дараа усална.'},
  '글에서 “산 표를 입구에서 보여 주세요. 그다음 안으로 들어가세요”라고 했어요. 그래서 표를 산 뒤 입구에서 표를 보여 주고 들어가요. 표는 매표소에서 사고 입구에서 보여 주니까, 안에서 사거나 매표소에서 보여 주는 것이 아니에요.': {
    en: 'The notice says 「산 표를 입구에서 보여 주세요. 그다음 안으로 들어가세요」 (show the ticket you bought at the entrance; then go in). So after buying a ticket, you show it at the entrance and go in. You buy it at the ticket booth and show it at the entrance, so you don’t buy it inside or show it at the booth.',
    mn: 'Эхэд 「산 표를 입구에서 보여 주세요. 그다음 안으로 들어가세요」 (худалдаж авсан тасалбараа үүдэнд үзүүлнэ үү, дараа нь дотогш орно уу) гэжээ. Тиймээс тасалбараа авсны дараа үүдэнд үзүүлээд ордог. Тасалбарыг кассаас авч, үүдэнд үзүүлдэг тул дотроос авах, кассад үзүүлэх нь буруу.'},
  '“저녁에 도서관 청소를 하기 때문입니다”라고 했어요. 그래서 오늘은 오후 3시에 문을 닫아요. 아침 9시는 내일 문을 여는 시간이고, 청소는 아침이 아니라 저녁에 해요.': {
    en: 'It says 「저녁에 도서관 청소를 하기 때문입니다」 (because the library will be cleaned in the evening), so it closes at 3 p.m. today. 9 a.m. is when it opens tomorrow, and the cleaning is in the evening, not the morning.',
    mn: '「저녁에 도서관 청소를 하기 때문입니다」 (орой номын санг цэвэрлэх тул) гэсэн учраас өнөөдөр өдрийн 3 цагт хаана. Өглөөний 9 цаг бол маргааш нээх цаг, цэвэрлэгээг өглөө биш, орой хийнэ.'},
  '오븐이 고장 나서 오늘은 빵을 굽지 못해요.': {
    en: 'The oven is broken (「오븐이 고장 나서」), so they can’t bake bread today.',
    mn: 'Зуух эвдэрсэн (「오븐이 고장 나서」) тул өнөөдөр талх барьж чадахгүй.'},
  '글에서 “오늘은 비가 많이 와서” 모임을 쉰다고 했어요. 비는 토요일이 아니라 오늘 오고, 토요일 아침은 다음 모임 시간이지 쉬는 이유가 아니에요.': {
    en: 'The notice says there is no walk 「오늘은 비가 많이 와서」 (because it is raining hard today). It is raining today, not on Saturday, and Saturday morning is the time of the next walk, not the reason.',
    mn: 'Эхэд 「오늘은 비가 많이 와서」 (өнөөдөр бороо их орж байгаа тул) алхалт болохгүй гэжээ. Бороо бямба гарагт биш, өнөөдөр орж байна. Бямба гарагийн өглөө бол дараагийн алхалтын цаг болохоос цуцалсан шалтгаан биш.'},
  '“시장 앞 길에서 축제를 하기 때문입니다”라고 했어요. 그래서 버스가 시장 앞에 서지 않아요. 다음 정류장에서 내리라는 것은 시장에 가는 방법이고, 축제는 다음 정류장이 아니라 시장 앞 길에서 해요.': {
    en: 'It says 「시장 앞 길에서 축제를 하기 때문입니다」 (because there is a festival on the street in front of the market), so the bus doesn’t stop there. Getting off at the next stop is how to get to the market, and the festival is on the street in front of the market, not at the next stop.',
    mn: '「시장 앞 길에서 축제를 하기 때문입니다」 (захын өмнөх гудамжинд баяр наадам болж байгаа тул) гэсэн учраас автобус захын өмнө зогсохгүй. Дараагийн буудал дээр буух нь зах руу очих арга, харин баяр наадам дараагийн буудал дээр биш, захын өмнөх гудамжинд болж байна.'},
  '꽃 시장에 꽃을 사러 가서 오늘 오후에는 꽃집 문을 열지 않아요.': {
    en: 'The owner has gone to the flower market to buy flowers (「꽃 시장에 꽃을 사러 가서」), so the shop isn’t open this afternoon.',
    mn: '「꽃 시장에 꽃을 사러 가서」 (цэцгийн зах руу цэцэг авахаар явах тул) гэсэн учраас өнөөдөр үдээс хойш цэцгийн дэлгүүр ажиллахгүй.'},
  '글에서 “시험 공부를 하는 학생이 많기 때문입니다”라고 했어요. 그래서 2층에서는 작은 소리로 이야기해야 해요. 1층에 카페가 있는 것은 맞지만 이유가 아니고, 2층에서 시험을 보는 것이 아니라 시험 공부를 해요.': {
    en: 'The notice says 「시험 공부를 하는 학생이 많기 때문입니다」 (because many students are studying for exams), so you have to speak softly on the second floor. There is a café on the first floor, but that isn’t the reason, and students on the second floor are studying for exams, not taking them.',
    mn: 'Эхэд 「시험 공부를 하는 학생이 많기 때문입니다」 (шалгалтад бэлдэж буй сурагч олон байгаа тул) гэсэн учраас 2-р давхарт аяархан ярих ёстой. 1-р давхарт кафе байгаа нь үнэн ч энэ нь шалтгаан биш. 2-р давхарт шалгалт авдаггүй, сурагчид шалгалтдаа бэлддэг.'},
  '수업 요일도, 신청 방법도 모두 어린이 수영 수업에 대한 말이에요.': {
    en: 'The day of the class and how to sign up are both about the children’s swimming class (「어린이 수영 수업」).',
    mn: 'Хичээлийн өдөр, бүртгүүлэх арга аль аль нь хүүхдийн усанд сэлэлтийн хичээлтэй (「어린이 수영 수업」) холбоотой.'},
  '종이컵을 덜 쓰고 싶어서 손님에게 자기 컵을 가지고 와 달라고 부탁하는 글이에요. 커피를 “500원 싸게 드립니다”라고 했으니 값이 오른 것이 아니고, “종이컵을 덜 쓰고 싶습니다”라고 했으니 종이컵을 더 쓰고 싶은 것도 아니에요.': {
    en: 'The café wants to use fewer paper cups, so it asks customers to bring their own. It says 「500원 싸게 드립니다」 (500 won off), so the price didn’t go up, and 「종이컵을 덜 쓰고 싶습니다」 (we want to use fewer paper cups), so it doesn’t want to use more.',
    mn: 'Цаасан аяга бага хэрэглэхийн тулд үйлчлүүлэгчдээс өөрийн аягаа авчрахыг хүсэж байна. Кофег 「500원 싸게 드립니다」 (500 воноор хямд өгнө) гэсэн тул үнэ нь нэмэгдээгүй. Мөн 「종이컵을 덜 쓰고 싶습니다」 (цаасан аяга бага хэрэглэмээр байна) гэсэн тул цаасан аяга илүү хэрэглэхийг хүсээгүй.'},
  '우체국이 다음 달에 은행 옆 새 건물로 이사한다는 안내예요.': {
    en: 'The notice says the post office is moving next month to a new building next to the bank.',
    mn: 'Шуудангийн салбар ирэх сард банкны хажуугийн шинэ байр луу нүүнэ гэсэн мэдэгдэл юм.'},
  '공원 앞에서 잃어버린 하얀 고양이를 찾고 있어요.': {
    en: 'The writer is looking for a white cat lost in front of the park.',
    mn: 'Цэцэрлэгт хүрээлэнгийн өмнө алга болсон цагаан муураа хайж байна.'},
  '“물건을 바꾸는 시장이 열립니다”, “다른 물건과 바꿀 수 있습니다”라고 했어요. 쓰지 않는 물건을 버리는 것이 아니라 가지고 와서 다른 물건과 바꾸는 시장을 알리는 안내예요. 마을 광장은 그 시장이 열리는 곳이에요.': {
    en: 'It says 「물건을 바꾸는 시장이 열립니다」 (a swap market will be held) and 「다른 물건과 바꿀 수 있습니다」 (you can trade for other things). You don’t throw unused things away; you bring them and swap them. The village square is where the market is held.',
    mn: '「물건을 바꾸는 시장이 열립니다」 (эд зүйл солилцох зах нээгдэнэ), 「다른 물건과 바꿀 수 있습니다」 (өөр зүйлээр сольж болно) гэжээ. Энэ нь хэрэглэдэггүй зүйлээ хаялгүй авчирч, өөр зүйлээр солих захын тухай мэдэгдэл юм. Тосгоны талбай бол уг зах болох газар юм.'},
  '“그분에게 정말 감사합니다”라고 했어요. 그래서 도와준 사람에게 고마운 마음을 전하는 글이에요. 병원에는 “빨리 갔습니다”라고 했고, 차는 다음에 마시고 싶다고 했으니 아직 같이 마시지 않았어요.': {
    en: 'It says 「그분에게 정말 감사합니다」 (I am truly thankful to that person), so the writer is thanking the person who helped. They got to the hospital quickly (「빨리 갔습니다」), and they want to have tea next time, so they haven’t had it together yet.',
    mn: '「그분에게 정말 감사합니다」 (тэр хүнд үнэхээр их талархаж байна) гэсэн тул энэ нь тусалсан хүнд талархал илэрхийлсэн бичвэр юм. Эмнэлэгт 「빨리 갔습니다」 (хурдан очсон) гэсэн. Мөн дараа нь хамт цай уумаар байна гэсэн тул хараахан хамт цай уугаагүй байна.'},
});
