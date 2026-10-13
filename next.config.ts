import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client's node entry binds a native SQLite addon for `file:` URLs
  // (local dev/tests) — keep it external so the server bundle isn't broken by
  // the binary. Production (Turso) queries go through the pure-HTTP
  // `@libsql/client/web` entry and never load a native module.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
