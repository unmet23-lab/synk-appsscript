from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'index.html'
s=p.read_text(encoding='utf-8')
s=s.replace('001 · 과일 가게','001 · 아침의 작은 일')
s=s.replace('<p class="control-note">','<p id="route-level" class="route-level">LEVEL 1 · 짧은 문장 듣기</p><p class="control-note">')
s=s.replace('<strong>COASTLINE / 01</strong>','<strong id="location-title">BLOSSOM COAST / 꽃빛 해안</strong>')
s=s.replace('<strong id="prompt">출발 준비!</strong>','<strong id="prompt">출발 준비!</strong><p id="question-passage" class="question-passage" hidden></p>')
s=s.replace('<div id="toast"','<div class="drive-feedback play-only"><span id="driving-note">안전 주행 중</span><strong id="combo"></strong></div><div id="toast"')
s=s.replace('<div id="word-list"','<p id="result-medal" class="result-medal"></p><details class="review-details"><summary>정답과 이유 다시 보기</summary><div id="answer-review"></div></details><div id="word-list"')
s=s.replace('2,000단어를,<br>한 레이스씩.','단어에서 문장으로,<br>한 코스씩 더 멀리.')
s=s.replace('5단어씩 만나는 400개 학습 스테이지.<br>그림으로 시작하고, 소리로 구별하고, 틀린 단어를 다시 만나요.','6단계 도전 코스에서 듣고 읽고 판단하세요.<br>기초 어휘 2,000개는 별도 연습에서 언제든 다시 만날 수 있어요.')
s=s.replace('<div class="learning-stats">','<div class="journey-card"><div><span class="eyebrow">YOUR NEXT CHAPTER</span><h3 id="journey-title">문장과 첫 만남</h3><p id="journey-note">짧은 문장 듣기 · 다음 추천</p></div><div class="journey-stats"><span><strong id="campaign-count">0</strong> / 12코스 통과</span><span><strong id="medal-count">0</strong> / 36 학습 메달</span></div><button id="journey-next">아침의 작은 일 달리기 →</button></div><div class="collection-tabs" aria-label="학습 코스 선택"><button id="collection-campaign" aria-pressed="true">문장 도전 · 6단계</button><button id="collection-words" aria-pressed="false">어휘 연습 · 2,000단어</button></div><p class="campaign-rule">5문제 중 4문제를 맞히면 다음 코스가 열려요. ◆◆◆ 전부 정답 · ◆◆ 코스 통과. 다시 듣기와 자막은 언제든 사용해도 돼요.</p><div class="learning-stats">')
s=s.replace('<select id="stage-filter">','<select id="stage-filter" hidden>')
s=s.replace('400개 스테이지</span>','12개 스테이지</span>')
s=s.replace('모든 학습 스테이지는 현재의 해안 코스를 공유합니다.','문장 도전은 직접 만든 연습 문항이며 실제 시험 문제나 급수 판정은 아닙니다. 12개 도전과 400개 어휘 스테이지는 해안 지형을 공유하고 꽃빛·섬과 항구·노을의 세 풍경으로 구성됩니다.')
p.write_text(s,encoding='utf-8')
