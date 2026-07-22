import { describe, it, expect } from 'vitest';
import { detectLanguage, formatFileSize, gitStatusColor, gitStatusLetter, timeAgo, clamp, isBinaryFile } from '../lib/utils';

describe('detectLanguage', () => {
  it('detects TypeScript files', () => {
    expect(detectLanguage('app.ts')).toBe('typescript');
    expect(detectLanguage('component.tsx')).toBe('typescript');
  });

  it('detects Python files', () => {
    expect(detectLanguage('main.py')).toBe('python');
  });

  it('detects Rust files', () => {
    expect(detectLanguage('lib.rs')).toBe('rust');
  });

  it('detects Go files', () => {
    expect(detectLanguage('server.go')).toBe('go');
  });

  it('detects Dockerfile', () => {
    expect(detectLanguage('Dockerfile')).toBe('dockerfile');
  });

  it('detects Makefile', () => {
    expect(detectLanguage('Makefile')).toBe('makefile');
  });

  it('detects nested paths', () => {
    expect(detectLanguage('src/components/App.tsx')).toBe('typescript');
    expect(detectLanguage('lib/utils.py')).toBe('python');
  });

  it('returns plaintext for unknown extensions', () => {
    expect(detectLanguage('file.xyz')).toBe('plaintext');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(2621440)).toBe('2.5 MB');
  });
});

describe('gitStatusColor', () => {
  it('returns correct colors', () => {
    expect(gitStatusColor('new')).toBe('text-green-400');
    expect(gitStatusColor('modified')).toBe('text-yellow-400');
    expect(gitStatusColor('deleted')).toBe('text-red-400');
    expect(gitStatusColor('renamed')).toBe('text-blue-400');
    expect(gitStatusColor('unknown')).toBe('text-gray-400');
  });
});

describe('gitStatusLetter', () => {
  it('returns correct letters', () => {
    expect(gitStatusLetter('new')).toBe('A');
    expect(gitStatusLetter('modified')).toBe('M');
    expect(gitStatusLetter('deleted')).toBe('D');
    expect(gitStatusLetter('renamed')).toBe('R');
  });
});

describe('clamp', () => {
  it('clamps values correctly', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('isBinaryFile', () => {
  it('detects binary extensions', () => {
    expect(isBinaryFile('image.png')).toBe(true);
    expect(isBinaryFile('archive.zip')).toBe(true);
    expect(isBinaryFile('video.mp4')).toBe(true);
  });

  it('detects text extensions', () => {
    expect(isBinaryFile('app.ts')).toBe(false);
    expect(isBinaryFile('readme.md')).toBe(false);
    expect(isBinaryFile('style.css')).toBe(false);
  });
});

describe('timeAgo', () => {
  it('returns a string', () => {
    const result = timeAgo(new Date().toISOString());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
