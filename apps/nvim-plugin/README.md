# jjhub.nvim

Neovim plugin for [JJHub](https://jjhub.tech) -- browse issues, landing requests, changes, and search directly from your editor.

## Requirements

- Neovim >= 0.9
- `curl` on PATH
- `jjhub` CLI installed (for daemon management)
- [telescope.nvim](https://github.com/nvim-telescope/telescope.nvim) (optional, for picker UI)
- [lualine.nvim](https://github.com/nvim-lualine/lualine.nvim) (optional, for statusline)

## Installation

### lazy.nvim

```lua
{
  "jjhub-ai/jjhub",
  config = function()
    require("jjhub").setup()
  end,
  dependencies = {
    "nvim-telescope/telescope.nvim", -- optional
  },
}
```

### packer.nvim

```lua
use {
  "jjhub-ai/jjhub",
  config = function()
    require("jjhub").setup()
  end,
  requires = {
    "nvim-telescope/telescope.nvim", -- optional
  },
}
```

## Configuration

```lua
require("jjhub").setup({
  -- Daemon API URL (default: http://localhost:4000)
  daemon_url = "http://localhost:4000",

  -- Auto-start daemon if not running (default: true)
  auto_start_daemon = true,

  -- Auth token. Falls back to JJHUB_TOKEN env var if nil.
  token = nil,

  -- Path to jjhub CLI binary (default: "jjhub")
  daemon_bin = "jjhub",

  -- Statusline options
  statusline = {
    enabled = true,
  },
})
```

## Commands

| Command          | Description                          |
| ---------------- | ------------------------------------ |
| `:JJIssues`      | List issues (Telescope or float)     |
| `:JJIssueCreate` | Create a new issue in a float window |
| `:JJLandings`    | List landing requests                |
| `:JJChanges`     | List changes                         |
| `:JJSearch`      | Live search (requires Telescope)     |
| `:JJWorkspace`   | Show workspace status                |
| `:JJSync`        | Force sync with daemon               |
| `:JJHealth`      | Check daemon health                  |

## Telescope Pickers

When `telescope.nvim` is installed, `:JJIssues`, `:JJLandings`, `:JJChanges`, and `:JJSearch` open interactive Telescope pickers with previews. Without Telescope, they fall back to floating windows (except `:JJSearch` which requires Telescope).

## Statusline (lualine)

Add JJHub status to your lualine:

```lua
require("lualine").setup({
  sections = {
    lualine_x = {
      require("jjhub.statusline").lualine_component(),
    },
  },
})
```

The statusline component shows:
- Sync status (`JJ:ok` / `JJ:off` / `JJ:sync`)
- Active workspace name
- Unread notification count

## Authentication

Set the `JJHUB_TOKEN` environment variable or pass `token` in the setup config. Tokens use the `jjhub_` prefix and support fine-grained scopes.

## Daemon Management

The plugin communicates with the JJHub daemon (a local background process). By default it auto-starts the daemon on setup. You can also manage it manually:

```lua
local daemon = require("jjhub.daemon")
daemon.is_running() -- check health
daemon.start()      -- start daemon
daemon.stop()       -- stop daemon
daemon.ensure_running() -- start if not running
```

## License

See repository root for license information.
