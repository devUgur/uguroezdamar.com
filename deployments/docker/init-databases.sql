-- One Postgres server, two databases (ADR 0045, R4): the portal's (drizzle, packages/server) and the agent API's
-- (apps/api/migrations-postgres, applied by the Node host on its first start).
CREATE DATABASE agents;
