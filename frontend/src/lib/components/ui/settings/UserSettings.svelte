<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import Panel from "./Panel.svelte";
  import Profile from "./user/Profile.svelte";
  import Password from "./user/Password.svelte";

  interface Props {
    open: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  // Guests have no email and no password to change.
  let isAuthUser = $derived($auth.user?.user_type === "auth");
</script>

{#if open && $auth.user}
  <Panel title="Account" onclose={() => (open = false)}>
    <Profile />
    {#if isAuthUser}
      <div class="divider"></div>
      <Password />
    {/if}
  </Panel>
{/if}

<style>
  .divider {
    height: 1px;
    background-color: var(--editor-panels-border);
  }
</style>
