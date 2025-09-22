import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { supabase } from '@/lib/supabase';

// CA Commercial Financing Disclosure template (minimal)
const CA_DISCLOSURE_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman:wght@400;700&display=swap');
    body { font-family: 'Times New Roman', serif; margin: 20px; }
    .header { font-size: 16px; font-weight: bold; margin-bottom: 20px; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .table td { border: 1px solid #000; padding: 8px; vertical-align: top; }
    .col1 { width: 30%; }
    .col2 { width: 30%; }
    .col3 { width: 40%; }
    .footer { font-size: 10px; margin-top: 20px; }
    .signature-block { margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">OFFER SUMMARY — {{productType}}</div>
  
  <table class="table">
    <tr>
      <td class="col1">Amount Financed</td>
      <td class="col2">${{amountFinanced}}</td>
      <td class="col3">The dollar amount the creditor is advancing to you or on your behalf.</td>
    </tr>
    <tr>
      <td class="col1">Annual Percentage Rate</td>
      <td class="col2">{{apr}}%</td>
      <td class="col3">The cost of your credit as a yearly rate.</td>
    </tr>
    <tr>
      <td class="col1">Finance Charge</td>
      <td class="col2">${{financeCharge}}</td>
      <td class="col3">The dollar amount the credit will cost you.</td>
    </tr>
    <tr>
      <td class="col1">Total of Payments</td>
      <td class="col2">${{totalOfPayments}}</td>
      <td class="col3">The amount you will have paid after you have made all scheduled payments.</td>
    </tr>
    {{#if hasPrepayment}}
    <tr>
      <td class="col1">Prepayment</td>
      <td class="col2">-</td>
      <td class="col3">You have the right to pay off all or part of your loan early. If you do, you may be entitled to a partial refund of the finance charge.</td>
    </tr>
    {{/if}}
  </table>
  
  <div class="footer">
    <p>Applicable law: California Commercial Financing Disclosure Law</p>
    {{#if requiresSignature}}
    <div class="signature-block">
      <p>Signature: _________________________ Date: _______________</p>
    </div>
    {{/if}}
  </div>
</body>
</html>
`;

function renderTemplate(template: string, data: any): string {
  return template
    .replace(/{{productType}}/g, data.productType || 'Commercial Financing')
    .replace(/{{amountFinanced}}/g, data.amountFinanced?.toFixed(2) || '0.00')
    .replace(/{{apr}}/g, data.apr?.toFixed(2) || '0.00')
    .replace(/{{financeCharge}}/g, data.financeCharge?.toFixed(2) || '0.00')
    .replace(/{{totalOfPayments}}/g, data.totalOfPayments?.toFixed(2) || '0.00')
    .replace(/{{#if hasPrepayment}}[\s\S]*?{{\/if}}/g, data.hasPrepayment ? '<tr><td class="col1">Prepayment</td><td class="col2">-</td><td class="col3">You have the right to pay off all or part of your loan early. If you do, you may be entitled to a partial refund of the finance charge.</td></tr>' : '');
}

export async function POST(req: NextRequest) {
  try {
    const { offerId, productType, amountFinanced, apr, financeCharge, totalOfPayments, hasPrepayment, requiresSignature } = await req.json();
    
    // Render HTML template
    const html = renderTemplate(CA_DISCLOSURE_TEMPLATE, {
      productType,
      amountFinanced,
      apr,
      financeCharge,
      totalOfPayments,
      hasPrepayment,
      requiresSignature
    });
    
    // Generate PDF with Playwright
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
    });
    await browser.close();
    
    // Upload to Supabase Storage
    const fileName = `disclosure-${offerId}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('disclosures')
      .upload(fileName, pdf, { contentType: 'application/pdf' });
    
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
    
    // Get signed URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from('disclosures')
      .createSignedUrl(fileName, 3600); // 1 hour
    
    if (urlError) throw new Error(`URL generation failed: ${urlError.message}`);
    
    // Save disclosure record
    const { data: disclosureData, error: disclosureError } = await supabase
      .from('disclosures')
      .insert({
        offer_id: offerId,
        pdf_url: uploadData.path,
        html_snapshot: html,
        footer_type: requiresSignature ? 'signature_block' : 'plain'
      })
      .select()
      .single();
    
    if (disclosureError) throw new Error(`Database insert failed: ${disclosureError.message}`);
    
    return NextResponse.json({
      ok: true,
      data: {
        disclosureId: disclosureData.id,
        pdfUrl: urlData.signedUrl,
        fileName: uploadData.path
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message || 'PDF generation failed'
    }, { status: 500 });
  }
}
