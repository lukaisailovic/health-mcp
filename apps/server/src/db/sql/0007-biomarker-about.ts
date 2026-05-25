import { seedBiomarkers } from '../../biomarkers/seed.js';
import type { Db } from '../client.js';
import type { Migration } from '../migrations.js';

const ddl = `
ALTER TABLE biomarkers ADD COLUMN why_it_matters TEXT;
ALTER TABLE biomarkers ADD COLUMN influences TEXT;
ALTER TABLE biomarkers ADD COLUMN how_to_improve TEXT;
`;

const run = (db: Db) => {
  db.exec(ddl);
  const update = db.prepare(
    `UPDATE biomarkers
       SET why_it_matters = COALESCE(?, why_it_matters),
           influences = COALESCE(?, influences),
           how_to_improve = COALESCE(?, how_to_improve),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE name = ? COLLATE NOCASE`,
  );
  for (const b of seedBiomarkers) {
    if (!b.why_it_matters && !b.influences && !b.how_to_improve) continue;
    update.run(
      b.why_it_matters ?? null,
      b.influences ?? null,
      b.how_to_improve ?? null,
      b.name,
    );
  }
};

export const migration0007: Migration = { id: '0007-biomarker-about', run };
