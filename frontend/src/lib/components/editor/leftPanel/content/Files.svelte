<script lang="ts">
  import { editorContext } from "$lib/components/editor/context/index";
</script>

{#each $editorContext.files as file}
  <div>{file.path}</div>
{/each}
