import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { WelcomeScreen } from './WelcomeScreen';

describe('WelcomeScreen Accessibility and Product Truth', () => {
  it('clarifies local folders vs cloud sync in description', () => {
    render(<WelcomeScreen onOpenFolder={vi.fn()} onOpenPath={vi.fn()} />);
    
    const openFolderBtn = screen.getByRole('button', { 
      name: /Open Local Folder: Browse local directory \(Cloud sync available after secure workspace provisioning\)/i 
    });
    
    expect(openFolderBtn).toBeDefined();
  });
});
