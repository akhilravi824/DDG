export type UnitPeriod = 'MONTH' | 'DAY' | 'YEAR';
export interface Cashflow { amount: number; t: number; f: number; }
export interface AprInput { advances: Cashflow[]; payments: Cashflow[]; unitsPerYear: number; roundingBps?: number; }
