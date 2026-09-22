import { customType } from "drizzle-orm/pg-core";

/** Postgres `citext` (case-insensitive text). Requires extension. */
export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});
