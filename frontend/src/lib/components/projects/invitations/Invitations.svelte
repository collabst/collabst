<script lang="ts">
  import { myInvitations } from "../context";
  import Invitation from "./Invitation.svelte";
</script>

{#if $myInvitations.length > 0}
  <section class="invitations">
    <h2 class="title">Pending invitations ({$myInvitations.length})</h2>
    <div class="list">
      {#each $myInvitations as invitation (invitation.id)}
        <Invitation {invitation} />
      {/each}
    </div>
  </section>
{/if}

<style>
  .invitations {
    margin-bottom: 1.75rem;
  }

  .title {
    margin: 0 0 0.75rem 0;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 1.4rem;
    font-weight: 600;
    letter-spacing: -0.015em;
    color: var(--text-secondary);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
