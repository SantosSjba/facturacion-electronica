export type UserStatus = "active" | "disabled";

export interface OrgUser {
  id: string;
  email: string;
  name: string;
  status: UserStatus | string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
}

export interface OrgRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  roles: string[];
  status?: UserStatus;
}

export interface PatchUserInput {
  name?: string;
  status?: UserStatus;
  password?: string;
}
