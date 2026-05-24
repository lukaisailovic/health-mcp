type Conversion = {
  // Multiply value in `from` units to get value in `to` units.
  factor: number;
};

type BiomarkerKey = string;

const norm = (s: string): string => s.trim().toLowerCase();

const TABLE: Record<BiomarkerKey, Record<string, Record<string, Conversion>>> = {};

const add = (biomarkerName: string, from: string, to: string, factor: number) => {
  const key = norm(biomarkerName);
  TABLE[key] ??= {};
  const fromKey = norm(from);
  const toKey = norm(to);
  TABLE[key][fromKey] ??= {};
  TABLE[key][toKey] ??= {};
  TABLE[key][fromKey][toKey] = { factor };
  TABLE[key][toKey][fromKey] = { factor: 1 / factor };
};

// Glucose: 1 mmol/L = 18.0156 mg/dL
add('Glucose', 'mmol/L', 'mg/dL', 18.0156);
add('Glucose', 'mg/dL', 'mmol/L', 1 / 18.0156);

// Cholesterol family: 1 mmol/L = 38.67 mg/dL
for (const m of ['Total Cholesterol', 'HDL Cholesterol', 'LDL Cholesterol']) {
  add(m, 'mmol/L', 'mg/dL', 38.67);
}

// Triglycerides: 1 mmol/L = 88.57 mg/dL
add('Triglycerides', 'mmol/L', 'mg/dL', 88.57);

// Creatinine: 1 mg/dL = 88.4 umol/L
add('Creatinine', 'mg/dL', 'umol/L', 88.4);
add('Creatinine', 'umol/L', 'mg/dL', 1 / 88.4);

// Total Bilirubin: 1 mg/dL = 17.1 umol/L
add('Total Bilirubin', 'mg/dL', 'umol/L', 17.1);

// Calcium: 1 mg/dL = 0.2495 mmol/L
add('Calcium', 'mg/dL', 'mmol/L', 0.2495);

// Vitamin D: 1 ng/mL = 2.496 nmol/L
add('Vitamin D', 'ng/mL', 'nmol/L', 2.496);

// Vitamin B12: 1 pg/mL = 0.738 pmol/L
add('Vitamin B12', 'pg/mL', 'pmol/L', 0.738);

// Folate: 1 ng/mL = 2.266 nmol/L
add('Folate', 'ng/mL', 'nmol/L', 2.266);

// Iron: 1 ug/dL = 0.179 umol/L
add('Iron', 'ug/dL', 'umol/L', 0.179);

// Ferritin: 1 ng/mL = 1 ug/L (literal alias)
add('Ferritin', 'ng/mL', 'ug/L', 1);

// Magnesium: 1 mg/dL = 0.4114 mmol/L
add('Magnesium', 'mg/dL', 'mmol/L', 0.4114);

// Uric Acid: 1 mg/dL = 59.485 umol/L
add('Uric Acid', 'mg/dL', 'umol/L', 59.485);

// Homocysteine: same in umol/L

// Free T3: 1 pg/mL = 1.536 pmol/L
add('Free T3', 'pg/mL', 'pmol/L', 1.536);

// Free T4: 1 ng/dL = 12.87 pmol/L
add('Free T4', 'ng/dL', 'pmol/L', 12.87);

// Testosterone Total: 1 ng/dL = 0.0347 nmol/L
add('Testosterone Total', 'ng/dL', 'nmol/L', 0.0347);

// Estradiol: 1 pg/mL = 3.671 pmol/L
add('Estradiol', 'pg/mL', 'pmol/L', 3.671);

// Albumin: 1 g/dL = 10 g/L
for (const m of ['Albumin', 'Hemoglobin']) add(m, 'g/dL', 'g/L', 10);

export type ConvertResult =
  | { ok: true; value: number; unit: string }
  | { ok: false; reason: 'unknown_biomarker' | 'unknown_unit_pair' };

export const convertUnit = (
  biomarkerName: string,
  value: number,
  fromUnit: string,
  toUnit: string,
): ConvertResult => {
  if (norm(fromUnit) === norm(toUnit)) return { ok: true, value, unit: toUnit };
  const map = TABLE[norm(biomarkerName)];
  if (!map) return { ok: false, reason: 'unknown_biomarker' };
  const inner = map[norm(fromUnit)];
  if (!inner) return { ok: false, reason: 'unknown_unit_pair' };
  const conv = inner[norm(toUnit)];
  if (!conv) return { ok: false, reason: 'unknown_unit_pair' };
  return { ok: true, value: value * conv.factor, unit: toUnit };
};
