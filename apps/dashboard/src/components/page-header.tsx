import type { ReactNode } from 'react';

export const PageHeader = ({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) => (
  <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight text-kumo-strong sm:text-[26px]">
        {title}
      </h1>
      {description ? <p className="text-sm text-kumo-subtle">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </header>
);
