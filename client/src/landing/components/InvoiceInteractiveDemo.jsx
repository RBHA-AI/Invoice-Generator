import { useEffect, useState } from 'react'

const DESCRIPTION = 'GST consultancy — Q1 FY25'
const RATE = 15000
const QTY = 1
const GST_RATE = 18

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function InvoiceInteractiveDemo() {
  const [typed, setTyped] = useState(() => (prefersReducedMotion() ? DESCRIPTION : ''))
  const [showTotals, setShowTotals] = useState(() => prefersReducedMotion())

  useEffect(() => {
    if (prefersReducedMotion()) return

    let i = 0
    const typeInterval = setInterval(() => {
      i++
      setTyped(DESCRIPTION.slice(0, i))
      if (i >= DESCRIPTION.length) {
        clearInterval(typeInterval)
        setTimeout(() => setShowTotals(true), 400)
      }
    }, 55)

    return () => clearInterval(typeInterval)
  }, [])

  const subtotal = RATE * QTY
  const cgst = (subtotal * GST_RATE) / 100 / 2
  const sgst = cgst
  const total = subtotal + cgst + sgst

  const format = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="inv-card overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-400/80" />
          <span className="h-2 w-2 rounded-full bg-amber-400/80" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
        </div>
        <span className="mx-auto text-[10px] text-[#6b7280] font-mono">invoice.invoicecreation.store</span>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-[#e5e7eb] p-4 lg:border-b-0 lg:border-r">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#6b7280]">
            Invoice editor
          </p>
          <div className="mb-3 rounded-lg border border-[#e5e7eb] bg-white p-3">
            <p className="text-[10px] text-[#6b7280]">Client</p>
            <p className="text-sm font-medium">Sharma Enterprises Pvt Ltd</p>
            <p className="font-mono text-[10px] text-[#6b7280]">07AABCS1429B1ZV</p>
          </div>
          <div className="rounded-lg border border-[#d4af37]/40 bg-[#fffbeb]/50 p-3">
            <p className="mb-1 text-[10px] font-medium text-[#6b7280]">Line item description</p>
            <p className="text-sm">
              {typed}
              {typed.length < DESCRIPTION.length && <span className="inv-caret" />}
            </p>
            <div className="mt-2 flex gap-3 text-[10px] text-[#6b7280]">
              <span>Qty: {QTY}</span>
              <span>Rate: {format(RATE)}</span>
              <span>GST: {GST_RATE}%</span>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-[#6b7280]">Invoice no. DL/01/2025-26/07</p>
        </div>

        <div className="bg-white p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#6b7280]">
            Live preview
          </p>
          <div className="rounded-lg border border-[#e5e7eb] p-3">
            <div className="mb-3 flex items-start justify-between border-b border-[#e5e7eb] pb-2">
              <div>
                <p className="inv-display text-sm font-semibold">R Bhargava &amp; Associates</p>
                <p className="text-[9px] text-[#6b7280]">Chartered Accountants</p>
              </div>
              <span className="rounded bg-[#111827] px-2 py-0.5 text-[9px] font-medium text-[#d4af37]">
                TAX INVOICE
              </span>
            </div>
            <table className="mb-2 w-full text-[10px]">
              <thead>
                <tr className="border-b border-[#e5e7eb] text-left text-[#6b7280]">
                  <th className="pb-1">Description</th>
                  <th className="pb-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1">{typed || '—'}</td>
                  <td className="py-1 text-right">{showTotals ? format(subtotal) : '—'}</td>
                </tr>
              </tbody>
            </table>
            <div
              className={`space-y-0.5 text-[10px] transition-opacity duration-500 ${
                showTotals ? 'opacity-100' : 'opacity-30'
              }`}
            >
              <div className="flex justify-between text-[#6b7280]">
                <span>CGST @ 9%</span>
                <span>{format(cgst)}</span>
              </div>
              <div className="flex justify-between text-[#6b7280]">
                <span>SGST @ 9%</span>
                <span>{format(sgst)}</span>
              </div>
              <div className="flex justify-between border-t border-[#e5e7eb] pt-1 font-semibold">
                <span>Total</span>
                <span className="text-[#d4af37]">{format(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
