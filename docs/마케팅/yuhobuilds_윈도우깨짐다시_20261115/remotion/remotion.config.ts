/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { execFileSync } from "node:child_process";

Config.setRspack(true);
// 올림 화질(제작 방식 v2 §2-4, 10-19): 손실 없는 PNG 프레임 → H.264 12Mbps(slow), yuv420p·BT.709.
// 유튜브 권장 1080p 30fps 8Mbps 이상. 10-18까지는 JPEG 프레임·CRF 18이라 3.2~3.6Mbps였다.
Config.setVideoImageFormat("png");
Config.setVideoBitrate("12M");
Config.setX264Preset("slow");
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
// 소리는 섞은 판(PCM)에서 바로 384k로 담는다. Remotion 기본값 320k로는 실측 317kbps가 나와 올리기 기준(짧은 변 1080 이상 · 스테레오 실측 320kbps — tools/lib/upload-audio-bitrate.cjs)에 못 미친다(현장 노트 영상 · 11-04).
// 한 편만 다른 값이 필요하면 이 파일을 고치지 말고 렌더 명령에 --audio-bitrate=<값>을 준다(명령줄이 이 줄보다 먼저다).
Config.setAudioBitrate("384k");
Config.setDefaultPremountInSeconds(2);

Config.setChromiumOpenGlRenderer("angle");

// GPU 압축(11-15): 이 PC의 NVIDIA 인코더(NVENC)로 압축한다. 시험 기록은 현장 노트 영상 「Remotion 렌더의 압축을 GPU로」에 있다.
// 같은 PNG 기준과 견준 화질(VMAF)은 x264 slow와 같았고, 렌더 한 편의 CPU는 45% 줄었다. 렌더 시간은 같았다.
// Remotion의 "if-possible"은 GPU가 있는지 보지 않고 NVENC를 고른다. 그래서 NVIDIA GPU가 보일 때만 켜고, 없으면 위의 x264 slow로 렌더한다.
// 올림 기준이 H.264 High라서 NVENC에 -profile:v high를 붙인다(Remotion의 NVENC 기본은 Main이다). SYNK_RENDER_CPU=1을 주면 GPU를 쓰지 않는다.
const nvidiaGpu = (() => {
  if (process.env.SYNK_RENDER_CPU === "1") return false;
  try {
    return /GPU \d+:/.test(execFileSync("nvidia-smi", ["-L"], { encoding: "utf8", timeout: 5000, windowsHide: true }));
  } catch {
    return false;
  }
})();
if (nvidiaGpu) {
  Config.setHardwareAcceleration("if-possible");
  Config.overrideFfmpegCommand(({ args }) => {
    const i = args.indexOf("h264_nvenc");
    if (i < 0 || args.includes("-profile:v")) return args;
    return [...args.slice(0, i + 1), "-profile:v", "high", ...args.slice(i + 1)];
  });
}
