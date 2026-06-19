# SSHBridge Manual Testing Checklist

## Prerequisites

```bash
cd sshbridge-cli
npm run build
npm install -g . --prefix ~/.local   # or use ./install.sh
sshbridge login
```

## Basic flow

```bash
sshbridge start DEV-CRM-1
sshbridge sessions
sshbridge exec DEV-CRM-1 -- docker ps
sshbridge exec DEV-CRM-1 -- uptime
sshbridge attach DEV-CRM-1
# Press Ctrl+] to detach
sshbridge stop DEV-CRM-1
```

## Multi-session

```bash
sshbridge start DEV-CRM-1
sshbridge start DEV-CRM-5
sshbridge sessions
sshbridge exec DEV-CRM-1 -- hostname
sshbridge exec DEV-CRM-5 -- hostname
sshbridge stop DEV-CRM-1
sshbridge stop DEV-CRM-5
```

## Auto-start via exec

```bash
sshbridge stop DEV-CRM-1
sshbridge exec DEV-CRM-1 -- pwd
sshbridge sessions
sshbridge stop DEV-CRM-1
```

## Direct exec (no daemon)

```bash
sshbridge exec DEV-CRM-1 -- docker ps --direct
```

## Exit codes

```bash
sshbridge exec DEV-CRM-1 -- "exit 42"
echo $?
# Expected: 42
```

## Status

```bash
sshbridge start DEV-CRM-1
sshbridge status DEV-CRM-1
sshbridge stop DEV-CRM-1
```

## Daemon recovery

```bash
sshbridge start DEV-CRM-1
cat ~/.local/share/sshbridge/daemon.pid
kill <daemon-pid>
sshbridge sessions
# Daemon should auto-restart; session may need restart
```

## Production safeguards

```bash
sshbridge start <PROD-SERVER>
# Should prompt for password and confirmation
```

## Legacy commands still work

```bash
sshbridge list
sshbridge connect DEV-CRM-1
sshbridge download DEV-CRM-1 /etc/hostname
sshbridge upload DEV-CRM-1 ./README.md
```
