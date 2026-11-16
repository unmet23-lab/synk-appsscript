"""
꿈 무대 영상 시험(2026-11-17) — 드리미나 Seedream 5.5로 그림 한 장을 낸다(유호님 11-17 「이미지는 seedream 5.5 (무료버전)으로」).
unmet23 계정의 「Seedream 5.5 2K 30일 무제한」 몫을 쓴다. 견적이 상한(기본 0)을 넘으면 서버가 내기 전에 멈추므로 크레딧이 나가지 않는다.

    python -X utf8 그림내기.py <지시문.txt> <판 이름> --받을곳 <폴더> [--참고 <그림>…] [--계정 unmet23] [--비율 16:9] [--장수 2] [--상한 0]

- 지시문의 [IMG1] · [IMG2] …는 --참고를 준 차례의 {{res:<id>}}로 바꾼다. 참고가 없으면 t2i, 있으면 i2i다.
- 받은 그림은 <받을곳>/<판 이름>_<n>.png, 기록은 <받을곳>/_그림내기.json 한 줄씩.
"""
import json
import os
import subprocess
import sys
import time

EXE = os.path.join(os.path.expanduser("~"), ".ai-tools", "dreamina-canvas", "dreamina-canvas.exe")
HOME = os.path.dirname(EXE)


def 값(이름, 기본=None, 여럿=False):
    a = sys.argv
    if 여럿:
        return [a[i + 1] for i, x in enumerate(a) if x == 이름 and i + 1 < len(a)]
    return a[a.index(이름) + 1] if 이름 in a else 기본


def cli(prof, *args, timeout=1800):
    r = subprocess.run([EXE, "--profile", prof, "--format", "json", "--non-interactive", *args],
                       capture_output=True, text=True, encoding="utf-8", timeout=timeout)
    try:
        return json.loads(r.stdout or r.stderr)
    except ValueError:
        raise RuntimeError(f"CLI 답을 못 읽음: {(r.stdout or r.stderr)[:400]}")


def main():
    지시문, 판 = sys.argv[1], sys.argv[2]
    받을곳 = 값("--받을곳")
    prof = 값("--계정", "unmet23")
    비율 = 값("--비율", "16:9")
    장수 = 값("--장수", "2")
    상한 = 값("--상한", "0")
    참고 = 값("--참고", 여럿=True)
    project = open(os.path.join(HOME, f"캔버스_{prof}.txt"), encoding="utf-8").read().strip()
    os.makedirs(받을곳, exist_ok=True)
    글 = open(지시문, encoding="utf-8").read().strip()
    refs = []
    for k, p in enumerate(참고, 1):
        j = cli(prof, "resource", "upload", "--file", os.path.abspath(p), "--project-id", project, "--name", f"{판}_참고{k}")
        if not j.get("ok"):
            raise RuntimeError(json.dumps(j, ensure_ascii=False)[:400])
        rid = j["data"]["resourceId"]
        refs.append(rid)
        글 = 글.replace(f"[IMG{k}]", f"{{{{res:{rid}}}}}")
    mode = "i2i" if refs else "t2i"
    ref_args = [x for r in refs for x in ("--ref", f"res:{r}")]
    t0 = time.time()
    잔액0 = cli(prof, "auth", "account")["data"]["availableCredits"]
    made = cli(prof, "node", "create", "image", "--model", "seedream_5.5", "--mode", mode, *ref_args, "--prompt", 글,
               "--ratio", 비율, "--resolution", 값("--해상도", "2K"), "--count", 장수, "--title", 판, "--project-id", project,
               "--run", "--credit-ceiling", 상한, "--wait", "--timeout", "15m")
    data = made.get("data") or made.get("partialData") or {}
    it = (data.get("items") or [data])[0]
    sub = it.get("submission") or it
    rids = [r.get("resourceId") for r in (sub.get("resources") or []) if r.get("state") == "succeeded"]
    잔액1 = cli(prof, "auth", "account")["data"]["availableCredits"]
    파일 = []
    for n, rid in enumerate(rids, 1):
        dst = os.path.join(받을곳, f"{판}_{n}.png")
        cli(prof, "resource", "download", rid, "--project-id", project, "-o", dst, timeout=300)
        파일.append(dst)
    줄 = {"판": 판, "모드": mode, "장수": 장수, "상한": 상한, "잔액 전": 잔액0, "잔액 뒤": 잔액1, "참고": 참고,
         "submitId": sub.get("submitId"), "상태": sub.get("state"), "파일": 파일, "걸린초": round(time.time() - t0),
         "오류": made.get("error"), "견적": made.get("creditConfirmation"), "지시문": 글}
    with open(os.path.join(받을곳, "_그림내기.json"), "a", encoding="utf-8") as fh:
        fh.write(json.dumps(줄, ensure_ascii=False) + "\n")
    print(json.dumps({k: v for k, v in 줄.items() if k != "지시문"}, ensure_ascii=False)[:1500])


if __name__ == "__main__":
    main()
