import { InvReveal } from './InvReveal'

export function InvoicingTrust() {
  return (
    <section className="border-t border-[#e5e7eb] bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <InvReveal>
          <blockquote className="inv-card rounded-2xl p-8 sm:p-10">
            <p className="inv-display text-xl leading-relaxed text-[#111827] sm:text-2xl">
              &ldquo;We moved from Word templates to Invoice Creation in a week. GST calculations are
              always correct, numbering is consistent, and clients receive PDFs that look like they
              came from a proper firm — not a freelancer&apos;s laptop.&rdquo;
            </p>
            <footer className="mt-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#111827] text-sm font-bold text-[#d4af37]">
                AM
              </div>
              <div>
                <cite className="not-italic font-semibold text-[#111827]">Amit Malhotra</cite>
                <p className="text-sm text-[#6b7280]">Partner, Malhotra &amp; Co., New Delhi</p>
              </div>
            </footer>
          </blockquote>

          <p className="mt-8 text-center text-sm font-medium text-[#6b7280]">
            Built by{' '}
            <span className="text-[#111827]">R Bhargava &amp; Associates</span>
            {' '}— Chartered Accountants who invoice clients every day
          </p>
        </InvReveal>
      </div>
    </section>
  )
}
