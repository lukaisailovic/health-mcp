import { describe, expect, it } from 'vitest';
import { convertUnit } from './units.js';

describe('biomarker unit conversion', () => {
  it('converts glucose mmol/L to mg/dL', () => {
    const r = convertUnit('Glucose', 5, 'mmol/L', 'mg/dL');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(90.078, 2);
  });
  it('converts vitamin D ng/mL to nmol/L', () => {
    const r = convertUnit('Vitamin D', 40, 'ng/mL', 'nmol/L');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(99.84, 2);
  });
  it('rejects unknown biomarker', () => {
    const r = convertUnit('NotAThing', 1, 'mg/dL', 'mmol/L');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown_biomarker');
  });
  it('rejects unknown unit pair', () => {
    const r = convertUnit('Glucose', 5, 'mol/L', 'tons');
    expect(r.ok).toBe(false);
  });
  it('roundtrips ApoB-like value is not registered → unknown_biomarker', () => {
    const r = convertUnit('ApoB', 80, 'mg/dL', 'g/L');
    expect(r.ok).toBe(false);
  });
  it('case-insensitive units and biomarker name', () => {
    const r = convertUnit('glucose', 5, 'MMOL/L', 'MG/DL');
    expect(r.ok).toBe(true);
  });
});
