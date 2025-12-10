<script lang="ts">
    import { onMount, tick } from 'svelte';

    let inputValue = `= Hello typst
This is a *test*.

#let x = 1 + "string" // This will cause an error
`;
    let outputHtml = '';

    let compiler: any = null;
    let renderer: any = null;
    let parser: any = null;
    let semanticTokenLegend: { tokenTypes: string[]; tokenModifiers: string[] } | null = null;
    let isLoading = true;

    interface DiagnosticRange {
        start: { line: number; character: number };
        end: { line: number; character: number };
    }

    interface Diagnostic {
        severity: string;
        message: string;
        range?: string;  // Format: "startLine:startChar-endLine:endChar"
        path?: string;
        package?: string;
    }

    interface ParsedDiagnostic extends Diagnostic {
        parsedRange?: DiagnosticRange;
    }

    // Virtual file system for managing files
    interface VirtualFile {
        name: string;
        content: string;
        isFolder: boolean;
        children?: VirtualFile[];
        expanded?: boolean;
    }

    let fileSystem: VirtualFile[] = [
        {
            name: 'main.typ',
            content: `= Hello typst
This is a *test*.

#let x = 1 + "string" // This will cause an error
`,
            isFolder: false
        }
    ];
    let currentFile: string = 'main.typ';
    let rootFile: string = 'main.typ';  // The entry point for compilation
    let showNewFileDialog = false;
    let newFileName = '';
    let newFileIsFolder = false;
    let editingFileName: string | null = null;
    let editingNameValue = '';

    let diagnostics: ParsedDiagnostic[] = [];
    let editorElement: HTMLDivElement;
    let editorDiv: HTMLDivElement;
    let updateTimer: any = null;

    // Semantic token type to CSS class mapping (based on typst-ts highlighter)
    const tokenTypeToClass: Record<string, string> = {
        'comment': 'typst-comment',
        'string': 'typst-string',
        'operator': 'typst-operator',
        'keyword': 'typst-keyword',
        'number': 'typst-number',
        'function': 'typst-function',
        'decorator': 'typst-function',
        'bool': 'typst-bool',
        'punctuation': 'typst-punctuation',
        'escape': 'typst-escape',
        'link': 'typst-link',
        'raw': 'typst-raw',
        'label': 'typst-label',
        'ref': 'typst-ref',
        'heading': 'typst-heading',
        'marker': 'typst-marker',
        'term': 'typst-term',
        'pol': 'typst-pol',
        'delim': 'typst-delim',
        'text': 'typst-text',
        'error': 'typst-error'
    };

    // Parse range string like "1:5-2:10" into an object
    function parseRange(rangeStr: string | undefined): DiagnosticRange | undefined {
        if (!rangeStr || rangeStr === '') return undefined;
        
        // Format: "startLine:startChar-endLine:endChar" or "line:char"
        const match = rangeStr.match(/^(\d+):(\d+)(?:-(\d+):(\d+))?$/);
        if (!match) return undefined;
        
        const startLine = parseInt(match[1], 10);
        const startChar = parseInt(match[2], 10);
        const endLine = match[3] ? parseInt(match[3], 10) : startLine;
        const endChar = match[4] ? parseInt(match[4], 10) : startChar + 1;
        
        return {
            start: { line: startLine, character: startChar },
            end: { line: endLine, character: endChar }
        };
    }

    // Convert line/character to absolute offset in text
    function positionToOffset(text: string, line: number, character: number): number {
        const lines = text.split('\n');
        let offset = 0;
        for (let i = 0; i < line && i < lines.length; i++) {
            offset += lines[i].length + 1; // +1 for newline
        }
        return offset + character;
    }

    // Generate highlighted HTML with error underlines
    function generateHighlightedHtml(text: string, diags: ParsedDiagnostic[]): string {
        const diagsWithRange = diags.filter(d => d.parsedRange);
        
        if (diagsWithRange.length === 0) {
            return applySyntaxHighlighting(text);
        }

        // Create markers for diagnostic ranges
        interface Marker {
            offset: number;
            type: 'start' | 'end';
            severity: string;
            message: string;
            id: number;
        }

        const markers: Marker[] = [];
        diagsWithRange.forEach((diag, idx) => {
            if (diag.parsedRange) {
                const startOffset = positionToOffset(text, diag.parsedRange.start.line, diag.parsedRange.start.character);
                const endOffset = positionToOffset(text, diag.parsedRange.end.line, diag.parsedRange.end.character);
                markers.push({ offset: startOffset, type: 'start', severity: diag.severity, message: diag.message, id: idx });
                markers.push({ offset: endOffset, type: 'end', severity: diag.severity, message: diag.message, id: idx });
            }
        });

        // Sort markers by offset, end markers before start markers at same position
        markers.sort((a, b) => {
            if (a.offset !== b.offset) return a.offset - b.offset;
            if (a.type === 'end' && b.type === 'start') return -1;
            if (a.type === 'start' && b.type === 'end') return 1;
            return 0;
        });

        let result = '';
        let lastOffset = 0;
        const activeSpans: Map<number, Marker> = new Map();

        for (const marker of markers) {
            // Add text before this marker
            if (marker.offset > lastOffset) {
                const segment = text.slice(lastOffset, marker.offset);
                result += applySyntaxHighlighting(segment);
            }
            lastOffset = marker.offset;

            if (marker.type === 'start') {
                const isError = marker.severity === 'error' || marker.severity === 'Error';
                const className = isError ? 'error-underline' : 'warning-underline';
                result += `<span class="${className}" data-tooltip="${escapeHtml(marker.message)}">`;
                activeSpans.set(marker.id, marker);
            } else {
                result += '</span>';
                activeSpans.delete(marker.id);
            }
        }

        // Add remaining text
        if (lastOffset < text.length) {
            result += applySyntaxHighlighting(text.slice(lastOffset));
        }

        return result;
    }

    // Simple Typst syntax highlighting using semantic tokens from typst-ts-parser
    function applySyntaxHighlighting(text: string): string {
        // If parser is not loaded yet, fall back to basic escaping
        if (!parser || !semanticTokenLegend) {
            return escapeHtml(text);
        }

        try {
            // Get semantic tokens from the parser
            const tokens = parser.get_semantic_tokens_by_string(text, 'utf-8');
            
            if (!tokens || tokens.length === 0) {
                return escapeHtml(text);
            }

            // Decode semantic tokens (format: delta_line, delta_start, length, token_type, token_modifiers)
            const lines = text.split('\n');
            
            interface HighlightSpan {
                startOffset: number;
                endOffset: number;
                tokenType: string;
                modifiers: string[];
            }

            const spans: HighlightSpan[] = [];
            let currentLine = 0;
            let currentChar = 0;
            let currentOffset = 0;

            // Calculate line offsets
            const lineOffsets: number[] = [0];
            for (let i = 0; i < lines.length - 1; i++) {
                lineOffsets.push(lineOffsets[i] + lines[i].length + 1);
            }

            for (let i = 0; i < tokens.length; i += 5) {
                const deltaLine = tokens[i];
                const deltaStart = tokens[i + 1];
                const length = tokens[i + 2];
                const tokenTypeIndex = tokens[i + 3];
                const tokenModifiersSet = tokens[i + 4];

                // Update position
                if (deltaLine > 0) {
                    currentLine += deltaLine;
                    currentChar = deltaStart;
                } else {
                    currentChar += deltaStart;
                }

                if (currentLine >= lines.length) continue;

                const startOffset = lineOffsets[currentLine] + currentChar;
                const endOffset = startOffset + length;

                const tokenType = semanticTokenLegend.tokenTypes[tokenTypeIndex] || 'text';
                
                // Decode modifiers
                const modifiers: string[] = [];
                let modSet = tokenModifiersSet;
                for (let j = 0; modSet > 0 && j < semanticTokenLegend.tokenModifiers.length; j++) {
                    if (modSet & 1) {
                        modifiers.push(semanticTokenLegend.tokenModifiers[j]);
                    }
                    modSet = modSet >> 1;
                }

                spans.push({ startOffset, endOffset, tokenType, modifiers });
            }

            // Build highlighted HTML
            if (spans.length === 0) {
                return escapeHtml(text);
            }

            // Sort spans by start offset
            spans.sort((a, b) => a.startOffset - b.startOffset);

            let result = '';
            let lastOffset = 0;

            for (const span of spans) {
                // Add unhighlighted text before this span
                if (span.startOffset > lastOffset) {
                    result += escapeHtml(text.slice(lastOffset, span.startOffset));
                }
                
                // Determine CSS class based on token type and modifiers
                let className = tokenTypeToClass[span.tokenType] || '';
                
                // Handle modifiers
                if (span.modifiers.includes('math')) {
                    className = 'typst-math';
                } else if (span.modifiers.includes('strong') && span.modifiers.includes('emph')) {
                    className = 'typst-strong-emphasis';
                } else if (span.modifiers.includes('strong')) {
                    className = 'typst-strong';
                } else if (span.modifiers.includes('emph')) {
                    className = 'typst-emphasis';
                }

                const segment = escapeHtml(text.slice(span.startOffset, span.endOffset));
                if (className) {
                    result += `<span class="${className}">${segment}</span>`;
                } else {
                    result += segment;
                }
                
                lastOffset = span.endOffset;
            }

            // Add remaining text
            if (lastOffset < text.length) {
                result += escapeHtml(text.slice(lastOffset));
            }

            return result;
        } catch (e) {
            console.error('Syntax highlighting error:', e);
            return escapeHtml(text);
        }
    }

    function escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Extract plain text from contenteditable div
    function getPlainText(element: HTMLElement): string {
        return element.innerText || '';
    }

    // Save cursor position
    function saveCursorPosition() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(editorDiv);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        const offset = preCaretRange.toString().length;
        
        return offset;
    }

    // Restore cursor position
    function restoreCursorPosition(offset: number) {
        if (!editorDiv) return;
        
        const selection = window.getSelection();
        if (!selection) return;
        
        const range = document.createRange();
        let currentOffset = 0;
        let found = false;
        
        function traverseNodes(node: Node) {
            if (found) return;
            
            if (node.nodeType === Node.TEXT_NODE) {
                const length = node.textContent?.length || 0;
                if (currentOffset + length >= offset) {
                    range.setStart(node, offset - currentOffset);
                    range.setEnd(node, offset - currentOffset);
                    found = true;
                    return;
                }
                currentOffset += length;
            } else {
                for (let i = 0; i < node.childNodes.length; i++) {
                    traverseNodes(node.childNodes[i]);
                    if (found) return;
                }
            }
        }
        
        traverseNodes(editorDiv);
        
        if (found) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    // Recursively add all files to the compiler for import resolution
    function addAllFilesToCompiler(files: VirtualFile[], prefix: string) {
        for (const file of files) {
            if (file.isFolder && file.children) {
                addAllFilesToCompiler(file.children, prefix + file.name + '/');
            } else if (!file.isFolder) {
                const path = '/' + prefix + file.name;
                compiler.addSource(path, file.content);
            }
        }
    }

    // Set the root file for compilation
    function setRootFile(fileName: string) {
        rootFile = fileName;
        update();
    }

    async function update() {
        if (!compiler || !renderer) return;

        diagnostics = [];

        try {
            // Save current file content to virtual file system
            const currentFileObj = findFile(currentFile);
            if (currentFileObj) {
                currentFileObj.content = inputValue;
            }

            // Add all files to compiler for proper import resolution
            addAllFilesToCompiler(fileSystem, '');
            
            const result = await compiler.compile({
                mainFilePath: '/' + rootFile,
                diagnostics: 'full'
            });

            console.log('Compile result:', result);

            // Handle diagnostics - parse range strings
            if (result.diagnostics && result.diagnostics.length > 0) {
                diagnostics = result.diagnostics.map((d: Diagnostic) => ({
                    ...d,
                    parsedRange: parseRange(d.range)
                }));
            }

            // Render the output only if compilation succeeded without errors
            if (result.result && !result.hasError) {
                const svg = await renderer.runWithSession(async (session: any) => {
                    renderer.manipulateData({
                        renderSession: session,
                        action: 'reset',
                        data: result.result,
                    });
                    return renderer.renderSvg({ renderSession: session });
                });
                outputHtml = svg;
            }
            // If there's an error, keep the previous preview unchanged

        } catch (e: any) {
            console.error('Compilation error:', e);
            diagnostics = [{
                severity: 'error',
                message: e.message || String(e)
            }];
            // Keep previous preview on exception too
        }

        await tick();
        // Don't call updateHighlight here - it interferes with contenteditable
        // Error underlines will be shown in the diagnostics panel instead
    }

    // File system management functions
    function findFile(path: string, files: VirtualFile[] = fileSystem): VirtualFile | null {
        for (const file of files) {
            if (file.name === path) return file;
            if (file.isFolder && file.children) {
                const found = findFile(path, file.children);
                if (found) return found;
            }
        }
        return null;
    }

    function selectFile(fileName: string) {
        // Save current file content
        const currentFileObj = findFile(currentFile);
        if (currentFileObj && editorDiv) {
            currentFileObj.content = getPlainText(editorDiv);
        }
        
        // Load new file
        const newFile = findFile(fileName);
        if (newFile && !newFile.isFolder) {
            currentFile = fileName;
            inputValue = newFile.content;
            
            // Set content with syntax highlighting (only on file load)
            if (editorDiv) {
                editorDiv.innerHTML = applySyntaxHighlighting(inputValue);
            }
            
            update();
        }
    }

    function createFile() {
        if (!newFileName.trim()) return;
        
        const name = newFileName.trim();
        if (findFile(name)) {
            alert('A file or folder with this name already exists');
            return;
        }

        const newFile: VirtualFile = {
            name,
            content: newFileIsFolder ? '' : `// New file: ${name}\n`,
            isFolder: newFileIsFolder,
            children: newFileIsFolder ? [] : undefined,
            expanded: newFileIsFolder ? true : undefined
        };

        fileSystem = [...fileSystem, newFile];
        
        if (!newFileIsFolder) {
            selectFile(name);
        }

        showNewFileDialog = false;
        newFileName = '';
        newFileIsFolder = false;
    }

    function deleteFile(fileName: string) {
        if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;
        
        fileSystem = fileSystem.filter(f => f.name !== fileName);
        
        // If we deleted the current file, switch to another
        if (currentFile === fileName) {
            const firstFile = fileSystem.find(f => !f.isFolder);
            if (firstFile) {
                selectFile(firstFile.name);
            } else {
                // Create a new main.typ
                createNewMainFile();
            }
        }
    }

    function createNewMainFile() {
        const mainFile: VirtualFile = {
            name: 'main.typ',
            content: '= Hello Typst\n\nStart writing here...\n',
            isFolder: false
        };
        fileSystem = [mainFile, ...fileSystem];
        selectFile('main.typ');
    }

    function startRename(fileName: string) {
        editingFileName = fileName;
        editingNameValue = fileName;
    }

    function confirmRename() {
        if (!editingFileName || !editingNameValue.trim()) {
            editingFileName = null;
            return;
        }

        const file = findFile(editingFileName);
        if (file) {
            const newName = editingNameValue.trim();
            if (newName !== editingFileName && findFile(newName)) {
                alert('A file or folder with this name already exists');
                return;
            }
            file.name = newName;
            if (currentFile === editingFileName) {
                currentFile = newName;
            }
            fileSystem = [...fileSystem]; // Trigger reactivity
        }
        editingFileName = null;
    }

    function toggleFolder(file: VirtualFile) {
        if (file.isFolder) {
            file.expanded = !file.expanded;
            fileSystem = [...fileSystem]; // Trigger reactivity
        }
    }

    onMount(async () => {
        // Load the parser for semantic tokens
        const parserScript = document.createElement('script');
        parserScript.src = 'https://cdn.jsdelivr.net/npm/@myriaddreamin/highlighter-typst/dist/cjs/contrib/hljs/typst.bundle.js';
        
        parserScript.onload = () => {
            // Wait for the parser module to be ready
            if ((window as any).$typst$parserModule) {
                (window as any).$typst$parserModule.then((p: any) => {
                    parser = p;
                    semanticTokenLegend = p.get_semantic_token_legend();
                    console.log('Parser loaded, semantic token legend:', semanticTokenLegend);
                    // Parser loaded, but we don't update highlighting here to avoid duplication
                }).catch((e: any) => {
                    console.warn('Failed to load parser:', e);
                });
            }
        };
        document.head.appendChild(parserScript);

        // Dynamically load the typst.ts bundle (v0.7.0-rc1 for Typst 0.14.0)
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts@0.7.0-rc1/dist/esm/contrib/all-in-one-lite.bundle.js';
        
        script.onload = async () => {
            const $typst = (window as any).$typst;
            
            $typst.setCompilerInitOptions({
                getModule: () =>
                    "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@0.7.0-rc1/pkg/typst_ts_web_compiler_bg.wasm",
            });

            $typst.setRendererInitOptions({
                getModule: () =>
                    "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer@0.7.0-rc1/pkg/typst_ts_renderer_bg.wasm",
            });

            compiler = await $typst.getCompiler();
            renderer = await $typst.getRenderer();
            isLoading = false;
            
            // Set initial editor content with syntax highlighting
            if (editorDiv) {
                editorDiv.innerHTML = applySyntaxHighlighting(inputValue);
            }
            
            await update();
        };

        document.head.appendChild(script);
    });

    function handleInput() {
        if (!editorDiv) return;
        
        // Extract plain text from contenteditable
        inputValue = getPlainText(editorDiv);
        
        // Save content to virtual file
        const file = findFile(currentFile);
        if (file) {
            file.content = inputValue;
        }
        
        // Debounce compilation and diagnostics
        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
            update();
        }, 500);
    }

    // Handle paste to strip formatting
    function handlePaste(event: ClipboardEvent) {
        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain');
        if (text) {
            document.execCommand('insertText', false, text);
        }
    }

    $: hasErrors = diagnostics.some(d => d.severity === 'error' || d.severity === 'Error');
    $: hasWarnings = diagnostics.some(d => d.severity === 'warning' || d.severity === 'Warning');
