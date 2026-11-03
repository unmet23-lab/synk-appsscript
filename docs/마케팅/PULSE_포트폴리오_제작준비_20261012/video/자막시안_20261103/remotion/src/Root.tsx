// 자막 · 모션그래픽 시안(2026-11-03) — 유호님 「자막이 촌스럽고 트렌디하지 못하고 맹한 느낌(슬롭)」. 같은 장면에 결이 다른 세 판을 얹어 고르게 한다.
//   11번 첨벙댕: A 사람 뒤 큰 글자 · B 색 블록 박자 · C 말풍선 · 쇼핑 카드 · AB(A 바탕에 B 두 방 — 제품 이름 · 끝 브랜드)
//   12번 모두의코스 전체: 앱 화면 결(장소 칩 · 만난 횟수 · 제목 접힘 · 끝 화면 코스 그리기)
import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { P11, P11_FRAMES } from './p11/P11';
import { P12, P12_FRAMES } from './p12/P12';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="p11-A" component={P11} defaultProps={{ look: 'A' as const }} durationInFrames={P11_FRAMES} fps={24} width={1080} height={1920} />
    <Composition id="p11-B" component={P11} defaultProps={{ look: 'B' as const }} durationInFrames={P11_FRAMES} fps={24} width={1080} height={1920} />
    <Composition id="p11-C" component={P11} defaultProps={{ look: 'C' as const }} durationInFrames={P11_FRAMES} fps={24} width={1080} height={1920} />
    <Composition id="p11-AB" component={P11} defaultProps={{ look: 'AB' as const }} durationInFrames={P11_FRAMES} fps={24} width={1080} height={1920} />
    {/* 가림 검사용 — 큰 낱말만(../가림검사.py) */}
    <Composition id="p11-AB-probe" component={P11} defaultProps={{ look: 'AB' as const, probe: true }} durationInFrames={P11_FRAMES} fps={24} width={1080} height={1920} />
    <Composition id="p12" component={P12} durationInFrames={P12_FRAMES} fps={24} width={1080} height={1920} />
  </>
);
