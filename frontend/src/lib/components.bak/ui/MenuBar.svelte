<script lang="ts">
  import DropdownMenuButton, { type DropdownMenuItem } from './DropdownMenuButton.svelte'
  import FilePlus from '@lucide/svelte/icons/file-plus'
  import Upload from '@lucide/svelte/icons/upload'
  import FileEdit from '@lucide/svelte/icons/file-edit'
  import Trash from '@lucide/svelte/icons/trash-2'
  import Download from '@lucide/svelte/icons/download'
  import Undo from '@lucide/svelte/icons/undo'
  import Redo from '@lucide/svelte/icons/redo'
  import Search from '@lucide/svelte/icons/search'
  import MousePointerClick from '@lucide/svelte/icons/mouse-pointer-click'
  import MessageSquarePlus from '@lucide/svelte/icons/message-square-plus'
  import Eye from '@lucide/svelte/icons/eye'
  import MousePointer from '@lucide/svelte/icons/mouse-pointer'
  import WrapText from '@lucide/svelte/icons/wrap-text'
  import Palette from '@lucide/svelte/icons/palette'
  import Contrast from '@lucide/svelte/icons/contrast'
  import HelpCircle from '@lucide/svelte/icons/help-circle'
  import { theme as themeStore } from '$lib/stores/theme'
  
  interface MenuBarProps {
    onNewFile?: () => void
    onUploadFile?: () => void
    onRenameFile?: () => void
    onDeleteFile?: () => void
    onExportPDF?: () => void
    onExportPNG?: () => void
    onExportSVG?: () => void
    onUndo?: () => void
    onRedo?: () => void
    onSearchReplace?: () => void
    onSelectAll?: () => void
    onToggleLineComment?: () => void
    onToggleBlockComment?: () => void
    onAddComment?: () => void
    onShowToolbar?: () => void
    onScrollOnType?: () => void
    onWrapLines?: () => void
    onThemeLight?: () => void
    onThemeDark?: () => void
    onNegativePreview?: () => void
    wrapLines?: boolean
    negativePreview?: boolean
    showToolbar?: boolean
    canWrite?: boolean
    canComment?: boolean
  }
  
  let {
    onNewFile = () => console.log('New file'),
    onUploadFile = () => console.log('Upload file'),
    onRenameFile = () => console.log('Rename file'),
    onDeleteFile = () => console.log('Delete file'),
    onExportPDF = () => console.log('Export PDF'),
    onExportPNG = () => console.log('Export PNG'),
    onExportSVG = () => console.log('Export SVG'),
    onUndo = () => console.log('Undo'),
    onRedo = () => console.log('Redo'),
    onSearchReplace = () => console.log('Search and replace'),
    onSelectAll = () => console.log('Select all'),
    onToggleLineComment = () => console.log('Toggle line comment'),
    onToggleBlockComment = () => console.log('Toggle block comment'),
    onAddComment = () => console.log('Add comment'),
    onShowToolbar = () => console.log('Show toolbar'),
    onScrollOnType = () => console.log('Scroll on type'),
    onWrapLines = () => console.log('Wrap lines'),
    onThemeLight = () => console.log('Theme Light'),
    onThemeDark = () => console.log('Theme Dark'),
    onNegativePreview = () => console.log('Negative preview'),
    wrapLines: wrapLinesFromParent = true,
    negativePreview: negativePreviewFromParent = false,
    showToolbar: showToolbarFromParent = true,
    canWrite = true,
    canComment = true
  }: MenuBarProps = $props()
  
  // Toggle states
  let showToolbar = $state(true)
  let scrollOnType = $state(false)
  let wrapLines = $state(true)
  let currentTheme = $state<'light' | 'dark'>($themeStore)
  let negativePreview = $state(false)
  
  // Sync currentTheme with theme store
  $effect(() => {
    currentTheme = $themeStore
  })

  // Sync toggle states with parent props
  $effect(() => {
    wrapLines = wrapLinesFromParent
  })

  $effect(() => {
    negativePreview = negativePreviewFromParent
  })

  $effect(() => {
    showToolbar = showToolbarFromParent
  })
  
  // Track which menu is open
  let openMenuIndex = $state<number | null>(null)
  let anyMenuWasOpen = $state(false)
  
  let fileMenuOpen = $state(false)
  let editMenuOpen = $state(false)
  let viewMenuOpen = $state(false)
  let helpMenuOpen = $state(false)
  
  // Sync individual menu states with openMenuIndex
  $effect(() => {
    fileMenuOpen = openMenuIndex === 0
    editMenuOpen = openMenuIndex === 1
    viewMenuOpen = openMenuIndex === 2
    helpMenuOpen = openMenuIndex === 3
  })
  
  function handleMenuToggle(index: number, open: boolean) {
    if (open) {
      openMenuIndex = index
      anyMenuWasOpen = true
    } else {
      openMenuIndex = null
      // Reset anyMenuWasOpen after a short delay
      setTimeout(() => {
        if (openMenuIndex === null) {
          anyMenuWasOpen = false
        }
      }, 100)
    }
  }
  
  function handleMenuHover(index: number) {
    // Only auto-switch if a menu is already open
    if (anyMenuWasOpen && openMenuIndex !== index) {
      openMenuIndex = index
    }
  }
  
  // File menu - use $derived to properly reference props
  const fileMenuItems = $derived<DropdownMenuItem[]>([
    ...(canWrite ? [{ label: 'New file', icon: FilePlus, onclick: () => onNewFile() }] : []),
    ...(canWrite ? [{ label: 'Upload file', icon: Upload, onclick: () => onUploadFile() }] : []),
    ...(canWrite ? [{ label: 'Rename file', icon: FileEdit, onclick: () => onRenameFile(), shortcut: 'F2' }] : []),
    ...(canWrite ? [{ label: 'Delete file', icon: Trash, onclick: () => onDeleteFile(), shortcut: 'Delete', separator: true }] : []),
    { label: 'Export PDF', icon: Download, onclick: () => onExportPDF(), shortcut: 'Ctrl+⇧+S' },
    { 
      label: 'Export as', 
      icon: Download,
      submenu: [
        { label: 'PDF', onclick: () => onExportPDF() },
        { label: 'PNG', onclick: () => onExportPNG() },
        { label: 'SVG', onclick: () => onExportSVG() }
      ]
    }
  ])
  
  // Edit menu
  const editMenuItems = $derived<DropdownMenuItem[]>([
    { label: 'Undo', icon: Undo, onclick: () => onUndo(), shortcut: 'Ctrl+Z' },
    { label: 'Redo', icon: Redo, onclick: () => onRedo(), shortcut: 'Ctrl+Y', separator: true },
    { label: 'Search and replace', icon: Search, onclick: () => onSearchReplace(), shortcut: 'Ctrl+F' },
    { label: 'Select all', icon: MousePointerClick, onclick: () => onSelectAll(), shortcut: 'Ctrl+A', separator: true },
    ...(canWrite ? [{ label: 'Toggle line comment', onclick: () => onToggleLineComment(), shortcut: 'Ctrl+/' }] : []),
    ...(canWrite ? [{ label: 'Toggle block comment', onclick: () => onToggleBlockComment(), shortcut: 'Ctrl+⇧+A' }] : []),
    ...(canComment ? [{ label: 'Add comment', icon: MessageSquarePlus, onclick: () => onAddComment() }] : [])
  ])
  
  // View menu
  const viewMenuItems = $derived<DropdownMenuItem[]>([
    { 
      label: 'Show toolbar', 
      icon: Eye, 
      onclick: () => { showToolbar = !showToolbar; onShowToolbar(); },
      checked: showToolbar,
      isToggle: true
    },
    { 
      label: 'Scroll on type', 
      icon: MousePointer, 
      onclick: () => { scrollOnType = !scrollOnType; onScrollOnType(); },
      checked: scrollOnType,
      isToggle: true
    },
    { 
      label: 'Wrap lines', 
      icon: WrapText, 
      onclick: () => { wrapLines = !wrapLines; onWrapLines(); }, 
      separator: true,
      checked: wrapLines,
      isToggle: true
    },
    { 
      label: 'Theme', 
      icon: Palette,
      submenu: [
        { 
          label: 'Light', 
          onclick: () => { onThemeLight(); },
          checked: currentTheme === 'light',
          isToggle: true
        },
        { 
          label: 'Dark', 
          onclick: () => { onThemeDark(); },
          checked: currentTheme === 'dark',
          isToggle: true
        }
      ]
    },
    { 
      label: 'Negative preview for dark theme', 
      icon: Contrast, 
      onclick: () => { negativePreview = !negativePreview; onNegativePreview(); },
      checked: negativePreview,
      isToggle: true
    }
  ])
  
  // Help menu
  const helpMenuItems: DropdownMenuItem[] = [
    { label: 'collabst version', icon: HelpCircle, onclick: () => console.log('Version: 1.0.0') }
  ]
</script>

<nav class="menu-bar">
  <DropdownMenuButton 
    label="File" 
    items={fileMenuItems}
    bind:isOpen={fileMenuOpen}
    onToggle={(open) => handleMenuToggle(0, open)}
    onHover={() => handleMenuHover(0)}
  />
  <DropdownMenuButton 
    label="Edit" 
    items={editMenuItems}
    bind:isOpen={editMenuOpen}
    onToggle={(open) => handleMenuToggle(1, open)}
    onHover={() => handleMenuHover(1)}
  />
  <DropdownMenuButton 
    label="View" 
    items={viewMenuItems}
    bind:isOpen={viewMenuOpen}
    onToggle={(open) => handleMenuToggle(2, open)}
    onHover={() => handleMenuHover(2)}
  />
  <DropdownMenuButton 
    label="Help" 
    items={helpMenuItems}
    bind:isOpen={helpMenuOpen}
    onToggle={(open) => handleMenuToggle(3, open)}
    onHover={() => handleMenuHover(3)}
  />
</nav>

<style>
  .menu-bar {
    display: flex;
    align-items: center;
    gap: 1px;
    margin-left: 16px;
  }
</style>
