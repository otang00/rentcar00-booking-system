import { useEffect, useMemo, useState } from 'react'
import DeliveryLocationModal from './DeliveryLocationModal'
import { DateRangeModal, DriverAgeModal, addMonths, startOfMonth } from './SearchFlowModals'
import { fetchSearchCompany, getMockCompany } from '../services/company'
import { normalizeSearchState } from '../utils/searchQuery'
import {
  buildDateTimeValue,
  formatDateKey,
  getEarliestPickupDateTime,
  getEarliestReturnDateTime,
  getLatestPickupDateTime,
  getLatestReturnDateTime,
  getLatestSearchReturnDateTime,
  getPickupTimeOptions,
  getReturnTimeOptions,
  parseDateTimeString,
  splitDateTimeString,
} from '../utils/reservationSchedule'

export default function SearchConditionEditor({ open, initialState, onClose, onApply }) {
  const [step, setStep] = useState('location')
  const [draftState, setDraftState] = useState(() => normalizeSearchState(initialState))
  const [company, setCompany] = useState(() => getMockCompany())
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(getEarliestPickupDateTime()))
  const [draftPickupDate, setDraftPickupDate] = useState('')
  const [draftReturnDate, setDraftReturnDate] = useState('')
  const [draftPickupTime, setDraftPickupTime] = useState('09:00')
  const [draftReturnTime, setDraftReturnTime] = useState('09:00')
  const [draftDriverAge, setDraftDriverAge] = useState(26)
  const [dateModalTouchStartX, setDateModalTouchStartX] = useState(null)

  const deliverySchedule = useMemo(() => splitDateTimeString(draftState.deliveryDateTime), [draftState.deliveryDateTime])
  const returnSchedule = useMemo(() => splitDateTimeString(draftState.returnDateTime), [draftState.returnDateTime])
  const earliestPickupDate = useMemo(() => getEarliestPickupDateTime(), [])
  const earliestPickupDateKey = useMemo(() => formatDateKey(earliestPickupDate), [earliestPickupDate])
  const latestPickupDateKey = useMemo(() => formatDateKey(getLatestPickupDateTime()), [])
  const latestSearchReturnDate = useMemo(() => getLatestSearchReturnDateTime(), [])
  const modalPickupDateTime = useMemo(() => buildDateTimeValue(draftPickupDate || deliverySchedule.date, draftPickupTime || '09:00'), [draftPickupDate, deliverySchedule.date, draftPickupTime])
  const modalMinReturnDateKey = useMemo(() => {
    const pickupAt = parseDateTimeString(modalPickupDateTime)
    return pickupAt ? formatDateKey(getEarliestReturnDateTime(pickupAt)) : ''
  }, [modalPickupDateTime])
  const modalMaxReturnDateKey = useMemo(() => {
    const pickupAt = parseDateTimeString(modalPickupDateTime)
    if (!pickupAt) return ''

    const latestRentalReturnAt = getLatestReturnDateTime(pickupAt)
    const effectiveLatestReturnAt = latestRentalReturnAt < latestSearchReturnDate ? latestRentalReturnAt : latestSearchReturnDate
    return formatDateKey(effectiveLatestReturnAt)
  }, [modalPickupDateTime, latestSearchReturnDate])
  const modalPickupTimeOptions = useMemo(() => getPickupTimeOptions(draftPickupDate || deliverySchedule.date), [draftPickupDate, deliverySchedule.date])
  const modalReturnTimeOptions = useMemo(() => getReturnTimeOptions(draftReturnDate || returnSchedule.date, modalPickupDateTime), [draftReturnDate, returnSchedule.date, modalPickupDateTime])

  useEffect(() => {
    if (!open) return
    const nextState = normalizeSearchState(initialState)
    const nextDelivery = splitDateTimeString(nextState.deliveryDateTime)
    const nextReturn = splitDateTimeString(nextState.returnDateTime)
    setDraftState(nextState)
    setDraftPickupDate(nextDelivery.date)
    setDraftReturnDate(nextReturn.date)
    setDraftPickupTime(nextDelivery.time || '09:00')
    setDraftReturnTime(nextReturn.time || '09:00')
    setDraftDriverAge(nextState.driverAge || 26)
    setMonthCursor(startOfMonth(parseDateTimeString(nextState.deliveryDateTime) || getEarliestPickupDateTime()))
    setStep('location')
  }, [open, initialState])

  useEffect(() => {
    if (!open) return
    let isCancelled = false
    fetchSearchCompany(draftState)
      .then((payload) => {
        if (!isCancelled) setCompany((current) => ({ ...current, ...payload }))
      })
      .catch(() => {
        if (!isCancelled) setCompany(getMockCompany())
      })
    return () => { isCancelled = true }
  }, [open, draftState.deliveryDateTime, draftState.returnDateTime, draftState.driverAge])

  const handleLocationSelect = ({ dongId, deliveryAddress }) => {
    setDraftState((current) => normalizeSearchState({ ...current, dongId, deliveryAddress, pickupOption: 'delivery' }))
    setStep('date')
  }

  const handleCalendarDateClick = (dateKey) => {
    if (!draftPickupDate || (draftPickupDate && draftReturnDate)) {
      setDraftPickupDate(dateKey)
      setDraftReturnDate('')
      setDraftPickupTime('09:00')
      setDraftReturnTime('09:00')
      return
    }

    if (dateKey === draftPickupDate) {
      setDraftPickupDate('')
      setDraftReturnDate('')
      setDraftPickupTime('')
      setDraftReturnTime('')
      return
    }

    if (dateKey < modalMinReturnDateKey || dateKey > modalMaxReturnDateKey) return
    setDraftReturnDate(dateKey)
  }

  const confirmDateRange = () => {
    if (!draftPickupDate || !draftReturnDate || !draftPickupTime || !draftReturnTime) return
    const nextState = normalizeSearchState({
      ...draftState,
      deliveryDateTime: buildDateTimeValue(draftPickupDate, draftPickupTime),
      returnDateTime: buildDateTimeValue(draftReturnDate, draftReturnTime),
      pickupOption: 'delivery',
    })
    setDraftState(nextState)
    setDraftDriverAge(nextState.driverAge || 26)
    setStep('age')
  }

  const handleDateModalTouchEnd = (event) => {
    if (dateModalTouchStartX === null) return
    const endX = event.changedTouches?.[0]?.clientX
    if (typeof endX !== 'number') return
    const deltaX = endX - dateModalTouchStartX
    if (Math.abs(deltaX) < 48) return
    setMonthCursor((current) => addMonths(current, deltaX < 0 ? 1 : -1))
    setDateModalTouchStartX(null)
  }

  const confirmDriverAge = () => {
    if (!draftDriverAge) return
    onApply(normalizeSearchState({ ...draftState, driverAge: draftDriverAge, pickupOption: 'delivery' }))
  }

  if (!open) return null

  return (
    <>
      <DeliveryLocationModal open={step === 'location'} company={company} selectedDongId={draftState.dongId} onClose={onClose} onSelect={handleLocationSelect} closeOnSelect={false} />
      <DateRangeModal
        open={step === 'date'}
        monthCursor={monthCursor}
        pickupDate={draftPickupDate}
        returnDate={draftReturnDate}
        pickupTime={draftPickupTime}
        returnTime={draftReturnTime}
        pickupTimeOptions={modalPickupTimeOptions}
        returnTimeOptions={modalReturnTimeOptions}
        minPickupDateKey={earliestPickupDateKey}
        maxPickupDateKey={latestPickupDateKey}
        minReturnDateKey={modalMinReturnDateKey}
        maxReturnDateKey={modalMaxReturnDateKey}
        onClose={onClose}
        onPrevMonth={() => setMonthCursor((current) => addMonths(current, -1))}
        onNextMonth={() => setMonthCursor((current) => addMonths(current, 1))}
        onDateClick={handleCalendarDateClick}
        onTouchStart={(event) => setDateModalTouchStartX(event.touches?.[0]?.clientX ?? null)}
        onTouchEnd={handleDateModalTouchEnd}
        onPickupTimeChange={setDraftPickupTime}
        onReturnTimeChange={setDraftReturnTime}
        onConfirm={confirmDateRange}
      />
      <DriverAgeModal
        open={step === 'age'}
        selectedAge={draftDriverAge}
        onSelectAge={setDraftDriverAge}
        onClose={onClose}
        onConfirm={confirmDriverAge}
      />
    </>
  )
}
