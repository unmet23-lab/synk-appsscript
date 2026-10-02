"""아직 만들지 않은 해외 LAB 계정 20개의 가입 준비 묶음(가입준비_LAB해외.md) 원본.

    python 가입준비_LAB해외.py     # 글자 수를 검사하고 md를 쓴다

계정 만들기(비밀번호·본인 인증·약관 동의)는 사용자가 직접 한다. 이 묶음은 가입 화면에 그대로 붙여 넣을
이름·핸들 후보·소개·사진과, 9월 가입 시도에서 막혔던 곳을 계정마다 모은 것이다.
소개는 클로드판 2차(계정별_문구_LAB해외.json)와 같은 뼈대 「하고 싶은 말, 한국어로」를 쓴다.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
KO_LINE = "하고 싶은 말, 한국어로"
LINK = "https://synk.im/lab/"
AVATAR = "프로필/avatar-lab.png"

IG_NOTE = ("9월 20일 웹 가입은 일본·우즈베키스탄에서 사용자가 직접 제출해도 「가입 중에 오류가 발생했습니다」로 막혔다(원인 미확정). "
           "이번에는 휴대폰 인스타그램 앱의 「계정 추가 → 새 계정 만들기」로 만든다. 소개·웹사이트도 앱에서 저장한다(웹 저장이 옛 글로 돌아간 기록이 있다).")
TT_NOTE = ("구글 로그인으로 만든다(기존 틱톡 5개가 이렇게 연결됨). 같은 전화번호가 이미 다른 틱톡에 쓰였다는 오류가 founder@synk.im 시도에서 나왔으니, "
           "번호를 묻으면 아직 틱톡에 쓰지 않은 번호를 쓴다. 이름은 바꾸면 7일 잠기니 처음부터 아래 이름으로 넣는다.")

ACC = [
    # 인스타그램 9 — 사용자 지정 순서: 틱톡이 아닌 12개를 먼저
    dict(id="lab-jp-instagram", p="Instagram", c="일본", name="SYNK LAB Japan", h=["synklab.jp", "synklab_jp", "synklabjapan"], limit=150, note=IG_NOTE,
         bio="言いたいことを、韓国語で。\n日常のワンシーンと、韓国の人が本当に使うフレーズ（日本語字幕）\n" + KO_LINE,
         ko="하고 싶은 말을, 한국어로. 일상의 한 장면과 한국 사람이 실제로 쓰는 표현(일본어 자막)"),
    dict(id="lab-uz-instagram", p="Instagram", c="우즈베키스탄", name="SYNK LAB Uzbekistan", h=["synklab.uz", "synklab_uz", "synklabuzbekistan"], limit=150, note=IG_NOTE,
         bio="Aytmoqchi bo‘lganingni koreyschada ayt.\nQisqa sahnalar va haqiqiy iboralar, o‘zbekcha izoh bilan.\n" + KO_LINE,
         ko="하고 싶은 말을 한국어로 말해. 짧은 장면과 진짜 표현, 우즈베크어 설명과 함께"),
    dict(id="lab-tw-instagram", p="Instagram", c="대만", name="SYNK LAB Taiwan", h=["synklab.tw", "synklab_tw", "synklabtaiwan"], limit=150, note=IG_NOTE,
         bio="想說的話，用韓語說。\n日常小片段＋韓國人真的會用的說法（中文字幕）\n" + KO_LINE,
         ko="하고 싶은 말, 한국어로 말해요. 일상의 짧은 장면 + 한국 사람이 실제로 쓰는 말(중국어 자막)"),
    dict(id="lab-in-instagram", p="Instagram", c="인도", name="SYNK LAB India", h=["synklab.in", "synklab_in", "synklabindia"], limit=150, note=IG_NOTE,
         bio="जो कहना है, कोरियन में कहो।\nरोज़ के छोटे सीन और असली कोरियन वाक्य, सबटाइटल के साथ।\n" + KO_LINE,
         ko="할 말이 있으면, 한국어로 말해. 일상의 짧은 장면과 진짜 한국어 문장, 자막과 함께"),
    dict(id="lab-kz-instagram", p="Instagram", c="카자흐스탄", name="SYNK LAB Kazakhstan", h=["synklab.kz", "synklab_kz", "synklabkazakhstan"], limit=150, note=IG_NOTE,
         bio="Айтқың келгенді корейше айт.\nҚысқа көріністер мен корейлер шынымен қолданатын сөздер, қазақша субтитрмен.\n" + KO_LINE,
         ko="하고 싶은 말을 한국어로 말해. 짧은 장면과 한국 사람이 실제로 쓰는 말, 카자흐어 자막으로"),
    dict(id="lab-kg-instagram", p="Instagram", c="키르기스스탄", name="SYNK LAB Kyrgyzstan", h=["synklab.kg", "synklab_kg", "synklabkyrgyzstan"], limit=150, note=IG_NOTE,
         bio="Айткың келгенди корейче айт.\nКыска көрүнүштөр жана корейлер чындап колдонгон сөздөр, кыргызча субтитр менен.\n" + KO_LINE,
         ko="하고 싶은 말을 한국어로 말해. 짧은 장면과 한국 사람이 실제로 쓰는 말, 키르기스어 자막으로"),
    dict(id="lab-py-instagram", p="Instagram", c="파라과이", name="SYNK LAB Paraguay", h=["synklab.py", "synklab_py", "synklabparaguay"], limit=150, note=IG_NOTE,
         bio="Lo que querés decir, decilo en coreano.\nEscenas cortas y frases que los coreanos usan de verdad, con subtítulos.\n" + KO_LINE,
         ko="하고 싶은 말, 한국어로 해 봐. 짧은 장면과 한국 사람이 진짜 쓰는 말, 자막과 함께"),
    dict(id="lab-nz-instagram", p="Instagram", c="뉴질랜드", name="SYNK LAB New Zealand", h=["synklab.nz", "synklab_nz", "synklabnz"], limit=150, note=IG_NOTE,
         bio="Say what you mean, in Korean.\nShort everyday scenes and the phrases Koreans really use, with subtitles.\n" + KO_LINE,
         ko="하고 싶은 말, 한국어로. 짧은 일상 장면과 한국 사람이 실제로 쓰는 표현, 자막과 함께"),
    dict(id="lab-ca-instagram", p="Instagram", c="캐나다", name="SYNK LAB Canada", h=["synklab.ca", "synklab_ca", "synklabcanada"], limit=150, note=IG_NOTE,
         bio="Say what you mean, in Korean.\nDis ce que tu veux dire, en coréen.\nShort scenes · real phrases · subtitles\n" + KO_LINE,
         ko="하고 싶은 말, 한국어로(영어·프랑스어). 짧은 장면 · 진짜 표현 · 자막"),
    # 중국·러시아
    dict(id="lab-cn-douyin", p="Douyin", c="중국", name="SYNK LAB 韩语", h=["synklab.cn", "synklab_cn", "synklabcn"], limit=80,
         note="9월 20일 웹에서 +82 번호 인증을 누르면 「请使用抖音手机APP登录」(더우인 앱으로 로그인)으로 막혔고, 창작자센터는 「访问太频繁」(요청이 너무 잦음)이 나왔다. 휴대폰 더우인 앱에서 가입한다.",
         bio="想说的话，用韩语说。日常小场景＋韩国人真的在用的表达，配中文字幕。",
         ko="하고 싶은 말, 한국어로 말해요. 일상의 짧은 장면 + 한국 사람이 진짜 쓰는 표현, 중국어 자막"),
    dict(id="lab-ru-vk", p="VK", c="러시아", name="SYNK LAB Russia | Корейский с нуля", h=["synklab.ru", "synklab_ru", "synklabrussia"], limit=150,
         note="개인 프로필(Yuho Yang)은 9월 21일 사용자가 휴대폰으로 만들었다. 그 계정에서 「커뮤니티(공개 페이지) 만들기」로 SYNK LAB 커뮤니티를 열고, 이름·소개·사진·커버를 넣는다. 개인 프로필의 이름 칸에 브랜드명을 나눠 넣지 않는다.",
         bio="Говори по-корейски то, что хочешь сказать. Короткие сценки и живые фразы с русскими субтитрами. " + KO_LINE,
         ko="하고 싶은 말을 한국어로 말해요. 짧은 장면과 살아 있는 표현, 러시아어 자막"),
    # 틱톡 9 — 사용자 지정 순서: 마지막
    dict(id="lab-th-tiktok", p="TikTok", c="태국", name="SYNK LAB Thailand", h=["synklab.th", "synklab_th", "synklabthailand"], limit=80, note=TT_NOTE,
         bio="อยากพูดอะไร พูดเป็นภาษาเกาหลี ฉากสั้น ๆ ประโยคที่ใช้จริง ซับไทย", ko="하고 싶은 말, 한국어로. 짧은 장면, 진짜 쓰는 문장, 태국어 자막"),
    dict(id="lab-id-tiktok", p="TikTok", c="인도네시아", name="SYNK LAB Indonesia", h=["synklab.id", "synklab_id", "synklabindonesia"], limit=80, note=TT_NOTE,
         bio="Ungkapkan maksudmu dalam bahasa Korea. Adegan singkat, subtitle Indonesia.", ko="하고 싶은 뜻을 한국어로. 짧은 장면, 인도네시아어 자막"),
    dict(id="lab-kz-tiktok", p="TikTok", c="카자흐스탄", name="SYNK LAB Kazakhstan", h=["synklab.kz", "synklab_kz", "synklabkazakhstan"], limit=80, note=TT_NOTE,
         bio="Айтқың келгенді корейше айт. Қысқа көріністер, қазақша субтитр.", ko="하고 싶은 말을 한국어로. 짧은 장면, 카자흐어 자막"),
    dict(id="lab-np-tiktok", p="TikTok", c="네팔", name="SYNK LAB Nepal", h=["synklab.np", "synklab_np", "synklabnepal"], limit=80, note=TT_NOTE,
         bio="भन्न मन लागेको कुरा, कोरियनमा भनौँ। छोटा दृश्य, नेपाली सबटाइटल।", ko="하고 싶은 말, 한국어로 말해요. 짧은 장면, 네팔어 자막"),
    dict(id="lab-kh-tiktok", p="TikTok", c="캄보디아", name="SYNK LAB Cambodia", h=["synklab.kh", "synklab_kh", "synklabcambodia"], limit=80, note=TT_NOTE,
         bio="អ្វីដែលចង់និយាយ និយាយជាភាសាកូរ៉េ។ ឈុតខ្លីៗ និងឃ្លាពិតៗ។", ko="하고 싶은 말, 한국어로 말해요. 짧은 장면과 진짜 표현"),
    dict(id="lab-us-tiktok", p="TikTok", c="미국", name="SYNK LAB USA", h=["synklab.us", "synklab_us", "synklabusa"], limit=80, note=TT_NOTE,
         bio="Say what you mean, in Korean. Short scenes, real phrases, English subtitles.", ko="하고 싶은 말, 한국어로. 짧은 장면, 진짜 표현, 영어 자막"),
    dict(id="lab-ph-tiktok", p="TikTok", c="필리핀", name="SYNK LAB Philippines", h=["synklab.ph", "synklab_ph", "synklabph"], limit=80, note=TT_NOTE,
         bio="Sabihin ang gusto mo, sa Korean. Maikling eksena, totoong phrases, may subs.", ko="원하는 걸 말해, 한국어로. 짧은 장면, 진짜 표현, 자막"),
    dict(id="lab-au-tiktok", p="TikTok", c="호주", name="SYNK LAB Australia", h=["synklab.au", "synklab_au", "synklabaustralia"], limit=80, note=TT_NOTE,
         bio="Say what you mean, in Korean. Short scenes, real phrases, English subtitles.", ko="하고 싶은 말, 한국어로. 짧은 장면, 진짜 표현, 영어 자막"),
    dict(id="lab-my-tiktok", p="TikTok", c="말레이시아", name="SYNK LAB Malaysia", h=["synklab.my", "synklab_my", "synklabmalaysia"], limit=80, note=TT_NOTE,
         bio="Apa yang nak dikata, cakap dalam bahasa Korea. Babak pendek, sari kata Melayu.", ko="하고 싶은 말, 한국어로 말해요. 짧은 장면, 말레이어 자막"),
]


def u16(s):
    return len(s.encode("utf-16-le")) // 2


if __name__ == "__main__":
    bad = [f"{a['id']} {u16(a['bio'])}>{a['limit']}" for a in ACC if u16(a["bio"]) > a["limit"]]
    if bad:
        raise SystemExit("글자 수 초과: " + ", ".join(bad))
    L = ["# 해외 LAB 가입 준비 · 아직 안 만든 20개 (2026-10-02)", "",
         "**계정 만들기는 사용자가 직접 한다**(비밀번호·본인 인증·약관 동의). 가입 화면에 아래 이름·핸들·소개를 그대로 붙여 넣고, 사진은 모두 같은 몽글 "
         f"[`{AVATAR}`]({AVATAR}), 웹사이트는 `{LINK}`이다. 만든 뒤 알려 주면 공개 화면을 확인하고 장부(`../sns-계정.json`)에 적는다.", "",
         "- 순서는 9월에 정한 대로 틱톡이 아닌 11개(인스타그램 9·더우인·VK)를 먼저, 틱톡 9개를 마지막에.",
         "- 소개는 AI 작성이고 원어민 확인 전이다. 모든 계정이 「하고 싶은 말, 한국어로」에서 시작한다(유튜브·배너와 같은 문장).",
         "- 핸들은 1순위가 안 되면 다음 후보를 쓴다. 후보가 모두 막히면 `synklab` + 나라 이름 조합으로 정하고 알려 준다.",
         "- 이미 있는 계정(틱톡 베트남·미얀마, 텔레그램 우즈베키스탄, RUTUBE, 페이스북 네팔·캄보디아·스리랑카, 샤오훙수)은 새로 만들지 않는다. "
         "샤오훙수는 계정이 있고 프로필만 비어 있어 앱 「나 → 프로필 편집」에서 넣는다(소개는 `계정별_문구_LAB해외.json`의 lab-cn-xiaohongshu).",
         "- 같은 장부에 있는 @synk.hq(SYNK 인스타그램, 사용자가 만들기로 함)·synkbrief 스레드(만들지 않기로 함 9/14)·yuhobuilds 링크드인(쓰지 않는 중복 계정)은 이 묶음에서 뺐다.", ""]
    for i, a in enumerate(ACC, 1):
        L += [f"## {i}. {a['c']} · {a['p']}", "",
              f"- 이름: `{a['name']}`",
              f"- 핸들 후보: `{a['h'][0]}` → `{a['h'][1]}` → `{a['h'][2]}`",
              f"- 소개 ({u16(a['bio'])}/{a['limit']}자) — 뜻: {a['ko']}", "", "```text", a["bio"], "```", "",
              f"- 막혔던 곳·만드는 길: {a['note']}", ""]
    with open(os.path.join(HERE, "가입준비_LAB해외.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L))
    with open(os.path.join(HERE, "가입준비_LAB해외.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(dict(revision="2026-10-02", note="계정 만들기는 사용자가 직접 한다", avatar=AVATAR, website=LINK,
                       accounts=[dict(id=a["id"], platform=a["p"], country=a["c"], name=a["name"], handles=a["h"], bio=a["bio"],
                                      length=u16(a["bio"]), limit=a["limit"], koreanMeaning=a["ko"]) for a in ACC]),
                  f, ensure_ascii=False, indent=1)
    for a in ACC:
        print(f"{a['id']:20s} {u16(a['bio']):4d}/{a['limit']}")
    print(len(ACC), "계정 · 글자 수 통과")