</script>

<svelte:head>
    <title>Typst Editor</title>
</svelte:head>

<div class="container">
    {#if isLoading}
        <div class="loading-overlay">
            <div class="loading">Loading Typst 0.14.0 compiler...</div>
        </div>
    {/if}

    <!-- File Sidebar -->
    <div class="sidebar">
        <div class="sidebar-header">
            <span>Files</span>
            <button class="icon-btn" on:click={() => showNewFileDialog = true} title="New file/folder">+</button>
        </div>
        
        {#if showNewFileDialog}
            <div class="new-file-dialog">
                <input 
                    type="text" 
                    bind:value={newFileName} 
                    placeholder="Name..."
                    on:keydown={(e) => e.key === 'Enter' && createFile()}
                />
                <label class="folder-checkbox">
                    <input type="checkbox" bind:checked={newFileIsFolder} />
                    Folder
                </label>
                <div class="dialog-buttons">
                    <button on:click={createFile}>Create</button>
                    <button on:click={() => { showNewFileDialog = false; newFileName = ''; }}>Cancel</button>
                </div>
            </div>
        {/if}

        <div class="file-list">
            {#each fileSystem as file}
                <div class="file-item" class:active={!file.isFolder && currentFile === file.name}>
                    {#if editingFileName === file.name}
                        <input 
                            type="text" 
                            bind:value={editingNameValue}
                            on:blur={confirmRename}
                            on:keydown={(e) => e.key === 'Enter' && confirmRename()}
                            class="rename-input"
                        />
                    {:else}
                        {#if !file.isFolder && file.name.endsWith('.typ')}
                            <button 
                                class="root-btn" 
                                class:is-root={rootFile === file.name}
                                on:click={() => setRootFile(file.name)}
                                title={rootFile === file.name ? 'Root file' : 'Set as root file'}
                            >
                                {rootFile === file.name ? '▶' : '○'}
                            </button>
                        {/if}
                        <button 
                            class="file-btn"
                            on:click={() => file.isFolder ? toggleFolder(file) : selectFile(file.name)}
                            on:dblclick={() => startRename(file.name)}
                        >
                            <span class="file-icon">{file.isFolder ? (file.expanded ? '📂' : '📁') : '📄'}</span>
                            <span class="file-name">{file.name}</span>
                        </button>
                        <button class="delete-btn" on:click={() => deleteFile(file.name)} title="Delete">×</button>
                    {/if}
                </div>
                
                {#if file.isFolder && file.expanded && file.children}
                    {#each file.children as child}
                        <div class="file-item nested" class:active={!child.isFolder && currentFile === child.name}>
                            {#if !child.isFolder && child.name.endsWith('.typ')}
                                <button 
                                    class="root-btn" 
                                    class:is-root={rootFile === child.name}
                                    on:click={() => setRootFile(child.name)}
                                    title={rootFile === child.name ? 'Root file' : 'Set as root file'}
                                >
                                    {rootFile === child.name ? '▶' : '○'}
                                </button>
                            {/if}
                            <button 
                                class="file-btn"
                                on:click={() => child.isFolder ? toggleFolder(child) : selectFile(child.name)}
                            >
                                <span class="file-icon">{child.isFolder ? '📁' : '📄'}</span>
                                <span class="file-name">{child.name}</span>
                            </button>
                        </div>
                    {/each}
                {/if}
            {/each}
        </div>
    </div>
    
    <div class="main-content">
    <div class="split-view">
        <!-- Editor Panel -->
        <div class="editor-panel">
            <div class="panel-header">
                <span>Editor</span>
                {#if hasErrors}
                    <span class="status-badge error">❌ Errors</span>
                {:else if hasWarnings}
                    <span class="status-badge warning">⚠️ Warnings</span>
                {:else if !isLoading}
                    <span class="status-badge success">✅ OK</span>
                {/if}
            </div>
            <div class="editor-wrapper" bind:this={editorElement}>
                <div 
                    bind:this={editorDiv}
                    contenteditable="true"
                    on:input={handleInput}
                    on:paste={handlePaste}
                    class="typst-editor"
                    class:disabled={isLoading}
                    spellcheck="false"
                    role="textbox"
                    aria-multiline="true"
                ></div>
            </div>
            
            <!-- Diagnostics Panel -->
            {#if diagnostics.length > 0}
                <div class="diagnostics-panel">
                    {#each diagnostics as diag, i}
                        <div class="diag-item" class:diag-error={diag.severity === 'error' || diag.severity === 'Error'} class:diag-warning={diag.severity === 'warning' || diag.severity === 'Warning'}>
                            <span class="diag-icon">{diag.severity === 'error' || diag.severity === 'Error' ? '❌' : '⚠️'}</span>
                            <span class="diag-content">
                                <strong>{diag.severity}</strong>
                                {#if diag.range}
                                    <span class="diag-location">at {diag.range}</span>
                                {/if}
                                : {diag.message}
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Preview Panel -->
        <div class="preview-panel">
            <div class="panel-header">Preview</div>
            <div class="typst-output">
                {@html outputHtml}
            </div>
        </div>
    </div>
    </div>
</div>

<style>
    .container {
        font-family: system-ui, -apple-system, sans-serif;
        margin: 0;
        padding: 0;
        height: 100vh;
        display: flex;
        flex-direction: row;
        position: relative;
    }

    /* Sidebar styles */
    .sidebar {
        width: 200px;
        min-width: 200px;
        background: #252526;
        color: #cccccc;
        display: flex;
        flex-direction: column;
        border-right: 1px solid #333;
    }

    .sidebar-header {
        padding: 10px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #333;
        font-weight: 600;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .icon-btn {
        background: none;
        border: none;
        color: #cccccc;
        font-size: 18px;
        cursor: pointer;
        padding: 2px 8px;
        border-radius: 3px;
    }

    .icon-btn:hover {
        background: #3c3c3c;
    }

    .new-file-dialog {
        padding: 10px;
        background: #333;
        border-bottom: 1px solid #444;
    }

    .new-file-dialog input[type="text"] {
        width: 100%;
        padding: 6px 8px;
        background: #1e1e1e;
        border: 1px solid #555;
        border-radius: 3px;
        color: #fff;
        font-size: 13px;
        margin-bottom: 8px;
        box-sizing: border-box;
    }

    .folder-checkbox {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        margin-bottom: 8px;
    }

    .dialog-buttons {
        display: flex;
        gap: 6px;
    }

    .dialog-buttons button {
        flex: 1;
        padding: 5px 10px;
        font-size: 12px;
        border: none;
        border-radius: 3px;
        cursor: pointer;
    }

    .dialog-buttons button:first-child {
        background: #0e639c;
        color: white;
    }

    .dialog-buttons button:last-child {
        background: #444;
        color: #ccc;
    }

    .file-list {
        flex: 1;
        overflow-y: auto;
    }

    .file-item {
        display: flex;
        align-items: center;
        padding: 0;
    }

    .file-item.active {
        background: #094771;
    }

    .file-item.nested {
        padding-left: 16px;
    }

    .root-btn {
        background: none;
        border: none;
        color: #666;
        font-size: 12px;
        padding: 4px 6px;
        cursor: pointer;
        flex-shrink: 0;
    }

    .root-btn:hover {
        color: #4fc3f7;
    }

    .root-btn.is-root {
        color: #4caf50;
    }

    .file-btn {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: none;
        border: none;
        color: #ccc;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
    }

    .file-btn:hover {
        background: #2a2d2e;
    }

    .file-icon {
        font-size: 14px;
    }

    .file-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .delete-btn {
        background: none;
        border: none;
        color: #666;
        font-size: 16px;
        padding: 4px 8px;
        cursor: pointer;
        opacity: 0;
    }

    .file-item:hover .delete-btn {
        opacity: 1;
    }

    .delete-btn:hover {
        color: #e53935;
    }

    .rename-input {
        flex: 1;
        padding: 4px 8px;
        background: #1e1e1e;
        border: 1px solid #0e639c;
        color: #fff;
        font-size: 13px;
        margin: 2px 4px;
    }

    .main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
    }

    .loading {
        padding: 20px 40px;
        background: #f0f0f0;
        border-radius: 8px;
        color: #666;
        font-style: italic;
    }

    .split-view {
        display: flex;
        flex: 1;
        gap: 0;
        height: 100%;
    }

    .editor-panel,
    .preview-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        border: 1px solid #ddd;
    }

    .editor-panel {
        border-right: none;
    }

    .panel-header {
        padding: 10px 15px;
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
        font-weight: 600;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .status-badge {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: normal;
    }

    .status-badge.error {
        background: #fee;
        color: #c00;
    }

    .status-badge.warning {
        background: #ffe;
        color: #880;
    }

    .status-badge.success {
        background: #efe;
        color: #080;
    }

    .editor-wrapper {
        position: relative;
        flex: 1;
        overflow: hidden;
    }

    .typst-editor {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        padding: 10px;
        font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow: auto;
        background: #fff;
        color: #333;
        caret-color: #333;
        box-sizing: border-box;
        outline: none;
    }

    .typst-editor.disabled {
        background: #f9f9f9;
        color: #999;
        pointer-events: none;
    }

    .typst-editor:focus {
        outline: none;
    }

    .typst-output {
        flex: 1;
        padding: 20px;
        overflow: auto;
        background: #fff;
    }

    /* Diagnostics Panel */
    .diagnostics-panel {
        border-top: 1px solid #ddd;
        background: #fafafa;
        max-height: 150px;
        overflow-y: auto;
        padding: 8px;
    }

    .diag-item {
        padding: 6px 10px;
        margin-bottom: 4px;
        border-radius: 4px;
        font-size: 13px;
        font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
        display: flex;
        gap: 8px;
        align-items: flex-start;
    }

    .diag-item:last-child {
        margin-bottom: 0;
    }

    .diag-error {
        background: #fdd;
        border-left: 3px solid #e53935;
    }

    .diag-warning {
        background: #fff3cd;
        border-left: 3px solid #fb8c00;
    }

    .diag-icon {
        flex-shrink: 0;
    }

    .diag-content {
        flex: 1;
        word-break: break-word;
    }

    .diag-location {
        color: #666;
        font-size: 12px;
    }

    /* Syntax Highlighting - Vibrant, saturated color palette */
    :global(.typst-comment) {
        color: #57a64a;
        font-style: italic;
    }

    :global(.typst-keyword) {
        color: #ff79c6;
        font-weight: 600;
    }

    :global(.typst-function) {
        color: #50fa7b;
    }

    :global(.typst-string) {
        color: #f1fa8c;
    }

    :global(.typst-number) {
        color: #bd93f9;
    }

    :global(.typst-heading) {
        color: #8be9fd;
        font-weight: 700;
    }

    :global(.typst-emphasis) {
        font-style: italic;
        color: #ffb86c;
    }

    :global(.typst-strong) {
        font-weight: 700;
        color: #ff5555;
    }

    :global(.typst-strong-emphasis) {
        font-weight: 700;
        font-style: italic;
        color: #ff6e6e;
    }

    :global(.typst-raw) {
        color: #f8f8f2;
        background: rgba(98, 114, 164, 0.3);
        padding: 2px 4px;
        border-radius: 3px;
    }

    :global(.typst-operator) {
        color: #ff79c6;
    }

    :global(.typst-punctuation) {
        color: #6272a4;
    }

    :global(.typst-bool) {
        color: #bd93f9;
    }

    :global(.typst-escape) {
        color: #ff79c6;
    }

    :global(.typst-link) {
        color: #8be9fd;
        text-decoration: underline;
    }

    :global(.typst-label) {
        color: #50fa7b;
    }

    :global(.typst-ref) {
        color: #8be9fd;
    }

    :global(.typst-marker) {
        color: #ff79c6;
    }

    :global(.typst-term) {
        font-style: italic;
        color: #ffb86c;
    }

    :global(.typst-pol) {
        color: #bd93f9;
    }

    :global(.typst-delim) {
        color: #f8f8f2;
    }

    :global(.typst-math) {
        color: #50fa7b;
    }

    :global(.typst-error) {
        color: #ff5555;
        text-decoration: wavy underline #f44747;
    }

    /* Error/Warning underlines */
    :global(.error-underline) {
        text-decoration: underline wavy #e53935;
        text-decoration-skip-ink: none;
        background: rgba(229, 57, 53, 0.1);
        position: relative;
    }

    :global(.warning-underline) {
        text-decoration: underline wavy #fb8c00;
        text-decoration-skip-ink: none;
        background: rgba(251, 140, 0, 0.1);
        position: relative;
    }

    /* Tooltip styles */
    :global(.error-underline::after),
    :global(.warning-underline::after) {
        content: attr(data-tooltip);
        position: absolute;
        bottom: calc(100% + 5px);
        left: 0;
        background: #333;
        color: #fff;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 12px;
        white-space: pre-wrap;
        max-width: 400px;
        min-width: 200px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        line-height: 1.4;
    }

    :global(.error-underline:hover::after),
    :global(.warning-underline:hover::after) {
        opacity: 1;
    }

    :global(.error-underline::after) {
        background: #c62828;
    }

    :global(.warning-underline::after) {
        background: #e65100;
    }
</style>
