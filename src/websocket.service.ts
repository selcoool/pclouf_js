import { Injectable } from '@nestjs/common';
import { Server as WSServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { PrismaService } from './prisma.service';

interface ClientInfo {
  userId: string;
  ws: WebSocket;
  rooms: Set<string>;
}

@Injectable()
export class WebSocketService {
  private endpoints: Record<string, WSServer> = {};
  private clients = new Map<string, ClientInfo>(); // userId -> ClientInfo
  private rooms = new Map<string, Set<string>>();  // roomId -> userIds

  constructor(private prisma: PrismaService) {}

  initialize(server: HttpServer) {
    // Khởi tạo endpoint
    this.endpoints['/ws'] = new WSServer({ noServer: true });
    this.endpoints['/chat'] = new WSServer({ noServer: true });
    this.endpoints['/users'] = new WSServer({ noServer: true });

    // Upgrade HTTP -> WS
    server.on('upgrade', (req, socket, head) => {
      const path = req.url || '';
      const wss = this.endpoints[path];
      if (wss) {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      } else {
        socket.destroy();
      }
    });

    /** ---------- Endpoint /ws: CRUD User với Prisma ---------- */
    this.endpoints['/ws'].on('connection', (ws: WebSocket) => {
      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          switch (msg.type) {
            case 'create_user': {
              const user = await this.prisma.user.create({
                data: { name: msg.name, email: msg.email },
              });
              ws.send(JSON.stringify({ type: 'user_created', data: user }));
              break;
            }
            case 'get_users': {
              const users = await this.prisma.user.findMany();
              ws.send(JSON.stringify({ type: 'users_list', data: users }));
              break;
            }
            case 'update_user': {
              const updated = await this.prisma.user.update({
                where: { id: msg.id },
                data: { name: msg.name, email: msg.email },
              });
              ws.send(JSON.stringify({ type: 'user_updated', data: updated }));
              break;
            }
            case 'delete_user': {
              await this.prisma.user.delete({ where: { id: msg.id } });
              ws.send(JSON.stringify({ type: 'user_deleted', id: msg.id }));
              break;
            }
            default:
              ws.send(JSON.stringify({ type: 'error', message: 'Unknown type' }));
          }
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      });
    });

    /** ---------- Endpoint /chat: Chat broadcast + Multi-room + Private ---------- */
    this.endpoints['/chat'].on('connection', (ws: WebSocket) => {
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
              if (!currentUserId) return this.error(ws, 'Please register first');
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
              if (!currentUserId) return this.error(ws, 'Please register first');
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
              if (!currentUserId) return this.error(ws, 'Please register first');
              const { roomId, content } = message;
              const room = this.rooms.get(roomId);
              if (!room) return this.error(ws, `Room ${roomId} does not exist`);
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
              if (!currentUserId) return this.error(ws, 'Please register first');
              const { content } = message;
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
              if (!currentUserId) return this.error(ws, 'Please register first');
              const { toUserId, content } = message;
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
            default:
              this.error(ws, 'Unknown message type');
          }
        } catch {
          this.error(ws, 'Invalid JSON format');
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
            console.log(`User disconnected: ${currentUserId}`);
          }
        }
      });
    });

    /** ---------- Endpoint /users: Danh sách user online ---------- */
    this.endpoints['/users'].on('connection', (ws: WebSocket) => {
      const onlineUsers = Array.from(this.clients.keys()).map((id) => ({ id, status: 'online' }));
      ws.send(JSON.stringify({ type: 'online_users', data: onlineUsers }));
    });
  }

  private error(ws: WebSocket, message: string) {
    ws.send(JSON.stringify({ type: 'error', message }));
  }
}


// import { Injectable } from '@nestjs/common';
// import { Server as WSServer, WebSocket } from 'ws';
// import { Server as HttpServer, IncomingMessage } from 'http';
// import { PrismaService } from './prisma.service';

// @Injectable()
// export class WebSocketService {
//   private endpoints: Record<string, WSServer> = {};

//   constructor(private prisma: PrismaService) {}

//   initialize(server: HttpServer) {
//     // Tạo từng WS server riêng cho từng endpoint
//     this.endpoints['/ws'] = new WSServer({ noServer: true });
//     this.endpoints['/chat'] = new WSServer({ noServer: true });
//     this.endpoints['/users'] = new WSServer({ noServer: true });

//     // Lắng nghe upgrade của HTTP server
//     server.on('upgrade', (request, socket, head) => {
//       const pathname = request.url || '';
//       const wss = this.endpoints[pathname];
//       if (wss) {
//         wss.handleUpgrade(request, socket, head, (ws) => {
//           wss.emit('connection', ws, request);
//         });
//       } else {
//         socket.destroy();
//       }
//     });

//     // Xử lý endpoint `/ws` → CRUD User
//     this.endpoints['/ws'].on('connection', (ws: WebSocket) => {
//       ws.on('message', async (raw) => {
//         try {
//           const msg = JSON.parse(raw.toString());

