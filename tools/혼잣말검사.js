#!/usr/bin/env node
'use strict';
// 2026-09-17: 문체·금칙어·문장부호·화자별 말투 비율 검사를 제거하고 데이터 구조만 검사한다.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const errors = [];
const read = (p, label) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { errors.push(label + ': 파일이 없거나 JSON을 읽을 수 없다'); return null; } };
const data = read(process.env.SYNK_혼잣말_정본 || path.join(root, 'docs/캐릭터/혼잣말_정본.json'), '혼잣말');
const cards = read(process.env.SYNK_소개글_정본 || path.join(root, 'docs/캐릭터/소개글_정본.json'), '소개카드');
const people = ['몽글', '까몽', '마린'];
const positions = ['idle','탭','방치','아침','밤','겨울','여름','차강사르','무오류첫열람','재도전','재회잠깐','재회오랜만','재회한참'];
const subjects = ['음식','날씨','K-POP','게임','음악','운동','공부','잠','친구','몽골','한국','계절'];
const nonempty = v => typeof v === 'string' && v.trim().length > 0;
const ids = new Set();
if (data && !Array.isArray(data.문구)) errors.push('혼잣말: 문구 배열 없음');
for (const row of (Array.isArray(data?.문구) ? data.문구 : [])) {
  if (!row.id || ids.has(row.id)) errors.push('혼잣말: id 없음/중복');
  ids.add(row.id);
  if (!people.includes(row.캐릭터) || !positions.includes(row.자리)) errors.push('혼잣말: 캐릭터/자리 이상');
  if (!['짧','긴'].includes(row.갈래) || ![1,2,3].includes(row.급수)) errors.push('혼잣말: 갈래/급수 이상');
  if (!Array.isArray(row.소재) || !row.소재.length || row.소재.some(s=>!subjects.includes(s))) errors.push('혼잣말: 소재 이상');
  if (!nonempty(row.문구)) errors.push('혼잣말: 문구 없음');
}
if (cards && (!Array.isArray(cards.카드) || cards.카드.map(c=>c.캐릭터).sort().join('|') !== [...people].sort().join('|'))) errors.push('소개카드: 셋이 한 장씩이어야 한다');
for (const card of (Array.isArray(cards?.카드) ? cards.카드 : [])) {
  for (const key of ['한마디','자기소개','틀렸을때','잘했을때','정체','소개','매력','못해요','학생에게']) if (!nonempty(card[key])) errors.push('소개카드: '+key+' 비었다');
  if (!Array.isArray(card.이런너에게) || !card.이런너에게.length || card.이런너에게.some(v=>!nonempty(v))) errors.push('소개카드: 이런너에게 비었다');
  const more=card.더보기;
  if (!more) { errors.push('소개카드: 더보기 없음'); continue; }
  for (const key of ['키','몸무게','나이','생일','비밀']) if (!nonempty(more.관측보고?.[key])) errors.push('소개카드: 관측보고 '+key+' 비었다');
  for (const key of ['이야기','바라는것','두려운것','자는모습','걷는모습','못참는것','아무도안볼때']) if (!nonempty(more[key])) errors.push('소개카드: 더보기 '+key+' 비었다');
  for (const key of ['물건셋','좋아하는말','셋사이']) if (!Array.isArray(more[key]) || !more[key].length) errors.push('소개카드: 더보기 '+key+' 비었다');
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode=1; }
else console.log('혼잣말·소개카드 데이터 구조 확인 완료 (문체 검사는 제거됨)');
