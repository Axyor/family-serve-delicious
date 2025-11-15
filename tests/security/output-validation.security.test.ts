import { OutputValidator, OutputValidationResult } from '../../src/security/output-validation';

describe('Security: Output Validation', () => {
    beforeEach(() => {
        delete process.env.OUTPUT_VALIDATION_MODE;
        delete process.env.OUTPUT_VALIDATION_MAX_LENGTH;
    });

    const buildToolResponse = (text: string) => ({
        content: [
            {
                type: 'text' as const,
                text
            }
        ]
    });

    test('detects emails inside tool responses', () => {
        const response = buildToolResponse('Contact me at admin@example.com for details.');
        const validation = OutputValidator.validateOutput(response, { toolName: 'test-tool' });
        expect(validation.safe).toBe(false);
        expect(validation.warnings[0]).toContain('email');
        expect(validation.findings[0].occurrences).toBe(1);
    });

    test('detects phone numbers and captures samples', () => {
        const response = buildToolResponse('Call +1 (555) 111-2222 or (123)456-7890.');
        const validation = OutputValidator.validateOutput(response, { toolName: 'test-tool' });
        expect(validation.safe).toBe(false);
        const phoneFinding = validation.findings.find(finding => finding.type === 'phone');
        expect(phoneFinding).toBeDefined();
        expect(phoneFinding?.occurrences).toBeGreaterThanOrEqual(1);
        expect(phoneFinding?.samples.length).toBeGreaterThan(0);
    });

    test('masks detected PII when requested', () => {
        const response = buildToolResponse('Reach Sarah at sarah@example.com or 555-123-4567.');
        const masked = OutputValidator.maskPII(response);
        expect(masked.content[0].text).not.toContain('sarah@example.com');
        expect(masked.content[0].text).not.toContain('555-123-4567');
        expect(masked.content[0].text).toContain('[MASKED_EMAIL]');
        expect(masked.content[0].text).toContain('[MASKED_PHONE]');
    });

    test('handles nested data structures', () => {
        const complexOutput = {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        members: [
                            { name: 'Alice', contact: 'alice@example.com' },
                            { name: 'Bob', phone: '555-222-1111' }
                        ]
                    })
                }
            ]
        };

        const validation = OutputValidator.validateOutput(complexOutput, { toolName: 'group-recipe-context' });
        expect(validation.safe).toBe(false);
        expect(validation.findings.length).toBeGreaterThanOrEqual(1);
    });

    test('flags overly large outputs', () => {
        process.env.OUTPUT_VALIDATION_MAX_LENGTH = '100';
        const bigPayload = buildToolResponse('X'.repeat(150));
        const validation = OutputValidator.validateOutput(bigPayload, { toolName: 'test-tool' });
        expect(validation.safe).toBe(false);
        expect(validation.warnings.some(warning => warning.includes('Large output'))).toBe(true);
    });

    test('returns safe=true when no PII is present', () => {
        const validation: OutputValidationResult = OutputValidator.validateOutput(
            buildToolResponse('An anonymized summary without sensitive data.'),
            { toolName: 'groups-summary' }
        );
        expect(validation.safe).toBe(true);
        expect(validation.warnings).toHaveLength(0);
    });
});
