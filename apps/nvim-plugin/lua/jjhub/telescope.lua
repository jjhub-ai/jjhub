local M = {}

local api = require("jjhub.api")

--- Require Telescope modules, returning nil if not available.
---@return table|nil pickers
---@return table|nil finders
---@return table|nil conf
---@return table|nil actions
---@return table|nil action_state
---@return table|nil previewers
local function telescope_deps()
  local ok_pickers, pickers = pcall(require, "telescope.pickers")
  local ok_finders, finders = pcall(require, "telescope.finders")
  local ok_config, config = pcall(require, "telescope.config")
  local ok_actions, actions = pcall(require, "telescope.actions")
  local ok_action_state, action_state = pcall(require, "telescope.actions.state")
  local ok_previewers, previewers = pcall(require, "telescope.previewers")

  if not (ok_pickers and ok_finders and ok_config and ok_actions and ok_action_state and ok_previewers) then
    vim.notify("JJHub: telescope.nvim is required for this feature", vim.log.levels.ERROR)
    return nil
  end

  return pickers, finders, config.values, actions, action_state, previewers
end

--- Issues picker with preview.
---@param opts table|nil Telescope picker opts
function M.issues(opts)
  opts = opts or {}
  local pickers, finders, conf, actions, action_state, previewers = telescope_deps()
  if not pickers then
    return
  end

  local results, err = api.get("/api/v1/issues")
  if err then
    vim.notify("JJHub: Failed to fetch issues: " .. err, vim.log.levels.ERROR)
    return
  end

  pickers
    .new(opts, {
      prompt_title = "JJHub Issues",
      finder = finders.new_table({
        results = results or {},
        entry_maker = function(entry)
          return {
            value = entry,
            display = string.format("#%d  [%s]  %s", entry.number or 0, entry.state or "?", entry.title or ""),
            ordinal = (entry.title or "") .. " " .. (entry.state or ""),
          }
        end,
      }),
      sorter = conf.generic_sorter(opts),
      previewer = previewers.new_buffer_previewer({
        title = "Issue Details",
        define_preview = function(self, entry)
          local issue = entry.value
          local lines = {
            "# " .. (issue.title or "Untitled"),
            "",
            "Number:   #" .. (issue.number or "?"),
            "State:    " .. (issue.state or "unknown"),
            "Author:   " .. (issue.user and issue.user.login or "unknown"),
            "Created:  " .. (issue.created_at or "unknown"),
            "Labels:   " .. table.concat(
              vim.tbl_map(function(l)
                return l.name or ""
              end, issue.labels or {}),
              ", "
            ),
            "",
            "---",
            "",
          }
          -- Add body lines
          for line in (issue.body or ""):gmatch("[^\n]+") do
            table.insert(lines, line)
          end
          vim.api.nvim_buf_set_lines(self.state.bufnr, 0, -1, false, lines)
          vim.bo[self.state.bufnr].filetype = "markdown"
        end,
      }),
      attach_mappings = function(prompt_bufnr, map)
        actions.select_default:replace(function()
          actions.close(prompt_bufnr)
          local selection = action_state.get_selected_entry()
          if selection then
            local issue = selection.value
            local url = issue.html_url or issue.url
            if url then
              vim.notify("JJHub: Opening issue #" .. (issue.number or "?"), vim.log.levels.INFO)
              vim.fn.system({ "open", url })
            end
          end
        end)
        return true
      end,
    })
    :find()
end

--- Landing requests picker with preview.
---@param opts table|nil
function M.landings(opts)
  opts = opts or {}
  local pickers, finders, conf, actions, action_state, previewers = telescope_deps()
  if not pickers then
    return
  end

  local results, err = api.get("/api/v1/landings")
  if err then
    vim.notify("JJHub: Failed to fetch landing requests: " .. err, vim.log.levels.ERROR)
    return
  end

  pickers
    .new(opts, {
      prompt_title = "JJHub Landing Requests",
      finder = finders.new_table({
        results = results or {},
        entry_maker = function(entry)
          return {
            value = entry,
            display = string.format("#%d  [%s]  %s", entry.number or 0, entry.state or "?", entry.title or ""),
            ordinal = (entry.title or "") .. " " .. (entry.state or ""),
          }
        end,
      }),
      sorter = conf.generic_sorter(opts),
      previewer = previewers.new_buffer_previewer({
        title = "Landing Request Details",
        define_preview = function(self, entry)
          local lr = entry.value
          local lines = {
            "# " .. (lr.title or "Untitled"),
            "",
            "Number:     #" .. (lr.number or "?"),
            "State:      " .. (lr.state or "unknown"),
            "Author:     " .. (lr.user and lr.user.login or "unknown"),
            "Base:       " .. (lr.base or "main"),
            "Change ID:  " .. (lr.change_id or "unknown"),
            "Created:    " .. (lr.created_at or "unknown"),
            "",
            "---",
            "",
          }
          for line in (lr.body or ""):gmatch("[^\n]+") do
            table.insert(lines, line)
          end
          vim.api.nvim_buf_set_lines(self.state.bufnr, 0, -1, false, lines)
          vim.bo[self.state.bufnr].filetype = "markdown"
        end,
      }),
      attach_mappings = function(prompt_bufnr, map)
        actions.select_default:replace(function()
          actions.close(prompt_bufnr)
          local selection = action_state.get_selected_entry()
          if selection then
            local lr = selection.value
            local url = lr.html_url or lr.url
            if url then
              vim.fn.system({ "open", url })
            end
          end
        end)
        return true
      end,
    })
    :find()
