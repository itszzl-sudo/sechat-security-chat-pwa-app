import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import WebSocket from "ws";
import { EventEmitter } from "events";
import { getLogger } from "../../config/logger";
import { BotConfig, SeChatUser, SeChatMessage, ApiResponse, WsEvent } from "../../types";

const logger = getLogger();

/**
 * SeChatClient communicates with the sechat server via REST API and WebSocket.
 * It provides methods to authenticate, send messages, update user roles,
 * and listen for real-time events.
 */
export class SeChatClient extends EventEmitter {
  private config: BotConfig;
  private http: AxiosInstance;
  private ws: WebSocket | null = null;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private authenticated = false;
  private botUserId: string | null = null;
  private shouldReconnect = true;

  // WebSocket event callbacks
  private onMessageCallback: ((message: SeChatMessage) => void) | null = null;
  private onUserStatusCallback: ((data: { userId: string; isOnline: boolean }) => void) | null = null;

  constructor(config: BotConfig) {
    super();
    this.config = config;

    this.http = axios.create({
      baseURL: config.sechatServerUrl,
      timeout: 15_000,
      headers: {
        "Content-Type": "application/json",
        "X-Bot-API-Key": config.sechatBotApiKey,
        "X-Bot-Secret": config.sechatBotSecret,
      },
    });

    // Add response interceptor for logging
    this.http.interceptors.response.use(
      (response) => {
        logger.debug(`REST ${response.config.method?.toUpperCase()} ${response.config.url} -> ${response.status}`);
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error(
            `REST ${error.config?.method?.toUpperCase()} ${error.config?.url} -> ${error.response.status}: ${JSON.stringify(error.response.data)}`
          );
        } else {
          logger.error(`REST request failed: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Initialize the client — authenticates and optionally opens a WebSocket.
   */
  async initialize(): Promise<boolean> {
    try {
      // Authenticate with the bot credentials
      const result = await this.authenticate();
      if (!result) {
        logger.error("SeChat authentication failed");
        return false;
      }
      logger.info(`SeChatClient authenticated as bot user: ${this.botUserId}`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`SeChatClient initialization failed: ${msg}`);
      return false;
    }
  }

  // ─── Authentication ───────────────────────────────────────────────────────

  /**
   * Authenticate with the sechat server using bot API key and secret.
   */
  async authenticate(): Promise<boolean> {
    try {
      const response = await this.http.post<ApiResponse<{ userId: string }>>(
        "/api/bot/auth",
        {
          apiKey: this.config.sechatBotApiKey,
          secret: this.config.sechatBotSecret,
        }
      );

      if (response.data.success && response.data.data) {
        this.authenticated = true;
        this.botUserId = response.data.data.userId;
        return true;
      }

      logger.error(`Bot auth failed: ${response.data.error ?? "Unknown error"}`);
      return false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Bot auth request failed: ${msg}`);
      return false;
    }
  }

  // ─── REST API Methods ─────────────────────────────────────────────────────

  /**
   * Get a sechat user by their username.
   */
  async getUserByUsername(username: string): Promise<SeChatUser | null> {
    try {
      const response = await this.http.get<ApiResponse<SeChatUser>>(
        `/api/users/${encodeURIComponent(username)}`
      );
      return response.data.success ? (response.data.data ?? null) : null;
    } catch (err) {
      logger.error(`Failed to get user ${username}: ${err}`);
      return null;
    }
  }

  /**
   * Get a sechat user by their ID.
   */
  async getUserById(userId: string): Promise<SeChatUser | null> {
    try {
      const response = await this.http.get<ApiResponse<SeChatUser>>(
        `/api/users/id/${userId}`
      );
      return response.data.success ? (response.data.data ?? null) : null;
    } catch (err) {
      logger.error(`Failed to get user by ID ${userId}: ${err}`);
      return null;
    }
  }

  /**
   * Update a user's sponsor role on the sechat server.
   * This is the primary way the bot communicates role changes.
   */
  async setUserSponsorRole(
    userId: string,
    role: string
  ): Promise<boolean> {
    if (!this.authenticated) {
      logger.error("Cannot set sponsor role: not authenticated");
      return false;
    }

    try {
      const response = await this.http.post<ApiResponse<{ success: boolean }>>(
        `/api/bot/users/${userId}/sponsor-role`,
        { role }
      );

      if (response.data.success) {
        logger.info(`Sponsor role updated on sechat: user=${userId}, role=${role}`);
        return true;
      }

      logger.warn(`Failed to update sponsor role: ${response.data.error}`);
      return false;
    } catch (err) {
      logger.error(`Failed to set sponsor role for ${userId}: ${err}`);
      return false;
    }
  }

  /**
   * Send a system message to a chat or user.
   */
  async sendMessage(
    chatId: string,
    content: string,
    contentType: "text" | "system" = "system"
  ): Promise<boolean> {
    if (!this.authenticated) {
      logger.error("Cannot send message: not authenticated");
      return false;
    }

    try {
      const response = await this.http.post<ApiResponse<{ messageId: string }>>(
        `/api/bot/messages`,
        {
          chatId,
          content,
          contentType,
        }
      );

      return response.data.success;
    } catch (err) {
      logger.error(`Failed to send message to ${chatId}: ${err}`);
      return false;
    }
  }

  /**
   * Send a broadcast message to all users (if supported by server).
   */
  async broadcastMessage(
    content: string,
    contentType: "text" | "system" = "system"
  ): Promise<boolean> {
    if (!this.authenticated) return false;

    try {
      const response = await this.http.post<ApiResponse<{ count: number }>>(
        `/api/bot/broadcast`,
        { content, contentType }
      );

      if (response.data.success) {
        logger.info(`Broadcast sent to all users: "${content.substring(0, 50)}..."`);
        return true;
      }
      return false;
    } catch (err) {
      logger.error(`Failed to broadcast message: ${err}`);
      return false;
    }
  }

  /**
   * Register a new sechat user (if the server allows bot registration).
   */
  async registerUser(
    username: string,
    displayName: string,
    sponsorRole?: string
  ): Promise<SeChatUser | null> {
    try {
      const response = await this.http.post<ApiResponse<SeChatUser>>(
        `/api/bot/users/register`,
        { username, displayName, sponsorRole }
      );

      if (response.data.success && response.data.data) {
        logger.info(`User registered via bot: ${username}`);
        return response.data.data;
      }
      return null;
    } catch (err) {
      logger.error(`Failed to register user ${username}: ${err}`);
      return null;
    }
  }

  /**
   * Check if the server is reachable and healthy.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.http.get<ApiResponse<{ status: string }>>(
        "/api/health"
      );
      return response.data.success;
    } catch {
      return false;
    }
  }

  // ─── WebSocket Management ─────────────────────────────────────────────────

  /**
   * Connect to the sechat server WebSocket for real-time events.
   * Automatically reconnects on disconnect.
   */
  connectWebSocket(): void {
    if (this.ws) {
      logger.warn("WebSocket already connected");
      return;
    }

    this.shouldReconnect = true;

    const wsUrl = this.config.sechatServerUrl
      .replace(/^http/, "ws")
      .replace(/\/$/, "");

    const fullUrl = `${wsUrl}/ws/bot?token=${encodeURIComponent(this.config.sechatBotApiKey)}`;

    logger.info(`Connecting WebSocket to ${wsUrl}/ws/bot...`);

    this.ws = new WebSocket(fullUrl);

    this.ws.on("open", () => {
      logger.info("WebSocket connected");
      this.emit("ws:open");
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      try {
        const event: WsEvent = JSON.parse(data.toString());
        this.handleWsEvent(event);
      } catch (err) {
        logger.error(`Failed to parse WebSocket message: ${err}`);
      }
    });

    this.ws.on("close", (code: number, reason: Buffer) => {
      logger.warn(`WebSocket closed: code=${code}, reason=${reason.toString()}`);
      this.ws = null;
      this.emit("ws:close", { code, reason: reason.toString() });
      this.scheduleReconnect();
    });

    this.ws.on("error", (err: Error) => {
      logger.error(`WebSocket error: ${err.message}`);
      this.emit("ws:error", err);
    });
  }

  /**
   * Disconnect the WebSocket.
   */
  disconnectWebSocket(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close(1000, "Bot shutting down");
      this.ws = null;
    }
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
  }

