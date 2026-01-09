/** @typedef {"set-zoom" | "zoom-in" | "zoom-out" | "fit-width" | "fit-height" | "fit-page"} CommandType */

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

// Send zoom change notification to parent window
const notifyZoomChange = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  if (doc?.impl?.currentScaleRatio) {
    const zoom = doc.impl.currentScaleRatio;
    window.parent.postMessage(
      {
        type: 'typst-zoom-changed',
        zoom: zoom,
        mode: 'custom'
      },
      '*'
    );
  }
};

// Hook into viewport changes to detect zoom updates
const hookViewportChange = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  if (doc?.impl?.addViewportChange) {
    const originalAddViewportChange = doc.impl.addViewportChange;
    doc.impl.addViewportChange = function() {
      originalAddViewportChange.call(this);
      notifyZoomChange();
    };
  } else {
    // Retry if document not ready yet
    setTimeout(hookViewportChange, 100);
  }
};

const setZoom = (/** @type {number} */ zoom) => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  if (doc?.impl) {
    doc.impl.currentScaleRatio = zoom;
    doc.impl.addViewportChange();
  }
};

const zoomFitWidth = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  const page = document.querySelector('rect.typst-page-inner');
  if (page && doc?.impl) {
    const pageRect = page.getBoundingClientRect();
    const containerWidth = window.innerWidth;
    const scale = containerWidth / pageRect.width;
    setZoom(scale * doc.impl.currentScaleRatio);
  }
}

const zoomFitHeight = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  const page = document.querySelector('rect.typst-page-inner');
  if (page && doc?.impl) {
    const pageHeight = page.getBoundingClientRect().height;
    const containerHeight = window.innerHeight;
    const scale = containerHeight / pageHeight;
    setZoom(scale * doc.impl.currentScaleRatio);
  }
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
    setZoom(scale * doc.impl.currentScaleRatio);
  }
}

const handleCommand = (
  /** @type {CommandType} */ command,
  /** @type {any} */ payload
) => {
  switch (command) {
    case "set-zoom": {
      setZoom(payload.scale);
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
    handleCommand(command, payload);
  }
});

// Initialize zoom change tracking when document loads
document.addEventListener('DOMContentLoaded', () => {
  hookViewportChange();
});
