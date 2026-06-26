import { useEffect, useState } from 'react'
import { PageShell } from '../components/Layout'

const DAUM_POSTCODE_SCRIPT_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

function loadDaumPostcodeScript() {
  if (window.daum?.Postcode) {
    return Promise.resolve(window.daum.Postcode)
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-daum-postcode="true"]')

    function handleReady() {
      if (window.daum?.Postcode) {
        resolve(window.daum.Postcode)
      } else {
        reject(new Error('postcode_service_unavailable'))
      }
    }

    if (existing) {
      existing.addEventListener('load', handleReady, { once: true })
      existing.addEventListener('error', () => reject(new Error('postcode_script_load_failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = DAUM_POSTCODE_SCRIPT_SRC
    script.async = true
    script.dataset.daumPostcode = 'true'
    script.onload = handleReady
    script.onerror = () => reject(new Error('postcode_script_load_failed'))
    document.head.appendChild(script)
  })
}

export default function PostcodeTestPage() {
  const [statusMessage, setStatusMessage] = useState('대기 중')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [selectedZonecode, setSelectedZonecode] = useState('')

  useEffect(() => {
    loadDaumPostcodeScript()
      .then(() => setStatusMessage('스크립트 로드 완료'))
      .catch((error) => setStatusMessage(`스크립트 로드 실패: ${error.message}`))
  }, [])

  async function handlePopupTest() {
    setStatusMessage('팝업 테스트 시작')

    try {
      const Postcode = await loadDaumPostcodeScript()
      const postcode = new Postcode({
        oncomplete: (data) => {
          const baseAddress = data.roadAddress || data.jibunAddress || data.address || ''
          setSelectedZonecode(data.zonecode || '')
          setSelectedAddress(baseAddress)
          setStatusMessage(`팝업 선택 완료: ${data.zonecode || '-'} ${baseAddress || ''}`.trim())
        },
      })

      postcode.open({ popupTitle: '우편번호 팝업 테스트' })
      setStatusMessage('팝업 open 호출 완료')
    } catch (error) {
      setStatusMessage(`팝업 테스트 실패: ${error.message}`)
    }
  }

  return (
    <PageShell>
      <section className="section-bg">
        <div className="container detail-layout" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <article className="detail-card panel" style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <h1 style={{ margin: 0 }}>우편번호 검색 단독 테스트</h1>
              <p className="small-note" style={{ margin: 0 }}>
                회원가입과 동일하게 popup 방식만 검증하는 테스트 페이지입니다.
              </p>
            </div>

            <div className="panel-sub" style={{ display: 'grid', gap: 10 }}>
              <strong>현재 상태</strong>
              <p className="field-note" style={{ margin: 0 }}>{statusMessage}</p>
              <p className="field-note" style={{ margin: 0 }}>선택 우편번호: {selectedZonecode || '-'}</p>
              <p className="field-note" style={{ margin: 0 }}>선택 주소: {selectedAddress || '-'}</p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-dark btn-md" onClick={handlePopupTest}>팝업 테스트</button>
            </div>
          </article>
        </div>
      </section>
    </PageShell>
  )
}
