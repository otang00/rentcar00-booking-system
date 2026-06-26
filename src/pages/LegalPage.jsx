import { useEffect } from 'react'
import { PageShell } from '../components/Layout'
import SeoHead from '../components/SeoHead'
import termsContent from '../../docs/legal/service-terms.md?raw'
import privacyContent from '../../docs/legal/privacy-policy.md?raw'
import rentalTermsContent from '../../docs/legal/rental-terms.md?raw'

const contentMap = {
  terms: {
    title: '서비스 이용약관',
    content: termsContent,
    seoTitle: '서비스 이용약관 | 빵빵카 렌터카 예약',
    description: '빵빵카 렌터카 예약 서비스 이용약관입니다. 예약, 결제, 취소, 환불, 서비스 이용 기준을 안내합니다.',
    canonicalPath: '/terms',
  },
  privacy: {
    title: '개인정보 처리방침',
    content: privacyContent,
    seoTitle: '개인정보 처리방침 | 빵빵카 렌터카 예약',
    description: '빵빵카 렌터카 예약 서비스의 개인정보 수집, 이용, 보관, 파기 및 이용자 권리 기준을 안내합니다.',
    canonicalPath: '/privacy',
  },
  special: {
    title: '렌터카 이용약관',
    content: rentalTermsContent,
    seoTitle: '렌터카 이용약관 | 빵빵카',
    description: '빵빵카 렌터카 대여, 운전자 조건, 차량 이용, 사고, 취소 및 환불 관련 렌터카 이용약관입니다.',
    canonicalPath: '/special-terms',
  },
}

export default function LegalPage({ kind = 'terms' }) {
  const page = contentMap[kind] || contentMap.terms

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [kind])

  return (
    <PageShell>
      <SeoHead
        title={page.seoTitle}
        description={page.description}
        canonicalPath={page.canonicalPath}
        ogTitle={page.seoTitle}
        ogDescription={page.description}
      />
      <main className="section-bg">
        <div className="container legal-page">
          <article className="detail-card legal-card">
            <h1>{page.title}</h1>
            <div className="legal-content">
              {page.content.split('\n').map((line, idx) => (
                <p key={idx}>{line || '\u00A0'}</p>
              ))}
            </div>
          </article>
        </div>
      </main>
    </PageShell>
  )
}
