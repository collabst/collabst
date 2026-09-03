<script lang="ts">
  import { members } from "../context";
  import Section from "../Section.svelte";
  import Member from "./Member.svelte";
  import Users from "@lucide/svelte/icons/users";
</script>

<Section title="Members" icon={Users}>
  {#if $members.length === 0}
    <p class="muted">No collaborators yet.</p>
  {:else}
    {#each $members as member (member.id)}
      <Member {member} />
    {/each}
  {/if}
</Section>

<style>
  .muted {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-tertiary);
  }
</style>
