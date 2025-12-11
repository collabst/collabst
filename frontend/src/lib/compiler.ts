import type { VirtualFile } from "./types";

export function addFileToCompiler(
  compiler: any,
  file: VirtualFile | VirtualFile[],
  prefix: string = ""
) {
  if (Array.isArray(file)) {
    for (const f of file) {
      addFileToCompiler(compiler, f, prefix);
    }
    return;
  }

  if (file.isFolder && file.children) {
    for (const child of file.children) {
      addFileToCompiler(compiler, child, prefix + file.name + "/");
    }
  } else if (!file.isFolder) {
    const path = "/" + prefix + file.name;
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
