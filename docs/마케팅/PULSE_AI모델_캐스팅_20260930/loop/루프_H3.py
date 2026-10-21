# 1차 다섯 명(F05 소연 · M04 민재 · F06 은정 · F07 채원 · M05 준호) 보드 루프를 로컬 MiniMax H3(ComfyUI 127.0.0.1:8188)로 뽑는다.
#   1기 일곱 명 루프(Wan 3.0, README)처럼 시작 그림과 끝 그림을 같은 대표 사진으로 묶어 이음매를 없앤다.
#   그래프·설정은 지유 광고 `../../PULSE_포트폴리오_제작준비_20261012/video/jiyu-skincare-20261018/영상_H3.py`와 같다:
#   본체 minimax_h3_fl2va_pruned_int8_convrot · 글 인코더 qwen3vl_32b nvfp4_awq · 영상 VAE int8, res_multistep · simple ·
#   BasicGuider, 20단계, 24fps. 크기는 대표 사진 비율(3:4) 그대로 768×1024, 길이는 17k+5 칸에서 4초에 가장 가까운 107프레임(4.46초).
#   마지막 프레임은 첫 프레임과 같은 그림이라 루프에서는 0~105번(106장, 4.42초)만 쓴다.
#   영상에 붙어 나온 소리는 버린다(보드 루프는 소리 없음).
# 쓰기: <ComfyUI venv python> -X utf8 루프_H3.py F05 M04 F06 F07 M05     ← 적은 순서대로 하나씩 넣고 끝날 때마다 받는다
#       H3_SEED=7 … 루프_H3.py F06                                         ← 안 되면 시드만 바꿔 한 번 더
#       H3_HOLD=1 H3_SEED=101 … 루프_H3.py M04 F07                         ← 이가 보이는 대표의 입·깜빡임을 더 못 박은 판
import json
import os
import shutil
import sys
import time
import urllib.request
import uuid

from PIL import Image

COMFY = "http://127.0.0.1:8188"
COMFY_DIR = r"C:\SYNK-LoRA\tools\ComfyUI"
CAST = r"C:\SYNK-LoRA\casting\wave1_20261019"
OUT = os.environ.get("LOOP_OUT", r"C:\SYNK-LoRA\work\pulse_gate_20261021\loop")
STEPS = int(os.environ.get("H3_STEPS", "20"))
SEED = int(os.environ.get("H3_SEED", "42"))
FRAMES = 107
W, H = 768, 1024
LOG = os.path.join(OUT, "기록.txt")

# 대표 사진은 명세서 「기준파일.대표사진」과 같다.
HERO = {"F05": "F05_c2.jpg", "M04": "M04_c2.jpg", "F06": "F06_c1.jpg", "F07": "F07_c1.jpg", "M05": "M05_h1.jpg"}

# 인물 문장: 명세서 「바뀌면_안되는_것」·「얼굴」·LoRA 주의(나이 낱말, 준호 clean-shaven 등)에서 대표 사진에 보이는 것만.
CHAR = {
    "F05": ("CHARACTER: a Korean woman in her mid-thirties with collarbone-length dark brown hair with C-curl ends, soft cheeks "
            "that lift when she smiles, faint shadows under her eyes, natural makeup with muted rose lips, a beige knit sweater."),
    "M04": ("CHARACTER: a Korean man in his late twenties with a round face, a rounded nose tip, small hooded eyes, short black "
            "hair with messy straight bangs, a faint stubble shadow, a light grey sweatshirt."),
    "F06": ("CHARACTER: a Korean woman in her mid-forties with medium-length dark brown wavy hair swept to the side, fine lines "
            "at the corners of her eyes, early smile lines, small single pearl stud earrings, a cream knit sweater. She looks "
            "her age, gracefully."),
    "F07": ("CHARACTER: a Korean woman in her mid-twenties with a short black pixie cut, thick straight eyebrows, monolid eyes, "
            "sun-tanned warm skin with light sun freckles across her nose and cheekbones, a dark grey sleeveless athletic top."),
    "M05": ("CHARACTER: a Korean man in his late thirties with short black hair neatly side-parted, a broad forehead, crow's "
            "feet when he smiles, clean-shaven with a smooth jaw, a navy crew-neck knit sweater."),
}
# 대표 사진의 웃음을 그대로 둔다(민재·채원은 이가 보이는 웃음, 나머지는 입 다문 미소).
SMILE = {
    "F05": "the gentle closed-mouth smile of the start image",
    "M04": "the warm open smile of the start image, upper teeth showing",
    "F06": "the gentle closed-mouth smile of the start image",
    "F07": "the bright open smile of the start image, upper teeth showing",
    "M05": "the calm closed-mouth smile of the start image",
}
PRON = {"F05": "she", "M04": "he", "F06": "she", "F07": "she", "M05": "he"}
# H3_HOLD=1(10-21 Fable 게이트 뒤): 이가 보이는 대표(민재·채원)는 가운데에서 입을 닫았다 다시 열고 눈을 두 번 감았다
#   → 이가 계속 보이고 입술이 움직이지 않는다 · 0.2초 깜빡임 한 번을 못 박는다. 결과 이름은 <코드>_h3_hold_s<시드>.mp4
HOLD = os.environ.get("H3_HOLD") == "1"
TAG = "h3_hold" if HOLD else "h3"

GLOBAL = ("GLOBAL STYLE: Live-action footage from a casting reel, vertical 3:4, a head-and-shoulders portrait in front of a "
          "plain warm grey seamless studio backdrop. Real-time speed throughout, no slow motion, no time dilation. No fade in "
          "or out; the first and last frames are full-exposure frames.")
