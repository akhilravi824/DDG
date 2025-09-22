import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { computeAPR } from '@/lib/apr';
const cashflowSchema = z.object({ amount: z.number().positive(), t: z.number().int().min(0), f: z.number().min(0).max(0.9999999999) });
const payloadSchema = z.object({ unitsPerYear: z.number().positive(), roundingBps: z.number().int().optional(), advances: z.array(cashflowSchema).min(1), payments: z.array(cashflowSchema).min(1) });
export async function POST(req: NextRequest) { try { const json = await req.json(); const input = payloadSchema.parse(json); const result = computeAPR({ advances: input.advances, payments: input.payments, unitsPerYear: input.unitsPerYear, roundingBps: input.roundingBps }); return NextResponse.json({ ok: true, data: { aprPercent: result.aprPct, periodicRate: result.i }, audit: { unitsPerYear: input.unitsPerYear, roundingBps: input.roundingBps ?? null, advances: input.advances, payments: input.payments } }); } catch (e: any) { return NextResponse.json({ ok: false, error: e?.message ?? 'Bad Request' }, { status: 400 }); } }
