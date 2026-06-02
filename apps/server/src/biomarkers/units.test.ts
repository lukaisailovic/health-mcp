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
  it('folds the micro sign so µmol/L matches the umol/L table entry', () => {
    const r = convertUnit('Creatinine', 88.4, 'µmol/L', 'mg/dL');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1.0, 3);
  });
  it('treats blood-count per-litre and per-microlitre as identical', () => {
    const rbc = convertUnit('RBC', 4.9, '10*12/L', '10*6/uL');
    expect(rbc.ok).toBe(true);
    if (rbc.ok) expect(rbc.value).toBeCloseTo(4.9, 6);
    const wbc = convertUnit('WBC', 5.4, '10*9/L', '10*3/uL');
    if (wbc.ok) expect(wbc.value).toBeCloseTo(5.4, 6);
  });
  it('treats µIU/mL and mIU/L as identical for TSH', () => {
    const r = convertUnit('TSH', 3.2, 'µIU/mL', 'mIU/L');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(3.2, 6);
  });
  it('converts hematocrit fraction to percent', () => {
    const r = convertUnit('Hematocrit', 0.435, 'L/L', '%');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(43.5, 3);
  });
  it('converts MCHC g/L to g/dL', () => {
    const r = convertUnit('MCHC', 352, 'g/L', 'g/dL');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(35.2, 3);
  });
});
