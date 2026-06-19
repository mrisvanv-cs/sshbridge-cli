# SSHBridge Architecture

## Overview

SSHBridge CLI connects to remote servers through a Socket.IO bridge to the SSHBridge API. The persistent session daemon keeps connections alive locally so repeated commands do not require reconnecting.

## Components

### CLI (`src/index.ts`)

Commander-based entry point exposing:

- Interactive: `connect`, `attach`
- Background sessions: `start`, `stop`, `sessions`, `status`
- Automation: `exec`
- File transfer: `download`, `upload`

### Session layer (`src/session/`)

| Module | Responsibility |
|--------|----------------|
| `connection.ts` | Create API session, open Socket.IO, wait for SSH ready |
| `resolver.ts` | Resolve server by name, ID, or index |
| `executor.ts` | Run commands over PTY with exit marker |
| `safeguards.ts` | Production server confirmation flows |
| `types.ts` | Shared TypeScript interfaces |

### Daemon (`src/daemon/`)

| Module | Responsibility |
|--------|----------------|
| `daemon.ts` | Main daemon process and IPC request routing |
| `lifecycle.ts` | Start/stop daemon, IPC client/server |
| `registry.ts` | Persist session metadata to disk |
| `socket-manager.ts` | Manage live sockets, exec queue, reconnect, keepalive |
| `tcp-proxy.ts` | Local TCP proxy for `attach` |
| `ipc.ts` | IPC message types and serialization |

## Data flow

### Background session start

```
sshbridge start DEV-CRM-1
  -> ensureDaemonRunning()
  -> IPC { action: start }
  -> resolve server via REST API
  -> POST /api/ssh-session
  -> Socket.IO connect + auth + startSSH
  -> wait for first output (SSH ready)
  -> registry upsert status=ready
```

### Exec via daemon

```
sshbridge exec DEV-CRM-1 -- docker ps
  -> ensureDaemonRunning()
  -> IPC { action: exec, command }
  -> socket-manager queues command
  -> emit input: "docker ps; echo __SSHBRIDGE_EXIT__$?"
  -> capture output until marker
  -> return stdout + exitCode
```

### Attach

```
sshbridge attach DEV-CRM-1
  -> IPC { action: attach }
  -> daemon creates TCP server on 127.0.0.1:random
  -> CLI connects to TCP port
  -> stdin/stdout <-> TCP <-> Socket.IO input/output
  -> Ctrl+] sends detach IPC message
```

## Storage

| Path | Purpose |
|------|---------|
| `~/.local/share/sshbridge/daemon.sock` | Unix socket for IPC |
| `~/.local/share/sshbridge/daemon.pid` | Daemon process ID |
| `~/.local/share/sshbridge/daemon.log` | Daemon log file |
| `~/.local/share/sshbridge/sessions.json` | Session registry |

## Configuration

See `src/config.ts`. Environment overrides:

- `SSHBRIDGE_DAEMON_SOCKET` - IPC socket path
- `SSHBRIDGE_EXEC_TIMEOUT` - Command timeout (ms)

## Reliability

- **Keepalive**: Empty input every 60s on idle ready sessions
- **Reconnect**: Exponential backoff up to 10 attempts
- **Command queue**: One exec at a time per session (single PTY)
- **Graceful shutdown**: SIGTERM/SIGINT closes all sessions

## Backend dependency

The CLI uses the existing SSHBridge API:

- `POST /api/ssh-session` - Create bridge session
- Socket.IO events: `auth`, `startSSH`, `input`, `output`, `resize`, `sessionEnd`
- SCP events: `scp-download`, `scp-upload-chunk`

No backend changes are required. Exit codes are derived client-side via PTY output markers.
