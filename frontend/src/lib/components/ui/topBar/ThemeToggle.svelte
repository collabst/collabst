<script lang="ts">
  import { Sun, Moon } from "@lucide/svelte";
  import { theme } from "$lib/stores/theme";

  function onclick() {
    theme.toggle();
  }

  const strokeWidth = 2;
  const size = 20;
</script>

<button class="button" {onclick} style="--stroke-width: {strokeWidth};">
  {#if $theme === "dark"}
    <Sun {size} />
  {:else}
    <Moon {size} />
  {/if}
</button>

<style>
  .button {
    background: none;
    border: none;
    padding: 0.35rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    color: var(--text-primary);
  }

  :global([data-theme="light"]) .button:hover {
    background: #2a2a2a;
    color: #cccccc;
    border-color: #4a4a4e;
  }

  :global([data-theme="dark"]) .button:hover {
    background: #e8e8e8;
    color: #1e1e1e;
    border-color: #b8b8b8;
  }

  .button:hover :global(svg) {
    animation: bigJumpAnimation 0.2s ease-out;
  }

  @keyframes bigJumpAnimation {
    0% {
      transform: translateY(-8px) scaleX(0.8) scaleY(1.1);
    }
    80% {
      transform: translateY(1px) scaleX(1.2) scaleY(0.95);
    }
    100% {
      transform: none;
    }
  }

  .button:active :global(svg) {
    transform: translateY(1px) scaleX(1.15) scaleY(0.95);
  }
</style>
