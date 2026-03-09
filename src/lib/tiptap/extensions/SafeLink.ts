/**
 * SafeLink Extension
 * Wraps Tiptap's Link extension with URL validation to prevent XSS
 *
 * Security: Mitigates CVE-2025-14284 (XSS via unsanitized URLs)
 * - Validates URL protocol (http:, https:, mailto:)
 * - Blocks dangerous protocols (javascript:, data:, vbscript:, etc.)
 * - Sanitizes malformed URLs
 */

import Link, { LinkOptions } from '@tiptap/extension-link';

/**
 * Validates if a URL is safe to insert into the editor
 * @param url - The URL to validate
 * @returns true if URL is safe, false otherwise
 */
function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Trim whitespace
  const trimmed = url.trim();

  // Empty URLs are not valid
  if (trimmed.length === 0) {
    return false;
  }

  try {
    // Try to parse as URL
    const parsed = new URL(trimmed);

    // Only allow safe protocols
    const allowedProtocols = ['http:', 'https:', 'mailto:'];

    if (!allowedProtocols.includes(parsed.protocol)) {
      console.warn('[SafeLink] Blocked URL with unsafe protocol:', parsed.protocol);
      return false;
    }

    return true;
  } catch (error) {
    // If URL constructor fails, check if it's a relative URL or missing protocol
    // Allow relative URLs (starting with / or .)
    if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
      return true;
    }

    // If it looks like a domain without protocol, prepend https://
    // This is common user input: "example.com" → "https://example.com"
    if (/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}/.test(trimmed)) {
      // Validate with https:// prefix
      try {
        const withProtocol = new URL(`https://${trimmed}`);
        return withProtocol.protocol === 'https:';
      } catch {
        return false;
      }
    }

    // Invalid URL format
    console.warn('[SafeLink] Invalid URL format:', trimmed);
    return false;
  }
}

/**
 * Sanitizes a URL by ensuring it has a valid protocol
 * @param url - The URL to sanitize
 * @returns Sanitized URL or null if invalid
 */
function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();

  if (trimmed.length === 0) {
    return null;
  }

  // If already has protocol, validate and return
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return isValidUrl(trimmed) ? trimmed : null;
  }

  // If looks like email, add mailto:
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }

  // If relative URL, return as-is
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed;
  }

  // If looks like domain, prepend https://
  if (/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}/.test(trimmed)) {
    const withProtocol = `https://${trimmed}`;
    return isValidUrl(withProtocol) ? withProtocol : null;
  }

  // Anchor links (hash fragments)
  if (trimmed.startsWith('#')) {
    return trimmed;
  }

  return null;
}

/**
 * SafeLink extension that validates URLs before insertion
 * Extends Tiptap's Link extension with security hardening
 */
export const SafeLink = Link.extend<LinkOptions>({
  addCommands() {
    return {
      ...this.parent?.(),

      /**
       * Override setLink command to add URL validation
       */
      setLink: (attributes) => ({ commands }) => {
        // If no href or removing link, use default behavior
        if (!attributes || !attributes.href) {
          return commands.setMark(this.name, attributes);
        }

        const sanitized = sanitizeUrl(attributes.href);

        if (!sanitized) {
          console.warn('[SafeLink] Blocked invalid URL:', attributes.href);
          // Show user-friendly message
          alert('Invalid URL. Please use a valid http://, https://, or mailto: link.');
          return false;
        }

        // Validate the sanitized URL
        if (!isValidUrl(sanitized)) {
          console.warn('[SafeLink] Blocked unsafe URL after sanitization:', sanitized);
          alert('This URL is not allowed for security reasons.');
          return false;
        }

        // Set the link with sanitized URL
        return commands.setMark(this.name, {
          ...attributes,
          href: sanitized,
        });
      },

      /**
       * Override toggleLink command to add URL validation
       */
      toggleLink: (attributes) => ({ commands }) => {
        // If no href or removing link, use default behavior
        if (!attributes || !attributes.href) {
          return commands.toggleMark(this.name, attributes);
        }

        const sanitized = sanitizeUrl(attributes.href);

        if (!sanitized) {
          console.warn('[SafeLink] Blocked invalid URL:', attributes.href);
          alert('Invalid URL. Please use a valid http://, https://, or mailto: link.');
          return false;
        }

        if (!isValidUrl(sanitized)) {
          console.warn('[SafeLink] Blocked unsafe URL after sanitization:', sanitized);
          alert('This URL is not allowed for security reasons.');
          return false;
        }

        return commands.toggleMark(this.name, {
          ...attributes,
          href: sanitized,
        });
      },
    };
  },
});

// Export validation functions for testing
export { isValidUrl, sanitizeUrl };
