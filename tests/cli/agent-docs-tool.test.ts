import { expect, test } from "bun:test";
import { buildDocsIndex } from "../src/agent/docs-index";
import { createJjhubDocsTool } from "../src/agent/tools/jjhub-docs";

const sampleDocs = `
# JJHub Docs

## Authentication

Use \`jjhub auth login\` to start browser login and store credentials securely.

## Agent

The local-first helper prefers JJHub docs search over guessing.
`.trim();

test("jjhub_docs_search returns matching excerpts from the cached docs index", async () => {
  const tool = createJjhubDocsTool(buildDocsIndex(sampleDocs), {
    url: "https://docs.jjhub.tech/llms-full.txt",
    status: "fresh",
    source: "cache",
  });

  const result = await tool.execute(
    "tool-call-1",
    {
      query: "browser login",
    },
    undefined,
    undefined,
    {} as never,
  );

  expect(result.content[0]?.type).toBe("text");
  expect(result.content[0]?.text).toContain("Authentication");
  expect(result.content[0]?.text).toContain("jjhub auth login");
  expect((result.details as { hits: Array<{ title: string }> }).hits[0]?.title).toContain(
    "Authentication",
  );
});

test("jjhub_docs_search annotates stale cached results", async () => {
  const tool = createJjhubDocsTool(buildDocsIndex(sampleDocs), {
    url: "https://docs.jjhub.tech/llms-full.txt",
    status: "stale",
    source: "cache",
    warning: "refresh failed",
  });

  const result = await tool.execute(
    "tool-call-2",
    {
      query: "local-first helper",
    },
    undefined,
    undefined,
    {} as never,
  );

  expect(result.content[0]?.type).toBe("text");
  expect(result.content[0]?.text).toContain("local-first helper");
  expect(result.content[0]?.text).toContain("Using cached JJHub docs");
});
