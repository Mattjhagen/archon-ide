import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SetupScreen } from './SetupScreen';

describe('SetupScreen Accessibility and Product Truth', () => {
  it('has semantic radiogroup roles for accessibility', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<SetupScreen appearance="obsidian" onAppearanceChange={vi.fn()} onComplete={vi.fn()} />); });
    expect(container.querySelector('[role="radiogroup"][aria-label="Select appearance theme"]')).not.toBeNull();
    root.unmount();
  });

  it('offers only production providers during setup', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<SetupScreen appearance="obsidian" onAppearanceChange={vi.fn()} onComplete={vi.fn()} />); });
    const continueButton = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('Continue'));
    await act(async () => { continueButton?.click(); });
    expect(container.textContent).toMatch(/GPT-5\.6 Terra/i);
    expect(container.textContent).toMatch(/Claude Sonnet 5/i);
    expect(container.textContent).toMatch(/Gemini 3\.6 Flash/i);
    expect(container.textContent).not.toMatch(/mock|simulated/i);
    expect(container.querySelector('[role="radiogroup"][aria-label="Select AI provider"]')).not.toBeNull();
    root.unmount();
  });
});
