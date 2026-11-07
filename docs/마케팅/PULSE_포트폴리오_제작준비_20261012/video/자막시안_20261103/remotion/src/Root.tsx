// 자막 · 모션그래픽 시안(2026-11-03) — 유호님 「자막이 촌스럽고 트렌디하지 못하고 맹한 느낌(슬롭)」. 같은 장면에 결이 다른 세 판을 얹어 고르게 한다.
//   11번 첨벙댕: A 사람 뒤 큰 글자 · B 색 블록 박자 · C 말풍선 · 쇼핑 카드 · AB(A 바탕에 B 두 방 — 제품 이름 · 끝 브랜드)
//   12번 모두의코스 전체: 앱 화면 결(장소 칩 · 만난 횟수 · 제목 접힘 · 끝 화면 코스 그리기)
//   11-03 밤 유호님 「세 편에 넣기」: 섞은 판(p11-AB) 결을 12번 · 매진 임박(hs16 · hs9)에도 — 이제 세 편 최종본이 여기서 나온다
import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { P11, P11_DOG_FRAMES, P11_FRAMES } from './p11/P11';
import { P11B, P11B_FRAMES } from './p11/B';
import { P12, P12_FRAMES } from './p12/P12';
import { HS16, HS9, HS_FRAMES } from './hs/HS';
import { P6, P6_FRAMES } from './p6/P6';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="p11-A" component={P11} defaultProps={{ look: 'A' as const }} durationInFrames={P11_FRAMES} fps={24} width={1080} height={1920} />
    <Composition id="p11-B" component={P11} defaultProps={{ look: 'B' as const }} durationInFrames={P11_FRAMES} fps={24} width={1080} height={1920} />
    <Composition id="p11-C" component={P11} defaultProps={{ look: 'C' as const }} durationInFrames={P11_FRAMES} fps={24} width={1080} height={1920} />
    <Composition id="p11-AB" component={P11} defaultProps={{ look: 'AB' as const }} durationInFrames={P11_FRAMES} fps={24} width={1080} height={1920} />
    {/* 앞 판 — 고글 쓴 개가 물에 뜨는 끝(11-04, 파일 첨벙댕_9x16_물판끝). p11-AB는 고르기 전 엄지 끝 */}
    <Composition id="p11-AB-dog" component={P11} defaultProps={{ look: 'AB' as const, dogEnd: true }} durationInFrames={P11_DOG_FRAMES} fps={24} width={1080} height={1920} />
    {/* 가림 검사용 — 큰 낱말만(../가림검사.py) */}
    <Composition id="p11-AB-probe" component={P11} defaultProps={{ look: 'AB' as const, probe: true }} durationInFrames={P11_FRAMES} fps={24} width={1080} height={1920} />
    {/* 첨벙댕 최종 — B급 바이럴 판(11-05 유호님 「이 판으로 바꿔」). 합성 이름 p11-B는 위의 옛 시안 몫이라 따로 둔다 */}
    <Composition id="p11-viral" component={P11B} durationInFrames={P11B_FRAMES} fps={24} width={1080} height={1920} />
    <Composition id="p12" component={P12} durationInFrames={P12_FRAMES} fps={24} width={1080} height={1920} />
    <Composition id="p12-probe" component={P12} defaultProps={{ probe: true }} durationInFrames={P12_FRAMES} fps={24} width={1080} height={1920} />
    <Composition id="p12-cg" component={P12} defaultProps={{ cg: true }} durationInFrames={P12_FRAMES} fps={24} width={1080} height={1920} />
    {/* 매진 임박 — 16:9 포트폴리오판 · 9:16 릴스 띠판(원본 1:1 구성), 가림 검사용 탐침 */}
    <Composition id="hs16" component={HS16} durationInFrames={HS_FRAMES} fps={24} width={1920} height={1080} />
    <Composition id="hs9" component={HS9} durationInFrames={HS_FRAMES} fps={24} width={1080} height={1920} />
    <Composition id="hs16-probe" component={HS16} defaultProps={{ probe: true }} durationInFrames={HS_FRAMES} fps={24} width={1920} height={1080} />
    {/* 6번 연말 빈방(11-07) — 16:9 60초, 말자막 · 글판 · 끝 문구 · 그린 로고 「솜채」 */}
    <Composition id="p6" component={P6} durationInFrames={P6_FRAMES} fps={24} width={1920} height={1080} />
  </>
);
