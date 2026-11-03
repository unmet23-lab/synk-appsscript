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
// 소리 384k — 기본 320k는 실제 317k라 영상사전검사 「검토」(올림 기준 스테레오 320k 이상). 소리가 고요한 편(매진 임박)은
// 렌더 뒤 다시 담으면 ffmpeg AAC가 305k까지만 써서, 섞은 소리(PCM)에서 바로 담는 이 값이 381k로 유일하게 넘는다(11-04)
Config.setAudioBitrate("384k");
Config.setX264Preset("slow");
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

Config.setChromiumOpenGlRenderer("angle");
