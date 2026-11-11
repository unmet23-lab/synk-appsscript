#!/usr/bin/env node
'use strict';
/**
 * LAB 21:00 노래 · 나라별 판본 글 짓기(2026-11-12 Claude, 메들리 A 첫 비축).
 *
 *   node docs/마케팅/LAB_노래틀/틀/판본글짓기.cjs <편 폴더> [--입력 <판본입력.json>] [--키 US,CA,…]
 *     → <편>/remotion/src/판본/<KEY>.json(화면 글 — lang · bridge · mean · read · clap · say · real · end · coverAt · _원문)
 *       <편>/게시/판본/<KEY>/원고_<플랫폼>.json(게시글 — 플랫폼은 계정 원장 LAB 계정의 rotationVersion · countryCode에서)
 *
 * 나뉨: 나라마다 같은 것(손뼉 · 말하기 · 진짜 속도 딱지 · 끝 물음 꼴 · 게시글 꼴 · 해시태그)은 아래 「나라」 한 곳, 곡마다 다른 것(다리 글 ·
 * 뜻 · 끝 물음 속 뜻 · 표지 순간 · 존댓말 꼴)은 편 폴더의 판본입력.json. 같은 말 채널(유튜브 영어 다섯 · 스페인어 둘)은 다리 글 · 끝 물음 ·
 * 게시글 예문 줄이 서로 다르게 나라마다 꼴을 따로 뒀다(설계 6 · 올리기 전 검사 ⑫-2).
 * 발음 줄(read)은 tools/lib/한글표기.js 발음줄(낱말, 문자, { 음절: true }) — 표가 있는 문자(키릴 · 데바나가리)는 그 문자, 나머지는 로마자(결정 11-02 · 11-11).
 * 끝 물음의 따옴표 안 말은 화면에서 코랄로 칠해진다(Song.tsx — 낱말이 따옴표로 열고 닫혀야 한다: 따옴표 바로 뒤에는 띄어쓰기를 둔다).
 * 「_원문」은 역번역 대조 기준(한국어 뜻)이다. 게시글 규칙(첫 125자 해시태그 · 인사 · 상대 날짜 금지)은 tools/lib/게시글규칙.js.
 */
const fs = require('fs');
const path = require('path');

const 뿌리 = path.resolve(__dirname, '..', '..', '..', '..');
const 표기 = require(path.join(뿌리, 'tools', 'lib', '한글표기.js'));

