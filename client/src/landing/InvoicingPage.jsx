import { usePageMeta } from './hooks/usePageMeta'
import { LandingHeader } from './components/LandingHeader'
import { InvoicingHero } from './components/InvoicingHero'
import { OneClickSection } from './components/OneClickSection'
import { GetPaidSection } from './components/GetPaidSection'
import { InvoicingFeatureTabs } from './components/InvoicingFeatureTabs'
import { InvoicingFeatureGrid } from './components/InvoicingFeatureGrid'
import { ComplianceBand } from './components/ComplianceBand'
import { InvoicingTrust } from './components/InvoicingTrust'
import { InvoicingCTA } from './components/InvoicingCTA'
import './landing-tailwind.css'
import './invoicing.css'

/**
 * Public marketing / landing page for Invoice Creation.
 * Login CTAs go to /login — auth and invoice data are unchanged.
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
      <LandingHeader />
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
