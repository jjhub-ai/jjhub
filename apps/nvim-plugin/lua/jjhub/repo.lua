local M = {}

--- Cache of owner/repo per working directory.
---@type table<string, {owner: string, repo: string}|false>
local cache = {}

--- Parse a remote URL to extract owner/repo.
--- Supports SSH (git@host:owner/repo.git) and HTTPS (https://host/owner/repo.git) formats.
---@param url string
---@return string|nil owner
---@return string|nil repo
local function parse_remote_url(url)
  -- SSH format: git@jjhub.tech:owner/repo.git or ssh://git@host/owner/repo.git
  local owner, repo = url:match("[:/@]([^/]+)/([^/%.]+)%.git%s*$")
  if owner and repo then
    return owner, repo
  end
  -- Without .git suffix
  owner, repo = url:match("[:/@]([^/]+)/([^/%.%s]+)%s*$")
  if owner and repo then
    return owner, repo
  end
  return nil, nil
end

--- Read a git config file and extract the first remote URL that points to jjhub.tech.
--- Falls back to the first remote URL if no jjhub remote is found.
---@param config_path string
---@return string|nil owner
---@return string|nil repo
local function parse_git_config(config_path)
  local f = io.open(config_path, "r")
  if not f then
    return nil, nil
  end
  local content = f:read("*a")
  f:close()

  local first_owner, first_repo = nil, nil

  -- Iterate over remote sections
  for url in content:gmatch('%[remote %"[^"]+"%].-url%s*=%s*([^\n]+)') do
    local owner, repo = parse_remote_url(url)
    if owner and repo then
      -- Prefer jjhub.tech remotes
      if url:find("jjhub%.tech") then
        return owner, repo
      end
      if not first_owner then
        first_owner, first_repo = owner, repo
      end
    end
  end

  return first_owner, first_repo
end

--- Detect owner/repo from the given directory by looking for .jj or .git configs.
---@param cwd string
---@return string|nil owner
---@return string|nil repo
local function detect_from_dir(cwd)
  -- Walk up from cwd to find .jj or .git
  local dir = cwd
  while dir and dir ~= "" and dir ~= "/" do
    -- Check for .jj/repo/store/git (jj-native repo backed by git)
    local jj_git_config = dir .. "/.jj/repo/store/git/config"
    local owner, repo = parse_git_config(jj_git_config)
    if owner and repo then
      return owner, repo
    end

    -- Check for .jj/repo/store/git as a file (contains path to git dir)
    local jj_git_pointer = dir .. "/.jj/repo/store/git"
    local pf = io.open(jj_git_pointer, "r")
    if pf then
      local pointer_content = pf:read("*a")
      pf:close()
      -- If it's a path to a git directory, try reading its config
      local git_dir = pointer_content:gsub("%s+$", "")
      if git_dir ~= "" and not git_dir:find("^%[") then
        owner, repo = parse_git_config(git_dir .. "/config")
        if owner and repo then
          return owner, repo
        end
      end
    end

    -- Check for .git/config
    local git_config = dir .. "/.git/config"
    owner, repo = parse_git_config(git_config)
    if owner and repo then
      return owner, repo
    end

    -- Check for .git as a file (worktree)
    local git_file = dir .. "/.git"
    local gf = io.open(git_file, "r")
    if gf then
      local git_content = gf:read("*a")
      gf:close()
      local gitdir = git_content:match("gitdir:%s*(.+)")
      if gitdir then
        gitdir = gitdir:gsub("%s+$", "")
        if not gitdir:match("^/") then
          gitdir = dir .. "/" .. gitdir
        end
        owner, repo = parse_git_config(gitdir .. "/config")
        if owner and repo then
          return owner, repo
        end
      end
    end

    -- Move up one directory
    dir = dir:match("(.+)/[^/]+$")
  end

  return nil, nil
end

--- Get owner/repo for the current working directory.
--- Results are cached per cwd.
---@param cwd string|nil Optional cwd override; defaults to vim.fn.getcwd()
---@return string|nil owner
---@return string|nil repo
function M.detect(cwd)
  cwd = cwd or vim.fn.getcwd()

  -- Return cached result
  if cache[cwd] ~= nil then
    if cache[cwd] == false then
      return nil, nil
    end
    return cache[cwd].owner, cache[cwd].repo
  end

  local owner, repo = detect_from_dir(cwd)
  if owner and repo then
    cache[cwd] = { owner = owner, repo = repo }
  else
    cache[cwd] = false
  end

  return owner, repo
end

--- Build the API path prefix for the current repo.
--- Returns nil if repo cannot be detected.
---@param cwd string|nil
---@return string|nil path like "/api/repos/owner/repo"
function M.api_prefix(cwd)
  local owner, repo = M.detect(cwd)
  if not owner or not repo then
    return nil
  end
  return "/api/repos/" .. owner .. "/" .. repo
end

--- Clear the detection cache (useful when switching projects).
function M.clear_cache()
  cache = {}
end

--- Get a display string for the current repo.
---@param cwd string|nil
---@return string like "owner/repo" or "unknown"
function M.display(cwd)
  local owner, repo = M.detect(cwd)
  if owner and repo then
    return owner .. "/" .. repo
  end
  return "unknown"
end

return M
