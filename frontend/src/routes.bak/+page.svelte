<script lang="ts">
  import { goto } from '$app/navigation'
  import { get } from 'svelte/store'
  import { auth } from '$lib/stores/auth'
  import { onMount } from 'svelte'

  onMount(() => {
    const state = get(auth)
    if (state.user?.user_type === 'guest') {
      goto('/login', { replaceState: true })
      return
    }

    goto('/projects', { replaceState: true })
  })
</script>
