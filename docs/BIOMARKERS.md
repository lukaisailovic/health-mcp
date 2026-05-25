# Biomarkers

The biomarker subsystem is generic — it can hold anything from a blood draw, saliva test, urinalysis, or genetic SNP report. The model leans on **name + value + unit + time** with curated ranges, intentionally lighter than full FHIR Observation.

## Two-tier entity split

- **`biomarkers`** — *catalog*. Definition, default unit, default ranges, optimal range. ~60 seeded markers + user-added customs.
- **`lab_results`** — *observations*. Per-result value, unit, snapshot ranges, time. Optionally grouped by a `lab_panel`.

Categories are many-to-many — Glucose belongs to both `CMP` and `Glycemic`. There's no primary category column.

## Three-tier range model

Three ranges, walked in this order to decide a result's `status`:

1. **Per-result snapshot** (`lab_results.ref_low/ref_high/ref_text`) — what the lab printed on this draw. Authoritative when present.
2. **Per-biomarker default** (`biomarkers.default_ref_low/default_ref_high`) — fallback for user-entered data where the lab range is unknown.
3. **Optimal range** (`biomarkers.optimal_low/optimal_high`) — curated, distinct from lab "normal". Often tighter (Function / InsideTracker style). Set with `set_optimal_range`.

`statusForResult` (`apps/server/src/services/biomarkers.ts`) returns one of:

- `optimal` — has optimal range and value is inside it.
- `in_ref` — has a reference range (snapshot or default) and value is inside it.
- `out_of_ref` — has any range and value is outside.
- `unknown` — non-numeric value, no ranges at all, or the stored unit doesn't match the biomarker's default unit (so range comparison would be meaningless).

The status walk:
1. If the result's `unit_ucum` doesn't match the biomarker's `default_unit_ucum` → `unknown` (the ranges live in the default unit; comparing across units would lie).
2. If the biomarker has an optimal range and value is inside → `optimal`.
3. Otherwise, fall back to the lab snapshot range, then the default. If a range exists and value is inside → `in_ref`. If outside → `out_of_ref`.
4. If neither optimal nor reference ranges exist → `unknown`. (If only an optimal range exists and the value falls outside it, status is `out_of_ref`.)

`latest_biomarkers` returns one row per biomarker with `{ biomarker, result, status, delta_vs_prev }`.

## Vocabulary, not a wire format

- **LOINC codes** are stored on `biomarkers.loinc_code` (nullable) — seeded from the LOINC Top 2000 intersected with what consumer health platforms actually surface. Users can create biomarkers without one.
- **UCUM** unit strings are always stored on `lab_results.unit_ucum` and `biomarkers.default_unit_ucum` (`mg/dL`, `mmol/L`, `ng/mL`, `10*6/uL`, etc.). Even though we only convert a known subset (below), keeping UCUM strings is cheap forward-compat for plugging in a real UCUM service later.

The wire format is plain SQL rows + Zod schemas. No FHIR resources cross the wall.

## Polymorphic value

`lab_results.value_numeric` for normal numeric labs; `lab_results.value_text` for things like `negative`, `positive`, `trace`, `>2000`. `biomarkers.value_type` (`'numeric' | 'text' | 'numeric_or_text'`) tells tools which to expect. At least one of `value_numeric` / `value_text` is required on insert (else `missing_value: 400`).

## Unit conversion

`apps/server/src/biomarkers/units.ts` hardcodes the ~30 most-common dual-unit conversions. On insert, if `unit_ucum` differs from the biomarker's default and the pair is in the table:

- value is converted to the default unit
- `unit_ucum` is rewritten to the default
- the original (e.g. `original: 5.1 mmol/L`) is appended to `notes`

If `unit_ucum` differs but the pair is **not** in the table, value is stored as-supplied and `unit_mismatch` is added to `notes`. `statusForResult` returns `unknown` for these rows so `biomarker_trend` and `latest_biomarkers` never compare a mismatched-unit value against the default-unit ranges.

Conversions wired today (bidirectional unless noted):

| Biomarker(s) | From | To | Factor |
|---|---|---|---|
| Glucose | mmol/L | mg/dL | × 18.0156 |
| Total / HDL / LDL Cholesterol | mmol/L | mg/dL | × 38.67 |
| Triglycerides | mmol/L | mg/dL | × 88.57 |
| Creatinine | mg/dL | umol/L | × 88.4 |
| Total Bilirubin | mg/dL | umol/L | × 17.1 |
| Calcium | mg/dL | mmol/L | × 0.2495 |
| Vitamin D | ng/mL | nmol/L | × 2.496 |
| Vitamin B12 | pg/mL | pmol/L | × 0.738 |
| Folate | ng/mL | nmol/L | × 2.266 |
| Iron | ug/dL | umol/L | × 0.179 |
| Ferritin | ng/mL | ug/L | × 1 (alias) |
| Magnesium | mg/dL | mmol/L | × 0.4114 |
| Uric Acid | mg/dL | umol/L | × 59.485 |
| Free T3 | pg/mL | pmol/L | × 1.536 |
| Free T4 | ng/dL | pmol/L | × 12.87 |
| Testosterone Total | ng/dL | nmol/L | × 0.0347 |
| Estradiol | pg/mL | pmol/L | × 3.671 |
| Albumin, Hemoglobin | g/dL | g/L | × 10 |

Unit comparison is case-insensitive and whitespace-trimmed. To extend, edit `apps/server/src/biomarkers/units.ts` — there's no DB table or runtime config for this on purpose: conversion factors are physics, not data.

## PDF / lab imports

PDF parsing is **agent-side by design**. The server never grows lab-template extractors — that's exactly the work where models do better than us. The flow:

1. Agent reads the PDF (vision or text).
2. Agent calls `log_lab_panel` (atomic) or `log_lab_result` with structured items.

`log_lab_panel.source` accepts `'manual' | 'pdf_import' | 'api'` and `source_ref` can carry the file path / external id for audit.

## Common queries

```text
# Recent panel + statuses
get_lab_panel({ id })

# Most recent value per marker, only out-of-range
latest_biomarkers({ out_of_range_only: true })

# Trend with status per point
biomarker_trend({ biomarker: "Glucose", start: "2024-01-01" })

# Lipid panel out-of-range only, last year
list_lab_results({ category: "Lipid", start: "2025-01-01", out_of_range_only: true })

# Search by alias or LOINC
search_biomarker({ query: "TSH" })
search_biomarker({ query: "2093-3" })   # Total Cholesterol LOINC
```

## Out of scope

- Multi-user sharing / clinician sign-off — single-user local tool.
- Direct API integrations with lab vendors (Quest, Labcorp). Could be added but not implemented today.
- Automatic LOINC mapping for unknown lab strings — the agent does this when it parses a PDF.
