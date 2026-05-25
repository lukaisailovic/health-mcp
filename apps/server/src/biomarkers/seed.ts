import seedBiomarkersJson from './seed-biomarkers.json' with { type: 'json' };

export type SeedBiomarker = {
  loinc_code?: string;
  name: string;
  display_name?: string;
  aliases?: string[];
  default_unit_ucum: string;
  value_type?: 'numeric' | 'text' | 'numeric_or_text';
  default_ref_low?: number;
  default_ref_high?: number;
  optimal_low?: number;
  optimal_high?: number;
  categories?: string[];
  notes?: string;
  why_it_matters?: string;
  influences?: string;
  how_to_improve?: string | null;
};

export const seedCategories = [
  'Lipid',
  'CBC',
  'CMP',
  'Thyroid',
  'Hormones - sex',
  'Hormones - adrenal',
  'Vitamins',
  'Minerals',
  'Inflammation',
  'Iron',
  'Glycemic',
  'Liver',
  'Kidney',
  'Cardiac',
  'Autoimmunity',
  'Metals',
  'Other',
];

export const seedBiomarkers = seedBiomarkersJson as SeedBiomarker[];
