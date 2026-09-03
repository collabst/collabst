<script lang="ts">
  import { showLeftPanel } from "$lib/components/editor/context";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
</script>

<!-- The only way back once the side panel is collapsed: a thin strip in its place. -->
<button class="strip" onclick={showLeftPanel} title="Show the side panel">
  <PanelLeftOpen size={16} />
</button>

<style>
  .strip {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    flex: none;
    width: 1.75rem;
    padding-bottom: 0.9rem;
    border: 1px solid var(--editor-panels-border);
    border-radius: 1rem;
    background-color: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
  }

  .strip:hover {
    color: var(--text-primary);
    background-color: var(--surface-hover);
  }

  .strip:active :global(svg) {
    transform: translateY(1px) scaleX(1.15) scaleY(0.9);
  }
</style>
