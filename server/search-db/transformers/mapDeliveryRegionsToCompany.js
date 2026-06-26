'use strict'

function mapDeliveryRegionsToCompany(regions = []) {
  const provinceMap = new Map()

  for (const region of regions) {
    const provinceId = Number(region.province_id)
    const cityId = Number(region.city_id)
    const dongId = Number(region.dong_id)

    if (!provinceMap.has(provinceId)) {
      provinceMap.set(provinceId, {
        id: provinceId,
        name: region.province_name || '',
        isAll: false,
        cities: [],
        _cityMap: new Map(),
      })
    }

    const province = provinceMap.get(provinceId)

    if (!province._cityMap.has(cityId)) {
      const city = {
        id: cityId,
        name: region.city_name || '',
        isAll: false,
        dongs: [],
      }
      province._cityMap.set(cityId, city)
      province.cities.push(city)
    }

    province._cityMap.get(cityId).dongs.push({
      id: dongId,
      name: region.dong_name || '',
      oneWay: Math.floor(Number(region.round_trip_price || 0) / 2),
      roundTrip: Number(region.round_trip_price || 0),
      fullLabel: region.full_label || [region.province_name, region.city_name, region.dong_name].filter(Boolean).join(' '),
    })
  }

  return Array.from(provinceMap.values())
    .map((province) => {
      delete province._cityMap
      return province
    })
}

module.exports = {
  mapDeliveryRegionsToCompany,
}
