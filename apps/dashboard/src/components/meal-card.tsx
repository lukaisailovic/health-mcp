import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { fmtNum, fmtTime } from '@/lib/format';
import type { MealComponentDto, MealDto } from '@health-mcp/shared';
import { ChevronRight, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

type Props = {
  meal: MealDto;
  onDeleteMeal?: (id: string) => void;
  onRemoveComponent?: (mealId: string, componentId: string) => void;
  busy?: boolean;
  showConfidence?: boolean;
};

const refKindLabel: Record<MealComponentDto['ref_kind'], string> = {
  food: 'Food',
  recipe_serving: 'Recipe',
  batch: 'Batch',
  custom: 'Custom',
};

const componentLabel = (c: MealComponentDto): string => c.display_name ?? refKindLabel[c.ref_kind];

const titleFor = (meal: MealDto): string => {
  if (meal.name) return meal.name;
  if (meal.components.length === 1) return componentLabel(meal.components[0]!);
  return meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1);
};

const portion = (c: MealComponentDto): string | null => {
  if (c.grams != null) return `${fmtNum(c.grams, 0)} g`;
  if (c.servings != null) {
    return c.servings === 1 ? '1 serving' : `${fmtNum(c.servings, 1)} servings`;
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

const MiniMacro = ({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) => (
  <span>
    <span className={cn('font-semibold', className)}>{label}</span> {fmtNum(value, 1)}
  </span>
);

const ComponentRow = ({
  component,
  onRemove,
  busy,
  showConfidence,
}: {
  component: MealComponentDto;
  onRemove?: (id: string) => void;
  busy?: boolean;
  showConfidence?: boolean;
}) => {
  const name = componentLabel(component);
  const port = portion(component);
  return (
    <li className="group/c flex items-start gap-3 py-2 pl-6 pr-1 text-sm">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 truncate text-kumo-default">{name}</span>
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-kumo-subtle">
            {refKindLabel[component.ref_kind]}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs tabular-nums text-kumo-subtle">
          {port ? <span>{port}</span> : null}
          <MiniMacro label="P" value={component.protein_g} className="text-kumo-success" />
          <MiniMacro label="C" value={component.carb_g} className="text-kumo-warning" />
          <MiniMacro label="F" value={component.fat_g} className="text-kumo-info" />
          {showConfidence ? (
            <span className={confidenceTone(component.confidence)}>
              {fmtNum(component.confidence * 100, 0)}%
            </span>
          ) : null}
        </div>
        {component.notes ? (
          <p className="text-xs italic text-kumo-subtle">{component.notes}</p>
        ) : null}
      </div>
      <span className="shrink-0 pt-0.5 tabular-nums text-kumo-strong">
        {fmtNum(component.kcal, 0)}
        <span className="ml-1 text-[10px] uppercase tracking-wider text-kumo-subtle">kcal</span>
      </span>
      {onRemove ? (
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          aria-label={`Remove ${name}`}
          className="shrink-0 sm:opacity-0 sm:transition-opacity sm:group-hover/c:opacity-100 sm:group-focus-within/c:opacity-100 focus-visible:opacity-100"
          disabled={busy}
          onClick={() => onRemove(component.id)}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
};

export const MealCard = ({
  meal,
  onDeleteMeal,
  onRemoveComponent,
  busy,
  showConfidence,
}: Props) => {
  const title = titleFor(meal);
  const single = meal.components.length === 1;
  const expandable = meal.components.length > 0;
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const summary = (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {expandable ? (
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-kumo-subtle transition-transform duration-200',
                open && 'rotate-90',
              )}
              aria-hidden="true"
            />
          ) : null}
          <h3 className="min-w-0 truncate text-sm font-medium text-kumo-default">{title}</h3>
        </div>
        <div className="shrink-0 whitespace-nowrap">
          <span className="text-base font-semibold tabular-nums text-kumo-strong">
            {fmtNum(meal.totals.kcal, 0)}
          </span>
          <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-kumo-subtle">
            kcal
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pl-5">
        <Macro label="P" value={meal.totals.protein_g} className="text-kumo-success" />
        <Macro label="C" value={meal.totals.carb_g} className="text-kumo-warning" />
        <Macro label="F" value={meal.totals.fat_g} className="text-kumo-info" />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-5 text-xs text-kumo-subtle">
        <span className="font-mono tabular-nums">{fmtTime(meal.ts)}</span>
        <span aria-hidden="true">·</span>
        <Badge variant="muted" className="font-normal capitalize">
          {meal.meal_type}
        </Badge>
        {single && meal.components[0]!.grams != null ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{portion(meal.components[0]!)}</span>
          </>
        ) : meal.components.length > 1 ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{meal.components.length} items</span>
          </>
        ) : null}
        {showConfidence && meal.totals.avg_confidence !== null ? (
          <>
            <span aria-hidden="true">·</span>
            <span
              className={cn('tabular-nums', confidenceTone(meal.totals.avg_confidence))}
              title="Average component confidence (0–1)."
            >
              {fmtNum(meal.totals.avg_confidence * 100, 0)}% confident
            </span>
          </>
        ) : null}
      </div>
    </div>
  );

  return (
    <li className="group rounded-md px-2 py-2.5 transition-colors hover:bg-kumo-tint">
      <div className="flex items-start gap-3">
        {expandable ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="min-w-0 flex-1 cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-line"
          >
            {summary}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{summary}</div>
        )}
        {onDeleteMeal ? (
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            aria-label={`Delete ${title}`}
            className="-mr-1 shrink-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100"
            disabled={busy}
            onClick={() => onDeleteMeal(meal.id)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {expandable ? (
        <div id={panelId} className="t-reveal" data-open={open} {...(open ? null : { inert: '' })}>
          <div>
            <ul className="mt-1.5 divide-y divide-kumo-line border-t border-kumo-line">
              {meal.components.map((c) => (
                <ComponentRow
                  key={c.id}
                  component={c}
                  onRemove={onRemoveComponent ? (id) => onRemoveComponent(meal.id, id) : undefined}
                  busy={busy}
                  showConfidence={showConfidence}
                />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </li>
  );
};
