export type IntegrationCategory = 'source' | 'data' | 'deploy' | 'collaboration' | 'context';
export type IntegrationAvailability = 'available' | 'next' | 'planned';

export interface IntegrationDefinition {
  id: string;
  name: string;
  monogram: string;
  category: IntegrationCategory;
  description: string;
  capabilities: string[];
  auth: 'oauth' | 'token' | 'import';
  availability: IntegrationAvailability;
  accent: string;
}

export const integrationCategories: { id: 'all' | IntegrationCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'source', label: 'Source' },
  { id: 'data', label: 'Data' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'collaboration', label: 'Team' },
  { id: 'context', label: 'Context' },
];

export const integrations: IntegrationDefinition[] = [
  {
    id: 'github',
    name: 'GitHub',
    monogram: 'GH',
    category: 'source',
    description: 'Import repositories, create branches, push commits, and open pull requests.',
    capabilities: ['Repositories', 'Pull requests', 'Issues'],
    auth: 'oauth',
    availability: 'available',
    accent: '#f0f2f5',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    monogram: 'SB',
    category: 'data',
    description: 'Inspect schemas, run scoped migrations, manage auth, and verify database changes.',
    capabilities: ['Postgres', 'Authentication', 'Storage'],
    auth: 'oauth',
    availability: 'available',
    accent: '#3ecf8e',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    monogram: 'NT',
    category: 'deploy',
    description: 'Create previews, inspect build logs, and promote verified releases.',
    capabilities: ['Deploy previews', 'Build logs', 'Domains'],
    auth: 'oauth',
    availability: 'next',
    accent: '#32e6e2',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    monogram: '▲',
    category: 'deploy',
    description: 'Connect projects, inspect deployments, and trace production failures.',
    capabilities: ['Deployments', 'Logs', 'Environment'],
    auth: 'oauth',
    availability: 'next',
    accent: '#f5f5f5',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    monogram: 'CF',
    category: 'deploy',
    description: 'Manage DNS, Workers, Pages, and edge configuration with review gates.',
    capabilities: ['DNS', 'Workers', 'Pages'],
    auth: 'token',
    availability: 'planned',
    accent: '#f6821f',
  },
  {
    id: 'slack',
    name: 'Slack',
    monogram: 'SL',
    category: 'collaboration',
    description: 'Start tasks from threads and return progress, review links, and results.',
    capabilities: ['Thread context', 'Task launch', 'Notifications'],
    auth: 'oauth',
    availability: 'planned',
    accent: '#e01e5a',
  },
  {
    id: 'linear',
    name: 'Linear',
    monogram: 'LI',
    category: 'collaboration',
    description: 'Turn assigned issues into scoped tasks and link verified changes back.',
    capabilities: ['Issues', 'Projects', 'Task context'],
    auth: 'oauth',
    availability: 'planned',
    accent: '#8a8cff',
  },
  {
    id: 'context-import',
    name: 'Conversation Import',
    monogram: 'CI',
    category: 'context',
    description: 'Bring selected ChatGPT, Claude, Gemini, or Markdown conversations into a task.',
    capabilities: ['JSON exports', 'Markdown', 'Local parsing'],
    auth: 'import',
    availability: 'next',
    accent: '#a78bfa',
  },
];

