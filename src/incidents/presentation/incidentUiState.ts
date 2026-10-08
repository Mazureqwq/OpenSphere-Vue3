import { ref } from 'vue';

// Presentation-only state shared by the event shortcut, dialog and map-task card.
const createDialogVisible = ref(false);
const importDialogVisible = ref(false);
const mapTaskActive = ref(false);

function openCreateDialog() {
  createDialogVisible.value = true;
}

function suspendCreateDialogForMapTask() {
  mapTaskActive.value = true;
  createDialogVisible.value = false;
}

function resumeCreateDialogFromMapTask() {
  mapTaskActive.value = false;
  createDialogVisible.value = true;
}

export function useIncidentUiState() {
  return {
    createDialogVisible,
    importDialogVisible,
    mapTaskActive,
    openCreateDialog,
    openImportDialog: () => { importDialogVisible.value = true; },
    suspendCreateDialogForMapTask,
    resumeCreateDialogFromMapTask,
  };
}

export function openIncidentCreateDialog() { openCreateDialog(); }
