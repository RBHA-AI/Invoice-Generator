import { InvReveal } from './InvReveal'

const items = [
  { label: 'GSTIN on every invoice', detail: 'Client and firm GSTIN fields with validation' },
  { label: 'HSN / SAC codes', detail: 'Structured line items for goods and services' },
  { label: 'CGST · SGST · IGST', detail: 'Automatic split based on place of supply' },
  { label: 'Amount in words', detail: 'Rupees written out on every PDF' },
  { label: 'Bank details', detail: 'Account, IFSC, and UPI on professional templates' },
  { label: 'CA-firm templates', detail: 'Layouts designed for chartered accountancy practices' },
]

export function ComplianceBand() {
  return (
    <section id="inv-compliance" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#111827] px-8 py-14 sm:px-14 sm:py-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            aria-hidden
            style={{
              background:
                'radial-gradient(circle at 20% 50%, #d4af37 0%, transparent 50%), radial-gradient(circle at 80% 50%, #3b6fe8 0%, transparent 50%)',
            }}
          />

          <InvReveal className="relative text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              Built for Indian compliance
            </p>
            <h2 className="inv-display mt-3 text-3xl font-bold text-white sm:text-4xl">
              Invoices that pass scrutiny — GSTIN to amount in words
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
              Every field your clients and the tax department expect, structured correctly from the
              first line item.
            </p>
          </InvReveal>

          <div className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <InvReveal key={item.label} delay={i * 50}>
                <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <h3 className="font-semibold text-[#d4af37]">{item.label}</h3>
                  <p className="mt-1 text-sm text-white/60">{item.detail}</p>
                </div>
              </InvReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
