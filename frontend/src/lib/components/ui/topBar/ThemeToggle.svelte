<script lang="ts">
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import { theme } from "$lib/stores/theme";
  import Button from "../Button.svelte";

  function onclick() {
    theme.toggle();
  }

  const strokeWidth = 2;
  const size = 20;
</script>

<Button class="topbar-theme-toggle" {onclick} style="--stroke-width: {strokeWidth};">
  {#if $theme === "dark"}
    <Sun {size} />
  {:else}
    <Moon {size} />
  {/if}
</Button>

<style>
  :global(.ui-button.topbar-theme-toggle) {
    padding: 0.35rem;
    border-radius: 999px;
  }

  :global([data-theme="light"] .ui-button.topbar-theme-toggle:hover) {
    background: #2a2a2a;
    color: #cccccc;
    border-color: #4a4a4e;
  }

  :global([data-theme="dark"] .ui-button.topbar-theme-toggle:hover) {
    background: #e8e8e8;
    color: #1e1e1e;
    border-color: #b8b8b8;
  }

  :global(.ui-button.topbar-theme-toggle:hover svg) {
    animation: icon-jump-big 0.2s ease-out;
  }

  :global(.ui-button.topbar-theme-toggle:active svg) {
    transform: translateY(1px) scaleX(1.15) scaleY(0.95);
  }
</style>
