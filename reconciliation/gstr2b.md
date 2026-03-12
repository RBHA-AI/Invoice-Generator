> ## Documentation Index
> Fetch the complete documentation index at: https://developer.sandbox.co.in/llms.txt
> Use this file to discover all available pages before exploring further.

# Overview

> Learn how to automate GSTR-2B reconciliation with purchase ledgers using the GST Analytics API.

## What is GSTR-2B

When suppliers file GSTR-1, their sales data gets reflected in recipients' GSTR-2B as their purchases, which is a static auto-generated form showing the eligible ITC.

## What is GSTR-2B Reconciliation?

For GST registered businesses, filing accurate returns is essential to claim the right Input Tax Credit (ITC). GSTR-2B Reconciliation is matching the purchase ledgers of the recipient business with the GSTR-2B to identify discrepancies.

### Why GSTR-2B Reconciliation is important?

Ideally, if every business reports their sales accurately, discrepancies would not arise between the GSTR-2B and purchase ledgers. However, there are multiple factors into play like late reporting, misreporting, returns and refunds etc. which lead to discrepancies frequently. This leads to mismatches, unclaimed ITC, and compliance issues making GSTR-2B reconciliation extremely important.

## How to automate reconciliation?

GSTR-2B Reconciliation API enables businesses to reconcile their purchase ledger with the GSTR-2B in simple steps:

<Steps>
  <Step title="Submit Reconciliation Job" stepNumber={1} titleSize="h4">
    Post a [Reconcile GSTR-2B Job](/api-reference/gst/analytics/endpoints/gstr-2b-reconciliation/submit_job) to create a reconciliation job and receive signed URLs for file uploads.
  </Step>

  <Step title="Upload Files" stepNumber={2} titleSize="h4">
    Upload GSTR-2B and Purchase Ledger sheet JSON files to the provided signed URLs.
  </Step>

  <Step title="Check Job Status" stepNumber={3} titleSize="h4">
    Poll the [Reconcile GSTR-2B Job Status](/api-reference/gst/analytics/endpoints/gstr-2b-reconciliation/poll_job) to monitor the reconciliation progress.
  </Step>

  <Step title="Download Report" stepNumber={4} titleSize="h4">
    Once the job is completed successfully, download the reconciliation report from the job status response.
  </Step>
</Steps>
