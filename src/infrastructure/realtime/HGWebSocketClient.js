/**
 * WebSocket 客户端
 * 职责：建立与 Go 后端的 WebSocket 连接，提供指数退避自动重连与代际（generation）控制。
 * 关键约束：
 * 1. 浏览器原生 WebSocket 不允许自定义 Authorization Header，认证应使用安全 Cookie
 *    或短期连接票据，不得把长期 Token 放入 URL；
 * 2. 生产环境需补充心跳、网络恢复监听、认证过期处理与重连随机抖动；
 * 3. 如使用 Centrifugo，须遵循其协议，不能直接假设自定义 JSON 信封即为原始帧。
 */

export class HGWebSocketClient {
  constructor({ url, onMessage, onReconnect }) {
    this.url = url;
    this.onMessage = onMessage;
    this.onReconnect = onReconnect;

    this.socket = null;
    this.timer = null;
    this.retryCount = 0;
    this.stopped = true;
    // 代际计数：disconnect / 重连时递增，旧代际的回调全部失效，防止串线
    this.generation = 0;
  }

  // 建立连接并启用自动重连
  connect() {
    this.stopped = false;
    this.generation += 1;

    const generation = this.generation;
    this.open(generation);
  }

  // 内部建立单个连接；仅当前代际的连接会被处理
  open(generation) {
    if (this.stopped || generation !== this.generation) {
      return;
    }

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      if (generation !== this.generation) return;

      const wasReconnect = this.retryCount > 0;
      this.retryCount = 0;

      // 重连成功后通知上层执行增量同步，补偿断线期间丢失的消息
      if (wasReconnect) {
        this.onReconnect?.();
      }
    };

    socket.onmessage = (event) => {
      if (generation !== this.generation) return;

      try {
        const data = JSON.parse(event.data);
        Promise.resolve(this.onMessage?.(data)).catch(console.error);
      } catch (error) {
        console.error("[HGWebSocketClient] 消息解析失败", error);
      }
    };

    socket.onclose = () => {
      if (this.stopped || generation !== this.generation) {
        return;
      }

      // 指数退避重连，上限 30 秒
      const delay = Math.min(1000 * (2 ** this.retryCount), 30000);
      this.retryCount = Math.min(this.retryCount + 1, 10);

      this.timer = setTimeout(() => {
        this.open(generation);
      }, delay);
    };

    socket.onerror = () => {
      // 错误处理与重连统一交给 onclose
    };
  }

  // 断开连接并停止重连；递增代际使旧连接回调失效
  disconnect() {
    this.stopped = true;
    this.generation += 1;

    clearTimeout(this.timer);
    this.timer = null;

    this.socket?.close();
    this.socket = null;
  }
}
