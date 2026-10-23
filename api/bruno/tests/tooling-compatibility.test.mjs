import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("patched Faker supports the APIs consumed by Bruno on Node 24", () => {
  const { faker } = require("@faker-js/faker");
  assert.equal(typeof faker.number.float({ min: 0, max: 1000, precision: 0.01 }), "number");
  assert.equal(typeof faker.number.int({ min: 0, max: 1000 }), "number");
  assert.equal(typeof faker.datatype.boolean(), "boolean");
  assert.equal(typeof faker.lorem.word(), "string");
  assert.ok(faker.string.alpha({ length: { min: 5, max: 10 } }).length >= 5);
});

test("patched csv-parse works through Bruno's actual CSV adapter", async () => {
  const { parseCSV } = require("@usebruno/cli/src/utils/filesystem.js");
  assert.deepEqual(await parseCSV('\uFEFFname,value\nalpha,"a,b"\n\nbeta,2\n'), [
    { name: "alpha", value: "a,b" },
    { name: "beta", value: "2" },
  ]);
});

test("patched uuid preserves the functions exposed in Bruno's safe sandbox", () => {
  const uuid = require("uuid");
  for (const [method, version] of [
    ["v1", 1],
    ["v4", 4],
    ["v6", 6],
    ["v7", 7],
  ]) {
    const id = uuid[method]();
    assert.ok(uuid.validate(id));
    assert.equal(uuid.version(id), version);
  }
  for (const method of ["v3", "v5"])
    assert.ok(uuid.validate(uuid[method]("bruno", uuid[method].DNS)));
  const id = uuid.v4();
  assert.equal(uuid.stringify(uuid.parse(id)), id);
  const v1 = uuid.v1();
  assert.equal(uuid.v6ToV1(uuid.v1ToV6(v1)), v1);
});
