import assert from "node:assert/strict";
import { test } from "node:test";
import { addItem, defaultLayout, moveItem, overlapPairs, rotateItem } from "./layout";

test("a planta padrão não tem móvel sobreposto nem quadro na janela", () => {
  assert.deepEqual(overlapPairs(defaultLayout.items), []);
});

test("girar e mover respeitam a grade e a sobreposição", () => {
  const turned = rotateItem(defaultLayout.items, "box-1");
  assert.ok(turned);
  const blocked = moveItem(defaultLayout.items, "board", 2.4, 0.4);
  assert.equal(blocked, null);
  const moved = moveItem(defaultLayout.items, "box-1", 7.2, 2.8);
  assert.ok(moved);
  assert.equal(moved?.find((item) => item.id === "box-1")?.z, 2.8);
  const added = addItem(defaultLayout.items, "cardboardBoxClosed");
  assert.ok(added && added.length === defaultLayout.items.length + 1);
});
