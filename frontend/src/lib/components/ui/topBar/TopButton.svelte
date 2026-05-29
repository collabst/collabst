<script lang="ts">
  import type { Component } from "svelte";

  interface Props {
    icon: Component;
    onclick?: () => void;
  }

  let { icon: Icon, onclick }: Props = $props();

  const strokeWidth = 2;
  const size = 28;
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
    padding: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
  }

  .button:hover {
    /* background-color: var(--bg-secondary);*/
  }
</style>
