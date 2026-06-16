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
</script>

<div class="container">
  <div class="tool-bar">
    <Button icon={Undo2} />
    <Button icon={Redo2} />
    <Separator />
    <Button icon={Bold} strokeWidth={3} />
    <Button icon={Italic} />
    <Button icon={Underline} />
    <Separator />
    <Button icon={List} />
    <Button icon={ListOrdered} />
    <Button icon={Sigma} />
    <Button icon={Code} />
    <Separator />
    <Button icon={MessageSquarePlus} />
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
