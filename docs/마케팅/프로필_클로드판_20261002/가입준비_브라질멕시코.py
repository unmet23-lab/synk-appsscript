"""브라질·멕시코 LAB 계정 4개의 가입 준비 묶음(가입준비_브라질멕시코.md·json)과 유튜브 배너 원고 원본.

    python 가입준비_브라질멕시코.py      # 글자 수를 검사하고 md·json·배너 원고를 쓴다
    node ../../../tools/SNS키트굽기.js 배너/배너_브라질멕시코.html --sheet --out 배너/out_브라질멕시코

2026-10-02 사용자 「응 둘 다 넣고 가입 까지 전부 진행해줘」. 전략은 ../LAB_브라질_멕시코_전략_20261002.md.
계정 만들기(비밀번호·본인 인증·약관 동의)는 사용자가 직접 한다. 소개는 해외 LAB 2차와 같은 뼈대
「하고 싶은 말, 한국어로」에 두 나라 전략의 「드라마 같은 상황」을 더했다(실제 드라마 장면·가사는 쓰지 않는다).
멕시코는 중남미 어디서나 통하는 중립 스페인어(tú), 브라질은 포르투갈어(브라질)다.
배너는 해외 LAB 유튜브 16장과 같은 판(배너/LAB해외_짓기.py의 youtube())을 그대로 쓴다.
"""
import importlib.util
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


KIT = load("kit20", os.path.join(HERE, "가입준비_LAB해외.py"))      # IG_NOTE·TT_NOTE·u16·KO_LINE·AVATAR
BANNER = load("banner16", os.path.join(HERE, "배너", "LAB해외_짓기.py"))  # HEAD·youtube()
LINK = "SYNK LAB · https://synk.im/lab/"

YT_NOTE = ("다른 해외 LAB 유튜브 14곳처럼 unmet23 구글 계정에서 「채널 만들기」로 브랜드 채널을 연다. "
           "이름을 넣고 만든 뒤 Studio → 맞춤설정에서 핸들·설명·배너·프로필 사진·링크를 넣는다(Claude가 이어서 할 수 있다).")

PT_YT = f"""O que você quer dizer, em coreano.

Cenas curtas do dia a dia — e aquelas situações bem de dorama — com as frases que os coreanos usam de verdade, legendadas em português. Veja a cena, escute a frase e depois fale em voz alta, do seu jeito.

Mongle, Kkamong e Marin, nossos três amigos de feltro, reagem junto com você.

Os primeiros episódios estão chegando. Também estamos criando um app para aprender coreano, e as novidades saem primeiro aqui.

{LINK}"""

ES_YT = f"""Lo que quieres decir, dilo en coreano.

Escenas cortas de todos los días —y esas situaciones muy de K-drama— con las frases que los coreanos usan de verdad, con subtítulos en español. Mira la escena, escucha la frase y luego dila en voz alta, a tu manera.

Mongle, Kkamong y Marin, nuestros tres amigos de fieltro, reaccionan contigo.

Los primeros episodios llegan pronto. También estamos creando una app para aprender coreano, y las novedades saldrán primero aquí.

{LINK}"""

KO_YT = ("하고 싶은 말, 한국어로. 짧은 일상 장면과 드라마에 나올 법한 상황 속, 한국 사람이 실제로 쓰는 표현을 {lang} 자막으로 보여 줍니다. "
         "장면을 보고, 표현을 듣고, 내 방식으로 소리 내어 말해 봐요. 펠트 친구 몽글·까몽·마린이 함께 반응해요. "
         "첫 편을 준비하고 있어요. 한국어 학습 앱도 만들고 있고, 소식은 이 채널에서 먼저 전해요.")

ACC = [
    # 멕시코 — 스페인어권 입구. 중립 스페인어(tú, 멕시코 속어 없음)
    dict(id="lab-mx-youtube", p="YouTube", c="멕시코", locale="es", name="SYNK LAB México | Coreano divertido",
         h=["synklabmexico", "synklab.mx", "synklabmx"], limit=1000, note=YT_NOTE, bio=ES_YT, ko=KO_YT.format(lang="스페인어"),
         banner=dict(label="SYNK LAB · MÉXICO", title=["Lo que quieres decir,", "dilo en coreano."], hl="Lo que quieres decir")),
    dict(id="lab-mx-tiktok", p="TikTok", c="멕시코", locale="es", name="SYNK LAB México",
         h=["synklab.mx", "synklab_mx", "synklabmexico"], limit=80, note=KIT.TT_NOTE,
         bio="Lo que quieres decir, dilo en coreano. Escenas tipo K-drama y frases reales.",
         ko="하고 싶은 말, 한국어로 말해. K-드라마 같은 장면과 진짜 쓰는 표현"),
    # 브라질 — 포르투갈어 단독. 드라마는 dorama
    dict(id="lab-br-instagram", p="Instagram", c="브라질", locale="pt-BR", name="SYNK LAB Brasil",
         h=["synklab.br", "synklab_br", "synklabbrasil"], limit=150, note=KIT.IG_NOTE,
         bio="O que você quer dizer, em coreano.\nCenas curtas, situações de dorama e frases reais, com legenda.\n" + KIT.KO_LINE,
         ko="하고 싶은 말, 한국어로. 짧은 장면, 드라마 같은 상황, 진짜 쓰는 표현, 자막과 함께"),
    dict(id="lab-br-youtube", p="YouTube", c="브라질", locale="pt-BR", name="SYNK LAB Brasil | Coreano divertido",
         h=["synklabbrasil", "synklab.br", "synklabbr"], limit=1000, note=YT_NOTE, bio=PT_YT, ko=KO_YT.format(lang="포르투갈어"),
         banner=dict(label="SYNK LAB · BRASIL", title=["O que você quer dizer,", "em coreano."], hl="O que você quer dizer")),
]


