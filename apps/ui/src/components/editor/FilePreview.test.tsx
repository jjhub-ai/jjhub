// @vitest-environment jsdom

import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

vi.mock("./MonacoEditor", () => ({
    default: (props: { language: string }) => <div data-testid="monaco-editor">{props.language}</div>,
}));

import FilePreview from "./FilePreview";

describe("FilePreview", () => {
    it("routes code files to MonacoEditor", () => {
        render(() => (
            <FilePreview
                path="src/app.ts"
                content="export const value = 1;"
                language="typescript"
                monacoEnabled
            />
        ));

        expect(screen.getByTestId("monaco-editor")).toHaveTextContent("typescript");
    });

    it("routes image files to the image viewer", () => {
        render(() => (
            <FilePreview
                path="logo.png"
                content="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
                language="plaintext"
                monacoEnabled
            />
        ));

        expect(screen.getByRole("img", { name: "logo.png" })).toBeInTheDocument();
    });

    it("renders markdown preview content for markdown files", () => {
        render(() => (
            <FilePreview
                path="README.md"
                content={"# Title\n\nA paragraph."}
                language="markdown"
                monacoEnabled={false}
            />
        ));

        expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
        expect(screen.getByText("A paragraph.", { selector: "p" })).toBeInTheDocument();
    });

    it("routes PDF content to an iframe preview when base64 content is available", () => {
        render(() => (
            <FilePreview
                path="guide.pdf"
                content="JVBERi0xLjQK"
                language="plaintext"
                monacoEnabled
            />
        ));

        expect(screen.getByTitle("guide.pdf")).toBeInTheDocument();
    });

    it("falls back to the binary placeholder for unknown binary files", () => {
        render(() => (
            <FilePreview
                path="archive.bin"
                content={"binary\u0000content"}
                language="plaintext"
                monacoEnabled
            />
        ));

        expect(screen.getByText(/Binary file preview is not available/i)).toBeInTheDocument();
    });
});
