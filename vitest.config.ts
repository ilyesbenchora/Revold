import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Les tests doivent TOUJOURS tourner avec le build développement de React
// (React.act n'existe pas en production). Sur Vercel, le build pose
// NODE_ENV=production avant `vitest run` (ci-build) — on force ici, avant que
// les workers ne résolvent le module react.
process.env.NODE_ENV = "test";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.{ts,tsx}"],
    env: { NODE_ENV: "test" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
