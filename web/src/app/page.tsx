'use client'
import { useMemo, useState } from 'react'

type Frequency = 'Monthly' | 'Multiples of a Month' | 'Semi-Monthly' | 'Actual Days'

interface PaymentStreamForm {
  amount: string
  count: string
  unitPeriods: string // number of unit periods between payments (e.g., 1 for monthly, 3 for quarterly)
  oddDays: string // remaining days fraction at first period
}

interface CalcResult {
  aprPercent: number
  periodicRate: number
}

export default function APRWizard() {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)

  // Step 0 - Account Information (placeholder to mirror FFIEC flow)
  const [preparedBy, setPreparedBy] = useState('')
  const [lenderName, setLenderName] = useState('')
  const [borrowerName, setBorrowerName] = useState('')

  // Step 1 - Loan Information
  const [amountFinanced, setAmountFinanced] = useState('975')
  const [disclosedApr, setDisclosedApr] = useState('')
  const [disclosedFc, setDisclosedFc] = useState('')
  const [disclosedTop, setDisclosedTop] = useState('')
  const [loanType, setLoanType] = useState<'Installment Loan' | 'Single Advance/Single Payment'>('Installment Loan')
  const [frequency, setFrequency] = useState<Frequency>('Monthly')
  const [monthsPerUnit, setMonthsPerUnit] = useState('1') // for Multiples of a Month
  const [daysInUnit, setDaysInUnit] = useState('30') // for Actual Days

  // Step 2 - Payment Schedule
  const [streams, setStreams] = useState<PaymentStreamForm[]>([
    { amount: '340', count: '3', unitPeriods: '1', oddDays: '0' }
  ])

  // Computed helper totals
  const scheduleTotalPayments = useMemo(() => {
    return streams.reduce((s, st) => s + (Number(st.amount) || 0) * (Number(st.count) || 0), 0)
  }, [streams])

  // Build cashflows from streams for APR API
  function buildCashflows() {
    const cashflows: { amount: number; t: number; f: number }[] = []
    for (const st of streams) {
      const amt = Number(st.amount) || 0
      const cnt = Math.max(0, Math.floor(Number(st.count) || 0))
      const up = Math.max(1, Math.floor(Number(st.unitPeriods) || 1))
      const odd = Math.max(0, Number(st.oddDays) || 0)

      for (let k = 1; k <= cnt; k++) {
        const t = up * k
        let f = 0
        if (k === 1) {
          if (frequency === 'Monthly' || frequency === 'Multiples of a Month' || frequency === 'Semi-Monthly') {
            const denom = 30 // Appendix J: each month = 30 days
            f = Math.min(0.9999999999, Math.max(0, odd / denom))
          } else if (frequency === 'Actual Days') {
            const denom = Math.max(1, Number(daysInUnit) || 1)
            f = Math.min(0.9999999999, Math.max(0, odd / denom))
          }
        }
        cashflows.push({ amount: amt, t, f })
      }
    }
    return cashflows
  }

  async function computeAPR(): Promise<CalcResult> {
    // unitsPerYear per frequency selection (simplified per Appendix J):
    let unitsPerYear = 12
    if (frequency === 'Multiples of a Month') {
      const m = Math.max(1, Number(monthsPerUnit) || 1)
      unitsPerYear = Math.max(1, Math.floor(12 / m))
    } else if (frequency === 'Semi-Monthly') {
      unitsPerYear = 24
    } else if (frequency === 'Actual Days') {
      const d = Math.max(1, Number(daysInUnit) || 1)
      unitsPerYear = Math.floor(365 / d)
      if (!Number.isFinite(unitsPerYear) || unitsPerYear <= 0) unitsPerYear = 365
    }

    const advances = [{ amount: Number(amountFinanced) || 0, t: 0, f: 0 }]
    const payments = buildCashflows()

    const res = await fetch('/api/calc/apr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitsPerYear, roundingBps: 10, advances, payments })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || `APR API error ${res.status}`)
    }
    const json = await res.json()
    return { aprPercent: json.data.aprPercent as number, periodicRate: json.data.periodicRate as number }
  }

  const [loading, setLoading] = useState(false)
  const [calc, setCalc] = useState<CalcResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit() {
    setLoading(true)
    setError(null)
    setCalc(null)
    try {
      const out = await computeAPR()
      setCalc(out)
      setStep(3)
    } catch (e: any) {
      setError(e?.message || 'Failed to compute APR')
    } finally {
      setLoading(false)
    }
  }

  // Local disclosure math
  const AF = Number(amountFinanced) || 0
  const TOP = scheduleTotalPayments
  const FC = Math.max(0, TOP - AF)

  const disclosedAPRnum = disclosedApr ? Number(disclosedApr) : undefined
  const disclosedFCnum = disclosedFc ? Number(disclosedFc) : undefined
  const disclosedTOPnum = disclosedTop ? Number(disclosedTop) : undefined

  const isRegularLoan = loanType === 'Installment Loan' && streams.length <= 3
  const aprTol = isRegularLoan ? 0.125 : 0.25

  function Titled({ children }: { children: React.ReactNode }) {
    return <h2 className="text-lg font-semibold">{children}</h2>
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">APR Tool (Local Preview)</h1>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {['Account Information', 'Loan Information', 'Payment Schedule', 'Results'].map((label, idx) => (
          <div key={label} className="flex items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${step === idx ? 'bg-black' : 'bg-gray-400'}`}>{idx + 1}</div>
            <span className="ml-2 mr-4">{label}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <section className="space-y-4">
          <Titled>Account Information</Titled>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm">Prepared By</span>
              <input className="border rounded px-2 py-1 w-full" value={preparedBy} onChange={e=>setPreparedBy(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Lender Name</span>
              <input className="border rounded px-2 py-1 w-full" value={lenderName} onChange={e=>setLenderName(e.target.value)} />
            </label>
            <label className="space-y-1 col-span-2">
              <span className="text-sm">Borrower Name</span>
              <input className="border rounded px-2 py-1 w-full" value={borrowerName} onChange={e=>setBorrowerName(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-3">
            <button className="bg-black text-white px-4 py-2 rounded" onClick={()=>setStep(1)}>Continue</button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4">
          <Titled>Loan Information</Titled>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm">Amount Financed</span>
              <input className="border rounded px-2 py-1 w-full" value={amountFinanced} onChange={e=>setAmountFinanced(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Loan Type</span>
              <select className="border rounded px-2 py-1 w-full" value={loanType} onChange={e=>setLoanType(e.target.value as any)}>
                <option>Installment Loan</option>
                <option>Single Advance/Single Payment</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm">Payment Frequency</span>
              <select className="border rounded px-2 py-1 w-full" value={frequency} onChange={e=>setFrequency(e.target.value as Frequency)}>
                <option>Monthly</option>
                <option>Multiples of a Month</option>
                <option>Semi-Monthly</option>
                <option>Actual Days</option>
              </select>
            </label>
            {frequency === 'Multiples of a Month' && (
              <label className="space-y-1">
                <span className="text-sm">Months per Unit Period</span>
                <input className="border rounded px-2 py-1 w-full" value={monthsPerUnit} onChange={e=>setMonthsPerUnit(e.target.value)} />
              </label>
            )}
            {frequency === 'Actual Days' && (
              <label className="space-y-1">
                <span className="text-sm">Days in Unit Period</span>
                <input className="border rounded px-2 py-1 w-full" value={daysInUnit} onChange={e=>setDaysInUnit(e.target.value)} />
              </label>
            )}
            <label className="space-y-1">
              <span className="text-sm">Disclosed (or estimated) APR</span>
              <input className="border rounded px-2 py-1 w-full" value={disclosedApr} onChange={e=>setDisclosedApr(e.target.value)} placeholder="optional" />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Disclosed Finance Charge</span>
              <input className="border rounded px-2 py-1 w-full" value={disclosedFc} onChange={e=>setDisclosedFc(e.target.value)} placeholder="optional" />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Disclosed Total Of Payments</span>
              <input className="border rounded px-2 py-1 w-full" value={disclosedTop} onChange={e=>setDisclosedTop(e.target.value)} placeholder="optional" />
            </label>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded border" onClick={()=>setStep(0)}>Back</button>
            <button className="bg-black text-white px-4 py-2 rounded" onClick={()=>setStep(2)}>Continue</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <Titled>Payment Schedule</Titled>
          <div className="space-y-2">
            {streams.map((st, idx) => (
              <div key={idx} className="grid grid-cols-5 gap-3 items-end">
                <label className="space-y-1">
                  <span className="text-sm">Payment Amount</span>
                  <input className="border rounded px-2 py-1 w-full" value={st.amount} onChange={e=>updateStream(idx,{ amount: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm">Number of Payments</span>
                  <input className="border rounded px-2 py-1 w-full" value={st.count} onChange={e=>updateStream(idx,{ count: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm">Unit Periods</span>
                  <input className="border rounded px-2 py-1 w-full" value={st.unitPeriods} onChange={e=>updateStream(idx,{ unitPeriods: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm">Odd Days (first period)</span>
                  <input className="border rounded px-2 py-1 w-full" value={st.oddDays} onChange={e=>updateStream(idx,{ oddDays: e.target.value })} />
                </label>
                <button className="px-3 py-2 border rounded" onClick={()=>removeStream(idx)}>Remove</button>
              </div>
            ))}
            <div className="flex gap-3">
              <button className="px-3 py-2 border rounded" onClick={()=>addStream()}>Add Stream</button>
              <div className="ml-auto text-sm">Total of Payments (schedule): <b>${TOP.toFixed(2)}</b></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded border" onClick={()=>setStep(1)}>Back</button>
            <button className="bg-black text-white px-4 py-2 rounded" onClick={onSubmit} disabled={loading}>{loading ? 'Computing…' : 'Compute APR'}</button>
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <Titled>Results</Titled>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded">
              <div><b>Amount Financed (AF):</b> ${AF.toFixed(2)}</div>
              <div><b>Total of Payments (TOP):</b> ${TOP.toFixed(2)}</div>
              <div><b>Finance Charge (FC):</b> ${FC.toFixed(2)}</div>
            </div>
            <div className="p-3 border rounded">
              <div><b>APR (calculated):</b> {calc ? `${calc.aprPercent.toFixed(2)}%` : '-'}</div>
              <div><b>Periodic Rate (i):</b> {calc ? calc.periodicRate.toFixed(6) : '-'}</div>
            </div>
          </div>
          <div className="p-3 border rounded space-y-1">
            <div className="font-medium">Tolerance Checks (CA regular loans: ±{aprTol}% APR)</div>
            {disclosedAPRnum !== undefined && calc && (
              <div>
                Disclosed APR {disclosedAPRnum}% vs Calc {calc.aprPercent.toFixed(2)}% → {Math.abs(disclosedAPRnum - calc.aprPercent) > aprTol ? <span className="text-red-600">Outside tolerance</span> : <span className="text-green-700">Within tolerance</span>}
              </div>
            )}
            {disclosedFCnum !== undefined && (
              <div>
                Disclosed FC ${disclosedFCnum.toFixed(2)} vs Calc ${FC.toFixed(2)} → {/* $5/10/100 rule simplified not shown here */}
              </div>
            )}
            {disclosedTOPnum !== undefined && (
              <div>
                Disclosed TOP ${disclosedTOPnum.toFixed(2)} vs Calc ${TOP.toFixed(2)}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded border" onClick={()=>setStep(2)}>Back</button>
            <button className="px-4 py-2 rounded border" onClick={()=>setStep(0)}>Start Over</button>
          </div>
        </section>
      )}
    </main>
  )

  function updateStream(i: number, partial: Partial<PaymentStreamForm>) {
    setStreams(prev => prev.map((s, idx) => idx === i ? { ...s, ...partial } : s))
  }
  function addStream() {
    setStreams(prev => [...prev, { amount: '0', count: '1', unitPeriods: '1', oddDays: '0' }])
  }
  function removeStream(i: number) {
    setStreams(prev => prev.filter((_, idx) => idx !== i))
  }
}
