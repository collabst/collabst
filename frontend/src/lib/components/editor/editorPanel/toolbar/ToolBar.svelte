<script lang="ts">
  import Button from "./Button.svelte";
  import Separator from "./Separator.svelte";
  import {
    Italic,
    Bold,
    Underline,
    Undo2,
    Redo2,
    List,
    ListOrdered,
    Sigma,
    Code,
    MessageSquarePlus,
  } from "@lucide/svelte";
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
