<script lang="ts">
  import type { Project } from "$lib/types";
  import ProjectButton from "./ProjectButton.svelte";
  import ProjectSearch from "./ProjectSearch.svelte";
  import ProjectGridView from "./ProjectGridView.svelte";
  import ProjectListView from "./ProjectListView.svelte";
  import IconToggle from "$lib/components/ui/IconToggle.svelte";
  import DropdownSettingsButton from "$lib/components/ui/DropdownSettingsButton.svelte";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import List from "@lucide/svelte/icons/list";

  let { projects, onCreateProject, onInvite, onDelete } = $props<{
    projects: Project[];
    onCreateProject: () => void;
    onInvite: (projectId: string) => void;
    onDelete: (projectId: string) => void;
  }>();

  // Search state
  let searchQuery = $state("");

  // View and sort settings - load from localStorage if available
  let viewMode = $state<"grid" | "list">(
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("dashboardViewMode") as "grid" | "list")) ||
      "grid",
  );
  let sortBy = $state<"name" | "created" | "modified">(
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("dashboardSortBy") as
        | "name"
        | "created"
        | "modified")) ||
      "modified",
  );

  // Save view mode to localStorage when it changes
  $effect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("dashboardViewMode", viewMode);
    }
  });

  // Save sort mode to localStorage when it changes
  $effect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("dashboardSortBy", sortBy);
    }
  });

  const viewOptions = [
    { value: "grid", icon: LayoutGrid, label: "Grid View" },
    { value: "list", icon: List, label: "List View" },
  ];

  const sortOptions = [
    { value: "modified", label: "Last Modified" },
    { value: "created", label: "Last Created" },
    { value: "name", label: "Name" },
  ];

  // Sorting and filtering logic
  const sortedProjects = $derived(() => {
    // First filter by search query
    let filtered = projects;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = projects.filter(
        (project: Project) =>
          project.name.toLowerCase().includes(query) ||
          project.description?.toLowerCase().includes(query),
      );
    }

    // Then sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "created":
        return sorted.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      case "modified":
      default:
        return sorted.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
    }
  });

  function handleSortByColumn(column: "name" | "created" | "modified") {
    sortBy = column;
  }
</script>

<div class="content">
  <h1 class="page-title">Dashboard</h1>

  <div class="controls-row">
    <ProjectButton onclick={onCreateProject} />

    <div class="view-controls">
      <ProjectSearch bind:value={searchQuery} />

      <IconToggle bind:value={viewMode} options={viewOptions} />

      <div class="sort-label">Sort by:</div>
      <div class="sort-dropdown">
        <DropdownSettingsButton bind:value={sortBy} options={sortOptions} />
      </div>
    </div>
  </div>

  {#if viewMode === "grid"}
    <ProjectGridView
      projects={sortedProjects()}
      {onInvite}
      {onDelete}
    />
  {:else}
    <ProjectListView
      projects={sortedProjects()}
      {sortBy}
      onSortByColumn={handleSortByColumn}
      {onInvite}
      {onDelete}
    />
  {/if}
</div>

<style>
  .content {
    padding: 2rem;
    padding-top: 1rem;
    flex: 1;
    /* Prevent initial flash */
    contain: layout style;
  }

  .page-title {
    font-size: 48px;
    font-weight: 700;
    margin: 1.5rem 0 1.5rem 0;
    margin-left: 2.3rem;
    color: var(--text-primary);
    text-align: left;
    font-family: "DM Serif Display", Georgia, serif;
    letter-spacing: -0.02em;
  }

  .controls-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .view-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
  }

  .sort-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .sort-dropdown {
    min-width: 150px;
    margin-right: 1.8rem;
  }
</style>
