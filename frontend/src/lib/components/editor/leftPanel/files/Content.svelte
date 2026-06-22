<script lang="ts">
  import { files } from "$lib/components/editor/context/index";
  import File from "./File.svelte";
</script>

<div class="content">
  {#each $files as file}
    <File {file} />
  {/each}
</div>

<style>
  .content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding-bottom: 5rem;
  }
</style>
