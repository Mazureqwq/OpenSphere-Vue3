import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {fromLonLat} from 'ol/proj';
import {Circle as CircleStyle, Fill, Stroke, Style, Text} from 'ol/style';
import type {StyleFunction} from 'ol/style/Style';
import type {LayerRecord} from '@/types/gis';

export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'simulation';

export interface RealtimeState {
  status: RealtimeStatus;
  trackCount: number;
  lastUpdated?: string;
  error?: string;
}

export interface RealtimePosition {
  id: string;
  lon: number;
  lat: number;
  timestamp?: string | number;
  properties?: Record<string, unknown>;
}

interface TrackFeatures { marker: Feature<Point>; trail: Feature<LineString>; }

const trackColors = ['#38bdf8', '#f97316', '#a78bfa', '#34d399', '#f472b6', '#facc15'];
const maxTrackPoints = 1000;

export function createRealtimeLayer(): LayerRecord {
  const id = `realtime-${Date.now()}`;
  const source = new VectorSource();
  const layer = new VectorLayer({source, style: createRealtimeStyle(), properties: {id, sourceType: 'realtime'}});
  return {id, name: '实时轨迹', kind: 'vector', visible: true, opacity: 1, source: layer, featureCount: 0, realtime: true};
}

function createRealtimeStyle(): StyleFunction {
  const styles = new Map<string, Style>();
  return (feature) => {
    const role = feature.get('realtimeRole');
    const color = String(feature.get('color') ?? trackColors[0]);
    const key = `${role}:${color}:${String(feature.get('name') ?? feature.get('trackId') ?? '')}`;
    if (!styles.has(key)) {
      styles.set(key, role === 'trail'
        ? new Style({stroke: new Stroke({color, width: 3})})
        : new Style({image: new CircleStyle({radius: 7, fill: new Fill({color}), stroke: new Stroke({color: '#ffffff', width: 2})}), text: new Text({text: String(feature.get('name') ?? feature.get('trackId') ?? ''), offsetY: -16, fill: new Fill({color: '#e2edf8'}), stroke: new Stroke({color: '#0f1d2d', width: 3}), font: '12px sans-serif'})}));
    }
    return styles.get(key);
  };
}

export class RealtimeTrackService {
  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private simulationTimer?: ReturnType<typeof setInterval>;
  private layer?: LayerRecord;
  private tracks = new Map<string, TrackFeatures>();
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private lastUrl = '';
  private state: RealtimeState = {status: 'disconnected', trackCount: 0};

  constructor(private readonly onStateChange?: (state: RealtimeState) => void, private readonly onLayerChange?: (layer?: LayerRecord) => void) {}

  attachLayer(layer: LayerRecord) { this.layer = layer; this.emitState(); this.emitLayerChange(); }

  detachLayer() {
    this.disconnect();
    this.stopSimulation();
    this.getSource()?.clear();
    this.layer = undefined;
    this.tracks.clear();
    this.state = {status: 'disconnected', trackCount: 0};
    this.emitState();
    this.emitLayerChange();
  }

