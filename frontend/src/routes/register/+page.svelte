<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import AuthLayout from "$lib/components/auth/AuthLayout.svelte";

  let email = "";
  let displayName = "";
  let password = "";
  let confirmPassword = "";
  let error = "";
  let loading = false;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";

    if (password !== confirmPassword) {
      error = "Passwords do not match";
      return;
    }

    if (password.length < 6) {
      error = "Password must be at least 6 characters";
      return;
    }

    loading = true;

    try {
      await auth.register(email, displayName, password);
      goto("/projects", { replaceState: true });
    } catch (err: any) {
      error = err.response?.data?.detail || "Registration failed";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Register - Collabst</title>
</svelte:head>

<AuthLayout>
  <h1>Typst Collaboration</h1>
  <h2>Create Account</h2>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <form onsubmit={handleSubmit}>
    <div class="field">
      <label for="register-email">Email</label>
      <input
        id="register-email"
        type="email"
        bind:value={email}
        required
        placeholder="your@email.com"
        autocomplete="email"
      />
    </div>

    <div class="field">
      <label for="register-display-name">Display Name</label>
      <input
        id="register-display-name"
        type="text"
        bind:value={displayName}
        required
        placeholder="Your name"
        autocomplete="name"
      />
    </div>

    <div class="field">
      <label for="register-password">Password</label>
      <input
        id="register-password"
        type="password"
        bind:value={password}
        required
        placeholder="••••••••"
        autocomplete="new-password"
      />
    </div>

    <div class="field">
      <label for="register-confirm-password">Confirm Password</label>
      <input
        id="register-confirm-password"
        type="password"
        bind:value={confirmPassword}
        required
        placeholder="••••••••"
        autocomplete="new-password"
      />
    </div>

    <button type="submit" disabled={loading}>
      {loading ? "Creating account..." : "Register"}
    </button>
  </form>

  <p class="footer">
    Already have an account? <a href="/login">Login</a>
  </p>
</AuthLayout>
