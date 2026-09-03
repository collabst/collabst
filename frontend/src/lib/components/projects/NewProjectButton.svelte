<script lang="ts">
  import { openCreateDialog } from "./context";
  import Button from "./Button.svelte";
  import Plus from "@lucide/svelte/icons/plus";
</script>

<Button variant="primary" onclick={openCreateDialog}>
  <Plus size={17} strokeWidth={2.5} />
  New project
</Button>
