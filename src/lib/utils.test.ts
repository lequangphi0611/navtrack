import { describe, expect, test } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  test("gộp class name và loại bỏ giá trị falsy", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  test("class Tailwind trùng nhóm thì class sau thắng", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
