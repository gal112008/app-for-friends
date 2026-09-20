import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

// Validates req.body against a zod schema, replaces it with the parsed
// (and type-coerced) result, or returns 400 with the specific issues.
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request body",
        issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}
