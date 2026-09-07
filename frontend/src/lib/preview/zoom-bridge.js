/** @typedef {"set-zoom" | "zoom-in" | "zoom-out" | "fit-width" | "fit-height" | "fit-page"} CommandType */

// A 1in by 1in div, to measure the device's pixels per inch.
const createInchReference = () => {
  const ref = document.createElement('div');
  ref.id = 'inch-reference';
  ref.style.width = '1in';
  ref.style.height = '1in';
  ref.style.position = 'absolute';
  ref.style.top = '-100%'; // Hide it off-screen
  document.body.appendChild(ref);
  return ref;
}

const getPPI = () => {
  const ref = document.getElementById('inch-reference') || createInchReference();
  return ref.getBoundingClientRect().width;
}

const getContainerWidthInInches = () => {
  const container = document.getElementById('typst-container');
  if (!container) return 0;
  return container.clientWidth / getPPI();
}

const getMaxPageWidthInInches = () => {
  const pages = document.querySelectorAll('rect.typst-page-inner');
  const maxPageWidth = Array.from(pages).reduce((maxWidth, page) => {
    return Math.max(maxWidth, page.attributes['data-page-width']?.value);
  }, 0);
  return maxPageWidth / 72; // Convert points to inches
}


const zoomToScale = (/** @type {number} */ zoom) => {
  const containerWidth = getContainerWidthInInches() || 0;
  const maxPageWidth = getMaxPageWidthInInches();
  return zoom * maxPageWidth / containerWidth;
}

const scaleToZoom = (/** @type {number} */ scale) => {
  const containerWidth = getContainerWidthInInches() || 0;
  const maxPageWidth = getMaxPageWidthInInches();
  return scale * containerWidth / maxPageWidth;
}

// Simulate a ctrl + wheel event to step zoom in or out
const stepZoom = (/** @type {"in" | "out"} */ direction) => {
  let event = new WheelEvent("wheel", {
    deltaMode: 0,
    deltaX: 0,
    deltaY: direction === "in" ? -20 : 20,
    ctrlKey: true,
    clientX: document.body.clientWidth / 2,
    clientY: document.body.clientHeight / 2,
  });
  document.body.dispatchEvent(event);
};

let currentScaleRatio = 1;  // Keep track of current scale ratio
let currentZoomMode = 'fit-page';  // Keep track of current zoom mode
let currentZoomValue = 1;  // Keep track of current zoom value
let inhibNextZoomChange = false; // Flag to inhibit next zoom change notification
/** @type {MutationObserver | null} */
let typstAppTransformObserver = null;

const lockedTranslate = 'translate(0px, 0px)';

// Keep #typst-app pinned to origin even when internal rescale logic rewrites transform.
const centerTypstApp = () => {
  const typstApp = document.getElementById('typst-app');
  if (!typstApp) {
    setTimeout(centerTypstApp, 100);
    return;
  }

  typstApp.style.margin = '0 auto';

  if (typstApp.style.transform !== lockedTranslate) {
    typstApp.style.transform = lockedTranslate;
  }

  if (typstAppTransformObserver) return;

  typstAppTransformObserver = new MutationObserver(() => {
    if (typstApp.style.transform !== lockedTranslate) {
      typstApp.style.transform = lockedTranslate;
    }
  });

  typstAppTransformObserver.observe(typstApp, {
    attributes: true,
    attributeFilter: ['style'],
  });

  const typstContainerMain = document.getElementById('typst-container-main');
  if (typstContainerMain) {
    const scrollByOriginal = typstContainerMain.scrollBy;
    typstContainerMain.scrollBy = function (x, y, ...args) {
      if (x % 1 === 0 && y % 1 === 0) {
        scrollByOriginal.call(this, x, y, ...args);
      } else { // Floating point scroll only happens during zooming.
        // TODO: find a way to scroll smoothly (currently disabled because it causes jitter)
      }
    };
  }
};

