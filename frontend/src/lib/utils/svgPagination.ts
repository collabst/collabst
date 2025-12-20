/**
 * SVG Pagination utilities for Typst preview
 * Based on typst-preview's svg-doc.ts implementation
 */

const INNER_RECT_UNIT = 64;
const INNER_RECT_SCALE = `scale(${1 / INNER_RECT_UNIT})`;

export interface PaginationOptions {
  containerWidth?: number;
  scaleRatio?: number;
  backgroundColor?: string;
  heightMargin?: number;
  enableShadow?: boolean;
  shadowBlur?: number;
  shadowOpacity?: number;
}

/**
 * Decorates an SVG element by organizing its pages with proper spacing and scaling
 */
export function decorateSvgElement(
  svg: SVGElement,
  options: PaginationOptions = {}
): void {
  const {
    containerWidth = svg.parentElement?.offsetWidth || 800,
    scaleRatio = 1,
    backgroundColor = "#ffffff",
    heightMargin = 5,
    enableShadow = true,
    shadowBlur = 8,
    shadowOpacity = 0.3,
  } = options;

  // Create shadow filter if enabled
  let shadowFilterId: string | null = null;
  if (enableShadow) {
    shadowFilterId = `page-shadow-${Math.random().toString(36).substr(2, 9)}`;
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", shadowFilterId);
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");

    // Gaussian blur for shadow
    const feGaussianBlur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    feGaussianBlur.setAttribute("in", "SourceAlpha");
    feGaussianBlur.setAttribute("stdDeviation", shadowBlur.toString());
    feGaussianBlur.setAttribute("result", "blur");

    // Offset the shadow
    const feOffset = document.createElementNS("http://www.w3.org/2000/svg", "feOffset");
    feOffset.setAttribute("in", "blur");
    feOffset.setAttribute("dx", "0");
    feOffset.setAttribute("dy", (shadowBlur / 2).toString());
    feOffset.setAttribute("result", "offsetBlur");

    // Set shadow opacity
    const feComponentTransfer = document.createElementNS("http://www.w3.org/2000/svg", "feComponentTransfer");
    feComponentTransfer.setAttribute("in", "offsetBlur");
    const feFuncA = document.createElementNS("http://www.w3.org/2000/svg", "feFuncA");
    feFuncA.setAttribute("type", "linear");
    feFuncA.setAttribute("slope", shadowOpacity.toString());
    feComponentTransfer.appendChild(feFuncA);

    // Merge shadow with source
    const feMerge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
    const feMergeNode1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    feMergeNode1.setAttribute("in", "offsetBlur");
    const feMergeNode2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    feMergeNode2.setAttribute("in", "SourceGraphic");
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);

    filter.appendChild(feGaussianBlur);
    filter.appendChild(feOffset);
    filter.appendChild(feComponentTransfer);
    filter.appendChild(feMerge);
    defs.appendChild(filter);
    svg.insertBefore(defs, svg.firstChild);
  }

  // Find all pages - try multiple possible selectors
  let pages = Array.from(svg.children).filter((x) =>
    x.classList.contains("typst-page")
  );

  // If no typst-page elements, look for g elements with data-tid attribute (common typst.ts structure)
  if (pages.length === 0) {
    pages = Array.from(svg.children).filter((x) =>
      x.tagName === "g" && x.hasAttribute("data-tid")
    );
  }

  // If still no pages, look for any g elements with specific structure
  if (pages.length === 0) {
    pages = Array.from(svg.children).filter((x) => x.tagName === "g");
  }

  if (pages.length === 0) {
    return;
  }

  // Calculate maximum width across all pages
  let maxWidth = 0;
  for (const page of pages) {
    let pageWidth = Number.parseFloat(
      page.getAttribute("data-page-width") || "0"
    );
    
    // If no data-page-width, try to get from viewBox or bounding box
    if (pageWidth === 0) {
      const bbox = (page as SVGGraphicsElement).getBBox();
      pageWidth = bbox.width;
    }
    
    maxWidth = Math.max(maxWidth, pageWidth);
  }

  if (maxWidth < 1e-5) {
    maxWidth = 1;
  }

  // Calculate scale based on container width
  const computedScale = containerWidth ? containerWidth / maxWidth : 1;
  const scale = scaleRatio * computedScale;

  // Calculate margins
  const scaledHeightMargin = heightMargin * scale;
  const widthMargin = 0;
  const newWidth = maxWidth + 2 * widthMargin;

  // Position pages and create backgrounds
  let accumulatedHeight = 0;
  let firstRect: SVGElement | null = null;
  const firstPage = pages[0];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i] as SVGElement;
    let pageWidth = Number.parseFloat(
      page.getAttribute("data-page-width") || "0"
    );
    let pageHeight = Number.parseFloat(
      page.getAttribute("data-page-height") || "0"
    );

    // If no data attributes, get from bounding box
    if (pageWidth === 0 || pageHeight === 0) {
      const bbox = (page as SVGGraphicsElement).getBBox();
      pageWidth = bbox.width;
      pageHeight = bbox.height;
    }

    // Center the page and add margin
    const calculatedPaddedX = (newWidth - pageWidth) / 2;
    const calculatedPaddedY =
      accumulatedHeight + (i === 0 ? 0 : scaledHeightMargin);
    const translateAttr = `translate(${calculatedPaddedX}, ${calculatedPaddedY})`;

    // Create inner rectangle (page background)
    const innerRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    innerRect.setAttribute("class", "typst-page-inner");
    innerRect.setAttribute("data-page-width", pageWidth.toString());
    innerRect.setAttribute("data-page-height", pageHeight.toString());
    innerRect.setAttribute(
      "width",
      Math.floor(pageWidth * INNER_RECT_UNIT).toString()
    );
    innerRect.setAttribute(
      "height",
      Math.floor(pageHeight * INNER_RECT_UNIT).toString()
    );
    innerRect.setAttribute("x", "0");
    innerRect.setAttribute("y", "0");
    innerRect.setAttribute("transform", `${translateAttr} ${INNER_RECT_SCALE}`);
    innerRect.setAttribute("fill", "white");
    
    // Apply shadow filter if enabled
    if (shadowFilterId) {
      innerRect.setAttribute("filter", `url(#${shadowFilterId})`);
    }

    // Move page to the correct position
    page.setAttribute("transform", translateAttr);

    // Insert rectangle before first page
    svg.insertBefore(innerRect, firstPage);
    if (!firstRect) {
      firstRect = innerRect;
    }

    accumulatedHeight =
      calculatedPaddedY +
      pageHeight +
      (i + 1 === pages.length ? 0 : scaledHeightMargin);
  }

  const newHeight = accumulatedHeight;

  // Create outer rectangle (document background)
  if (firstPage && firstRect) {
    const rectHeight = Math.ceil(newHeight).toString();
    const outerRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    outerRect.setAttribute("class", "typst-page-outer");
    outerRect.setAttribute("data-page-width", newWidth.toString());
    outerRect.setAttribute("data-page-height", rectHeight);
    outerRect.setAttribute("width", newWidth.toString());
    outerRect.setAttribute("height", rectHeight);
    outerRect.setAttribute("x", "0");
    outerRect.setAttribute("y", "0");
    outerRect.setAttribute("fill", backgroundColor);
    svg.insertBefore(outerRect, firstRect);
  }

  // Update SVG dimensions
  svg.setAttribute("viewBox", `0 0 ${newWidth} ${newHeight}`);
  svg.setAttribute("width", `${Math.ceil(newWidth)}`);
  svg.setAttribute("height", `${Math.ceil(newHeight)}`);
  svg.setAttribute("data-width", `${newWidth}`);
  svg.setAttribute("data-height", `${newHeight}`);
}

/**
 * Process HTML string containing SVG and apply pagination
 */
export function processSvgHtml(
  htmlString: string,
  options: PaginationOptions = {}
): string {
  // Create a temporary container
  const container = document.createElement("div");
  container.innerHTML = htmlString;

  // Find the SVG element
  const svg = container.querySelector("svg");
  if (!svg) {
    return htmlString;
  }

  // Apply pagination
  decorateSvgElement(svg, options);

  return container.innerHTML;
}
