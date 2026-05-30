const seoItems = [
  {
    title: '서울·수도권 딜리버리 렌터카',
    description: '서초를 기준으로 서울과 수도권 주요 지역에 렌터카 배차와 반차 상담을 지원합니다. 예약 전 위치와 시간을 먼저 확인해 가능한 차량을 안내합니다.',
  },
  {
    title: '단기렌트·월렌트·장기렌트 상담',
    description: '하루 단위 단기렌트부터 1주일렌트, 월렌트, 장기렌트까지 일정에 맞는 차량 조건을 확인할 수 있습니다. 필요한 기간과 운전자 조건에 맞춰 예약 흐름을 단순하게 구성했습니다.',
  },
  {
    title: '사고대차·일반렌트 문의',
    description: '사고대차 상담과 일반렌트 문의를 함께 받을 수 있습니다. 전화와 카카오톡 상담, 방문 주소와 운영시간을 한 화면에서 확인할 수 있습니다.',
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
          {seoItems.map((item) => (
            <article key={item.title} className="landing-seo-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
