# SSHBridge Troubleshooting

## Daemon issues

### "Daemon socket not found"

The daemon is not running. It starts automatically on `start`, `exec`, `sessions`, etc.

```bash
sshbridge sessions   # auto-starts daemon
```

Check logs:

```bash
cat ~/.local/share/sshbridge/daemon.log
```

### Stale PID file

If the daemon crashed:

```bash
rm -f ~/.local/share/sshbridge/daemon.pid
rm -f ~/.local/share/sshbridge/daemon.sock
sshbridge start DEV-CRM-1
```

### Daemon won't start

1. Ensure `~/.local/share/sshbridge/` is writable
2. Rebuild: `npm run build`
3. Check for port/socket conflicts

## Session issues

### "Server not found"

Use exact server name from `sshbridge list`:

```bash
sshbridge list
sshbridge start DEV-CRM-1   # not CRM-1
```

### Session stuck in `busy`

Another exec may be running. Wait or restart:

```bash
sshbridge stop DEV-CRM-1
sshbridge start DEV-CRM-1
```

### Session keeps reconnecting

Check network and SSHBridge API availability. View status:

```bash
sshbridge status DEV-CRM-1
```

After 10 failed reconnects the session enters `error` state. Restart it:

```bash
sshbridge stop DEV-CRM-1
sshbridge start DEV-CRM-1
```

## Exec issues

### Command times out

Increase timeout:

```bash
sshbridge exec DEV-CRM-1 --timeout 60000 -- docker compose logs
```

### Wrong exit code

Exit codes are parsed from PTY output. Complex interactive commands may not work reliably. Use `--direct` for one-off connections:

```bash
sshbridge exec DEV-CRM-1 --direct -- some-command
```

### Garbled output

PTY output includes ANSI codes. The executor strips most ANSI sequences. For raw output, use `attach` instead.

## Attach issues

### Cannot attach while exec is running

Wait for exec to finish or use a separate session.

### Detach

Press `Ctrl+]` to detach without stopping the background session.

## Authentication

### Token expired

```bash
sshbridge login
```

### Production server blocked

Production servers require password verification and typing `confirm <SERVER-NAME>`.

## Logs and debugging

| File | Contents |
|------|----------|
| `~/.local/share/sshbridge/daemon.log` | Daemon events |
| `~/.local/share/sshbridge/sessions.json` | Session registry |

Enable verbose daemon logging by tailing the log while running commands:

```bash
tail -f ~/.local/share/sshbridge/daemon.log
```
