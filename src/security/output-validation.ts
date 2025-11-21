import { appendFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

export type OutputValidationMode = 'warn' | 'mask' | 'block';

export interface OutputValidationContext {
    toolName: string;
}

export interface OutputValidationFinding {
    type: string;
    occurrences: number;
    samples: string[];
}

export interface OutputValidationResult<TOutput = unknown> {
    safe: boolean;
    warnings: string[];
    findings: OutputValidationFinding[];
    size: number;
    originalOutput: TOutput;
}

interface PatternDefinition {
    type: string;
    regex: RegExp;
    placeholder: string;
}

export class OutputValidator {
    private static readonly PII_PATTERNS: PatternDefinition[] = [
        {
            type: 'email',
            regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,
            placeholder: '[MASKED_EMAIL]'
        },
        {
            type: 'phone',
            regex: /(\+\d{1,3}[-.]?)?(?:\(\d{3}\)|\d{3})[-.]?\d{3}[-.]?\d{4}\b/g,
            placeholder: '[MASKED_PHONE]'
        },
        {
            type: 'ssn',
            regex: /\b\d{3}-\d{2}-\d{4}\b/g,
            placeholder: '[MASKED_SSN]'
        },
        {
            type: 'creditCard',
            regex: /\b(?:\d[ -]*?){13,16}\b/g,
            placeholder: '[MASKED_CARD]'
        }
    ];

    static validateOutput<TOutput>(output: TOutput, context: OutputValidationContext): OutputValidationResult<TOutput> {
        const fragments = this.collectFragments(output);
        const warnings: string[] = [];
        const findings: OutputValidationFinding[] = [];
        const size = fragments.reduce((acc, fragment) => acc + fragment.length, 0);

        for (const definition of this.PII_PATTERNS) {
            const occurrences = this.countOccurrences(fragments, definition);
            if (occurrences.count > 0) {
                const warning = `Potential ${definition.type} detected (${occurrences.count}) in ${context.toolName} output`;
                warnings.push(warning);
                findings.push({
                    type: definition.type,
                    occurrences: occurrences.count,
                    samples: occurrences.samples
                });
            }
        }

        if (size > this.getLargeOutputThreshold()) {
            warnings.push(`Large output detected (${size} chars). Consider pagination or limiting response size.`);
        }

        const safe = warnings.length === 0;

        if (!safe) {
            this.logWarnings(context.toolName, warnings, findings, size);
        }

        return { safe, warnings, findings, size, originalOutput: output };
    }

    static maskPII<TOutput>(output: TOutput): TOutput {
        return this.maskValue(output) as TOutput;
    }

    static getStrictness(): OutputValidationMode {
        const raw = (process.env.OUTPUT_VALIDATION_MODE || 'warn').toLowerCase();
        if (raw === 'mask' || raw === 'block' || raw === 'warn') {
            return raw;
        }
        return 'warn';
    }

    private static maskValue(value: any): any {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof value === 'string') {
            let masked = value;
            for (const definition of this.PII_PATTERNS) {
                const regex = new RegExp(definition.regex.source, definition.regex.flags);
                masked = masked.replace(regex, definition.placeholder);
            }
            return masked;
        }

        if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map(item => this.maskValue(item));
        }

        if (typeof value === 'object') {
            if (value instanceof Date) {
                return value;
            }
            const clone: Record<string, any> = {};
            for (const [key, nestedValue] of Object.entries(value)) {
                clone[key] = this.maskValue(nestedValue);
            }
            return clone;
        }

        return value;
    }

    private static countOccurrences(fragments: string[], definition: PatternDefinition) {
        let count = 0;
        const samples: string[] = [];
        for (const fragment of fragments) {
            if (!fragment) continue;
            const regex = new RegExp(definition.regex.source, definition.regex.flags);
            const matches = fragment.match(regex);
            if (matches) {
                count += matches.length;
                for (const match of matches) {
                    if (samples.length < 3) {
                        samples.push(match.slice(0, 64));
                    } else {
                        break;
                    }
                }
            }
        }
        return { count, samples };
    }

    private static collectFragments(value: any, fragments: string[] = []): string[] {
        if (value === null || value === undefined) {
            return fragments;
        }

        if (typeof value === 'string') {
            fragments.push(value);
            return fragments;
        }

        if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
            fragments.push(String(value));
            return fragments;
        }

        if (Array.isArray(value)) {
            for (const entry of value) {
                this.collectFragments(entry, fragments);
            }
            return fragments;
        }

        if (typeof value === 'object') {
            if (value instanceof Date) {
                fragments.push(value.toISOString());
                return fragments;
            }
            for (const entry of Object.values(value)) {
                this.collectFragments(entry, fragments);
            }
            return fragments;
        }

        return fragments;
    }

    private static logWarnings(toolName: string, warnings: string[], findings: OutputValidationFinding[], size: number): void {
        const entry = {
            timestamp: new Date().toISOString(),
            toolName,
            warnings,
            findings,
            size,
            strictness: this.getStrictness()
        };

        try {
            const logPath = this.getAuditLogPath();
            this.ensureDirectory(path.dirname(logPath));
            appendFileSync(logPath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
        } catch (error) {
            console.error('Failed to persist output validation log entry', error);
        }
    }

    private static ensureDirectory(dirPath: string): void {
        if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
        }
    }

    private static getAuditLogPath(): string {
        return process.env.OUTPUT_VALIDATION_LOG_PATH
            ? path.resolve(process.env.OUTPUT_VALIDATION_LOG_PATH)
            : path.resolve(process.cwd(), 'logs', 'output-validation.log');
    }

    private static getLargeOutputThreshold(): number {
        const raw = Number(process.env.OUTPUT_VALIDATION_MAX_LENGTH);
        if (!Number.isNaN(raw) && raw > 0) {
            return raw;
        }
        return 50000;
    }
}
