/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

Config.setChromiumOpenGlRenderer("angle");

// 이 폴더는 경로가 길어(워크트리 + 한글 폴더) node_modules 안 크롬이 윈도 260자를 넘어 안 뜬다 — 짧은 자리에 둔 같은 판을 쓴다
Config.setBrowserExecutable(`${process.env.USERPROFILE}/Documents/synk-vendor/도구/remotion-chrome/chrome-headless-shell.exe`);
