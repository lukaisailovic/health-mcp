import { seedBiomarkers, seedCategories } from '../../biomarkers/seed.js';
import { cuid } from '../../util/id.js';
import type { Db } from '../client.js';
import type { Migration } from '../migrations.js';

const run = (db: Db) => {
  const catInsert = db.prepare(
    'INSERT INTO biomarker_categories (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING',
  );
  const catLookup = db.prepare('SELECT id FROM biomarker_categories WHERE name = ? COLLATE NOCASE');
  const catIdByName = new Map<string, string>();
  for (const cat of seedCategories) {
    const id = cuid();
    catInsert.run(id, cat);
    const row = catLookup.get(cat) as { id: string } | undefined;
    if (row) catIdByName.set(cat.toLowerCase(), row.id);
  }

  const biomarkerInsert = db.prepare(`
    INSERT INTO biomarkers (
      id, loinc_code, name, display_name, aliases, default_unit_ucum, value_type,
      default_ref_low, default_ref_high, optimal_low, optimal_high, notes
    ) VALUES (
      @id, @loinc_code, @name, @display_name, @aliases, @default_unit_ucum, @value_type,
      @default_ref_low, @default_ref_high, @optimal_low, @optimal_high, @notes
    )
  `);
  const mapInsert = db.prepare(
    'INSERT INTO biomarker_category_map (biomarker_id, category_id) VALUES (?, ?)',
  );

  for (const b of seedBiomarkers) {
    const id = cuid();
    biomarkerInsert.run({
      id,
      loinc_code: b.loinc_code ?? null,
      name: b.name,
      display_name: b.display_name ?? null,
      aliases: b.aliases ? JSON.stringify(b.aliases) : null,
      default_unit_ucum: b.default_unit_ucum,
      value_type: b.value_type ?? 'numeric',
      default_ref_low: b.default_ref_low ?? null,
      default_ref_high: b.default_ref_high ?? null,
      optimal_low: b.optimal_low ?? null,
      optimal_high: b.optimal_high ?? null,
      notes: b.notes ?? null,
    });
    for (const cat of b.categories ?? []) {
      const catId = catIdByName.get(cat.toLowerCase());
      if (catId) mapInsert.run(id, catId);
    }
  }
};

export const migration0005: Migration = { id: '0005-seed-biomarkers', run };
