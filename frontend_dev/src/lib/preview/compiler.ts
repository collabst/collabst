import type { File, Asset } from "../types";

export function addFileToCompiler(
  compiler: any,
  file: (File | Asset)[] | File | Asset,
) {
  if (Array.isArray(file)) {
    for (const f of file) {
      addFileToCompiler(compiler, f);
    }
    return;
  }
  if ('storage_path' in file) {
    // It's an Asset
    const path = "/assets/" + file.filename;
    compiler.addSource(path, `asset://${file.storage_path}`);
  } else {
    // It's a File
    const path = "/" + file.name;
    compiler.addSource(path, file.content);
  }
}

export async function compileTypst(
  compiler: any,
  mainFilePath: string
): Promise<any> {
  return await compiler.compile({
    mainFilePath,
    diagnostics: "full",
  });
}

export async function renderTypst(
  renderer: any,
  compiledResult: any
): Promise<string> {
  return await renderer.runWithSession(async (session: any) => {
    renderer.manipulateData({
      renderSession: session,
      action: "reset",
      data: compiledResult,
    });
    return renderer.renderSvg({ renderSession: session });
  });
}
