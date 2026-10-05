import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
  HubConnectionState,
} from '@microsoft/signalr';

export type SignalREventCallback = (...args: any[]) => void;

class SignalRService {
  private connection: HubConnection | null = null;
  private listeners: Map<string, Set<SignalREventCallback>> = new Map();
  private isConnecting: boolean = false;

  public async startConnection(): Promise<void> {
    if (typeof window === 'undefined') return;

    const token =
      sessionStorage.getItem('nexus_auth_token') ||
      localStorage.getItem('nexus_auth_token');

    if (!token) {
      return;
    }

    if (
      this.connection &&
      (this.connection.state === HubConnectionState.Connected ||
        this.connection.state === HubConnectionState.Connecting)
    ) {
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.connection = new HubConnectionBuilder()
        .withUrl('/hubs/platform', {
          accessTokenFactory: () =>
            sessionStorage.getItem('nexus_auth_token') ||
            localStorage.getItem('nexus_auth_token') ||
            '',
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(LogLevel.Warning)
        .build();

      // Register standard system handlers
      this.connection.on('UserSuspended', (userId: number, email: string, reason: string) => {
        this.emit('UserSuspended', { userId, email, reason });

        const rawUser = sessionStorage.getItem('nexus_current_user') || localStorage.getItem('nexus_current_user');
        if (rawUser) {
          try {
            const u = JSON.parse(rawUser);
            if (String(u.id) === String(userId) || u.email?.toLowerCase() === email?.toLowerCase()) {
              sessionStorage.removeItem('nexus_auth_token');
              localStorage.removeItem('nexus_auth_token');
              alert(`Session Terminated: ${reason || 'Your account has been suspended by platform administration.'}`);
              window.location.href = '/login';
            }
          } catch {}
        }
      });

      this.connection.on('UserActivated', (userId: number, email: string) => {
        this.emit('UserActivated', { userId, email });
      });

      this.connection.on('TenantSuspended', (tenantId: number, reason: string) => {
        this.emit('TenantSuspended', { tenantId, reason });

        const rawTenant = sessionStorage.getItem('nexus_current_tenant') || localStorage.getItem('nexus_current_tenant');
        if (rawTenant) {
          try {
            const t = JSON.parse(rawTenant);
            if (String(t.id) === String(tenantId)) {
              sessionStorage.removeItem('nexus_auth_token');
              localStorage.removeItem('nexus_auth_token');
              alert(`Organization Suspended: ${reason || 'Your organization account has been suspended.'}`);
              window.location.href = '/login';
            }
          } catch {}
        }
      });

      this.connection.on('TenantActivated', (tenantId: number) => {
        this.emit('TenantActivated', { tenantId });
      });

      this.connection.on('MaintenanceModeToggled', (enabled: boolean, message: string) => {
        this.emit('MaintenanceModeToggled', { enabled, message });
        window.dispatchEvent(
          new CustomEvent('nexus_maintenance_mode', { detail: { enabled, message } })
        );
      });

      this.connection.on('AnnouncementBroadcast', (announcement: any) => {
        this.emit('AnnouncementBroadcast', announcement);
        window.dispatchEvent(
          new CustomEvent('nexus_announcement_broadcast', { detail: announcement })
        );
      });

      this.connection.on('SessionRevoked', (tokenId: string, userId: number) => {
        this.emit('SessionRevoked', { tokenId, userId });
      });

      this.connection.on('PlatformDataUpdated', (entityType: string, action: string) => {
        this.emit('PlatformDataUpdated', { entityType, action });
      });

      await this.connection.start();
    } catch (err) {
      console.warn('SignalR Hub Connection initialization warning:', err);
    } finally {
      this.isConnecting = false;
    }
  }

  public async stopConnection(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch {}
      this.connection = null;
    }
  }

  public on(event: string, callback: SignalREventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(fn => {
        try {
          fn(data);
        } catch (err) {
          console.error(`Error in SignalR listener for ${event}:`, err);
        }
      });
    }
  }
}

export const signalRService = new SignalRService();
