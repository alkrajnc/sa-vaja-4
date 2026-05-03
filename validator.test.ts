import { expect, test } from "vitest";
import * as validator from "./validator";

test("validate string min length", () => {
  const schema = validator.schema(validator.string().min(2));
  const data = "abcdef";
  expect(schema.parse(data)).toBe(true);
});
