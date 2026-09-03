<script lang="ts">
  import { diagnostics } from "$lib/components/editor/context";
  import type { Diagnostic as DiagnosticType } from "$lib/types";
  import Diagnostic from "./Diagnostic.svelte";

  function severityValue(severity: string): number {
    switch (severity) {
      case "error":
        return 1;
      case "warning":
        return 2;
      case "info":
        return 3;
      case "hint":
        return 4;
      default:
        return 5;
    }
  }

  let sortedDiagnostics: DiagnosticType[] = $derived(
    $diagnostics.sort((a, b) => {
      return severityValue(a.severity) - severityValue(b.severity);
    }),
  );
</script>

<div class="content">
  {#each sortedDiagnostics as diagnostic}
    <Diagnostic {diagnostic} />
  {/each}
</div>

<style>
  .content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 0 0 5rem;
  }
</style>
