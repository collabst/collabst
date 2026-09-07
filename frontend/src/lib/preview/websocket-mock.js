/**
 * Injected into the preview iframe: typst-preview-frontend connects to
 * ws://127.0.0.1:23625, which the browser cannot serve, so the WebSocket
 * constructor is intercepted and bridged to the parent via postMessage.
 */

"use strict";

/** @typedef {"open" | "close" | "message" | "error"} ListenerType */

const OriginalWebSocket = window.WebSocket;

const mockInstances = new Set();

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  /**
   * @param {string | URL} url
   * @param {string | string[] | undefined} protocols
   */
  constructor(url, protocols=undefined) {
    if (url instanceof URL) {
      url = url.toString();
    }
    this.url = url;
    this.protocols = protocols;
    this.readyState = MockWebSocket.CONNECTING;
    this.binaryType = "blob";
    this.bufferedAmount = 0;
    this.extensions = "";
    this.protocol = "";

    /**
     * @type {((arg0: Event) => void) | null}
     */
    this.onopen = null;
    /**
     * @type {((arg0: CloseEvent) => void) | null}
     */
    this.onclose = null;
    /**
     * @type {((arg0: MessageEvent<any>) => void) | null}
     */
    this.onmessage = null;
    /**
     * @type {((arg0: Event) => void) | null}
     */
    this.onerror = null;

    /**
     * @type {{ open: Array<Function>; close: Array<Function>; message: Array<Function>; error: Array<Function>; }}
     */
    this._listeners = {
      open: [],
      close: [],
      message: [],
      error: [],
    };

    mockInstances.add(this);

    window.parent.postMessage(
      {
        type: "typst-ws-connect",
        url: url,
      },
      "*"
    );

    // Delay the open so the parent can set up its listeners first.
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this._handleOpen();
      }
    }, 50);
  }

  _handleOpen() {
    this.readyState = MockWebSocket.OPEN;
    const event = new Event("open");
    // RxJS's WebSocketSubject reads event.target.
    Object.defineProperty(event, "target", { value: this, writable: false });
    if (this.onopen) this.onopen(event);
    this._listeners.open.forEach((cb) => cb(event));
  }

  _handleClose(code = 1000, reason = "") {
    this.readyState = MockWebSocket.CLOSED;
    const event = new CloseEvent("close", {
      code: code,
      reason: reason,
      wasClean: true,
    });
    if (this.onclose) this.onclose(event);
    this._listeners.close.forEach((cb) => cb(event));
    mockInstances.delete(this);
  }

  /**
   * @param {BlobPart} data
   */
  _handleMessage(data) {
    if (this.readyState !== MockWebSocket.OPEN) return;

    let messageData = data;

    if (data instanceof ArrayBuffer) {
      if (this.binaryType === "blob") {
        messageData = new Blob([data]);
      } else {
        messageData = data;
      }
    }

    const event = new MessageEvent("message", {
      data: messageData,
      origin: window.location.origin,
    });

    if (this.onmessage) this.onmessage(event);
    this._listeners.message.forEach((cb) => cb(event));
  }

  /**
   * @param {any} error
   */
  _handleError(error) {
    const event = new Event("error");
    if (this.onerror) this.onerror(event);
    this._listeners.error.forEach((cb) => cb(event));
  }

  /**
   * @param {Transferable} data
   */
  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new DOMException("WebSocket is not open", "InvalidStateError");
    }

    if (data instanceof ArrayBuffer) {
      window.parent.postMessage(
        {
          type: "typst-ws-send",
          data: data,
        },
        "*",
        [data]
      );
    } else if (data instanceof Blob) {
      data.arrayBuffer().then((buffer) => {
        window.parent.postMessage(
          {
            type: "typst-ws-send",
            data: buffer,
          },
          "*",
          [buffer]
        );
      });
    } else {
      window.parent.postMessage(
        {
          type: "typst-ws-send",
          data: data,
        },
        "*"
      );
    }
  }

  close(code = 1000, reason = "") {
    if (
      this.readyState === MockWebSocket.CLOSING ||
      this.readyState === MockWebSocket.CLOSED
    ) {
      return;
    }

    this.readyState = MockWebSocket.CLOSING;

    window.parent.postMessage(
      {
        type: "typst-ws-close",
        code: code,
        reason: reason,
      },
      "*"
    );

    setTimeout(() => this._handleClose(code, reason), 0);
  }

  /**
   * @param {ListenerType} type
   * @param {any} callback
   */
  addEventListener(type, callback) {
    if (this._listeners[type]) {
      this._listeners[type].push(callback);
    }
  }

  /**
   * @param {ListenerType} type
   * @param {any} callback
   */
  removeEventListener(type, callback) {
    if (this._listeners[type]) {
      const index = this._listeners[type].indexOf(callback);
      if (index !== -1) {
        this._listeners[type].splice(index, 1);
      }
    }
  }

  /**
   * @param {{ type: ListenerType; }} event
   */
  dispatchEvent(event) {
    const type = event.type;
    if (this._listeners[type]) {
      this._listeners[type].forEach((cb) =>
        cb(event)
      );
    }
    return true;
  }
}

MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

window.addEventListener("message", function (event) {
  const { type, data, code, reason } = event.data || {};

  switch (type) {
    case "typst-ws-message":
      mockInstances.forEach((ws) => {
        ws._handleMessage(data);
      });
      break;

    case "typst-ws-server-close":
      mockInstances.forEach((ws) => {
        ws._handleClose(code || 1000, reason || "");
      });
      break;

    case "typst-ws-error":
      mockInstances.forEach((ws) => {
        ws._handleError(new Error(reason || "WebSocket error"));
      });
      break;

    default:
      break;
  }
});

// Only connections to the typst preview server are mocked.
window.WebSocket = function (
  /** @type {string | URL} */ url,
  /** @type {string | string[] | undefined} */ protocols=undefined,
) {
  if (url instanceof URL) {
    url = url.toString();
  }
  if (url.includes("127.0.0.1:23625") || url.includes("localhost:23625")) {
    return new MockWebSocket(url, protocols);
  }
  console.warn(
    `[WebSocket Mock] WebSocket connection not requesting local typst preview server, using original WebSocket: ${url}`
  );
  return new OriginalWebSocket(url, protocols);
};

window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
window.WebSocket.OPEN = OriginalWebSocket.OPEN;
window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

window.parent.postMessage({ type: "typst-ws-mock-ready" }, "*");
