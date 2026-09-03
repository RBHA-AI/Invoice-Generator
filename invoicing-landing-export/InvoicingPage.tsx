import { usePageMeta } from './hooks/usePageMeta'
import { InvoicingHero } from './components/InvoicingHero'
import { OneClickSection } from './components/OneClickSection'
import { GetPaidSection } from './components/GetPaidSection'
import { InvoicingFeatureTabs } from './components/InvoicingFeatureTabs'
import { InvoicingFeatureGrid } from './components/InvoicingFeatureGrid'
import { ComplianceBand } from './components/ComplianceBand'
import { InvoicingTrust } from './components/InvoicingTrust'
import { InvoicingCTA } from './components/InvoicingCTA'
import './invoicing.css'

/**
 * Standalone Invoice Creation marketing / landing page.
 * All "Launch App" CTAs point to https://invoice.invoicecreation.store
 * — change APP_URL in InvoicingHero.tsx and InvoicingCTA.tsx if needed
 * when this IS the app domain (e.g. point to /login or /app).
 */
export function InvoicingPage() {
  usePageMeta({
    title: 'Invoice Creation — GST-Ready Invoicing for CA Firms',
    description:
      'Create, preview, and send GST-compliant professional invoices in minutes. Built for CA firms and Indian SMBs by R Bhargava & Associates.',
    ogTitle: 'Invoice Creation — GST-Ready Invoicing',
  })

  return (
    <div className="invoicing-page">
      <InvoicingHero />
      <OneClickSection />
      <GetPaidSection />
      <InvoicingFeatureGrid />
      <InvoicingFeatureTabs />
      <ComplianceBand />
      <InvoicingTrust />
      <InvoicingCTA />
    </div>
  )
}

export default InvoicingPage
