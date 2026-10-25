// 실측 요약(요약_<이름>.json)의 Wh를 한전 주택용 저압 요금으로 바꾼다: node 요금.mjs [이름…]  (이 폴더에서)
// 단가(2026-10-26 확인):
//   전력량요금 120.0 / 214.6 / 307.3원/kWh — 한전 사이버지점 「한글 전기요금표(주택용-저압)」 기타계절, 2023-11-09 적용분 그대로
//     https://cyber.kepco.co.kr/ckepco/front/jsp/CY/E/E/CYEEHP00101.jsp
//   연료비조정단가 +5.0원/kWh — 한전 공지 「2026년 4분기 연료비조정단가 산정내역」(2026-09-21, 10~12월분)
//     https://www.kepco.co.kr/home/media/newsroom/notice/boardView.do?boardMngNo=14&boardNo=2759
//   기후환경요금 9.0원/kWh — 한전 사보 「빛으로 여는 세상」 2023년 3·4월호(2023-01부터 9.0원)
//     https://home.kepco.co.kr/kepco/front/html/WZ/2023_03_04/sub2_1.html · 그 뒤 4분기 동결 보도(연합뉴스 2026-09-21 「기후환경요금도 별도로 인상하지 않아」)
//   부가가치세 10% · 전력산업기반기금 2.7%(전기사업법 시행령 제36조, 2025-07부터) — 둘 다 전기요금계에 붙는다
// 누진 구간은 그 집이 한 달에 쓴 양으로 정해진다. 영상의 숫자는 가장 비싼 구간(400kWh 넘게 쓰는 집의 다음 1kWh)으로 쳐서 넉넉히 잡는다.
import fs from 'node:fs';

const EXTRA = 9.0 + 5.0;
const TAX = 1 + 0.1 + 0.027;
const TIERS = { '1구간(200kWh까지)': 120.0, '2구간(201~400kWh)': 214.6, '3구간(400kWh 넘게)': 307.3 };
const unit = (rate) => (rate + EXTRA) * TAX;

const names = process.argv.slice(2).length ? process.argv.slice(2) : ['cat'];
for (const n of names) {
  const s = JSON.parse(fs.readFileSync(`요약_${n}.json`, 'utf8'));
  const g = s.만드는동안.gpu, c = s.만드는동안.cpu;
  console.log(`[${n}] ${s.시작} · ${(s.걸린초 / 60).toFixed(1)}분 · GPU ${g.Wh}Wh(평균 ${g.평균W}W, 최대 ${g.최대W}W) · CPU 패키지 ${c.Wh}Wh(평균 ${c.평균W}W, 쉴 때 ${s.쉴때.cpu.평균W}W)`);
  for (const [k, r] of Object.entries(TIERS)) {
    const u = unit(r);
    console.log(`  ${k} ${u.toFixed(1)}원/kWh → GPU ${((g.Wh / 1000) * u).toFixed(2)}원 · GPU+CPU ${(((g.Wh + c.Wh) / 1000) * u).toFixed(2)}원`);
  }
}
