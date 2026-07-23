import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
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
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => { root.render(<AuthGate><div>Content</div></AuthGate>); });
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toMatch(/isolated workspaces coming next/i);
    root.unmount();
  });
  
  it('does not imply GitHub auth grants repo access', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => { root.render(<AuthGate><div>Content</div></AuthGate>); });
    await act(async () => { await Promise.resolve(); });
    const githubButton = container.querySelector('button[aria-label*="does not grant repository access"]');
    expect(githubButton?.textContent).toMatch(/No repo access/i);
    root.unmount();
  });
});
