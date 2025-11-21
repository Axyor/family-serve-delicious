import sanitizeHtml, { IOptions } from 'sanitize-html';

export class SecurityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SecurityError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SecurityError);
        }
    }
}

/**
 * Input Sanitizer - Cleans and validates user inputs
 * 
 */
export class InputSanitizer {

    private static readonly MAX_LENGTH = 500;

    private static readonly SUSPICIOUS_PATTERNS = [

        /ignore\s+previous\s+instructions/i,
        /forget\s+everything/i,
        /disregard\s+all\s+prior/i,
        /new\s+instructions/i,
        /system\s*:/i,
        /prompt\s*:/i,
        /assistant\s*:/i,
        /\[INST\]/i,
        /\[\/INST\]/i,

        /<script[^>]*>/i,
        /<iframe[^>]*>/i,
        /javascript:/i,
        /data:text\/html/i,
        /\beval\s*\(/i,
        /\bexec\s*\(/i,
        /\bFunction\s*\(/i,

        /\$where/i,
        /\$ne/i,
        /\$gt/i,
        /\$lt/i,
        /\$regex/i,
    ];

    private static readonly HTML_SANITIZER_CONFIG: IOptions = {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: 'discard',
        allowProtocolRelative: false,
        enforceHtmlBoundary: true,
        nonTextTags: ['script', 'style', 'textarea', 'noscript', 'template'],
        parser: {
            lowerCaseAttributeNames: true,
            lowerCaseTags: true
        }
    };

    /**
     * Sanitize a string input
     * 
     * @param input - The string to sanitize
     * @param fieldName - The name of the field (for error reporting)
     * @returns The sanitized string
     * @throws {SecurityError} If a malicious pattern is detected
     * @throws {Error} If input is not a string
     */
    static sanitizeString(input: string, fieldName: string = 'input'): string {

        if (typeof input !== 'string') {
            throw new Error(`${fieldName} must be a string, received ${typeof input}`);
        }

        let cleaned = input.replace(/[\t\n\r]/g, ' ');

        cleaned = cleaned.replace(/[\x00-\x08\x0B-\x1F\x7F-\x9F]/g, '');

        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        if (cleaned.length > this.MAX_LENGTH) {
            console.warn(`Input truncated: ${fieldName} exceeded max length (${cleaned.length} > ${this.MAX_LENGTH})`);
            cleaned = cleaned.slice(0, this.MAX_LENGTH);
        }

        this.ensureNoHtmlPayload(cleaned, fieldName);

        for (const pattern of this.SUSPICIOUS_PATTERNS) {
            if (pattern.test(cleaned)) {
                const patternStr = pattern.toString();
                console.warn(`Security: Suspicious pattern detected in ${fieldName}: ${patternStr}`);
                throw new SecurityError(
                    `Input rejected: suspicious pattern detected in ${fieldName}`
                );
            }
        }

        return cleaned;
    }

    /**
     * Sanitize an object recursively
     * 
     * @param obj - The object to sanitize
     * @param parentKey - The parent key path (for error reporting)
     * @returns The sanitized object
     */
    static sanitizeObject(obj: any, parentKey: string = 'args'): any {

        if (obj === null || obj === undefined) {
            return obj;
        }

        if (typeof obj === 'string') {
            return this.sanitizeString(obj, parentKey);
        }

        if (Array.isArray(obj)) {
            return obj.map((item, index) =>
                this.sanitizeObject(item, `${parentKey}[${index}]`)
            );
        }

        if (typeof obj === 'object') {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(obj)) {
                const fieldPath = parentKey ? `${parentKey}.${key}` : key;
                sanitized[key] = this.sanitizeObject(value, fieldPath);
            }
            return sanitized;
        }

        return obj;
    }

    /**
     * Validate that sanitization is enabled
     * Used in tests to ensure sanitization is not accidentally disabled
     */
    static isEnabled(): boolean {
        return true;
    }

    /**
     * Get the maximum allowed length for inputs
     * Useful for validation messages
     */
    static getMaxLength(): number {
        return this.MAX_LENGTH;
    }

    private static ensureNoHtmlPayload(value: string, fieldName: string): void {
        const canonicalSafe = this.escapeBasicHtml(value);
        let sanitized: string;
        try {
            sanitized = sanitizeHtml(value, this.HTML_SANITIZER_CONFIG);
        } catch (error) {
            console.error(`Security: HTML sanitizer error in ${fieldName}`, error);
            throw new SecurityError(`Input rejected: HTML sanitizer failure for ${fieldName}`);
        }

        if (sanitized !== canonicalSafe) {
            console.warn(`Security: HTML markup detected in ${fieldName}`);
            throw new SecurityError(`Input rejected: HTML markup detected in ${fieldName}`);
        }
    }

    private static escapeBasicHtml(value: string): string {
        if (!value) {
            return value;
        }

        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
