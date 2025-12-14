/**
 * Mock for isows package
 * Provides a stub WebSocket implementation for Jest tests
 * Since tests don't actually use WebSocket functionality, this prevents
 * Jest from trying to parse the ES module in node_modules/isows/_esm/native.js
 */

// Create a simple WebSocket stub that matches the expected interface
class WebSocketStub {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = WebSocketStub.CLOSED;
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {}
  send() {}
  close() {}
}

// Export the WebSocket class as a named export (matching isows' export)
module.exports = {
  WebSocket: WebSocketStub,
};