  /**
   * Schedule a WebSocket reconnect with exponential backoff.
   */
  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;

    const delay = 5000; // 5 seconds
    logger.info(`Scheduling WebSocket reconnect in ${delay}ms...`);

    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      if (this.shouldReconnect) {
        this.connectWebSocket();
      }
    }, delay);
  }

  /**
   * Handle an incoming WebSocket event.
   */
  private handleWsEvent(event: WsEvent): void {
    switch (event.type) {
      case "message":
        this.emit("message", event.payload);
        if (this.onMessageCallback) {
          this.onMessageCallback(event.payload as unknown as SeChatMessage);
        }
        break;

      case "user_status":
        this.emit("user_status", event.payload);
        if (this.onUserStatusCallback) {
          this.onUserStatusCallback(event.payload as { userId: string; isOnline: boolean });
        }
        break;

      case "sponsor_update":
        this.emit("sponsor_update", event.payload);
        break;

      case "friend_request":
        this.emit("friend_request", event.payload);
        break;

      case "system":
        this.emit("system", event.payload);
        break;

      default:
        logger.debug(`Unhandled WebSocket event type: ${event.type}`);
    }
  }

  // ─── WebSocket Callback Registration ──────────────────────────────────────

  onMessage(callback: (message: SeChatMessage) => void): void {
    this.onMessageCallback = callback;
  }

  onUserStatus(callback: (data: { userId: string; isOnline: boolean }) => void): void {
    this.onUserStatusCallback = callback;
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /**
   * Check if the client is authenticated.
   */
  get isAuthenticated(): boolean {
    return this.authenticated;
  }

  /**
   * Check if the WebSocket is currently connected.
   */
  get isWebSocketConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get the authenticated bot user ID.
   */
  get botId(): string | null {
    return this.botUserId;
  }
}
