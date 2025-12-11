<script lang="ts">
  import { onMount } from "svelte";
  import { EditorView, basicSetup } from "codemirror";
  import { EditorState } from "@codemirror/state";
  import { linter } from "@codemirror/lint";
  import type { Diagnostic, VirtualFile, SemanticTokenLegend } from "$lib/types";
  import { highlightField, updateSyntaxHighlighting } from "$lib/highlighting";
  import { parseRange, convertDiagnosticsToLint } from "$lib/diagnostics";
  import { addFileToCompiler, compileTypst, renderTypst } from "$lib/compiler";

  let test_content: string =
    '= Hello typst\nThis is a *test*.\n\n#let x = "1" + "string" // This will cause an error\n';
  let first_file_name: string = "main.typ";

  let compiler: any = null;
  let renderer: any = null;
  let parser: any = null;
  let semanticTokenLegend: SemanticTokenLegend | null = null;

  let isLoading: boolean = true;
  let version: string = "0.7.0-rc1";
  let previewHtml: string = "";
  let editorView: EditorView | null = null;
  let editorContainer: HTMLElement;

  onMount(async () => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = `https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts@${version}/dist/esm/contrib/all-in-one-lite.bundle.js`;

    script.onload = async () => {
      const $typst = (window as any).$typst;

      $typst.setCompilerInitOptions({
        getModule: () =>
          `https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@${version}/pkg/typst_ts_web_compiler_bg.wasm`,
      });

      $typst.setRendererInitOptions({
        getModule: () =>
          `https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer@${version}/pkg/typst_ts_renderer_bg.wasm`,
      });

      compiler = await $typst.getCompiler();
      renderer = await $typst.getRenderer();
      isLoading = false;
    };
    document.head.appendChild(script);

    const parserScript = document.createElement("script");
    parserScript.src = `https://cdn.jsdelivr.net/npm/@myriaddreamin/highlighter-typst@${version}/dist/cjs/contrib/hljs/typst.bundle.js`;
    parserScript.type = "text/javascript";
    parserScript.onload = () => {
      if ((window as any).$typst$parserModule) {
        (window as any).$typst$parserModule
          .then((p: any) => {
            parser = p;
            semanticTokenLegend = p.get_semantic_token_legend();
            handleSyntaxHighlightUpdate();
          })
          .catch((e: any) => {
            console.warn("Failed to load parser:", e);
          });
      }
    };
    document.head.appendChild(parserScript);
  });

  let diagnostics: Diagnostic[] = [];
  let projectFiles: VirtualFile[] = [
    {
      name: "main.typ",
      content: test_content,
      isFolder: false,
    },
  ];

  $: if (editorContainer && !editorView) {
    initializeEditor();
  }

  function handleSyntaxHighlightUpdate() {
    updateSyntaxHighlighting(editorView, parser, semanticTokenLegend);
  }

  async function update() {
    if (!compiler || !renderer) return;

    addFileToCompiler(compiler, projectFiles);
    const result = await compileTypst(compiler, "/" + first_file_name);

    if (result.diagnostics && result.diagnostics.length > 0) {
      diagnostics = result.diagnostics.map((d: any) => ({
        severity: d.severity,
        message: d.message,
        range: parseRange(d.range),
      }));
    } else {
      diagnostics = [];
    }

    if (result.result && !result.hasError) {
      previewHtml = await renderTypst(renderer, result.result);
    }
  }

  function initializeEditor() {
    if (!editorContainer) return;

    const file = projectFiles.find((f) => f.name === first_file_name);
    if (!file) return;

    const typstLinter = linter(() => {
      return convertDiagnosticsToLint(diagnostics, editorView, first_file_name);
    });

    const startState = EditorState.create({
      doc: file.content,
      extensions: [
        basicSetup,
        highlightField,
        typstLinter,
        EditorView.updateListener.of((viewUpdate) => {
          if (viewUpdate.docChanged) {
            const newContent = viewUpdate.state.doc.toString();
            const file = projectFiles.find((f) => f.name === first_file_name);
            if (file && file.content !== newContent) {
              file.content = newContent;
              handleSyntaxHighlightUpdate();
              update();
            }
          }
        }),
      ],
    });

    editorView = new EditorView({
      state: startState,
      parent: editorContainer,
    });
  }

  function loadFileContent(file: VirtualFile) {
    if (file.isFolder) return;
    if (!editorView) return;

    // Update editor content
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: file.content,
      },
    });
  }

  $: if (!isLoading) {
    update();
  }
</script>

<div id="container" class="row">
  <div id="sidebar">
    Side bar
    <div id="file-tree">
      File Tree
      {#each projectFiles as file}
        <div class="file-item">{file.name}</div>
      {/each}
    </div>
  </div>
  <div id="content" class="column">
    <div id="header">Header</div>
    <div id="main" class="row">
      <div id="editor" class="column">
        <div id="editor-toolbar">Toolbar</div>
        <div id="editor-area" bind:this={editorContainer}></div>
      </div>
      <div id="preview">
        <div id="preview-toolbar">Preview Toolbar</div>
        <div id="preview-area">{@html previewHtml}</div>
      </div>
    </div>
  </div>
</div>

<style>
  @import '$lib/styles/highlight.css';

  :global(body, html) {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
  }

  .row {
    display: flex;
    flex-direction: row;
  }

  .column {
    display: flex;
    flex-direction: column;
  }

  #container {
    height: 100%;
    width: 100%;
  }

  #sidebar {
    width: 200px;
    height: 100%;
  }

  #content {
    flex: 1;
    height: 100%;
  }

  #header {
    height: 60px;
    width: 100%;
  }

  #main {
    flex: 1;
    height: calc(100% - 60px);
  }

  #editor {
    flex: 1;
    height: 100%;
  }

  #preview {
    flex: 1;
    height: 100%;
  }

  #editor-area {
    flex: 1;
    height: calc(100% - 40px);
  }

  #editor-toolbar {
    height: 40px;
    width: 100%;
  }

  #preview-toolbar {
    height: 40px;
    width: 100%;
  }

  #preview-area {
    flex: 1;
    height: calc(100% - 40px);
  }

  :global(.cm-editor) {
    height: 100%;
  }
</style>
