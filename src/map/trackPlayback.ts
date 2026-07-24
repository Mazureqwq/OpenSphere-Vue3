import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import type {Coordinate} from 'ol/coordinate';
import type {LayerRecord} from '@/types/gis';
import {parseTimeValue} from '@/map/styles';

export interface PlaybackPoint {
  coordinate: Coordinate;
  timestamp: number;
  properties: Record<string, unknown>;
}

export interface PlaybackTrack {
  id: string;
  name: string;
  points: PlaybackPoint[];
  start: number;
  end: number;
}

export interface PlaybackPosition {
  coordinate: Coordinate;
  history: Coordinate[];
  properties: Record<string, unknown>;
}

export interface TrackPlaybackState {
  playing: boolean;
  speed: number;
  trackId?: string;
  currentTime?: number;
  start?: number;
  end?: number;
}

export function buildPlaybackTracks(layer: LayerRecord, idField: string, timeField: string): PlaybackTrack[] {
  const source = (layer.source as unknown as {getSource?: () => {getFeatures: () => Feature[]} | null}).getSource?.();
  if (!source) return [];
  const tracks = new Map<string, PlaybackPoint[]>();
  source.getFeatures().forEach((feature) => {
    const geometry = feature.getGeometry();
    const id = feature.get(idField);
    const timestamp = parseTimeValue(feature.get(timeField));
    if (!(geometry instanceof Point) || id == null || String(id).trim() === '' || timestamp === undefined) return;
    const properties = Object.entries(feature.getProperties()).filter(([key]) => key !== 'geometry').reduce<Record<string, unknown>>((result, [key, value]) => ({...result, [key]: value}), {});
    const key = String(id);
    const points = tracks.get(key) ?? [];
    points.push({coordinate: geometry.getCoordinates().slice(), timestamp, properties});
    tracks.set(key, points);
  });
  return [...tracks.entries()].flatMap(([id, points]) => {
    const sorted = points.sort((first, second) => first.timestamp - second.timestamp);
    if (sorted.length < 2 || sorted[0].timestamp === sorted.at(-1)!.timestamp) return [];
    return [{id, name: id, points: sorted, start: sorted[0].timestamp, end: sorted.at(-1)!.timestamp}];
  }).sort((first, second) => first.name.localeCompare(second.name));
}

export function getPlaybackPosition(track: PlaybackTrack, timestamp: number): PlaybackPosition {
  const points = track.points;
  if (timestamp <= track.start) return {coordinate: points[0].coordinate.slice(), history: [points[0].coordinate.slice()], properties: points[0].properties};
  if (timestamp >= track.end) return {coordinate: points.at(-1)!.coordinate.slice(), history: points.map((item) => item.coordinate.slice()), properties: points.at(-1)!.properties};
  let rightIndex = 1;
  while (rightIndex < points.length && points[rightIndex].timestamp < timestamp) rightIndex += 1;
  const left = points[rightIndex - 1];
  const right = points[rightIndex];
  const ratio = (timestamp - left.timestamp) / Math.max(right.timestamp - left.timestamp, 1);
  const coordinate: Coordinate = [left.coordinate[0] + (right.coordinate[0] - left.coordinate[0]) * ratio, left.coordinate[1] + (right.coordinate[1] - left.coordinate[1]) * ratio];
  const history = points.slice(0, rightIndex).map((item) => item.coordinate.slice());
  if (ratio > 0) history.push(coordinate.slice());
  return {coordinate, history, properties: left.properties};
}

export class TrackPlaybackController {
  private tracks: PlaybackTrack[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private lastTick = 0;
  private state: TrackPlaybackState = {playing: false, speed: 1};

  constructor(private readonly onChange: (state: TrackPlaybackState) => void) {}

  load(tracks: PlaybackTrack[]) {
    this.pause();
    this.tracks = tracks;
    const track = tracks[0];
    this.state = {playing: false, speed: this.state.speed, trackId: track?.id, currentTime: track?.start, start: track?.start, end: track?.end};
    this.emit();
  }

  selectTrack(id: string) {
    const track = this.tracks.find((item) => item.id === id);
    if (!track) return;
    this.pause();
    this.state = {...this.state, trackId: track.id, currentTime: track.start, start: track.start, end: track.end};
    this.emit();
  }

  setTime(timestamp: number) {
    if (this.state.start === undefined || this.state.end === undefined) return;
    this.state = {...this.state, currentTime: Math.min(this.state.end, Math.max(this.state.start, timestamp))};
    this.emit();
  }

  setSpeed(speed: number) {
    this.state = {...this.state, speed: Number.isFinite(speed) && speed > 0 ? speed : 1};
    this.emit();
  }

  play() {
    if (this.state.currentTime === undefined || this.state.end === undefined || this.state.currentTime >= this.state.end) this.setTime(this.state.start ?? 0);
    if (this.state.currentTime === undefined || this.state.end === undefined) return;
    this.pause();
    this.lastTick = performance.now();
    this.state = {...this.state, playing: true};
    this.timer = setInterval(() => this.tick(), 100);
    this.emit();
  }

  pause() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (this.state.playing) { this.state = {...this.state, playing: false}; this.emit(); }
  }

  clear() {
    this.pause();
    this.tracks = [];
    this.state = {playing: false, speed: this.state.speed};
    this.emit();
  }

  dispose() { this.clear(); }

  private tick() {
    if (!this.state.playing || this.state.currentTime === undefined || this.state.end === undefined) return;
    const now = performance.now();
    const next = this.state.currentTime + (now - this.lastTick) * this.state.speed;
    this.lastTick = now;
    if (next >= this.state.end) { this.state = {...this.state, currentTime: this.state.end, playing: false}; if (this.timer) clearInterval(this.timer); this.timer = undefined; }
    else this.state = {...this.state, currentTime: next};
    this.emit();
  }

  private emit() { this.onChange({...this.state}); }
}
