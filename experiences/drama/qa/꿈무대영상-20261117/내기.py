"""
꿈 무대 영상 시험(2026-11-17) — 드리미나 시댄스 2.5 한 판을 CLI로 낸다. 영상 참고(@영상 1)를 넣을 수 있게 따로 둔 작은 도구다
(PULSE `드리미나내기.py`는 그림 · 소리 참고만 받는다).

    python -X utf8 내기.py <지시문.txt> <판 이름> --받을곳 <폴더> [--첫장 <그림>] [--그림 <그림>…] [--영상 <영상>…]
                            [--계정 unmet23] [--길이 5] [--비율 16:9] [--상한 <크레딧>] [--실행]

- --첫장을 주고 다른 참고가 없으면 first_last_frame(첫 장 고정), 그 밖에는 m2v다.
- 지시문의 @이미지 N · @영상 N은 올린 파일의 {{res:<id>}}로 바꾼다(차례: --그림 · --영상을 준 차례).
- 기본은 견적만 본다(상한 1로 --run — 견적이 상한을 넘으면 서버가 내기 전에 멈춘다). --실행일 때만 --상한 안에서 낸다.
- 받은 파일은 <받을곳>/<판 이름>.mp4, 기록은 <받을곳>/_내기.json 한 줄씩.
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
        out = []
        for i, x in enumerate(a):
            if x == 이름 and i + 1 < len(a):
                out.append(a[i + 1])
        return out
    return a[a.index(이름) + 1] if 이름 in a else 기본


def cli(prof, *args, timeout=3000):
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
    길이 = 값("--길이", "5")
    비율 = 값("--비율", "16:9")
    실행 = "--실행" in sys.argv
    상한 = int(값("--상한", "0"))
    첫장 = 값("--첫장")
    그림들 = 값("--그림", 여럿=True)
    영상들 = 값("--영상", 여럿=True)
    project = open(os.path.join(HOME, f"캔버스_{prof}.txt"), encoding="utf-8").read().strip()
    os.makedirs(받을곳, exist_ok=True)
    글 = open(지시문, encoding="utf-8").read().strip()

    def 올림(p, 꼬리):
        j = cli(prof, "resource", "upload", "--file", os.path.abspath(p), "--project-id", project, "--name", f"{판}_{꼬리}")
        if not j.get("ok"):
            raise RuntimeError(json.dumps(j, ensure_ascii=False)[:400])
        return j["data"]["resourceId"]

    refs = []
    if 첫장 and not 그림들 and not 영상들:
        mode = "first_last_frame"
        rid = 올림(첫장, "첫장")
        refs.append(rid)
        글 = 글.replace("@이미지 1", f"{{{{res:{rid}}}}}")
    else:
        mode = "m2v"
        for k, p in enumerate(([첫장] if 첫장 else []) + 그림들, 1):
            rid = 올림(p, f"그림{k}")
            refs.append(rid)
            글 = 글.replace(f"@이미지 {k}", f"{{{{res:{rid}}}}}")
        for k, p in enumerate(영상들, 1):
            rid = 올림(p, f"영상{k}")
            refs.append(rid)
            글 = 글.replace(f"@영상 {k}", f"{{{{res:{rid}}}}}")
    ref_args = [x for r in refs for x in ("--ref", f"res:{r}")]
    ceiling = 상한 if 실행 else 1
    t0 = time.time()
    def 잔액():
        # 잔액 읽기가 가끔 빈 답을 준다(11-17 컷 3: 영상은 만들어졌는데 여기서 넘어져 받지 못했다) — 못 읽으면 None으로 두고 계속 간다
        try:
            return cli(prof, "auth", "account")["data"]["availableCredits"]
        except Exception:
            return None

    잔액0 = 잔액()
    made = cli(prof, "node", "create", "video", "--model", "seedance_2.5", "--mode", mode, *ref_args, "--prompt", 글,
               "--ratio", 비율, "--resolution", "720p", "--duration", 길이, "--title", 판, "--project-id", project,
               "--run", "--credit-ceiling", str(ceiling), "--wait", "--timeout", "45m")
    data = made.get("data") or made.get("partialData") or {}
    it = (data.get("items") or [data])[0]
    sub = it.get("submission") or it
    rid = next((r.get("resourceId") for r in (sub.get("resources") or []) if r.get("state") == "succeeded" or r.get("status") == "success"), None)
    잔액1 = 잔액()
    줄 = {"판": 판, "모드": mode, "길이": 길이, "실행": 실행, "상한": ceiling, "잔액 전": 잔액0, "잔액 뒤": 잔액1,
         "submitId": sub.get("submitId"), "resourceId": rid, "상태": sub.get("state"), "걸린초": round(time.time() - t0),
         "오류": made.get("error"), "지시문": 글}
    if rid:
        dst = os.path.join(받을곳, f"{판}.mp4")
        # 받기가 실패해도 답이 조용할 때가 있다(11-17 컷 1) — 파일이 생겼는지 보고 한 번 더 받는다
        for _ in range(2):
            try:
                cli(prof, "resource", "download", rid, "--project-id", project, "-o", dst, timeout=300)
            except Exception as e:
                줄["받기 오류"] = str(e)[:200]
            if os.path.exists(dst) and os.path.getsize(dst) > 100000:
                줄["파일"] = dst
                break
        else:
            줄["받기"] = "실패 — dreamina-canvas resource download <resourceId> --project-id <캔버스> -o <파일>로 다시 받는다"
    with open(os.path.join(받을곳, "_내기.json"), "a", encoding="utf-8") as fh:
        fh.write(json.dumps(줄, ensure_ascii=False) + "\n")
    print(json.dumps({k: v for k, v in 줄.items() if k != "지시문"}, ensure_ascii=False)[:1500])
    if not rid and not 실행:
        print(json.dumps(made, ensure_ascii=False)[:1500])


if __name__ == "__main__":
    main()
