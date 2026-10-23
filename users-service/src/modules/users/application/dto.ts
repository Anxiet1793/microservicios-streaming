import type { UserState } from "../domain/user";
export function publicUser(user: UserState) {
  return {
    userId: user.userId,
    email: user.email,
    status: user.status,
    role: user.role,
    profile: { ...user.profile },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
export function authUser(user: UserState) {
  return {
    userId: user.userId,
    email: user.email,
    displayName: user.profile.displayName,
    status: user.status,
    role: user.role,
  };
}
