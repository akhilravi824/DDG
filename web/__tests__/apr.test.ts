import { computeAPR } from '@/lib/apr';
import type { Cashflow } from '@/types/apr';
describe('APR engine', () => {
  test('975 financed, 3 x 340 monthly => APR ≈ 27.4849%', () => {
    const advances: Cashflow[] = [{ amount: 975, t: 0, f: 0 }];
    const payments: Cashflow[] = [
      { amount: 340, t: 1, f: 0 },
      { amount: 340, t: 2, f: 0 },
      { amount: 340, t: 3, f: 0 }
    ];
    const { aprPct } = computeAPR({ advances, payments, unitsPerYear: 12 });
    expect(Math.abs(aprPct - 27.4849)).toBeLessThan(0.02);
  });
});
