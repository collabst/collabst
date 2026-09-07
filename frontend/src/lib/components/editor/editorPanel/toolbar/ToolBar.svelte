<script lang="ts">
  import Button from "./Button.svelte";
  import Separator from "./Separator.svelte";
  import OverflowBar, {
    type OverflowItem,
  } from "$lib/components/ui/OverflowBar.svelte";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import Italic from "@lucide/svelte/icons/italic";
  import Bold from "@lucide/svelte/icons/bold";
  import Underline from "@lucide/svelte/icons/underline";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import Redo2 from "@lucide/svelte/icons/redo-2";
  import List from "@lucide/svelte/icons/list";
  import ListOrdered from "@lucide/svelte/icons/list-ordered";
  import Sigma from "@lucide/svelte/icons/sigma";
  import Code from "@lucide/svelte/icons/code";
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";
  import {
    addComment,
    canComment,
    canWrite,
    redo,
    toggleBold,
    toggleItalic,
    toggleLinePrefix,
    toggleUnderline,
    toggleWrap,
    undo,
  } from "$lib/components/editor/context";

  // The editor is the column that gives way when either handle is dragged, so
  // this is the bar most likely to run out of room. It folds from the tail, and
  // the groups are ordered so that the least reachable actions go first.
  const tools: OverflowItem[] = $derived([
    { render: undoTool, label: "Undo" },
    { render: redoTool, label: "Redo" },
    { render: separator, separator: true },
    { render: boldTool, label: "Bold" },
    { render: italicTool, label: "Italic" },
    { render: underlineTool, label: "Underline" },
    { render: separator, separator: true },
    { render: bulletTool, label: "Bullet list" },
    { render: numberedTool, label: "Numbered list" },
    { render: mathTool, label: "Math" },
    { render: codeTool, label: "Code" },
    { render: separator, separator: true },
    { render: commentTool, label: "Add a comment" },
  ]);
</script>

{#snippet separator()}
  <Separator />
{/snippet}

{#snippet undoTool()}
  <Button title="Undo" onclick={undo} disabled={!$canWrite}>
    <Undo2 />
  </Button>
{/snippet}

{#snippet redoTool()}
  <Button title="Redo" onclick={redo} disabled={!$canWrite}>
    <Redo2 />
  </Button>
{/snippet}

{#snippet boldTool()}
  <Button
    class="bold-btn"
    title="Bold"
    onclick={toggleBold}
    disabled={!$canWrite}
  >
    <Bold />
  </Button>
{/snippet}

{#snippet italicTool()}
  <Button title="Italic" onclick={toggleItalic} disabled={!$canWrite}>
    <Italic />
  </Button>
{/snippet}

{#snippet underlineTool()}
  <Button title="Underline" onclick={toggleUnderline} disabled={!$canWrite}>
    <Underline />
  </Button>
{/snippet}

{#snippet bulletTool()}
  <Button
    title="Bullet list"
    onclick={() => toggleLinePrefix("- ")}
    disabled={!$canWrite}
  >
    <List />
  </Button>
{/snippet}

{#snippet numberedTool()}
  <Button
    title="Numbered list"
    onclick={() => toggleLinePrefix("+ ")}
    disabled={!$canWrite}
  >
    <ListOrdered />
  </Button>
{/snippet}

{#snippet mathTool()}
  <Button
    title="Math"
    onclick={() => toggleWrap("$", "$")}
    disabled={!$canWrite}
  >
    <Sigma />
  </Button>
{/snippet}

{#snippet codeTool()}
  <Button
    title="Code"
    onclick={() => toggleWrap("`", "`")}
    disabled={!$canWrite}
  >
    <Code />
  </Button>
{/snippet}

{#snippet commentTool()}
  <Button title="Add a comment" onclick={addComment} disabled={!$canComment}>
    <MessageSquarePlus />
  </Button>
{/snippet}

{#snippet more({ onclick }: { onclick: (e: MouseEvent) => void })}
  <Button title="More tools" {onclick}>
    <Ellipsis />
  </Button>
{/snippet}

<div class="container">
  <OverflowBar class="editor-tool-bar" items={tools} {more} />
</div>

<style>
  .container {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  /* `OverflowBar` owns the element; see the note on `.nav-bar`. */
  :global(.overflow-bar.editor-tool-bar) {
    background-color: var(--bg-primary);
    padding: 0.2rem 0.75rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.5rem;
    margin: 0.5rem;
  }
</style>