// 나라마다 같은 것. {w} 한국어 낱말 · {r} 그 읽기 · {q} 따옴표 친 뜻 · {m} 화면 뜻 · {p} 존댓말 꼴 · {pr} 그 읽기
// _원문(K)은 기본 한국어 꼴(아래 기본K)을 쓰고, 뜻이 다른 나라만 K에 따로 적는다.
const 기본K = {
  clap: '박자에 맞춰 손뼉!', say: '네 차례 — 말해 봐!', real: '진짜 속도!',
  end: '너는 {qk}를 어떻게 말해?', // 나라 말 채널은 「제 식대로 어떻게 말해?」 — 이미 그 나라 말인 뜻을 「너희 말로」 다시 묻지 않는다(11-12)
  title: '{w} = {mk} 🎵 노래로 외우기',
  cap1: '한국어 한 낱말, 음절마다 한 박: {w}({r})는 {qk}라는 뜻.',
  cap2: '친구끼리 쓰는 반말. 존댓말은 {p}({pr}).',
  cap3: '노래가 멈춘 박에 손뼉 치고, 따라 불러 봐!',
  pin: '{w}를 제일 먼저 누구에게 말할 거야? 👇',
};
const 나라 = {
  US: { lang: 'en', 문자: 'latin', 따옴: ['“', '”'], clap: 'Clap on the beat!', say: 'Your turn — say it!', real: 'Natural speed!',
    end: 'How do you say {q} in your language?',
    title: 'Sing it: {w} = {m} 🎵 #learnkorean',
    cap1: 'One Korean word, one beat per syllable — {w} ({r}) means {q}.',
    cap2: 'Casual, for friends. Polite version: {p} ({pr}).',
    cap3: 'Clap during the break, then sing it back!',
    tags: '#learnkorean #koreanphrases #koreansong', pin: 'Who’s the first person you’d say {w} to? 👇',
    K: { real: '자연스러운 속도!', end: '너희 말로는 {qk}를 뭐라고 해?', title: '따라 불러: {w} = {mk} 🎵', cap3: '쉬는 구간에 손뼉 치고, 따라 불러 봐!' } },
  CA: { lang: 'en', 문자: 'latin', 따옴: ['“', '”'], clap: 'Clap along to the beat!', say: 'Now you — say it out loud!', real: 'At natural speed!',
    end: 'What’s {q} in your language?',
    title: '{w} = {m} — learn it in one song 🎵 #learnkorean',
    cap1: 'Sing along and {w} ({r}) will stick — it means {q}.',
    cap2: 'Use it with friends. Want to be polite? Say {p} ({pr}).',
    cap3: 'When the singing pauses, it’s your turn — say it out loud!',
    tags: '#learnkorean #koreanlanguage #koreanphrases', pin: 'Where would you use {w} first? 👇',
    K: { clap: '박자에 맞춰 같이 손뼉!', say: '이제 너 — 소리 내 말해 봐!', real: '자연스러운 속도로!', end: '너희 말로 {qk}는 뭐야?', title: '{w} = {mk} — 노래 한 곡으로 배우기 🎵',
      cap1: '따라 부르면 {w}({r})가 머리에 붙는다: {qk}라는 뜻.', cap2: '친구끼리 써. 공손하게 말하고 싶으면? {p}({pr})라고 해.', cap3: '노래가 멈추면 네 차례 — 소리 내 말해 봐!', pin: '{w}를 어디서 제일 먼저 쓸 거야? 👇' } },
  AU: { lang: 'en', 문자: 'latin', 따옴: ['“', '”'], clap: 'Clap on the beat!', say: 'Your go — say it!', real: 'Normal speed!',
    end: 'And how do you say {q} where you’re from?',
    title: 'Korean in one song: {w} ({m}) 🎵 #learnkorean',
    cap1: '{w} ({r}) is how Koreans say {q} — sing it and it sticks.',
    cap2: 'That’s the casual one for mates. Polite: {p} ({pr}).',
    cap3: 'Clap in the gap, then have a go yourself!',
    tags: '#learnkorean #koreanwords #koreanphrases', pin: 'Tag the mate who’d say {w} the most 👇',
    K: { say: '네 차례 — 말해 봐!', real: '보통 속도!', end: '그리고 너희 동네 말로는 {qk}를 어떻게 말해?', title: '노래 한 곡으로 한국어: {w}({mk}) 🎵',
      cap1: '{w}({r})는 한국 사람이 {qk}라고 할 때 쓰는 말 — 부르면 외워진다.', cap2: '친구끼리 쓰는 반말. 존댓말: {p}({pr}).', cap3: '빈 틈에 손뼉 치고, 네가 해 봐!', pin: '{w}를 제일 많이 말할 친구를 태그해 👇' } },
  NZ: { lang: 'en', 문자: 'latin', 따옴: ['“', '”'], clap: 'Clap to the beat!', say: 'You’re up — say it!', real: 'Full speed!',
    end: 'How would you say {q} in your language?',
    title: 'Learn {w} ({q}) by singing it 🎵 #learnkorean',
    cap1: 'Learn {w} ({r}) the catchy way — it means {q}.',
    cap2: 'Casual Korean for friends and family. Polite form: {p} ({pr}).',
    cap3: 'Clap when the singing stops, then you’re up!',
    tags: '#learnkorean #koreanlanguage #learnkoreanfast', pin: 'Who would you say {w} to first? 👇',
    K: { clap: '박자에 맞춰 손뼉!', say: '네 차례 — 말해 봐!', real: '제 속도로!', end: '너희 말로는 {qk}를 어떻게 말하겠어?', title: '{w}({qk}), 불러서 배우기 🎵',
      cap1: '귀에 붙는 방법으로 {w}({r})를 배워 — {qk}라는 뜻.', cap2: '친구 · 가족끼리 쓰는 반말. 존댓말: {p}({pr}).', cap3: '노래가 멈추면 손뼉, 그다음 네 차례!', pin: '{w}를 누구에게 제일 먼저 말할 거야? 👇' } },
  EN: { lang: 'en', 문자: 'latin', 따옴: ['“', '”'], clap: 'Clap with the beat!', say: 'Your turn — sing it!', real: 'Native speed!',
    end: 'In your language, how do you say {q}?',
    title: '{w} means {m} — sing along 🎵 #learnkorean',
    cap1: 'Hear it, clap it, say it: {w} ({r}) = {q}.',
    cap2: 'This is casual Korean. To be polite, add 요: {p} ({pr}).',
    cap3: 'Say it on the beat when it’s your turn, and you’ve got it!',
    tags: '#learnkorean #koreanphrases #studykorean', pin: 'Comment {w} if you sang along 👇',
    K: { clap: '박자와 함께 손뼉!', say: '네 차례 — 불러 봐!', real: '원어민 속도!', end: '너희 말로는 {qk}를 어떻게 말해?', cap3: '네 차례에 박에 맞춰 말하면 다 배운 거야!', title: '{w}는 {mk}라는 뜻 — 따라 불러 🎵',
      cap1: '듣고, 손뼉 치고, 말해: {w}({r}) = {qk}.', cap2: '반말이다. 공손하게 하려면 요를 붙여: {p}({pr}).', cap3: '빈 박에 말하면 다 배운 거야!', pin: '따라 불렀으면 댓글에 {w} 👇' } },
  PH: { lang: 'fil', 문자: 'latin', 따옴: ['“', '”'], clap: 'Pumalakpak sa beat!', say: 'Ikaw naman — sabihin mo!', real: 'Normal na bilis!',
    end: 'Ikaw, paano mo sinasabi ang {q}?',
    title: '{w} = {m} 🎵 Kantahin sa Korean #learnkorean',
    cap1: 'Isang salitang Korean, isang beat bawat pantig — ang {w} ({r}) ay {q}.',
    cap2: 'Pambarkada ito. Magalang na bersyon: {p} ({pr}).',
    cap3: 'Pumalakpak sa tahimik na bahagi, tapos kantahin mo!',
    tags: '#learnkorean #koreanlanguage #pinoykorean', pin: 'Kanino mo unang sasabihin ang {w}? 👇',
    K: { say: '이번엔 너 — 말해 봐!', real: '보통 빠르기!', end: '너는 {qk}를 평소에 어떻게 말해?', title: '{w} = {mk} 🎵 한국어로 불러 봐' } },
  BR: { lang: 'pt-BR', 문자: 'latin', 따옴: ['“', '”'], clap: 'Bate palma no ritmo!', say: 'Sua vez — fala!', real: 'Na velocidade real!',
    end: 'E você, como fala {q}?',
    title: '{w} = {m} 🎵 Aprenda cantando #aprendercoreano',
    cap1: 'Uma palavra em coreano, uma batida por sílaba: {w} ({r}) quer dizer {q}.',
    cap2: 'É informal, pra usar com amigos. Versão educada: {p} ({pr}).',
    cap3: 'Bate palma na pausa e depois canta junto!',
    tags: '#aprendercoreano #coreano #palavrasemcoreano', pin: 'Pra quem você diria {w} primeiro? 👇',
    K: { real: '진짜 속도로!', end: '그럼 너는 {qk}를 어떻게 말해?' } },
  MX: { lang: 'es', 문자: 'latin', 따옴: ['“', '”'], clap: '¡Aplaude al ritmo!', say: '¡Te toca! ¡Dilo!', real: '¡Velocidad real!',
    end: '¿Y tú cómo dices {q}?',
    title: '{w} = {m} 🎵 Apréndelo cantando #aprendecoreano',
    cap1: 'Una palabra en coreano, un golpe por sílaba: {w} ({r}) significa {q}.',
    cap2: 'Es informal, para tus amigos. Versión formal: {p} ({pr}).',
    cap3: '¡Aplaude en la pausa y luego cántalo tú!',
    tags: '#aprendecoreano #coreano #palabrasencoreano', pin: '¿A quién le dirías {w} primero? 👇',
    K: { title: '{w} = {mk} 🎵 노래로 배워', end: '그럼 너는 {qk}를 어떻게 말해?' } },
  PY: { lang: 'es', 문자: 'latin', 따옴: ['“', '”'], clap: '¡Aplaudí al ritmo!', say: '¡Te toca! ¡Decilo!', real: '¡A velocidad real!',
    end: '¿Y vos cómo decís {q}?',
    title: 'Aprendé cantando: {w} = {q} 🎵 #aprendecoreano',
    cap1: 'Cantá y se te queda: {w} ({r}) quiere decir {q}.',
    cap2: 'Es informal, entre amigos. Si querés ser formal: {p} ({pr}).',
    cap3: '¡Aplaudí en el silencio y después decilo vos!',
    tags: '#aprendecoreano #coreano #coreanofacil', pin: '¿A quién le dirías {w} primero? Contanos 👇',
    K: { real: '진짜 속도로!', end: '그럼 너는 {qk}를 어떻게 말해?', title: '노래로 배워: {w} = {qk} 🎵', cap1: '부르면 머리에 남는다: {w}({r})는 {qk}라는 뜻.',
      cap2: '친구끼리 쓰는 반말. 격식을 차리려면: {p}({pr}).', cap3: '조용할 때 손뼉 치고, 그다음 네가 말해 봐!', pin: '{w}를 누구에게 제일 먼저 말할 거야? 알려 줘 👇' } },
  CN: { lang: 'zh-Hans', 문자: 'latin', 따옴: ['“', '”'], clap: '跟着节拍拍手！', say: '轮到你了——说出来！', real: '真实语速！',
    end: '{q} 你平时怎么说？',
    title: '{w} = {m} 🎵 唱一遍就记住',
    cap1: '一个韩语词，一个音节一拍：{w}（{r}）就是{q}。',
    cap2: '朋友之间说的非敬语。礼貌说法：{p}（{pr}）。',
    cap3: '空拍时拍手，然后跟着唱！',
    tags: '#韩语 #韩语学习 #韩语单词', pin: '你最想先对谁说 {w}？👇' },
  TW: { lang: 'zh-Hant', 문자: 'latin', 따옴: ['「', '」'], clap: '跟著節拍拍手！', say: '換你了——說說看！', real: '真實語速！',
    end: '{q} 你平常都怎麼說？',
    title: '{w} = {m} 🎵 唱一次就記住 #韓文',
    cap1: '一個韓文單字，一個音節一拍：{w}（{r}）就是{q}。',
    cap2: '朋友之間用的半語。有禮貌的說法：{p}（{pr}）。',
    cap3: '空拍時拍手，接著換你唱！',
    tags: '#韓文 #學韓文 #韓語', pin: '你最想先對誰說 {w}？留言告訴我👇',
    K: { pin: '{w}를 제일 먼저 누구에게 말하고 싶어? 댓글로 알려 줘 👇' } },
  JP: { lang: 'ja', 문자: 'latin', 따옴: ['「', '」'], clap: 'リズムに合わせて手拍子！', say: 'あなたの番！ 言ってみて！', real: '普通の速さ！',
    end: '{q} あなたならどう言\u2060う？', // 낱말 이음(U+2060) — 「言|う」로 갈리지 않게(11-12 글자 검사)
    title: '{w}＝{m} 🎵 歌って覚える韓国語 #韓国語',
    cap1: '韓国語のひとことを、1音節1拍のリズムで。{w}（{r}）は{q}という意味。',
    cap2: '友だち同士のタメ口。ていねいに言うなら {p}（{pr}）。',
    cap3: '歌が止まったら手拍子、そのあと一緒に歌ってみて！',
    tags: '#韓国語 #韓国語勉強 #韓国語単語', pin: '最初に {w} って言いたい相手は誰？👇',
    K: { real: '보통 빠르기!', end: '{qk}, 너라면 어떻게 말해?', title: '{w} = {mk} 🎵 노래로 외우는 한국어', pin: '처음으로 {w}라고 말하고 싶은 상대는 누구야? 👇' } },
  TH: { lang: 'th', 문자: 'latin', 따옴: ['“', '”'], clap: 'ปรบมือตามจังหวะ!', say: 'ตาคุณแล้ว — พูดเลย!', real: 'ความเร็วจริง!',
    end: '{q} คุณพูดแบบไหน?',
    title: '{w} = {m} 🎵 ร้องตามแล้วจำได้เลย #เรียนภาษาเกาหลี',
    cap1: 'ภาษาเกาหลี 1 คำในคลิปนี้คือ {w} ({r}) ออกเสียงจังหวะละ 1 พยางค์ แปลว่า {q}',
    cap2: 'เป็นคำกันเองใช้กับเพื่อน แบบสุภาพคือ {p} ({pr})',
    cap3: 'ปรบมือช่วงจังหวะว่าง แล้วร้องตามเลย!',
    tags: '#เรียนภาษาเกาหลี #ภาษาเกาหลี #คำศัพท์เกาหลี', pin: 'คุณอยากพูดคำว่า {w} กับใครเป็นคนแรก? 👇' },
  VN: { lang: 'vi', 문자: 'latin', 따옴: ['“', '”'], clap: 'Vỗ tay theo nhịp!', say: 'Đến lượt bạn — nói to lên nào!', real: 'Tốc độ tự nhiên!',
    end: '{q} bạn thường nói thế nào?',
    title: '{w} = {m} 🎵 Hát theo là nhớ #hoctienghan',
    cap1: 'Một từ tiếng Hàn, mỗi âm tiết một nhịp: {w} ({r}) nghĩa là {q}.',
    cap2: 'Cách nói thân mật với bạn bè. Lịch sự hơn thì nói {p} ({pr}).',
    cap3: 'Vỗ tay vào nhịp nghỉ rồi hát theo nhé!',
    tags: '#hoctienghan #tienghan #tuvungtienghan', pin: 'Bạn muốn nói {w} với ai đầu tiên? 👇',
    K: { say: '네 차례 — 크게 말해 봐!', real: '자연스러운 속도!' } },
  ID: { lang: 'id', 문자: 'latin', 따옴: ['“', '”'], clap: 'Tepuk tangan sesuai irama!', say: 'Giliranmu — ucapkan!', real: 'Kecepatan asli!',
    end: 'Kalau kamu, bilang {q} gimana?',
    title: '{w} = {m} 🎵 Nyanyi sekali langsung hafal #belajarbahasakorea',
    cap1: 'Satu kata Korea, satu ketukan per suku kata: {w} ({r}) artinya {q}.',
    cap2: 'Ini bahasa santai buat teman. Versi sopan: {p} ({pr}).',
    cap3: 'Tepuk tangan saat jeda, lalu nyanyikan!',
    tags: '#belajarbahasakorea #bahasakorea #kosakatakorea', pin: 'Kamu mau bilang {w} ke siapa duluan? 👇' },
  MY: { lang: 'ms', 문자: 'latin', 따옴: ['“', '”'], clap: 'Tepuk tangan ikut rentak!', say: 'Giliran awak — sebut!', real: 'Kelajuan sebenar!',
    end: 'Korang sebut {q} macam mana?',
    title: '{w} = {m} 🎵 Nyanyi terus ingat #belajarkorea',
    cap1: 'Satu perkataan Korea, satu rentak setiap suku kata: {w} ({r}) maksudnya {q}.',
    cap2: 'Ini cara santai bila cakap dengan kawan. Versi sopan: {p} ({pr}).',
    cap3: 'Tepuk tangan masa muzik berhenti, lepas tu nyanyi sama-sama!',
    tags: '#belajarkorea #bahasakorea #koreanmalaysia', pin: 'Awak nak cakap {w} pada siapa dulu? 👇' },
  IN: { lang: 'hi', 문자: 'hi', 따옴: ['“', '”'], clap: 'ताल पर ताली बजाओ!', say: 'अब तुम्हारी बारी — बोलो!', real: 'असली रफ़्तार!',
    end: 'तुम {q} कैसे बोलते हो?',
    title: '{w} = {m} 🎵 गाकर सीखो #learnkorean',
    cap1: 'एक कोरियन शब्द, हर अक्षर पर एक ताल: {w} ({r}) का मतलब है {q}।',
    cap2: 'यह दोस्तों से बोलने का तरीका है। आदर से कहना हो तो: {p} ({pr})।',
    cap3: 'गाना रुके तो ताली बजाओ, फिर साथ में गाओ!',
    tags: '#learnkorean #koreanlanguage #कोरियन', pin: 'तुम सबसे पहले किससे {w} कहोगे? 👇' },
  NP: { lang: 'ne', 문자: 'ne', 따옴: ['“', '”'], clap: 'तालमा ताली बजाऊ!', say: 'अब तिम्रो पालो — भन!', real: 'सामान्य गति!',
    end: 'तिमी {q} कसरी भन्छौ?',
    title: '{w} = {m} 🎵 गाएर सिक',
    cap1: 'एउटा कोरियन शब्द, हरेक अक्षरमा एक ताल: {w} ({r}) को अर्थ {q} हो।',
    cap2: 'यो साथीहरूबीच बोलिने शब्द हो। आदरपूर्वक भन्दा: {p} ({pr})।',
    cap3: 'गीत रोकिँदा ताली बजाऊ, अनि सँगै गाऊ!',
    tags: '#कोरियनभाषा #कोरियन #learnkorean', pin: 'तिमी सबैभन्दा पहिले कसलाई {w} भन्छौ? 👇',
    K: { real: '보통 속도!' } },
  LK: { lang: 'si', 문자: 'latin', 따옴: ['“', '”'], clap: 'තාලයට අත්පුඩි ගහන්න!', say: 'දැන් ඔයාගේ වාරය — කියන්න!', real: 'සාමාන්‍ය වේගයෙන්!',
    end: 'ඔයා {q} කියන්නේ කොහොමද?',
    title: '{w} = {m} 🎵 සින්දුවෙන් මතක තියාගන්න #learnkorean',
    cap1: 'එක කොරියන් වචනයක්, අකුරකට එක බීට් එකක්: {w} ({r}) කියන්නේ {q}.',
    cap2: 'මේක යාළුවෝ අතරේ කියන විදිහ. ගෞරවයෙන් කියනවා නම්: {p} ({pr}).',
    cap3: 'සින්දුව නවතින තැන අත්පුඩි ගහලා, ඊට පස්සේ එකට කියන්න!',
    tags: '#learnkorean #කොරියන් #කොරියන්භාෂාව', pin: 'ඔයා මුලින්ම {w} කියන්නේ කාටද? 👇',
    K: { real: '보통 속도로!' } },
  MM: { lang: 'my', 문자: 'latin', 따옴: ['“', '”'], clap: 'စည်းချက်အတိုင်း လက်ခုပ်တီးပါ!', say: 'မင်းအလှည့် — ပြောကြည့်!', real: 'တကယ့်အမြန်နှုန်း!',
    end: '{q} ကို မင်းက ဘယ်လို\u2060ပြော\u2060လဲ?', // 「ပြော|လဲ」 동사 · 물음 토씨를 한 덩이로
    title: '{w} = {m} 🎵 သီချင်းနဲ့ မှတ်မယ် #learnkorean',
    cap1: 'ကိုရီးယားစကားလုံးတစ်လုံး၊ အသံတစ်ချက်ကို စည်းချက်တစ်ချက်: {w} ({r}) ဆိုတာ {q} ပါ။',
    cap2: 'သူငယ်ချင်းတွေကြား ပြောတဲ့ပုံစံပါ။ ယဉ်ကျေးတဲ့ပုံစံ: {p} ({pr})။',
    cap3: 'သီချင်းရပ်တဲ့နေရာမှာ လက်ခုပ်တီးပြီး လိုက်ဆိုကြည့်!',
    tags: '#ကိုရီးယားစကား #ကိုရီးယား #learnkorean', pin: '{w} ကို ဘယ်သူ့ကို အရင်ဆုံး ပြောချင်လဲ? 👇' },
  KH: { lang: 'km', 문자: 'latin', 따옴: ['“', '”'], clap: 'ទះដៃតាមចង្វាក់!', say: 'ដល់វេនអ្នកហើយ — និយាយមើល!', real: 'ល្បឿនពិត!',
    end: '{q} អ្នកនិយាយយ៉ាង\u2060ម៉េច?', // 「យ៉ាង|ម៉េច」 한 낱말
    title: '{w} = {m} 🎵 ច្រៀងតាមហើយចាំបាន',
    cap1: 'ពាក្យកូរ៉េមួយម៉ាត់ — មួយព្យាង្គ មួយចង្វាក់៖ {w} ({r}) មានន័យថា {q}។',
    cap2: 'ជាពាក្យស្និទ្ធស្នាលសម្រាប់ប្រើជាមួយមិត្តភក្តិ។ បើចង់និយាយឱ្យគួរសម៖ {p} ({pr})។',
    cap3: 'ទះដៃពេលចម្រៀងស្ងាត់ រួចច្រៀងតាមម្តង!',
    tags: '#រៀនភាសាកូរ៉េ #ភាសាកូរ៉េ #learnkorean', pin: 'តើអ្នកចង់និយាយ {w} ទៅកាន់នរណាមុនគេ? 👇' },
  MN: { lang: 'mn', 문자: 'mn', 따옴: ['«', '»'], clap: 'Хэмнэлээр алга таш!', say: 'Одоо чиний ээлж — хэлээд үз!', real: 'Энгийн хурдаар!',
    end: 'Чи {q} гэдгийг яаж хэлдэг вэ?',
    title: '{w} = {m} 🎵 Дуулаад цээжил',
    cap1: 'Нэг солонгос үг, үе бүрд нэг цохилт: {w} ({r}) гэдэг нь {q} гэсэн үг.',
    cap2: 'Найзууддаа хэлдэг энгийн үг. Эелдэг хэлбэр нь: {p} ({pr}).',
    cap3: 'Дуу зогсоход алга ташаад, дараа нь хамт дуул!',
    tags: '#солонгосхэл #солонгосхэлсурах #learnkorean', pin: 'Чи {w} гэж хамгийн түрүүнд хэнд хэлэх вэ? 👇',
    K: { real: '보통 속도로!' } },
  RU: { lang: 'ru', 문자: 'ru', 따옴: ['«', '»'], clap: 'Хлопай в ритм!', say: 'Твоя очередь — повтори!', real: 'Реальная скорость!',
    end: 'А ты как говоришь {q}?',
    title: '{w} = {m} 🎵 Корейский в одной песне',
    cap1: 'Одно корейское слово, по слогу на каждый бит: {w} ({r}) значит {q}.',
    cap2: 'Это неформально, для друзей. Вежливо: {p} ({pr}).',
    cap3: 'Хлопай в паузе, а потом пой вместе с нами!',
    tags: '#корейскийязык #учимкорейский #корея', pin: 'Кому ты первым скажешь {w}? 👇',
    K: { say: '네 차례 — 따라 말해!', title: '{w} = {mk} 🎵 노래 한 곡으로 한국어', cap3: '쉬는 구간에 손뼉 치고, 그다음 우리랑 같이 불러!' } },
  KZ: { lang: 'kk', 문자: 'kk', 따옴: ['«', '»'], clap: 'Ырғақпен алақан соқ!', say: 'Енді сенің кезегің — айтып көр!', real: 'Қалыпты жылдамдық!',
    end: 'Сен {q} дегенді қалай айтасың?',
    title: '{w} = {m} 🎵 Әнмен жаттап ал',
    cap1: 'Бір корей сөзі, әр буынға бір қағыс: {w} ({r}) — {q} деген сөз.',
    cap2: 'Бұл достар арасында айтылатын сөз. Сыпайы түрі: {p} ({pr}).',
    cap3: 'Ән тоқтағанда алақан соқ, сосын бірге айт!',
    tags: '#корейтілі #корейше #learnkorean', pin: '{w} деп ең бірінші кімге айтасың? 👇',
    K: { clap: '박자에 맞춰 손뼉 쳐!', real: '보통 빠르기!' } },
  KG: { lang: 'ky', 문자: 'ky', 따옴: ['«', '»'], clap: 'Ыргак менен кол чап!', say: 'Эми сенин кезегиң — айтып көр!', real: 'Чыныгы ылдамдык!',
    end: 'Сен {q} дегенди кантип айтасың?',
    title: '{w} = {m} 🎵 Ыр менен үйрөн #learnkorean',
    cap1: 'Бир корей сөзү, ар бир муунуна бирден такт: {w} ({r}) — {q} дегенди билдирет.',
    cap2: 'Бул досторго айтылчу сөз. Сылык түрү: {p} ({pr}).',
    cap3: 'Ыр токтогондо кол чап, анан чогуу ырда!',
    tags: '#корейтили #корейче #learnkorean', pin: '{w} деп биринчи кимге айтмаксың? 👇' },
  UZ: { lang: 'uz', 문자: 'latin', 따옴: ['“', '”'], clap: 'Ritmga mos qarsak chal!', say: 'Endi sening navbating — ayt!', real: 'Tabiiy tezlikda!',
    end: 'Sen {q} degan gapni qanday aytasan?',
    title: '{w} = {m} 🎵 Qoʻshiq bilan yodla',
    cap1: 'Bitta koreyscha soʻz, har boʻgʻinga bitta zarb: {w} ({r}) — {q} degani.',
    cap2: 'Bu doʻstlar orasida aytiladigan soʻz. Hurmat shaklida: {p} ({pr}).',
    cap3: 'Qoʻshiq toʻxtaganda qarsak chal, keyin birga kuyla!',
    tags: '#koreystili #koreys #learnkorean', pin: '{w} deb birinchi kimga aytasan? 👇',
    K: { real: '자연스러운 속도로!', cap2: '친구끼리 쓰는 말. 존댓말 꼴: {p}({pr}).' } },
};

