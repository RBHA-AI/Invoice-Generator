import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { InvReveal } from './InvReveal'

export function InvoicingCTA() {
  return (
    <section className="pb-24 pt-8 sm:pb-28 md:pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <InvReveal>
          <div className="relative overflow-hidden rounded-3xl bg-[#111827] px-8 py-14 text-center sm:px-14 sm:py-16">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 60% 80% at 30% 50%, rgba(212,175,55,0.15) 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 70% 50%, rgba(59,111,232,0.1) 0%, transparent 60%)',
              }}
              aria-hidden
            />
            <div className="relative">
              <h2 className="inv-display text-3xl font-bold text-white sm:text-4xl">
                Start invoicing now
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-lg text-white/60">
                GST-ready invoices, live preview, PDF export, and email delivery — all in one place.
              </p>
              <Link
                to="/login"
                className="inv-btn-primary mt-8 inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold no-underline"
              >
                Sign in to your workspace
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <p className="mt-4 text-sm text-white/40">invoice.invoicecreation.store</p>
            </div>
          </div>
        </InvReveal>
      </div>
    </section>
  )
}
