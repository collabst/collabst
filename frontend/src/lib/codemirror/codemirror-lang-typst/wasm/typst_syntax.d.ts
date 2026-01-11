/* tslint:disable */
/* eslint-disable */
/**
 * A node in the untyped syntax tree.
 */
export class SyntaxNode {
  private constructor();
  free(): void;
}
/**
 * An incremental parser for usage in wasm.
 */
export class TypstWasmParser {
  free(): void;
  constructor(doc: string);
  /**
   * Edit the source
   *
   * Returns the corresponding edit for JS side.
   */
  edit(replace_from: number, replace_to: number, _with: string): any;
  tree(): any;
  static get_node_types(): any;
}
