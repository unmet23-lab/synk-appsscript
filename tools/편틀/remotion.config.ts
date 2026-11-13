/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

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
