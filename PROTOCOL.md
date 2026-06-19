# SSHBridge IPC Protocol

## Transport

- Unix domain socket at `~/.local/share/sshbridge/daemon.sock`
- Newline-delimited JSON messages
- Request/response matched by `id` field

## Request format

```json
{
  "id": "req_1234567890_abc12",
  "action": "exec",
  "server": "DEV-CRM-1",
  "command": "docker ps"
}
```

## Response format

Success:

```json
{
  "id": "req_1234567890_abc12",
  "success": true,
  "data": { }
}
```

Error:

```json
{
  "id": "req_1234567890_abc12",
  "success": false,
  "error": "No active session for DEV-CRM-1"
}
```

## Actions

### `start`

Start a persistent background session.

Request:

```json
{ "action": "start", "server": "DEV-CRM-1" }
```

Response data:

```json
{ "server": "DEV-CRM-1", "status": "ready", "already": false }
```

### `exec`

Execute a command on an existing or auto-started session.

Request:

```json
{
  "action": "exec",
  "server": "DEV-CRM-1",
  "command": "docker ps",
  "timeout": 30000
}
```

Response data:

```json
{
  "stdout": "CONTAINER ID ...",
  "stderr": "",
  "exitCode": 0
}
```

### `attach`

Prepare interactive attach via local TCP proxy.

Request:

```json
{ "action": "attach", "server": "DEV-CRM-1" }
```

Response data:

```json
{ "port": 45123, "server": "DEV-CRM-1" }
```

CLI connects to `127.0.0.1:<port>` and forwards terminal I/O.

### `detach`

Release attach mode.

Request:

```json
{ "action": "detach", "server": "DEV-CRM-1" }
```

### `list`

List active background sessions.

Request:

```json
{ "action": "list" }
```

Response data:

```json
{
  "sessions": [
    {
      "serverName": "DEV-CRM-1",
      "status": "ready",
      "startedAt": 1710000000000,
      "lastUsedAt": 1710003600000,
      "reconnectCount": 0,
      "attachPort": null
    }
  ]
}
```

### `status`

Get detailed status for one session.

Request:

```json
{ "action": "status", "server": "DEV-CRM-1" }
```

### `stop`

Stop a background session.

Request:

```json
{ "action": "stop", "server": "DEV-CRM-1" }
```

Response data:

```json
{ "stopped": true }
```

### `shutdown`

Gracefully stop daemon and all sessions.

Request:

```json
{ "action": "shutdown" }
```

## Session statuses

| Status | Meaning |
|--------|---------|
| `connecting` | Session being established |
| `ready` | Available for exec |
| `busy` | Running a command |
| `attached` | Interactive attach active |
| `reconnecting` | Recovering from disconnect |
| `error` | Max reconnect attempts exceeded |
| `stopped` | Session terminated |

## Exit code marker

Commands are wrapped as:

```bash
<command>; echo "__SSHBRIDGE_EXIT__$?"
```

The executor parses `__SSHBRIDGE_EXIT__<code>` from PTY output to determine exit code.

## Timeouts

- Default IPC timeout: 30 seconds
- Default exec timeout: 30 seconds (configurable via `SSHBRIDGE_EXEC_TIMEOUT`)
