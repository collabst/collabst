<script lang="ts">
  import type { Component, Snippet } from "svelte";

  interface Props {
    title: string;
    icon: Component;
    children: Snippet;
  }

  let { title, icon: Icon, children }: Props = $props();
</script>

<section class="section">
  <h3><Icon size={15} /> {title}</h3>
  <div class="content">
    {@render children()}
  </div>
</section>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.9rem 1rem;
    border: 1px solid var(--editor-panels-border);
    border-radius: 0.9rem;
    background-color: color-mix(in srgb, var(--bg-editor), transparent 45%);
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
