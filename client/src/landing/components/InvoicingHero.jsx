import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { InvoiceInteractiveDemo } from './InvoiceInteractiveDemo'
import { StatCounter } from './StatCounter'

const headlineParts = ['Create.', 'Preview.', 'Invoice sent.']

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function InvoicingHero() {
  const [visibleParts, setVisibleParts] = useState(() =>
    prefersReducedMotion() ? headlineParts.length : 0,
  )
  const mockupRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion()) return

    const timers = headlineParts.map((_, i) =>
      setTimeout(() => setVisibleParts(i + 1), 300 + i * 280),
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    const el = mockupRef.current
    if (!el || prefersReducedMotion()) return

    const onScroll = () => {
      el.style.transform = `translateY(${window.scrollY * 0.04}px)`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section className="inv-mesh relative overflow-hidden pt-28 pb-20 sm:pt-32 sm:pb-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p
              className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-[#d4af37] opacity-0 motion-safe:animate-[fadeIn_0.6s_ease_forwards]"
              style={{ animationDelay: '0.1s' }}
            >
              Invoice Creation
            </p>

            <h1 className="inv-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">
              {headlineParts.map((part, i) => (
                <span
                  key={part}
                  className="block transition-all duration-700 ease-out"
                  style={{
                    opacity: i < visibleParts ? 1 : 0,
                    transform: i < visibleParts ? 'translateY(0)' : 'translateY(20px)',
                  }}
                >
                  {part}
                </span>
              ))}
            </h1>

            <p
              className="mt-6 max-w-lg text-lg leading-relaxed text-[#6b7280] opacity-0 motion-safe:animate-[fadeIn_0.6s_ease_forwards]"
              style={{ animationDelay: '1s' }}
            >
              GST-ready invoicing built for CA firms. Create, preview, and send professional invoices
              in minutes — from draft to PDF to client inbox, one workflow.
            </p>

            <div
              className="mt-8 flex flex-col gap-3 opacity-0 motion-safe:animate-[fadeIn_0.6s_ease_forwards] sm:flex-row sm:items-center"
              style={{ animationDelay: '1.2s' }}
            >
              <Link
                to="/login"
                className="inv-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold no-underline"
              >
                Sign in
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href="#inv-features"
                className="inv-btn-outline inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold"
              >
                See features
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>

            <dl className="mt-12 grid grid-cols-3 gap-4 border-t border-[#e5e7eb] pt-8">
              <StatCounter target={18} suffix="%" label="GST-ready" />
              <StatCounter target={10} suffix="+" label="Multi-company" />
              <StatCounter target={1} suffix="-click" label="PDF export" highlight />
            </dl>
          </div>

          <div ref={mockupRef} className="inv-float will-change-transform">
            <InvoiceInteractiveDemo />
          </div>
        </div>
      </div>
    </section>
  )
}
