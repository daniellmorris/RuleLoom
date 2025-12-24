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

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as any).randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
};

export function layoutToPuckData(layout: PuckLayout): PuckData {
  const regions: LayoutRegion[] =
    layout.regions ??
    layout.pages?.[0]?.regions ??
    [];

  const regionNodes: PuckNode[] = regions.map((region, idx) => ({
    id: `region-${idx}`,
    type: 'Region',
    props: {
      id: region.id,
      label: region.label
    },
    children: (region.blocks ?? []).map((block, bIdx) => ({
      id: `block-${idx}-${bIdx}`,
      type: block.name,
      props: {
        slot: block.slot,
        order: block.order,
        props: block.props ? JSON.stringify(block.props, null, 2) : ''
      }
    }))
  }));

  const content: PuckNode[] = [
    {
      id: 'layout-root',
      type: 'LayoutRoot',
      props: {},
      children: regionNodes
    }
  ];

  return normalizeDataIds({ content });
}

export function puckDataToLayout(data: PuckData): PuckLayout {
  const root = (data.content ?? []).find((node) => node?.type === 'LayoutRoot');
  const regionChildren = root?.children ?? data.content ?? [];

  const regions: LayoutRegion[] = regionChildren
    .filter((node) => node?.type === 'Region')
    .map((regionNode) => {
      const regionId = (regionNode?.props as any)?.id as LayoutRegionId | undefined;
      const blocks: PuckBlockDescriptor[] = (regionNode?.children ?? [])
        .map((child) => {
          const props = (child.props as any) ?? {};
          return {
            name: child.type as string,
            slot: props.slot,
            order: typeof props.order === 'number' ? props.order : undefined,
            props: parsePropsField(props.props)
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
  return {
    components: {
      LayoutRoot: {
        label: 'Layout',
        fields: {
          children: {
            type: 'blocks',
            label: 'Regions',
            allowedComponents: ['Region']
          }
        },
        render: ({ children }: { children?: React.ReactNode }) => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr 360px',
              gridTemplateRows: '70px 1fr',
              gridTemplateAreas: `
                "header header header"
                "sidebar canvas inspector"
              `,
              gap: 12,
              padding: 12,
              background: 'var(--bg-panel)',
              border: '1px solid var(--panel-border)',
              borderRadius: 12,
              minHeight: 420
            }}
          >
            {children}
          </div>
        )
      },
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
            allowedComponents: registry.entries().map((e) => e.name)
          }
        },
        render: ({ id, label, children }: { id: LayoutRegionId; label?: string; children?: React.ReactNode }) => (
          <div
            style={{
              gridArea: id,
              border: '1px dashed var(--muted)',
              padding: 8,
              borderRadius: 10,
              background: 'var(--bg)'
            }}
          >
            <div style={{ fontWeight: 600 }}>{label ?? id}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>Drop blocks here</div>
            <div className="stack" style={{ gap: 8 }}>
              {React.Children.toArray(children)}
            </div>
          </div>
        )
      },
      ...Object.fromEntries(
        registry.entries().map((entry) => {
          const render = (props: any) => {
            const Component = entry.component as any;
            return (
              <div style={{ border: '1px solid var(--panel-border)', borderRadius: 8, padding: 8, background: 'var(--bg)' }}>
                <Component {...parsePropsField(props.props)} />
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 6 }}>
                  {entry.name}
                  {props.slot ? ` · slot ${props.slot}` : ''}
                  {typeof props.order === 'number' ? ` · order ${props.order}` : ''}
                </div>
              </div>
            );
          };

          return [
            entry.name,
            {
              label: entry.name,
              fields: {
                slot: { type: 'text', label: 'Slot', optional: true },
                order: { type: 'number', label: 'Order', optional: true },
                props: { type: 'textarea', label: 'Props (JSON)', optional: true }
              },
              render
            }
          ];
        })
      )
    }
  };
}

function parsePropsField(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return undefined;
}

export function normalizeDataIds(data: PuckData): PuckData {
  const cloneNode = (node: any): any => {
    const next: any = { ...node };
    const id = node.id ?? makeId();
    next.id = id;
    next.key = node.key ?? id;
    if (Array.isArray(node.children)) {
      next.children = node.children.map((child: any) => cloneNode(child));
    }
    return next;
  };
  const content = (data.content ?? []).map((n) => cloneNode(n));
  return { ...data, content };
}
