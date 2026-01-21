/** @typedef {"set-zoom" | "zoom-in" | "zoom-out" | "fit-width" | "fit-height" | "fit-page"} CommandType */

// Create a 1inch by 1inch div to help with zoom calculations
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

// Get pixels per inch based on the reference div
const getPPI = () => {
  const ref = document.getElementById('inch-reference') || createInchReference();
  return ref.getBoundingClientRect().width;
}

// Get the container visible width in inches
const getContainerWidthInInches = () => {
  const container = document.getElementById('typst-container');
  if (!container) return 0;
  return container.clientWidth / getPPI();
}

// Get the max page width in inches
const getMaxPageWidthInInches = () => {
  const pages = document.querySelectorAll('rect.typst-page-inner');
  const maxPageWidth = Array.from(pages).reduce((maxWidth, page) => {
    return Math.max(maxWidth, page.attributes['data-page-width']?.value);
  }, 0);
  return maxPageWidth / 72; // Convert points to inches
}


// Convert zoom level to scale ratio
const zoomToScale = (/** @type {number} */ zoom) => {
  const containerWidth = getContainerWidthInInches() || 0;
  const maxPageWidth = getMaxPageWidthInInches();
  return zoom * maxPageWidth / containerWidth;
}

// Convert scale ratio to zoom level
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

// Send zoom change notification to parent window
const notifyZoomChange = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  if (doc?.impl?.currentScaleRatio) {
    const zoom = scaleToZoom(doc.impl.currentScaleRatio);

    if (currentScaleRatio !== doc.impl.currentScaleRatio) {
      if (inhibNextZoomChange) {
        // Ignore this change - it was a backlash of our own command
        inhibNextZoomChange = false;
        currentScaleRatio = doc.impl.currentScaleRatio;
        return;
      }

      // Zoom level changed
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

    // Zoom level did not change but viewport changed - reapply current zoom mode
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
  }
};

// Set up hook for viewport changes to track zoom changes
const setupZoomHook = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  if (doc?.impl) {
    const originalAddViewportChange = doc.impl.addViewportChange;
    doc.impl.addViewportChange = function () {
      if (originalAddViewportChange) {
        originalAddViewportChange.call(this);
      }
      notifyZoomChange();
    };
  }
};

// Set the scale ratio directly
const setScale = (/** @type {number} */ scale) => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  if (doc?.impl) {
    doc.impl.currentScaleRatio = scale;
    doc.impl.addViewportChange();
  }
};

// Set zoom level directly
const setZoom = (/** @type {number} */ zoom) => {
  const scale = zoomToScale(zoom);
  setScale(scale);
}

// Scale down factor to ensure fit modes do not cause scrollbars and make it look better
const fitDownScaleFactor = 0.90;

// Zoom to fit width of the container
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

// Zoom to fit height of the container
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

// Zoom to fit entire page in the container
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

// Handle zoom commands from parent window
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

// Listen for zoom commands from parent window
window.addEventListener("message", (event) => {
  const { type, command, payload } = event.data || {};
  if (type === "typst-command" && command) {
    handleZoomCommand(command, payload);
  }
});
