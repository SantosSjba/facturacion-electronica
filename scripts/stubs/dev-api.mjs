#!/usr/bin/env node
/**
 * Placeholder until S0-API creates apps/api.
 * Exit non-zero so CI/scripts do not silently "succeed".
 */
console.error(
  "[dev:api] apps/api is not scaffolded yet (pending YouTrack epic S0-API / FE-2).\n" +
    "After NestJS is created, this stub will be replaced by turbo/pnpm filter start:dev.",
);
process.exit(1);
