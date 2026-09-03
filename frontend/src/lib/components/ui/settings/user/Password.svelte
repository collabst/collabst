<script lang="ts">
  import { changePassword, savingPassword } from "../context";
  import Row from "../Row.svelte";

  let current = $state("");
  let next = $state("");
  let confirm = $state("");

  async function submit(event: Event) {
    event.preventDefault();
    if (await changePassword(current, next, confirm)) {
      current = "";
      next = "";
      confirm = "";
    }
  }
</script>

<form class="password" onsubmit={submit}>
  <h3>Password</h3>

  <Row label="Current password" forId="settings-current-password">
    <input
      id="settings-current-password"
      type="password"
      autocomplete="current-password"
      bind:value={current}
      disabled={$savingPassword}
    />
  </Row>
  <Row label="New password" forId="settings-new-password">
    <input
      id="settings-new-password"
      type="password"
      autocomplete="new-password"
      bind:value={next}
      disabled={$savingPassword}
    />
  </Row>
  <Row label="Confirm new password" forId="settings-confirm-password">
    <input
      id="settings-confirm-password"
      type="password"
      autocomplete="new-password"
      bind:value={confirm}
      disabled={$savingPassword}
    />
  </Row>

  <div class="actions">
    <button
      class="submit"
      type="submit"
      disabled={$savingPassword || !current || !next}
    >
      {$savingPassword ? "Saving…" : "Change password"}
    </button>
  </div>
</form>

<style>
  .password {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  h3 {
    margin: 0 0 0.25rem 0;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }

  .submit {
    padding: 0.45rem 0.85rem;
    border: 1px solid var(--color-tertiary-500);
    border-radius: 0.7rem;
    background-color: var(--navbar-bg);
    box-shadow: inset 0 -3px 0 0 var(--navbar-shadow);
    color: var(--color-tertiary-500);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .submit:active:not(:disabled) {
    box-shadow: inset 0 3px 0 0 var(--navbar-shadow);
    transform: translateY(1px);
  }

  .submit:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
