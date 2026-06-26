import { company } from './mock'

export const kakaoSdkConfig = {
  javascriptKey: 'b912305361ab3ad47fd00c2714bf324e',
  channelPublicId: '_SZcVn',
  mapAddress: '서울 서초구 신반포로23길 78-9',
  mapPlaceName: '빵빵렌트카',
  mapPlaceHref: 'https://map.kakao.com/?map_type=TYPE_MAP&itemId=27150232&q=%EB%B9%B5%EB%B9%B5%EB%A0%8C%ED%8A%B8%EC%B9%B4&urlLevel=3&urlX=501248&urlY=1114509',
}

export const landingNotice = {
  serviceNotice: '서울/수도권 전지역 배차/반차 가능합니다. 전화상담 01024167114 카카오톡ID 00RENTCAR',
  phone: '010-2416-7114',
  kakaoId: '00RENTCAR',
  hours: '09:00 - 18:00',
}

export const landingHeaderMenu = [
  { label: '단기렌트', to: '#landing-reservation' },
  { label: '장기렌트', to: '#landing-contact' },
  { label: '예약내역', to: '/reservations' },
  { label: '회원', to: '/reservations' },
  { label: '장바구니', to: '/cars' },
]

export const landingHero = {
  slides: [
    {
      pcSrc: '/assets/hero/hero-1-pc.png',
      mobileSrc: '/assets/hero/hero-1-mobile.png',
      alt: '빵빵카 메인 배너 1',
    },
    {
      pcSrc: '/assets/hero/hero-2-pc.png',
      mobileSrc: '/assets/hero/hero-2-mobile.png',
      alt: '빵빵카 메인 배너 2',
    },
    {
      pcSrc: '/assets/hero/hero-3-pc.png',
      mobileSrc: '/assets/hero/hero-3-mobile.png',
      alt: '빵빵카 메인 배너 3',
    },
  ],
}

export const landingContactItems = [
  {
    label: '전화상담',
    value: landingNotice.phone,
    note: '평일 운영시간 내 빠른 상담 가능',
    actionType: 'phone',
  },
  {
    label: '카카오톡',
    value: landingNotice.kakaoId,
    note: '카카오톡 1:1 채팅 연결',
    actionType: 'kakao',
    href: 'https://pf.kakao.com/_SZcVn/chat',
    channelPublicId: kakaoSdkConfig.channelPublicId,
  },
  {
    label: '방문 주소',
    value: '서울 서초구 신반포로23길 78-9',
    note: '방문주소 지도창 열기',
    actionType: 'map',
    href: kakaoSdkConfig.mapPlaceHref,
    mapAddress: kakaoSdkConfig.mapAddress,
    mapPlaceName: kakaoSdkConfig.mapPlaceName,
    mapCoords: {
      x: 501239,
      y: 1114525,
    },
  },
  {
    label: '운영시간',
    value: landingNotice.hours,
    note: '상세 운영 기준 보기',
    actionType: 'hours',
    detailLines: ['평일 09:00 - 18:00', '점심시간 12:00 - 13:00', '주말 및 공휴일 휴무', '운영시간 외 문의는 다음 영업일에 순차 응대'],
  },
]
