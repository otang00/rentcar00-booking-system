import { useEffect } from 'react'
import { PageShell } from '../components/Layout'
import termsContent from '../../docs/legal/service-terms.md?raw'
import privacyContent from '../../docs/legal/privacy-policy.md?raw'
import rentalTermsContent from '../../docs/legal/rental-terms.md?raw'

const contentMap = {
  terms: {
    title: '서비스 이용약관',
    content: termsContent,
  },
  privacy: {
    title: '개인정보 처리방침',
    content: privacyContent,
  },
  special: {
    title: '렌터카 이용약관',
    content: rentalTermsContent,
  },
}

export default function LegalPage({ kind = 'terms' }) {
  const page = contentMap[kind] || contentMap.terms

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [kind])

  return (
    <PageShell>
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
