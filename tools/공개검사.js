#!/usr/bin/env node
'use strict';
/**
 * 공개검사 — 공개 저장소에 올라갈 변경에서 새로 더해진 줄과 커밋 메시지만 훑어, 올리면 안 되는 내용이 있으면 막는다.
 * tools/바로올리기.js·tools/내커밋.js가 저장 용량 검사 옆에서 부른다. 걸리면 그 도구는 아무것도 올리지 않고 파일·줄·이유를 보인다.
 *
 *   node tools/공개검사.js --바탕 <커밋> --머리 <커밋>        두 판 사이 더해진 줄과 그 사이 커밋 메시지
 *   node tools/공개검사.js --트리 <커밋>                     한 판의 모든 글 파일(전수 점검 — 「이미 공개」 허용 없이)
 *   node tools/공개검사.js 재생 --부터 <날짜> [--까지 <날짜>]   origin/master의 커밋마다 그 부모를 공개판으로 다시 돌려 오탐을 잰다
 *   공통: --저장소 <폴더> · --공개판 <커밋>(기본 refs/remotes/origin/master, 없으면 바탕) · --json
 *
 * 켜짐: 올릴 판이나 바탕에 tools/공개검사_허용.json이 있는 저장소에서만 돈다(공개 저장소 synk-appsscript). 없으면 건너뛴다.
 *
 * 변경 종류별 규칙(Antique식) — 대부분의 변경은 어느 규칙에도 닿지 않고 그대로 지나간다. 바이너리 내용은 읽지 않는다.
 *   글 파일의 더해진 줄
 *     주민번호    앞 여섯 자리가 날짜이고 뒤 첫 자리가 1~8인 「YYMMDD-NNNNNNN」(외국인등록번호 포함). 붙여 쓴 13자리는 보지 않는다
 *                (링크 속 글 번호·시각과 겹친다). 법인등록번호라고 적힌 줄은 뺀다.
 *     휴대폰      010·011·016~019(+82 10 …), 몽골 +976 휴대폰 대역(6·8·9로 시작). 유선·대표번호는 보지 않는다(재생에서 모두 기관 번호였다).
 *     개인메일    개인 메일 서비스(gmail·naver·daum·hotmail·mail.ru …)와 학교 도메인(.edu·.ac.kr·.hs.kr …)만 본다. 회사·서비스 도메인,
 *                역할 계정(support@ 등), 예시 도메인, 오픈소스 저작권·저자 줄은 보지 않는다.
 *     특허        특허청 명세서 칸 이름을 겹낫표 괄호로 쓴 꼴(청구항 번호·발명의 명칭·요약서 등), 대괄호 청구항 번호, 영문 명세서의 청구항 머리말.
 *     비공개표시  줄 전체가 대외비·사내 한정·CONFIDENTIAL 같은 표시이거나, 그 표시를 대괄호·겹낫표 괄호·소괄호에 넣은 꼴.
 *     명단표      csv·tsv 첫 줄이나 마크다운 표 줄에 이름 열과 연락처·생년월일·보호자 열이 함께 있다.
 *   커밋 메시지  주민번호·휴대폰·개인메일만(표지 규칙은 글 속 설명과 겹친다 — 재생에서 모두 설명이었다).
 *   파일이름     더하거나 고친 자료·문서 파일(xlsx·csv·hwp·pdf …)의 이름에 명단·연락처·상담 기록·출석부·성적표가 있거나, 문서 파일
 *                이름에 특허·명세서·청구항이 있다. 연락처 파일(.vcf)은 이름과 상관없이.
 * 허용 — 값을 적지 않는다(허용 목록이 그 값을 다시 공개하지 않게)
 *   예시 꼴     가운데나 끝 넷이 0000, 1234-5678처럼 이어진 숫자, 같은 숫자 되풀이, 두 자리씩 되풀이(9911 2233), 주민번호 뒤 1234567 등.
 *   번호가 아님  앞뒤가 식별자·주소 글자(-·=·/·_)인 숫자(클라우드 프로젝트 이름·링크 속 글 번호), 소수점 뒤 숫자, PDF·그림·글꼴처럼
 *               git이 글로 보더라도 바이너리인 파일의 내용.
 *   이미 공개   같은 파일의 바탕 판이나 공개판 트리에 이미 있는 값(대표 본인 계정처럼 공개 판단이 끝난 값). 메일의 +꼬리표는 떼고 견준다.
 *               10-17·10-20 점검이 파일에서 뺀 값은 공개판에 없으니 다시 넣으면 걸린다.
 *   줄 표식     그 줄에 「공개허용」과 까닭을 쓴다(공개 업무 연락처처럼 공개해도 되는 값).
 *   허용 목록   tools/공개검사_허용.json의 {경로(glob), 규칙[], 까닭} — 경로·규칙만 적는다.
 * 출력과 결과는 값을 가린다(앞 세 자·길이·끝 두 자리, 메일은 도메인만 그대로).
 *
 * 함정과 재생 기록: docs/현장노트/git_줄끝_잠금.md. 시험: node --test tests/바로올리기.test.js tests/내커밋.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');

const 정책경로 = 'tools/공개검사_허용.json';
const 표식 = '공개허용';
const 위치환경 = /^GIT_(DIR|WORK_TREE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE|PREFIX)$/;
const 규칙설명 = {
  주민번호: '주민등록번호 꼴',
  휴대폰: '휴대폰 번호',
  개인메일: '개인 메일 주소',
  특허: '특허 명세서 칸',
  비공개표시: '비공개 표시',
  명단표: '명단 꼴 표 머리(이름 열 + 연락처·생년월일·보호자 열)',
  파일이름: '명단·연락처·상담 기록·특허 이름의 자료·문서 파일',
};
const 값규칙 = new Set(['주민번호', '휴대폰', '개인메일']);
const 고치는법 = '실제 개인정보·학생 자료·미공개 특허면 그 줄(파일)을 빼고, 공개해도 되는 값(공개 업무 연락처·예시)이면 그 줄에 「공개허용」과 까닭을 쓰거나 '
  + `${정책경로}에 경로·규칙·까닭을 더한다(값은 적지 않는다). 판단이 서지 않으면 유호님께 묻는다`;

// ── 규칙 ────────────────────────────────────────────────────────────────────

const 주민꼴 = /(?<![0-9A-Za-z_])([0-9]{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01]))\s?[-–]\s?([1-8][0-9]{6})(?![0-9A-Za-z_])/g;
const 법인번호줄 = /법인\s*(?:등록)?\s*번호/;
/** 앞뒤가 식별자·주소 글자(-·=·/·_ 등)면 번호가 아니다 — HEAD 전수 점검에서 구글 클라우드 프로젝트 이름·링크 속 글 번호·달력 자료 표가 걸렸다. */
const 한국폰꼴 = /(?<![0-9A-Za-z_=/#?&-])(?<![0-9]\.)(?:\+82[-.\s]?(?:\(0\)[-.\s]?)?|0)1[016789][-.\s]?[0-9]{3,4}[-.\s]?[0-9]{4}(?![0-9A-Za-z_=/]|-[0-9A-Za-z])/g;
const 몽골폰꼴 = /(?<![0-9A-Za-z_=/#?&-])\(?\+976\)?[-.\s]?[689][0-9]{3}[-.\s]?[0-9]{4}(?![0-9A-Za-z_=/]|-[0-9A-Za-z])/g;
const 이어진숫자 = new Set(['12345678', '1234567', '23456789', '87654321', '98765432', '56781234', '12341234', '56785678']);

const 개인메일도메인 = new Set([
  'gmail.com', 'googlemail.com', 'naver.com', 'daum.net', 'hanmail.net', 'kakao.com', 'nate.com', 'empas.com', 'paran.com',
  'dreamwiz.com', 'chol.com', 'hitel.net', 'korea.com', 'freechal.com', 'lycos.co.kr', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'msn.com', 'ymail.com', 'rocketmail.com', 'mail.ru', 'inbox.ru', 'list.ru', 'bk.ru', 'internet.ru', 'rambler.ru', 'ya.ru',
  'yandex.ru', 'yandex.com', 'proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me', 'tutanota.com', 'tuta.io', 'gmx.com',
  'gmx.net', 'gmx.de', 'web.de', 'qq.com', '163.com', '126.com', 'sina.com', 'foxmail.com', 'zoho.com', 'fastmail.com', 'mail.com',
  'hey.com',
]);
const 개인메일무늬 = /^(?:yahoo|hotmail|outlook|live)\.[a-z]{2,3}(?:\.[a-z]{2})?$/;
const 학교도메인 = /\.(?:edu|ac|sch|k12)\.[a-z]{2}$|\.(?:hs|ms|es|sc|kg)\.kr$|\.edu$/;
/** git이 글로 보더라도 내용을 읽지 않는 파일(PDF를 글로 읽어 깨진 바이트가 메일처럼 걸렸다). 파일이름 규칙은 그대로 본다. */
const 읽지않을파일 = /\.(?:pdf|png|jpe?g|gif|webp|avif|ico|bmp|tiff?|psd|ai|eps|mp3|mp4|m4a|wav|ogg|webm|mov|zip|gz|7z|rar|woff2?|ttf|otf|eot|glb|bin|exe|dll|so|dylib|wasm|hwp|hwpx|docx|xlsx|pptx|sqlite|db)$/i;
const 역할계정 = /^(?:info|contact|support|help|helpdesk|hello|admin|administrator|office|service|services|sales|team|press|media|pr|marketing|privacy|security|abuse|postmaster|webmaster|hostmaster|no-?reply|do-?not-?reply|notifications?|newsletter|news|billing|accounts?|careers|jobs|recruit(?:ing|ment)?|hr|legal|partners?|partnership|feedback|admissions?|registrar|international|cs|customer(?:service|care)?|enquir(?:y|ies)|inquir(?:y|ies)|ask|ops)$/i;
const 저작자줄 = /copyright|©|\(c\)\s*[0-9]{4}|@author\b|\bauthors?\s*[:=]|\bmaintainers?\b|\bcontributors?\b|"author"\s*:/i;

const 특허칸 = /【\s*(?:청구항\s*[0-9]*|청구\s*범위|발명의\s*명칭|요약서?|발명의\s*설명|기술\s*분야|배경\s*기술|선행\s*기술\s*문헌|해결하려는\s*과제|과제의\s*해결\s*수단|발명의\s*효과|도면의\s*간단한\s*설명|발명을\s*실시하기\s*위한\s*구체적인\s*내용|부호의\s*설명|대표도)\s*】|\[\s*청구항\s*[0-9]+\s*\]|\bWhat is claimed is\b/;
const 비공개말 = '대외비|사내\\s*한정|외부\\s*(?:공개|유출)\\s*금지|CONFIDENTIAL|INTERNAL\\s+(?:USE\\s+)?ONLY|DO\\s+NOT\\s+DISTRIBUTE';
const 비공개줄 = new RegExp(`^[\\s>#*_~|\\-–—]*(?:[\\[【(]\\s*)?(?:${비공개말})(?:\\s*[\\]】)])?[\\s*_~|:.\\-–—]*$`, 'i');
const 비공개괄호 = new RegExp(`[\\[【(]\\s*(?:${비공개말})\\s*[\\]】)]`, 'i');

const 이름칸 = /^(?:(?:학생|수강생|원생|참가자|신청자|지원자|보호자|학부모)\s*(?:이름|명)|이름|성명|성함|학생|수강생|원생|name|full name|first name|last name|student(?: name)?|нэр|овог(?: нэр)?)$/i;
const 신원칸 = /^(?:연락처|(?:휴대\s*)?전화(?:\s*번호)?|휴대폰(?:\s*번호)?|핸드폰(?:\s*번호)?|phone(?: (?:number|no\.?))?|mobile(?: (?:number|phone))?|tel\.?|cell(?: ?phone)?|생년월일|birth ?date|date of birth|dob|주민(?:등록)?\s*번호|외국인\s*등록\s*번호|(?:보호자|학부모|부모)\s*(?:연락처|전화(?:\s*번호)?|휴대폰)|parent(?:'?s)? (?:phone|contact)|guardian(?: (?:phone|contact))?|утас(?:ны дугаар)?|төрсөн огноо)$/i;

/** 영어 낱말은 넣지 않는다 — 재생에서 그림 묶음 「contact sheet」 프롬프트 파일이 걸렸다. 연락처 파일은 .vcf로 따로 본다. */
const 명단파일 = /(?:명단|연락처|출석부|성적표|(?:학생|원생|수강생)\s*정보|상담\s*(?:기록|일지|내역))/;
const 자료확장자 = /\.(?:xlsx|xlsm|xls|csv|tsv|numbers|ods|hwp|hwpx|docx?|pdf|txt)$/i;
const 특허파일 = /(?:특허|명세서|청구항|patent)/i;
const 문서확장자 = /\.(?:hwp|hwpx|docx?|pdf|pptx?|rtf|odt)$/i;

/** 메일 자리를 '@'에서 양쪽으로 넓혀 찾는다(정규식 되짚기로 긴 줄이 멈추지 않게). */
function 메일들(줄) {
  const 결과 = [];
  const 로컬글자 = (c) => /[A-Za-z0-9._%+-]/.test(c);
  const 도메인글자 = (c) => /[A-Za-z0-9.-]/.test(c);
  for (let i = 줄.indexOf('@'); i !== -1; i = 줄.indexOf('@', i + 1)) {
    let a = i;
    while (a > 0 && i - a < 64 && 로컬글자(줄[a - 1])) a--;
    let b = i + 1;
    while (b < 줄.length && b - i <= 253 && 도메인글자(줄[b])) b++;
    const 로컬 = 줄.slice(a, i).replace(/^\.+/, '');
    const 도메인 = 줄.slice(i + 1, b).replace(/[.-]+$/, '').toLowerCase();
    if (!로컬 || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(도메인)) continue;
    결과.push({ 값: `${로컬}@${도메인}`, 로컬, 도메인 });
  }
  return 결과;
}

function 개인메일인가(로컬, 도메인) {
  if (역할계정.test(로컬.replace(/\+.*$/, ''))) return false;
  return 개인메일도메인.has(도메인) || 개인메일무늬.test(도메인) || 학교도메인.test(도메인);
}

/** 견줄 꼴: 휴대폰은 국내 숫자(+82 → 0…), 몽골은 976+8자리, 주민번호는 13자리, 메일은 소문자·+꼬리표 뗌 */
function 정규(규칙, 값) {
  if (규칙 === '개인메일') {
    const [로컬, 도메인] = 값.toLowerCase().split('@');
    return `${로컬.replace(/\+.*$/, '')}@${도메인}`;
  }
  let d = 값.replace(/[^0-9]/g, '');
  if (규칙 === '휴대폰' && /^\(?\+82/.test(값.trim())) d = `0${d.slice(2).replace(/^0/, '')}`;
  return d;
}

function 예시값(규칙, d) {
  if (규칙 === '주민번호') {
    const 뒤 = d.slice(6);
    return /^[1-8](?:234567|000000|111111)$/.test(뒤) || /^([0-9])\1{6}$/.test(뒤);
  }
  if (규칙 !== '휴대폰') return false;
  const 나머지 = d.slice(3);       // 010·011…·976 뒤
  const 끝 = 나머지.slice(-4), 가운데 = 나머지.slice(0, -4);
  return /^0+$/.test(가운데) || /^0+$/.test(끝) || 이어진숫자.has(가운데 + 끝)
    || (/^([0-9])\1*$/.test(가운데) && /^([0-9])\1*$/.test(끝))
    || /^([0-9])\1([0-9])\2([0-9])\3([0-9])\4$/.test(나머지);   // 9911 2233처럼 두 자리씩 되풀이(몽골 번호 예시 꼴)
}

/** 한 줄의 값 규칙 후보 → [{규칙, 값, 정규}] (예시 꼴·역할 계정·저작자 줄은 뺀다) */
function 값찾기(줄, 셈) {
  const 결과 = [];
  if (/[0-9]/.test(줄)) {
    if (!법인번호줄.test(줄) || /주민/.test(줄)) {
      for (const m of 줄.matchAll(주민꼴)) {
        const d = 정규('주민번호', m[0]);
        if (예시값('주민번호', d)) { if (셈) 셈.예시++; continue; }
        결과.push({ 규칙: '주민번호', 값: m[0], 정규: d });
      }
    }
    for (const 꼴 of [한국폰꼴, 몽골폰꼴]) {
      for (const m of 줄.matchAll(꼴)) {
        const d = 정규('휴대폰', m[0]);
        if (예시값('휴대폰', d)) { if (셈) 셈.예시++; continue; }
        결과.push({ 규칙: '휴대폰', 값: m[0], 정규: d });
      }
    }
  }
  if (줄.includes('@') && !저작자줄.test(줄)) {
    for (const x of 메일들(줄)) {
      if (!개인메일인가(x.로컬, x.도메인)) continue;
      결과.push({ 규칙: '개인메일', 값: x.값, 정규: 정규('개인메일', x.값) });
    }
  }
  return 결과;
}

function 칸나누기(줄, 경로, 번호) {
  const t = 줄.replace(/^\uFEFF/, '').trim();
  if (/^\|.*\|/.test(t)) return t.replace(/^\|/, '').replace(/\|\s*$/, '').split('|');
  if (번호 !== 1) return null;
  if (/\.(?:tsv|tab)$/i.test(경로)) return t.split('\t');
  if (/\.csv$/i.test(경로)) {
    const 칸 = [];
    let 지금 = '', 따옴 = false;
    for (const ch of t) {
      if (ch === '"') 따옴 = !따옴;
      else if (ch === ',' && !따옴) { 칸.push(지금); 지금 = ''; }
      else 지금 += ch;
    }
    칸.push(지금);
    return 칸;
  }
  return null;
}

/** 한 줄의 표지 규칙 후보 → [{규칙, 값}] */
function 표지찾기(줄, 경로, 번호) {
  const 결과 = [];
  if (/[【\[]|claimed/.test(줄)) {
    const m = 특허칸.exec(줄);
    if (m) 결과.push({ 규칙: '특허', 값: m[0].slice(0, 40) });
  }
  if (/대외비|한정|금지|confidential|internal|distribute/i.test(줄) && (비공개줄.test(줄) || 비공개괄호.test(줄))) {
    결과.push({ 규칙: '비공개표시', 값: 줄.trim().slice(0, 40) });
  }
  if (/\.(?:md|markdown|csv|tsv|tab)$/i.test(경로) && (줄.includes('|') || 번호 === 1)) {
    const 칸 = 칸나누기(줄, 경로, 번호);
    if (칸 && 칸.length >= 2) {
      const 다듬 = 칸.map((x) => x.replace(/[*`"']/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim());
      const 이름 = 다듬.find((x) => 이름칸.test(x)), 신원 = 다듬.find((x) => 신원칸.test(x));
      if (이름 && 신원) 결과.push({ 규칙: '명단표', 값: `${이름} · ${신원}` });
    }
  }
  return 결과;
}

function 파일이름규칙(경로) {
  const 이름 = 경로.split('/').pop();
  if (/\.vcf$/i.test(이름)) return '연락처 파일(.vcf)';
  if (자료확장자.test(이름) && 명단파일.test(이름)) return 이름;
  if (문서확장자.test(이름) && 특허파일.test(이름)) return 이름;
  return null;
}

/** 값을 가린다: 앞 세 자 · 길이 · 끝 두 자리(메일은 로컬 앞 세 자와 도메인) */
function 가림(규칙, 값) {
  if (!값규칙.has(규칙)) return 값;
  if (규칙 === '개인메일') {
    const [로컬, 도메인] = 값.split('@');
    return `${로컬.slice(0, 3)}…(${로컬.length}자)@${도메인}`;
  }
  const d = 값.replace(/[^0-9]/g, '');
  return `${값.trim().slice(0, 3)}…(${값.length}자, 끝 ${d.slice(-2)})`;
}

// ── 정책(허용 목록) ─────────────────────────────────────────────────────────

function glob정규식(무늬) {
  let s = '';
  for (let i = 0; i < 무늬.length; i++) {
    const ch = 무늬[i];
    if (ch === '*' && 무늬[i + 1] === '*') {
      i++;
      if (무늬[i + 1] === '/') { i++; s += '(?:.*/)?'; } else s += '.*';
    } else if (ch === '*') s += '[^/]*';
    else if (ch === '?') s += '[^/]';
    else s += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${s}$`);
}

function 정책풀기(글, 출처) {
  let v;
  try { v = JSON.parse(글); } catch (_) { throw new Error(`${출처}가 JSON이 아니다`); }
  const 틀림 = (이유) => new Error(`${출처}: ${이유}`);
  if (!v || typeof v !== 'object' || Array.isArray(v) || v.판 !== 1 || !Array.isArray(v.허용)) throw 틀림('판 1과 허용 목록이 있어야 한다');
  if (Object.keys(v).some((k) => !['판', '설명', '허용'].includes(k))) throw 틀림('모르는 칸이 있다');
  const 허용 = v.허용.map((x, i) => {
    const 자리 = `허용 ${i + 1}번째`;
    if (!x || typeof x !== 'object' || Object.keys(x).sort().join(',') !== '경로,규칙,까닭') throw 틀림(`${자리}는 경로·규칙·까닭만 둔다`);
    if (typeof x.까닭 !== 'string' || x.까닭.trim().length < 5) throw 틀림(`${자리}: 까닭을 다섯 자 넘게 쓴다`);
    if (!Array.isArray(x.규칙) || !x.규칙.length || x.규칙.some((r) => !(r in 규칙설명))) throw 틀림(`${자리}: 규칙은 ${Object.keys(규칙설명).join('·')} 가운데서 고른다`);
    const 칸 = typeof x.경로 === 'string' ? x.경로.split('/') : [];
    if (!칸.length || x.경로.startsWith('/') || 칸.some((s) => !s || s === '.' || s === '..') || !칸.some((s) => !/[*?[\]{}]/.test(s))) {
      throw 틀림(`${자리}: 경로는 저장소 기준 glob이고 글자 그대로의 폴더·파일 이름이 하나는 있어야 한다`);
    }
    return { 경로: x.경로, 규칙: new Set(x.규칙), 까닭: x.까닭, 맞춤: glob정규식(x.경로) };
  });
  return { 출처, 허용 };
}

// ── git ─────────────────────────────────────────────────────────────────────

function 기본환경() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!위치환경.test(k) && k !== 'GIT_INDEX_FILE') env[k] = v;
  return env;
}

function git도구(저장소, env) {
  const 바탕env = { ...env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' };
  const 앞 = ['-c', 'core.quotepath=false', '--no-pager'];
  function 돌리기(args, { input, 허용 = [0] } = {}) {
    const r = spawnSync('git', [...앞, ...args], { cwd: 저장소, env: 바탕env, input, maxBuffer: 1024 * 1024 * 1024, windowsHide: true });
    if (r.error) throw r.error;
    if (허용 && !허용.includes(r.status)) throw new Error(`git ${args[0]} 실패(${r.status}): ${String(r.stderr || '').trim().slice(0, 300)}`);
    return r;
  }
  const git = (args, o) => 돌리기(args, o).stdout;
  git.글 = (args, o) => git(args, o).toString('utf8').trim();
  git.돌리기 = 돌리기;
  /** 줄마다 받는다(큰 출력도 메모리에 다 올리지 않는다). 줄을 다 읽고 git이 끝난 뒤에 풀리고, 받다가 난 오류는 거절로 넘긴다. */
  git.줄마다 = (args, 받기) => new Promise((풀림, 거절) => {
    const ch = spawn('git', [...앞, ...args], { cwd: 저장소, env: 바탕env, windowsHide: true });
    let 오류 = '', 코드 = null, 줄끝 = false, 받다난 = null;
    const 끝 = () => {
      if (코드 === null || !줄끝) return;
      if (받다난) 거절(받다난);
      else if (코드 === 0) 풀림();
      else 거절(new Error(`git ${args.find((a) => !a.startsWith('-'))} 실패(${코드}): ${오류.trim().slice(0, 300)}`));
    };
    ch.stderr.on('data', (b) => { 오류 = (오류 + b).slice(-2000); });
    ch.on('error', 거절);
    const rl = readline.createInterface({ input: ch.stdout, crlfDelay: Infinity });
    rl.on('line', (줄) => {
      if (받다난) return;
      try { 받기(줄); } catch (e) { 받다난 = e; ch.kill(); }
    });
    rl.on('close', () => { 줄끝 = true; 끝(); });
    ch.on('close', (code) => { 코드 = code === null ? -1 : code; 끝(); });
  });
  return git;
}

function 있는판(git, 판) {
  const r = git.돌리기(['rev-parse', '--verify', '-q', `${판}^{tree}`], { 허용: null });
  return r.status === 0 ? String(r.stdout).trim() : null;
}

/** 판(커밋·트리, 없으면 지금 인덱스)의 파일 하나 → 버퍼 | null */
function 판파일(git, 판, 경로) {
  const 줄 = (판 ? git(['--literal-pathspecs', 'ls-tree', '-z', 판, '--', 경로]) : git(['--literal-pathspecs', 'ls-files', '-s', '-z', '--', 경로])).toString('utf8');
  const 항 = 줄.split('\0').filter(Boolean);
  if (!항.length) return null;
  const 머리칸 = 항[0].split('\t')[0].split(' ');
  const sha = 판 ? 머리칸[2] : 머리칸[1];
  if (판 && 머리칸[1] !== 'blob') return null;
  return git(['cat-file', 'blob', sha]);
}

function 정책찾기(git, 머리, 바탕) {
  for (const [판, 이름] of [[머리, 머리 ? `${머리.slice(0, 9)}:` : '인덱스:'], [바탕, `${(바탕 || '').slice(0, 9)}:`]]) {
    if (판 === undefined) continue;
    const 바이트 = 판파일(git, 판, 정책경로);
    if (바이트) return 정책풀기(바이트.toString('utf8'), `${이름}${정책경로}`);
  }
  return null;
}

function 경로풀기(글) {
  if (!글.startsWith('"')) return 글;
  const 바이트 = [];
  const 바꿈 = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 };
  for (let i = 1; i < 글.length - 1; i++) {
    const ch = 글[i];
    if (ch !== '\\') { 바이트.push(...Buffer.from(ch, 'utf8')); continue; }
    const 다음 = 글[++i];
    if (/[0-7]/.test(다음)) { 바이트.push(parseInt(글.slice(i, i + 3), 8)); i += 2; } else 바이트.push(바꿈[다음] ?? 다음.charCodeAt(0));
  }
  return Buffer.from(바이트).toString('utf8');
}

/** git diff -U0을 줄마다 읽어 파일·더한 줄을 넘긴다. 더한 줄 수를 세어 덩어리 안 「+++」·「diff --git」 글을 머리로 잘못 읽지 않는다. */
async function 차이훑기(git, 인자, { 파일: 파일받기, 줄: 줄받기 }) {
  let 파일 = null, 남은더함 = 0, 남은뺌 = 0, 번호 = 0;
  const 닫기 = () => { if (파일) 파일받기(파일); 파일 = null; };
  await git.줄마다(['diff', '-U0', '--no-color', '--no-ext-diff', '--no-textconv', '--no-renames', '--no-relative',
    '--src-prefix=a/', '--dst-prefix=b/', '--ignore-submodules=all', ...인자], (줄) => {
    if (남은더함 > 0 || 남은뺌 > 0) {
      if (줄.startsWith('+')) { 남은더함--; 줄받기(파일, 번호++, 줄.slice(1).replace(/\r$/, '')); return; }
      if (줄.startsWith('-')) { 남은뺌--; return; }
      if (줄.startsWith('\\')) return;
      남은더함 = 남은뺌 = 0;
    }
    if (줄.startsWith('diff --git ')) {
      닫기();
      const 나머지 = 줄.slice('diff --git '.length);
      let 경로 = '';
      if (나머지.startsWith('"')) { const 끝 = 나머지.indexOf('" "'); 경로 = 경로풀기(나머지.slice(0, 끝 + 1)).slice(2); } else 경로 = 나머지.slice(2, 2 + (나머지.length - 5) / 2);
      파일 = { 경로, 이진: false, 지움: false, 새: false };
      return;
    }
    if (!파일) return;
    if (줄.startsWith('new file mode')) 파일.새 = true;
    else if (줄.startsWith('deleted file mode')) 파일.지움 = true;
    else if (줄.startsWith('+++ ')) { const p = 줄.slice(4); if (p !== '/dev/null') 파일.경로 = 경로풀기(p).replace(/^b\//, ''); }
    else if (줄.startsWith('Binary files ')) 파일.이진 = true;
    else if (줄.startsWith('@@ ')) {
      const m = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(줄);
      if (!m) return;
      남은뺌 = m[1] === undefined ? 1 : Number(m[1]);
      번호 = Number(m[2]);
      남은더함 = m[3] === undefined ? 1 : Number(m[3]);
    }
  });
  닫기();
}

/** 줄에 있는 모든 값 꼴(예시·역할 계정·저작자 줄도 거르지 않는다) → 정규 꼴. 「이미 공개」를 넓게 보려고 쓴다. */
function 값모두(줄) {
  const 결과 = [];
  if (/[0-9]/.test(줄)) {
    for (const m of 줄.matchAll(주민꼴)) 결과.push(정규('주민번호', m[0]));
    for (const 꼴 of [한국폰꼴, 몽골폰꼴]) for (const m of 줄.matchAll(꼴)) 결과.push(정규('휴대폰', m[0]));
  }
  if (줄.includes('@')) for (const x of 메일들(줄)) 결과.push(정규('개인메일', x.값));
  return 결과;
}

/**
 * 공개판 트리에 이미 있는 값(정규 꼴). 값의 흔한 꼴을 글자 그대로(git grep -F) 한 번에 찾고, 찾은 줄을 같은 규칙으로 다시 읽어 견준다
 * — PCRE 없는 git에서도 돌고, 검사와 같은 경계로만 「있다」고 본다.
 */
function 공개판에서(git, 공개판, 후보들) {
  const 무늬 = new Set();
  for (const { 규칙, 정규: d } of 후보들) {
    if (규칙 === '개인메일') { 무늬.add(d); 무늬.add(`${d.split('@')[0]}+`); }
    else if (규칙 === '주민번호') for (const 사이 of ['-', ' -', '- ', ' - ', '–']) 무늬.add(`${d.slice(0, 6)}${사이}${d.slice(6)}`);
    else {
      const 나머지 = d.slice(3), 끝 = 나머지.slice(-4), 가운데 = 나머지.slice(0, -4);
      for (const 사이 of ['-', ' ', '.']) 무늬.add(`${가운데}${사이}${끝}`);
      무늬.add(d.startsWith('976') ? 나머지 : d.slice(1));     // 붙여 쓴 꼴(+82·0 앞머리와 상관없이)
    }
  }
  무늬.delete('');
  if (!무늬.size) return new Set();
  const 임시 = path.join(os.tmpdir(), `synk-public-check-${process.pid}-${crypto.randomBytes(4).toString('hex')}.txt`);
  try {
    fs.writeFileSync(임시, `${[...무늬].join('\n')}\n`);
    const r = git.돌리기(['grep', '-I', '-h', '-i', '-F', '--no-color', '-f', 임시, 공개판, '--'], { 허용: [0, 1] });
    const 찾음 = new Set();
    for (const 줄 of String(r.stdout).split('\n')) for (const v of 값모두(줄)) 찾음.add(v);
    return 찾음;
  } finally {
    fs.rmSync(임시, { force: true });
  }
}

// ── 검사 ────────────────────────────────────────────────────────────────────

/**
 * 옵션: 저장소 · env(GIT_INDEX_FILE이 있으면 그 인덱스) · 바탕(커밋·트리) · 머리(커밋·트리 — 없으면 인덱스를 바탕과 견준다)
 *   · 공개판(이미 공개된 값을 찾는 판 — 기본 refs/remotes/origin/master, 없으면 바탕) · 메시지들(더 훑을 커밋 메시지 글)
 *   · 범위메시지(기본 true — 머리가 있으면 바탕..머리 커밋 메시지도 훑는다) · 이미공개(기본 true — false면 「이미 공개」 허용 없이, 전수 점검용)
 *   · 정책글(재생·전수 점검용 — 판에 정책이 없는 옛 커밋에 지금 정책을 쓴다)
 * → { 켜짐, 정책, 공개판, 훑은: {파일, 줄, 메시지}, 걸림: [{경로, 줄, 규칙, 설명, 값}], 허용: {예시, 이미공개, 표식, 목록} }
 */
async function 범위검사(옵션 = {}) {
  const 저장소 = 옵션.저장소 || process.cwd();
  const git = git도구(저장소, 옵션.env || 기본환경());
  const 바탕 = 옵션.바탕, 머리 = 옵션.머리 || null;
  if (!바탕) throw new Error('공개 검사에 바탕 판이 없다');
  const 정책 = 옵션.정책글 != null ? 정책풀기(옵션.정책글, 옵션.정책출처 || '주어진 정책') : 정책찾기(git, 머리, 바탕);
  if (!정책) return { 켜짐: false };
  const 이미공개 = 옵션.이미공개 !== false;
  const 공개판 = 옵션.공개판 || 있는판(git, 'refs/remotes/origin/master') && 'refs/remotes/origin/master' || 바탕;
  const 허용 = { 예시: 0, 이미공개: 0, 표식: 0, 목록: 0 };
  const 훑은 = { 파일: 0, 줄: 0, 메시지: 0 };
  const 후보 = [];
  const 목록맞춤 = new Map();
  const 허용규칙 = (경로) => {
    if (!목록맞춤.has(경로)) {
      const 규칙 = new Set();
      for (const x of 정책.허용) if (x.맞춤.test(경로)) for (const r of x.규칙) 규칙.add(r);
      목록맞춤.set(경로, 규칙);
    }
    return 목록맞춤.get(경로);
  };
  const 넣기 = (곳, x) => {
    if (허용규칙(곳.경로).has(x.규칙)) { 허용.목록++; return; }
    if (곳.표식) { 허용.표식++; return; }
    후보.push({ ...x, 경로: 곳.경로, 줄: 곳.줄, 글: 곳.글, 메시지: 곳.메시지 || false });
  };
  const 파일들 = [];
  await 차이훑기(git, 머리 ? [바탕, 머리] : ['--cached', 바탕], {
    파일: (f) => { 파일들.push(f); if (!f.지움) 훑은.파일++; },
    줄: (f, 번호, 글) => {
      if (읽지않을파일.test(f.경로)) return;
      훑은.줄++;
      const 곳 = { 경로: f.경로, 줄: 번호, 글, 표식: 글.includes(표식) };
      for (const x of 값찾기(글, 허용)) 넣기(곳, x);
      for (const x of 표지찾기(글, f.경로, 번호)) 넣기(곳, x);
    },
  });
  for (const f of 파일들) {
    if (f.지움) continue;
    const 이름 = 파일이름규칙(f.경로);
    if (이름) 넣기({ 경로: f.경로, 줄: null, 글: null }, { 규칙: '파일이름', 값: 이름 });
  }
  const 메시지들 = (옵션.메시지들 || []).filter(Boolean).map((글) => ({ 이름: '커밋 메시지', 글 }));
  if (머리 && 옵션.범위메시지 !== false) {
    const 칸 = git(['log', '--format=%H%x00%B%x00', `${바탕}..${머리}`]).toString('utf8').split('\0');
    for (let i = 0; i + 1 < 칸.length; i += 2) 메시지들.push({ 이름: `커밋 메시지 ${칸[i].trim().slice(0, 9)}`, 글: 칸[i + 1] });
  }
  for (const m of 메시지들) {
    훑은.메시지++;
    m.글.split('\n').forEach((글, i) => {
      const 곳 = { 경로: m.이름, 줄: i + 1, 글, 표식: 글.includes(표식), 메시지: true };
      for (const x of 값찾기(글, 허용)) 넣기(곳, x);
    });
  }

  // 이미 공개된 값·줄: 같은 파일의 바탕 판 → 공개판 트리
  let 남은 = 후보;
  if (이미공개 && 남은.length) {
    const 바탕판 = new Map();
    const 바탕글 = (경로) => {
      if (!바탕판.has(경로)) {
        let 글 = null;
        try { const b = 판파일(git, 바탕, 경로); if (b && !b.includes(0)) 글 = b.toString('utf8'); } catch (_) {}
        바탕판.set(경로, 글 === null ? null : { 글, 값: new Set(글.split('\n').flatMap(값모두)), 줄: new Set(글.split('\n').map((l) => l.replace(/\r$/, '').trim())) });
      }
      return 바탕판.get(경로);
    };
    남은 = 남은.filter((x) => {
      if (x.메시지 || x.규칙 === '파일이름') return true;
      const 판 = 바탕글(x.경로);
      const 있음 = 판 && (값규칙.has(x.규칙) ? 판.값.has(x.정규) : 판.줄.has(String(x.글).trim()));
      if (있음) 허용.이미공개++;
      return !있음;
    });
    const 값남은 = 남은.filter((x) => 값규칙.has(x.규칙));
    if (값남은.length) {
      const 찾음 = 공개판에서(git, 공개판, 값남은);
      남은 = 남은.filter((x) => {
        const 있음 = 값규칙.has(x.규칙) && 찾음.has(x.정규);
        if (있음) 허용.이미공개++;
        return !있음;
      });
    }
  }
  const 걸림 = 남은.map((x) => ({ 경로: x.경로, 줄: x.줄, 규칙: x.규칙, 설명: 규칙설명[x.규칙], 값: 가림(x.규칙, x.값) }));
  return { 켜짐: true, 정책: 정책.출처, 공개판, 훑은, 걸림, 허용 };
}

/** 걸림 하나를 사람이 읽는 줄로 */
function 걸림글(x) {
  return `${x.경로}${x.줄 ? `:${x.줄}` : ''} — ${x.설명}${x.값 ? ` ${x.값}` : ''}`;
}

/** 도구 출력에 붙이는 한 줄 요약 */
function 요약글(r) {
  if (!r || !r.켜짐) return null;
  const 허 = Object.entries(r.허용).filter(([, n]) => n).map(([k, n]) => `${{ 예시: '예시 꼴', 이미공개: '이미 공개', 표식: '줄 표식', 목록: '허용 목록' }[k]} ${n}`);
  const 앞 = r.걸림.length ? `공개 검사 걸림 ${r.걸림.length}곳` : '공개 검사 통과';
  return `${앞} — 더한 줄 ${r.훑은.줄}줄 · 파일 ${r.훑은.파일}개 · 커밋 메시지 ${r.훑은.메시지}개${허.length ? ` · 허용 ${허.join(', ')}` : ''}`;
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

const 사용법 = `사용법
  node tools/공개검사.js --바탕 <커밋> --머리 <커밋> [--공개판 <커밋>] [--json]
  node tools/공개검사.js --트리 <커밋> [--json]
  node tools/공개검사.js 재생 --부터 <날짜> [--까지 <날짜>] [--원격 origin/master] [--json]
  공통: --저장소 <폴더>. 재생·--트리는 --정책 <파일>(기본 작업본의 ${정책경로})을 쓴다. 값은 가려서 보인다. 걸리면 종료 코드 1.`;

function 인자읽기(argv) {
  const 옵션 = { 명령: argv[0] === '재생' ? '재생' : '검사', json: false };
  const 나머지 = 옵션.명령 === '재생' ? argv.slice(1) : argv;
  for (let i = 0; i < 나머지.length; i++) {
    const a = 나머지[i];
    const 값 = () => { if (i + 1 >= 나머지.length) throw new Error(`${a} 뒤에 값이 없다`); return 나머지[++i]; };
    if (a === '--바탕') 옵션.바탕 = 값();
    else if (a === '--머리') 옵션.머리 = 값();
    else if (a === '--트리') 옵션.트리 = 값();
    else if (a === '--공개판') 옵션.공개판 = 값();
    else if (a === '--저장소') 옵션.저장소 = 값();
    else if (a === '--부터') 옵션.부터 = 값();
    else if (a === '--까지') 옵션.까지 = 값();
    else if (a === '--원격') 옵션.원격 = 값();
    else if (a === '--정책') 옵션.정책 = 값();
    else if (a === '--json') 옵션.json = true;
    else if (a === '--help' || a === '-h') 옵션.도움말 = true;
    else throw new Error(`모르는 인자: ${a}`);
  }
  return 옵션;
}

/** 재생·전수 점검의 정책: --정책 파일 → 이 작업본의 정책 파일(옛 커밋에는 정책이 없다) */
function 작업본정책(옵션) {
  const 파일 = path.resolve(옵션.저장소 || process.cwd(), 옵션.정책 || 정책경로);
  return fs.existsSync(파일) ? { 정책글: fs.readFileSync(파일, 'utf8'), 정책출처: 파일 } : {};
}

async function 재생(옵션) {
  const 저장소 = 옵션.저장소 || process.cwd();
  const git = git도구(저장소, 기본환경());
  const 원격 = 옵션.원격 || 'origin/master';
  const 정책 = 작업본정책(옵션);
  const 커밋들 = git.글(['rev-list', '--no-merges', '--reverse', `--since=${옵션.부터}`, ...(옵션.까지 ? [`--until=${옵션.까지}`] : []), 원격]).split('\n').filter(Boolean);
  const 결과 = { 커밋: 커밋들.length, 걸린커밋: 0, 줄: 0, 허용: { 예시: 0, 이미공개: 0, 표식: 0, 목록: 0 }, 규칙: {}, 걸림: [] };
  for (const c of 커밋들) {
    const 부모 = git.글(['rev-parse', `${c}^`]);
    const r = await 범위검사({ 저장소, 바탕: 부모, 머리: c, 공개판: 부모, ...정책 });
    if (!r.켜짐) continue;
    결과.줄 += r.훑은.줄;
    for (const [k, n] of Object.entries(r.허용)) 결과.허용[k] += n;
    if (r.걸림.length) {
      결과.걸린커밋++;
      for (const x of r.걸림) { 결과.규칙[x.규칙] = (결과.규칙[x.규칙] || 0) + 1; 결과.걸림.push({ 커밋: c.slice(0, 9), ...x }); }
    }
  }
  return 결과;
}

async function main(argv = process.argv.slice(2)) {
  let 옵션;
  try { 옵션 = 인자읽기(argv); } catch (e) { console.error(`${e.message}\n${사용법}`); return 2; }
  if (옵션.도움말) { console.log(사용법); return 0; }
  try {
    if (옵션.명령 === '재생') {
      if (!옵션.부터) throw new Error('재생에는 --부터가 필요하다');
      const r = await 재생(옵션);
      if (옵션.json) console.log(JSON.stringify(r, null, 2));
      else {
        console.log(`[재생] 커밋 ${r.커밋}개 · 더한 줄 ${r.줄}줄 · 걸린 커밋 ${r.걸린커밋}개 · 허용 ${Object.entries(r.허용).map(([k, n]) => `${k} ${n}`).join(', ')}`);
        for (const x of r.걸림) console.log(`  ${x.커밋} ${걸림글(x)}`);
      }
      return r.걸린커밋 ? 1 : 0;
    }
    let r;
    if (옵션.트리) {
      const 빈트리 = spawnSync('git', ['hash-object', '-t', 'tree', '--stdin'], { cwd: 옵션.저장소 || process.cwd(), input: '' }).stdout.toString().trim();
      r = await 범위검사({ 저장소: 옵션.저장소, 바탕: 빈트리, 머리: 옵션.트리, 이미공개: false, 범위메시지: false, ...작업본정책(옵션) });
    } else {
      if (!옵션.바탕 || !옵션.머리) throw new Error('--바탕과 --머리(또는 --트리)를 준다');
      r = await 범위검사({ 저장소: 옵션.저장소, 바탕: 옵션.바탕, 머리: 옵션.머리, 공개판: 옵션.공개판 });
    }
    if (옵션.json) console.log(JSON.stringify(r, null, 2));
    else if (!r.켜짐) console.log(`[꺼짐] ${정책경로}가 없는 저장소다`);
    else {
      console.log(`[${r.걸림.length ? '걸림' : '통과'}] ${요약글(r)}`);
      for (const x of r.걸림) console.log(`  ✗ ${걸림글(x)}`);
    }
    return r.켜짐 && r.걸림.length ? 1 : 0;
  } catch (e) {
    console.error(`[실패] ${e.message}`);
    return 2;
  }
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = {
  범위검사, 걸림글, 요약글, 고치는법, 정책경로, 표식, 규칙설명, main,
  _시험: { 값찾기, 표지찾기, 파일이름규칙, 메일들, 예시값, 정규, 가림, 정책풀기, glob정규식, 경로풀기, 재생 },
};
