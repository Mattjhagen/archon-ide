import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { AuthGate } from './AuthGate';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    }
  }
}));

describe('AuthGate Accessibility and Product Truth', () => {
  it('does not falsely claim workspace isolation is ready', async () => {
    render(<AuthGate><div>Content</div></AuthGate>);
    expect(await screen.findByText(/isolated workspaces coming next/i)).toBeDefined();
  });
  
  it('does not imply GitHub auth grants repo access', async () => {
    render(<AuthGate><div>Content</div></AuthGate>);
    const githubBtn = await screen.findByRole('button', { name: /Sign in with GitHub \(does not grant repository access\)/i });
    expect(githubBtn).toBeDefined();
    expect(githubBtn.textContent).toMatch(/No repo access/i);
  });
});
