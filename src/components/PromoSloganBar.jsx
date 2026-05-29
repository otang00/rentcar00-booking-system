import { landingPromo } from '../data/landing'

export function PromoSloganBar({ promo = landingPromo } = {}) {
  if (!promo?.slogan) return null

  return (
    <div className="promo-slogan-bar" role="note" aria-label="렌터카 상담 안내">
      <span className="promo-slogan-bar__text">{promo.slogan}</span>
      {promo.sloganShort ? <span className="promo-slogan-bar__short">{promo.sloganShort}</span> : null}
      {promo.sloganNote ? <em>{promo.sloganNote}</em> : null}
    </div>
  )
}
