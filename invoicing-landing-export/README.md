# Invoice Creation — Landing Page Export

Self-contained marketing/landing page for **Invoice Creation** (by R Bhargava & Associates).  
Extracted from the company marketing site for integration into the invoicing app.

**No dependency on FinAxis portal pages.** Drop this folder into your invoice app and wire the route.

## Contents

```
invoicing-landing-export/
├── InvoicingPage.tsx          # Main page (default export)
├── invoicing.css              # Scoped styles (.invoicing-page)
├── components/                # All section UI
│   ├── InvoicingHero.tsx
│   ├── InvoiceInteractiveDemo.tsx
│   ├── OneClickSection.tsx
│   ├── GetPaidSection.tsx
│   ├── InvoicingFeatureGrid.tsx
│   ├── InvoicingFeatureTabs.tsx
│   ├── ComplianceBand.tsx
│   ├── InvoicingTrust.tsx
│   ├── InvoicingCTA.tsx
│   ├── InvReveal.tsx
│   └── StatCounter.tsx
├── hooks/
│   ├── useInView.ts
│   ├── useCountUp.ts
│   └── usePageMeta.ts
└── README.md
```

## Dependencies (must already exist in the target app, or install)

| Package | Used for |
|---------|----------|
| `react` | UI |
| `lucide-react` | Icons |
| Tailwind CSS | Utility classes (v3 or v4) |

No `react-router` required for this export (breadcrumb removed for standalone use).

## Fonts

Load in your app's HTML / layout:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap"
  rel="stylesheet"
/>
```

## Brand tokens (in `invoicing.css`)

- Navy: `#111827`
- Gold: `#d4af37`
- Background: `#f3f4f6`

## Integration (typical React app)

1. Copy this folder into your app, e.g. `src/landing/` or `src/pages/marketing/`.
2. Import the page and mount it on `/` (or `/welcome`):

```tsx
import InvoicingPage from './landing/InvoicingPage'
// or: import { InvoicingPage } from './landing/InvoicingPage'

// Example route
<Route path="/" element={<InvoicingPage />} />
```

3. Ensure Tailwind scans this folder (`content` / `@source` includes `./src/landing/**/*.{ts,tsx}`).
4. **CTA URLs:** Hero + final CTA currently open  
   `https://invoice.invoicecreation.store`  
   If this page *is* that domain, change `APP_URL` in:
   - `components/InvoicingHero.tsx`
   - `components/InvoicingCTA.tsx`  
   to your in-app path (e.g. `/login` or `/dashboard`).

## Notes

- Styles are scoped under `.invoicing-page` — should not clash with the rest of your app if you wrap only this page.
- Respects `prefers-reduced-motion`.
- Interactive demo is frontend-only (typing + GST split mock) — no backend.
