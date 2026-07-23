import { describe, expect, it } from 'vitest';
import { effortEstimate, modelProfile } from '../lib/modelProfiles';

describe('model capability profiles', () => {
  it('describes OpenAI reasoning support without claiming agent tools are ready', () => {
    const profile = modelProfile('openai', 'gpt-5.6-sol');
    expect(profile.capabilities).toContainEqual({ label: 'Native reasoning', state: 'available' });
    expect(profile.capabilities).toContainEqual({ label: 'Agent tools', state: 'planned' });
  });

  it('makes the demo limitation explicit', () => {
    expect(modelProfile('mock', 'mock-responses').description).toContain('cannot inspect');
  });

  it('uses transparent reasoning multipliers', () => {
    expect(effortEstimate('low').multiplier).toBe(1);
    expect(effortEstimate('medium').multiplier).toBe(2);
    expect(effortEstimate('high').multiplier).toBe(4);
  });
});
