const serviceItems = [
  {
    title: '서울·수도권 딜리버리 렌터카',
    description: '서초를 기준으로 서울, 경기, 수도권 주요 지역에 렌터카 배차와 반차 상담을 지원합니다. 예약 전 위치와 대여 시간을 먼저 확인해 가능한 차량을 안내합니다.',
  },
  {
    title: '단기렌트·1주일렌트',
    description: '하루 단위 단기렌트부터 7일 이상 이용하는 1주일렌트까지 일정에 맞는 차량 조건을 확인할 수 있습니다. 운전자 연령과 이용 기간에 맞춰 예약 흐름을 단순하게 구성했습니다.',
  },
  {
    title: '월렌트·장기렌트 상담',
    description: '30일 전후 월렌트와 장기렌트는 차량 등급, 이용 기간, 보험 조건, 배차 가능 지역을 함께 보고 상담합니다. 필요한 기간을 먼저 정하면 가능한 차량 중심으로 안내합니다.',
  },
  {
    title: '사고대차·일반렌트 문의',
    description: '사고대차 상담과 일반렌트 문의를 함께 받을 수 있습니다. 전화와 카카오톡 상담, 방문 주소와 운영시간을 한 화면에서 확인할 수 있습니다.',
  },
]

const areaItems = [
  '서울 서초·강남권 렌터카 상담',
  '서울 전지역 딜리버리 배차 상담',
  '경기·수도권 주요 지역 배차 상담',
  '방문 수령과 반납 상담',
]

const faqItems = [
  {
    question: '예약 가능한 차량은 어떻게 확인하나요?',
    answer: '메인에서 딜리버리 위치, 대여일시, 반납일시, 운전자 연령을 선택하면 해당 조건에서 예약 가능한 차량을 중심으로 확인할 수 있습니다.',
  },
  {
    question: '단기렌트와 월렌트 모두 가능한가요?',
    answer: '하루 단위 단기렌트, 1주일렌트, 월렌트, 장기렌트 상담을 모두 받을 수 있습니다. 실제 가능 차량과 금액은 일정과 지역 조건에 따라 달라질 수 있습니다.',
  },
  {
    question: '서울 외 수도권도 배차가 가능한가요?',
    answer: '서울과 수도권 주요 지역은 딜리버리 배차와 반차 상담이 가능합니다. 정확한 가능 여부는 선택한 지역과 대여 시간 기준으로 확인합니다.',
  },
]

export default function LandingSeoSection() {
  return (
    <section className="landing-seo-section" aria-labelledby="landing-seo-title">
      <div className="container landing-seo-container">
        <div className="landing-seo-head">
          <span>서울·수도권 렌터카 예약 안내</span>
          <h2 id="landing-seo-title">단기렌트부터 월렌트·장기렌트까지 일정에 맞게 상담하세요</h2>
          <p>
            빵빵카는 서울·수도권 렌터카 예약을 더 쉽게 확인할 수 있도록 위치, 대여 시간,
            반납 시간을 먼저 선택하는 방식으로 운영합니다. 단기렌트, 1주일렌트, 월렌트,
            장기렌트는 물론 서초 렌트카 상담, 사고대차, 일반렌트 문의도 함께 안내합니다.
          </p>
        </div>

        <div className="landing-seo-grid">
          {serviceItems.map((item) => (
            <article key={item.title} className="landing-seo-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>

        <div className="landing-seo-panel" aria-labelledby="landing-area-title">
          <div>
            <span className="landing-seo-kicker">지역·서비스 키워드</span>
            <h3 id="landing-area-title">서울 렌터카, 수도권 렌터카, 딜리버리 렌트 조건을 한 번에 확인합니다</h3>
            <p>
              서초구 방문 상담을 기준으로 서울과 수도권 배차 가능 여부를 확인하고,
              단기렌트·월렌트·장기렌트·사고대차 상담을 예약 흐름 안에서 연결합니다.
            </p>
          </div>
          <ul className="landing-seo-list">
            {areaItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div className="landing-seo-faq" aria-labelledby="landing-faq-title">
          <div className="landing-seo-faq-head">
            <span className="landing-seo-kicker">자주 묻는 질문</span>
            <h3 id="landing-faq-title">렌터카 예약 전 확인할 내용</h3>
          </div>
          <div className="landing-seo-faq-list">
            {faqItems.map((item) => (
              <article key={item.question} className="landing-seo-faq-card">
                <h4>{item.question}</h4>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