const 인자 = process.argv.slice(2);
const 값 = (n) => { const i = 인자.indexOf(n); return i > -1 ? 인자[i + 1] : null; };
const 편 = 인자.find((a) => !a.startsWith('--') && a !== 값('--입력') && a !== 값('--키'));
if (!편) { console.error('사용: node 판본글짓기.cjs <편 폴더> [--입력 <판본입력.json>] [--키 US,CA,…]'); process.exit(2); }
const 편폴더 = path.resolve(편);
const 입력 = JSON.parse(fs.readFileSync(path.resolve(값('--입력') || path.join(편폴더, '판본입력.json')), 'utf8'));
const 원장 = JSON.parse(fs.readFileSync(path.join(뿌리, 'docs', '마케팅', 'sns-계정.json'), 'utf8'));
const 플랫폼 = {};
for (const a of Object.values(원장.accounts)) {
  if (a.brand !== 'LAB' || !(a.dailyFormats || []).includes('노래')) continue;
  const k = a.rotationVersion || a.countryCode;
  (플랫폼[k] = 플랫폼[k] || new Set()).add(a.platform);
}
const 키들 = 값('--키') ? 값('--키').split(',').map((k) => k.trim().toUpperCase()) : Object.keys(입력.나라);

const 채움 = (틀, 값들) => 틀.replace(/\{(\w+)\}/g, (_m, k) => { if (!(k in 값들)) throw new Error(`틀 칸 {${k}} 값이 없다`); return 값들[k]; });
function 읽기(낱말, 문자) {
  const r = 표기.발음줄(낱말, 문자);
  return { 줄: 문자 === 'latin' || r.문자 === 'latin' ? 표기.발음줄(낱말, 'latin', { 음절: true }).음절.join('-') + (/[?!]$/.test(낱말) ? '' : '') : r.줄, 문자: r.문자, 금칙: r.금칙 };
}

