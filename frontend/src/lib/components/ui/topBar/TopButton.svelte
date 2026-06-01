<script lang="ts">
  import type { Component } from "svelte";

  interface Props {
    icon: Component;
    onclick?: () => void;
  }

  let { icon: Icon, onclick }: Props = $props();

  const strokeWidth = 2;
  const size = 26;
</script>

<button
  class="button"
  {onclick}
  style="--stroke-width: {strokeWidth};"
>
  <Icon size={size} />
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
    color: var(--text-primary);
  }

  .button:hover :global(svg){
    animation: jumpAnimation 0.2s ease-out;
    stroke-width: 2.5;
  }

  @keyframes jumpAnimation {
    0% {
      transform: translateY(-2px) scaleX(0.8) scaleY(1.1);
    }
    80% {
      transform: translateY(1px) scaleX(1.1) scaleY(0.95);
    }
    100% {
      transform: none;
    }
  }
</style>
