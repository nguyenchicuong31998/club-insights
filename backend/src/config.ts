// Defaults match docker-compose.yml so a fresh clone runs without a .env file.
export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://club:club@localhost:5434/club_insights",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};
