import * as vscode from "vscode";

export interface ApiError {
  message: string;
  errors: string[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export class JJHubApiClient {
  private baseUrl: string;
  private token: string | undefined;

  constructor() {
    const config = vscode.workspace.getConfiguration("jjhub");
    this.baseUrl = config.get<string>("daemonUrl", "http://localhost:4000");
    this.token = config.get<string>("token") || undefined;
  }

  /** Reload configuration (call after settings change). */
  reload(): void {
    const config = vscode.workspace.getConfiguration("jjhub");
    this.baseUrl = config.get<string>("daemonUrl", "http://localhost:4000");
    this.token = config.get<string>("token") || undefined;
  }

  /** Build headers for every request. */
  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.token) {
      h["Authorization"] = `token ${this.token}`;
    }
    return h;
  }

  /** Generic fetch wrapper that returns typed data or throws. */
  async fetch<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...this.headers(), ...(options.headers as Record<string, string> ?? {}) },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          error: {
            message: body.message ?? `HTTP ${res.status}`,
            errors: body.errors ?? [],
          },
        };
      }

      const data = (await res.json()) as T;
      return { data };
    } catch (err: unknown) {
      return {
        error: {
          message: err instanceof Error ? err.message : "Unknown error",
          errors: ["Failed to reach daemon"],
        },
      };
    }
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.fetch<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.fetch<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.fetch<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async del<T>(path: string): Promise<ApiResponse<T>> {
    return this.fetch<T>(path, { method: "DELETE" });
  }

  // ── Convenience helpers ─────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    const res = await this.get<{ status: string }>("/api/v1/health");
    return res.data?.status === "ok";
  }
}
