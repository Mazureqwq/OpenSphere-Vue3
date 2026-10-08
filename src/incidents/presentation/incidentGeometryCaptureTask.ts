export type IncidentCaptureMode = 'Point' | 'Polygon';
export type IncidentCapturePhase = 'idle' | 'locating' | 'outlining';

export interface IncidentGeometryCaptureState {
  phase: IncidentCapturePhase;
  mode?: IncidentCaptureMode;
  vertexCount: number;
  originalGeometry?: GeoJSON.Geometry;
}

function idleState(originalGeometry?: GeoJSON.Geometry): IncidentGeometryCaptureState {
  return originalGeometry
    ? { phase: 'idle', vertexCount: 0, originalGeometry }
    : { phase: 'idle', vertexCount: 0 };
}

function withOriginalGeometry(
  state: IncidentGeometryCaptureState,
  next: Omit<IncidentGeometryCaptureState, 'originalGeometry'>,
): IncidentGeometryCaptureState {
  return state.originalGeometry ? { ...next, originalGeometry: state.originalGeometry } : next;
}

/** Starts every event-position task as the fast, one-click point flow. */
export function startIncidentGeometryCapture(originalGeometry?: GeoJSON.Geometry): IncidentGeometryCaptureState {
  return originalGeometry
    ? { phase: 'locating', mode: 'Point', vertexCount: 0, originalGeometry }
    : { phase: 'locating', mode: 'Point', vertexCount: 0 };
}

/** Changing modes only discards unfinished task vertices; it never mutates the draft geometry. */
export function setIncidentGeometryCaptureMode(
  state: IncidentGeometryCaptureState,
  mode: IncidentCaptureMode,
): IncidentGeometryCaptureState {
  return withOriginalGeometry(state, {
    phase: mode === 'Point' ? 'locating' : 'outlining',
    mode,
    vertexCount: 0,
  });
}

export function setIncidentGeometryCaptureVertexCount(
  state: IncidentGeometryCaptureState,
  vertexCount: number,
): IncidentGeometryCaptureState {
  if (state.phase !== 'outlining' || state.mode !== 'Polygon') return state;
  return {
    ...state,
    vertexCount: Math.max(0, Math.floor(vertexCount)),
  };
}

export function canFinishIncidentGeometryCapture(state: IncidentGeometryCaptureState): boolean {
  return state.phase === 'outlining' && state.mode === 'Polygon' && state.vertexCount >= 3;
}

/** A cancellation intentionally exposes the original geometry for the caller to retain in its draft. */
export function cancelIncidentGeometryCapture(state: IncidentGeometryCaptureState): IncidentGeometryCaptureState {
  return idleState(state.originalGeometry);
}

/** Completion ends the temporary task; the caller owns applying the completed geometry to its draft. */
export function completeIncidentGeometryCapture(_state: IncidentGeometryCaptureState): IncidentGeometryCaptureState {
  return idleState();
}
