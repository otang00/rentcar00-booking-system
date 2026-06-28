import { useEffect, useMemo, useState } from 'react'

function findSelectedPath(provinces, selectedDongId) {
  if (!selectedDongId) return null

  for (const province of provinces) {
    for (const city of province.cities || []) {
      for (const dong of city.dongs || []) {
        if (dong.id === selectedDongId) {
          return {
            provinceId: province.id,
            cityId: city.id,
            dong,
          }
        }
      }
    }
  }

  return null
}

function findDong(provinces, dongId) {
  if (!dongId) return null

  for (const province of provinces) {
    for (const city of province.cities || []) {
      for (const dong of city.dongs || []) {
        if (dong.id === dongId) {
          return { province, city, dong }
        }
      }
    }
  }

  return null
}

function StepCard({ step, label, value, active, done, disabled, onClick }) {
  return (
    <button
      type="button"
      className={`delivery-inline-step-card ${active ? 'is-active' : ''} ${done ? 'is-done' : ''} ${disabled ? 'is-disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span>
        <small>{step}</small>
        <strong>{value}</strong>
      </span>
      <em>{active ? '선택중' : done ? '완료' : '대기'}</em>
    </button>
  )
}

export default function DeliveryLocationModal({
  open,
  company,
  selectedDongId,
  onClose,
  onSelect,
  closeOnSelect = true,
  isLoading = false,
  errorMessage = '',
}) {
  const [selectedProvinceId, setSelectedProvinceId] = useState(null)
  const [selectedCityId, setSelectedCityId] = useState(null)
  const [draftDongId, setDraftDongId] = useState(null)
  const [mobileStep, setMobileStep] = useState('province')

  const provinces = Array.isArray(company?.deliveryCostList) ? company.deliveryCostList : []
  const hasRegions = provinces.length > 0
  const shouldShowStatus = isLoading || errorMessage || !hasRegions

  useEffect(() => {
    if (!open) return undefined

    const originalBodyOverflow = document.body.style.overflow
    const originalBodyOverscrollBehavior = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'contain'

    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.body.style.overscrollBehavior = originalBodyOverscrollBehavior
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const selectedPath = findSelectedPath(provinces, selectedDongId)
    if (selectedPath) {
      setSelectedProvinceId(selectedPath.provinceId)
      setSelectedCityId(selectedPath.cityId)
      setDraftDongId(selectedDongId)
      setMobileStep('dong')
      return
    }

    setSelectedProvinceId(null)
    setSelectedCityId(null)
    setDraftDongId(null)
    setMobileStep('province')
  }, [open, provinces, selectedDongId])

  const selectedProvince = useMemo(() => {
    if (!provinces.length || !selectedProvinceId) return null
    return provinces.find((province) => province.id === selectedProvinceId) || null
  }, [provinces, selectedProvinceId])

  const cities = selectedProvince?.cities || []

  const selectedCity = useMemo(() => {
    if (!cities.length || !selectedCityId) return null
    return cities.find((city) => city.id === selectedCityId) || null
  }, [cities, selectedCityId])

  const dongs = selectedCity?.dongs || []
  const draftSelection = useMemo(() => findDong(provinces, draftDongId), [provinces, draftDongId])
  const selectedLocationLabel = draftSelection?.dong?.fullLabel
    || [draftSelection?.province?.name, draftSelection?.city?.name, draftSelection?.dong?.name].filter(Boolean).join(' ')
    || ''

  const canConfirm = Boolean(draftSelection?.dong)

  function handleProvinceSelect(province) {
    setSelectedProvinceId(province.id)
    setSelectedCityId(null)
    setDraftDongId(null)
    setMobileStep('city')
  }

  function handleCitySelect(city) {
    setSelectedCityId(city.id)
    setDraftDongId(null)
    setMobileStep('dong')
  }

  function handleDongSelect(dong) {
    setDraftDongId(dong.id)
  }

  function handleConfirm() {
    if (!draftSelection?.dong) return
    onSelect({
      dongId: draftSelection.dong.id,
      deliveryAddress: draftSelection.dong.fullLabel,
    })
    if (closeOnSelect) onClose()
  }

  function renderMobileChoices() {
    if (mobileStep === 'province') {
      return (
        <div className="delivery-inline-choice-panel">
          <div className="delivery-inline-choice-head">
            <strong>시/도를 선택해주세요</strong>
            <p>선택하면 다음 카드가 활성화됩니다.</p>
          </div>
          <div className="delivery-inline-choice-list">
            {provinces.map((province) => (
              <button
                key={province.id}
                type="button"
                className={`delivery-option-button delivery-region-button ${selectedProvince?.id === province.id ? 'is-active' : ''}`}
                onClick={() => handleProvinceSelect(province)}
              >
                {province.name}
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (mobileStep === 'city') {
      return (
        <div className="delivery-inline-choice-panel">
          <div className="delivery-inline-choice-head">
            <strong>시/구/군을 선택해주세요</strong>
            <p>{selectedProvince?.name || '시/도'} 안에서 선택합니다.</p>
          </div>
          <div className="delivery-inline-choice-list">
            {cities.map((city) => (
              <button
                key={city.id}
                type="button"
                className={`delivery-option-button delivery-region-button ${selectedCity?.id === city.id ? 'is-active' : ''}`}
                onClick={() => handleCitySelect(city)}
              >
                {city.name}
              </button>
            ))}
            {cities.length === 0 && <div className="delivery-empty">선택 가능한 시/구/군이 없습니다.</div>}
          </div>
        </div>
      )
    }

    return (
      <div className="delivery-inline-choice-panel">
        <div className="delivery-inline-choice-head">
          <strong>딜리버리 지역을 선택해주세요</strong>
          <p>{[selectedProvince?.name, selectedCity?.name].filter(Boolean).join(' ')} 안에서 선택합니다.</p>
        </div>
        <div className="delivery-inline-choice-list">
          {dongs.map((dong) => (
            <button
              key={dong.id}
              type="button"
              className={`delivery-fee-card delivery-region-card ${draftDongId === dong.id ? 'is-active' : ''}`}
              onClick={() => handleDongSelect(dong)}
            >
              <div className="delivery-fee-head delivery-region-summary">
                <strong>{dong.name}</strong>
                <span>{selectedCity?.name}</span>
              </div>
            </button>
          ))}
          {dongs.length === 0 && <div className="delivery-empty">선택 가능한 딜리버리 지역이 없습니다.</div>}
        </div>
      </div>
    )
  }

  function renderRegionStatus() {
    if (isLoading) {
      return (
        <div className="delivery-region-status" role="status" aria-live="polite">
          <strong>딜리버리 지역을 불러오는 중입니다</strong>
          <p>잠시만 기다려 주세요.</p>
        </div>
      )
    }

    if (errorMessage) {
      return (
        <div className="delivery-region-status is-error" role="alert">
          <strong>딜리버리 지역을 불러오지 못했습니다</strong>
          <p>{errorMessage}</p>
        </div>
      )
    }

    return (
      <div className="delivery-region-status is-empty" role="status">
        <strong>선택 가능한 딜리버리 지역이 없습니다</strong>
        <p>잠시 후 다시 시도해 주세요.</p>
      </div>
    )
  }

  if (!open) return null

  return (
    <div className="delivery-modal-backdrop" onClick={onClose}>
      <div className="delivery-modal delivery-region-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="딜리버리 지역 선택">
        <div className="delivery-modal-header delivery-region-modal-header">
          <div>
            <strong>딜리버리 지역 선택</strong>
            <p><b>선택 위치:</b> {selectedLocationLabel || '아직 선택되지 않았습니다.'}</p>
          </div>
          <div className="delivery-modal-actions delivery-desktop-actions">
            <button className={`btn btn-dark btn-md ${canConfirm ? 'is-flow-active' : ''}`} type="button" onClick={handleConfirm} disabled={!canConfirm}>선택 완료</button>
            <button className="btn btn-outline btn-md delivery-modal-close" type="button" onClick={onClose}>닫기</button>
          </div>
        </div>

        {shouldShowStatus ? renderRegionStatus() : null}

        {!shouldShowStatus && (
        <div className="delivery-modal-body delivery-region-grid delivery-desktop-only">
          <div className="delivery-column delivery-region-column province-column">
            <div className="delivery-column-heading">
              <span className="field-label">시/도</span>
            </div>
            <div className="delivery-column-content">
              <div className="delivery-option-list delivery-region-list">
                {provinces.map((province) => (
                  <button
                    key={province.id}
                    className={`delivery-option-button delivery-region-button ${!selectedProvince ? 'is-flow-active' : ''} ${selectedProvince?.id === province.id ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => handleProvinceSelect(province)}
                  >
                    {province.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="delivery-column delivery-region-column city-column">
            <div className="delivery-column-heading">
              <span className="field-label">시/구/군</span>
            </div>
            <div className="delivery-column-content">
              <div className="delivery-option-list delivery-region-list">
                {cities.map((city) => (
                  <button
                    key={city.id}
                    className={`delivery-option-button delivery-region-button ${selectedProvince && !selectedCity ? 'is-flow-active' : ''} ${selectedCity?.id === city.id ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => handleCitySelect(city)}
                  >
                    {city.name}
                  </button>
                ))}
                {cities.length === 0 && <div className="delivery-empty">시/도를 먼저 선택해 주세요.</div>}
              </div>
            </div>
          </div>

          <div className="delivery-column delivery-region-column dong-column">
            <div className="delivery-column-heading">
              <span className="field-label">딜리버리 지역</span>
            </div>
            <div className="delivery-column-content">
              <div className="delivery-fee-list delivery-region-list">
                {dongs.map((dong) => (
                  <button
                    key={dong.id}
                    className={`delivery-fee-card delivery-region-card ${selectedCity && !draftDongId ? 'is-flow-active' : ''} ${draftDongId === dong.id ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => handleDongSelect(dong)}
                  >
                    <div className="delivery-fee-head delivery-region-summary">
                      <strong>{dong.name}</strong>
                      <span>{selectedCity?.name}</span>
                    </div>
                  </button>
                ))}
                {dongs.length === 0 && <div className="delivery-empty">시/구/군을 먼저 선택해 주세요.</div>}
              </div>
            </div>
          </div>
        </div>
        )}

        {!shouldShowStatus && (
        <div className="delivery-mobile-flow delivery-mobile-only">
          <div className="delivery-inline-steps">
            <div>
              <StepCard
                step="1. 시/도"
                value={selectedProvince?.name || '시/도를 선택해주세요'}
                active={mobileStep === 'province'}
                done={Boolean(selectedProvince)}
                disabled={false}
                onClick={() => setMobileStep('province')}
              />
              {mobileStep === 'province' ? renderMobileChoices() : null}
            </div>

            <div>
              <StepCard
                step="2. 시/구/군"
                value={selectedCity?.name || (selectedProvince ? '시/구/군을 선택해주세요' : '시/도 선택 후 활성화')}
                active={mobileStep === 'city'}
                done={Boolean(selectedCity)}
                disabled={!selectedProvince}
                onClick={() => selectedProvince && setMobileStep('city')}
              />
              {mobileStep === 'city' ? renderMobileChoices() : null}
            </div>

            <div>
              <StepCard
                step="3. 딜리버리 지역"
                value={draftSelection?.dong?.name || (selectedCity ? '딜리버리 지역을 선택해주세요' : '시/구/군 선택 후 활성화')}
                active={mobileStep === 'dong'}
                done={Boolean(draftSelection?.dong)}
                disabled={!selectedCity}
                onClick={() => selectedCity && setMobileStep('dong')}
              />
              {mobileStep === 'dong' ? renderMobileChoices() : null}
            </div>
          </div>

          <div className="delivery-mobile-selected-summary">
            <span>선택 위치</span>
            <strong>{selectedLocationLabel || '아직 선택되지 않았습니다.'}</strong>
          </div>

          <div className="delivery-mobile-actions">
            <button className="btn btn-outline btn-md" type="button" onClick={onClose}>닫기</button>
            <button className={`btn btn-dark btn-md ${canConfirm ? 'is-flow-active' : ''}`} type="button" onClick={handleConfirm} disabled={!canConfirm}>선택 완료</button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
