import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { DemoModeProvider, useDemoMode } from './DemoModeContext';

vi.mock('../api', () => ({
  default: { get: vi.fn() },
}));

import api from '../api';

function DemoModeDisplay() {
  const { demoMode } = useDemoMode();
  return <div data-testid="mode">{String(demoMode)}</div>;
}

describe('DemoModeProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets demoMode=true when /health returns demo_mode: true', async () => {
    api.get.mockResolvedValueOnce({ data: { demo_mode: true } });
    render(<DemoModeProvider><DemoModeDisplay /></DemoModeProvider>);
    await waitFor(() =>
      expect(screen.getByTestId('mode').textContent).toBe('true')
    );
  });

  it('leaves demoMode=false when /health returns demo_mode: false', async () => {
    api.get.mockResolvedValueOnce({ data: { demo_mode: false } });
    render(<DemoModeProvider><DemoModeDisplay /></DemoModeProvider>);
    await waitFor(() =>
      expect(screen.getByTestId('mode').textContent).toBe('false')
    );
  });

  it('leaves demoMode=false on network error', async () => {
    api.get.mockRejectedValueOnce(new Error('Network error'));
    render(<DemoModeProvider><DemoModeDisplay /></DemoModeProvider>);
    await waitFor(() =>
      expect(screen.getByTestId('mode').textContent).toBe('false')
    );
  });
});
