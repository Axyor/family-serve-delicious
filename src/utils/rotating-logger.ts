import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Writable } from 'stream';

/**
 * Configuration options for the rotating logger
 */
export interface RotatingLoggerOptions {
    /** Maximum size per file (e.g., '10M' for 10 MB) */
    maxSize?: '10M' | '20M' | '50M' | '100M';
    /** Maximum number of rotated files to keep */
    maxFiles?: number;
    /** Whether to compress old log files with gzip */
    compress?: boolean;
    /** Rotation interval (e.g., '1d' for daily rotation) */
    interval?: '1d' | '7d' | '1h' | '1m';
}

interface RotatingStreamOptions {
    size: string;
    maxFiles: number;
    compress: 'gzip' | false;
    path: string;
    interval?: string;
}

/**
 * RotatingLogger - Provides automatic log rotation with configurable size, retention, and compression
 * 
 * Features:
 * - Automatic rotation by size and/or time
 * - Gzip compression of old logs
 * - Configurable retention policy
 * - JSON-based structured logging
 * 
 * @example
 * ```typescript
 * const logger = new RotatingLogger('logs/app.log', {
 *     maxSize: '10M',
 *     maxFiles: 10,
 *     compress: true
 * });
 * 
 * logger.log({ level: 'info', message: 'Server started' });
 * ```
 */
export class RotatingLogger {
    private stream: Writable;
    private logPath: string;

    constructor(filename: string, options?: RotatingLoggerOptions) {
        this.logPath = filename;
        const logDir = path.dirname(filename);
        const logBase = path.basename(filename);

        if (!existsSync(logDir)) {
            mkdirSync(logDir, { recursive: true });
        }

        const rfs = require('rotating-file-stream');

        const streamOptions: RotatingStreamOptions = {
            size: options?.maxSize || '10M',
            maxFiles: options?.maxFiles || 10,
            compress: options?.compress !== false ? 'gzip' : false,
            path: logDir
        };

        if (options?.interval) {
            streamOptions.interval = options.interval;
        }

        this.stream = rfs.createStream(logBase, streamOptions);

        this.stream.on('error', (err: Error) => {
            console.error('Rotating logger error:', err);
        });
    }

    /**
     * Write a log entry to the rotating file
     * @param entry - Object to be logged (will be JSON stringified)
     */
    log(entry: Record<string, unknown>): void {
        try {
            const logLine = JSON.stringify(entry) + '\n';
            this.stream.write(logLine);
        } catch (err) {
            console.error('Failed to write log entry:', err);
        }
    }

    /**
     * Close the log stream gracefully
     * @returns Promise that resolves when the stream is closed
     */
    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.stream.end((err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Get the path to the current log file
     */
    getLogPath(): string {
        return this.logPath;
    }
}
