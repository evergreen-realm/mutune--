const {
  resolveUtilityConfig,
  calculateMewascoWaterBill,
  DEFAULT_MEWASCO_TARIFFS,
  getSupportedProviders
} = require('../services/utilityProvider');

describe('UtilityProvider Service Unit Tests', () => {
  describe('resolveUtilityConfig', () => {
    test('resolves MOMBASA_WATER by explicit ID', () => {
      const cfg = resolveUtilityConfig('MW-10023', 'MOMBASA_WATER');
      expect(cfg.id).toBe('MOMBASA_WATER');
      expect(cfg.billerCode).toBe('895500');
    });

    test('resolves provider by account number prefix', () => {
      const cfg = resolveUtilityConfig('MW-10023');
      expect(cfg.id).toBe('MOMBASA_WATER');
    });

    test('resolves default provider for unknown prefix', () => {
      const cfg = resolveUtilityConfig('XYZ-999');
      expect(cfg.id).toBe('MOMBASA_WATER');
    });
  });

  describe('calculateMewascoWaterBill', () => {
    test('computes domestic lifeline tier (0-6 m³) at 0 rate + 75% sewer', async () => {
      const bill = await calculateMewascoWaterBill(5, 'domestic');
      expect(bill.water_charge_kes).toBe(0);
      expect(bill.sewer_charge_kes).toBe(0);
      expect(bill.total_kes).toBe(0);
      expect(bill.breakdown.length).toBe(1);
    });

    test('computes domestic multi-tier consumption correctly', async () => {
      // 20 m³: 6 m³ @ 0 = 0, 14 m³ @ 47 = 658
      const bill = await calculateMewascoWaterBill(20, 'domestic');
      expect(bill.water_charge_kes).toBe(658);
      expect(bill.sewer_charge_kes).toBe(Math.round(658 * 0.75));
      expect(bill.total_kes).toBe(658 + Math.round(658 * 0.75));
    });

    test('computes commercial flat rate at KES 95/m³', async () => {
      const bill = await calculateMewascoWaterBill(10, 'commercial');
      expect(bill.water_charge_kes).toBe(950);
      expect(bill.sewer_charge_kes).toBe(Math.round(950 * 0.75));
      expect(bill.total_kes).toBe(950 + Math.round(950 * 0.75));
    });
  });

  describe('getSupportedProviders', () => {
    test('returns all 8 configured providers', () => {
      const list = getSupportedProviders();
      expect(list.length).toBe(8);
      const ids = list.map(p => p.id);
      expect(ids).toContain('MOMBASA_WATER');
      expect(ids).toContain('NAIROBI_WATER');
      expect(ids).toContain('KPLC_PREPAID');
    });
  });
});
