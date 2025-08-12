import { Server as WSServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';

interface ClientInfo {
  userId: string;
  ws: WebSocket;
  rooms: Set<string>;
}

export class WebSocketService {
  private wss: WSServer;
  private clients = new Map<string, ClientInfo>(); // userId -> ClientInfo
  private rooms = new Map<string, Set<string>>(); // roomId -> set userId

  constructor(server: HttpServer) {
    this.wss = new WSServer({ server });

    this.wss.on('connection', (ws) => {
      let currentUserId: string | null = null;

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          switch (message.type) {
            case 'register': {
              currentUserId = message.userId;
              this.clients.set(currentUserId, { userId: currentUserId, ws, rooms: new Set() });
              ws.send(JSON.stringify({ type: 'system', message: `Registered as ${currentUserId}` }));
              break;
            }
            case 'join_room': {
              if (!currentUserId) {
                ws.send(JSON.stringify({ type: 'error', message: 'Please register first' }));
                break;
              }
              const roomId = message.roomId;
              let room = this.rooms.get(roomId);
              if (!room) {
                room = new Set();
                this.rooms.set(roomId, room);
              }
              room.add(currentUserId);
              this.clients.get(currentUserId)?.rooms.add(roomId);
              ws.send(JSON.stringify({ type: 'system', message: `Joined room ${roomId}` }));
              break;
            }
            case 'leave_room': {
              if (!currentUserId) {
                ws.send(JSON.stringify({ type: 'error', message: 'Please register first' }));
                break;
              }
              const roomId = message.roomId;
              const room = this.rooms.get(roomId);
              if (room) {
                room.delete(currentUserId);
                if (room.size === 0) this.rooms.delete(roomId);
              }
              this.clients.get(currentUserId)?.rooms.delete(roomId);
              ws.send(JSON.stringify({ type: 'system', message: `Left room ${roomId}` }));
              break;
            }
            case 'group_message': {
              if (!currentUserId) {
                ws.send(JSON.stringify({ type: 'error', message: 'Please register first' }));
                break;
              }
              const roomId = message.roomId;
              const content = message.content;
              const room = this.rooms.get(roomId);
              if (!room) {
                ws.send(JSON.stringify({ type: 'error', message: `Room ${roomId} does not exist` }));
                break;
              }
              for (const userId of room) {
                if (userId !== currentUserId) {
                  const client = this.clients.get(userId);
                  if (client && client.ws.readyState === WebSocket.OPEN) {
                    client.ws.send(JSON.stringify({
                      type: 'group_message',
                      roomId,
                      fromUserId: currentUserId,
                      content,
                    }));
                  }
                }
              }
              break;
            }
            case 'broadcast_message': {
              if (!currentUserId) {
                ws.send(JSON.stringify({ type: 'error', message: 'Please register first' }));
                break;
              }
              const content = message.content;
              for (const [userId, client] of this.clients) {
                if (userId !== currentUserId && client.ws.readyState === WebSocket.OPEN) {
                  client.ws.send(JSON.stringify({
                    type: 'broadcast_message',
                    fromUserId: currentUserId,
                    content,
                  }));
                }
              }
              break;
            }
            case 'private_message': {
              if (!currentUserId) {
                ws.send(JSON.stringify({ type: 'error', message: 'Please register first' }));
                break;
              }
              const toUserId = message.toUserId;
              const content = message.content;
              const receiver = this.clients.get(toUserId);
              if (receiver && receiver.ws.readyState === WebSocket.OPEN) {
                receiver.ws.send(JSON.stringify({
                  type: 'private_message',
                  fromUserId: currentUserId,
                  content,
                }));
              } else {
                ws.send(JSON.stringify({ type: 'system', message: `User ${toUserId} is offline` }));
              }
              break;
            }
            default: {
              ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
            }
          }
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format' }));
        }
      });

      ws.on('close', () => {
        if (currentUserId) {
          const client = this.clients.get(currentUserId);
          if (client) {
            client.rooms.forEach(roomId => {
              const room = this.rooms.get(roomId);
              if (room) {
                room.delete(currentUserId);
                if (room.size === 0) this.rooms.delete(roomId);
              }
            });
            this.clients.delete(currentUserId);
            console.log(`User disconnected and removed: ${currentUserId}`);
          }
        }
      });
    });
  }
}






















// import { Server as WSServer, WebSocket } from 'ws';
// import { Server as HttpServer } from 'http';

// interface ClientInfo {
//   userId: string;
//   ws: WebSocket;
//   rooms: Set<string>;
// }

// export class WebSocketService {
//   private wss: WSServer;
//   private clients = new Map<string, ClientInfo>(); // userId -> ClientInfo
//   private rooms = new Map<string, Set<string>>(); // roomId -> set userId

//   constructor(server: HttpServer) {
//     this.wss = new WSServer({ server });

//     this.wss.on('connection', (ws) => {
//       let currentUserId: string | null = null;

//       ws.on('message', (data) => {
//         try {
//           const message = JSON.parse(data.toString());

