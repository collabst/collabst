<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
    sizeWeight?: number;
  }

  let { children, sizeWeight = 1 }: Props = $props();
</script>

<div class="panel" style="flex: {sizeWeight};">
  {@render children()}
</div>

<style>
  .panel {
    border: 1px solid var(--editor-panels-border);
    border-radius: 1rem;
    overflow: hidden;
    height: 100%;
  }
</style>
