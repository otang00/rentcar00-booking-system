import { useEffect, useMemo, useState } from 'react'
import { kakaoSdkConfig } from '../data/landing'

const KAKAO_JS_SDK_SRC = 'https://developers.kakao.com/sdk/js/kakao.min.js'
const KAKAO_MAP_SDK_SRC = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoSdkConfig.javascriptKey}&autoload=false&libraries=services`
const KAKAO_MAP_CONTAINER_ID = 'landing-kakao-map'
const MAP_ERROR_MESSAGE = '지도를 불러오지 못했습니다. 아래 버튼으로 카카오맵을 열어 주세요.'

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function loadScriptOnce(src, test) {
  return new Promise((resolve, reject) => {
    if (test()) {
      resolve()
      return
    }

    const existingScript = document.querySelector(`script[src="${src}"]`)
    const handleLoad = (event) => {
      event?.currentTarget?.setAttribute?.('data-loaded', 'true')
      resolve()
    }
    const handleError = () => reject(new Error(`failed to load script: ${src}`))

    if (existingScript) {
      if (existingScript.getAttribute('data-loaded') === 'true' || existingScript.readyState === 'complete') {
        resolve()
        return
      }

      existingScript.addEventListener('load', handleLoad, { once: true })
      existingScript.addEventListener('error', handleError, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    document.body.appendChild(script)
  })
}

async function openKakaoChat(channelPublicId, fallbackHref) {
  try {
    await loadScriptOnce(KAKAO_JS_SDK_SRC, () => Boolean(window.Kakao))
    if (!window.Kakao?.isInitialized?.()) {
      window.Kakao.init(kakaoSdkConfig.javascriptKey)
    }
    window.Kakao.Channel.chat({ channelPublicId })
  } catch (error) {
    console.error(error)
    if (fallbackHref) {
      window.open(fallbackHref, '_blank', 'noopener,noreferrer')
    }
  }
}

async function ensureKakaoMapsReady() {
  await loadScriptOnce(KAKAO_MAP_SDK_SRC, () => Boolean(window.kakao?.maps?.load))

  await new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.load) {
      reject(new Error('kakao_maps_load_unavailable'))
      return
    }

    try {
      window.kakao.maps.load(resolve)
    } catch (error) {
      reject(error)
    }
  })

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const maps = window.kakao?.maps
    if (maps?.Map && maps?.Marker && maps?.LatLng) {
      return maps
    }
    await wait(120)
  }

  throw new Error('kakao_maps_constructor_unavailable')
}

function getFallbackPosition(maps, coords) {
  if (!coords?.x || !coords?.y || !maps?.Coords) {
    return null
  }

  return new maps.Coords(Number(coords.x), Number(coords.y)).toLatLng()
}

function getActionLabel(actionType) {
  if (actionType === 'phone') return '전화 연결'
  if (actionType === 'kakao') return '채팅 연결'
  if (actionType === 'map') return '지도 보기'
  if (actionType === 'hours') return '자세히 보기'
  return '열기'
}

export default function ContactInfoStrip({ items }) {
  const [modalState, setModalState] = useState(null)
  const [mapError, setMapError] = useState('')

  const activeModal = useMemo(() => {
    if (!modalState) return null
    if (modalState.type === 'hours') {
      return {
        title: modalState.item.label,
        lines: modalState.item.detailLines || [],
      }
    }
    if (modalState.type === 'map') {
      return {
        title: modalState.item.label,
        lines: ['아래 지도에서 위치를 확인할 수 있습니다.'],
      }
    }
    return null
  }, [modalState])

  useEffect(() => {
    if (modalState?.type !== 'map') return

    let cancelled = false
    let resizeTimer = null

    async function renderMap() {
      try {
        setMapError('')
        const maps = await ensureKakaoMapsReady()
        if (cancelled) return

        const container = document.getElementById(KAKAO_MAP_CONTAINER_ID)
        if (!container) {
          throw new Error('kakao_map_container_missing')
        }

        const coords = modalState.item.mapCoords
        const services = maps.services

        const renderPosition = (position) => {
          if (!position) {
            throw new Error('kakao_map_position_missing')
          }

          container.innerHTML = ''
          const map = new maps.Map(container, {
            center: position,
            level: 3,
          })

          new maps.Marker({
            map,
            position,
            title: modalState.item.mapPlaceName || '빵빵렌트카',
          })

          const relayout = () => {
            map.relayout()
            map.setCenter(position)
          }

          requestAnimationFrame(relayout)
          window.setTimeout(relayout, 80)
          resizeTimer = window.setTimeout(relayout, 220)
        }

        const fallbackPosition = getFallbackPosition(maps, coords)

        if (services?.Geocoder && modalState.item.mapAddress) {
          const geocoder = new services.Geocoder()
          geocoder.addressSearch(modalState.item.mapAddress, (result, status) => {
            if (cancelled) return

            if (status === services.Status.OK && Array.isArray(result) && result[0] && maps.LatLng) {
              renderPosition(new maps.LatLng(Number(result[0].y), Number(result[0].x)))
              return
            }

            if (fallbackPosition) {
              renderPosition(fallbackPosition)
              return
            }

            setMapError(MAP_ERROR_MESSAGE)
          })
          return
        }

        if (fallbackPosition) {
          renderPosition(fallbackPosition)
          return
        }

        setMapError(MAP_ERROR_MESSAGE)
      } catch (error) {
        console.error('[kakao-map] render failed', error)
        if (!cancelled) {
          setMapError(MAP_ERROR_MESSAGE)
        }
      }
    }

    renderMap()
    return () => {
      cancelled = true
      if (resizeTimer) {
        window.clearTimeout(resizeTimer)
      }
    }
  }, [modalState])

  function handleItemClick(item) {
    if (item.actionType === 'phone') {
      window.location.href = `tel:${String(item.value || '').replace(/[^\d+]/g, '')}`
      return
    }

    if (item.actionType === 'kakao') {
      openKakaoChat(item.channelPublicId, item.href)
      return
    }

    if (item.actionType === 'map' || item.actionType === 'hours') {
      setModalState({ type: item.actionType, item })
      return
    }
  }

  function closeModal() {
    setModalState(null)
    setMapError('')
  }

  return (
    <section className="operation-card-section" id="landing-contact">
      <div className="site-container operation-card-container">
        <div className="operation-card-grid">
          {items.map((item) => (
            <button key={item.label} type="button" className="operation-card" onClick={() => handleItemClick(item)}>
              <span className="operation-card__label">{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
              <span className="operation-card__action" aria-hidden="true">
                {getActionLabel(item.actionType)}
                <span>›</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeModal ? (
        <div className="site-modal-backdrop delivery-modal-backdrop" onClick={closeModal}>
          <div
            className="site-modal-card search-guard-modal panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={activeModal.title}
            style={modalState?.type === 'map' ? { width: 'min(720px, 100%)' } : undefined}
          >
            <strong>{activeModal.title}</strong>
            <div className="field-note" style={{ display: 'grid', gap: 6 }}>
              {activeModal.lines.map((line) => (
                <p key={line} style={{ margin: 0 }}>{line}</p>
              ))}
            </div>
            {modalState?.type === 'map' ? (
              <>
                <p style={{ margin: 0, color: '#17212b', fontSize: '18px', fontWeight: 700, lineHeight: 1.5 }}>{modalState.item.value}</p>
                <div id={KAKAO_MAP_CONTAINER_ID} className="landing-kakao-map" />
                {mapError ? <p className="field-note" style={{ margin: 0 }}>{mapError}</p> : null}
                <div className="search-guard-actions" style={{ justifyContent: 'space-between' }}>
                  <a className="btn btn-outline btn-md" href={modalState.item.href} target="_blank" rel="noreferrer">카카오맵에서 열기</a>
                  <button className="btn btn-dark btn-md" type="button" onClick={closeModal}>닫기</button>
                </div>
              </>
            ) : (
              <div className="search-guard-actions">
                <button className="btn btn-dark btn-md" type="button" onClick={closeModal}>닫기</button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
