let socket = null;
let onQuoteUpdate = null;

export function initSocket(callback) {
  onQuoteUpdate = callback;

  if (typeof io === 'undefined') {
    // Socket.IO client not loaded
    return;
  }

  socket = io();

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('quote:new', (data) => {
    if (onQuoteUpdate) onQuoteUpdate('new', data);
  });

  socket.on('quote:updated', (data) => {
    if (onQuoteUpdate) onQuoteUpdate('updated', data);
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
  });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
