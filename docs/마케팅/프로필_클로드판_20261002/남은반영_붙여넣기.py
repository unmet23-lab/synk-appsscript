"""이미 있는 계정 중 아직 반영하지 못한 곳의 붙여넣기 묶음(남은반영_붙여넣기.md).

    python 남은반영_붙여넣기.py

반영_순서.md에서 ✅(게시 완료)가 아닌 계정을 골라, 편집 화면 주소·바꿀 사진·배너·소개 전문을 한곳에 모은다.
얼굴 사진이 걸린 유호 계정은 사진을 두고 소개·배너만 바꾼다(사용자 10-02). 몽골 LAB은 사진만(몽골어 검수 전).
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
P1 = {a["id"]: a for a in json.load(open(os.path.join(HERE, "계정별_문구.json"), encoding="utf-8"))["accounts"]}
P2 = {a["id"]: a for a in json.load(open(os.path.join(HERE, "계정별_문구_LAB해외.json"), encoding="utf-8"))["accounts"]}

EDIT = {
    "lab-vn-youtube": "https://studio.youtube.com/channel/UC7NbBUofc_ZK5qCSjzbUzGQ/editing/profile?authuser=0",
    "yuhobuilds-x": "https://x.com/settings/profile",
    "yuhobuilds-threads": "Threads 앱 → 프로필 → 프로필 편집",
    "yuho-linkedin-primary": "https://www.linkedin.com/in/me/ → 소개 섹션 편집 · 배경 사진 변경",
    "synk-linkedin-company": "https://www.linkedin.com/company/synk-im/admin/ → 페이지 편집",
    "yuhobuilds-tiktok": "https://www.tiktok.com/@yuhobuilds → 프로필 편집",
    "synkbrief-tiktok": "https://www.tiktok.com/@synkbrief → 프로필 편집",
    "lab-tiktok": "https://www.tiktok.com/@synk.mn → 프로필 편집",
    "lab-vn-tiktok": "https://www.tiktok.com/@synklab.vn → 프로필 편집",
    "lab-mm-tiktok": "https://www.tiktok.com/@synklab.mm → 프로필 편집(이름도 SYNK LAB Myanmar로, 9/27 이후 가능)",
    "yuhobuilds-instagram": "인스타그램 앱 → 프로필 편집(웹 저장은 옛 글로 돌아간 기록)",
    "synkbrief-instagram": "인스타그램 앱 → 프로필 편집",
    "lab-instagram": "인스타그램 앱 → 프로필 편집",
    "lab-facebook": "https://www.facebook.com/synkworld → 프로필 사진",
    "lab-np-facebook": "https://www.facebook.com/synklab.np → 소개 편집 · 커버 사진 추가",
    "lab-kh-facebook": "캄보디아 페이지 → 소개 편집 · 커버 사진 추가",
    "lab-lk-facebook": "스리랑카 페이지 → 소개 편집 · 커버 사진 추가",
    "yuhobuilds-telegram": "https://web.telegram.org → 설정 → 내 정보(소개)",
    "lab-telegram": "https://web.telegram.org → @synkmn 채널 정보 편집(사진만)",
    "lab-uz-telegram": "https://web.telegram.org → @synklab_uz 채널 정보 편집",
    "yuhobuilds-behance": "https://www.behance.net/yuhobuilds → 프로필 편집 · 배너",
    "shift-pinterest": "https://www.pinterest.com/settings/edit-profile",
    "shift-tistory": "https://yuhobuilds.tistory.com/manage/setting/blog",
    "shift-naverblog": "https://admin.blog.naver.com/synkshift/config/blog",
    "shift-kakao": "https://center-pf.kakao.com → 채널 관리 → 프로필 설정",
    "synklab-substack": "https://synklab.substack.com/publish/settings",
    "lab-ru-rutube": "https://studio.rutube.ru → 채널 설정",
    "lab-cn-xiaohongshu": "rednote 앱 → 나 → 프로필 편집",
    "yuhobuilds-naver-clip": "네이버 클립 앱(웹에서 소유자 편집이 안 열렸음)",
}
FACE = {"yuhobuilds-x", "yuhobuilds-threads", "yuho-linkedin-primary", "yuhobuilds-tiktok", "yuhobuilds-instagram",
        "yuhobuilds-telegram", "yuhobuilds-naver-clip", "shift-tistory", "shift-naverblog"}
MN = {"lab-instagram", "lab-tiktok", "lab-facebook", "lab-telegram"}


def rows():
    s = open(os.path.join(HERE, "반영_순서.md"), encoding="utf-8").read()
    out = []
    for line in s.splitlines():
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) != 9 or not cells[0].isdigit():
            continue
        m = re.match(r"`([^`]+)`", cells[2])
        if m and "✅" not in cells[8]:
            out.append(dict(group=cells[1], id=m.group(1), platform=cells[3], avatar=cells[4], banner=cells[5], result=cells[8]))
    return out


if __name__ == "__main__":
    L = ["# 남은 반영 · 붙여넣기 묶음 (2026-10-02)", "",
         "Chrome 자동 반영이 앱의 자동 판정기에 막혀 멈춘 뒤 남은 계정이다. 사용자가 직접 바꿀 때 이 순서대로 붙여 넣으면 된다. "
         "Claude가 다시 이어 할 수 있게 되면 같은 목록으로 진행한다.", "",
         "- 얼굴 사진이 걸린 유호 계정은 사진을 두고 소개·배너만 바꾼다. 몽골 LAB은 몽글 사진만 바꾸고, 몽골어 소개·배너는 원어민 검수 뒤에 한다.",
         "- 사진 파일은 `프로필/`, 배너는 `배너/out/`(1차)·`배너/out_LAB해외/`(해외)에 있다. 계정 이름·핸들·링크는 바꾸지 않는다.",
         "- **먼저:** Chrome의 Claude 탭 그룹에 열린 유튜브 파라과이·일본 편집 화면은 배너·사진·소개가 다 들어가 있다. 오른쪽 위 「게시」만 누른다.", ""]
    n = 0
    for r in rows():
        i = r["id"]
        if r["result"].startswith("⏸"):
            continue
        a = P1.get(i) or P2.get(i)
        if not a:
            continue
        n += 1
        h = a.get("handle", "")
        if h.startswith("("):
            h = f"{a.get('country', '').title()} 페이지"
        L.append(f"## {n}. {a.get('platform', r['platform'])} `{h}`")
        L.append("")
        L.append(f"- 편집: {EDIT.get(i, '—')}")
        if i in FACE:
            L.append("- 사진: 지금 얼굴 사진 그대로")
        else:
            L.append(f"- 사진: `프로필/{r['avatar']}.png`")
        if i in MN:
            L.append("- 소개·배너: 몽골어 원어민 검수 뒤(지금은 사진만)")
            L.append("")
            continue
        if r["banner"] not in ("—", "검수 뒤"):
            import glob
            hits = glob.glob(os.path.join(HERE, "배너", "out_LAB해외", f"*_{i}.png"))
            if not hits:
                for part in r["banner"].split("·"):
                    part = part.strip()
                    num = part.split("/")[-1][:2] if "/" in part else part[:2]
                    hits += glob.glob(os.path.join(HERE, "배너", "out", f"{num}_*.png"))
            names = ", ".join("`배너/" + os.path.relpath(h, os.path.join(HERE, "배너")).replace(os.sep, "/") + "`" for h in hits)
            L.append(f"- 배너·커버: {names or r['banner']}")
        if a.get("name"):
            L.append(f"- 이름: 그대로(참고 `{a['name']}`)")
        if a.get("website"):
            L.append(f"- 웹사이트: {a['website']}")
        L.append("")
        L.append("```text")
        L.append(a["bio"])
        L.append("```")
        if a.get("fallback"):
            L.append(f"금칙어로 막히면: `{a['fallback']}`")
        if a.get("bioShort"):
            L.append("짧은 소개:")
            L.append("```text")
            L.append(a["bioShort"])
            L.append("```")
        L.append("")
    with open(os.path.join(HERE, "남은반영_붙여넣기.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L))
    print(n, "계정")
