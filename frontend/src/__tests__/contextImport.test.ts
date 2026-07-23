import { describe, expect, it } from 'vitest';
import { parseConversationImport } from '../lib/contextImport';

describe('parseConversationImport', () => {
  it('normalizes a ChatGPT conversation export mapping', () => {
    const result = parseConversationImport(JSON.stringify({
      title: 'Fix sign in',
      mapping: {
        a: { create_time: 2, message: { author: { role: 'assistant' }, content: { parts: ['Try a redirect allow-list.'] } } },
        b: { create_time: 1, message: { author: { role: 'user' }, content: { parts: ['OAuth loops after login.'] } } },
      },
    }), 'conversations.json');
    expect(result.source).toBe('chatgpt');
    expect(result.title).toBe('Fix sign in');
    expect(result.messages).toEqual([
      { role: 'user', content: 'OAuth loops after login.' },
      { role: 'assistant', content: 'Try a redirect allow-list.' },
    ]);
  });

  it('preserves markdown locally without parsing it as JSON', () => {
    const result = parseConversationImport('# Notes\n\nInvestigate the build failure.', 'notes.md');
    expect(result.source).toBe('markdown');
    expect(result.messages[0].content).toContain('Investigate the build failure.');
  });

  it('does not execute markup or preserve null bytes', () => {
    const result = parseConversationImport('hello\u0000<script>ignore</script>', 'notes.txt');
    expect(result.messages[0].content).toBe('hello<script>ignore</script>');
  });

  it('reports unusable structured exports clearly', () => {
    const result = parseConversationImport(JSON.stringify({ other: true }), 'export.json');
    expect(result.messages).toHaveLength(0);
    expect(result.warnings[0]).toContain('No readable');
  });
});
