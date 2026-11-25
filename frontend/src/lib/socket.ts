import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    const token = typeof window !== 'undefined' ? localStorage.getItem('bidora_token') : null;

    socket = io(url, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token },
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to BIDORA Real-Time Socket Server:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('⚡ Disconnected from Socket Server');
    });
  }

  return socket;
}
