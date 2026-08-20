import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom DOM is shared across tests in a file; unmount between tests so
// rendered trees don't leak into subsequent assertions.
afterEach(cleanup);
