from pathlib import Path
p=Path(r"docs/라디오/선정무대_20260917_추석마린_한복_부스없음/after-마스코트.html")
s=p.read_text(encoding='utf-8')
old="""/* 2026-09-16 사용자 요청 — 이번 방송은 추석 마당에도 DJ 부스를 세운다.\n   기존 전자·시티팝 결의 부스 동작은 유지한다. */\nconst 부스결 = new Set(['전자네온물가', '전자밤도시', '시티팝노을휴양지', '추석보름달마당']);"""
new="""/* 2026-09-17 사용자 요청 — 추석 마린 무대에서는 DJ 부스를 내리고 한복만 입힌다.\n   전자·시티팝 결의 기존 부스 동작은 유지한다. */\nconst 부스결 = new Set(['전자네온물가', '전자밤도시', '시티팝노을휴양지']);"""
if s.count(old)!=1: raise SystemExit(f'booth block count={s.count(old)}')
s=s.replace(old,new)
old2="""/* 2026-09-16 사용자 요청 — 이번 추석 생중계는 마린을 고정하고 헤드폰을 얹는다.\n     마린 본체에 이미 있는 꽃은 그대로 두고, 보름달 한옥 배경은 자연생동 영상으로 잇는다. */\n  추석보름달마당: { DJ: '마린', 옷: ['펠트헤드폰'], 접지: 'rgba(58,38,24,0.66)', 바닥: 8.75 },"""
new2="""/* 2026-09-17 사용자 요청 — 추석 마린은 한복을 입고, DJ 부스 없이 선다.\n     마린 본체의 꽃과 표정은 그대로 두고, 보름달 한옥 배경과 자연생동 영상·오디오는 유지한다. */\n  추석보름달마당: { DJ: '마린', 옷: ['한복'], 접지: 'rgba(58,38,24,0.66)', 바닥: 8.75 },"""
if s.count(old2)!=1: raise SystemExit(f'chuseok block count={s.count(old2)}')
s=s.replace(old2,new2)
old3='<title>SYNK 라디오 오버레이 — 마스코트</title>'
new3='<title>SYNK 라디오 오버레이 — 추석 마린 한복</title>'
if s.count(old3)!=1: raise SystemExit(f'title count={s.count(old3)}')
s=s.replace(old3,new3)
p.write_text(s,encoding='utf-8',newline='')
print('updated',len(s))
