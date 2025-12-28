/**
 * Typst window utilities for handling document navigation and position tracking.
 * These methods are attached to the preview container to integrate with typst-dom.
 */

export interface TypstPosition {
  page: number;
  x: number;
  y: number;
  distance: number;
}

export interface TypstWindowElement extends HTMLDivElement {
  initTypstSvg: () => void;
  documents: any[];
  typstWebsocket: { send: () => Promise<void> };
  currentPosition: (elem: Element) => TypstPosition | undefined;
  handleTypstLocation: (elem: Element, pageNo: number, x: number, y: number) => void;
}

/**
 * Find an ancestor element with a specific CSS class
 */
function findAncestor(el: Element | null, cls: string): Element | null {
  while (el && !el.classList.contains(cls)) {
    el = el.parentElement;
  }
  return el;
}

/**
 * Get the current scroll position relative to the document pages.
 * Returns the page closest to the viewport center.
 */
function createCurrentPosition(container: HTMLDivElement) {
  return function currentPosition(elem: Element): TypstPosition | undefined {
    const docRoot = findAncestor(elem, 'typst-doc');
    if (!docRoot) {
      console.warn('currentPosition: no typst-doc found', elem);
      return undefined;
    }

    let result: TypstPosition | undefined = undefined;
    const vpRect = container.getBoundingClientRect();
    const cx = vpRect.left + vpRect.width / 2;
    const cy = vpRect.top + vpRect.height / 2;

    type ScrollRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
    const handlePage = (pageBBox: ScrollRect, page: number) => {
      const x = pageBBox.left;
      const y = pageBBox.top;
      const distance = Math.hypot(x - cx, y - cy);
      if (result === undefined || distance < result.distance) {
        result = { page, x, y, distance };
      }
    };

    const renderMode = docRoot.getAttribute('data-render-mode');
    if (renderMode === 'canvas') {
      const pages = docRoot.querySelectorAll<HTMLDivElement>('.typst-page');
      for (const page of pages) {
        const pageNumber = Number.parseInt(page.getAttribute('data-page-number')!);
        const bbox = page.getBoundingClientRect();
        handlePage(bbox, pageNumber);
      }
      return result;
    }

    // SVG mode
    const children = docRoot.children;
    let nthPage = 0;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tagName === 'g') {
        nthPage++;
        const page = children[i] as SVGGElement;
        const bbox = page.getBoundingClientRect();
        if (bbox.bottom === 0 && bbox.top === 0) {
          continue;
        }
        handlePage(bbox, nthPage);
      }
    }
    return result;
  };
}

/**
 * Navigate to a specific location in the Typst document.
 * Supports both canvas and SVG render modes.
 */
function createHandleTypstLocation(container: HTMLDivElement) {
  return function handleTypstLocation(elem: Element, pageNo: number, x: number, y: number) {
    const docRoot = findAncestor(elem, 'typst-doc');
    if (!docRoot) {
      console.warn('handleTypstLocation: no typst-doc found', elem);
      return;
    }

    const containerRect = container.getBoundingClientRect();

    const renderMode = docRoot.getAttribute('data-render-mode');
    if (renderMode === 'canvas') {
      const pages = docRoot.querySelectorAll<HTMLDivElement>('.typst-page');

      const pageMapping = new Map<number, HTMLDivElement>();
      for (const page of pages) {
        const pageNumber = Number.parseInt(page.getAttribute('data-page-number')!);
        if (pageMapping.has(pageNumber)) {
          continue;
        }
        pageMapping.set(pageNumber, page);
      }
      const adjustedPageNo = pageNo - 1;

      if (!pageMapping.has(adjustedPageNo)) {
        console.warn('handleTypstLocation: page not found in canvas mode', pageNo, pageMapping);
        return;
      }

      const canvasContainer = pageMapping.get(adjustedPageNo)!.firstElementChild!;
      const canvasRectBase = canvasContainer.getBoundingClientRect();
      const appliedScale =
        Number.parseFloat(canvasContainer.getAttribute('data-applied-scale') || '1') || 1;

      const dataWidth =
        Number.parseFloat(canvasContainer.getAttribute('data-page-width') || '0') || 0;
      const dataHeight =
        Number.parseFloat(canvasContainer.getAttribute('data-page-height') || '0') || 0;

      const offsetX = (x / dataWidth) * (canvasRectBase.width / appliedScale);
      const offsetY = (y / dataHeight) * (canvasRectBase.height / appliedScale);

      const scrollX = container.scrollLeft + (canvasRectBase.left - containerRect.left) + offsetX - containerRect.width / 2;
      const scrollY = container.scrollTop + (canvasRectBase.top - containerRect.top) + offsetY - containerRect.height / 2;

      container.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
      return;
    }

    // SVG mode
    const children = docRoot.children;
    let nthPage = 0;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tagName === 'g') {
        nthPage++;
      }
      if (nthPage === pageNo) {
        const page = children[i] as SVGGElement;
        const dataWidth = Number.parseFloat(docRoot.getAttribute('data-width') || '0') || 0;
        const dataHeight = Number.parseFloat(docRoot.getAttribute('data-height') || '0') || 0;
        const svgRect = docRoot.getBoundingClientRect();

        const scaleX = svgRect.width / dataWidth;
        const scaleY = svgRect.height / dataHeight;

        const offsetX = x * scaleX;
        const offsetY = y * scaleY;

        const transform = page.transform.baseVal.consolidate()?.matrix;
        const pageOriginX = transform ? transform.e * scaleX : 0;
        const pageOriginY = transform ? transform.f * scaleY : 0;

        const scrollX = container.scrollLeft + (svgRect.left - containerRect.left) + pageOriginX + offsetX - containerRect.width / 2;
        const scrollY = container.scrollTop + (svgRect.top - containerRect.top) + pageOriginY + offsetY - containerRect.height / 2;

        container.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
        return;
      }
    }
  };
}

/**
 * Setup typst window methods on the preview container.
 * This attaches the required methods for typst-dom integration.
 */
export function setupTypstWindow(container: HTMLDivElement): TypstWindowElement {
  const windowElem = container as TypstWindowElement;

  windowElem.initTypstSvg = () => {};
  windowElem.documents = [];
  windowElem.typstWebsocket = { send: async () => {} };
  windowElem.currentPosition = createCurrentPosition(container);
  windowElem.handleTypstLocation = createHandleTypstLocation(container);

  // Set global handler for typst.ts compatibility
  (window as any).handleTypstLocation = windowElem.handleTypstLocation;

  return windowElem;
}
