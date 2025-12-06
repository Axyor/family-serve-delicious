import { OutputValidator } from '../../src/security/output-validation';
import { existsSync, unlinkSync, readdirSync, readFileSync } from 'fs';
import path from 'path';

describe('Output Validation with Rotating Logs', () => {
    const testLogPath = path.resolve(__dirname, '../../logs/test-output-validation.log');

    beforeAll(() => {
        process.env.OUTPUT_VALIDATION_LOG_PATH = testLogPath;
        process.env.OUTPUT_VALIDATION_MODE = 'warn';
        process.env.LOG_ROTATION_SIZE = '10M';
        process.env.LOG_ROTATION_MAX_FILES = '5';
        process.env.LOG_ROTATION_COMPRESS = 'true';
    });

    afterAll(async () => {
        await OutputValidator.closeLogger();
        
        // Cleanup test log files
        try {
            const logDir = path.dirname(testLogPath);
            if (existsSync(logDir)) {
                const files = readdirSync(logDir);
                for (const file of files) {
                    if (file.startsWith('test-output-validation')) {
                        unlinkSync(path.join(logDir, file));
                    }
                }
            }
        } catch (err) {
            // Ignore cleanup errors
        }

        delete process.env.OUTPUT_VALIDATION_LOG_PATH;
        delete process.env.OUTPUT_VALIDATION_MODE;
        delete process.env.LOG_ROTATION_SIZE;
        delete process.env.LOG_ROTATION_MAX_FILES;
        delete process.env.LOG_ROTATION_COMPRESS;
    });

    it('should log validation warnings with rotation', async () => {
        const output = {
            user: {
                name: 'John Doe',
                email: 'john.doe@example.com',
                phone: '+1-555-123-4567'
            }
        };

        const result = OutputValidator.validateOutput(output, { toolName: 'test_tool' });

        expect(result.safe).toBe(false);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.findings.some(f => f.type === 'email')).toBe(true);
        expect(result.findings.some(f => f.type === 'phone')).toBe(true);

        // Wait for async log write
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(existsSync(testLogPath)).toBe(true);
    });

    it('should write structured JSON logs', async () => {
        const output = {
            data: 'Contact me at test@example.com'
        };

        OutputValidator.validateOutput(output, { toolName: 'email_tool' });

        // Wait for async log write
        await new Promise(resolve => setTimeout(resolve, 200));

        const logContent = readFileSync(testLogPath, 'utf8');
        const logLines = logContent.trim().split('\n');
        
        expect(logLines.length).toBeGreaterThan(0);

        const lastLog = JSON.parse(logLines[logLines.length - 1]);
        expect(lastLog).toHaveProperty('timestamp');
        expect(lastLog).toHaveProperty('toolName', 'email_tool');
        expect(lastLog).toHaveProperty('warnings');
        expect(lastLog).toHaveProperty('findings');
        expect(lastLog).toHaveProperty('size');
        expect(lastLog).toHaveProperty('strictness');
    });

    it('should handle multiple validation warnings', async () => {
        const outputs = [
            { email: 'user1@test.com' },
            { phone: '+1-555-999-8888' },
            { card: '4111 1111 1111 1111' }
        ];

        for (const output of outputs) {
            OutputValidator.validateOutput(output, { toolName: 'multi_tool' });
        }

        // Wait for async log writes
        await new Promise(resolve => setTimeout(resolve, 300));

        expect(existsSync(testLogPath)).toBe(true);

        const logContent = readFileSync(testLogPath, 'utf8');
        const logLines = logContent.trim().split('\n').filter(line => line);
        
        expect(logLines.length).toBeGreaterThanOrEqual(3);
    });

    it('should close logger gracefully', async () => {
        await expect(OutputValidator.closeLogger()).resolves.not.toThrow();
    });
});
