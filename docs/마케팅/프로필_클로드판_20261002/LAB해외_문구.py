"""해외 LAB 24개 계정 소개·배너 문구(클로드판 2차) 원본.

    python LAB해외_문구.py      # 계정별_문구_LAB해외.json을 쓰고 글자 수를 검사한다

모든 계정이 같은 한 줄에서 시작한다: 「하고 싶은 말, 한국어로」. 몽골 LAB(1차)의 「Солонгосоор өөрийн бодлоо
хэлье」와 같은 뜻이다. 소개는 그 한 줄 → 무엇을 보는지(일상 장면·실제로 쓰는 표현·현지어 자막) → 몽글·까몽·마린 →
지금 단계(첫 편 준비 중, 학습 앱 소식) 순서다. 계정 이름은 바꾸지 않는다(틱톡 7일·페이스북 60일 잠금).
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LINK = "SYNK LAB · https://synk.im/lab/"

EN = f"""Say what you mean — in Korean.

Short everyday scenes and the Korean phrases people really use, with English subtitles. Watch the moment, catch the phrase, then say it out loud — your way.

Mongle, Kkamong and Marin, our three felt friends, react right along with you.

First episodes are on the way. We're also building a Korean learning app, and you'll hear about it here first.

{LINK}"""

YT = [
    dict(id="lab-jp-youtube", country="JAPAN", locale="ja", handle="@synklabjapan",
         title=["言いたいことを、", "韓国語で。"], hl="言いたいこと",
         bio=f"""言いたいことを、韓国語で。

日常のワンシーンと、韓国の人が本当に使うフレーズを日本語字幕で紹介します。場面を見て、フレーズを聞いたら、自分の言葉にして声に出してみよう。

フェルトの仲間、モングル・カモン・マリンも一緒にリアクションします。

最初のエピソードを準備中です。韓国語学習アプリも作っていて、お知らせはこのチャンネルで真っ先に届けます。

{LINK}"""),
    dict(id="lab-vn-youtube", country="VIETNAM", locale="vi", handle="@synklabvietnam",
         title=["Nói điều bạn muốn nói", "bằng tiếng Hàn."], hl="điều bạn muốn nói",
         bio=f"""Nói điều bạn muốn nói — bằng tiếng Hàn.

Những cảnh đời thường ngắn và các câu tiếng Hàn người Hàn dùng thật, có phụ đề tiếng Việt. Xem tình huống, nghe câu nói, rồi tự nói thành tiếng theo cách của bạn.

Mongle, Kkamong và Marin – ba người bạn bằng vải nỉ – sẽ cùng phản ứng với bạn.

Những tập đầu tiên sắp ra mắt. Chúng mình cũng đang làm một ứng dụng học tiếng Hàn, tin mới sẽ có ở đây trước tiên.

{LINK}"""),
    dict(id="lab-tw-youtube", country="TAIWAN", locale="zh-Hant", handle="@synklabtaiwan",
         title=["想說的話", "用韓語說"], hl="想說的話",  # 제목 줄 끝의 전각 쉼표·마침표는 가운데 놓여 빈칸처럼 보였다
         bio=f"""想說的話，用韓語說。

日常生活的小片段，加上韓國人真的會用的說法，附中文字幕。看完情境、聽完句子，換成你自己的話，大聲說出來。

羊毛氈好朋友 Mongle、Kkamong、Marin 會陪你一起反應。

第一集準備中。我們也在做韓語學習 App，最新消息會先在這裡公布。

{LINK}"""),
    dict(id="lab-mm-youtube", country="MYANMAR", locale="my", handle="@synklabmyanmar",
         title=["ပြောချင်တာကို", "ကိုရီးယားလို ပြောမယ်။"], hl="ပြောချင်တာ",
         bio=f"""ပြောချင်တာကို ကိုရီးယားလို ပြောကြမယ်။

နေ့စဉ်ဘဝက မြင်ကွင်းတိုလေးတွေနဲ့ ကိုရီးယားလူတွေ တကယ်သုံးတဲ့ စကားတွေကို မြန်မာစာတန်းထိုးနဲ့ ပြပေးမယ်။ မြင်ကွင်းကို ကြည့်၊ စကားကို နားထောင်ပြီး ကိုယ့်ပုံစံနဲ့ အသံထွက်ပြောကြည့်ပါ။

