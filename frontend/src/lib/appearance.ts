export type Appearance = 'obsidian' | 'luminous' | 'paper' | 'glass';

export const appearances: { id: Appearance; name: string; description: string; accent: string }[] = [
  { id: 'obsidian', name: 'Obsidian', description: 'Quiet graphite with electric violet precision.', accent: '#7c5cff' },
  { id: 'luminous', name: 'Luminous', description: 'Deep navy with crisp cyan and mint signals.', accent: '#28d7c0' },
  { id: 'paper', name: 'Paper', description: 'Warm daylight surfaces with cobalt clarity.', accent: '#1769e0' },
  { id: 'glass', name: 'Liquid Glass', description: 'Translucent graphite layers with luminous depth.', accent: '#9f7aea' },
];

export function applyAppearance(appearance: Appearance) {
  document.documentElement.dataset.appearance = appearance;
  localStorage.setItem('archon.appearance', appearance);
}

export function savedAppearance(): Appearance {
  const value = localStorage.getItem('archon.appearance');
  return value === 'luminous' || value === 'paper' || value === 'glass' ? value : 'obsidian';
}
