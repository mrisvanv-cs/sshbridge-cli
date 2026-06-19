export type IPCRequest =
    | { id?: string; action: 'start'; server: string }
    | { id?: string; action: 'exec'; server: string; command: string; timeout?: number }
    | { id?: string; action: 'attach'; server: string }
    | { id?: string; action: 'detach'; server: string }
    | { id?: string; action: 'list' }
    | { id?: string; action: 'status'; server: string }
    | { id?: string; action: 'stop'; server: string }
    | { id?: string; action: 'shutdown' };

export type IPCResponse =
    | { id?: string; success: true; data?: any }
    | { id?: string; success: false; error: string };

export function serializeMessage(message: IPCRequest | IPCResponse): string {
    return JSON.stringify(message) + '\n';
}

export function parseMessage(line: string): IPCRequest | IPCResponse | null {
    try {
        return JSON.parse(line.trim());
    } catch {
        return null;
    }
}
