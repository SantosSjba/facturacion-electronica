import type { OrgUser, UserStatus } from "./types";

export interface UserFiltersState {
  email: string;
  role: string;
  status: "" | UserStatus;
}

export function filterUsers(
  users: readonly OrgUser[],
  filters: UserFiltersState,
): OrgUser[] {
  const emailQ = filters.email.trim().toLowerCase();
  return users.filter((u) => {
    if (emailQ && !u.email.toLowerCase().includes(emailQ)) return false;
    if (filters.role && !u.roles.includes(filters.role)) return false;
    if (filters.status && u.status !== filters.status) return false;
    return true;
  });
}
