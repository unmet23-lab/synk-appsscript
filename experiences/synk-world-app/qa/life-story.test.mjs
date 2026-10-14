// 이야기 장면 디테일(10-15): 형광펜 글, 진행 칸, 해설 글꼴이 담은 글자, 말소리·효과음 모듈의 바깥 모양.
import test from 'node:test';
import assert from 'node:assert/strict';
import {storyLineMarkup,storySteps} from '../life-story.mjs';
import {LESSONS,lessonById} from '../life-content.mjs';
import {storyCharacters,missingCharacters} from '../../../tools/build-world-story-font.mjs';
import {storyVoice,renderSound,PREF_KEYS,PREF_LABELS,getPref} from '../../brand-opening/world-sound.mjs';

test('레슨 표현이 이야기에 나오면 누를 수 있는 형광펜을 칠한다', () => {
  const lesson = lessonById('greetings-story');
  const html = storyLineMarkup(lesson.scenes[2].text, lesson.expressions);
  const marks = [...html.matchAll(/<mark class="life-say" data-life-mark="(\d+)"[^>]*>([^<]+)<\/mark>/g)].map(m => [lesson.expressions[Number(m[1])].korean, m[2]]);
  assert.deepEqual(marks, [['안녕하세요.', '안녕하세요'], ['저는 몽글이에요.', '저는 몽글이에요']]);
  assert.equal(html.replace(/<[^>]+>/g, ''), lesson.scenes[2].text);
});

test('따옴표 안 글은 전처럼 칠하고, 표현과 맞을 때만 누를 수 있다', () => {
  const expressions = [{korean: '포장해 주세요.', meaning: ''}];
  assert.equal(storyLineMarkup('직원이 ‘포장해 주세요’라고 들었어요.', expressions), '직원이 ‘<mark class="life-say" data-life-mark="0" tabindex="0" aria-label="포장해 주세요 · 표현 도움 보기">포장해 주세요</mark>’라고 들었어요.');
  assert.equal(storyLineMarkup('안내판에 ‘공원’이 있어요.', expressions), '안내판에 ‘<mark class="life-say">공원</mark>’이 있어요.');
  assert.equal(storyLineMarkup('<b>“너”</b> & 나', []), '&lt;b&gt;“너”&lt;/b&gt; &amp; 나');
});

test('형광펜은 모든 이야기에서 글을 바꾸지 않고, 겹쳐 칠하지 않는다', () => {
  for (const lesson of LESSONS) for (const scene of lesson.scenes || []) {
    const html = storyLineMarkup(scene.text, lesson.expressions);
    assert.equal(html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'), scene.text, lesson.id);
    assert.doesNotMatch(html, /<mark[^>]*>[^<]*<mark/, lesson.id);
  }
});

test('진행 칸은 이야기 장면 칸 + 문제 칸이고 지금 칸이 하나뿐이다', () => {
  const cells = html => [...html.matchAll(/<i(?: class="is-(done|now)")?><\/i>/g)].map(m => (m[1] || '-')[0]).join('');
  const story = storySteps({scenes: 9, questions: 3, phase: 'story', sceneIndex: 2});
  assert.equal(cells(story), 'ddn' + '-'.repeat(9));
  assert.equal(cells(storySteps({scenes: 9, questions: 3, phase: 'questions', questionIndex: 1})), 'd'.repeat(9) + 'dn-');
  assert.equal(cells(storySteps({scenes: 9, questions: 3, phase: 'questions', questionIndex: 1, answered: true})), 'd'.repeat(11) + '-');
  assert.equal(cells(storySteps({scenes: 9, questions: 3, phase: 'intro'})), '-'.repeat(12));
  assert.match(story, /aria-hidden="true"/);
});

test('해설 글꼴(본명조 조각)에 이야기 장면 글자가 모두 담겨 있다', async () => {
  const missing = missingCharacters(await storyCharacters());
  assert.deepEqual(missing, [], '빠진 글자가 있으면 node tools/build-world-story-font.mjs로 다시 만든다');
});

test('말소리·효과음 모듈: 설정 이름은 그대로 두고 이야기 말소리 설정만 더했다', () => {
  assert.deepEqual(Object.keys(PREF_KEYS), ['sound', 'storyVoice', 'haptic', 'celebrate', 'reactions']);
  assert.equal(PREF_KEYS.sound, 'synk.world.sound');
  assert.equal(PREF_LABELS.storyVoice.title, '이야기 말소리');
  assert.equal(getPref('storyVoice'), true);
  assert.equal(renderSound('없는소리', null, null), false);
  const voice = storyVoice('mongle', '우와! 몽글');
  assert.deepEqual(voice.chars, Array.from('우와! 몽글'));
  assert.equal(voice.at(0), false, '오디오가 없으면 조용히 넘어간다');
  assert.equal(voice.at(2), false, '한글이 아닌 글자는 소리를 내지 않는다');
});
