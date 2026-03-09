/**
 * SafeLink Extension Tests
 * Tests URL validation and sanitization to prevent XSS (CVE-2025-14284)
 */

import { describe, it, expect } from 'vitest';
import { isValidUrl, sanitizeUrl } from '../lib/tiptap/extensions/SafeLink';

describe('SafeLink URL Validation', () => {
  describe('isValidUrl', () => {
    describe('Valid URLs', () => {
      it('should accept valid HTTP URLs', () => {
        expect(isValidUrl('http://example.com')).toBe(true);
        expect(isValidUrl('http://example.com/path')).toBe(true);
        expect(isValidUrl('http://example.com/path?query=value')).toBe(true);
      });

      it('should accept valid HTTPS URLs', () => {
        expect(isValidUrl('https://example.com')).toBe(true);
        expect(isValidUrl('https://example.com/path')).toBe(true);
        expect(isValidUrl('https://subdomain.example.com')).toBe(true);
      });

      it('should accept valid mailto URLs', () => {
        expect(isValidUrl('mailto:user@example.com')).toBe(true);
        expect(isValidUrl('mailto:user@example.com?subject=Hello')).toBe(true);
      });

      it('should accept relative URLs', () => {
        expect(isValidUrl('/path/to/page')).toBe(true);
        expect(isValidUrl('./relative/path')).toBe(true);
        expect(isValidUrl('../parent/path')).toBe(true);
      });

      it('should accept URLs with ports', () => {
        expect(isValidUrl('http://localhost:3000')).toBe(true);
        expect(isValidUrl('https://example.com:8080/path')).toBe(true);
      });

      it('should accept URLs with authentication', () => {
        expect(isValidUrl('https://user:pass@example.com')).toBe(true);
      });
    });

    describe('Invalid URLs - Security', () => {
      it('should reject javascript: protocol (XSS)', () => {
        expect(isValidUrl('javascript:alert("XSS")')).toBe(false);
        expect(isValidUrl('javascript:void(0)')).toBe(false);
        expect(isValidUrl('JAVASCRIPT:alert(1)')).toBe(false); // Case insensitive
      });

      it('should reject data: protocol (XSS)', () => {
        expect(isValidUrl('data:text/html,<script>alert("XSS")</script>')).toBe(false);
        expect(isValidUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBe(false);
      });

      it('should reject vbscript: protocol', () => {
        expect(isValidUrl('vbscript:msgbox("XSS")')).toBe(false);
      });

      it('should reject file: protocol', () => {
        expect(isValidUrl('file:///etc/passwd')).toBe(false);
        expect(isValidUrl('file://C:/Windows/System32')).toBe(false);
      });

      it('should reject about: protocol', () => {
        expect(isValidUrl('about:blank')).toBe(false);
      });

      it('should reject ftp: protocol', () => {
        expect(isValidUrl('ftp://example.com')).toBe(false);
      });
    });

    describe('Invalid URLs - Format', () => {
      it('should reject empty URLs', () => {
        expect(isValidUrl('')).toBe(false);
        expect(isValidUrl('   ')).toBe(false);
      });

      it('should reject null/undefined', () => {
        expect(isValidUrl(null as any)).toBe(false);
        expect(isValidUrl(undefined as any)).toBe(false);
      });

      it('should reject non-string values', () => {
        expect(isValidUrl(123 as any)).toBe(false);
        expect(isValidUrl({} as any)).toBe(false);
        expect(isValidUrl([] as any)).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle URLs with whitespace', () => {
        expect(isValidUrl('  https://example.com  ')).toBe(true);
      });

      it('should accept domain-only inputs (with protocol prepending)', () => {
        expect(isValidUrl('example.com')).toBe(true);
        expect(isValidUrl('subdomain.example.com')).toBe(true);
      });

      it('should accept URLs with unicode domains', () => {
        expect(isValidUrl('https://例え.jp')).toBe(true);
      });

      it('should accept URLs with special characters in path', () => {
        expect(isValidUrl('https://example.com/path?q=hello%20world')).toBe(true);
        expect(isValidUrl('https://example.com/path#section')).toBe(true);
      });
    });
  });

  describe('sanitizeUrl', () => {
    describe('Valid URLs - No Changes', () => {
      it('should return valid HTTP/HTTPS URLs unchanged', () => {
        expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
        expect(sanitizeUrl('http://example.com/path')).toBe('http://example.com/path');
      });

      it('should return relative URLs unchanged', () => {
        expect(sanitizeUrl('/path/to/page')).toBe('/path/to/page');
        expect(sanitizeUrl('./relative')).toBe('./relative');
        expect(sanitizeUrl('../parent')).toBe('../parent');
      });

      it('should return anchor links unchanged', () => {
        expect(sanitizeUrl('#section')).toBe('#section');
        expect(sanitizeUrl('#heading-id')).toBe('#heading-id');
      });
    });

    describe('Auto-Prepend Protocol', () => {
      it('should prepend https:// to domain-only URLs', () => {
        expect(sanitizeUrl('example.com')).toBe('https://example.com');
        expect(sanitizeUrl('subdomain.example.com')).toBe('https://subdomain.example.com');
        expect(sanitizeUrl('example.co.uk')).toBe('https://example.co.uk');
      });

      it('should prepend mailto: to email addresses', () => {
        expect(sanitizeUrl('user@example.com')).toBe('mailto:user@example.com');
        expect(sanitizeUrl('test.user+tag@example.co.uk')).toBe('mailto:test.user+tag@example.co.uk');
      });
    });

    describe('Invalid URLs - Return Null', () => {
      it('should return null for dangerous protocols', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBe(null);
        expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe(null);
        expect(sanitizeUrl('vbscript:msgbox(1)')).toBe(null);
        expect(sanitizeUrl('file:///etc/passwd')).toBe(null);
      });

      it('should return null for empty/invalid input', () => {
        expect(sanitizeUrl('')).toBe(null);
        expect(sanitizeUrl('   ')).toBe(null);
        expect(sanitizeUrl(null as any)).toBe(null);
        expect(sanitizeUrl(undefined as any)).toBe(null);
      });

      it('should return null for malformed URLs', () => {
        expect(sanitizeUrl('ht!tp://invalid')).toBe(null);
        expect(sanitizeUrl('://no-protocol')).toBe(null);
      });
    });

    describe('Whitespace Handling', () => {
      it('should trim whitespace', () => {
        expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
        expect(sanitizeUrl('  example.com  ')).toBe('https://example.com');
      });
    });
  });

  describe('Security Test Cases - XSS Prevention', () => {
    it('should block all javascript: protocol variations', () => {
      const xssPayloads = [
        'javascript:alert("XSS")',
        'javascript:alert(document.cookie)',
        'javascript:void(0)',
        'JAVASCRIPT:alert(1)',
        'JaVaScRiPt:alert(1)',
        '  javascript:alert(1)  ',
      ];

      xssPayloads.forEach(payload => {
        expect(isValidUrl(payload)).toBe(false);
        expect(sanitizeUrl(payload)).toBe(null);
      });
    });

    it('should block all data: protocol variations', () => {
      const dataPayloads = [
        'data:text/html,<script>alert(1)</script>',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'data:image/svg+xml,<svg onload=alert(1)>',
        'DATA:text/html,<script>alert(1)</script>',
      ];

      dataPayloads.forEach(payload => {
        expect(isValidUrl(payload)).toBe(false);
        expect(sanitizeUrl(payload)).toBe(null);
      });
    });

    it('should only allow whitelisted protocols', () => {
      const allowedProtocols = [
        'http://example.com',
        'https://example.com',
        'mailto:user@example.com',
      ];

      allowedProtocols.forEach(url => {
        expect(isValidUrl(url)).toBe(true);
        expect(sanitizeUrl(url)).not.toBe(null);
      });
    });
  });
});
