import React from 'react';
import type { Data as PuckData, Config } from '@measured/puck';
import type { ComponentRegistry } from './componentRegistry';
import type {
  LayoutRegion,
  LayoutRegionId,
  PuckBlockDescriptor,
  PuckLayout
} from '../types/puckLayout';

const regionIds: LayoutRegionId[] = ['header', 'sidebar', 'canvas', 'inspector'];

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as any).randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
};

export function layoutToPuckData(layout: PuckLayout): PuckData {
  const regions: LayoutRegion[] = layout.pages?.[0]?.regions ?? layout.regions ?? [];
  const regionMap = Object.fromEntries(regionIds.map((id) => [id, regions.find((r) => r.id === id)]));

  const slotBlocks = (regionId: LayoutRegionId) => {
    const region = regionMap[regionId] as LayoutRegion | undefined;
    return (region?.blocks ?? []).map((block) => ({
      id: makeId(),
      type: block.name,
      props: {
        id: makeId(),
        slot: block.slot,
        order: block.order,
        props: block.props ? JSON.stringify(block.props, null, 2) : ''
      }
    }));
  };

  const content = [
    {
      id: 'shell',
      type: 'Shell',
      props: {
        id: 'shell',
        header: slotBlocks('header'),
        sidebar: slotBlocks('sidebar'),
        canvas: slotBlocks('canvas'),
        inspector: slotBlocks('inspector')
      }
    }
  ];

  return normalizeDataIds({ root: { props: { id: 'root' } }, content });
}

export function puckDataToLayout(data: PuckData): PuckLayout {
  const shell = (data.content ?? []).find((node) => node?.type === 'Shell');
  const props = (shell?.props as any) ?? {};

  const regions: LayoutRegion[] = regionIds.map((regionId) => {
    const blocks: PuckBlockDescriptor[] = (props[regionId] ?? []).map((child: any) => {
      const childProps = child?.props ?? {};
      return {
        name: child?.type,
        slot: childProps.slot,
        order: typeof childProps.order === 'number' ? childProps.order : undefined,
        props: cleanBlockProps(childProps)
      };
    });

    return {
      id: regionId,
      label: props?.label,
      blocks
    } satisfies LayoutRegion;
  });

  return { version: 1, regions };
}

export function buildPuckConfig(registry: ComponentRegistry): Config {
  const allowed = (region: LayoutRegionId) =>
    registry
      .entries()
      .filter((entry) => !entry.type || entry.type === region)
      .map((entry) => entry.name);

  return {
    root: {
      label: 'App Shell',
      fields: {},
      render: ({ children }: { children?: React.ReactNode }) => <>{children}</>
    },
    components: {
      Shell: {
        label: 'Shell',
        fields: {
          header: { type: 'slot', allow: allowed('header') },
          sidebar: { type: 'slot', allow: allowed('sidebar') },
          canvas: { type: 'slot', allow: allowed('canvas') },
          inspector: { type: 'slot', allow: allowed('inspector') }
        },
        render: ({ header, sidebar, canvas, inspector }: Record<LayoutRegionId, React.ReactNode>) => {
          const renderSlot = (slotValue: React.ReactNode) => {
            if (typeof slotValue === 'function') {
              return (slotValue as () => React.ReactNode)();
            }
            return slotValue;
          };

          return (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr 360px',
              gridTemplateRows: '70px 1fr',
              gridTemplateAreas: `"header header header" "sidebar canvas inspector"`,
              gap: 12,
              padding: 12,
              background: 'var(--bg-panel)',
              border: '1px solid var(--panel-border)',
              borderRadius: 12,
              minHeight: 420
            }}
          >
            <div style={{ gridArea: 'header' }}>{renderSlot(header)}</div>
            <div style={{ gridArea: 'sidebar' }} className="stack" aria-label="Sidebar">{renderSlot(sidebar)}</div>
            <div style={{ gridArea: 'canvas' }} className="stack" aria-label="Canvas">{renderSlot(canvas)}</div>
            <div style={{ gridArea: 'inspector' }} className="stack" aria-label="Inspector">{renderSlot(inspector)}</div>
          </div>
          );
        }
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

function cleanBlockProps(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const props = { ...(value as Record<string, unknown>) };
  const parsedProps = parsePropsField((props as any).props);
  delete (props as any).slot;
  delete (props as any).order;
  delete (props as any).id;
  delete (props as any).key;
  delete (props as any).props;
  const merged = { ...props, ...(parsedProps ?? {}) };
  return Object.keys(merged).length ? merged : undefined;
}

export function normalizeDataIds(data: PuckData): PuckData {
  const cloneNode = (node: any): any => {
    const next: any = { ...node };
    const id = node.id ?? makeId();
    next.id = id;
    next.key = node.key ?? id;
    next.props = {
      ...(node.props ?? {}),
      id: (node.props ?? {}).id ?? id
    };
    if (Array.isArray(node.children)) {
      next.children = node.children.map((child: any) => cloneNode(child));
    }
    regionIds.forEach((slot) => {
      if (Array.isArray((node.props ?? {})[slot])) {
        next.props[slot] = (node.props as any)[slot].map((child: any) => cloneNode(child));
      }
    });
    return next;
  };
  const content = (data.content ?? []).map((n) => cloneNode(n));
  return { ...data, content, root: data.root ?? { props: { id: 'root' } } };
}
