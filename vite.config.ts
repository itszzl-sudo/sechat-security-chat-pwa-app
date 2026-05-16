import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "sponsor-api",
      configureServer(server) {
        server.middlewares.use("/api/sponsor/update", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            try {
              const data = JSON.parse(body);
              // Dynamically import and call the handler
              delete require.cache[require.resolve("./src/api/sponsor")];
              const { handleSponsorUpdate } = require("./src/api/sponsor");
              const result = handleSponsorUpdate(data);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: result }));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: String(err) }));
            }
          });
        });
      },
    },
  ],
  server: {
    host: true,
    port: 5174,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
