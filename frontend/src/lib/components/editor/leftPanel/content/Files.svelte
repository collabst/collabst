<script lang="ts">
  import { files } from "$lib/components/editor/context/index";
  import File from "./File.svelte";
</script>

<div class="files">
{#each $files as file}
  <File file={file} />
{/each}
</div>

<style>
  .files {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding-bottom: 5rem;
    gap: 0.2rem;
  }
</style>