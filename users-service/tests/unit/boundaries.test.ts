import { expect, it } from "vitest";
import { Usuario, validatePassword, validateProfile } from "../../src/modules/users/domain/user";
import { pageInput } from "../../src/modules/users/application/current-user";
import { readConfig } from "../../src/shared/config";
import { config, user } from "../helpers/fixtures";

it.each([
  { authVersion: 0 },
  { authVersion: 1.1 },
  { status: "DELETED" },
  { role: "ROOT" },
  { userId: "internal-id" },
  { passwordHash: "" },
  { createdAt: new Date(NaN) },
  { updatedAt: new Date(0) },
])("rejects invalid restored aggregate %j", (patch) => {
  expect(() =>
    Usuario.restore({ ...user(), ...patch } as Parameters<typeof Usuario.restore>[0]),
  ).toThrow();
});
it("validates password boundaries using Unicode code points without trimming", () => {
  for (const size of [12, 128]) expect(validatePassword("🌎".repeat(size))).toBe("🌎".repeat(size));
  for (const value of ["🌎".repeat(11), "🌎".repeat(129), "long enough\0password"])
    expect(() => validatePassword(value)).toThrow();
  expect(validatePassword("  long passphrase  ")).toBe("  long passphrase  ");
});
it("rejects unsafe avatar/locale values while allowing regional language tags", () => {
  const profile = user().profile;
  expect(validateProfile({ ...profile, preferredLanguage: "es-PE" }).preferredLanguage).toBe(
    "es-PE",
  );
  for (const patch of [
    { preferredLanguage: "ES" },
    { avatarUrl: "file:///etc/passwd" },
    { avatarUrl: "https://user:secret@example.test/a" },
  ])
    expect(() => validateProfile({ ...profile, ...patch })).toThrow();
});
it("bounds pagination by the maximum offset, not just page size", () => {
  expect(pageInput(101, 100)).toEqual({ page: 101, limit: 100 });
  for (const [page, limit] of [
    [102, 100],
    [0, 20],
    [1, 0],
    [1, 101],
    [NaN, 20],
    [1.5, 20],
  ])
    expect(() => pageInput(page, limit)).toThrow();
});
it("requires HTTPS in production and rejects malformed or credential-bearing origins", () => {
  const c = Object.fromEntries(
    Object.entries(config()).map(([key, value]) => [key, String(value)]),
  );
  expect(
    readConfig({ ...c, APP_ENV: "production", APP_ORIGIN: "https://users.test" }).APP_ENV,
  ).toBe("production");
  for (const APP_ORIGIN of [
    "http://users.test",
    "https://user:secret@users.test",
    "https://users.test/path",
  ])
    expect(() => readConfig({ ...c, APP_ENV: "production", APP_ORIGIN })).toThrow();
  expect(() => readConfig({ ...c, JWT_PRIVATE_KEY: "bad" })).toThrow();
});
