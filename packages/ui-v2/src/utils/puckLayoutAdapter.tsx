import React from 'react';
import type { Data as PuckData, Config } from '@measured/puck';
import type { ComponentRegistry } from './componentRegistry';
import type {
  LayoutRegion,
  LayoutRegionId,
  PuckBlockDescriptor,
  PuckLayout
} from '../types/puckLayout';

type PuckNode = NonNullable<PuckData['content']>[number];

const regionIds: LayoutRegionId[] = ['header', 'sidebar', 'canvas', 'inspector'];

export function layoutToPuckData(layout: PuckLayout): PuckData {
  const regions: LayoutRegion[] =
    layout.pages?.[0]?.regions ??
    layout.regions ??
    [];

  const content: PuckNode[] = regions.map((region) => ({
    type: 'Region',
    props: {
      id: region.id,
      label: region.label
    },
    children: (region.blocks ?? []).map((block) => ({
      type: 'Block',
      props: {
        name: block.name,
        type: block.type,
        slot: block.slot,
        order: block.order,
        props: block.props
      }
    }))
  }));

  return { content };
}

export function puckDataToLayout(data: PuckData): PuckLayout {
  const regions: LayoutRegion[] = (data.content ?? [])
    .filter((node) => node?.type === 'Region')
    .map((regionNode) => {
      const regionId = (regionNode?.props as any)?.id as LayoutRegionId | undefined;
      const blocks: PuckBlockDescriptor[] = (regionNode?.children ?? [])
        .filter((child) => child?.type === 'Block')
        .map((child) => {
          const props = (child.props as any) ?? {};
          return {
            name: props.name ?? 'Block',
            type: props.type,
            slot: props.slot,
            order: typeof props.order === 'number' ? props.order : undefined,
            props: typeof props.props === 'object' && props.props !== null ? props.props : undefined
          };
        });

      return {
        id: regionIds.includes(regionId ?? '' as LayoutRegionId) ? regionId! : 'sidebar',
        label: (regionNode?.props as any)?.label,
        blocks
      };
    });

  return { version: 1, regions };
}

export function buildPuckConfig(registry: ComponentRegistry): Config {
  const blockOptions = registry.entries().map((entry) => ({
    label: `${entry.name}${entry.pluginId ? ` (${entry.pluginId})` : ''}`,
    value: entry.name
  }));

  return {
    components: {
      Region: {
        label: 'Region',
        fields: {
          id: {
            type: 'select',
            label: 'Region',
            options: regionIds.map((id) => ({ label: id, value: id }))
          },
          label: { type: 'text', label: 'Label', optional: true },
          children: {
            type: 'blocks',
            label: 'Blocks',
            allowedComponents: ['Block']
          }
        },
        render: ({ id, label }: { id: LayoutRegionId; label?: string }) => (
          <div style={{ border: '1px dashed var(--muted)', padding: 8 }}>
            <div style={{ fontWeight: 600 }}>{label ?? id}</div>
            <div style={{ color: 'var(--muted)' }}>Drop blocks here</div>
          </div>
        )
      },
      Block: {
        label: 'Block',
        fields: {
          name: {
            type: 'select',
            label: 'Component',
            options: blockOptions
          },
          type: { type: 'text', label: 'Type (optional)', optional: true },
          slot: { type: 'text', label: 'Slot', optional: true },
          order: { type: 'number', label: 'Order', optional: true },
          props: { type: 'json', label: 'Props', optional: true }
        },
        render: ({ name, slot, order }: { name: string; slot?: string; order?: number }) => (
          <div style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}>
            <div style={{ fontWeight: 600 }}>{name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>
              {slot ? `slot: ${slot}` : 'no slot'} · {order ?? 0}
            </div>
          </div>
        )
      }
    }
  };
}
