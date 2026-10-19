import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The CSV and API tests do real file and database I/O; leave room for a slow or busy machine.
    testTimeout: 20_000,
  },
});
