export interface LayerNameOptions {
  name?: string;
  layerType: "drawing" | "vector";
  drawingCount: number;
  vectorCount: number;
}
export function getLayerName(options: LayerNameOptions): string;
export function getFallbackSelectedLayerId<T extends { id: string }>(layers: T[], removedId: string, selectedLayerId?: string): string | undefined;
export function toPopupPosition(position?: number[]): { x: number; y: number } | undefined;