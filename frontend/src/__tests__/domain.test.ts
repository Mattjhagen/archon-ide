import { describe, it, expect } from 'vitest';
import { detectLanguage, formatFileSize, clamp } from '../lib/utils';

// Tests for the core domain logic that will be shared with the Rust backend

describe('Core domain logic', () => {
  describe('Language detection', () => {
    const cases: [string, string][] = [
      ['index.ts', 'typescript'],
      ['App.tsx', 'typescript'],
      ['main.py', 'python'],
      ['server.go', 'go'],
      ['lib.rs', 'rust'],
      ['style.css', 'css'],
      ['index.html', 'html'],
      ['config.json', 'json'],
      ['Dockerfile', 'dockerfile'],
      ['README.md', 'markdown'],
      ['script.sh', 'shell'],
      ['data.yaml', 'yaml'],
    ];

    it.each(cases)('detects %s as %s', (input, expected) => {
      expect(detectLanguage(input)).toBe(expected);
    });
  });

  describe('File size formatting', () => {
    it('formats 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('formats bytes under 1KB', () => {
      expect(formatFileSize(512)).toBe('512 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(5120)).toBe('5.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB');
    });
  });

  describe('Clamp', () => {
    it('returns value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('clamps to minimum', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('clamps to maximum', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('handles equal bounds', () => {
      expect(clamp(5, 5, 5)).toBe(5);
    });
  });
});
