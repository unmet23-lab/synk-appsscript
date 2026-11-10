// 의뢰서 휴대폰 칸(선택)이 받는 꼴(11-11 판 6 시나리오 12 「국제 전화번호」).
// 보내기(strict)에서 거절되면 손님은 마지막 단계에서 앞 단계로 돌아가야 한다 — 흔한 꼴은 받고, 글자 · 너무 짧은 값만 막는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRequestAnswers,emptyRequestAnswers} from './pulse-requests.mjs';

const send=phone=>normalizeRequestAnswers({...emptyRequestAnswers(),phone},{strict:true});

test('the phone field accepts Korean and international numbers written with spaces, hyphens, brackets or dots',()=>{
  for(const phone of ['010-1234-5678','01012345678','010.1234.5678','010 1234 5678','+82 10-1234-5678','+1 (415) 555-0134','+1 415.555.0134','+81 90-1234-5678','+44 20 7946 0958','+49 30.1234.5678'])
    assert.equal(send(phone).phone,phone,phone);
});

test('the phone field still refuses letters, other symbols and numbers that are too short',()=>{
  for(const phone of ['call me maybe','010-1234-5678 ext 2','010/1234/5678','+1 415 555 0134 #2','123456'])
    assert.throws(()=>send(phone),{message:'휴대폰 번호를 확인해 주세요.'},phone);
});

test('an empty phone stays optional and drafts are not checked',()=>{
  assert.equal(send('').phone,'');
  assert.equal(normalizeRequestAnswers({...emptyRequestAnswers(),phone:'call me'}).phone,'call me');
});
