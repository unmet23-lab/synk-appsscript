from pathlib import Path
import json

B = Path(__file__).resolve().parent.parent

def write(name, data):
    (B / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

pages = json.loads((B / 'brand_pages.json').read_text(encoding='utf-8'))
shift = {
    'id': 'shift_offer', 'brand': 'SHIFT', 'kicker': '04 / SHIFT · INTRODUCTION & OPERATIONS',
    'title': '한 업무의 개인화 서비스 도입과 운영',
    'lead': 'SHIFT는 고객사 한 곳의 특정 사용자와 업무부터 개인화 서비스를 도입한다. 자료·시스템을 연결하고 검수·인수 뒤 합의한 범위를 운영한다. 첫 고객·가격·출시·효과는 아직 정하지 않았다.',
    'blocks': [
        {'type': 'table', 'headers': ['수익 구조', '제공 범위', '견적 전 정할 조건'], 'rows': [
            ['초기 도입비', '자료 정리·업무 설계·설정·연결·검수·인수', '한 업무·사용자·자료 담당·납품물·인수 기준'],
            ['정기 이용·운영료', '공통 기능 이용·품질 점검·합의한 운영 지원', '포함 사용량·지원 시간·갱신·오류 처리'],
            ['추가 사용·개발비', '합의 범위를 넘는 사용·자료·연결·개발', '추가 요청의 범위·원가·승인 조건']
        ], 'widths': [1, 1.7, 2]},
        {'type': 'p', 'text': '위는 수익 구조다. 금액·과금 주기·최소 계약 기간·제공량은 미확정이다. 대표의 도입·검수·지원 시간과 AI·서버 직접비를 함께 기록하며, 정기 이용료만으로 수익성이 확인됐다고 보지 않는다.'},
        {'type': 'heading', 'text': '변경 전 가격안은 현재 도입비와 분리한다'},
        {'type': 'table', 'headers': ['과거 준비안', '기존 가격과 범위'], 'rows': [
            ['1:1 교육 / 작은 자동화', '9.9·19.9·39.9만원 / 29·59·99만원\n2026-09-29 크몽 준비안'],
            ['팀 워크숍 / 업무 적용', '3시간 100만원 / 300~800만원·2~4주\n2026-09-22 기업용 제안'],
            ['브랜딩 / 월 운영 지원', '200~500만원 / 월30~100만원·3~10시간\n2026-09-22 기업용 제안']
        ], 'widths': [1.4, 3.3]},
        {'type': 'p', 'text': '과거 교육·자동화·기업 제안가는 새 개인화 서비스의 판매가가 아니다. 기업용 가격은 당시 부가세 별도 제안이다. 기존 계약·약속은 유지하되, 신규 영업에는 현재 도입·운영 범위를 적용한다.'},
        {'type': 'p', 'text': '변경 전 계산 예시: 29만원 − 도구비2만원 − 5시간×3만원 = 12만원. 10시간이면 −3만원, 옛 시간단가10만원의 5시간이면 −23만원이다. 실제 수수료·공통비·세금은 추가 차감한다. 이 가정을 새 도입비·실측 원가로 옮기지 않는다.'},
        {'type': 'callout', 'title': '첫 도입은 한 고객의 한 업무로 정한다', 'text': '현재 FAQ·규칙 방식과 비교할 완료 결과, 실패·사람에게 넘길 기준, 자료·접근 경계, 인수·운영 담당과 종료 조건을 정한다. 실제 완료·지원시간·비용을 확인한 뒤 다음 도입을 판단한다.'}
    ],
    'sources': ['[14] 현행 SHIFT BM', '[15] 신규 확장 기준', '[06] 과거 가격·시간', '[13] 이전 크몽 준비안']
}
expansion = {
    'id': 'shift_expansion', 'brand': 'SHIFT', 'kicker': '05 / SHIFT · REPEATABLE DELIVERY',
    'title': '반복 공급을 확인한 뒤 상품을 넓힌다',
    'lead': '전문가 코칭·응대 훈련·맞춤 구매·소프트웨어 활용 지원은 적용 후보4개다. 모두를 동시에 출시하는 계획이 아니다. 접근 가능한 고객의 자료와 결과를 확인할 수 있는 한 업무부터 선택한다.',
    'blocks': [
        {'type': 'table', 'headers': ['적용 후보와 고객', '도입할 서비스의 목적'], 'rows': [
            ['전문가 코칭\n전문가·교육기관', '확인된 지식을 개인별 과제·피드백·다음 연습에 연결한다.'],
            ['영업·고객응대 훈련\n영업·CS 책임자', '자사 상황·기준으로 답하고 막힌 부분을 다시 연습한다.'],
            ['맞춤 구매·견적 상담\n판매사·상담 조직', '고객 조건을 비교·추천/제외 이유·견적 요구로 바꾼다.'],
            ['소프트웨어 활용 지원\n공급사·도입 기업', '역할별 안내·양식으로 첫 핵심 업무 완료를 돕는다.']
        ], 'widths': [1.6, 3.1]},
        {'type': 'heading', 'text': '단계마다 확인할 결과가 다르다'},
        {'type': 'table', 'headers': ['단계', '다음 단계 전에 확인할 것'], 'rows': [
            ['1 한 업무 도입·운영', '기존 방식 대비 사용자 결과·인수·오류 처리·실제 작업시간과 운영비'],
            ['2 같은 유형 반복 공급', '다른 고객에서도 재사용 가능한 부분·추가 도입시간·지원부담·수익성'],
            ['3 API·엔진 라이선스', '반복 수요·자체 연동 의사·권한·비용·호환성·문서·운영 책임']
        ], 'widths': [1.5, 3.2]},
        {'type': 'p', 'text': '교육·컨설팅·자동화·브랜딩·시장조사·제품 테스트는 도입·활용·검증을 돕는 지원 범위다. 각각 독립된 신규 주력 상품으로 늘리지 않는다. 광고·모델·룩북 제작은 PULSE, 유학·체류 준비는 PATH의 역할을 유지한다.'},
        {'type': 'p', 'text': '초기 도입에 필요한 고객 시스템 연결·내부 API는 1단계에서도 구현할 수 있다. 범용 API 상품 출시와는 구분한다. API·라이선스의 출시 순서·가격·일정은 아직 정하지 않았다.'},
        {'type': 'callout', 'title': '공통 Atlas와 전문 능력을 조합한다', 'text': 'Atlas는 여러 서비스의 개인화 수집·기억·판단·진화를 위한 공통 능력이다. 업무별 자료·규칙·평가·운영은 전문 모듈과 해당 제품에서 맡는다. 사내 실습의 로컬 구현은 기업 도입 완료나 고객 효과의 증거가 아니다.'}
    ],
    'sources': ['[14] 현행 SHIFT BM', '[15] 경영·확장 기준', '[03] 사내 도구와 계정 범위']
}
for index, page in enumerate(pages):
    if page['id'] == 'shift_offer': pages[index] = shift
    elif page['id'] == 'shift_expansion': pages[index] = expansion
write('brand_pages.json', pages)

brands = json.loads((B / 'brands.json').read_text(encoding='utf-8'))
brands['revision'] = '2026-10-07 SHIFT BM 범위 갱신'
brands['as_of'] = '2026-10-05 조사·가정 / 2026-10-06 SHIFT 범위 확정 / 2026-10-07 재편집'
brands['editorial_notes'].append('2026-10-06 이후 SHIFT 신규 사업은 한 업무의 개인화 서비스 도입·운영이며 반복 공급과 고객 효과·수익성을 확인한 뒤 API·엔진 라이선스 상품으로 확장한다. 아래 과거 SHIFT 가격·공수는 변경 전 참고 가정이며 새 도입비로 전용하지 않는다.')
for index, page in enumerate(brands['pages']):
    if page['id'] not in ('shift_core', 'shift_expansion'): continue
    original = dict(page)
    current = shift if page['id'] == 'shift_core' else expansion
    brands['pages'][index] = {
        'id': page['id'], 'brand': 'SHIFT', 'page_label': page['page_label'],
        'title': current['title'], 'lead': current['lead'],
        'current_status': '한 업무 개인화 서비스 도입·운영 → 같은 유형의 반복 공급·고객 효과·수익성 검증 → API·엔진 라이선스 확장. 첫 고객·가격·출시·성과 미확정이며 기존 계약·약속은 유지한다.',
        'blocks': current['blocks'], 'source_refs': ['shift_current_bm', 'management_current', 'platform_shift'],
        'previous_scope_reference': original,
        'previous_scope_status': '변경 전 상품·제안가·공수의 이력. 현재 신규 영업 목록·새 도입비·판매 실적이 아니다.'
    }
brands['sources']['shift_current_bm'] = {'name': 'SHIFT 현재 사업과 BM', 'path': 'docs/마케팅/SHIFT.md', 'locator': '#shift-bm · 2026-10-06 확정', 'used_for': '한 업무 도입·운영, 지원 범위, 반복 공급 이후 API·엔진 라이선스'}
brands['sources']['management_current'] = {'name': '경영 원칙과 신규 확장 기준', 'path': 'docs/사업발전_정본.md', 'locator': '#management-principles · #expansion-criteria', 'used_for': '공통 Atlas와 전문 모듈, 고객 가치·재사용·사업 연결·브랜드 일관성'}
write('brands.json', brands)

app = json.loads((B / 'app.json').read_text(encoding='utf-8'))
app['shift_revision'] = {'as_of': '2026-10-07', 'status': 'SHIFT 담당 원문은 docs/마케팅/SHIFT.md#shift-bm. 이전 상품 가격·시간은 참고 이력이며 현재 신규 영업 범위는 한 업무의 개인화 서비스 도입·운영이다. 반복 공급·고객 효과·수익성 확인 뒤 API·엔진 라이선스로 확장한다.'}
app['sources']['shift_current_bm'] = brands['sources']['shift_current_bm']
app['sources']['management_current'] = brands['sources']['management_current']
write('app.json', app)
print('Updated SHIFT print and audit source; other brand pages preserved.')
