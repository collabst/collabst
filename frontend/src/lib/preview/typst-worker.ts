// Export PDF using typst.pdf and send to main thread
async function exportPDF(targetMainFilePath: string) {
  console.log('Worker: Exporting PDF for:', targetMainFilePath);
  if (!typst) {
    console.log('Worker: Initializing typst for PDF export...');
    await init();
  }
  try {
    console.log('Worker: Generating PDF for:', targetMainFilePath);
    const pdfData = await typst.pdf({ mainFilePath: targetMainFilePath });
    self.postMessage(
      {
        type: 'pdf',
        pdfData,
        mainFilePath: targetMainFilePath,
      },
      [pdfData.buffer]
    );
  } catch (error) {
  }
}
// Typst Worker with Incremental Compilation
// Compiles typst source and sends artifact data to main thread for rendering

console.log('Worker: Starting initialization...');

const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes(
      'using deprecated parameters for the initialization function; pass a single object instead'
    )
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

// Shim window for libraries that expect it (only in worker context)
if (typeof self !== 'undefined' && typeof Window === 'undefined') {
  (self as any).window = self;
  (self as any).document = { currentScript: null };
}

// Catch unhandled errors (only in worker context)
if (typeof self !== 'undefined' && self.addEventListener) {
  self.addEventListener('error', (event) => {
    console.error('Worker uncaught error:', event.error);
    self.postMessage({
      type: 'error',
      error: `Worker error: ${event.error?.message || event.message || 'Unknown error'}`,
    });
  });

  self.addEventListener('unhandledrejection', (event) => {
    console.error('Worker unhandled rejection:', event.reason);
    self.postMessage({
      type: 'error',
      error: `Worker promise rejection: ${event.reason?.message || event.reason || 'Unknown error'}`,
    });
  });
}

let typst: any = null;
let compiler: any = null;
let incrServer: any = null;
let initialized = false;
let hasCompiled = false; // Track if we've done at least one compile

let mainFilePath: string = '/main.typ';
let lastMainFilePath: string | null = null;

// Initialize typst with incremental server
async function init() {
  if (initialized) return;

  try {
    self.postMessage({ type: 'status', message: 'Loading typst bundle...' });

    const module = await import(
      'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js'
    );
    typst = module.$typst;

    self.postMessage({ type: 'status', message: 'Configuring WASM modules...' });

    typst.setCompilerInitOptions({
      getModule: () =>
        'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    });

    self.postMessage({ type: 'status', message: 'Initializing compiler...' });

    // Get the compiler instance
    compiler = await typst.getCompiler();

    self.postMessage({ type: 'status', message: 'Creating incremental server...' });
    console.log('Worker: Creating incremental server...');

    // Create incremental server that persists for the session
    // DON'T await - the Promise never resolves (intentionally keeps session alive)
    compiler.withIncrementalServer((srv: any) => {
      return new Promise((dispose) => {
        incrServer = srv;
        (self as any)._disposeIncrServer = dispose;
        initialized = true;

        // Signal that we're ready now that we have the server
        console.log('Worker: Incremental server ready');
        self.postMessage({ type: 'initialized' });
      });
    });

    console.log('Worker: Setup complete, waiting for incremental server callback...');
  } catch (error: any) {
    self.postMessage({
      type: 'error',
      error: `Init failed: ${error.message}\n${error.stack}`,
    });
  }
}

// Add a file to the compiler
function addFile(path: string, content: string) {
  if (!compiler) return;
  console.log('Worker: Adding file:', path);
  compiler.addSource(path, content);
}

// Add an asset to the compiler
function addAsset(path: string, data: Uint8Array) {
  if (!compiler) return;
  console.log('Worker: Adding asset:', path, 'size:', data.length);
  compiler.mapShadow(path, data);
}

// Remove a file/asset from the compiler
function removeFile(path: string) {
  if (!compiler) return;
  console.log('Worker: Removing file:', path);
  compiler.unmapShadow(path);
}

// Compile with incremental server and send artifact data to main thread
async function compile(targetMainFilePath: string) {
  if (!initialized) {
    await init();
  }

  const startTime = performance.now();

  try {
    // Track if main file changed
    console.log('Worker: Compiling, main file path:', targetMainFilePath, lastMainFilePath);
    const mainFileChanged = targetMainFilePath !== lastMainFilePath;
    console.log('Worker: Compiling, main file changed:', mainFileChanged);
    if (mainFileChanged) {
      mainFilePath = targetMainFilePath;
      lastMainFilePath = targetMainFilePath;
      hasCompiled = false; // Reset on main file change
      console.log('Worker: Main file changed to:', mainFilePath);
    }

    // Compile with incremental server - returns artifact data (full or diff)
    // Don't specify format - incremental server returns its own artifact format
    const result = await compiler.compile({
      mainFilePath,
      incrementalServer: incrServer,
      diagnostics: 'full',
    });

    console.log('Worker: Compilation finished');

    const compileTime = (performance.now() - startTime).toFixed(2);

    // Check for errors in diagnostics
    const diagnostics = result.diagnostics || [];
    const hasErrors = diagnostics.some((d: any) => d.severity === 'error');

    if (hasErrors) {
      self.postMessage({
        type: 'error',
        diagnostics: diagnostics,
        compileTime,
      });
      return;
    }

    // The result.result contains the artifact data
    // First compile: full data, subsequent: incremental diff
    const artifactData = result.result;

    if (!artifactData || artifactData.length === 0) {
      self.postMessage({
        type: 'compiled',
        vectorData: null,
        compileTime,
        isFirstCompile: !hasCompiled,
        diagnostics,
      });
      return;
    }

    // Send the artifact data to main thread for rendering
    // First compile sends full data, subsequent compiles send diffs
    const isFirstCompile = !hasCompiled;
    hasCompiled = true;

    console.log('Worker: Sending compiled artifact data, size:', artifactData.length);

    // Transfer the buffer if it's a transferable object
    const transfer = artifactData?.buffer instanceof ArrayBuffer ? [artifactData.buffer] : [];
    self.postMessage(
      {
        type: 'compiled',
        vectorData: artifactData,
        compileTime,
        isFirstCompile,
        diagnostics,
      },
      transfer
    );
  } catch (error: any) {
    const compileTime = (performance.now() - startTime).toFixed(2);
    self.postMessage({
      type: 'error',
      error: error.message || String(error),
      compileTime,
    });
  }
  console.log('Worker: Compile process complete');
}

// Reset the incremental server and compiler state
function reset() {
  if (incrServer) {
    incrServer.reset();
  }
  if (compiler) {
    compiler.reset();
    lastMainFilePath = null;
  }
  hasCompiled = false; // Reset compile tracking
  self.postMessage({ type: 'reset' });
}

// Handle messages from main thread (only in worker context)
if (typeof self !== 'undefined' && 'onmessage' in self) {
  self.onmessage = async (e) => {
    const { type, payload } = e.data;

    switch (type) {
      case 'init':
        await init();
        break;
      case 'addFile':
        addFile(payload.path, payload.content);
        break;
      case 'addAsset':
        addAsset(payload.path, payload.data);
        break;
      case 'removeFile':
        removeFile(payload.path);
        break;
      case 'compile':
        await compile(payload.mainFilePath);
        break;
      case 'reset':
        reset();
        break;
      case 'exportPDF':
        console.log('Worker: Exporting PDF for:', payload.mainFilePath);
        await exportPDF(payload.mainFilePath);
        break;
    }
  };

  // Start initialization
  init();
}
