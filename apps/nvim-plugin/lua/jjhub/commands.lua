local M = {}

local api = require("jjhub.api")
local repo = require("jjhub.repo")

--- Open a floating window with the given content lines and title.
---@param title string
---@param lines string[]
---@param opts table|nil
---@return number buf Buffer handle
---@return number win Window handle
local function open_float(title, lines, opts)
  opts = opts or {}
  local width = opts.width or math.floor(vim.o.columns * 0.6)
  local height = opts.height or math.floor(vim.o.lines * 0.6)
  local row = math.floor((vim.o.lines - height) / 2)
  local col = math.floor((vim.o.columns - width) / 2)

  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)

  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    row = row,
    col = col,
    style = "minimal",
    border = "rounded",
    title = " " .. title .. " ",
    title_pos = "center",
  })

  -- Close on q or <Esc>
  vim.keymap.set("n", "q", function()
    vim.api.nvim_win_close(win, true)
  end, { buffer = buf, nowait = true })
  vim.keymap.set("n", "<Esc>", function()
    vim.api.nvim_win_close(win, true)
  end, { buffer = buf, nowait = true })

  return buf, win
end

--- Get the repo API prefix or notify the user.
---@return string|nil prefix
local function require_repo()
  local prefix = repo.api_prefix()
  if not prefix then
    vim.notify("JJHub: Could not detect repo from cwd. Is this a jj/git repository?", vim.log.levels.ERROR)
  end
  return prefix
end

--- :JJIssues - open issue list in Telescope
local function cmd_issues()
  local has_telescope, _ = pcall(require, "telescope")
  if has_telescope then
    require("jjhub.telescope").issues()
  else
    -- Fallback: show in floating window
    local prefix = require_repo()
    if not prefix then
      return
    end
    api.request_async("GET", prefix .. "/issues", nil, function(result, err)
      if err then
        vim.notify("JJHub: Failed to fetch issues: " .. err, vim.log.levels.ERROR)
        return
      end
      local lines = {}
      for _, issue in ipairs(result or {}) do
        local author = ""
        if issue.user and issue.user.login then
          author = issue.user.login
        elseif type(issue.author) == "table" and issue.author.login then
          author = issue.author.login
        elseif type(issue.author) == "string" then
          author = issue.author
        end
        table.insert(
          lines,
          string.format("#%-4d  %-8s  %-12s  %s", issue.number or 0, issue.state or "?", author, issue.title or "")
        )
      end
      if #lines == 0 then
        table.insert(lines, "No issues found.")
      end
      open_float("Issues (" .. repo.display() .. ")", lines)
    end)
  end
end

--- :JJIssueCreate - floating window to create an issue
local function cmd_issue_create()
  local prefix = require_repo()
  if not prefix then
    return
  end

  local lines = {
    "# New Issue (" .. repo.display() .. ")",
    "# Lines starting with # are comments and will be ignored.",
    "# First non-comment line is the title.",
    "# Remaining non-comment lines are the body.",
    "",
    "",
  }

  local buf, win = open_float("Create Issue", lines, { width = 80, height = 20 })
  vim.bo[buf].modifiable = true
  vim.bo[buf].filetype = "markdown"

  -- Submit with <C-s>
  vim.keymap.set("n", "<C-s>", function()
    local content = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
    local title = nil
    local body_lines = {}
    for _, line in ipairs(content) do
      if not line:match("^#") then
        if not title and line:match("%S") then
          title = line
        elseif title then
          table.insert(body_lines, line)
        end
      end
    end

    if not title or title == "" then
      vim.notify("JJHub: Issue title is required", vim.log.levels.WARN)
      return
    end

    local body = table.concat(body_lines, "\n"):gsub("^%s+", ""):gsub("%s+$", "")

    api.request_async("POST", prefix .. "/issues", { title = title, body = body }, function(result, err)
      if err then
        vim.notify("JJHub: Failed to create issue: " .. err, vim.log.levels.ERROR)
        return
      end
      vim.api.nvim_win_close(win, true)
      vim.notify("JJHub: Issue created: #" .. (result.number or "?"), vim.log.levels.INFO)
    end)
  end, { buffer = buf })
end

--- :JJLandings - open landing request list in Telescope
local function cmd_landings()
  local has_telescope, _ = pcall(require, "telescope")
  if has_telescope then
    require("jjhub.telescope").landings()
  else
    local prefix = require_repo()
    if not prefix then
      return
    end
    api.request_async("GET", prefix .. "/landings", nil, function(result, err)
      if err then
        vim.notify("JJHub: Failed to fetch landing requests: " .. err, vim.log.levels.ERROR)
        return
      end
      local lines = {}
      for _, lr in ipairs(result or {}) do
        local author = ""
        if lr.user and lr.user.login then
          author = lr.user.login
        elseif type(lr.author) == "table" and lr.author.login then
          author = lr.author.login
        elseif type(lr.author) == "string" then
          author = lr.author
        end
        table.insert(
          lines,
          string.format("#%-4d  %-8s  %-12s  %s", lr.number or 0, lr.state or "?", author, lr.title or "")
        )
      end
      if #lines == 0 then
        table.insert(lines, "No landing requests found.")
      end
      open_float("Landing Requests (" .. repo.display() .. ")", lines)
    end)
  end
end

