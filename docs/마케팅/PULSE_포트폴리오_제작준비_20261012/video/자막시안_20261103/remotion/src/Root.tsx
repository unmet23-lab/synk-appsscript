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
import { S3, S3_FRAMES } from './s3/S3';
import { S4, S4_FRAMES } from './s4/S4';
import { P6, P6_FRAMES } from './p6/P6';
import { S1, S1_FRAMES } from './s1/S1';
import { RS, RS_FRAMES } from './rs/RS';
import { RS60, RS60_FRAMES, RS30, RS30_FRAMES } from './rs/RS60';
import { P8, P8_FRAMES } from './p8/P8';

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
    {/* 시즌 3 블프 세일 「힘껏」(11-07) — 판 없는 끝(기본) · 원본 짜임 끝(견줄 판, -card) */}
    <Composition id="s3-15" component={S3} defaultProps={{ len: 15 as const }} durationInFrames={S3_FRAMES[15]} fps={24} width={1080} height={1920} />
    <Composition id="s3-15-card" component={S3} defaultProps={{ len: 15 as const, end: 'card' as const }} durationInFrames={S3_FRAMES[15]} fps={24} width={1080} height={1920} />
    <Composition id="s3-6" component={S3} defaultProps={{ len: 6 as const }} durationInFrames={S3_FRAMES[6]} fps={24} width={1080} height={1920} />
    <Composition id="s3-6-card" component={S3} defaultProps={{ len: 6 as const, end: 'card' as const }} durationInFrames={S3_FRAMES[6]} fps={24} width={1080} height={1920} />
    {/* 시즌 4 블프 스나이퍼 「느지막」(11-07) — 16:9 33.46초, 판 없는 끝(기본) · 콘티 끝 카드(견줄 판, -card) */}
    <Composition id="s4" component={S4} durationInFrames={S4_FRAMES} fps={24} width={1920} height={1080} />
    <Composition id="s4-card" component={S4} defaultProps={{ end: 'card' as const }} durationInFrames={S4_FRAMES} fps={24} width={1920} height={1080} />
    {/* 6번 연말 빈방(11-07) — 16:9 60초, 말자막 · 글판 · 끝 문구 · 그린 로고 「솜채」 */}
    <Composition id="p6" component={P6} durationInFrames={P6_FRAMES} fps={24} width={1920} height={1080} />
    {/* 시즌 1 옆집의 크리스마스(11-07) — 16:9 60.04초, 말자막 · 켜지는 끝 문구 · 그린 워드마크 「늘켬」 */}
    <Composition id="s1" component={S1} durationInFrames={S1_FRAMES} fps={24} width={1920} height={1080} />
    {/* 로맨스 단편 「다 비침」 274.83초 — romance-short-20261030/최종편집.py가 굽는다 */}
    <Composition id="rs" component={RS} durationInFrames={RS_FRAMES} fps={24} width={1920} height={1080} />
    {/* 로맨스 「다 비침」 짧은 판 약 45초(11-08) — 받아 둔 판만(크레딧 0), romance-short-20261030/짧은판.py가 굽는다 */}
    <Composition id="rs60" component={RS60} durationInFrames={RS60_FRAMES} fps={24} width={1920} height={1080} />
    {/* 로맨스 「다 비침」 30초 판(11-08 유호님 「30초 내외로」) — 같은 틀, romance-short-20261030/짧은판30.py가 굽는다 */}
    <Composition id="rs30" component={RS30} durationInFrames={RS30_FRAMES} fps={24} width={1920} height={1080} />
    {/* 8번 앱 소개 30초 캐스팅북(11-07 v4) — 16:9 30초, 글자 1 · 2 · 그린 제목 · 장면 안 끝(기본). 견줄 판: -card(10-26 흰 끝 화면) · -type(친 글자 제목) */}
    <Composition id="p8" component={P8} durationInFrames={P8_FRAMES} fps={24} width={1920} height={1080} />
    <Composition id="p8-card" component={P8} defaultProps={{ end: 'card' as const }} durationInFrames={P8_FRAMES} fps={24} width={1920} height={1080} />
    <Composition id="p8-type" component={P8} defaultProps={{ title: 'type' as const }} durationInFrames={P8_FRAMES} fps={24} width={1920} height={1080} />
  </>
);
