<script lang="ts">
  import { onDestroy } from "svelte";
  import { editorContext } from "$lib/components/editor/context";
  import type { Diagnostic } from "$lib/types";
  import type { WebsocketProvider } from "y-websocket";
  import type * as Y from "yjs";

  type Props = {
    fileId?: string | null;
    fileName?: string;
    ytext?: Y.Text | null;
    ydoc?: Y.Doc | null;
    provider?: WebsocketProvider | null;
    diagnostics?: Diagnostic[];
    wrapLines?: boolean;
    editable?: boolean;
    theme?: "light" | "dark";
  };

  let {
    fileId = null,
    fileName = "",
    ytext = null,
    ydoc = null,
    provider = null,
    diagnostics = [],
    wrapLines = true,
    editable = true,
    theme = "light",
  }: Props = $props();

  let editorElement = $state<HTMLDivElement | null>(null);

  // $effect(() => {
  //   editorContext.setEditorRuntime({
  //     fileId,
  //     fileName,
  //     ytext,
  //     ydoc,
  //     provider,
  //     diagnostics,
  //     wrapLines,
  //     editable,
  //     theme,
  //   });

  //   if (editorElement) {
  //     editorContext.setEditorElement(editorElement);
  //   }
  // });

  // onDestroy(() => {
  //   editorContext.clearEditorRuntime();
  // });
</script>

<div bind:this={editorElement} class="editor-host"></div>

<style>
  .editor-host {
    height: 100%;
    width: 100%;
    min-height: 0;
  }
</style>
