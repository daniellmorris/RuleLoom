import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ParamRow } from './Inspector';

describe('Inspector parameter fields', () => {
  it('renders declared object parameters as structured JSON instead of string coercion', () => {
    const html = renderToStaticMarkup(
      <ParamRow
        param={{ name: 'headers', type: 'object' }}
        value={{ Authorization: 'Bearer token', Accept: 'application/json' }}
        onValue={vi.fn()}
        onCallToggle={vi.fn()}
        onInitFlowSteps={vi.fn()}
      />,
    );

    expect(html).toContain('Authorization');
    expect(html).toContain('application/json');
    expect(html).not.toContain('[object Object]');
  });

  it('uses the structured editor when an object value has incomplete string metadata', () => {
    const html = renderToStaticMarkup(
      <ParamRow
        param={{ name: 'headers', type: 'string' }}
        value={{ 'x-request-id': 'abc-123' }}
        onValue={vi.fn()}
        onCallToggle={vi.fn()}
        onInitFlowSteps={vi.fn()}
      />,
    );

    expect(html).toContain('x-request-id');
    expect(html).not.toContain('[object Object]');
  });
});
