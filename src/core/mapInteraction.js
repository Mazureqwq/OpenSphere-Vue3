export function getLayerName({ name, layerType, drawingCount, vectorCount }) {
  if (name?.trim()) return name.trim();
  if (layerType === "drawing") return drawingCount ? `绘制图层 ${drawingCount + 1}` : "绘制图层";
  return vectorCount ? `空白矢量图层 ${vectorCount + 1}` : "空白矢量图层";
}

export function getFallbackSelectedLayerId(layers, removedId, selectedLayerId) {
  if (selectedLayerId !== removedId) return selectedLayerId;
  return layers.at(-1)?.id;
}

export function toPopupPosition(position) {
  if (!position || !Number.isFinite(position[0]) || !Number.isFinite(position[1])) return undefined;
  return { x: position[0], y: position[1] };
}