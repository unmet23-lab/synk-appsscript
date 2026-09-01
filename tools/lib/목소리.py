# 목소리 생성 알맹이 — 「문장 하나 → 소리 파일 하나」.
#
# 이 파일은 «우리 것»이고(repo 가 쥔다), 모델·가상환경은 «빌린 것»이라 저장소 밖에 산다
# (`C:\Users\q1212\Documents\synk-vendor`). 어느 엔진을 어디서 부르는지는
# 부르는 쪽(`tools/목소리굽기.js`)이 정한다 — 여기는 시키는 대로 굽기만 한다.
#
# 엔진 둘로 갈리는 까닭(유호 판정 2026-09-01 · 정본 = docs/깃허브_정찰_0901.html):
#   qwen      — 한국어. 목소리 Sohee 가 «모국어 한국어»다. 톤을 말로 지시할 수 있다.
#   omnivoice — 몽골어. 600+ 언어를 싣는 유일한 후보다.
import argparse, os, sys, time


def 굽기_qwen(글, 언어, 목소리, 톤, 출력, 모델, model=None):
    import torch, soundfile as sf
    from qwen_tts import Qwen3TTSModel

    if model is None:
        장치 = "xpu" if (hasattr(torch, "xpu") and torch.xpu.is_available()) else "cpu"
        # 🔴 Arc(XPU)에서는 **float32 만 된다**(2026-09-01 실측). float16·bfloat16 은 둘 다
        #    `TensorCompareKernels.cpp:180` assertion 으로 죽는다 — XPU 커널 쪽 한계다.
        #    (OmniVoice 는 같은 GPU 에서 float16 이 멀쩡하다 — 엔진마다 다르니 함께 바꾸지 말 것.)
        dtype = torch.float32
        print("[엔진] qwen / 장치 %s / dtype %s" % (장치, dtype), flush=True)
        t = time.time()
        model = Qwen3TTSModel.from_pretrained(모델, device_map=장치, dtype=dtype)
        print("[적재] %.1f초" % (time.time() - t), flush=True)

    kw = dict(text=글, language=언어, speaker=목소리)
    if 톤:
        kw["instruct"] = 톤
    t = time.time()
    wavs, sr = model.generate_custom_voice(**kw)
    걸린 = time.time() - t
    sf.write(출력, wavs[0], sr)
    return 걸린, len(wavs[0]) / float(sr), sr, model


def 굽기_omnivoice(글, 톤, 출력, 모델, model=None):
    import torch, soundfile as sf
    from omnivoice import OmniVoice

    if model is None:
        장치 = "xpu" if (hasattr(torch, "xpu") and torch.xpu.is_available()) else "cpu"
        dtype = torch.float16 if 장치 == "xpu" else torch.float32   # 여기선 fp16 이 멀쩡하다
        print("[엔진] omnivoice / 장치 %s" % 장치, flush=True)
        t = time.time()
        model = OmniVoice.from_pretrained(모델, device_map=장치, dtype=dtype)
        print("[적재] %.1f초" % (time.time() - t), flush=True)

    kw = dict(text=글)
    if 톤:
        kw["instruct"] = 톤          # 목소리 설계(성별·나이·높낮이 등)
    t = time.time()
    audio = model.generate(**kw)
    걸린 = time.time() - t
    sf.write(출력, audio[0], 24000)
    return 걸린, len(audio[0]) / 24000.0, 24000, model


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--엔진", required=True, choices=["qwen", "omnivoice"])
    p.add_argument("--글", default=None)
    p.add_argument("--글목록", default=None, help="한 줄에 하나씩 든 UTF-8 파일 — 모델을 한 번만 올려 전부 굽는다")
    p.add_argument("--언어", default="Korean")
    p.add_argument("--목소리", default="Sohee")
    p.add_argument("--톤", default=None)
    p.add_argument("--출력", default=None)
    p.add_argument("--출력폴더", default=None)
    p.add_argument("--모델", required=True)
    a = p.parse_args()

    # 여러 줄을 한 번에 — 적재가 한 번뿐이라 11줄이면 «적재 10번»을 아낀다.
    if a.글목록:
        with open(a.글목록, encoding="utf-8") as f:
            줄들 = [l.strip() for l in f if l.strip() and not l.startswith("#")]
        폴더 = a.출력폴더 or os.path.dirname(os.path.abspath(a.글목록))
        os.makedirs(폴더, exist_ok=True)
        모델객체 = None
        for i, 줄 in enumerate(줄들, 1):
            # 「이름<탭>읽을 글」 꼴이면 앞칸을 파일 이름으로 쓴다
            if "\t" in 줄:
                이름, 글 = 줄.split("\t", 1)
            else:
                이름, 글 = "%02d" % i, 줄
            안전이름 = "".join(c for c in 이름 if c not in '\\/:*?"<>|').strip() or ("%02d" % i)
            경로 = os.path.join(폴더, 안전이름 + ".wav")
            try:
                if a.엔진 == "qwen":
                    걸린, 길이, sr, 모델객체 = 굽기_qwen(글, a.언어, a.목소리, a.톤, 경로, a.모델, 모델객체)
                else:
                    걸린, 길이, sr, 모델객체 = 굽기_omnivoice(글, a.톤, 경로, a.모델, 모델객체)
                print("  [%d/%d] %s — %.1f초 생성 / %.1f초 소리" % (i, len(줄들), 안전이름, 걸린, 길이), flush=True)
            except Exception as e:
                print("  [%d/%d] %s — 🔴 실패: %s" % (i, len(줄들), 안전이름, type(e).__name__), flush=True)
        print("[완료] %d줄 / 폴더 %s" % (len(줄들), 폴더), flush=True)
        return

    if not a.글 or not a.출력:
        print("🔴 --글 과 --출력 이 필요하다(또는 --글목록).")
        return 2

    os.makedirs(os.path.dirname(os.path.abspath(a.출력)), exist_ok=True)
    if a.엔진 == "qwen":
        걸린, 길이, sr, _ = 굽기_qwen(a.글, a.언어, a.목소리, a.톤, a.출력, a.모델, None)
    else:
        걸린, 길이, sr, _ = 굽기_omnivoice(a.글, a.톤, a.출력, a.모델, None)

    print("[완료] 생성 %.1f초 / 소리 %.1f초 / %dHz" % (걸린, 길이, sr), flush=True)
    print("[파일] %s" % a.출력, flush=True)


if __name__ == "__main__":
    sys.exit(main())