const notifyZoomChange = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  if (doc?.impl?.currentScaleRatio) {
    const zoom = scaleToZoom(doc.impl.currentScaleRatio);

    if (currentScaleRatio !== doc.impl.currentScaleRatio) {
      if (inhibNextZoomChange) {
        // Echo of our own command.
        inhibNextZoomChange = false;
        currentScaleRatio = doc.impl.currentScaleRatio;
        return;
      }

      currentScaleRatio = doc.impl.currentScaleRatio;
      currentZoomValue = zoom;
      currentZoomMode = 'custom';
      window.parent.postMessage(
        {
          type: 'typst-zoom-changed',
          zoom: currentZoomValue,
          mode: currentZoomMode,
        },
        '*'
      );
      return;
    }

    reapplyCurrentZoomMode();
  }
};

const reapplyCurrentZoomMode = () => {
  inhibNextZoomChange = true;
  switch (currentZoomMode) {
    case 'fit-width':
      zoomFitWidth();
      break;
    case 'fit-height':
      zoomFitHeight();
      break;
    case 'fit-page':
      zoomFitPage();
      break;
    case 'custom':
      setZoom(currentZoomValue);
      break;
    default:
      break;
  }
};

const initializeZoom = () => {
  const typstApp = document.querySelector('#typst-app .typst-page-outer');
  const pageWidthAttr = typstApp?.getAttribute('data-page-width');
  if (pageWidthAttr) {
    reapplyCurrentZoomMode();
    window.parent.postMessage({ type: 'typst-zoom-initialized', }, '*');
  } else {
    setTimeout(initializeZoom, 100);
  }
};

const setupZoomHook = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  if (doc?.impl) {
    doc.impl.originalAddViewportChange = doc.impl.addViewportChange;
    doc.impl.addViewportChange = function () {
      if (doc.impl.originalAddViewportChange) {
        doc.impl.originalAddViewportChange.call(this);
      }
      notifyZoomChange();
    };
  }
  centerTypstApp();
  initializeZoom();
};

const setScale = (/** @type {number} */ scale) => {
  if (scale <= 0) return;
  const doc = document.getElementById('typst-container')?.documents?.[0];
  if (doc?.impl) {
    doc.impl.currentScaleRatio = scale;
    doc.impl.originalAddViewportChange?.call(doc.impl);
  }
};

const setZoom = (/** @type {number} */ zoom) => {
  const scale = zoomToScale(zoom);
  setScale(scale);
  currentZoomMode = 'custom';
  currentZoomValue = zoom;
}

// Keeps fit modes from cause scrollbars and make it look better
const fitDownScaleFactor = 0.90;

const zoomFitWidth = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  const page = document.querySelector('rect.typst-page-inner');
  if (page && doc?.impl) {
    const pageWidth = page.getBoundingClientRect().width;
    const containerWidth = window.innerWidth;
    const scale = containerWidth / pageWidth;
    setScale(scale * doc.impl.currentScaleRatio * fitDownScaleFactor);
  }
  currentZoomMode = 'fit-width';
}

const zoomFitHeight = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  const page = document.querySelector('rect.typst-page-inner');
  if (page && doc?.impl) {
    const pageHeight = page.getBoundingClientRect().height;
    const containerHeight = window.innerHeight;
    const scale = containerHeight / pageHeight;
    setScale(scale * doc.impl.currentScaleRatio * fitDownScaleFactor);
  }
  currentZoomMode = 'fit-height';
}

const zoomFitPage = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  const page = document.querySelector('rect.typst-page-inner');
  if (page && doc?.impl) {
    const pageRect = page.getBoundingClientRect();
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    const scaleX = containerWidth / pageRect.width;
    const scaleY = containerHeight / pageRect.height;
    const scale = Math.min(scaleX, scaleY);
    setScale(scale * doc.impl.currentScaleRatio * fitDownScaleFactor);
  }
  currentZoomMode = 'fit-page';
}

const handleZoomCommand = (
  /** @type {CommandType} */ command,
  /** @type {any} */ payload
) => {
  switch (command) {
    case "set-zoom": {
      setZoom(payload.zoom);
      return;
    }
    case "zoom-in": {
      stepZoom("in");
      return;
    }
    case "zoom-out": {
      stepZoom("out");
      return;
    }
    case "fit-width": {
      zoomFitWidth();
      return;
    }
    case "fit-height": {
      zoomFitHeight();
      return;
    }
    case "fit-page": {
      zoomFitPage();
      return;
    }
    default:
      return;
  }
};

window.addEventListener("message", (event) => {
  const { type, command, payload } = event.data || {};
  if (type === "typst-command" && command) {
    handleZoomCommand(command, payload);
  }
});
