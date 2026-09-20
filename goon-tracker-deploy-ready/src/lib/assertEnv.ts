// Fail fast on boot if critical config is missing, instead of failing weirdly
// mid-request later (a classic source of silent security holes).
const required = ["DATABASE_URL", "JWT_SECRET"] as const;

export function assertEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error("JWT_SECRET is too short. Generate a long random value (see .env.example).");
    process.exit(1);
  }
}
