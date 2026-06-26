import { getDefaultSearchDateTimes } from '../utils/reservationSchedule'

export const SEARCH_QUERY_KEYS = [
  'deliveryDateTime',
  'returnDateTime',
  'pickupOption',
  'driverAge',
  'order',
  'dongId',
  'deliveryAddress',
  'deliveryAddressDetail',
]

export const PICKUP_OPTIONS = ['pickup', 'delivery']
export const ORDER_OPTIONS = ['lower', 'higher', 'newer']
export const DRIVER_AGE_OPTIONS = [21, 26]

export function getDefaultSearchState() {
  const dateTimes = getDefaultSearchDateTimes()

  return {
    deliveryDateTime: dateTimes.deliveryDateTime,
    returnDateTime: dateTimes.returnDateTime,
    pickupOption: 'delivery',
    driverAge: 26,
    order: 'lower',
    dongId: null,
    deliveryAddress: '',
    deliveryAddressDetail: '',
  }
}

export const DEFAULT_SEARCH_STATE = getDefaultSearchState()
