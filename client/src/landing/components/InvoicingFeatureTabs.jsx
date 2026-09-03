import { useState } from 'react'
import { FileText, Mail, RefreshCw, Eye } from 'lucide-react'
import { InvReveal } from './InvReveal'

const tabs = [
  {
    id: 'create',
    label: 'Create',
    icon: FileText,
    title: 'Structured invoice creation',
    description:
      'Pick a client from your database, add line items with HSN/SAC codes, and let smart numbering handle the rest. Auto-increment formats like DL/01/2025-26/07 keep your records audit-ready.',
    visual: (
      <div className="space-y-2 p-4">
        <div className="rounded-lg border border-[#e5e7eb] p-3">
          <p className="text-[10px] text-[#6b7280]">Invoice number</p>
          <p className="font-mono text-sm font-medium">DL/01/2025-26/08</p>
        </div>
        <div className="rounded-lg border border-[#e5e7eb] p-3">
          <p className="text-[10px] text-[#6b7280]">Client</p>
          <p className="text-sm font-medium">Gupta &amp; Sons LLP</p>
          <p className="font-mono text-[10px] text-[#6b7280]">09AAACG1234A1ZP</p>
        </div>
        <div className="rounded-lg bg-[#fffbeb] p-3 text-sm">+ Add line item</div>
      </div>
    ),
  },
  {
    id: 'preview',
    label: 'Preview & PDF',
    icon: Eye,
    title: 'Live preview as you type',
    description:
      'See exactly what your client will receive — tax breakdown, amount in words, bank details, and your firm branding. Export a polished PDF in one click.',
    visual: (
      <div className="p-4">
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <div className="mb-3 flex justify-between border-b border-[#e5e7eb] pb-2">
            <p className="inv-display text-sm font-semibold">TAX INVOICE</p>
            <span className="rounded bg-[#111827] px-2 py-0.5 text-[9px] text-[#d4af37]">PDF</span>
          </div>
          <div className="mb-2 h-2 w-full rounded bg-[#f3f4f6]">
            <div className="h-2 w-3/4 rounded bg-[#d4af37]" />
          </div>
          <p className="text-[10px] text-[#6b7280]">Rupees Twenty-Nine Thousand Five Hundred Only</p>
          <button type="button" className="mt-3 w-full rounded-lg bg-[#111827] py-2 text-xs font-medium text-[#d4af37]">
            Download PDF
          </button>
        </div>
      </div>
    ),
  },
  {
    id: 'email',
    label: 'Email & Track',
    icon: Mail,
    title: 'Send and track every invoice',
    description:
      'Email invoices with PDF attachments using professional templates. AI-assisted drafts speed up follow-ups. Track status from draft to sent to paid.',
    visual: (
      <div className="space-y-2 p-4">
        {[
          { inv: 'DL/01/2025-26/06', status: 'Paid', color: 'bg-green-100 text-green-700' },
          { inv: 'DL/01/2025-26/07', status: 'Sent', color: 'bg-blue-100 text-blue-700' },
          { inv: 'DL/01/2025-26/08', status: 'Draft', color: 'bg-gray-100 text-gray-600' },
        ].map((row) => (
          <div key={row.inv} className="flex items-center justify-between rounded-lg border border-[#e5e7eb] px-3 py-2">
            <span className="font-mono text-xs">{row.inv}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${row.color}`}>
              {row.status}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'recurring',
    label: 'Recurring',
    icon: RefreshCw,
    title: 'Recurring bills & subscriptions',
    description:
      'Monthly retainers, quarterly advisory fees, annual compliance packages — set the schedule once and let invoices generate automatically.',
    visual: (
      <div className="p-4">
        <div className="rounded-lg border border-[#d4af37]/30 bg-[#fffbeb]/50 p-4">
          <p className="text-sm font-medium">Monthly retainer — ABC Pvt Ltd</p>
          <p className="mt-1 text-xs text-[#6b7280]">₹25,000 + GST · Every 1st of month</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full bg-[#d4af37]/20 px-2 py-0.5 text-[10px] font-medium text-[#92700c]">
              Active
            </span>
            <span className="text-[10px] text-[#6b7280]">Next: 1 Jul 2025</span>
          </div>
        </div>
      </div>
    ),
  },
]

export function InvoicingFeatureTabs() {
  const [active, setActive] = useState(tabs[0].id)
  const current = tabs.find((t) => t.id === active) || tabs[0]

  return (
    <section id="inv-workflow" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <InvReveal className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
            End-to-end workflow
          </p>
          <h2 className="inv-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            From draft to PDF to client inbox
          </h2>
        </InvReveal>

        <InvReveal delay={100} className="mt-12">
          <div className="inv-card overflow-hidden rounded-2xl">
            <div
              className="flex overflow-x-auto border-b border-[#e5e7eb] bg-[#f9fafb]"
              role="tablist"
              aria-label="Invoice workflow steps"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = tab.id === active
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    id={`tab-${tab.id}`}
                    onClick={() => setActive(tab.id)}
                    className={`flex shrink-0 items-center gap-2 border-b-2 px-5 py-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] ${
                      isActive
                        ? 'border-[#d4af37] text-[#111827] bg-white'
                        : 'border-transparent text-[#6b7280] hover:text-[#111827]'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div
              key={active}
              id={`panel-${active}`}
              role="tabpanel"
              aria-labelledby={`tab-${active}`}
              className="inv-tab-panel grid lg:grid-cols-2"
            >
              <div className="border-b border-[#e5e7eb] p-6 lg:border-b-0 lg:border-r">
                <h3 className="text-xl font-semibold">{current.title}</h3>
                <p className="mt-3 leading-relaxed text-[#6b7280]">{current.description}</p>
              </div>
              <div className="bg-[#f9fafb]">{current.visual}</div>
            </div>
          </div>
        </InvReveal>
      </div>
    </section>
  )
}
