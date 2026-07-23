import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SetupScreen } from './SetupScreen';

describe('SetupScreen Accessibility and Product Truth', () => {
  it('has semantic radiogroup roles for accessibility', () => {
    render(<SetupScreen appearance="dark" onAppearanceChange={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: /Select appearance theme/i })).toBeDefined();
  });

  it('mock provider clearly indicates simulated responses', async () => {
    render(<SetupScreen appearance="dark" onAppearanceChange={vi.fn()} onComplete={vi.fn()} />);
    
    // Navigate to step 1
    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    await userEvent.click(continueBtn);
    
    expect(await screen.findByText(/Simulated mock responses \(not real analysis\)/i)).toBeDefined();
    expect(screen.getByRole('radiogroup', { name: /Select AI provider/i })).toBeDefined();
  });
});
