// Defaults match docker-compose.yml so a fresh clone runs without a .env file.
export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://club:club@localhost:5434/club_insights",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  // "Now" per the brief: Mon 5 Oct 2026 09:00 Asia/Ho_Chi_Minh. Fixed so numbers are reproducible.
  now: new Date(process.env.NOW ?? "2026-10-05T09:00:00+07:00"),
};

if (Number.isNaN(config.now.getTime())) throw new Error(`NOW is not a valid timestamp: ${process.env.NOW}`);
