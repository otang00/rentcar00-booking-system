import { landingPromo } from '../data/landing'

export function HeroPromoCard({ promo = landingPromo.hero, onClick } = {}) {
  if (!promo?.title) return null

  return (
    <aside className="hero-promo-card" aria-label="추천 렌터카 프로모션">
      <div>
        {promo.eyebrow ? <span>{promo.eyebrow}</span> : null}
        <strong>{promo.title}</strong>
        {promo.description ? <p>{promo.description}</p> : null}
      </div>
      {promo.cta ? (
        <button type="button" onClick={onClick}>{promo.cta}</button>
      ) : null}
    </aside>
  )
}
