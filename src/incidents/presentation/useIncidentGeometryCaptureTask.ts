import { computed, ref } from 'vue';
import type { IncidentGeometryCaptureProgress, MapFacade } from '@/map/facade';
import {
  cancelIncidentGeometryCapture,
  canFinishIncidentGeometryCapture,
  completeIncidentGeometryCapture,
  setIncidentGeometryCaptureMode,
  setIncidentGeometryCaptureVertexCount,
  startIncidentGeometryCapture,
  type IncidentCaptureMode,
  type IncidentGeometryCaptureState,
} from './incidentGeometryCaptureTask.ts';
import { useIncidentCreateDraft } from './useIncidentCreateDraft.ts';
import { useIncidentUiState } from './incidentUiState.ts';

const state = ref<IncidentGeometryCaptureState>({ phase: 'idle', vertexCount: 0 });
const activeFacade = ref<MapFacade>();
const returnFocusToken = ref(0);
let session = 0;

function settleToForm(nextState: IncidentGeometryCaptureState): void {
  state.value = nextState;
  activeFacade.value = undefined;
  session += 1;
  useIncidentUiState().resumeCreateDialogFromMapTask();
  returnFocusToken.value += 1;
}

function isCurrentSession(activeSession: number): boolean {
  return activeSession === session && state.value.phase !== 'idle';
}

/** Coordinates the draft and map facade without letting cancellation create or overwrite an event. */
export function useIncidentGeometryCaptureTask() {
  const draftSession = useIncidentCreateDraft();
  const uiState = useIncidentUiState();
  const active = computed(() => state.value.phase !== 'idle');
  const canUndo = computed(() => state.value.mode === 'Polygon' && state.value.vertexCount > 0);
  const canFinish = computed(() => canFinishIncidentGeometryCapture(state.value));

  function begin(facade: MapFacade | undefined): boolean {
    if (!facade || active.value) return false;
    const activeSession = ++session;
    state.value = startIncidentGeometryCapture(draftSession.draft.geometry);
    activeFacade.value = facade;
    uiState.suspendCreateDialogForMapTask();
    facade.startIncidentGeometryCapture({
      mode: 'Point',
      referenceGeometry: draftSession.draft.geometry,
      onProgress(progress: IncidentGeometryCaptureProgress) {
        if (!isCurrentSession(activeSession)) return;
        const modeState = state.value.mode === progress.mode
          ? state.value
          : setIncidentGeometryCaptureMode(state.value, progress.mode);
        state.value = setIncidentGeometryCaptureVertexCount(modeState, progress.vertexCount);
      },
      onComplete(geometry) {
        if (!isCurrentSession(activeSession)) return;
        draftSession.draft.geometry = geometry;
        settleToForm(completeIncidentGeometryCapture(state.value));
      },
      onCancel() {
        if (!isCurrentSession(activeSession)) return;
        settleToForm(cancelIncidentGeometryCapture(state.value));
      },
    });
    return true;
  }

  function selectMode(mode: IncidentCaptureMode): void {
    const facade = activeFacade.value;
    if (!facade || !active.value) return;
    state.value = setIncidentGeometryCaptureMode(state.value, mode);
    facade.setIncidentGeometryCaptureMode(mode);
  }

  function undo(): void {
    if (!activeFacade.value || !canUndo.value) return;
    activeFacade.value.undoIncidentGeometryCapture();
  }

  function finish(): void {
    if (!activeFacade.value || !canFinish.value) return;
    activeFacade.value.finishIncidentGeometryCapture();
  }

  function cancel(): void {
    const facade = activeFacade.value;
    if (!active.value) return;
    if (facade) {
      facade.cancelIncidentGeometryCapture();
      return;
    }
    settleToForm(cancelIncidentGeometryCapture(state.value));
  }

  return {
    state,
    active,
    canUndo,
    canFinish,
    returnFocusToken,
    begin,
    selectMode,
    undo,
    finish,
    cancel,
  };
}
