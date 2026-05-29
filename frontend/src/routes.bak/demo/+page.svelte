<script lang="ts">
  import { Button, IconButton, Input, Modal, Tooltip, Panel } from '$lib/components/ui'
  import Settings from '@lucide/svelte/icons/settings'
  import Bell from '@lucide/svelte/icons/bell'
  import Download from '@lucide/svelte/icons/download'
  import Upload from '@lucide/svelte/icons/upload'
  import Save from '@lucide/svelte/icons/save'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import Edit from '@lucide/svelte/icons/edit'
  import Eye from '@lucide/svelte/icons/eye'
  import Play from '@lucide/svelte/icons/play'
  import Pause from '@lucide/svelte/icons/pause'
  import Check from '@lucide/svelte/icons/check'
  
  let inputValue = $state('')
  let modalOpen = $state(false)
</script>

<div class="demo-page">
  <header class="demo-header">
    <h1>UI Components Demo</h1>
    <p>Preview of the new theming system and components</p>
  </header>

  <section class="demo-section">
    <h2>Buttons</h2>
    <div class="demo-grid">
      <div class="demo-item">
        <h3>Button Variants</h3>
        <div class="button-group">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="success">Success</Button>
        </div>
      </div>

      <div class="demo-item">
        <h3>Button Sizes</h3>
        <div class="button-group">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </div>

      <div class="demo-item">
        <h3>Disabled State</h3>
        <div class="button-group">
          <Button disabled>Disabled</Button>
          <Button variant="primary" disabled>Disabled Primary</Button>
        </div>
      </div>
    </div>
  </section>

  <section class="demo-section">
    <h2>Icon Buttons</h2>
    <div class="demo-grid">
      <div class="demo-item">
        <h3>Icon Button Variants</h3>
        <div class="button-group">
          <Tooltip text="Settings">
            <IconButton icon={Settings} variant="primary" />
          </Tooltip>
          <Tooltip text="Notifications">
            <IconButton icon={Bell} variant="secondary" />
          </Tooltip>
          <Tooltip text="View">
            <IconButton icon={Eye} variant="ghost" />
          </Tooltip>
          <Tooltip text="Delete">
            <IconButton icon={Trash2} variant="danger" />
          </Tooltip>
          <Tooltip text="Save">
            <IconButton icon={Check} variant="success" />
          </Tooltip>
        </div>
      </div>

      <div class="demo-item">
        <h3>Icon Button Sizes</h3>
        <div class="button-group">
          <IconButton icon={Download} size="sm" />
          <IconButton icon={Upload} size="md" />
          <IconButton icon={Save} size="lg" />
        </div>
      </div>

      <div class="demo-item">
        <h3>Action Icons</h3>
        <div class="button-group">
          <IconButton icon={Play} variant="success" title="Play" />
          <IconButton icon={Pause} variant="ghost" title="Pause" />
          <IconButton icon={Edit} variant="primary" title="Edit" />
          <IconButton icon={Trash2} variant="danger" title="Delete" />
        </div>
      </div>
    </div>
  </section>

  <section class="demo-section">
    <h2>Inputs</h2>
    <div class="demo-grid">
      <div class="demo-item">
        <h3>Standard Input</h3>
        <Input 
          bind:value={inputValue}
          placeholder="Enter text..."
          label="Label"
          fullWidth
        />
      </div>

      <div class="demo-item">
        <h3>Required Input</h3>
        <Input 
          placeholder="Required field"
          label="Required Field"
          required
          fullWidth
        />
      </div>

      <div class="demo-item">
        <h3>Error State</h3>
        <Input 
          placeholder="Invalid input"
          label="Email"
          error="Please enter a valid email"
          fullWidth
        />
      </div>

      <div class="demo-item">
        <h3>Disabled Input</h3>
        <Input 
          value="Disabled input"
          label="Disabled"
          disabled
          fullWidth
        />
      </div>
    </div>
  </section>

  <section class="demo-section">
    <h2>Modal</h2>
    <div class="demo-item">
      <Button onclick={() => modalOpen = true}>Open Modal</Button>
      
      <Modal bind:open={modalOpen} title="Example Modal" size="md">
        <div style="padding: var(--space-4) 0;">
          <p style="color: var(--text-secondary); margin-bottom: var(--space-4);">
            This is an example modal dialog using the new theme system.
          </p>
          <Input 
            placeholder="Enter something..."
            label="Input Field"
            fullWidth
          />
        </div>
        
        {#snippet footer()}
          <Button variant="ghost" onclick={() => modalOpen = false}>
            Cancel
          </Button>
          <Button variant="primary" onclick={() => modalOpen = false}>
            Confirm
          </Button>
        {/snippet}
      </Modal>
    </div>
  </section>

  <section class="demo-section">
    <h2>Color Palette</h2>
    <div class="color-grid">
      <div class="color-swatch">
        <div class="color-box" style="background: var(--color-primary-500)"></div>
        <span>Primary</span>
      </div>
      <div class="color-swatch">
        <div class="color-box" style="background: var(--color-secondary-500)"></div>
        <span>Secondary</span>
      </div>
      <div class="color-swatch">
        <div class="color-box" style="background: var(--color-success)"></div>
        <span>Success</span>
      </div>
      <div class="color-swatch">
        <div class="color-box" style="background: var(--color-warning)"></div>
        <span>Warning</span>
      </div>
      <div class="color-swatch">
        <div class="color-box" style="background: var(--color-error)"></div>
        <span>Error</span>
      </div>
      <div class="color-swatch">
        <div class="color-box" style="background: var(--color-info)"></div>
        <span>Info</span>
      </div>
    </div>
  </section>

  <section class="demo-section">
    <h2>Typography</h2>
    <div class="typography-demo">
      <h1 style="font-size: var(--text-4xl); margin-bottom: var(--space-2);">Heading 1</h1>
      <h2 style="font-size: var(--text-3xl); margin-bottom: var(--space-2);">Heading 2</h2>
      <h3 style="font-size: var(--text-2xl); margin-bottom: var(--space-2);">Heading 3</h3>
      <h4 style="font-size: var(--text-xl); margin-bottom: var(--space-2);">Heading 4</h4>
      <p style="font-size: var(--text-base); color: var(--text-secondary); margin-bottom: var(--space-2);">
        Body text with secondary color
      </p>
      <p style="font-size: var(--text-sm); color: var(--text-tertiary);">
        Small text with tertiary color
      </p>
    </div>
  </section>

  <section class="demo-section">
    <h2>Panel Component</h2>
    <div class="demo-grid">
      <Panel title="Simple Panel" subtitle="With subtitle">
        <p style="color: var(--text-secondary);">This is panel content with padding.</p>
      </Panel>
      
      <Panel title="Panel with Actions">
        {#snippet actions()}
          <IconButton icon={Settings} variant="ghost" size="sm" />
          <IconButton icon={Edit} variant="ghost" size="sm" />
        {/snippet}
        
        <p style="color: var(--text-secondary);">Panel content with action buttons in header.</p>
      </Panel>
      
      <Panel title="No Padding Panel" padding={false}>
        <div style="padding: var(--space-4); background: var(--surface-tertiary);">
          Custom styled content without default padding
        </div>
      </Panel>
    </div>
  </section>
</div>

<style>
  .demo-page {
    padding: var(--space-8);
    max-width: 1200px;
    margin: 0 auto;
  }

  .demo-header {
    margin-bottom: var(--space-8);
    text-align: center;
  }

  .demo-header h1 {
    font-size: var(--text-4xl);
    font-weight: var(--font-bold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .demo-header p {
    font-size: var(--text-lg);
    color: var(--text-tertiary);
  }

  .demo-section {
    margin-bottom: var(--space-12);
    padding: var(--space-6);
    background: var(--surface-primary);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-primary);
  }

  .demo-section h2 {
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-6);
    padding-bottom: var(--space-3);
    border-bottom: 2px solid var(--border-primary);
  }

  .demo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-6);
  }

  .demo-item {
    padding: var(--space-4);
    background: var(--surface-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-primary);
  }

  .demo-item h3 {
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    margin-bottom: var(--space-4);
  }

  .button-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--space-4);
  }

  .color-swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .color-box {
    width: 80px;
    height: 80px;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-primary);
  }

  .color-swatch span {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .typography-demo {
    padding: var(--space-4);
  }
</style>
