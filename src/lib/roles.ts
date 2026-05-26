import { UserRole } from '@prisma/client';

export { UserRole };

export const ROLE_ADMIN = UserRole.admin;
export const ROLE_USER = UserRole.user;

export function isAdminRole(role: string | undefined | null): boolean {
  return role === UserRole.admin;
}

export function normalizeRole(role: string | undefined | null): UserRole {
  if (role === UserRole.admin || role?.toLowerCase() === 'admin') {
    return UserRole.admin;
  }
  return UserRole.user;
}
