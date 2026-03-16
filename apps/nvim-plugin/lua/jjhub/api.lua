local M = {}

--- Get the current plugin config.
---@return table
local function get_config()
  return require("jjhub").config
end

--- Build authorization headers for API requests.
---@return string[]
local function auth_headers()
  local config = get_config()
  local headers = {}
  if config.token then
    table.insert(headers, "-H")
    table.insert(headers, "Authorization: Bearer " .. config.token)
  end
  return headers
end

--- Make an HTTP request to the daemon API using curl.
---@param method string HTTP method (GET, POST, PUT, DELETE, PATCH)
---@param path string API path (e.g. "/api/v1/repos")
---@param body table|nil Request body (will be JSON-encoded)
---@return table|nil result Decoded JSON response
---@return string|nil error Error message if request failed
function M.request(method, path, body)
  local config = get_config()
  local url = config.daemon_url .. path

  local cmd = { "curl", "-s", "-X", method }

  -- Add content-type header
  table.insert(cmd, "-H")
  table.insert(cmd, "Content-Type: application/json")

  -- Add auth headers
  local headers = auth_headers()
  for _, h in ipairs(headers) do
    table.insert(cmd, h)
  end

  -- Add request body
  if body then
    table.insert(cmd, "-d")
    table.insert(cmd, vim.fn.json_encode(body))
  end

  table.insert(cmd, url)

  local result = vim.fn.system(cmd)
  local exit_code = vim.v.shell_error

  if exit_code ~= 0 then
    return nil, "curl failed with exit code " .. exit_code
  end

  if result == "" then
    return {}, nil
  end

  local ok, decoded = pcall(vim.fn.json_decode, result)
  if not ok then
    return nil, "Failed to parse JSON response: " .. result
  end

  return decoded, nil
end

--- GET request.
---@param path string
---@return table|nil, string|nil
function M.get(path)
  return M.request("GET", path, nil)
end

--- POST request.
---@param path string
---@param body table|nil
---@return table|nil, string|nil
function M.post(path, body)
  return M.request("POST", path, body)
end

--- PUT request.
---@param path string
---@param body table|nil
---@return table|nil, string|nil
function M.put(path, body)
  return M.request("PUT", path, body)
end

--- DELETE request.
---@param path string
---@return table|nil, string|nil
function M.delete(path)
  return M.request("DELETE", path, nil)
end

--- PATCH request.
---@param path string
---@param body table|nil
---@return table|nil, string|nil
function M.patch(path, body)
  return M.request("PATCH", path, body)
end

--- Make an async HTTP request (non-blocking).
---@param method string
---@param path string
---@param body table|nil
---@param callback fun(result: table|nil, err: string|nil)
function M.request_async(method, path, body, callback)
  local config = get_config()
  local url = config.daemon_url .. path

  local cmd = { "curl", "-s", "-X", method }

  table.insert(cmd, "-H")
  table.insert(cmd, "Content-Type: application/json")

  local headers = auth_headers()
  for _, h in ipairs(headers) do
    table.insert(cmd, h)
  end

  if body then
    table.insert(cmd, "-d")
    table.insert(cmd, vim.fn.json_encode(body))
  end

  table.insert(cmd, url)

  vim.fn.jobstart(cmd, {
    stdout_buffered = true,
    on_stdout = function(_, data)
      local output = table.concat(data, "\n")
      if output == "" then
        vim.schedule(function()
          callback({}, nil)
        end)
        return
      end
      local ok, decoded = pcall(vim.fn.json_decode, output)
      vim.schedule(function()
        if ok then
          callback(decoded, nil)
        else
          callback(nil, "Failed to parse JSON: " .. output)
        end
      end)
    end,
    on_stderr = function(_, data)
      local err = table.concat(data, "\n")
      if err ~= "" then
        vim.schedule(function()
          callback(nil, err)
        end)
      end
    end,
  })
end

return M
