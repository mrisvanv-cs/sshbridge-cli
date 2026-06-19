import { Socket } from 'socket.io-client';
import { daemonConfig, EXIT_MARKER } from '../config';
import { ExecResult } from './types';

const ANSI_REGEX = /\x1b\[[0-9;?]*[a-zA-Z]/g;

function stripAnsi(text: string): string {
    return text.replace(ANSI_REGEX, '');
}

function stripCommandEcho(cleaned: string, command: string): string {
    const lines = stripAnsi(cleaned).split('\n');
    const filtered = lines.filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        if (trimmed.includes(EXIT_MARKER)) return false;
        if (/; echo ["']?__SSHBRIDGE_EXIT__/.test(trimmed)) return false;
        if (/^csiq@.*\$$/.test(trimmed)) return false;
        if (trimmed.startsWith(']0;')) return false;
        if (/^\?2004[hl]$/.test(trimmed)) return false;
        return true;
    });
    return filtered.join('\n').trim();
}

function parseExitMarker(output: string, command: string): { cleaned: string; exitCode: number | null } {
    const regex = new RegExp(`${EXIT_MARKER}(\\d+)`, 'g');
    let exitCode: number | null = null;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(output)) !== null) {
        exitCode = parseInt(match[1], 10);
    }

    const withoutMarker = stripAnsi(output.replace(/\r/g, '\n').replace(regex, '')).trimEnd();
    const cleaned = stripCommandEcho(withoutMarker, command);
    return { cleaned, exitCode };
}

export async function executeCommand(
    socket: Socket,
    command: string,
    timeoutMs: number = daemonConfig.execTimeout
): Promise<ExecResult> {
    return new Promise<ExecResult>((resolve, reject) => {
        let output = '';
        let settled = false;
        let idleTimer: NodeJS.Timeout | null = null;
        let capturing = false;

        const finish = (result: ExecResult) => {
            if (settled) return;
            settled = true;
            socket.off('output', onOutput);
            if (idleTimer) clearTimeout(idleTimer);
            resolve(result);
        };

        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            socket.off('output', onOutput);
            if (idleTimer) clearTimeout(idleTimer);
            reject(error);
        };

        const resetIdleTimer = () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                const { cleaned, exitCode } = parseExitMarker(output, command);
                finish({
                    stdout: cleaned,
                    stderr: '',
                    exitCode: exitCode ?? 0
                });
            }, 500);
        };

        const onOutput = (data: string) => {
            if (!capturing) return;
            output += data;
            const { exitCode } = parseExitMarker(output, command);
            if (exitCode !== null) {
                const { cleaned } = parseExitMarker(output, command);
                finish({
                    stdout: cleaned,
                    stderr: '',
                    exitCode
                });
                return;
            }
            resetIdleTimer();
        };

        socket.on('output', onOutput);

        const wrappedCommand = `${command}; echo "${EXIT_MARKER}$?"`;
        capturing = true;
        socket.emit('input', Buffer.from(wrappedCommand + '\n'));

        setTimeout(() => {
            fail(new Error(`Command timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
}

export function printExecResult(result: ExecResult): void {
    if (result.stdout) {
        process.stdout.write(result.stdout + (result.stdout.endsWith('\n') ? '' : '\n'));
    }
    if (result.stderr) {
        process.stderr.write(result.stderr + (result.stderr.endsWith('\n') ? '' : '\n'));
    }
}