--- :JJChanges - open change list in Telescope
local function cmd_changes()
  local has_telescope, _ = pcall(require, "telescope")
  if has_telescope then
    require("jjhub.telescope").changes()
  else
    local prefix = require_repo()
    if not prefix then
      return
    end
    api.request_async("GET", prefix .. "/changes", nil, function(result, err)
      if err then
        vim.notify("JJHub: Failed to fetch changes: " .. err, vim.log.levels.ERROR)
        return
      end
      local lines = {}
      for _, change in ipairs(result or {}) do
        local author = ""
        if type(change.author) == "table" then
          author = change.author.login or change.author.name or ""
        elseif type(change.author) == "string" then
          author = change.author
        end
        table.insert(
          lines,
          string.format(
            "%-12s  %-12s  %s",
            change.change_id and change.change_id:sub(1, 12) or "?",
            author,
            change.description or ""
          )
        )
      end
      if #lines == 0 then
        table.insert(lines, "No changes found.")
      end
      open_float("Changes (" .. repo.display() .. ")", lines)
    end)
  end
end

--- :JJBookmarks - open bookmarks list in Telescope
local function cmd_bookmarks()
  local has_telescope, _ = pcall(require, "telescope")
  if has_telescope then
    require("jjhub.telescope").bookmarks()
  else
    local prefix = require_repo()
    if not prefix then
      return
    end
    api.request_async("GET", prefix .. "/bookmarks", nil, function(result, err)
      if err then
        vim.notify("JJHub: Failed to fetch bookmarks: " .. err, vim.log.levels.ERROR)
        return
      end
      local lines = {}
      for _, bm in ipairs(result or {}) do
        local target = ""
        if bm.change_id then
          target = bm.change_id:sub(1, 12)
        elseif bm.commit_id then
          target = bm.commit_id:sub(1, 12)
        elseif bm.target then
          target = bm.target:sub(1, 12)
        end
        table.insert(lines, string.format("%-30s  %s", bm.name or "?", target))
      end
      if #lines == 0 then
        table.insert(lines, "No bookmarks found.")
      end
      open_float("Bookmarks (" .. repo.display() .. ")", lines)
    end)
  end
end

--- :JJSearch - search with Telescope
local function cmd_search()
  local has_telescope, _ = pcall(require, "telescope")
  if has_telescope then
    require("jjhub.telescope").search()
  else
    vim.notify("JJHub: :JJSearch requires telescope.nvim", vim.log.levels.WARN)
  end
end

--- :JJWorkspace - show workspace status for current repo
local function cmd_workspace()
  local prefix = require_repo()
  if not prefix then
    return
  end

  api.request_async("GET", prefix .. "/changes", nil, function(result, err)
    if err then
      vim.notify("JJHub: Failed to fetch workspace status: " .. err, vim.log.levels.ERROR)
      return
    end

    local display = repo.display()
    local lines = {
      "Repository:  " .. display,
      "Working dir: " .. vim.fn.getcwd(),
      "",
      "--- Recent Changes ---",
      "",
    }

    if result and #result > 0 then
      for i, change in ipairs(result) do
        if i > 20 then
          table.insert(lines, "  ... and " .. (#result - 20) .. " more")
          break
        end
        local author = ""
        if type(change.author) == "table" then
          author = change.author.login or change.author.name or ""
        elseif type(change.author) == "string" then
          author = change.author
        end
        local short_id = change.change_id and change.change_id:sub(1, 12) or "?"
        table.insert(lines, string.format("  %s  %-12s  %s", short_id, author, change.description or ""))
      end
    else
      table.insert(lines, "  No changes found.")
    end

    -- Also fetch bookmarks for context
    api.request_async("GET", prefix .. "/bookmarks", nil, function(bm_result, bm_err)
      if not bm_err and bm_result and #bm_result > 0 then
        table.insert(lines, "")
        table.insert(lines, "--- Bookmarks ---")
        table.insert(lines, "")
        for _, bm in ipairs(bm_result) do
          local target = ""
          if bm.change_id then
            target = bm.change_id:sub(1, 12)
          elseif bm.target then
            target = bm.target:sub(1, 12)
          end
          table.insert(lines, string.format("  %-30s  %s", bm.name or "?", target))
        end
      end
      open_float("Workspace (" .. display .. ")", lines, { width = 80, height = 30 })
    end)
  end)
end

--- :JJSync - force sync
local function cmd_sync()
  vim.notify("JJHub: Syncing...", vim.log.levels.INFO)
  api.request_async("POST", "/api/daemon/sync", nil, function(result, err)
    if err then
      vim.notify("JJHub: Sync failed: " .. err, vim.log.levels.ERROR)
      return
    end
    vim.notify("JJHub: Sync complete", vim.log.levels.INFO)
  end)
end

--- :JJHealth - check daemon health
local function cmd_health()
  local daemon = require("jjhub.daemon")
  local running = daemon.is_running()
  if running then
    vim.notify("JJHub: Daemon is healthy", vim.log.levels.INFO)
  else
    vim.notify("JJHub: Daemon is not responding", vim.log.levels.WARN)
  end
end

--- Register all user commands.
function M.register()
  vim.api.nvim_create_user_command("JJIssues", cmd_issues, { desc = "JJHub: List issues" })
  vim.api.nvim_create_user_command("JJIssueCreate", cmd_issue_create, { desc = "JJHub: Create new issue" })
  vim.api.nvim_create_user_command("JJLandings", cmd_landings, { desc = "JJHub: List landing requests" })
  vim.api.nvim_create_user_command("JJChanges", cmd_changes, { desc = "JJHub: List changes" })
  vim.api.nvim_create_user_command("JJBookmarks", cmd_bookmarks, { desc = "JJHub: List bookmarks" })
  vim.api.nvim_create_user_command("JJSearch", cmd_search, { desc = "JJHub: Search repositories (Telescope)" })
  vim.api.nvim_create_user_command("JJWorkspace", cmd_workspace, { desc = "JJHub: Workspace status" })
  vim.api.nvim_create_user_command("JJSync", cmd_sync, { desc = "JJHub: Force sync" })
  vim.api.nvim_create_user_command("JJHealth", cmd_health, { desc = "JJHub: Check daemon health" })
end

return M
