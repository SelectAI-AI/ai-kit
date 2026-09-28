import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import DemoBanner from './DemoBanner';

vi.mock('../context/DemoModeContext', () => ({
  useDemoMode: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useDemoMode } from '../context/DemoModeContext';
import { useAuth } from '../context/AuthContext';

const BANNER_TEXT = 'Demo Mode — All content unlocked for showcase purposes';

describe('DemoBanner', () => {
  it('renders banner when demoMode=true and user is set', () => {
    useDemoMode.mockReturnValue({ demoMode: true });
    useAuth.mockReturnValue({ user: { id: '1', name: 'Test' } });
    render(<DemoBanner />);
    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();
  });

  it('renders null when demoMode=false', () => {
    useDemoMode.mockReturnValue({ demoMode: false });
    useAuth.mockReturnValue({ user: { id: '1', name: 'Test' } });
    const { container } = render(<DemoBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when user is null even if demoMode=true', () => {
    useDemoMode.mockReturnValue({ demoMode: true });
    useAuth.mockReturnValue({ user: null });
    const { container } = render(<DemoBanner />);
    expect(container.firstChild).toBeNull();
  });
});
