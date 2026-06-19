import net from 'net';
import { Socket } from 'socket.io-client';
import { logDaemon } from './lifecycle';

export interface AttachProxy {
    port: number;
    close: () => void;
}

export function createAttachProxy(socket: Socket, onDetach: () => void): Promise<AttachProxy> {
    return new Promise((resolve, reject) => {
        const server = net.createServer((client) => {
            logDaemon('Attach client connected');

            const onSocketOutput = (data: string) => {
                if (!client.destroyed) {
                    client.write(data);
                }
            };

            client.on('data', (chunk) => {
                socket.emit('input', chunk);
            });

            client.on('end', () => {
                socket.off('output', onSocketOutput);
                onDetach();
                logDaemon('Attach client disconnected');
            });

            client.on('error', () => {
                socket.off('output', onSocketOutput);
                onDetach();
            });

            socket.on('output', onSocketOutput);
        });

        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('Failed to acquire attach proxy port'));
                return;
            }

            resolve({
                port: address.port,
                close: () => {
                    server.close();
                }
            });
        });

        server.on('error', reject);
    });
}
