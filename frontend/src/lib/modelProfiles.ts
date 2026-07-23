import type { ReasoningEffort } from '../types';

export type CapabilityState = 'available' | 'provider' | 'planned';

export interface ModelProfile {
  description: string;
  bestFor: string;
  pace: 'Fast' | 'Balanced' | 'Deliberate';
  capabilities: { label: string; state: CapabilityState }[];
}

const profiles: Record<string, ModelProfile> = {
  'openai/gpt-5.6-sol': {
    description: 'Deep reasoning for complex implementation and verification work.',
    bestFor: 'Long, multi-step coding tasks',
    pace: 'Deliberate',
    capabilities: [{ label: 'Native reasoning', state: 'available' }, { label: 'Long task context', state: 'provider' }, { label: 'Agent tools', state: 'planned' }],
  },
  'openai/gpt-5.6-terra': {
    description: 'Balanced coding and analysis with a faster feedback loop.',
    bestFor: 'Features, debugging, and reviews',
    pace: 'Balanced',
    capabilities: [{ label: 'Native reasoning', state: 'available' }, { label: 'Long task context', state: 'provider' }, { label: 'Agent tools', state: 'planned' }],
  },
  'anthropic/claude-sonnet-4-20250514': {
    description: 'Strong code understanding and deliberate implementation planning.',
    bestFor: 'Refactors and code review',
    pace: 'Balanced',
    capabilities: [{ label: 'Adaptive thinking', state: 'available' }, { label: 'Long task context', state: 'provider' }, { label: 'Agent tools', state: 'planned' }],
  },
  'anthropic/claude-haiku-4-20250414': {
    description: 'Fast iteration for focused questions and smaller edits.',
    bestFor: 'Quick analysis and edits',
    pace: 'Fast',
    capabilities: [{ label: 'Adaptive thinking', state: 'available' }, { label: 'Long task context', state: 'provider' }, { label: 'Agent tools', state: 'planned' }],
  },
  'gemini/gemini-3-pro-preview': {
    description: 'High-capacity model for broad problem exploration and complex code.',
    bestFor: 'Architecture and difficult debugging',
    pace: 'Deliberate',
    capabilities: [{ label: 'Thinking levels', state: 'available' }, { label: 'Large context', state: 'provider' }, { label: 'Agent tools', state: 'planned' }],
  },
  'gemini/gemini-3-flash-preview': {
    description: 'Fast Gemini option for iterative coding work and analysis.',
    bestFor: 'Rapid implementation loops',
    pace: 'Fast',
    capabilities: [{ label: 'Thinking levels', state: 'available' }, { label: 'Large context', state: 'provider' }, { label: 'Agent tools', state: 'planned' }],
  },
  'ollama/llama3.2': {
    description: 'Local model option when keeping requests on your own runtime matters most.',
    bestFor: 'Private local experiments',
    pace: 'Balanced',
    capabilities: [{ label: 'Local runtime', state: 'available' }, { label: 'Reasoning controls', state: 'provider' }, { label: 'Agent tools', state: 'planned' }],
  },
  'ollama/codellama': {
    description: 'Local coding-focused model for offline or self-hosted workflows.',
    bestFor: 'Local code generation',
    pace: 'Balanced',
    capabilities: [{ label: 'Local runtime', state: 'available' }, { label: 'Reasoning controls', state: 'provider' }, { label: 'Agent tools', state: 'planned' }],
  },
  'ollama/deepseek-coder': {
    description: 'Local code model option for self-hosted experimentation.',
    bestFor: 'Local coding tasks',
    pace: 'Balanced',
    capabilities: [{ label: 'Local runtime', state: 'available' }, { label: 'Reasoning controls', state: 'provider' }, { label: 'Agent tools', state: 'planned' }],
  },
  'mock/mock-responses': {
    description: 'Demo content only. It cannot inspect, edit, or verify your workspace.',
    bestFor: 'Exploring the interface',
    pace: 'Fast',
    capabilities: [{ label: 'Demo only', state: 'available' }, { label: 'Workspace access', state: 'planned' }, { label: 'Verified tasks', state: 'planned' }],
  },
};

const fallback: ModelProfile = {
  description: 'Model capabilities are being profiled for this provider.',
  bestFor: 'General coding assistance',
  pace: 'Balanced',
  capabilities: [{ label: 'Reasoning controls', state: 'available' }, { label: 'Agent tools', state: 'planned' }],
};

export function modelProfile(provider: string, model: string): ModelProfile {
  return profiles[`${provider}/${model}`] ?? fallback;
}

export function effortEstimate(effort: ReasoningEffort): { multiplier: number; label: string; detail: string } {
  switch (effort) {
    case 'low': return { multiplier: 1, label: 'Low', detail: 'Fast answer or focused edit' };
    case 'high': return { multiplier: 4, label: 'High', detail: 'Deep reasoning and longer task budget' };
    default: return { multiplier: 2, label: 'Medium', detail: 'Balanced investigation and verification' };
  }
}
