import { describe, it, expect } from "vitest";
import { roleAtLeast, generateInvitationToken } from "@/lib/auth/rbac";

describe("auth/rbac", () => {
  describe("roleAtLeast", () => {
    it("rejects null/undefined", () => {
      expect(roleAtLeast(null, "rep")).toBe(false);
      expect(roleAtLeast(undefined, "admin")).toBe(false);
    });

    it("admin >= manager >= rep", () => {
      expect(roleAtLeast("admin", "rep")).toBe(true);
      expect(roleAtLeast("admin", "manager")).toBe(true);
      expect(roleAtLeast("admin", "admin")).toBe(true);
      expect(roleAtLeast("manager", "rep")).toBe(true);
      expect(roleAtLeast("manager", "manager")).toBe(true);
      expect(roleAtLeast("rep", "rep")).toBe(true);
    });

    it("manager < admin, rep < manager", () => {
      expect(roleAtLeast("manager", "admin")).toBe(false);
      expect(roleAtLeast("rep", "manager")).toBe(false);
      expect(roleAtLeast("rep", "admin")).toBe(false);
    });
  });

  describe("generateInvitationToken", () => {
    it("returns a 64-char hex string (32 bytes)", () => {
      const token = generateInvitationToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("generates unique tokens (sanity check)", () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateInvitationToken()));
      expect(tokens.size).toBe(100);
    });
  });
});