  connect(url: string) {
    const normalizedUrl = url.trim();
    if (!/^wss?:\/\//i.test(normalizedUrl)) throw new Error('WebSocket 地址必须以 ws:// 或 wss:// 开头');
    this.stopSimulation();
    this.shouldReconnect = true;
    this.lastUrl = normalizedUrl;
    this.openSocket(false);
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    const socket = this.socket;
    this.socket = undefined;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    if (this.state.status !== 'simulation') this.setState({status: 'disconnected', error: undefined});
  }

  startSimulation() {
    this.disconnect();
    this.stopSimulation();
    this.setState({status: 'simulation', error: undefined});
    let tick = 0;
    const seeds = [
      {id: 'vehicle-001', name: '巡检车 001', center: [113.6254, 34.7466], phase: 0},
      {id: 'vehicle-002', name: '巡检车 002', center: [113.673, 34.76], phase: 2.1},
      {id: 'vehicle-003', name: '巡检车 003', center: [113.59, 34.715], phase: 4.2},
    ];
    const publish = () => {
      tick += 1;
      seeds.forEach((seed, index) => {
        const angle = tick / 7 + seed.phase;
        this.applyPosition({id: seed.id, lon: seed.center[0] + Math.cos(angle) * (0.018 + index * 0.003), lat: seed.center[1] + Math.sin(angle * 1.3) * (0.012 + index * 0.002), timestamp: new Date().toISOString(), properties: {name: seed.name, source: '本地模拟'}});
      });
    };
    publish();
    this.simulationTimer = setInterval(publish, 1000);
  }

  stopSimulation() {
    if (this.simulationTimer) clearInterval(this.simulationTimer);
    this.simulationTimer = undefined;
    if (this.state.status === 'simulation') this.setState({status: 'disconnected', error: undefined});
  }

  dispose() { this.detachLayer(); }

  private openSocket(reconnecting: boolean) {
    if (!this.lastUrl) return;
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close();
    this.setState({status: reconnecting ? 'reconnecting' : 'connecting', error: undefined});
    try {
      const socket = new WebSocket(this.lastUrl);
      this.socket = socket;
      socket.onopen = () => {
        if (socket !== this.socket) return;
        this.reconnectAttempt = 0;
        this.setState({status: 'connected', error: undefined});
      };
      socket.onmessage = (event) => this.handleMessage(event.data);
      socket.onerror = () => { if (socket === this.socket) this.setState({status: 'error', error: 'WebSocket 连接异常'}); };
      socket.onclose = () => {
        if (socket !== this.socket) return;
        this.socket = undefined;
        if (!this.shouldReconnect) { this.setState({status: 'disconnected', error: undefined}); return; }
        this.scheduleReconnect();
      };
    } catch (error) {
      this.setState({status: 'error', error: error instanceof Error ? error.message : '无法创建 WebSocket 连接'});
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30000);
    this.reconnectAttempt += 1;
    this.setState({status: 'reconnecting'});
    this.reconnectTimer = setTimeout(() => this.openSocket(true), delay);
  }

  private handleMessage(raw: unknown) {
    if (typeof raw !== 'string') return;
    try { this.acceptPayload(JSON.parse(raw)); }
    catch { this.setState({status: this.state.status, error: '收到无法解析的实时消息'}); }
  }

  private acceptPayload(payload: unknown) {
    const value = this.unwrapPayload(payload);
    const items = Array.isArray(value) ? value : [value];
    items.map((item) => this.normalizePosition(item)).filter((item): item is RealtimePosition => Boolean(item)).forEach((item) => this.applyPosition(item));
  }

  private unwrapPayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
    const record = payload as Record<string, unknown>;
    return record.data ?? record.position ?? record.positions ?? payload;
  }

  private normalizePosition(input: unknown): RealtimePosition | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const record = input as Record<string, unknown>;
    const id = record.id ?? record.trackId ?? record.deviceId ?? record.vehicleId;
    const lon = Number(record.lon ?? record.lng ?? record.longitude ?? record.x);
    const lat = Number(record.lat ?? record.latitude ?? record.y);
    if (!id || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return undefined;
    const {id: _id, trackId: _trackId, deviceId: _deviceId, vehicleId: _vehicleId, lon: _lon, lng: _lng, longitude: _longitude, x: _x, lat: _lat, latitude: _latitude, y: _y, timestamp, time, ...properties} = record;
    return {id: String(id), lon, lat, timestamp: typeof timestamp === 'string' || typeof timestamp === 'number' ? timestamp : typeof time === 'string' || typeof time === 'number' ? time : undefined, properties};
  }

  private applyPosition(position: RealtimePosition) {
    const source = this.getSource();
    if (!source) return;
    const coordinate = fromLonLat([position.lon, position.lat]);
    const color = trackColors[this.tracks.size % trackColors.length];
    let features = this.tracks.get(position.id);
    if (!features) {
      const marker = new Feature<Point>({geometry: new Point(coordinate), trackId: position.id, color, realtimeRole: 'position'});
      marker.setId(`realtime-marker-${position.id}`);
      const trail = new Feature<LineString>({geometry: new LineString([coordinate]), trackId: position.id, color, realtimeRole: 'trail'});
      trail.setId(`realtime-trail-${position.id}`);
      source.addFeatures([trail, marker]);
      features = {marker, trail};
      this.tracks.set(position.id, features);
    } else {
      features.marker.getGeometry()?.setCoordinates(coordinate);
      const coordinates = features.trail.getGeometry()?.getCoordinates() ?? [];
      coordinates.push(coordinate);
      if (coordinates.length > maxTrackPoints) coordinates.splice(0, coordinates.length - maxTrackPoints);
      features.trail.getGeometry()?.setCoordinates(coordinates);
    }
    features.marker.setProperties({longitude: Number(position.lon.toFixed(6)), latitude: Number(position.lat.toFixed(6)), timestamp: position.timestamp ?? new Date().toISOString(), ...(position.properties ?? {})}, false);
    features.trail.setProperties({timestamp: position.timestamp ?? new Date().toISOString()}, false);
    this.setState({trackCount: this.tracks.size, lastUpdated: new Date().toISOString()});
    this.emitLayerChange();
  }

  private getSource() {
    if (!this.layer) return;
    return (this.layer.source as unknown as {getSource?: () => VectorSource | null}).getSource?.();
  }
  private setState(next: Partial<RealtimeState>) { this.state = {...this.state, ...next}; this.emitState(); }
  private emitState() { this.onStateChange?.({...this.state, trackCount: this.tracks.size}); }
  private emitLayerChange() { this.onLayerChange?.(this.layer); }
}


