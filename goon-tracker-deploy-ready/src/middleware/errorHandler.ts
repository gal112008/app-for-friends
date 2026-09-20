import { Request, Response, NextFunction } from "express";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// Must be registered LAST, after all routes. Express recognizes it as an
// error handler by its 4-arg signature.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  // Never leak stack traces, SQL, or internal messages to the client —
  // that's free information for anyone probing the API.
  const message =
    process.env.NODE_ENV === "production"
      ? "Something went wrong"
      : err instanceof Error
        ? err.message
        : "Unknown error";

  res.status(500).json({ error: message });
}
