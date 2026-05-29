<script lang="ts">
  import { House } from "@lucide/svelte";

</script>

<div class="top-bar">
  <House size={32} />
  <div class="project-name">Project Name</div>
</div>

<style>
  .top-bar {
    display: flex;
    align-items: center;
    background-color: var(--bg-primary);
    padding: 0.75rem 1rem;
  }

  .project-name {
    margin-left: 0.5rem;
    font-size: 1.25rem;
    font-weight: bold;
    color: var(--text-primary);
  }
</style>
