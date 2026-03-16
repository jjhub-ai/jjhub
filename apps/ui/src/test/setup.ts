import { cleanup } from "@solidjs/testing-library";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
    cleanup();
});
