# JJHub for Visual Studio Code

The official JJHub extension for Visual Studio Code. Browse issues, landing requests, and jj bookmarks directly from your editor.

## Features

- **Issues panel** -- View and create issues grouped by state (open / closed).
- **Landing Requests panel** -- Track landing request status with live icons.
- **Bookmarks panel** -- See jj bookmarks with change IDs.
- **Dashboard webview** -- Opens the JJHub web UI inside VSCode.
- **Status bar** -- Daemon sync status and unread notification count.
- **Daemon management** -- Auto-starts the local `jjhub` daemon on activation.

## Commands

| Command                  | Description                           |
| ------------------------ | ------------------------------------- |
| `JJHub: Open Dashboard`  | Open the JJHub dashboard webview      |
| `JJHub: Create Issue`    | Create a new issue via quick input    |
| `JJHub: Search`          | Search issues, LRs, and changes      |
| `JJHub: Sync Now`        | Trigger an immediate sync             |
| `JJHub: Open Workspace`  | Open a folder as a JJHub workspace    |

## Configuration

| Setting                  | Default                  | Description                                      |
| ------------------------ | ------------------------ | ------------------------------------------------ |
| `jjhub.daemonUrl`        | `http://localhost:4000`  | URL of the JJHub daemon API                      |
| `jjhub.autoStartDaemon`  | `true`                   | Automatically start the daemon on activation     |
| `jjhub.token`            | `""`                     | JJHub API token (leave empty for keychain)        |

## Development

```bash
pnpm install
pnpm run compile   # or: pnpm run watch
```

Press **F5** in VSCode to launch an Extension Development Host with the extension loaded.

## Packaging

```bash
pnpm run package   # produces jjhub-<version>.vsix
```
