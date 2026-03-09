import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";

const db = new Database("clickpro.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS session_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT,
    total_clicks INTEGER,
    peak_cps INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/stats", (req, res) => {
    const stats = db.prepare("SELECT * FROM session_stats ORDER BY timestamp DESC LIMIT 10").all();
    res.json(stats);
  });

  app.post("/api/stats", (req, res) => {
    const { wallet_address, total_clicks, peak_cps } = req.body;
    const info = db.prepare("INSERT INTO session_stats (wallet_address, total_clicks, peak_cps) VALUES (?, ?, ?)")
      .run(wallet_address || "anonymous", total_clicks, peak_cps);
    res.json({ id: info.lastInsertRowid });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
