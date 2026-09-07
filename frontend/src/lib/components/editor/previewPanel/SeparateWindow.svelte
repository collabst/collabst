<script lang="ts">
  import { separatePreviewHost } from "$lib/components/editor/context";
  import ToolBar from "./toolbar/ToolBar.svelte";
  import { mount, unmount } from "svelte";

  /**
   * The preview toolbar, while the preview lives in its own window.
   *
   * The popup is a document of its own, so its toolbar cannot be part of this
   * component's tree — it is mounted into the popup's root element instead.
   * `ToolBar` needs no telling which surface it is on: the same stores drive
   * both, and it already swaps its last button for "back to split view" when
   * the preview is popped out.
   *
   * This component renders nothing itself; it exists so the mount is tied to
   * the editor's lifetime rather than to the panel that is no longer there.
   */
  $effect(() => {
    const host = $separatePreviewHost;
    if (!host) return;

    const toolbar = mount(ToolBar, { target: host });
    return () => {
      try {
        unmount(toolbar);
      } catch {
        // The reader closed the window out from under us.
      }
    };
  });
</script>
