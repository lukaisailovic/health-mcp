import { Tabs as KumoTabs } from '@cloudflare/kumo';
import type { ComponentPropsWithoutRef } from 'react';

export type TabsProps = ComponentPropsWithoutRef<typeof KumoTabs>;

export const Tabs = KumoTabs;