end

--- Changes picker.
---@param opts table|nil
function M.changes(opts)
  opts = opts or {}
  local pickers, finders, conf, actions, action_state, previewers = telescope_deps()
  if not pickers then
    return
  end

  local results, err = api.get("/api/v1/changes")
  if err then
    vim.notify("JJHub: Failed to fetch changes: " .. err, vim.log.levels.ERROR)
    return
  end

  pickers
    .new(opts, {
      prompt_title = "JJHub Changes",
      finder = finders.new_table({
        results = results or {},
        entry_maker = function(entry)
          return {
            value = entry,
            display = string.format(
              "%s  %s  %s",
              entry.change_id and entry.change_id:sub(1, 12) or "?",
              entry.author or "",
              entry.description or ""
            ),
            ordinal = (entry.change_id or "") .. " " .. (entry.description or "") .. " " .. (entry.author or ""),
          }
        end,
      }),
      sorter = conf.generic_sorter(opts),
      previewer = previewers.new_buffer_previewer({
        title = "Change Details",
        define_preview = function(self, entry)
          local change = entry.value
          local lines = {
            "Change ID:    " .. (change.change_id or "?"),
            "Author:       " .. (change.author or "unknown"),
            "Timestamp:    " .. (change.timestamp or "unknown"),
            "Description:  " .. (change.description or ""),
            "",
            "---",
            "",
          }
          if change.files then
            table.insert(lines, "Modified files:")
            for _, f in ipairs(change.files) do
              table.insert(lines, "  " .. (f.status or "M") .. "  " .. (f.path or ""))
            end
          end
          vim.api.nvim_buf_set_lines(self.state.bufnr, 0, -1, false, lines)
        end,
      }),
      attach_mappings = function(prompt_bufnr, map)
        actions.select_default:replace(function()
          actions.close(prompt_bufnr)
          local selection = action_state.get_selected_entry()
          if selection then
            local change = selection.value
            vim.notify("JJHub: Selected change " .. (change.change_id or "?"), vim.log.levels.INFO)
          end
        end)
        return true
      end,
    })
    :find()
end

--- Search picker with live query.
---@param opts table|nil
function M.search(opts)
  opts = opts or {}
  local pickers, finders, conf, actions, action_state, previewers = telescope_deps()
  if not pickers then
    return
  end

  pickers
    .new(opts, {
      prompt_title = "JJHub Search",
      finder = finders.new_dynamic({
        fn = function(prompt)
          if not prompt or prompt == "" then
            return {}
          end
          local results, err = api.get("/api/v1/search?q=" .. vim.uri_encode(prompt))
          if err then
            return {}
          end
          return results or {}
        end,
        entry_maker = function(entry)
          local kind = entry.type or "unknown"
          local display_text
          if kind == "issue" then
            display_text = string.format("[issue]  #%d  %s", entry.number or 0, entry.title or "")
          elseif kind == "landing" then
            display_text = string.format("[LR]     #%d  %s", entry.number or 0, entry.title or "")
          elseif kind == "repo" then
            display_text = string.format("[repo]   %s", entry.full_name or entry.name or "")
          elseif kind == "change" then
            display_text = string.format("[change] %s  %s", entry.change_id or "?", entry.description or "")
          else
            display_text = string.format("[%s]  %s", kind, entry.title or entry.name or "?")
          end
          return {
            value = entry,
            display = display_text,
            ordinal = display_text,
          }
        end,
      }),
      sorter = conf.generic_sorter(opts),
      previewer = previewers.new_buffer_previewer({
        title = "Search Result",
        define_preview = function(self, entry)
          local item = entry.value
          local lines = {}
          for k, v in pairs(item) do
            if type(v) == "string" or type(v) == "number" or type(v) == "boolean" then
              table.insert(lines, string.format("%-15s %s", k .. ":", tostring(v)))
            end
          end
          table.sort(lines)
          vim.api.nvim_buf_set_lines(self.state.bufnr, 0, -1, false, lines)
        end,
      }),
      attach_mappings = function(prompt_bufnr, map)
        actions.select_default:replace(function()
          actions.close(prompt_bufnr)
          local selection = action_state.get_selected_entry()
          if selection then
            local item = selection.value
            local url = item.html_url or item.url
            if url then
              vim.fn.system({ "open", url })
            end
          end
        end)
        return true
      end,
    })
    :find()
end

return M