Mongle၊ Kkamong နဲ့ Marin ဆိုတဲ့ ချစ်စရာ သူငယ်ချင်းသုံးယောက်က အတူတူ တုံ့ပြန်ပေးမယ်။

ပထမဆုံး အပိုင်းတွေကို ပြင်ဆင်နေပါတယ်။ ကိုရီးယားစာ သင်ယူတဲ့ app လည်း လုပ်နေပါတယ်၊ သတင်းတွေကို ဒီမှာ အရင်ဆုံး ကြားရမယ်။

{LINK}"""),
    dict(id="lab-th-youtube", country="THAILAND", locale="th", handle="@synklabthailand",
         title=["อยากพูดอะไร", "พูดเป็นภาษาเกาหลี"], hl="อยากพูดอะไร",
         bio=f"""อยากพูดอะไร พูดเป็นภาษาเกาหลี

ฉากสั้น ๆ ในชีวิตประจำวัน กับประโยคที่คนเกาหลีใช้จริง พร้อมซับไทย ดูสถานการณ์ ฟังประโยค แล้วลองพูดออกเสียงในแบบของตัวเอง

Mongle, Kkamong และ Marin สามเพื่อนตุ๊กตาสักหลาด จะรีแอ็กไปพร้อมกับคุณ

ตอนแรกใกล้มาแล้ว เรากำลังทำแอปเรียนภาษาเกาหลีด้วย ข่าวใหม่จะแจ้งที่นี่ก่อนใคร

{LINK}"""),
    dict(id="lab-id-youtube", country="INDONESIA", locale="id", handle="@synklabindonesia",
         title=["Ungkapkan maksudmu", "dalam bahasa Korea."], hl="maksudmu",
         bio=f"""Ungkapkan maksudmu dalam bahasa Korea.

Adegan singkat sehari-hari dan ungkapan yang benar-benar dipakai orang Korea, lengkap dengan subtitle bahasa Indonesia. Tonton situasinya, dengarkan ungkapannya, lalu ucapkan dengan gayamu sendiri.

Mongle, Kkamong, dan Marin, tiga teman flanel kami, ikut bereaksi bersamamu.

Episode pertama segera hadir. Kami juga sedang membuat aplikasi belajar bahasa Korea, dan kabarnya akan muncul di sini lebih dulu.

{LINK}"""),
    dict(id="lab-in-youtube", country="INDIA", locale="hi", extra="en", handle="@synklabindia",
         title=["जो कहना है,", "कोरियन में कहो।"], hl="जो कहना है",
         bio=f"""जो कहना है, कोरियन में कहो।

रोज़ के छोटे-छोटे सीन और वो वाक्य जो कोरियाई लोग सच में बोलते हैं, सबटाइटल के साथ। सीन देखो, वाक्य सुनो, फिर अपने अंदाज़ में ज़ोर से बोलकर देखो।

Mongle, Kkamong और Marin, हमारे तीन फ़ेल्ट दोस्त, हर पल तुम्हारे साथ रिएक्ट करेंगे।

पहले एपिसोड जल्द आ रहे हैं। हम कोरियन सीखने का एक ऐप भी बना रहे हैं, उसकी ख़बर सबसे पहले यहीं मिलेगी।

Say what you mean, in Korean: short everyday scenes and real Korean phrases, with subtitles.
{LINK}"""),
    dict(id="lab-kg-youtube", country="KYRGYZSTAN", locale="ky", handle="@synklabkyrgyzstan",
         title=["Айткың келгенди", "корейче айт."], hl="Айткың келгенди",
         bio=f"""Айткың келгенди корейче айт.

Күнүмдүк турмуштан кыска көрүнүштөр жана корейлер чындап колдонгон сөз айкаштары, кыргызча субтитр менен. Көрүнүштү көрүп, сөздү угуп, анан өз сөзүң менен үн чыгарып айтып көр.

Кийиз достор Mongle, Kkamong жана Marin сени менен бирге реакция кылат.

Алгачкы эпизоддор жакында чыгат. Корей тилин үйрөнүүчү тиркеме да жасап жатабыз, жаңылыктар биринчи ушул жерде.

