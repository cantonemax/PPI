export type PlatformRole = "SUPER_ADMIN" | "PLATFORM_ADMIN" | "READ_ONLY";

export function planPermissions(role: PlatformRole) {
  const edit = role === "SUPER_ADMIN";
  return {
    view: true,
    create: edit,
    edit,
    disable: edit,
    reactivate: edit,
    duplicate: edit,
    prices: edit,
    limits: edit,
    features: edit,
    history: edit,
  };
}