//           switch (msg.type) {
//             case 'create_user': {
//               const user = await this.prisma.user.create({
//                 data: {
//                   name: msg.name,
//                   email: msg.email,
//                 },
//               });
//               ws.send(JSON.stringify({ type: 'user_created', data: user }));
//               break;
//             }

//             case 'get_users': {
//               const users = await this.prisma.user.findMany();
//               ws.send(JSON.stringify({ type: 'users_list', data: users }));
//               break;
//             }

//             case 'update_user': {
//               const updated = await this.prisma.user.update({
//                 where: { id: msg.id },
//                 data: { name: msg.name, email: msg.email },
//               });
//               ws.send(JSON.stringify({ type: 'user_updated', data: updated }));
//               break;
//             }

//             case 'delete_user': {
//               await this.prisma.user.delete({ where: { id: msg.id } });
//               ws.send(JSON.stringify({ type: 'user_deleted', id: msg.id }));
//               break;
//             }

//             default:
//               ws.send(JSON.stringify({ type: 'error', message: 'Unknown type' }));
//           }
//         } catch (err) {
//           ws.send(JSON.stringify({ type: 'error', message: err.message }));
//         }
//       });
//     });

//     // Xử lý endpoint `/chat` → Chat nhóm và private
//     this.endpoints['/chat'].on('connection', (ws: WebSocket) => {
//       ws.on('message', (raw) => {
//         try {
//           const msg = JSON.parse(raw.toString());
//           // Demo chat broadcast
//           this.broadcast('/chat', { type: 'chat_message', from: 'userX', content: msg.content });
//         } catch (err) {
//           ws.send(JSON.stringify({ type: 'error', message: err.message }));
//         }
//       });
//     });

//     // Xử lý endpoint `/users` → Lấy danh sách user online
//     this.endpoints['/users'].on('connection', (ws: WebSocket) => {
//       const onlineUsers = Object.keys(this.endpoints['/chat'].clients)
//         .map((id) => ({ id, status: 'online' }));
//       ws.send(JSON.stringify({ type: 'online_users', data: onlineUsers }));
//     });
//   }

//   private broadcast(endpoint: string, message: any) {
//     const wss = this.endpoints[endpoint];
//     if (!wss) return;
//     wss.clients.forEach((client: WebSocket) => {
//       if (client.readyState === WebSocket.OPEN) {
//         client.send(JSON.stringify(message));
//       }
//     });
//   }
// }



// import { Injectable } from '@nestjs/common';
// import { Server as WSServer, WebSocket } from 'ws';
// import { Server as HttpServer } from 'http';
// import { PrismaService } from './prisma.service';

// @Injectable()
// export class WebSocketService {
//   private wss: WSServer;

//   constructor(private prisma: PrismaService) {}

//   initialize(server: HttpServer) {
//     this.wss = new WSServer({ server });

//     this.wss.on('connection', (ws) => {
//       ws.on('message', async (raw) => {
//         try {
//           const msg = JSON.parse(raw.toString());

//           switch (msg.type) {
//             case 'create_user': {
//               const user = await this.prisma.user.create({
//                 data: {
//                   name: msg.name,
//                   email: msg.email,
//                 },
//               });
//               ws.send(JSON.stringify({ type: 'user_created', data: user }));
//               break;
//             }

//             case 'get_users': {
//               const users = await this.prisma.user.findMany();
//               ws.send(JSON.stringify({ type: 'users_list', data: users }));
//               break;
//             }

//             case 'update_user': {
//               const updated = await this.prisma.user.update({
//                 where: { id: msg.id },
//                 data: { name: msg.name, email: msg.email },
//               });
//               ws.send(JSON.stringify({ type: 'user_updated', data: updated }));
//               break;
//             }

//             case 'delete_user': {
//               await this.prisma.user.delete({ where: { id: msg.id } });
//               ws.send(JSON.stringify({ type: 'user_deleted', id: msg.id }));
//               break;
//             }

//             default:
//               ws.send(JSON.stringify({ type: 'error', message: 'Unknown type' }));
//           }
//         } catch (err) {
//           ws.send(JSON.stringify({ type: 'error', message: err.message }));
//         }
//       });
//     });
//   }
// }





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
//             case 'broadcast_message': {
//               if (!currentUserId) {
//                 ws.send(JSON.stringify({ type: 'error', message: 'Please register first' }));
//                 break;
//               }
//               const content = message.content;
//               for (const [userId, client] of this.clients) {
//                 if (userId !== currentUserId && client.ws.readyState === WebSocket.OPEN) {
//                   client.ws.send(JSON.stringify({
//                     type: 'broadcast_message',
//                     fromUserId: currentUserId,
//                     content,
//                   }));
//                 }
//               }
//               break;
//             }
//             case 'private_message': {
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
//         } catch {
//           ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format' }));
//         }
//       });

//       ws.on('close', () => {
//         if (currentUserId) {
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
