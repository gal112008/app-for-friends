import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";

import { assertEnv } from "./lib/assertEnv";
import { prisma } from "./lib/prisma";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/auth";
import goonRoutes from "./routes/goons";
import groupRoutes from "./routes/groups";
import leaderboardRoutes from "./routes/leaderboard";

assertEnv();

const app = express();

// Behind a reverse proxy in production (Render, Fly, nginx, etc.) this is
// needed so express-rate-limit and req.ip see the real client IP rather
// than the proxy's.
app.set("trust proxy", 1);

// --- Security middleware ---
app.use(
  helmet({
    // Google Identity Services and Apple's hosted sign-in script are needed
    // only for the login buttons; all application/API traffic stays same-origin.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://accounts.google.com", "https://appleid.cdn-apple.com"],
        frameSrc: ["https://accounts.google.com", "https://appleid.apple.com"],
        connectSrc: ["'self'", "https://accounts.google.com", "https://appleid.apple.com"],
        imgSrc: ["'self'", "data:", "https://*.gstatic.com"],
      },
    },
    // OAuth popups need to retain a window.opener relationship.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);
app.use(express.json({ limit: "10kb" }));

app.get("/config", (_req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    appleClientId: process.env.APPLE_CLIENT_ID || null,
    appleRedirectUri: process.env.APPLE_REDIRECT_URI || null,
  });
});

app.use(express.static(path.join(process.cwd(), "public"))); // this API's payloads are all tiny; reject anything else outright
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Global baseline limit; auth and gooning routes layer on their own, tighter limits.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

app.use("/auth", authRoutes);
app.use("/goons", goonRoutes);
app.use("/groups", groupRoutes);
app.use("/leaderboard", leaderboardRoutes);

app.get("*", (req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) return res.sendFile(path.join(process.cwd(), "public", "index.html"));
  next();
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

// Close DB connections cleanly instead of leaving them dangling on restart/deploy.
async function shutdown() {
  console.log("Shutting down...");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
