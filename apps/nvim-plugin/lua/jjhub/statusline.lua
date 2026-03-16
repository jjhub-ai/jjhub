local M = {}

local api = require("jjhub.api")

-- Cached state for statusline (avoids blocking on every render)
local state = {
  sync_status = "offline", -- "online" | "offline" | "syncing"
  workspace = "",
  unread_count = 0,
  last_update = 0,
}

local update_interval_ms = 10000 -- 10 seconds
local timer = nil

--- Fetch latest status from daemon (async).
local function refresh()
  api.request_async("GET", "/api/v1/status", nil, function(result, err)
    if err then
      state.sync_status = "offline"
      return
    end
    state.sync_status = result.sync_status or "online"
    state.workspace = result.workspace or ""
    state.unread_count = result.unread_count or 0
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

--- Get the sync status icon and text.
---@return string
function M.sync_status()
  local icons = {
    online = "JJ:ok",
    offline = "JJ:off",
    syncing = "JJ:sync",
  }
  return icons[state.sync_status] or "JJ:?"
end

--- Get the active workspace name.
---@return string
function M.workspace()
  if state.workspace == "" then
    return ""
  end
  return state.workspace
end

--- Get unread notification count.
---@return number
function M.unread_count()
  return state.unread_count
end

--- Get unread notification count as display string.
---@return string
function M.unread_display()
  if state.unread_count == 0 then
    return ""
  end
  return tostring(state.unread_count)
end

--- Full statusline component string.
--- Suitable for use in lualine or custom statusline.
---@return string
function M.statusline()
  local parts = {}

  table.insert(parts, M.sync_status())

  local ws = M.workspace()
  if ws ~= "" then
    table.insert(parts, ws)
  end

  local unread = M.unread_display()
  if unread ~= "" then
    table.insert(parts, "(" .. unread .. ")")
  end

  return table.concat(parts, " | ")
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
      return state.sync_status ~= "offline"
    end,
  }
end

return M
