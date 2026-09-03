import { Check } from 'lucide-react'
import { InvReveal } from './InvReveal'

const bullets = [
  'Client database with GSTIN, PAN, and billing address on file',
  'Smart auto-increment numbering — DL/01/YYYY-YY/XX format',
  'Line items with HSN/SAC codes and pre-structured GST tax rates',
  'Amount in words, bank details, and CA-firm templates built in',
]

export function OneClickSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <InvReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              One click away
            </p>
            <h2 className="inv-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              From blank page to GST-compliant invoice in minutes
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[#6b7280]">
              Select a client, add line items, and watch the live preview update as you type. No
              spreadsheet exports, no manual tax math — everything is structured for Indian
              compliance from the start.
            </p>
            <ul className="mt-8 space-y-3">
              {bullets.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d4af37]/15">
                    <Check className="h-3 w-3 text-[#d4af37]" aria-hidden />
                  </span>
                  <span className="text-sm leading-relaxed text-[#374151]">{item}</span>
                </li>
              ))}
            </ul>
          </InvReveal>

          <InvReveal delay={120}>
            <div className="inv-card rounded-2xl p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#6b7280]">
                New invoice
              </p>
              <div className="space-y-3">
                <div className="rounded-xl border border-[#e5e7eb] p-4">
                  <p className="text-[10px] font-medium uppercase text-[#6b7280]">Bill to</p>
                  <p className="mt-1 font-medium">Patel Trading Co.</p>
                  <p className="font-mono text-xs text-[#6b7280]">24AABCP1234F1Z5</p>
                </div>
                <div className="rounded-xl border border-[#e5e7eb] p-4">
                  <div className="mb-2 flex justify-between text-xs text-[#6b7280]">
                    <span>Description</span>
                    <span>Amount</span>
                  </div>
                  {[
                    { d: 'Monthly bookkeeping', a: '₹12,000' },
                    { d: 'GST return filing', a: '₹5,000' },
                    { d: 'Advisory — Q1 review', a: '₹8,000' },
                  ].map((row) => (
                    <div key={row.d} className="flex justify-between border-t border-[#f3f4f6] py-2 text-sm">
                      <span>{row.d}</span>
                      <span className="font-medium">{row.a}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#111827] px-4 py-3 text-white">
                  <span className="text-sm">Total incl. GST</span>
                  <span className="text-lg font-bold text-[#d4af37]">₹29,500</span>
                </div>
              </div>
            </div>
          </InvReveal>
        </div>
      </div>
    </section>
  )
}
