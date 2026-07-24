import assert from "node:assert/strict";
import test from "node:test";
import {
  getFallbackSelectedLayerId,
  getLayerName,
  toPopupPosition,
} from "../src/core/mapInteraction.js";

test("creates numbered drawing layer names", () => {
  assert.equal(getLayerName({ layerType: "drawing", drawingCount: 0, vectorCount: 0 }), "绘制图层");
  assert.equal(getLayerName({ layerType: "drawing", drawingCount: 2, vectorCount: 0 }), "绘制图层 3");
  assert.equal(getLayerName({ name: "  现场标注  ", layerType: "drawing", drawingCount: 2, vectorCount: 0 }), "现场标注");
});

test("creates numbered blank vector layer names", () => {
  assert.equal(getLayerName({ layerType: "vector", drawingCount: 0, vectorCount: 0 }), "空白矢量图层");
  assert.equal(getLayerName({ layerType: "vector", drawingCount: 0, vectorCount: 4 }), "空白矢量图层 5");
});

test("falls back to the last layer after deleting the selected layer", () => {
  const layers = [{ id: "roads" }, { id: "labels" }];
  assert.equal(getFallbackSelectedLayerId(layers, "roads", "roads"), "labels");
  assert.equal(getFallbackSelectedLayerId(layers, "roads", "labels"), "labels");
  assert.equal(getFallbackSelectedLayerId([], "roads", "roads"), undefined);
});

test("keeps popup coordinates valid and rejects invalid positions", () => {
  assert.deepEqual(toPopupPosition([120, 30]), { x: 120, y: 30 });
  assert.equal(toPopupPosition(undefined), undefined);
  assert.equal(toPopupPosition([Number.NaN, 30]), undefined);
  assert.equal(toPopupPosition([120, Number.POSITIVE_INFINITY]), undefined);
});