import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
  const token = typeof window !== 'undefined' ? localStorage.getItem('bidora_token') : null;

  if (!socket) {
    socket = io(url, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token },
    });

    socket.on('connect', () => {
      console.log('Connected to BIDORA Real-Time Socket Server:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket Server');
    });
  } else if (token && (socket.auth as any)?.token !== token) {
    socket.auth = { token };
    if (socket.connected) {
      socket.emit('register_user', { token });
    } else {
      socket.connect();
    }
  }

  return socket;
}
