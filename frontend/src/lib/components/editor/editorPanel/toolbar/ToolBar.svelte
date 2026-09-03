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
    <Button icon={Undo2} title="Undo" onclick={undo} disabled={!$canWrite} />
    <Button icon={Redo2} title="Redo" onclick={redo} disabled={!$canWrite} />
    <Separator />
    <Button
      icon={Bold}
      class="bold-btn"
      title="Bold"
      onclick={toggleBold}
      disabled={!$canWrite}
    />
    <Button
      icon={Italic}
      title="Italic"
      onclick={toggleItalic}
      disabled={!$canWrite}
    />
    <Button
      icon={Underline}
      title="Underline"
      onclick={toggleUnderline}
      disabled={!$canWrite}
    />
    <Separator />
    <Button
      icon={List}
      title="Bullet list"
      onclick={() => toggleLinePrefix("- ")}
      disabled={!$canWrite}
    />
    <Button
      icon={ListOrdered}
      title="Numbered list"
      onclick={() => toggleLinePrefix("+ ")}
      disabled={!$canWrite}
    />
    <Button
      icon={Sigma}
      title="Math"
      onclick={() => toggleWrap("$", "$")}
      disabled={!$canWrite}
    />
    <Button
      icon={Code}
      title="Code"
      onclick={() => toggleWrap("`", "`")}
      disabled={!$canWrite}
    />
    <Separator />
    <Button
      icon={MessageSquarePlus}
      title="Add a comment"
      onclick={addComment}
      disabled={!$canComment}
    />
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
