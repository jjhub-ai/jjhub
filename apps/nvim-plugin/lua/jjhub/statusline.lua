local M = {}

local api = require("jjhub.api")

-- Cached state for statusline (avoids blocking on every render)
local state = {
  online = false,
  pending_count = 0,
  workspace = "",
  workspace_status = "",
  last_update = 0,
}

local update_interval_ms = 10000 -- 10 seconds
local timer = nil

--- Fetch latest status from daemon (async).
local function refresh()
  api.request_async("GET", "/api/daemon/status", nil, function(result, err)
    if err then
      state.online = false
      return
    end
    state.online = true
    state.pending_count = result.pending_count or result.pending or 0
    state.workspace = result.workspace or ""
    state.workspace_status = result.workspace_status or ""
    state.last_update = vim.loop.now()
  end)
end

--- Start the background polling timer.
function M.start_polling()
  if timer then
    return
  end
  timer = vim.loop.new_timer()
  timer:start(0, update_interval_ms, vim.schedule_wrap(function()
    refresh()
  end))
end

--- Stop the background polling timer.
function M.stop_polling()
  if timer then
    timer:stop()
    timer:close()
    timer = nil
  end
end

--- Get whether the daemon is online.
---@return boolean
function M.is_online()
  return state.online
end

--- Get the pending sync count.
---@return number
function M.pending_count()
  return state.pending_count
end

--- Get the active workspace name.
---@return string
function M.workspace()
  return state.workspace
end

--- Get the workspace status string.
---@return string
function M.workspace_status()
  return state.workspace_status
end

--- Full statusline component string.
--- Format: "JJ: * online | 0 pending" or "JJ: o offline | 3 pending"
--- If in a workspace, appends workspace info.
---@return string
function M.statusline()
  local parts = {}

  if state.online then
    table.insert(parts, "JJ: \xe2\x97\x8f online")
  else
    table.insert(parts, "JJ: \xe2\x97\x8b offline")
  end

  table.insert(parts, tostring(state.pending_count) .. " pending")

  local result = table.concat(parts, " | ")

  -- Append workspace info if available
  if state.workspace ~= "" then
    result = result .. " | " .. state.workspace
    if state.workspace_status ~= "" then
      result = result .. " (" .. state.workspace_status .. ")"
    end
  end

  return result
end

--- Lualine component table.
--- Usage in lualine config:
---   lualine_x = { require("jjhub.statusline").lualine_component() }
---@return table
function M.lualine_component()
  -- Start polling when lualine loads this
  M.start_polling()

  return {
    function()
      return M.statusline()
    end,
    cond = function()
      -- Always show the statusline so users see online/offline state
      return true
    end,
  }
end

return M
