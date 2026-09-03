<script lang="ts">
  import EditorSettings from "$lib/components/ui/settings/EditorSettings.svelte";
  import TopButton from "./TopButton.svelte";
  import Settings from "@lucide/svelte/icons/settings";

  // Whether the panel is showing is nobody else's business, so it stays here.
  let open = $state(false);
</script>

<TopButton icon={Settings} onclick={() => (open = !open)} />
<EditorSettings bind:open />
