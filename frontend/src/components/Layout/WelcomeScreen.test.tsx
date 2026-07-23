import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WelcomeScreen } from './WelcomeScreen';

describe('WelcomeScreen Accessibility and Product Truth', () => {
  it('clarifies local folders vs cloud sync in description', () => {
    const html = renderToStaticMarkup(<WelcomeScreen onOpenFolder={vi.fn()} onOpenPath={vi.fn()} />);
    expect(html).toMatch(/Open Local Folder: Browse local directory \(Cloud sync available after secure workspace provisioning\)/i);
  });
});
