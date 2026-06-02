import type { Db } from '../client.js';
import type { Migration } from '../migrations.js';

// General adult reference ranges (male where sex-specific) for biomarkers that were
// imported without any range and so always classified as 'unknown'. Values are in each
// biomarker's stored default unit. Only fully range-less rows are touched, so a range the
// user set by hand is never overwritten. Markers with no single agreed reference range —
// atherogenic indices, the free-PSA ratio, ApoE protein level, and the method-dependent
// bleeding/clotting times — are intentionally left unset rather than given invented cutoffs.
type RangeSpec = {
  names: string[];
  ref_low?: number;
  ref_high?: number;
  opt_low?: number;
  opt_high?: number;
};

const RANGES: RangeSpec[] = [
  // CBC differential — relative (%)
  { names: ['Neutrophils (%)'], ref_low: 40, ref_high: 70 },
  { names: ['Lymphocytes (%)'], ref_low: 20, ref_high: 45 },
  { names: ['Monocytes (%)'], ref_low: 2, ref_high: 10 },
  { names: ['Eosinophils (%)'], ref_low: 0, ref_high: 6 },
  { names: ['Basophils (%)'], ref_low: 0, ref_high: 2 },
  { names: ['Granulocytes (%)'], ref_low: 40, ref_high: 75 },
  // CBC differential — absolute (10^9/L)
  { names: ['Neutrophils (absolute)'], ref_low: 2.0, ref_high: 7.0 },
  { names: ['Lymphocytes (absolute)'], ref_low: 1.0, ref_high: 4.0 },
  { names: ['Monocytes (absolute)'], ref_low: 0.2, ref_high: 1.0 },
  { names: ['Eosinophils (absolute)'], ref_low: 0.0, ref_high: 0.5 },
  { names: ['Basophils (absolute)'], ref_low: 0.0, ref_high: 0.2 },
  // Red-cell and platelet indices
  { names: ['Mean corpuscular volume (MCV)', 'MCV'], ref_low: 80, ref_high: 100 },
  { names: ['Mean corpuscular hemoglobin (MCH)', 'MCH'], ref_low: 27, ref_high: 33 },
  { names: ['Mean corpuscular hemoglobin concentration (MCHC)'], ref_low: 320, ref_high: 360 },
  { names: ['Red cell distribution width (RDW)', 'RDW'], ref_low: 11.5, ref_high: 14.5 },
  { names: ['Mean platelet volume (MPV)', 'MPV'], ref_low: 7.5, ref_high: 11.5 },
  // Chemistry
  { names: ['Direct bilirubin'], ref_low: 0, ref_high: 5 },
  { names: ['Fibrinogen'], ref_low: 2.0, ref_high: 4.0 },
  { names: ['CRP'], ref_high: 5, opt_high: 1 },
  { names: ['Urea'], ref_low: 2.5, ref_high: 7.8 },
  { names: ['LDH'], ref_low: 120, ref_high: 250 },
  { names: ['Total calcium'], ref_low: 2.15, ref_high: 2.55 },
  { names: ['Inorganic phosphorus'], ref_low: 0.81, ref_high: 1.45 },
  { names: ['Transferrin'], ref_low: 2.0, ref_high: 3.6 },
  // Glycemic / metabolic
  { names: ['Insulin'], ref_low: 2.6, ref_high: 24.9 },
  { names: ['C-peptide'], ref_low: 370, ref_high: 1470 },
  { names: ['HOMA-IR'], opt_high: 2.0 },
  { names: ['Non-HDL Cholesterol'], ref_high: 4.1, opt_high: 3.4 },
  { names: ['HbA1c (IFCC)'], ref_high: 42, opt_high: 39 },
  // Hormones / vitamins (male)
  { names: ['Testosterone'], ref_low: 8.6, ref_high: 29.0 },
  { names: ['Vitamin D (25-OH)'], ref_low: 75, ref_high: 250 },
  { names: ['PSA'], ref_high: 4.0 },
  { names: ['FSH'], ref_low: 1.5, ref_high: 12.4 },
  { names: ['LH'], ref_low: 1.7, ref_high: 8.6 },
  { names: ['DHEA-S'], ref_low: 80, ref_high: 560 },
];

const run = (db: Db): void => {
  const stmt = db.prepare(
    `UPDATE biomarkers
       SET default_ref_low = ?, default_ref_high = ?, optimal_low = ?, optimal_high = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE name = ? COLLATE NOCASE
       AND default_ref_low IS NULL AND default_ref_high IS NULL
       AND optimal_low IS NULL AND optimal_high IS NULL`,
  );
  for (const r of RANGES) {
    for (const name of r.names) {
      stmt.run(r.ref_low ?? null, r.ref_high ?? null, r.opt_low ?? null, r.opt_high ?? null, name);
    }
  }
};

export const migration0015: Migration = { id: '0015-backfill-biomarker-ranges', run };
