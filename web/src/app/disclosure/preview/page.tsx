'use client'
import { useState } from 'react'

export default function DisclosurePreviewPage(){
  const [product, setProduct] = useState('Closed-End')
  const [financer, setFinancer] = useState('Financer')
  const [amountFinanced, setAF] = useState('975')
  const [apr, setApr] = useState('27.48')
  const [aprIsEstimate, setAprIsEstimate] = useState(false)
  const [financeCharge, setFC] = useState('45')
  const [totalOfPayments, setTOP] = useState('1020')
  const [termDays, setTermDays] = useState('0')
  const [termYears, setTermYears] = useState('0')
  const [termMonths, setTermMonths] = useState('3')
  const [nonMonthly, setNonMonthly] = useState(false)
  const [avgMonthlyCost, setAvgMonthlyCost] = useState('0')
  const [requiresSignature, setRequiresSignature] = useState(true)
  const [prepaymentHasFees, setPrepayFees] = useState(false)
  const [maxNonInterestFee, setMaxNonInterestFee] = useState('0')

  async function generate(){
    const payload = {
      product, financer,
      amountFinanced: Number(amountFinanced)||0,
      apr: Number(apr)||0,
      aprIsEstimate,
      financeCharge: Number(financeCharge)||0,
      totalOfPayments: Number(totalOfPayments)||0,
      termDays: Number(termDays)||0,
      termYears: Number(termYears)||0,
      termMonths: Number(termMonths)||0,
      nonMonthly,
      avgMonthlyCost: Number(avgMonthlyCost)||0,
      requiresSignature,
      prepaymentHasFees,
      maxNonInterestFee: Number(maxNonInterestFee)||0
    }
    const res = await fetch('/api/disclosures/preview', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    if(!res.ok){ const j=await res.json().catch(()=>({})); alert(j?.error || 'Failed to generate PDF'); return; }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'disclosure-preview.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Disclosure Preview (Local)</h1>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-sm">Product</span>
          <select className="border rounded px-2 py-1 w-full" value={product} onChange={e=>setProduct(e.target.value)}>
            <option>Closed-End</option>
            <option>Open-End</option>
            <option>Sales-Based</option>
            <option>Lease</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm">Financer Name</span>
          <input className="border rounded px-2 py-1 w-full" value={financer} onChange={e=>setFinancer(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Amount Financed</span>
          <input className="border rounded px-2 py-1 w-full" value={amountFinanced} onChange={e=>setAF(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">APR (%)</span>
          <input className="border rounded px-2 py-1 w-full" value={apr} onChange={e=>setApr(e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={aprIsEstimate} onChange={e=>setAprIsEstimate(e.target.checked)} />
          <span className="text-sm">APR is estimate</span>
        </label>
        <div />
        <label className="space-y-1">
          <span className="text-sm">Finance Charge</span>
          <input className="border rounded px-2 py-1 w-full" value={financeCharge} onChange={e=>setFC(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Total of Payments</span>
          <input className="border rounded px-2 py-1 w-full" value={totalOfPayments} onChange={e=>setTOP(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Term (days)</span>
          <input className="border rounded px-2 py-1 w-full" value={termDays} onChange={e=>setTermDays(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-sm">Term (years)</span>
            <input className="border rounded px-2 py-1 w-full" value={termYears} onChange={e=>setTermYears(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Term (months)</span>
            <input className="border rounded px-2 py-1 w-full" value={termMonths} onChange={e=>setTermMonths(e.target.value)} />
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={nonMonthly} onChange={e=>setNonMonthly(e.target.checked)} />
          <span className="text-sm">Non-monthly payments (show Average Monthly Cost)</span>
        </label>
        <label className="space-y-1">
          <span className="text-sm">Average Monthly Cost (if non-monthly)</span>
          <input className="border rounded px-2 py-1 w-full" value={avgMonthlyCost} onChange={e=>setAvgMonthlyCost(e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={requiresSignature} onChange={e=>setRequiresSignature(e.target.checked)} />
          <span className="text-sm">Include signature block</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={prepaymentHasFees} onChange={e=>setPrepayFees(e.target.checked)} />
          <span className="text-sm">Prepayment has non-interest fees</span>
        </label>
        <label className="space-y-1">
          <span className="text-sm">Max non-interest fee (if any)</span>
          <input className="border rounded px-2 py-1 w-full" value={maxNonInterestFee} onChange={e=>setMaxNonInterestFee(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-3">
        <button className="bg-black text-white px-4 py-2 rounded" onClick={generate}>Generate PDF</button>
      </div>
    </main>
  )
}
