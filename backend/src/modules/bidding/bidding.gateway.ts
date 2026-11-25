import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BiddingService, BidResult } from './bidding.service';
import { ProxyBiddingService } from './proxy-bidding.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { SetProxyBidDto } from './dto/set-proxy-bid.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class BiddingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BiddingGateway.name);
  private clockSyncInterval: NodeJS.Timeout | null = null;

  constructor(
    private biddingService: BiddingService,
    private proxyBiddingService: ProxyBiddingService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    // Periodic server-controlled clock synchronization every 10 seconds
    this.clockSyncInterval = setInterval(() => {
      if (this.server) {
        this.broadcastServerTime();
      }
    }, 10000);
  }

  onModuleDestroy() {
    if (this.clockSyncInterval) {
      clearInterval(this.clockSyncInterval);
    }
  }

  private extractAndVerifyToken(token?: string): string | null {
    if (!token) return null;
    try {
      const accessSecret = this.configService.get<string>(
        'JWT_ACCESS_SECRET',
        'bidora_jwt_access_secret_super_secure_key_2026',
      );
      const decoded: any = this.jwtService.verify(token, { secret: accessSecret });
      return decoded?.sub || null;
    } catch {
      return null;
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers?.authorization?.replace('Bearer ', '') as string);
    const userId = this.extractAndVerifyToken(token);
    if (userId) {
      client.join(`user:${userId}`);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Update viewer counts for any auction rooms the disconnecting socket belonged to
    for (const room of client.rooms) {
      if (room.startsWith('auction:')) {
        const auctionId = room.replace('auction:', '');
        await this.broadcastRoomViewers(auctionId, client.id);
      }
    }
  }

  @SubscribeMessage('register_user')
  handleRegisterUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token?: string },
  ) {
    const userId = this.extractAndVerifyToken(data?.token);
    if (userId) {
      client.join(`user:${userId}`);
    }
  }

  private async broadcastRoomViewers(auctionId: string, excludeSocketId?: string) {
    if (!this.server) return;
    const room = `auction:${auctionId}`;
    const sockets = await this.server.in(room).fetchSockets();
    const count = excludeSocketId
      ? sockets.filter((s) => s.id !== excludeSocketId).length
      : sockets.length;
    this.server.to(room).emit('room_viewers', { auctionId, viewersCount: count });
  }

  /**
   * Join an auction room to receive live updates
   */
  @SubscribeMessage('join_auction')
  async handleJoinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { auctionId: string },
  ) {
    if (!data?.auctionId) return;
    const room = `auction:${data.auctionId}`;
    await client.join(room);

    // Send recent bid history to joining client
    const recentBids = await this.biddingService.getRecentBids(data.auctionId, 15);
    client.emit('auction_joined', {
      auctionId: data.auctionId,
      recentBids,
      serverTime: new Date().toISOString(),
    });

    await this.broadcastRoomViewers(data.auctionId);
  }

  /**
   * Leave an auction room
   */
  @SubscribeMessage('leave_auction')
  async handleLeaveAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { auctionId: string },
  ) {
    if (!data?.auctionId) return;
    await client.leave(`auction:${data.auctionId}`);
    await this.broadcastRoomViewers(data.auctionId);
  }

  /**
   * Broadcast accepted bid and personal outbid notifications to connected clients
   */
  emitBidAccepted(result: BidResult) {
    if (!this.server) return;
    const room = `auction:${result.auctionId}`;
    this.server.to(room).emit('bid_updated', {
      auctionId: result.auctionId,
      amount: result.amount,
      bidderAlias: result.bidderAlias,
      placedAt: result.placedAt,
      newEndTime: result.newEndTime,
      antiSnipingExtended: result.antiSnipingExtended,
      proxyCounterTriggered: result.proxyCounterTriggered,
    });

    this.server.emit('marketplace_bid_update', {
      auctionId: result.auctionId,
      currentHighestBid: result.amount,
      newEndTime: result.newEndTime,
      antiSnipingExtended: result.antiSnipingExtended,
    });

    // Deliver instant real-time outbid alerts to affected users
    if (result.outbidNotifications && result.outbidNotifications.length > 0) {
      for (const item of result.outbidNotifications) {
        this.server.to(`user:${item.userId}`).emit('notification', item.notification);
      }
    }
  }

  /**
   * Real-time bid placement via WebSocket
   */
  @SubscribeMessage('place_bid')
  async handlePlaceBid(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlaceBidDto & { token?: string },
  ) {
    try {
      const token =
        payload.token ||
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization?.replace('Bearer ', '') as string);

      const userId = this.extractAndVerifyToken(token);
      if (!userId) {
        client.emit('bid_error', {
          auctionId: payload.auctionId,
          message: 'Authentication required to place bids',
        });
        return;
      }

      const ipAddress = client.handshake.address;
      const result = await this.biddingService.placeBid(userId, payload, ipAddress);

      this.emitBidAccepted(result);

      // Acknowledge back to placing bidder
      client.emit('bid_success', result);
    } catch (err) {
      client.emit('bid_error', {
        auctionId: payload.auctionId,
        message: err.message || 'Failed to place bid',
      });
    }
  }

  /**
   * Configure proxy ceiling via WebSocket
   */
  @SubscribeMessage('set_proxy_bid')
  async handleSetProxyBid(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SetProxyBidDto & { token?: string },
  ) {
    try {
      const token =
        payload.token ||
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization?.replace('Bearer ', '') as string);

      const userId = this.extractAndVerifyToken(token);
      if (!userId) {
        client.emit('proxy_bid_error', { message: 'Authentication required' });
        return;
      }

      await this.proxyBiddingService.setProxyBid(userId, payload.auctionId, payload.maxAmount);
      client.emit('proxy_bid_success', {
        auctionId: payload.auctionId,
        maxAmount: payload.maxAmount,
        message: 'Automatic proxy bidding activated',
      });
    } catch (err) {
      client.emit('proxy_bid_error', { message: err.message });
    }
  }

  /**
   * Periodic Server-Controlled Clock Synchronization
   */
  broadcastServerTime() {
    this.server?.emit('server_time_sync', {
      serverTime: new Date().toISOString(),
    });
  }
}
