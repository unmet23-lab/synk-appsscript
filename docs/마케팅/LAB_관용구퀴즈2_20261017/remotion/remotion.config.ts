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
Config.setDefaultPremountInSeconds(2);

Config.setChromiumOpenGlRenderer("angle");
