<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import AuthLayout from "$lib/components/auth/AuthLayout.svelte";

  let email = "";
  let password = "";
  let error = "";
  let loading = false;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";
    loading = true;

    try {
      await auth.login(email, password);
      goto("/projects", { replaceState: true });
    } catch (err: any) {
      error = err.response?.data?.detail || "Login failed";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Login - Collabst</title>
</svelte:head>

<AuthLayout>
  <h1>Typst Collaboration</h1>
  <h2>Login</h2>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <form onsubmit={handleSubmit}>
    <div class="field">
      <label for="login-email">Email</label>
      <input
        id="login-email"
        type="email"
        bind:value={email}
        required
        placeholder="your@email.com"
        autocomplete="email"
      />
    </div>

    <div class="field">
      <label for="login-password">Password</label>
      <input
        id="login-password"
        type="password"
        bind:value={password}
        required
        placeholder="••••••••"
        autocomplete="current-password"
      />
    </div>

    <button type="submit" disabled={loading}>
      {loading ? "Logging in..." : "Login"}
    </button>
  </form>

  <p class="footer">
    Don't have an account? <a href="/register">Register</a>
  </p>
</AuthLayout>
