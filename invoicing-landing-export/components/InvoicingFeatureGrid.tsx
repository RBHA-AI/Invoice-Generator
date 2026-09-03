import {
  Building2,
  Calculator,
  Download,
  Eye,
  FileSpreadsheet,
  Mail,
  RefreshCw,
  Users,
} from 'lucide-react'
import { InvReveal } from './InvReveal'

const features = [
  {
    icon: Calculator,
    title: 'GST-compliant calculations',
    description: 'CGST, SGST, and IGST computed automatically based on place of supply and tax rates.',
  },
  {
    icon: Eye,
    title: 'Live preview',
    description: 'Watch your invoice update in real time as you edit line items, taxes, and client details.',
  },
  {
    icon: Download,
    title: 'Professional PDF export',
    description: 'One-click PDF with your firm branding, bank details, and amount in words.',
  },
  {
    icon: Mail,
    title: 'Email with templates',
    description: 'Send PDF attachments with reusable templates and AI-assisted draft messages.',
  },
  {
    icon: RefreshCw,
    title: 'Recurring invoices',
    description: 'Automate monthly retainers and subscription-style billing for ongoing engagements.',
  },
  {
    icon: Building2,
    title: 'Multi-company support',
    description: 'Manage invoices across multiple entities with isolated workspaces per customer.',
  },
  {
    icon: Users,
    title: 'Client database',
    description: 'Store GSTIN, PAN, billing addresses, and contact details for every client.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel export & search',
    description: 'Filter, search, and export your invoice history for reporting and reconciliation.',
  },
]

export function InvoicingFeatureGrid() {
  return (
    <section id="inv-features" className="border-y border-[#e5e7eb] bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <InvReveal className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
            All the features, done right
          </p>
          <h2 className="inv-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a CA firm needs to invoice with confidence
          </h2>
          <p className="mt-4 text-lg text-[#6b7280]">
            No bloated ERP modules. Just the invoicing workflow Indian accountants actually use —
            GST-ready from day one.
          </p>
        </InvReveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <InvReveal key={feature.title} delay={(i % 4) * 60}>
                <article className="group h-full rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5 transition-all hover:border-[#d4af37]/40 hover:bg-white hover:shadow-md">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#111827] transition-colors group-hover:bg-[#d4af37]">
                    <Icon className="h-5 w-5 text-[#d4af37] group-hover:text-[#111827]" aria-hidden />
                  </div>
                  <h3 className="text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">{feature.description}</p>
                </article>
              </InvReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
