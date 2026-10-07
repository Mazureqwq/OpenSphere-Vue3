import { onBeforeUnmount, ref, toRaw, watch, type Ref } from "vue";
import { ElMessage } from "element-plus";
import { buildPlaybackTracks, getPlaybackPosition, TrackPlaybackController, type PlaybackTrack, type TrackPlaybackState } from "@/map/trackPlayback";
import type { LayerRecord } from "@/types/gis";
import type { useMapStore } from "@/stores/map";

type MapStore = ReturnType<typeof useMapStore>;
interface PlaybackMapView { setTrackPlayback: (sourceLayerId: string, track: PlaybackTrack, position: ReturnType<typeof getPlaybackPosition>, follow: boolean) => void; clearTrackPlayback: () => void; onUserInteract?: (callback: () => void) => () => void; }

export function useTrackPlayback(options: { mapStore: MapStore; mapView: Ref<PlaybackMapView | undefined> }) {
  const tracks = ref<PlaybackTrack[]>([]);
  const state = ref<TrackPlaybackState>({ playing: false, speed: 1 });
  const follow = ref(false);
  const sourceLayerId = ref<string>();

  function render() {
    const track = tracks.value.find((item) => item.id === state.value.trackId);
    const timestamp = state.value.currentTime;
    if (!track || timestamp === undefined || !sourceLayerId.value) {
      options.mapView.value?.clearTrackPlayback();
      return;
    }
    options.mapView.value?.setTrackPlayback(sourceLayerId.value, track, getPlaybackPosition(track, timestamp), follow.value);
  }

  const controller = new TrackPlaybackController((nextState) => {
    state.value = nextState;
    render();
  });

  let stopUserInteract: (() => void) | undefined = undefined;
  watch(
    () => options.mapView.value,
    (view) => {
      stopUserInteract?.();
      stopUserInteract = undefined;
      if (view?.onUserInteract) {
        stopUserInteract = view.onUserInteract(() => {
          if (follow.value) setFollow(false);
        });
      }
    },
    { immediate: true },
  );

  function load(layerId: string, idField: string, timeField: string) {
    const layer = options.mapStore.layers.find((item) => item.id === layerId);
    if (!layer?.vectorStyle) {
      ElMessage.warning("请选择包含点要素的矢量图层");
      return;
    }
    const nextTracks = buildPlaybackTracks(toRaw(layer) as unknown as LayerRecord, idField, timeField);
    if (!nextTracks.length) {
      ElMessage.warning("未解析到至少包含两个不同时间点的轨迹");
      return;
    }
    sourceLayerId.value = layer.id;
    tracks.value = nextTracks;
    controller.load(nextTracks);
    options.mapStore.selectedLayerId = layer.id;
    ElMessage.success(`已解析 ${nextTracks.length} 条可回放轨迹`);
  }

  function selectTrack(id: string) { controller.selectTrack(id); }
  function play() { controller.play(); }
  function pause() { controller.pause(); }
  function seek(timestamp: number) { controller.setTime(timestamp); }
  function setSpeed(speed: number) { controller.setSpeed(speed); }
  function setFollow(value: boolean) { follow.value = value; render(); }
  function clear() { controller.clear(); tracks.value = []; sourceLayerId.value = undefined; options.mapView.value?.clearTrackPlayback(); }
  onBeforeUnmount(() => { stopUserInteract?.(); controller.dispose(); });

  return { tracks, state, follow, controller, load, selectTrack, play, pause, seek, setSpeed, setFollow, clear, sourceLayerId };
}