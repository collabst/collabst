<script lang="ts">
  import { leftPanelTab, type LeftPanelTab } from "$lib/components/editor/context/index";

  const tabTitles: Record<LeftPanelTab, string> = {
    files: "Files",
    search: "Search",
    outline: "Outline",
    issues: "Issues",
    comments: "Comments",
  };

  let title = $derived(tabTitles[$leftPanelTab]);
</script>

<div class="top-bar">
  {title}
</div>

<style>
  .top-bar {
    width: 100%;
    font-size: 2rem;
    font-weight: bold;
    padding: 2rem;
  }
</style>
