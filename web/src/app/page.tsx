'use client'
import { useState } from 'react'

export default function Home() {
  const [adv, setAdv] = useState('975')
  const [p1, setP1] = useState('340')
  const [p2, setP2] = useState('340')
  const [p3, setP3] = useState('340')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{apr:number,i:number}|null>(null)
  const onCalc = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/calc/apr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitsPerYear: 12,
          roundingBps: 10,
          advances: [{ amount: Number(adv), t: 0, f: 0 }],
          payments: [
            { amount: Number(p1), t: 1, f: 0 },
            { amount: Number(p2), t: 2, f: 0 },
            { amount: Number(p3), t: 3, f: 0 }
          ]
        })
      })
      const json = await res.json()
      if (json.ok) setResult({ apr: json.data.aprPercent, i: json.data.periodicRate })
      else alert(json.error || 'Error')
    } finally { setLoading(false) }
  }
  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">APR Calculator (Local)</h1>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-sm">Amount Financed</span>
          <input className="border px-2 py-1 rounded w-full" value={adv} onChange={e=>setAdv(e.target.value)} />
        </label>
        <div />
        <label className="space-y-1">
          <span className="text-sm">Payment 1</span>
          <input className="border px-2 py-1 rounded w-full" value={p1} onChange={e=>setP1(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Payment 2</span>
          <input className="border px-2 py-1 rounded w-full" value={p2} onChange={e=>setP2(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Payment 3</span>
          <input className="border px-2 py-1 rounded w-full" value={p3} onChange={e=>setP3(e.target.value)} />
        </label>
      </div>
      <button onClick={onCalc} disabled={loading} className="bg-black text-white px-4 py-2 rounded">
        {loading ? 'Calculating…' : 'Calculate APR'}
      </button>
      {result && (
        <div className="p-3 border rounded">
          <div><b>APR:</b> {result.apr.toFixed(2)}%</div>
          <div><b>Periodic rate (monthly i):</b> {result.i.toFixed(6)}</div>
        </div>
      )}
    </main>
  )
}
