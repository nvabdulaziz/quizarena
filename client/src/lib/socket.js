import { io } from 'socket.io-client';
import { API_URL, getToken } from './api.js';

let socket = null;
export function getSocket() {
  if (!socket) {
    socket = io(API_URL, { autoConnect: false, transports: ['websocket', 'polling'], auth: (cb) => cb({ token: getToken() }), reconnectionDelayMax: 3000 });
  }
  return socket;
}
export function emit(event, payload) {
  return new Promise((resolve) => {
    const s = getSocket();
    const t = setTimeout(() => resolve({ error: 'TIMEOUT' }), 8000);
    s.emit(event, payload, (res) => { clearTimeout(t); resolve(res || {}); });
  });
}
