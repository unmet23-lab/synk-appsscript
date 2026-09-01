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


def 굽기_qwen(글, 언어, 목소리, 톤, 출력, 모델):
    import torch, soundfile as sf
    from qwen_tts import Qwen3TTSModel

    장치 = "xpu" if (hasattr(torch, "xpu") and torch.xpu.is_available()) else "cpu"
    dtype = torch.float16 if 장치 == "xpu" else torch.float32
    print("[엔진] qwen / 장치 %s" % 장치, flush=True)

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
    return 걸린, len(wavs[0]) / float(sr), sr


def 굽기_omnivoice(글, 톤, 출력, 모델):
    import torch, soundfile as sf
    from omnivoice import OmniVoice

    장치 = "xpu" if (hasattr(torch, "xpu") and torch.xpu.is_available()) else "cpu"
    dtype = torch.float16 if 장치 == "xpu" else torch.float32
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
    return 걸린, len(audio[0]) / 24000.0, 24000


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--엔진", required=True, choices=["qwen", "omnivoice"])
    p.add_argument("--글", required=True)
    p.add_argument("--언어", default="Korean")
    p.add_argument("--목소리", default="Sohee")
    p.add_argument("--톤", default=None)
    p.add_argument("--출력", required=True)
    p.add_argument("--모델", required=True)
    a = p.parse_args()

    os.makedirs(os.path.dirname(os.path.abspath(a.출력)), exist_ok=True)

    if a.엔진 == "qwen":
        걸린, 길이, sr = 굽기_qwen(a.글, a.언어, a.목소리, a.톤, a.출력, a.모델)
    else:
        걸린, 길이, sr = 굽기_omnivoice(a.글, a.톤, a.출력, a.모델)

    print("[완료] 생성 %.1f초 / 소리 %.1f초 / %dHz" % (걸린, 길이, sr), flush=True)
    print("[파일] %s" % a.출력, flush=True)


if __name__ == "__main__":
    sys.exit(main())