{LINK}"""),
    dict(id="lab-us-youtube", country="UNITED STATES", locale="en", handle="@synklabusa",
         title=["Say what you mean,", "in Korean."], hl="what you mean", bio=EN),
    dict(id="lab-ph-youtube", country="PHILIPPINES", locale="fil", extra="en", handle="@synklabphilippines",
         title=["Sabihin ang gusto mo,", "sa Korean."], hl="ang gusto mo",
         bio=f"""Sabihin ang gusto mo — sa Korean.

Maiikling eksena sa araw-araw at mga Korean phrase na talagang ginagamit ng mga Koreano, may English subtitles. Panoorin ang eksena, pakinggan ang phrase, tapos sabihin mo nang malakas sa sarili mong paraan.

Kasama mo sina Mongle, Kkamong at Marin, ang tatlo naming felt friends, sa bawat reaction.

Malapit na ang unang episodes. Gumagawa rin kami ng Korean learning app, at dito mo unang malalaman ang balita.

{LINK}"""),
    dict(id="lab-lk-youtube", country="SRI LANKA", locale="si", extra="ta", handle="@synklabsrilanka",
         title=["කියන්න ඕන දේ,", "කොරියානුවෙන් කියමු."], hl="කියන්න ඕන දේ",
         bio=f"""කියන්න ඕන දේ, කොරියානුවෙන් කියමු.

එදිනෙදා ජීවිතයේ කෙටි දර්ශන සහ කොරියානුවන් ඇත්තටම භාවිත කරන වාක්‍ය, උපසිරැසි සමඟ. දර්ශනය බලන්න, වාක්‍යය අහන්න, ඊට පස්සේ ඔබේම විදියට හයියෙන් කියලා බලන්න.

Mongle, Kkamong සහ Marin කියන යාළුවෝ තුන්දෙනා ඔබත් එක්කම ප්‍රතිචාර දක්වනවා.

පළමු කථාංග ළඟදීම. අපි කොරියානු ඉගෙනීමේ ඇප් එකකුත් හදනවා, ඒ ගැන ආරංචි මුලින්ම මෙතැනින්.

சொல்ல நினைப்பதை கொரிய மொழியில் சொல்லுங்கள்: அன்றாடக் குறுங்காட்சிகள், உண்மையான கொரிய சொற்றொடர்கள், சப்டைட்டில்களுடன்.
{LINK}"""),
    dict(id="lab-au-youtube", country="AUSTRALIA", locale="en", handle="@synklabaustralia",
         title=["Say what you mean,", "in Korean."], hl="what you mean", bio=EN),
    dict(id="lab-py-youtube", country="PARAGUAY", locale="es", handle="@synklabparaguay",
         title=["Lo que querés decir,", "decilo en coreano."], hl="Lo que querés decir",
         bio=f"""Lo que querés decir, decilo en coreano.

Escenas cortas de todos los días y las frases que los coreanos usan de verdad, con subtítulos en español. Mirá la situación, escuchá la frase y después decila en voz alta, a tu manera.

Mongle, Kkamong y Marin, nuestros tres amigos de fieltro, reaccionan con vos.

Los primeros episodios llegan pronto. También estamos haciendo una app para aprender coreano y las novedades van a salir primero acá.

{LINK}"""),
    dict(id="lab-nz-youtube", country="NEW ZEALAND", locale="en", handle="@synklabnewzealand",
         title=["Say what you mean,", "in Korean."], hl="what you mean", bio=EN),
    dict(id="lab-my-youtube", country="MALAYSIA", locale="ms", handle="@synklabmalaysia",
         title=["Apa yang nak dikata,", "cakap dalam bahasa Korea."], hl="Apa yang nak dikata",
         bio=f"""Apa yang nak dikata, cakaplah dalam bahasa Korea.

Babak pendek kehidupan seharian dan ungkapan yang benar-benar digunakan orang Korea, dengan sari kata bahasa Melayu. Tonton situasinya, dengar ungkapannya, kemudian sebut dengan kuat ikut gaya anda sendiri.

Mongle, Kkamong dan Marin, tiga kawan felt kami, turut memberi reaksi bersama anda.

Episod pertama akan tiba tidak lama lagi. Kami juga sedang membina aplikasi belajar bahasa Korea, dan beritanya akan keluar di sini dahulu.

