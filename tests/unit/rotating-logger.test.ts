import { RotatingLogger } from '../../src/utils/rotating-logger';
import { existsSync, unlinkSync, readdirSync } from 'fs';
import path from 'path';

describe('RotatingLogger', () => {
    const testLogDir = path.resolve(__dirname, '../../logs/test');
    const testLogFile = path.join(testLogDir, 'test-rotation.log');

    afterEach(() => {
        // Cleanup test log files
        try {
            if (existsSync(testLogDir)) {
                const files = readdirSync(testLogDir);
                for (const file of files) {
                    if (file.startsWith('test-rotation')) {
                        unlinkSync(path.join(testLogDir, file));
                    }
                }
            }
        } catch (err) {
            // Ignore cleanup errors
        }
    });

    it('should create a rotating logger', async () => {
        const logger = new RotatingLogger(testLogFile, {
            maxSize: '10M',
            maxFiles: 5,
            compress: true
        });

        expect(logger).toBeDefined();
        expect(logger.getLogPath()).toBe(testLogFile);
        await logger.close();
    });

    it('should write log entries', async () => {
        const logger = new RotatingLogger(testLogFile, {
            maxSize: '10M',
            maxFiles: 5,
            compress: false
        });

        await logger.log({ level: 'info', message: 'Test message 1' });
        await logger.log({ level: 'warn', message: 'Test message 2' });
        await logger.log({ level: 'error', message: 'Test message 3', details: { code: 500 } });

        await logger.close();

        // Wait for file to be written
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(existsSync(testLogFile)).toBe(true);
    });

    it('should handle log errors gracefully', async () => {
        const logger = new RotatingLogger(testLogFile, {
            maxSize: '10M',
            maxFiles: 5
        });

        // Test with circular reference (should not throw)
        const circularObj: any = { data: 'test' };
        circularObj.self = circularObj;

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        
        await logger.log(circularObj as any);
        
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to write log entry:',
            expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
        await logger.close();
    });

    it('should create log directory if not exists', async () => {
        const nestedLogFile = path.join(testLogDir, 'nested', 'deep', 'test.log');
        const logger = new RotatingLogger(nestedLogFile, {
            maxSize: '10M',
            maxFiles: 5
        });

        await logger.log({ message: 'Test' });
        await logger.close();

        expect(existsSync(path.dirname(nestedLogFile))).toBe(true);
    });

    it('should close logger gracefully', async () => {
        const logger = new RotatingLogger(testLogFile, {
            maxSize: '10M',
            maxFiles: 5
        });

        await logger.log({ message: 'Before close' });
        
        await expect(logger.close()).resolves.not.toThrow();
    });
});
