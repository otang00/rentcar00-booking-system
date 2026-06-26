import { useEffect, useState } from 'react'

export default function HeroShowcase({ slides = [] }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return undefined
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  if (!slides.length) return null

  return (
    <section className="landing-hero-section">
      <div className="landing-banner-shell">
        <div className="landing-banner-track">
          {slides.map((slide, index) => (
            <article
              key={slide.pcSrc}
              className={`landing-banner-slide ${index === activeIndex ? 'is-active' : ''}`}
              aria-hidden={index === activeIndex ? 'false' : 'true'}
            >
              <picture>
                <source media="(max-width: 960px)" srcSet={slide.mobileSrc} />
                <img src={slide.pcSrc} alt={slide.alt} className="landing-banner-image" />
              </picture>
            </article>
          ))}
        </div>

        <div className="landing-banner-dots" aria-label="배너 선택">
          {slides.map((slide, index) => (
            <button
              key={`${slide.alt}-${index}`}
              type="button"
              className={index === activeIndex ? 'is-active' : ''}
              onClick={() => setActiveIndex(index)}
              aria-label={`${index + 1}번 배너 보기`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
