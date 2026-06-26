import { NavLink } from 'react-router-dom'

const ADMIN_NAV_ITEMS = [
  { to: '/admin/pricing-hub', label: '통합요금관리' },
  { to: '/admin/delivery-regions', label: '배송비관리' },
  { to: '/admin/bookings', label: '예약관리' },
]

export function AdminNav() {
  return (
    <nav className="panel-sub" aria-label="관리자 메뉴" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <strong style={{ marginRight: 4 }}>관리자 메뉴</strong>
      {ADMIN_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-dark' : 'btn-outline'}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
