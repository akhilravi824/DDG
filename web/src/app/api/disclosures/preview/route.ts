import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { chromium } from 'playwright'

const TEMPLATE = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 0.5in; }
    body { font-family: 'Times New Roman', Times, serif; }
    .header { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    td { border: 1px solid #000; padding: 8px; vertical-align: top; }
    .col1 { width: 30%; }
    .col2 { width: 30%; }
    .col3 { width: 40%; font-size: 10pt; }
    .footer { margin-top: 18px; font-size: 10pt; }
    .sig { margin-top: 24px; font-size: 12pt; }
  </style>
</head>
<body>
  <div class="header">OFFER SUMMARY — {{product}}</div>
  <table>
    <tr>
      <td class="col1">Funding Provided</td>
      <td class="col2">${{amountFinanced}}</td>
      <td class="col3">This is how much funding {{financer}} will provide.</td>
    </tr>
    <tr>
      <td class="col1">{{aprLabel}}</td>
      <td class="col2">{{apr}}%</td>
      <td class="col3">APR is the cost of your financing expressed as a yearly rate. APR includes the amount and timing of the funding you receive, interest and fees you pay and the payments you make.</td>
    </tr>
    <tr>
      <td class="col1">Finance Charge</td>
      <td class="col2">${{financeCharge}}</td>
      <td class="col3">This is the dollar cost of your financing.</td>
    </tr>
    <tr>
      <td class="col1">Total Payment Amount</td>
      <td class="col2">${{totalOfPayments}}</td>
      <td class="col3">This is the total dollar amount of payments you will make during the term of the contract.</td>
    </tr>
    {{avgMonthlyCostRow}}
    <tr>
      <td class="col1">Term</td>
      <td class="col2">{{termDisplay}}</td>
      <td class="col3"></td>
    </tr>
    <tr>
      <td class="col1">Prepayment</td>
      <td class="col2" colspan="2">{{prepayText}}</td>
    </tr>
  </table>
  <div class="footer">Applicable law requires this information to be provided to you to help you make an informed decision.</div>
  {{sigBlock}}
</body>
</html>
`

function render(html: string, data: Record<string, string>) {
  return html
    .replace(/{{product}}/g, data.product)
    .replace(/{{financer}}/g, data.financer)
    .replace(/{{amountFinanced}}/g, Number(data.amountFinanced || '0').toFixed(2))
    .replace(/{{apr}}/g, Number(data.apr || '0').toFixed(2))
    .replace(/{{aprLabel}}/g, data.aprLabel)
    .replace(/{{financeCharge}}/g, Number(data.financeCharge || '0').toFixed(2))
    .replace(/{{totalOfPayments}}/g, Number(data.totalOfPayments || '0').toFixed(2))
    .replace(/{{termDisplay}}/g, data.termDisplay)
    .replace(/{{prepayText}}/g, data.prepayText)
    .replace(/{{sigBlock}}/g, data.sigBlock)
    .replace(/{{avgMonthlyCostRow}}/g, data.avgMonthlyCostRow)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      product = 'Closed-End',
      financer = 'Financer',
      amountFinanced = 0,
      apr = 0,
      aprIsEstimate = false,
      financeCharge = 0,
      totalOfPayments = 0,
      termDays = 365,
      termYears = 0,
      termMonths = 0,
      nonMonthly = false,
      avgMonthlyCost = 0,
      requiresSignature = false,
      prepaymentHasFees = false,
      maxNonInterestFee = 0
    } = body || {}

    const aprLabel = aprIsEstimate ? 'Estimated Annual Percentage Rate (APR)' : 'Annual Percentage Rate (APR)'

    const termDisplay = termDays && termYears === 0 && termMonths === 0
      ? `${termDays} days`
      : `${termYears} years ${termMonths} months`

    const prepayText = prepaymentHasFees
      ? `If you pay off the financing early, you will still need to pay all or a portion of the finance charge, up to $${Number(maxNonInterestFee || 0).toFixed(2)}.`
      : 'If you pay off the financing early, you will not need to pay any portion of the finance charge other than unpaid interest accrued (if applicable).'

    const sigBlock = requiresSignature
      ? '<div class="sig">Applicable law requires this information to be provided to you to help you make an informed decision. By signing below, you are confirming that you received this information.<br/><br/>Recipient Signature: _________________________ &nbsp;&nbsp; Date: _______________</div>'
      : ''

    const avgMonthlyCostRow = nonMonthly
      ? `<tr><td class="col1">Average Monthly Cost</td><td class="col2">$${Number(avgMonthlyCost || 0).toFixed(2)}</td><td class="col3">Although this financing does not have monthly payments, this is our calculation of your average monthly cost for comparison purposes.</td></tr>`
      : ''

    const html = render(TEMPLATE, {
      product: String(product),
      financer: String(financer),
      amountFinanced: String(amountFinanced),
      apr: String(apr),
      aprLabel,
      financeCharge: String(financeCharge),
      totalOfPayments: String(totalOfPayments),
      termDisplay,
      prepayText,
      sigBlock,
      avgMonthlyCostRow
    })

    const browser = await chromium.launch()
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' } })
    await browser.close()

    const filename = `disclosure-preview-${Date.now()}.pdf`
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to generate PDF' }, { status: 400 })
  }
}
