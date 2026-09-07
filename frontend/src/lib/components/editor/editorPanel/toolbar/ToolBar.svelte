<script lang="ts">
  import Button from "./Button.svelte";
  import Separator from "./Separator.svelte";
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
</script>

<div class="container">
  <div class="tool-bar">
    <Button title="Undo" onclick={undo} disabled={!$canWrite}>
      <Undo2 />
    </Button>
    <Button title="Redo" onclick={redo} disabled={!$canWrite}>
      <Redo2 />
    </Button>
    <Separator />
    <Button
      class="bold-btn"
      title="Bold"
      onclick={toggleBold}
      disabled={!$canWrite}
    >
      <Bold />
    </Button>
    <Button
      title="Italic"
      onclick={toggleItalic}
      disabled={!$canWrite}
    >
      <Italic />
    </Button>
    <Button
      title="Underline"
      onclick={toggleUnderline}
      disabled={!$canWrite}
    >
      <Underline />
    </Button>
    <Separator />
    <Button
      title="Bullet list"
      onclick={() => toggleLinePrefix("- ")}
      disabled={!$canWrite}
    >
      <List />
    </Button>
    <Button
      title="Numbered list"
      onclick={() => toggleLinePrefix("+ ")}
      disabled={!$canWrite}
    >
      <ListOrdered />
    </Button>
    <Button
      title="Math"
      onclick={() => toggleWrap("$", "$")}
      disabled={!$canWrite}
    >
      <Sigma />
    </Button>
    <Button
      title="Code"
      onclick={() => toggleWrap("`", "`")}
      disabled={!$canWrite}
    >
      <Code />
    </Button>
    <Separator />
    <Button
      title="Add a comment"
      onclick={addComment}
      disabled={!$canComment}
    >
      <MessageSquarePlus />
    </Button>
  </div>
</div>

<style>
  .container {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .tool-bar {
    display: flex;
    background-color: var(--bg-primary);
    padding: 0.2rem 0.75rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.5rem;
    margin: 0.5rem;
  }
</style>
