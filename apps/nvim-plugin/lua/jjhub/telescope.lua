local M = {}

local api = require("jjhub.api")
local repo = require("jjhub.repo")

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

--- Get the API prefix for the current repo, or notify on failure.
---@return string|nil prefix
local function require_repo()
  local prefix = repo.api_prefix()
  if not prefix then
    vim.notify("JJHub: Could not detect repo from cwd. Is this a jj/git repository?", vim.log.levels.ERROR)
  end
  return prefix
end

--- Issues picker with preview.
---@param opts table|nil Telescope picker opts
function M.issues(opts)
  opts = opts or {}
  local pickers, finders, conf, actions, action_state, previewers = telescope_deps()
  if not pickers then
    return
  end

  local prefix = require_repo()
  if not prefix then
    return
  end

  local results, err = api.get(prefix .. "/issues")
  if err then
    vim.notify("JJHub: Failed to fetch issues: " .. err, vim.log.levels.ERROR)
    return
  end

  pickers
    .new(opts, {
      prompt_title = "JJHub Issues (" .. repo.display() .. ")",
      finder = finders.new_table({
        results = results or {},
        entry_maker = function(entry)
          local author = ""
          if entry.user and entry.user.login then
            author = entry.user.login
          elseif type(entry.author) == "table" and entry.author.login then
            author = entry.author.login
          elseif type(entry.author) == "string" then
            author = entry.author
          end
          return {
            value = entry,
            display = string.format(
              "#%-4d  %-8s  %-12s  %s",
              entry.number or 0,
              entry.state or "?",
              author,
              entry.title or ""
            ),
            ordinal = (entry.title or "") .. " " .. (entry.state or "") .. " " .. author,
          }
        end,
      }),
      sorter = conf.generic_sorter(opts),
      previewer = previewers.new_buffer_previewer({
        title = "Issue Details",
        define_preview = function(self, entry)
          local issue = entry.value
          local author = ""
          if issue.user and issue.user.login then
            author = issue.user.login
          elseif type(issue.author) == "table" and issue.author.login then
            author = issue.author.login
          elseif type(issue.author) == "string" then
            author = issue.author
          end
          local lines = {
            "# " .. (issue.title or "Untitled"),
            "",
            "Number:   #" .. (issue.number or "?"),
            "State:    " .. (issue.state or "unknown"),
            "Author:   " .. author,
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
          for line in (issue.body or "No description."):gmatch("[^\n]*") do
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

  local prefix = require_repo()
  if not prefix then
    return
  end

  local results, err = api.get(prefix .. "/landings")
  if err then
    vim.notify("JJHub: Failed to fetch landing requests: " .. err, vim.log.levels.ERROR)
    return
  end

  pickers
    .new(opts, {
      prompt_title = "JJHub Landing Requests (" .. repo.display() .. ")",
      finder = finders.new_table({
        results = results or {},
        entry_maker = function(entry)
          local author = ""
          if entry.user and entry.user.login then
            author = entry.user.login
          elseif type(entry.author) == "table" and entry.author.login then
            author = entry.author.login
          elseif type(entry.author) == "string" then
            author = entry.author
          end
          return {
            value = entry,
            display = string.format(
              "#%-4d  %-8s  %-12s  %s",
              entry.number or 0,
              entry.state or "?",
              author,
              entry.title or ""
            ),
            ordinal = (entry.title or "") .. " " .. (entry.state or "") .. " " .. author,
          }
        end,
      }),
      sorter = conf.generic_sorter(opts),
      previewer = previewers.new_buffer_previewer({
        title = "Landing Request Details",
        define_preview = function(self, entry)
          local lr = entry.value
          local author = ""
          if lr.user and lr.user.login then
            author = lr.user.login
          elseif type(lr.author) == "table" and lr.author.login then
            author = lr.author.login
          elseif type(lr.author) == "string" then
            author = lr.author
          end
          local change_ids = ""
          if lr.change_ids and #lr.change_ids > 0 then
            change_ids = table.concat(lr.change_ids, ", ")
          elseif lr.change_id then
            change_ids = lr.change_id
          end
          local lines = {
            "# " .. (lr.title or "Untitled"),
            "",
            "Number:          #" .. (lr.number or "?"),
            "State:           " .. (lr.state or "unknown"),
            "Author:          " .. author,
            "Target:          " .. (lr.target_bookmark or lr.base or "main"),
            "Change IDs:      " .. change_ids,
            "Stack size:      " .. tostring(lr.stack_size or 1),
            "Conflict status: " .. (lr.conflict_status or "unknown"),
            "Created:         " .. (lr.created_at or "unknown"),
            "",
            "---",
            "",
          }
          for line in (lr.body or "No description."):gmatch("[^\n]*") do
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

  local prefix = require_repo()
  if not prefix then
    return
  end

  local results, err = api.get(prefix .. "/changes")
  if err then
    vim.notify("JJHub: Failed to fetch changes: " .. err, vim.log.levels.ERROR)
    return
  end

  pickers
    .new(opts, {
      prompt_title = "JJHub Changes (" .. repo.display() .. ")",
      finder = finders.new_table({
        results = results or {},
        entry_maker = function(entry)
          local author = ""
          if type(entry.author) == "table" and entry.author.login then
            author = entry.author.login
          elseif type(entry.author) == "table" and entry.author.name then
            author = entry.author.name
          elseif type(entry.author) == "string" then
            author = entry.author
          end
          local short_id = entry.change_id and entry.change_id:sub(1, 12) or "?"
          return {
            value = entry,
            display = string.format("%-12s  %-12s  %s", short_id, author, entry.description or ""),
            ordinal = (entry.change_id or "") .. " " .. (entry.description or "") .. " " .. author,
          }
        end,
      }),
      sorter = conf.generic_sorter(opts),
      previewer = previewers.new_buffer_previewer({
        title = "Change Details",
        define_preview = function(self, entry)
          local change = entry.value
          local author = ""
          if type(change.author) == "table" then
            author = change.author.login or change.author.name or change.author.email or "unknown"
          elseif type(change.author) == "string" then
            author = change.author
          end
          local lines = {
            "Change ID:    " .. (change.change_id or "?"),
            "Author:       " .. author,
            "Timestamp:    " .. (change.timestamp or change.created_at or "unknown"),
            "",
            "Description:",
            "",
          }
          for line in (change.description or ""):gmatch("[^\n]*") do
            table.insert(lines, "  " .. line)
          end
          if change.files then
            table.insert(lines, "")
            table.insert(lines, "---")
            table.insert(lines, "")
            table.insert(lines, "Modified files:")
            for _, f in ipairs(change.files) do
              table.insert(lines, "  " .. (f.status or "M") .. "  " .. (f.path or f.filename or ""))
            end
          end
          if change.conflicts and #change.conflicts > 0 then
            table.insert(lines, "")
            table.insert(lines, "Conflicts:")
            for _, c in ipairs(change.conflicts) do
              table.insert(lines, "  ! " .. (type(c) == "string" and c or (c.path or "")))
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
            local url = change.html_url or change.url
            if url then
              vim.fn.system({ "open", url })
            else
              vim.notify("JJHub: Selected change " .. (change.change_id or "?"), vim.log.levels.INFO)
            end
          end
        end)
        return true
      end,
    })
    :find()
end

--- Bookmarks picker.
---@param opts table|nil
function M.bookmarks(opts)
  opts = opts or {}
  local pickers, finders, conf, actions, action_state, previewers = telescope_deps()
  if not pickers then
    return
  end

  local prefix = require_repo()
  if not prefix then
    return
  end

  local results, err = api.get(prefix .. "/bookmarks")
  if err then
    vim.notify("JJHub: Failed to fetch bookmarks: " .. err, vim.log.levels.ERROR)
    return
  end

  pickers
    .new(opts, {
      prompt_title = "JJHub Bookmarks (" .. repo.display() .. ")",
      finder = finders.new_table({
        results = results or {},
        entry_maker = function(entry)
          local name = entry.name or ""
          local target = ""
          if entry.change_id then
            target = entry.change_id:sub(1, 12)
          elseif entry.commit_id then
            target = entry.commit_id:sub(1, 12)
          elseif entry.target then
            target = entry.target:sub(1, 12)
          end
          return {
            value = entry,
            display = string.format("%-30s  %s", name, target),
            ordinal = name .. " " .. target,
          }
        end,
      }),
      sorter = conf.generic_sorter(opts),
      previewer = previewers.new_buffer_previewer({
        title = "Bookmark Details",
        define_preview = function(self, entry)
          local bm = entry.value
          local lines = {
            "Bookmark: " .. (bm.name or "?"),
            "",
          }
          if bm.change_id then
            table.insert(lines, "Change ID:  " .. bm.change_id)
          end
          if bm.commit_id then
            table.insert(lines, "Commit:     " .. bm.commit_id)
          end
          if bm.target then
            table.insert(lines, "Target:     " .. bm.target)
          end
          if bm.remote_targets and #bm.remote_targets > 0 then
            table.insert(lines, "")
            table.insert(lines, "Remote targets:")
            for _, rt in ipairs(bm.remote_targets) do
              local remote_name = rt.remote or rt.name or "?"
              local remote_target = rt.target or rt.commit_id or "?"
              table.insert(lines, "  " .. remote_name .. " -> " .. remote_target)
            end
          end
          if bm.description then
            table.insert(lines, "")
            table.insert(lines, "Description:")
            for line in bm.description:gmatch("[^\n]*") do
              table.insert(lines, "  " .. line)
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
            local bm = selection.value
            vim.notify("JJHub: Selected bookmark '" .. (bm.name or "?") .. "'", vim.log.levels.INFO)
          end
        end)
        return true
      end,
    })
    :find()
end

--- Search picker with live query and debounce.
---@param opts table|nil
function M.search(opts)
  opts = opts or {}
  local pickers, finders, conf, actions, action_state, previewers = telescope_deps()
  if not pickers then
    return
  end

  -- Debounce state
  local debounce_timer = nil
  local debounce_ms = 300

  pickers
    .new(opts, {
      prompt_title = "JJHub Search Repositories",
      finder = finders.new_dynamic({
        fn = function(prompt)
          if not prompt or prompt == "" then
            return {}
          end

          -- Cancel any pending debounce timer
          if debounce_timer then
            debounce_timer:stop()
            debounce_timer:close()
            debounce_timer = nil
          end

          -- Synchronous debounce: sleep briefly to let fast typing settle
          local co = coroutine.running()
          if co then
            debounce_timer = vim.loop.new_timer()
            debounce_timer:start(debounce_ms, 0, vim.schedule_wrap(function()
              if debounce_timer then
                debounce_timer:stop()
                debounce_timer:close()
                debounce_timer = nil
              end
              coroutine.resume(co)
            end))
            coroutine.yield()
          end

          local results, err = api.get("/api/search/repositories?q=" .. vim.uri_encode(prompt))
          if err then
            return {}
          end
          -- The API may return { data: [...] } or a plain array
          if results and results.data and type(results.data) == "table" then
            return results.data
          end
          return results or {}
        end,
        entry_maker = function(entry)
          local full_name = entry.full_name or entry.name or "?"
          local description = entry.description or ""
          local stars = entry.stars_count or entry.stargazers_count or 0
          return {
            value = entry,
            display = string.format("%-40s  %s%s", full_name, stars > 0 and ("* " .. stars .. "  ") or "", description),
            ordinal = full_name .. " " .. description,
          }
        end,
      }),
      sorter = conf.generic_sorter(opts),
      previewer = previewers.new_buffer_previewer({
        title = "Repository Details",
        define_preview = function(self, entry)
          local r = entry.value
          local lines = {
            "# " .. (r.full_name or r.name or "?"),
            "",
            "Description:  " .. (r.description or "No description"),
            "Stars:        " .. tostring(r.stars_count or r.stargazers_count or 0),
            "Forks:        " .. tostring(r.forks_count or 0),
            "Language:     " .. (r.language or "unknown"),
            "Visibility:   " .. (r.private and "private" or "public"),
            "Created:      " .. (r.created_at or "unknown"),
            "Updated:      " .. (r.updated_at or "unknown"),
          }
          if r.clone_url then
            table.insert(lines, "Clone URL:    " .. r.clone_url)
          end
          if r.ssh_url then
            table.insert(lines, "SSH URL:      " .. r.ssh_url)
          end
          if r.topics and #r.topics > 0 then
            table.insert(lines, "Topics:       " .. table.concat(r.topics, ", "))
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
