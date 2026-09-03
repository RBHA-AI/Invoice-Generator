import { Bell, Mail, TrendingUp } from 'lucide-react'
import { InvReveal } from './InvReveal'

const cards = [
  {
    icon: Mail,
    title: 'Email invoices directly',
    description:
      'Send PDF attachments with professional templates. AI-assisted drafts help you write clear, courteous payment requests.',
  },
  {
    icon: TrendingUp,
    title: 'Payment tracking built in',
    description:
      'Mark invoices as sent, viewed, or paid. Filter and search your entire invoice history — no separate spreadsheet needed.',
  },
  {
    icon: Bell,
    title: 'Recurring bills on autopilot',
    description:
      'Set up monthly retainers and subscription-style engagements. Auto-generate invoices on schedule for ongoing CA services.',
  },
]

export function GetPaidSection() {
  return (
    <section className="bg-[#111827] py-20 text-white sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <InvReveal className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
            Get paid faster
          </p>
          <h2 className="inv-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Send, track, and follow up — without leaving the app
          </h2>
          <p className="mt-4 text-lg text-white/60">
            From the moment you hit send to the day payment lands, every invoice status is visible.
            Your team always knows what is outstanding.
          </p>
        </InvReveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.icon
            return (
              <InvReveal key={card.title} delay={i * 80}>
                <article className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#d4af37]/20">
                    <Icon className="h-5 w-5 text-[#d4af37]" aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{card.description}</p>
                </article>
              </InvReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