REF = ("REFERENCES: the start image is both the first frame and the last frame of this single shot, so the shot ends exactly "
       "where it began. Keep its framing, light, wardrobe and the face exactly. Keep exactly this person throughout.")
TEX = ("TEXTURE AND REALISM: a real person filmed on set: unretouched skin with visible pores, slight asymmetry, natural skin "
       "color variation. No beauty filter, no airbrushed or glowing skin, no added grain, no added sharpening, no plastic sheen.")
LIGHT = "LIGHT: Soft studio key light from camera left with gentle fill, exactly as in the start image; the light stays constant."
CAM = "CAMERA: A locked-off cinema camera on a tripod; the frame does not move at all. Keep the face readable and correctly focused."


def prompt(code):
    p = PRON[code]
    keep = " The upper teeth stay visible in every frame and the lips do not move." if HOLD and "teeth" in SMILE[code] else ""
    blink = "blinks exactly once, a single quick blink of about 0.2 seconds," if HOLD else "blinks once naturally"
    act = (f"ACTING: A quiet living portrait, not a performance. {p.capitalize()} keeps {SMILE[code]} for the whole shot and "
           f"looks into the lens.{keep} {p.capitalize()} {blink} and takes one small, soft breath; a few strands of hair "
           f"stir very slightly. Expressions never morph. No talking, no humming, no laughing, no new expression, no nodding, "
           f"no head turn, no facial reshaping, the mouth keeps the same shape as in the start image.")
    cons = ("CONSISTENCY: the same person, hair and clothes as the start image. Alone. Nothing new appears in the frame. No "
            "text, no logos, no subtitles.")
    return "\n".join([GLOBAL, REF, TEX, LIGHT, CHAR[code], act, CAM, cons])


def prepare(code):
    """대표 사진(3:4)을 768×1024로 줄여 ComfyUI input/pulse_loop/에 둔다(ComfyUI 쪽은 영문 이름)."""
    os.makedirs(os.path.join(COMFY_DIR, "input", "pulse_loop"), exist_ok=True)
    im = Image.open(os.path.join(CAST, HERO[code])).convert("RGB")
    w, h = im.size
    if abs(h / w - H / W) > 0.01:
        nh = round(w * H / W)
        top = (h - nh) // 2
        im = im.crop((0, top, w, top + nh))
    name = f"pulse_loop/{code}_hero.png"
    im.resize((W, H), Image.LANCZOS).save(os.path.join(COMFY_DIR, "input", name))
    return name


def graph(code, name):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "minimax_h3_fl2va_pruned_int8_convrot.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "type": "minimax", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_video_vae_int8_convrot.safetensors"}},
        "5": {"class_type": "LoadImage", "inputs": {"image": name}},
        "6": {"class_type": "MiniMaxH3ImageToVideo", "inputs": {"clip": ["2", 0], "vae": ["3", 0], "prompt": prompt(code),
                                                                 "width": W, "height": H, "length": FRAMES,
                                                                 "first_frame": ["5", 0], "last_frame": ["5", 0]}},
        "7": {"class_type": "RandomNoise", "inputs": {"noise_seed": SEED}},
        "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "res_multistep"}},
        "9": {"class_type": "BasicScheduler", "inputs": {"model": ["1", 0], "scheduler": "simple", "steps": STEPS, "denoise": 1.0}},
        "10": {"class_type": "BasicGuider", "inputs": {"model": ["1", 0], "conditioning": ["6", 0]}},
        "11": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["7", 0], "guider": ["10", 0], "sampler": ["8", 0],
                                                                  "sigmas": ["9", 0], "latent_image": ["6", 1]}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["3", 0]}},
        "14": {"class_type": "CreateVideo", "inputs": {"images": ["12", 0], "fps": 24}},
        "15": {"class_type": "SaveVideo", "inputs": {"video": ["14", 0], "filename_prefix": f"pulse_loop/{TAG}_{code}_s{SEED}",
                                                     "format": "auto", "codec": "auto"}},
    }


def post(path, data):
    req = urllib.request.Request(COMFY + path, data=json.dumps(data).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def get(path):
    return json.load(urllib.request.urlopen(COMFY + path, timeout=60))


def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def run(code):
    name = prepare(code)
    pid = post("/prompt", {"prompt": graph(code, name), "client_id": str(uuid.uuid4())})["prompt_id"]
    t0 = time.time()
    log(f"{code} 넣음 {pid} steps={STEPS} seed={SEED} frames={FRAMES} {W}x{H}{' hold' if HOLD else ''}")
    while True:
        time.sleep(10)
        h = get(f"/history/{pid}")
        if pid not in h:
            continue
        st = h[pid].get("status", {})
        if st.get("status_str") == "error" or any(m[0] == "execution_error" for m in st.get("messages", [])):
            log(f"{code} 오류 {json.dumps(st.get('messages'), ensure_ascii=False)[:1500]}")
            return False
        files = [f for o in h[pid].get("outputs", {}).values() for k in ("images", "videos", "gifs") for f in o.get(k, [])]
        if files:
            f = files[0]
            dst = os.path.join(OUT, f"{code}_{TAG}_s{SEED}.mp4")
            shutil.copyfile(os.path.join(COMFY_DIR, "output", f.get("subfolder", ""), f["filename"]), dst)
            log(f"{code} 끝 {time.time() - t0:.0f}초 → {os.path.basename(dst)}")
            return True


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(OUT, exist_ok=True)
    codes = sys.argv[1:]
    for c in codes:
        if c not in HERO:
            raise SystemExit(f"모르는 코드 {c} (있는 코드: {' '.join(HERO)})")
    if "--지시문" in os.environ.get("LOOP_SHOW", ""):
        for c in codes:
            print(f"== {c}\n{prompt(c)}\n")
        sys.exit(0)
    for c in codes:
        run(c)
