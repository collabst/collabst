<script lang="ts">
  import { auth } from '$lib/stores/auth'
  import User from '@lucide/svelte/icons/user'
  import LogOut from '@lucide/svelte/icons/log-out'
  
  let showMenu = $state(false)
  
  function toggleMenu() {
    showMenu = !showMenu
  }
  
  function handleLogout() {
    showMenu = false
    auth.logout()
  }
  
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (!target.closest('.profile-menu-container')) {
      showMenu = false
    }
  }
  
  $effect(() => {
    if (showMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  })
</script>

<div class="profile-menu-container">
  <button class="profile-btn" onclick={toggleMenu} title="Profile menu">
    <User size={18} />
  </button>
  
  {#if showMenu}
    <div class="profile-dropdown">
      <div class="profile-info">
        <User size={16} />
        <span>{$auth.user?.username || 'User'}</span>
      </div>
      <div class="divider"></div>
      <button class="menu-item" onclick={handleLogout}>
        <LogOut size={16} />
        <span>Logout</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .profile-menu-container {
    position: relative;
  }
  
  .profile-btn {
    background: transparent;
    border: 1px solid var(--border-primary);
    color: var(--text-primary);
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .profile-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-secondary);
  }
  
  .profile-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    min-width: 200px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    overflow: hidden;
    animation: slideDown 0.2s ease;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .profile-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
  }
  
  .divider {
    height: 1px;
    background: var(--border-primary);
    margin: 0;
  }
  
  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
    text-align: left;
  }
  
  .menu-item:hover {
    background: var(--surface-hover);
  }
</style>
