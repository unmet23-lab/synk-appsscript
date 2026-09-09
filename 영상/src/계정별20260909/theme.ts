import {Easing} from 'remotion';
import {색, 지면, 그늘, 빛} from '../킷/색';
import {본문스택, 한글체, 라틴체, 트래킹, 웨이트} from '../킷/폰트';

// Values come through the existing kit. These are video direction presets, not a second brand kit.
export const theme = {
  paper: 지면.바탕,
  ink: 지면.글자,
  muted: 지면.보조글자,
  caption: 지면.캡션글자,
  stitch: 지면.실땀,
  coral: 지면.신호글자,
  lapis: 색('Lapis Deep'),
  fonts: {body: 본문스택, korean: 한글체, latin: 라틴체},
  headingWeight: 웨이트.헤드,
  tracking: 트래킹.헤드_태그라인,
  shadow: 그늘,
  light: 빛,
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {damping: 26, stiffness: 140, mass: 0.8},
  safe: {left: 100, width: 820, top: 260, bottom: 1530},
} as const;
