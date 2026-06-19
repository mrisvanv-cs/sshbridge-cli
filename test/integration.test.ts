import assert from 'assert';
import { parseMessage, serializeMessage, IPCRequest } from '../src/daemon/ipc';
import { generateSessionId } from '../src/daemon/registry';
import { EXIT_MARKER } from '../src/config';

function testIpcSerialization(): void {
    const request: IPCRequest = { id: 'req_1', action: 'exec', server: 'DEV-CRM-1', command: 'docker ps' };
    const serialized = serializeMessage(request);
    const parsed = parseMessage(serialized.trim()) as IPCRequest | null;
    assert(parsed);
    assert.equal(parsed!.action, 'exec');
    if (parsed!.action === 'exec') {
        assert.equal(parsed.server, 'DEV-CRM-1');
    }
    console.log('PASS: IPC serialization');
}

function testExitMarkerParsing(): void {
    const output = `CONTAINER ID\n${EXIT_MARKER}0`;
    const regex = new RegExp(`${EXIT_MARKER}(\\d+)`, 'g');
    const match = regex.exec(output);
    assert(match);
    assert.equal(match[1], '0');
    console.log('PASS: exit marker parsing');
}

function testSessionIdFormat(): void {
    const id = generateSessionId();
    assert(id.startsWith('sess_'));
    console.log('PASS: session id format');
}

function run(): void {
    testIpcSerialization();
    testExitMarkerParsing();
    testSessionIdFormat();
    console.log('\nAll tests passed.');
}

run();
