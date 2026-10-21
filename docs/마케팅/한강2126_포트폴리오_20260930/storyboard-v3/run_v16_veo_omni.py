# -*- coding: utf-8 -*-
"""v16: 한강 오프닝을 Veo 3.1 Lite와 Gemini Omni Flash 1.1(360p)로 처음부터 끝까지 한 번에 뽑는다.

클립 넷을 두 모델로, 같은 첫·끝 그림과 같은 지시문으로 만든다(가장 낮은 화질·가장 싼 설정).
  A 출근길 → 안경 톡 → 넓게 미끄러짐 → 시간 멈춤      첫: 걷는 정지컷        끝: 멈춘 넓은 장면(X)
  B 까몽 깜빡 → 멈춘 세상을 돌아 X로                  첫: 까몽 접사          끝: X
  C 시간이 돌아와 넘어짐 → 카메라가 내려가 누운 얼굴    첫: X                  끝: 누운 정지컷
  D synk 건물 → 입구, 하늘이 갠다                      첫: 건물 정지컷 a      끝: 건물 정지컷 b
그림은 stills/v16_veo_omni_입력/, 지시문은 prompts/v16-*.txt.

쓰는 법:
  python run_v16_veo_omni.py <출력 폴더> --check   견적과 잔액만 본다(작업을 만들지 않음)
  python run_v16_veo_omni.py <출력 폴더>           잔액이 견적보다 많을 때만 8개를 한 번에 주문하고 받는다
  python run_v16_veo_omni.py <출력 폴더> A_omni C_veo   일부만 다시 주문
결과: <출력 폴더>/<클립>_<모델>.mp4, 작업 번호와 견적은 jobs.json(계정 메일은 지움).
"""
import json
import os
import re
import subprocess
import sys
import threading

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
BASE = os.path.dirname(HERE)
IN = HERE + "/stills/v16_veo_omni_입력/"
PR = BASE + "/prompts/"
H = os.path.expandvars("%APPDATA%/npm/higgsfield.exe")
MAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+")
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

CLIPS = {
    "A": ("v16-A-출근길_미끄러짐_멈춤.txt", "A_start_walk.jpg", "X_frozen.jpg"),
    "B": ("v16-B-까몽_멈춘세상.txt", "B_start_plush.jpg", "X_frozen.jpg"),
    "C": ("v16-C-시간돌아옴_넘어짐_누움.txt", "X_frozen.jpg", "C_end_lying.jpg"),
    "D": ("v16-D-건물_입구.txt", "D_start_hero_a.jpg", "D_end_hero_b.jpg"),
}
MODELS = {
    # Omni: 360p가 가장 싸다(1초 1크레딧). 첫·끝 그림은 image-to-video 모드.
    "omni": ["gemini_omni_flash_1_1", "--mode", "image-to-video", "--resolution", "360p", "--duration", "8", "--aspect_ratio", "9:16"],
    # Veo 3.1 Lite: 1초 1.5크레딧(소리 켜도 같음). 첫·끝 그림을 함께 주면 8초만 된다.
    "veo": ["veo3_1_lite", "--duration", "8", "--aspect_ratio", "9:16", "--generate_audio", "true"],
}


def hf(args, timeout=None):
    p = subprocess.run([H] + args, capture_output=True, text=True, encoding="utf-8", timeout=timeout)
    return MAIL.sub("(계정)", p.stdout or ""), MAIL.sub("(계정)", p.stderr or ""), p.returncode


def balance():
    out, _, _ = hf(["account", "status"])
    m = re.search(r"([\d.]+) credits", out)
    return float(m.group(1)) if m else None


def uploads(out_dir):
    path = out_dir + "/uploads.json"
    ids = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    for name in sorted({x for c in CLIPS.values() for x in c[1:]}):
        if name in ids:
            continue
        out, err, _ = hf(["upload", "create", IN + name, "--json"], timeout=600)
        m = UUID.search(out)
        if not m:
            sys.exit("업로드 실패 %s: %s" % (name, (err or out)[-300:]))
        ids[name] = m.group(0)
        json.dump(ids, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("올림", name, ids[name])
    return ids


def job_args(clip, model, ids):
    prompt_file, start, end = CLIPS[clip]
    prompt = open(PR + prompt_file, encoding="utf-8").read().strip()
    return MODELS[model] + ["--prompt", prompt, "--start-image", ids[start], "--end-image", ids[end]]


def main():
    out_dir = sys.argv[1].replace("\\", "/")
    check = "--check" in sys.argv
    picks = [a for a in sys.argv[2:] if a != "--check"] or ["%s_%s" % (c, m) for c in CLIPS for m in MODELS]
    os.makedirs(out_dir, exist_ok=True)
    ids = uploads(out_dir)
    est = {}
    for key in picks:
        clip, model = key.split("_")
        out, err, _ = hf(["generate", "cost"] + job_args(clip, model, ids))
        m = re.search(r"([\d.]+) credits", out)
        est[key] = float(m.group(1)) if m else None
        print("견적 %-7s %s" % (key, est[key] if est[key] is not None else (err or out).strip()[-200:]))
    total = sum(v for v in est.values() if v)
    bal = balance()
    print("합계 %.1f크레딧 · 잔액 %s" % (total, bal))
    if check:
        return
    if None in est.values() or bal is None or bal < total:
        sys.exit("주문하지 않음: 견적을 못 냈거나 잔액이 모자란다.")

    log_path = out_dir + "/jobs.json"
    log = json.load(open(log_path, encoding="utf-8")) if os.path.exists(log_path) else {}
    lock = threading.Lock()

    def run(key):
        clip, model = key.split("_")
        out, err, code = hf(["generate", "create"] + job_args(clip, model, ids)
                            + ["--wait", "--wait-timeout", "30m", "--wait-interval", "5s", "--json"])
        rec = {"clip": clip, "model": model, "job_type": MODELS[model][0], "estimate": est[key], "status": "unknown"}
        try:
            j = json.loads(out)
            j = j[0] if isinstance(j, list) else j
            rec.update(id=j.get("id"), status=j.get("status"), result_url=j.get("result_url"))
        except Exception:
            m = UUID.search(out + err)
            rec.update(id=m.group(0) if m else None, error=(err or out).strip()[-400:])
        if rec.get("result_url"):
            f = "%s/%s.mp4" % (out_dir, key)
            subprocess.run(["curl", "-sL", "-o", f, rec["result_url"]], check=False)
            rec["file"] = f if os.path.exists(f) and os.path.getsize(f) > 1000 else None
        open("%s/%s.json" % (out_dir, key), "w", encoding="utf-8").write(out)
        if err.strip():
            open("%s/%s.err" % (out_dir, key), "w", encoding="utf-8").write(err)
        with lock:
            log[key] = rec
            json.dump(log, open(log_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print("끝 %-7s %s %s" % (key, rec.get("status"), rec.get("file") or rec.get("error", "")[-160:]))

    threads = [threading.Thread(target=run, args=(k,)) for k in picks]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    print("잔액(끝난 뒤) %s" % balance())


if __name__ == "__main__":
    main()
