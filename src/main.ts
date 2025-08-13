import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WebSocketService } from './websocket.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const server = app.getHttpServer();

  const wsService = app.get(WebSocketService);
  wsService.initialize(server);

  await app.listen(3000);
  console.log('HTTP server on http://localhost:3000');
}
bootstrap();





// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { WebSocketService } from './websocket.service';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   const server = await app.listen(3000);

//   new WebSocketService(server);

//   console.log('Server listening on http://localhost:3000');
// }
// bootstrap();




// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(process.env.PORT ?? 3000);
// }
// bootstrap();




// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { Server as WSServer } from 'ws';
// import { RealtimeService } from './realtime.service';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   const port = process.env.PORT ? Number(process.env.PORT) : 3000;
//   await app.listen(port);
//   console.log(`HTTP server listening on http://localhost:${port}`);

//   const httpServer = app.getHttpServer();
//   const wss = new WSServer({ server: httpServer, path: '/ws' });

//   const realtimeService = app.get(RealtimeService);
//   realtimeService.init(wss);

//   console.log(`WebSocket server running at ws://localhost:${port}/ws`);
// }
// bootstrap();







// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(process.env.PORT ?? 3000);
// }
// bootstrap();



// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { Server as WSServer } from 'ws';
// import { RealtimeService } from './realtime/realtime.service';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   const port = process.env.PORT ? Number(process.env.PORT) : 3000;
//   await app.listen(port);
//   console.log(`HTTP server listening on http://localhost:${port}`);

//   // Attach WS to same HTTP server at path /ws
//   const httpServer = app.getHttpServer();
//   const wss = new WSServer({ server: httpServer, path: '/ws' });

//   const realtimeService = app.get(RealtimeService);
//   realtimeService.init(wss);

//   console.log(`WebSocket server attached at ws://localhost:${port}/ws`);
// }
// bootstrap();