{LINK}"""),
    dict(id="lab-ca-youtube", country="CANADA", locale="en", extra="fr", handle="@synklabcanada",
         title=["Say what you mean,", "in Korean."], hl="what you mean",
         bio=f"""Say what you mean — in Korean.
Dis ce que tu veux dire — en coréen.

Short everyday scenes and the Korean phrases people really use, with subtitles. Watch the moment, catch the phrase, then say it out loud — your way.
De courtes scènes du quotidien et les expressions que les Coréens utilisent vraiment, avec sous-titres. Regarde la scène, écoute l'expression, puis dis-la à voix haute, à ta façon.

Mongle, Kkamong and Marin, our three felt friends, react right along with you.
Mongle, Kkamong et Marin, nos trois amis en feutre, réagissent avec toi.

First episodes are on the way. · Les premiers épisodes arrivent bientôt.

{LINK}"""),
]

OTHER = [
    dict(id="lab-vn-tiktok", platform="TikTok", country="VIETNAM", locale="vi", handle="@synklab.vn", limit=80,
         bio="Nói điều bạn muốn nói bằng tiếng Hàn. Cảnh ngắn, câu thật, phụ đề Việt."),
    dict(id="lab-mm-tiktok", platform="TikTok", country="MYANMAR", locale="my", handle="@synklab.mm", limit=80,
         bio="ပြောချင်တာကို ကိုရီးယားလို ပြောကြမယ်။ မြင်ကွင်းတို၊ တကယ်သုံးတဲ့စကား။"),
    dict(id="lab-cn-xiaohongshu", platform="Xiaohongshu", country="CHINA", locale="zh-Hans", handle="synklab.cn(제안)", limit=100,
         bio="想说的话，用韩语说。日常小场景＋韩国人真的在用的表达，配中文字幕。看完就开口说说看！"),
    dict(id="lab-ru-rutube", platform="RUTUBE", country="RUSSIA", locale="ru", handle="channel 81398864", limit=1000,
         bioShort="Говори по-корейски то, что хочешь сказать. Короткие сценки и живые фразы с русскими субтитрами.",
         bio=f"""Говори по-корейски то, что хочешь сказать.

Короткие сценки из жизни и фразы, которые корейцы правда используют, — с русскими субтитрами. Посмотри ситуацию, услышь фразу и скажи её вслух по-своему.

Mongle, Kkamong и Marin — три наших друга из фетра — реагируют вместе с тобой.

Первые выпуски уже скоро. А ещё мы делаем приложение для изучения корейского — новости о нём сначала здесь.

