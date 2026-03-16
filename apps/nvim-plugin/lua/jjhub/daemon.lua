local M = {}

--- Get current plugin config.
---@return table
local function get_config()
  return require("jjhub").config
end

--- Check if the daemon is running by hitting its health endpoint.
---@return boolean
function M.is_running()
  local config = get_config()
  local url = config.daemon_url .. "/health"

  local result = vim.fn.system({ "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "2", url })
  local exit_code = vim.v.shell_error

  if exit_code ~= 0 then
    return false
  end

  return result == "200"
end

--- Start the daemon process.
---@return boolean success
function M.start()
  local config = get_config()
  local bin = config.daemon_bin

  vim.notify("JJHub: Starting daemon...", vim.log.levels.INFO)

  vim.fn.jobstart({ bin, "daemon", "start" }, {
    detach = true,
    on_exit = function(_, code)
      if code ~= 0 then
        vim.schedule(function()
          vim.notify("JJHub: Daemon exited with code " .. code, vim.log.levels.WARN)
        end)
      end
    end,
  })

  -- Wait briefly for daemon to start
  vim.wait(2000, function()
    return M.is_running()
  end, 200)

  local running = M.is_running()
  if running then
    vim.notify("JJHub: Daemon started", vim.log.levels.INFO)
  else
    vim.notify("JJHub: Daemon failed to start (is '" .. bin .. "' in PATH?)", vim.log.levels.ERROR)
  end

  return running
end

--- Stop the daemon process.
---@return boolean success
function M.stop()
  local config = get_config()
  local bin = config.daemon_bin

  vim.notify("JJHub: Stopping daemon...", vim.log.levels.INFO)

  local result = vim.fn.system({ bin, "daemon", "stop" })
  local exit_code = vim.v.shell_error

  if exit_code ~= 0 then
    vim.notify("JJHub: Failed to stop daemon: " .. result, vim.log.levels.ERROR)
    return false
  end

  vim.notify("JJHub: Daemon stopped", vim.log.levels.INFO)
  return true
end

--- Ensure the daemon is running. Start it if not.
---@return boolean running
function M.ensure_running()
  if M.is_running() then
    return true
  end
  return M.start()
end

return M
