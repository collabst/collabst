<script lang="ts">
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'

  let email = ''
  let username = ''
  let password = ''
  let confirmPassword = ''
  let error = ''
  let loading = false

  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = ''

    if (password !== confirmPassword) {
      error = 'Passwords do not match'
      return
    }

    if (password.length < 6) {
      error = 'Password must be at least 6 characters'
      return
    }

    loading = true

    try {
      await auth.register(email, username, password)
      goto('/projects', { replaceState: true })
    } catch (err: any) {
      error = err.response?.data?.detail || 'Registration failed'
    } finally {
      loading = false
    }
  }
</script>

<div class="container">
  <div class="card">
    <h1>Typst Collaboration</h1>
    <h2>Create Account</h2>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <form on:submit={handleSubmit}>
      <div class="field">
        <label>Email</label>
        <input
          type="email"
          bind:value={email}
          required
          placeholder="your@email.com"
        />
      </div>

      <div class="field">
        <label>Username</label>
        <input
          type="text"
          bind:value={username}
          required
          placeholder="username"
        />
      </div>

      <div class="field">
        <label>Password</label>
        <input
          type="password"
          bind:value={password}
          required
          placeholder="••••••••"
        />
      </div>

      <div class="field">
        <label>Confirm Password</label>
        <input
          type="password"
          bind:value={confirmPassword}
          required
          placeholder="••••••••"
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Register'}
      </button>
    </form>

    <p class="footer">
      Already have an account? <a href="/login">Login</a>
    </p>
  </div>
</div>

<style>
  .container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .card {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }

  h1 {
    font-size: 28px;
    font-weight: bold;
    color: #333;
    margin-bottom: 0.5rem;
    text-align: center;
  }

  h2 {
    font-size: 20px;
    color: #666;
    margin-bottom: 2rem;
    text-align: center;
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  input {
    padding: 0.75rem;
    border: 2px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
  }

  input:focus {
    outline: none;
    border-color: #667eea;
  }

  button {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 1rem;
  }

  button:hover:not(:disabled) {
    background: #5568d3;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .footer {
    margin-top: 1.5rem;
    text-align: center;
    color: #666;
    font-size: 14px;
  }

  .footer :global(a) {
    color: #667eea;
    text-decoration: none;
    font-weight: 600;
  }

  .footer :global(a:hover) {
    text-decoration: underline;
  }
</style>
