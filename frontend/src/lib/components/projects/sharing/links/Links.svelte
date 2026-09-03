<script lang="ts">
  import { visibleLinkTypes } from "../context";
  import Section from "../Section.svelte";
  import LinkRow from "./LinkRow.svelte";
  import Link2 from "@lucide/svelte/icons/link-2";
</script>

<Section title="Public links" icon={Link2}>
  <p class="hint">
    Anyone with a link gets that level of access without an account.
  </p>
  {#each $visibleLinkTypes as linkType (linkType.key)}
    <LinkRow {linkType} />
  {/each}
</Section>

<style>
  .hint {
    margin: 0 0 0.25rem 0;
    font-size: 0.8rem;
    color: var(--text-tertiary);
  }
</style>
