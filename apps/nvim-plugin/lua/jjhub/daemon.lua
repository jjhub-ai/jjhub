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

--- Check if the daemon is running (async, non-blocking).
---@param callback fun(running: boolean)
function M.is_running_async(callback)
  local config = get_config()
  local url = config.daemon_url .. "/health"

  vim.fn.jobstart(
    { "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "2", url },
    {
      stdout_buffered = true,
      on_stdout = function(_, data)
        local output = table.concat(data, "")
        vim.schedule(function()
          callback(output == "200")
        end)
      end,
      on_exit = function(_, code)
        if code ~= 0 then
          vim.schedule(function()
            callback(false)
          end)
        end
      end,
    }
  )
end

--- Start the daemon process.
---@return boolean success
function M.start()
  local config = get_config()
  local bin = config.daemon_bin

  vim.notify("JJHub: Starting daemon...", vim.log.levels.INFO)

  -- Extract port from daemon_url (default 4000)
  local port = config.daemon_url:match(":(%d+)$") or "4000"

  vim.fn.jobstart({ bin, "daemon", "start", "--port", port }, {
    detach = true,
    on_exit = function(_, code)
      if code ~= 0 then
        vim.schedule(function()
          vim.notify("JJHub: Daemon exited with code " .. code, vim.log.levels.WARN)
        end)
      end
    end,
  })

  -- Wait up to 10 seconds for daemon to start (polling every 200ms)
  vim.wait(10000, function()
    return M.is_running()
  end, 200)

  local running = M.is_running()
  if running then
    vim.notify("JJHub: Daemon started on port " .. port, vim.log.levels.INFO)
  else
    vim.notify("JJHub: Daemon failed to start (is '" .. bin .. "' in PATH?)", vim.log.levels.ERROR)
  end

  return running
end

--- Start the daemon process asynchronously (non-blocking).
--- Checks if the daemon is already running first, starts it if not,
--- and shows a notification when it comes up.
function M.start_async()
  local config = get_config()
  local bin = config.daemon_bin

  -- Extract port from daemon_url (default 4000)
  local port = config.daemon_url:match(":(%d+)$") or "4000"

  M.is_running_async(function(already_running)
    if already_running then
      return
    end

    vim.notify("JJHub: Starting daemon...", vim.log.levels.INFO)

    vim.fn.jobstart({ bin, "daemon", "start", "--port", port }, {
      detach = true,
      on_exit = function(_, code)
        if code ~= 0 then
          vim.schedule(function()
            vim.notify("JJHub: Daemon exited with code " .. code, vim.log.levels.WARN)
          end)
        end
      end,
    })

    -- Poll until the daemon is up (non-blocking)
    local attempts = 0
    local max_attempts = 10
    local poll_timer = vim.loop.new_timer()
    poll_timer:start(200, 200, vim.schedule_wrap(function()
      attempts = attempts + 1
      M.is_running_async(function(running)
        if running then
          poll_timer:stop()
          poll_timer:close()
          vim.notify("JJHub: Daemon started on port " .. port, vim.log.levels.INFO)
        elseif attempts >= max_attempts then
          poll_timer:stop()
          poll_timer:close()
          vim.notify("JJHub: Daemon failed to start (is '" .. bin .. "' in PATH?)", vim.log.levels.ERROR)
        end
      end)
    end))
  end)
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

--- Auto-start the daemon on setup if configured.
--- Called from init.lua setup(). Uses async start to avoid blocking editor startup.
function M.setup()
  local config = get_config()

  if not config.auto_start_daemon then
    return
  end

  -- Use non-blocking async start so we never freeze the editor during startup
  M.start_async()
end

return M
