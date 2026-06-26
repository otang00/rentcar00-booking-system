function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function normalizePartnerOptionLabel(option) {
  const optionMap = {
    navigation: '네비게이션',
    bluetooth: '블루투스',
    rear_sensor: '후방센서',
    heated_handle: '핸들열선',
    rear_camera: '후방카메라',
    smart_key: '스마트키',
    heated_seat: '열선시트',
    dash_cam: '블랙박스',
    driver_airbag: '운전석 에어백',
    passenger_airbag: '조수석 에어백',
    non_smoking: '금연 차량',
  }

  return optionMap[option] || option
}

function mergeCarDetailSources({ dto, supabaseCar }) {
  if (!dto || !dto.car) return dto
  if (!supabaseCar) {
    return {
      ...dto,
      meta: {
        ...(dto.meta || {}),
        source: 'partner-detail-only',
        carSource: 'partner',
      },
    }
  }

  const partnerCar = dto.car || {}
  const supabaseOptions = Array.isArray(supabaseCar.options_json?.names)
    ? supabaseCar.options_json.names
    : []
  const partnerOptions = Array.isArray(partnerCar.options)
    ? partnerCar.options.map(normalizePartnerOptionLabel)
    : []

  const mergedCar = {
    ...partnerCar,
    carId: Number(supabaseCar.source_car_id || partnerCar.carId || 0),
    name: supabaseCar.name || partnerCar.name || '',
    displayName: supabaseCar.display_name || partnerCar.displayName || '',
    imageUrl: supabaseCar.image_url || partnerCar.imageUrl || '',
    fuelType: supabaseCar.fuel_type || partnerCar.fuelType || '',
    capacity: Number(supabaseCar.seats || partnerCar.capacity || 0),
    minModelYear: Number(partnerCar.minModelYear || supabaseCar.model_year || 0),
    maxModelYear: Number(partnerCar.maxModelYear || supabaseCar.model_year || 0),
    rentAge: Number(supabaseCar.rent_age || partnerCar.rentAge || 0),
    options: uniqueStrings(supabaseOptions.length > 0 ? supabaseOptions : partnerOptions),
  }

  return {
    ...dto,
    car: mergedCar,
    meta: {
      ...(dto.meta || {}),
      source: 'partner-detail+supabase-cars',
      carSource: 'supabase',
      sourceCarId: Number(supabaseCar.source_car_id || mergedCar.carId || 0),
    },
  }
}

module.exports = {
  mergeCarDetailSources,
}
