local M = {}

M.config = {
  daemon_url = "http://localhost:4000",
  auto_start_daemon = true,
  token = nil, -- read from JJHUB_TOKEN env var if nil
  daemon_bin = "jjhub",
  statusline = {
    enabled = true,
  },
}

--- Merge user config with defaults.
---@param opts table|nil
function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})

  if not M.config.token then
    M.config.token = vim.env.JJHUB_TOKEN
  end

  local daemon = require("jjhub.daemon")
  local commands = require("jjhub.commands")

  -- Auto-start daemon if configured (non-blocking)
  daemon.setup()

  -- Register all user commands
  commands.register()
end

return M