const 기록 = [];
for (const 키 of 키들) {
  const n = 나라[키];
  const s = 입력.나라[키];
  if (!n) throw new Error(`나라 꼴이 없다: ${키}`);
  if (!s) throw new Error(`판본입력에 ${키}가 없다`);
  const K = { ...기본K, ...(n.K || {}) };
  const 낱말 = 입력.낱말;
  const rd = 표기.발음줄(낱말, n.문자, { 음절: true });
  const read = rd.음절;
  const r = 읽기(낱말, n.문자);
  const pr = 읽기(입력.존댓말.replace(/[?!]/g, ''), n.문자);
  const v = { w: 낱말, r: r.줄, m: s.mean.replace(/[!！?？。.]+$/u, '').replace(/^[¡¿]/, ''), q: `${n.따옴[0]}${s.qm}${n.따옴[1]}`,
    p: 입력.존댓말.replace(/[?!]/g, ''), pr: pr.줄 }; // 게시글 속 존댓말 꼴은 물음표 없이(스페인어 「¿」 규칙 — 「진짜요」 자체가 꼴)
  const vk = { w: 낱말, r: r.줄, mk: 입력.뜻K, qk: `「${입력.뜻K}」`, p: 입력.존댓말.replace(/[?!]/g, ''), pr: pr.줄 };
  const 판본 = {
    lang: n.lang, bridge: s.bridge, mean: s.mean, read, clap: n.clap, say: n.say, real: n.real, end: 채움(s.end || n.end, v), // 판본입력 나라 줄 「end」 · 「endK」 = 그 곡만 덮어쓰는 끝 물음 꼴
    _원문: { bridge: s.bridgeK || 입력.다리K, mean: `${입력.뜻K}${/[?!]$/.test(입력.뜻K) ? '' : '!'}`, clap: K.clap, say: K.say, real: K.real, end: 채움(s.endK || K.end, vk) },
    _발음: { 문자: rd.문자, ...(rd.금칙 ? { 금칙: rd.금칙 } : {}), 도구: 'tools/lib/한글표기.js 발음줄(낱말, 문자, { 음절: true })' },
    coverAt: 입력.coverAt,
  };
  const 글폴더 = path.join(편폴더, 'remotion', 'src', '판본');
  fs.mkdirSync(글폴더, { recursive: true });
  fs.writeFileSync(path.join(글폴더, `${키}.json`), JSON.stringify(판본, null, 1) + '\n');

  const 캡션 = [채움(n.cap1, v), 채움(n.cap2, v), 채움(n.cap3, v), '', 'SYNK LAB', n.tags].join('\n');
  const 캡션K = [채움(K.cap1, vk), 채움(K.cap2, vk), 채움(K.cap3, vk), '', 'SYNK LAB', n.tags].join('\n');
  const 낼곳 = path.join(편폴더, '게시', '판본', 키);
  fs.mkdirSync(낼곳, { recursive: true });
  const 플 = [...(플랫폼[키] || [])].sort();
  if (!플.length) throw new Error(`${키}: 원장에 노래 칸이 있는 LAB 계정이 없다`);
  for (const p of 플) {
    const 원고 = { id: `판본-${키}-${p}`, brand: 'LAB', platform: p, language: n.lang, alteredContent: false };
    const 원 = {};
    if (p === 'youtube') Object.assign(원고, { audioLanguage: n.lang, format: 'shorts', madeForKids: false, category: 'Education' });
    if (p === 'youtube' || p === 'rutube' || p === 'xiaohongshu') { 원고.title = 채움(n.title, v); 원.title = 채움(K.title, vk); }
    원고.caption = 캡션; 원.caption = 캡션K;
    if (p === 'youtube') { 원고.pinnedComment = 채움(n.pin, v); 원.pinnedComment = 채움(K.pin, vk); }
    원고._원문 = 원;
    원고._칸 = { caption: { 2: '예문' } };
    fs.writeFileSync(path.join(낼곳, `원고_${p}.json`), JSON.stringify(원고, null, 2) + '\n');
  }
  기록.push(`${키} ${n.lang} 읽기 ${read.join('·')}(${rd.문자}${rd.금칙 ? ' · 금칙 → 로마자' : ''}) · 원고 ${플.join(' · ')}`);
}
console.log(기록.join('\n'));
