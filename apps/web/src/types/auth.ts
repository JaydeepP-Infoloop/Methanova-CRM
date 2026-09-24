import type { Role } from "@methanova/shared-types";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
