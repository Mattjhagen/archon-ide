// ============================================
// Utility functions for Archon IDE
// ============================================

/**
 * Detect programming language from file extension.
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    sql: 'sql',
    md: 'markdown',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
  };
  const base = filePath.split('/').pop()?.toLowerCase() ?? '';
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'makefile';
  return map[ext] ?? 'plaintext';
}

/**
 * Get file icon name from extension (for lucide-react icon mapping).
 */
export function getFileIconName(filePath: string, isDir: boolean): string {
  if (isDir) return 'folder';
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const iconMap: Record<string, string> = {
    ts: 'file-code',
    tsx: 'file-code',
    js: 'file-code',
    jsx: 'file-code',
    py: 'file-code',
    rs: 'file-code',
    go: 'file-code',
    json: 'file-json',
    yaml: 'file-text',
    yml: 'file-text',
    md: 'file-text',
    html: 'file-code',
    css: 'file-code',
    svg: 'image',
    png: 'image',
    jpg: 'image',
  };
  return iconMap[ext] ?? 'file';
}

/**
 * Format file size to human readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get git status color class.
 */
export function gitStatusColor(status: string): string {
  switch (status) {
    case 'new': return 'text-green-400';
    case 'modified': return 'text-yellow-400';
    case 'deleted': return 'text-red-400';
    case 'renamed': return 'text-blue-400';
    default: return 'text-gray-400';
  }
}

/**
 * Get git status letter.
 */
export function gitStatusLetter(status: string): string {
  switch (status) {
    case 'new': return 'A';
    case 'modified': return 'M';
    case 'deleted': return 'D';
    case 'renamed': return 'R';
    default: return '?';
  }
}

/**
 * Format a relative time string.
 */
export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Check if a file is binary based on common extensions.
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const binaryExts = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp',
    'pdf', 'zip', 'tar', 'gz', 'bz2', '7z', 'rar',
    'exe', 'dll', 'so', 'dylib', 'bin',
    'mp3', 'mp4', 'wav', 'avi', 'mov',
  ]);
  return binaryExts.has(ext);
}