def banner_html():
    head = BANNER.HEAD.replace("SYNK LAB 해외 배너 · 클로드판 2026-10-02", "SYNK LAB 브라질·멕시코 배너 · 2026-10-02").replace(
        "LAB해외_짓기.py가 계정별_문구_LAB해외.json에서 지은 파일이다. 고칠 때는 json·짓기 스크립트를 고친다.",
        "../가입준비_브라질멕시코.py가 지은 파일이다. 고칠 때는 그 스크립트를 고친다.")
    parts = [head]
    for a in ACC:
        if "banner" in a:
            parts.append(BANNER.youtube(dict(id=a["id"], handle="@" + a["h"][0], locale=a["locale"], banner=a["banner"]),
                                        KIT.KO_LINE))
    parts.append("\n</body>\n</html>\n")
    return "".join(parts)


if __name__ == "__main__":
    u16 = KIT.u16
    bad = [f"{a['id']} {u16(a['bio'])}>{a['limit']}" for a in ACC if u16(a["bio"]) > a["limit"]]
    bad += [f"{a['id']} 강조 구절이 제목에 없다" for a in ACC if "banner" in a and a["banner"]["hl"] not in "".join(a["banner"]["title"])]
    if bad:
        raise SystemExit("문제: " + ", ".join(bad))
    L = ["# 브라질·멕시코 LAB 가입 준비 · 계정 4개 (2026-10-02)", "",
         "사용자 「응 둘 다 넣고 가입 까지 전부 진행해줘」. 전략은 [LAB 브라질·멕시코 전략](../LAB_브라질_멕시코_전략_20261002.md).", "",
         "**계정 만들기는 사용자가 직접 한다**(비밀번호·본인 인증·약관 동의는 Claude가 대신할 수 없다). 가입 화면에 아래 이름·핸들을 넣고, "
         f"사진은 모두 같은 몽글 [`{KIT.AVATAR}`]({KIT.AVATAR}), 웹사이트는 `https://synk.im/lab/`이다. "
         "만든 뒤 알려 주면 Claude가 소개·배너를 넣고 공개 화면을 확인한 뒤 장부(`../sns-계정.json`)에 적는다.", "",
         "- 순서: 유튜브 2개(같은 구글 계정 unmet23에서 연달아) → 인스타그램 브라질 → 틱톡 멕시코.",
         "- 소개는 AI 작성이고 원어민 확인 전이다. 처음 몇 편과 계정 소개는 원어민이 한 번 읽어 보면 좋다(출시 조건은 아님).",
         "- 「드라마 같은 상황」은 우리가 새로 만든 장면이라는 뜻이다. 실제 드라마 장면·노래 가사는 쓰지 않는다.",
         "- 멕시코 글은 중남미 어디서나 통하는 중립 스페인어(tú)다. 파라과이 채널은 지금처럼 vos 말투로 둔다.",
         "- 첫 영상을 올린 뒤에는 유튜브 설명의 「첫 편 준비 중」 문장을 지운다.",
         "- 앞서 준 [해외 LAB 가입 준비 20개](가입준비_LAB해외.md)는 그대로다. 이 4개는 그와 별도다.", ""]
    for i, a in enumerate(ACC, 1):
        L += [f"## {i}. {a['c']} · {a['p']}", "",
              f"- 이름: `{a['name']}`",
              f"- 핸들 후보: `{a['h'][0]}` → `{a['h'][1]}` → `{a['h'][2]}`" + (" (유튜브 핸들은 앞에 @)" if a["p"] == "YouTube" else ""),
              f"- 소개 ({u16(a['bio'])}/{a['limit']}자) — 뜻: {a['ko']}", "", "```text", a["bio"], "```", ""]
        if "banner" in a:
            L += [f"- 배너: `배너/out_브라질멕시코/` 안의 `{a['id']}` 파일(2560×1440, 가운데 1546×423에 글자). "
                  f"제목 「{' '.join(a['banner']['title'])}」 + 한국어 「{KIT.KO_LINE}」"]
        L += [f"- 만드는 길: {a['note']}", ""]
    with open(os.path.join(HERE, "가입준비_브라질멕시코.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L))
    with open(os.path.join(HERE, "가입준비_브라질멕시코.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(dict(revision="2026-10-02", note="계정 만들기는 사용자가 직접 한다", avatar=KIT.AVATAR, website="https://synk.im/lab/",
                       strategy="docs/마케팅/LAB_브라질_멕시코_전략_20261002.md", languageReview="AI 작성 · 원어민 확인 전",
                       accounts=[dict(id=a["id"], platform=a["p"], country=a["c"], locale=a["locale"], name=a["name"], handles=a["h"],
                                      bio=a["bio"], length=u16(a["bio"]), limit=a["limit"], koreanMeaning=a["ko"],
                                      **({"banner": a["banner"]} if "banner" in a else {})) for a in ACC]),
                  f, ensure_ascii=False, indent=1)
    with open(os.path.join(HERE, "배너", "배너_브라질멕시코.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(banner_html())
    for a in ACC:
        print(f"{a['id']:18s} {u16(a['bio']):4d}/{a['limit']}")
    print(len(ACC), "계정 · 글자 수 통과 · 배너 원고", sum("banner" in a for a in ACC), "장")