//           switch (message.type) {
//             case 'register': {
//               currentUserId = message.userId;
//               this.clients.set(currentUserId, { userId: currentUserId, ws, rooms: new Set() });
//               ws.send(JSON.stringify({ type: 'system', message: `Registered as ${currentUserId}` }));
//               break;
//             }
//             case 'join_room': {
//               if (!currentUserId) {
//                 ws.send(JSON.stringify({ type: 'error', message: 'Please register first' }));
//                 break;
//               }
//               const roomId = message.roomId;
//               // Add user to room
//               let room = this.rooms.get(roomId);
//               if (!room) {
//                 room = new Set();
//                 this.rooms.set(roomId, room);
//               }
//               room.add(currentUserId);
//               this.clients.get(currentUserId)?.rooms.add(roomId);

//               ws.send(JSON.stringify({ type: 'system', message: `Joined room ${roomId}` }));
//               break;
//             }
//             case 'leave_room': {
//               if (!currentUserId) {
//                 ws.send(JSON.stringify({ type: 'error', message: 'Please register first' }));
//                 break;
//               }
//               const roomId = message.roomId;
//               const room = this.rooms.get(roomId);
//               if (room) {
//                 room.delete(currentUserId);
//                 if (room.size === 0) this.rooms.delete(roomId);
//               }
//               this.clients.get(currentUserId)?.rooms.delete(roomId);
//               ws.send(JSON.stringify({ type: 'system', message: `Left room ${roomId}` }));
//               break;
//             }
//             case 'group_message': {
//               if (!currentUserId) {
//                 ws.send(JSON.stringify({ type: 'error', message: 'Please register first' }));
//                 break;
//               }
//               const roomId = message.roomId;
//               const content = message.content;
//               const room = this.rooms.get(roomId);
//               if (!room) {
//                 ws.send(JSON.stringify({ type: 'error', message: `Room ${roomId} does not exist` }));
//                 break;
//               }
//               // Broadcast đến tất cả thành viên trong room trừ sender
//               for (const userId of room) {
//                 if (userId !== currentUserId) {
//                   const client = this.clients.get(userId);
//                   if (client && client.ws.readyState === WebSocket.OPEN) {
//                     client.ws.send(JSON.stringify({
//                       type: 'group_message',
//                       roomId,
//                       fromUserId: currentUserId,
//                       content,
//                     }));
//                   }
//                 }
//               }
//               break;
//             }
//             case 'private_message': {
//               // giữ nguyên chat 1-1
//               if (!currentUserId) {
//                 ws.send(JSON.stringify({ type: 'error', message: 'Please register first' }));
//                 break;
//               }
//               const toUserId = message.toUserId;
//               const content = message.content;
//               const receiver = this.clients.get(toUserId);
//               if (receiver && receiver.ws.readyState === WebSocket.OPEN) {
//                 receiver.ws.send(JSON.stringify({
//                   type: 'private_message',
//                   fromUserId: currentUserId,
//                   content,
//                 }));
//               } else {
//                 ws.send(JSON.stringify({ type: 'system', message: `User ${toUserId} is offline` }));
//               }
//               break;
//             }
//             default: {
//               ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
//             }
//           }
//         } catch (err) {
//           ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format' }));
//         }
//       });

//       ws.on('close', () => {
//         if (currentUserId) {
//           // Remove client from all rooms
//           const client = this.clients.get(currentUserId);
//           if (client) {
//             client.rooms.forEach(roomId => {
//               const room = this.rooms.get(roomId);
//               if (room) {
//                 room.delete(currentUserId);
//                 if (room.size === 0) this.rooms.delete(roomId);
//               }
//             });
//             this.clients.delete(currentUserId);
//             console.log(`User disconnected and removed: ${currentUserId}`);
//           }
//         }
//       });
//     });
//   }
// }





// // websocket.service.ts
// import { Server as WSServer, WebSocket } from 'ws';
// import { Server as HttpServer } from 'http';

// interface Client {
//   userId: string;
//   ws: WebSocket;
// }

// export class WebSocketService {
//   private wss: WSServer;
//   private clients = new Map<string, WebSocket>(); // userId -> ws

//   constructor(server: HttpServer) {
//     this.wss = new WSServer({ server });

//     this.wss.on('connection', (ws) => {
//       let currentUserId: string | null = null;

//       ws.on('message', (data) => {
//         try {
//           const message = JSON.parse(data.toString());

//           if (message.type === 'register') {
//             // Client gửi userId để đăng ký
//             currentUserId = message.userId;
//             this.clients.set(currentUserId, ws);
//             ws.send(JSON.stringify({ type: 'system', message: 'Registered userId ' + currentUserId }));
//             console.log(`User registered: ${currentUserId}`);
//             return;
//           }

//           if (message.type === 'private_message') {
//             // Gửi tin nhắn cho user đích
//             const toUserId = message.toUserId;
//             const content = message.content;

//             const receiverWs = this.clients.get(toUserId);
//             if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
//               receiverWs.send(JSON.stringify({
//                 type: 'private_message',
//                 fromUserId: currentUserId,
//                 content,
//               }));
//             } else {
//               ws.send(JSON.stringify({ type: 'system', message: `User ${toUserId} is offline` }));
//             }
//           }
//         } catch (error) {
//           ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
//         }
//       });

//       ws.on('close', () => {
//         if (currentUserId) {
//           this.clients.delete(currentUserId);
//           console.log(`User disconnected: ${currentUserId}`);
//         }
//       });
//     });
//   }
// }
