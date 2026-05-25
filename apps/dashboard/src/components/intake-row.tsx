import type { IntakeEntryDto } from '@health-mcp/shared';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { fmtNum, fmtTime } from '@/lib/format';

type Props = {
  entry: IntakeEntryDto;
  onDelete?: (id: string) => void;
  deleting?: boolean;
  showConfidence?: boolean;
};

const displayName = (e: IntakeEntryDto): string => {
  const name = e.display_name ?? e.custom_name;
  if (name) return name;
  if (e.ref_kind === 'recipe_serving') return 'Recipe serving';
  if (e.ref_kind === 'batch') return 'Batch portion';
  if (e.ref_kind === 'custom') return 'Custom item';
  return 'Food';
};

const portion = (e: IntakeEntryDto): string | null => {
  if (e.grams != null) return `${fmtNum(e.grams, 0)} g`;
  if (e.servings != null) {
    return e.servings === 1 ? '1 serving' : `${fmtNum(e.servings, 1)} servings`;
  }
  return null;
};

const Macro = ({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) => (
  <span className="inline-flex items-baseline gap-1 text-xs tabular-nums">
    <span className={cn('font-semibold', className)}>{label}</span>
    <span className="font-medium text-kumo-default">{fmtNum(value, 1)}</span>
    <span className="text-[11px] text-kumo-subtle">g</span>
  </span>
);

const confidenceTone = (c: number): string => {
  if (c >= 0.85) return 'text-kumo-success';
  if (c >= 0.6) return 'text-kumo-warning';
  return 'text-kumo-danger';
};

export const IntakeRow = ({ entry, onDelete, deleting, showConfidence }: Props) => {
  const name = displayName(entry);
  const port = portion(entry);
  return (
    <li className="group rounded-md px-2 py-2.5 transition-colors hover:bg-kumo-tint">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="min-w-0 truncate text-sm font-medium text-kumo-default">{name}</h3>
            <div className="shrink-0 whitespace-nowrap">
              <span className="text-base font-semibold tabular-nums text-kumo-strong">
                {fmtNum(entry.kcal, 0)}
              </span>
              <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-kumo-subtle">
                kcal
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <Macro label="P" value={entry.protein_g} className="text-kumo-success" />
            <Macro label="C" value={entry.carb_g} className="text-kumo-warning" />
            <Macro label="F" value={entry.fat_g} className="text-kumo-info" />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-kumo-subtle">
            <span className="font-mono tabular-nums">{fmtTime(entry.ts)}</span>
            <span aria-hidden="true">·</span>
            <Badge variant="muted" className="font-normal capitalize">
              {entry.meal_type}
            </Badge>
            {port ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{port}</span>
              </>
            ) : null}
            {showConfidence ? (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className={cn('tabular-nums', confidenceTone(entry.confidence))}
                  title="Agent-reported confidence in this entry's macros (0–1)."
                >
                  {fmtNum(entry.confidence * 100, 0)}% confident
                </span>
              </>
            ) : null}
          </div>
        </div>
        {onDelete ? (
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            aria-label={`Delete ${name}`}
            className="-mr-1 shrink-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100"
            disabled={deleting}
            onClick={() => onDelete(entry.id)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </li>
  );
};