{LINK}"""),
    dict(id="lab-np-facebook", platform="Facebook", country="NEPAL", locale="ne", handle="@synklab.np", limit=100,
         title=["भन्न मन लागेको कुरा,", "कोरियनमा भनौँ।"], hl="भन्न मन लागेको कुरा",
         bio="भन्न मन लागेको कुरा, कोरियनमा भनौँ। छोटा दैनिक दृश्य र कोरियालीले साँच्चै बोल्ने वाक्य।"),
    dict(id="lab-kh-facebook", platform="Facebook", country="CAMBODIA", locale="km", handle="(facebook page)", limit=100,
         title=["អ្វីដែលចង់និយាយ", "និយាយជាភាសាកូរ៉េ។"], hl="អ្វីដែលចង់និយាយ",
         bio="អ្វីដែលចង់និយាយ និយាយជាភាសាកូរ៉េ។ ឈុតខ្លីៗប្រចាំថ្ងៃ និងឃ្លាដែលជនជាតិកូរ៉េប្រើពិតៗ។"),
    dict(id="lab-lk-facebook", platform="Facebook", country="SRI LANKA", locale="si", handle="(facebook page)", limit=100,
         title=["කියන්න ඕන දේ,", "කොරියානුවෙන් කියමු."], hl="කියන්න ඕන දේ",
         bio="කියන්න ඕන දේ, කොරියානුවෙන් කියමු. එදිනෙදා කෙටි දර්ශන, ඇත්තටම භාවිත වන වාක්‍ය."),
    dict(id="lab-uz-telegram", platform="Telegram 채널", country="UZBEKISTAN", locale="uz-Latn", handle="@synklab_uz", limit=255,
         bio="Aytmoqchi bo‘lganingni koreyschada ayt. Kundalik hayotdan qisqa sahnalar va koreyslar haqiqatan ishlatadigan iboralar, o‘zbekcha izoh bilan. Sahnani ko‘r, iborani eshit, keyin o‘zingcha ovoz chiqarib ayt. Birinchi epizodlar tez orada. synk.im/lab"),
]

KOREAN = {
    "slogan": "하고 싶은 말, 한국어로",
    "youtube": "하고 싶은 말, 한국어로.\n\n짧은 일상 장면과 한국 사람이 실제로 쓰는 표현을 현지어 자막으로 보여 줍니다. 장면을 보고, 표현을 듣고, 내 방식으로 소리 내어 말해 봐요.\n\n펠트 친구 몽글·까몽·마린이 함께 반응해요.\n\n첫 편을 준비하고 있어요. 한국어 학습 앱도 만들고 있고, 소식은 이 채널에서 먼저 전해요.",
    "short": "하고 싶은 말, 한국어로. 짧은 장면 · 실제로 쓰는 표현 · 현지어 자막",
}


# 검토용 뜻(제목·짧은 소개)과 언어별로 다른 점. 긴 소개의 뜻은 모두 KOREAN["youtube"]와 같다
KO = {
    "lab-jp-youtube": ("하고 싶은 말을, 한국어로.", "자막은 일본어. 캐릭터 이름은 가타카나(モングル・カモン・マリン)."),
    "lab-vn-youtube": ("하고 싶은 말을 한국어로 말해요.", "자막은 베트남어."),
    "lab-tw-youtube": ("하고 싶은 말, 한국어로 말해요.", "자막은 중국어(번체)."),
    "lab-mm-youtube": ("하고 싶은 말을 한국어로 말할 거예요.", "자막은 미얀마어. 「펠트」 대신 「귀여운 친구 셋」으로 썼다(펠트에 맞는 낱말이 확실하지 않다)."),
    "lab-th-youtube": ("하고 싶은 말, 한국어로 말해요.", "자막은 태국어."),
    "lab-id-youtube": ("하고 싶은 뜻을 한국어로 표현해요.", "자막은 인도네시아어. 펠트는 현지 공예에서 쓰는 「flanel」."),
    "lab-in-youtube": ("할 말이 있으면, 한국어로 말해.", "힌디어 소개 끝에 영어 한 줄. 자막 언어는 정하지 않아 「자막과 함께」로만 썼다."),
    "lab-kg-youtube": ("하고 싶은 말을 한국어로 말해.", "자막은 키르기스어. 펠트는 전통 펠트 「кийиз」."),
    "lab-us-youtube": ("Say what you mean, in Korean.", "자막은 영어."),
    "lab-ph-youtube": ("원하는 걸 말해, 한국어로.", "필리핀에서 흔한 타갈로그·영어 섞어 쓰기. 자막은 영어(영어판을 먼저 올리는 계획)."),
    "lab-lk-youtube": ("할 말을, 한국어로 말해요.", "싱할라어 소개 끝에 타밀어 한 줄. 자막 언어는 정하지 않아 「자막과 함께」로만 썼다."),
    "lab-au-youtube": ("Say what you mean, in Korean.", "미국판과 같은 글."),
    "lab-py-youtube": ("하고 싶은 말, 한국어로 해 봐.", "파라과이에서 쓰는 vos 말투(decí·querés). 자막은 스페인어."),
    "lab-nz-youtube": ("Say what you mean, in Korean.", "미국판과 같은 글."),
    "lab-my-youtube": ("하고 싶은 말, 한국어로 말해요.", "자막은 말레이어."),
    "lab-ca-youtube": ("Say what you mean, in Korean.", "영어·프랑스어 두 언어. 자막 언어는 정하지 않아 「with subtitles」로만 썼다."),
    "lab-vn-tiktok": ("하고 싶은 말을 한국어로. 짧은 장면, 진짜 쓰는 말, 베트남어 자막.", ""),
    "lab-mm-tiktok": ("하고 싶은 말을 한국어로 말해요. 짧은 장면, 실제로 쓰는 말.", ""),
    "lab-cn-xiaohongshu": ("하고 싶은 말, 한국어로. 일상의 짧은 장면 + 한국 사람이 실제로 쓰는 표현, 중국어 자막. 보고 나서 바로 말해 봐요!", "지금은 소개가 비어 있다."),
    "lab-ru-rutube": ("하고 싶은 말을 한국어로 말해요. 짧은 장면과 살아 있는 표현, 러시아어 자막.(짧은 소개)", "긴 소개의 뜻은 유튜브와 같다."),
    "lab-np-facebook": ("하고 싶은 말, 한국어로 말해요. 짧은 일상 장면과 한국 사람이 실제로 쓰는 문장.", "커버는 지금 비어 있다 → 새 커버."),
    "lab-kh-facebook": ("하고 싶은 말, 한국어로 말해요. 짧은 일상 장면과 한국 사람이 실제로 쓰는 표현.", "커버는 지금 비어 있다 → 새 커버."),
    "lab-lk-facebook": ("할 말을, 한국어로 말해요. 짧은 일상 장면, 실제로 쓰는 문장.", "커버는 지금 비어 있다 → 새 커버."),
    "lab-uz-telegram": ("하고 싶은 말을 한국어로. 일상의 짧은 장면과 한국 사람이 실제로 쓰는 표현을 우즈베크어 설명과 함께. 장면을 보고, 표현을 듣고, 내 방식으로 소리 내 말해 봐요. 첫 편은 곧 나와요.", ""),
}


def old_bios():
    """지금 걸려 있는 소개(GPT판). 유튜브는 원고 파일, 나머지는 계정 장부의 공개 확인 값."""
    base = os.path.join(HERE, "..", "온라인마케팅지도")
    old = {}
    for f in ("intl-youtube/copy.json", "jp-vn-profile/copy.json"):
        for c in json.load(open(os.path.join(base, f), encoding="utf-8"))["channels"]:
            old[c["id"]] = c.get("description", "")
    reg = json.load(open(os.path.join(HERE, "..", "sns-계정.json"), encoding="utf-8"))["accounts"]
    for k, v in reg.items():
        if k not in old and v.get("brand") == "LAB":
            old[k] = v.get("bio") or ""
    return old


def write_review(accounts):
    old = old_bios()
    L = ["# 해외 LAB 24개 계정 · 새 소개(클로드판 2차)와 지금 소개", "",
         "2026-10-02 · 원본은 `LAB해외_문구.py` → `계정별_문구_LAB해외.json`. 배너는 `배너/배너_LAB해외.html` → `배너/out_LAB해외/`.",
         "**어느 계정에도 반영하지 않았다.** 모든 언어가 AI 작성이고 원어민 확인 전이다. 계정 이름·핸들은 그대로 둔다.", "",
         "## 모든 계정의 같은 뼈대", "",
         f"- 첫 줄(배너 제목과 같다): **{KOREAN['slogan']}** — 몽골 LAB의 「Солонгосоор өөрийн бодлоо хэлье(내 생각을 한국어로 말해요)」와 같은 뜻.",
         "- 배너의 한국어 줄은 모든 나라가 같은 「하고 싶은 말, 한국어로」다. 제목을 읽은 사람이 그 문장이 한국어로 어떻게 생겼는지 바로 본다.",
         "- 긴 소개의 뜻(나라마다 자막 언어만 다르다):", "", "> " + KOREAN["youtube"].replace("\n\n", "\n>\n> "), "",
         "- 첫 영상을 올리면 「첫 편을 준비하고 있어요」 줄은 지운다. 학습 앱 소식 줄은 남긴다.",
         "- 지금 소개(GPT판)는 열여섯 나라가 같은 영어 틀을 옮긴 글이었다(인사·카페 주문·댓글 / 한글·TOPIK 기초·퀴즈 / 소리 내어 읽고 답을 고르고). 퀴즈처럼 아직 없는 것을 약속하던 부분은 뺐다.", ""]
    for a in accounts:
        ko, note = KO.get(a["id"], ("", ""))
        L.append(f"## {a['country'].title()} · {a['platform']} `{a['handle']}` ({a['locale']})")
        L.append("")
        if a.get("banner"):
            L.append(f"**배너 제목** {' / '.join(a['banner']['title'])} — {KO.get(a['id'], ('', ''))[0] if a['platform'] == 'YouTube' else ko.split('.')[0]}")
        else:
            L.append(f"**뜻** {ko}")
        if a["platform"] != "YouTube" and a.get("banner"):
            L.append(f"**뜻** {ko}")
        if note:
            L.append(f"**다른 점** {note}")
        L.append("")
        L.append(f"새 소개 ({a['length']['bio']['utf16']}/{a['limit']}자)")
        L.append("```text")
        L.append(a["bio"])
        L.append("```")
        if a.get("bioShort"):
            L.append(f"짧은 소개 ({a['length']['bioShort']['utf16']}/150자)")
            L.append("```text")
            L.append(a["bioShort"])
            L.append("```")
        o = old.get(a["id"], "")
        L.append("<details><summary>지금 소개</summary>")
        L.append("")
        L.append("```text")
        L.append(o if o else "(비어 있음)")
        L.append("```")
        L.append("</details>")
        L.append("")
    with open(os.path.join(HERE, "소개글_검토_LAB해외.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L))


def lens(s):
    return len(s), len(s.encode("utf-16-le")) // 2


if __name__ == "__main__":
    accounts = []
    bad = []
    for c in YT:
        a = dict(id=c["id"], platform="YouTube", country=c["country"], locale=c["locale"], handle=c["handle"],
                 limit=1000, bio=c["bio"],
                 banner=dict(file=f"yt_{c['id']}.png", label=f"SYNK LAB · {c['country']}", title=c["title"], hl=c["hl"]))
        if c.get("extra"):
            a["additionalLocale"] = c["extra"]
        accounts.append(a)
    for c in OTHER:
        a = {k: v for k, v in c.items() if k not in ("title", "hl")}
        if "title" in c:
            a["banner"] = dict(file=f"fb_{c['id']}.png", label=f"SYNK LAB · {c['country']}", title=c["title"], hl=c["hl"])
        accounts.append(a)
    for a in accounts:
        for key in ("bio", "bioShort"):
            if key in a:
                cp, u16 = lens(a[key])
                a.setdefault("length", {})[key] = {"codePoints": cp, "utf16": u16}
                lim = a["limit"] if key == "bio" else 150
                if u16 > lim:
                    bad.append(f"{a['id']} {key} {u16}>{lim}")
        a["languageReview"] = "AI 작성 · 원어민 확인 전"
        if "banner" in a and a["banner"]["hl"] not in "".join(a["banner"]["title"]):
            bad.append(f"{a['id']} 강조 구절이 제목에 없다")
    out = dict(
        revision="2026-10-02-claude-v2-lab-international",
        status="사용자 검토 전 · 아직 어느 계정에도 반영하지 않음",
        request="2026-10-02 사용자: 「우리 모든 sns계정 (수십개) 전부 소개서랑 프로필사진이나 레이아웃 … 클로드버전으로 전부 교체해보고싶어.」 · 「까몽이나 몽글 마린 중 니 생각에 확실히 어필될만한거로 통일하고」",
        replaces=["docs/마케팅/온라인마케팅지도/intl-youtube/copy.json", "docs/마케팅/온라인마케팅지도/jp-vn-profile/copy.json",
                  "docs/마케팅/온라인마케팅지도/intl-social/copy.json (반영된 8개 계정)"],
        avatar="프로필/avatar-lab.png (몽골 LAB과 같은 사진)",
        names="계정 이름은 그대로 둔다(틱톡 7일·페이스북 60일 이름 잠금, 검색으로 쌓인 이름).",
        firstUploadEdit="첫 영상을 올린 뒤에는 「첫 편을 준비하고 있어요」 줄을 지운다.",
        korean=KOREAN,
        accounts=accounts,
    )
    for a in accounts:
        if a["id"] in KO:
            a["koreanMeaning"] = KO[a["id"]][0]
            if KO[a["id"]][1]:
                a["note"] = KO[a["id"]][1]
    with open(os.path.join(HERE, "계정별_문구_LAB해외.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    write_review(accounts)
    print(len(accounts), "계정")
    for a in accounts:
        L = a.get("length", {})
        print(f"  {a['id']:22s} {a['locale']:8s} " + " ".join(f"{k}={v['utf16']}/{a['limit'] if k == 'bio' else 150}" for k, v in L.items()))
    if bad:
        print("문제:", *bad, sep="\n  ")
        raise SystemExit(1)
    print("글자 수 통과")
