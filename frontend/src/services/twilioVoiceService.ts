import { Device, Call } from '@twilio/voice-sdk';
import { apiClient, ApiResponse } from './apiClient';

export interface VoiceTokenResponse {
  token?: string;
  identity?: string;
  ttlSeconds: number;
  isConfigured: boolean;
}

export interface TwilioVoiceStatus {
  isConfigured: boolean;
  hasAccountSid: boolean;
  hasTwiMLApp: boolean;
  hasCallerNumber: boolean;
  message: string;
}

type IncomingCallListener = (call: Call) => void;
type DeviceStateListener = (state: string, error?: string) => void;

class TwilioVoiceService {
  private device: Device | null = null;
  private currentCall: Call | null = null;
  private isConfigured: boolean = false;
  private isRegistered: boolean = false;
  private lastError: string | null = null;
  private incomingListeners: Set<IncomingCallListener> = new Set();
  private stateListeners: Set<DeviceStateListener> = new Set();
  private initPromise: Promise<boolean> | null = null;

  public getStatus() {
    return {
      isConfigured: this.isConfigured,
      isRegistered: this.isRegistered,
      deviceState: this.device ? this.device.state : 'uninitialized',
      lastError: this.lastError,
    };
  }

  public getCurrentCall(): Call | null {
    return this.currentCall;
  }

  public setCurrentCall(call: Call | null) {
    this.currentCall = call;
  }

  public onIncomingCall(listener: IncomingCallListener): () => void {
    this.incomingListeners.add(listener);
    return () => this.incomingListeners.delete(listener);
  }

  public onDeviceStateChange(listener: DeviceStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyState(state: string, error?: string) {
    this.stateListeners.forEach(listener => {
      try {
        listener(state, error);
      } catch (err) {
        console.error('[TwilioVoice] Error in state listener:', err);
      }
    });
  }

  public async checkBackendStatus(): Promise<TwilioVoiceStatus> {
    try {
      const res = await apiClient.get<ApiResponse<TwilioVoiceStatus>>('/voice/status');
      if (res && res.data) {
        this.isConfigured = res.data.isConfigured;
        return res.data;
      }
      return {
        isConfigured: false,
        hasAccountSid: false,
        hasTwiMLApp: false,
        hasCallerNumber: false,
        message: 'Unable to verify Twilio status from backend.',
      };
    } catch (err: any) {
      this.isConfigured = false;
      this.lastError = err.message || 'Twilio status check failed';
      return {
        isConfigured: false,
        hasAccountSid: false,
        hasTwiMLApp: false,
        hasCallerNumber: false,
        message: err.message || 'Twilio status check failed',
      };
    }
  }

  public async initializeDevice(): Promise<{ success: boolean; isConfigured: boolean; error?: string }> {
    if (this.initPromise) {
      const ok = await this.initPromise;
      return {
        success: ok,
        isConfigured: this.isConfigured,
        error: this.lastError || undefined,
      };
    }

    this.initPromise = (async () => {
      try {
        // Fetch short-lived token from backend
        const tokenRes = await apiClient.get<ApiResponse<VoiceTokenResponse>>('/voice/token');
        if (!tokenRes.success || !tokenRes.data || !tokenRes.data.isConfigured || !tokenRes.data.token) {
          this.isConfigured = false;
          this.isRegistered = false;
          this.lastError = tokenRes.message || 'Twilio Programmable Voice is not configured on the backend server.';
          this.notifyState('unconfigured', this.lastError);
          return false;
        }

        this.isConfigured = true;
        const jwtToken = tokenRes.data.token;

        // If device exists, update token; otherwise create new Device
        if (this.device) {
          await this.device.updateToken(jwtToken);
          this.isRegistered = true;
          this.lastError = null;
          this.notifyState('registered');
          return true;
        }

        const device = new Device(jwtToken, {
          logLevel: 1,
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        });

        device.on('registered', () => {
          this.isRegistered = true;
          this.lastError = null;
          console.log('[TwilioVoice] Device registered for agent:', tokenRes.data.identity);
          this.notifyState('registered');
        });

        device.on('unregistered', () => {
          this.isRegistered = false;
          console.log('[TwilioVoice] Device unregistered');
          this.notifyState('unregistered');
        });

        device.on('error', (twError: any) => {
          console.error('[TwilioVoice] Device error:', twError);
          const errorMsg = twError?.message || 'Twilio Device encountered an error.';
          this.lastError = errorMsg;
          this.notifyState('error', errorMsg);
        });

        device.on('tokenWillExpire', async () => {
          console.log('[TwilioVoice] Token will expire, refreshing...');
          try {
            const refreshRes = await apiClient.get<ApiResponse<VoiceTokenResponse>>('/voice/token');
            if (refreshRes.success && refreshRes.data?.token) {
              await device.updateToken(refreshRes.data.token);
              console.log('[TwilioVoice] Token refreshed successfully');
            }
          } catch (refreshErr) {
            console.error('[TwilioVoice] Failed to refresh token:', refreshErr);
          }
        });

        device.on('incoming', (call: Call) => {
          console.log('[TwilioVoice] Incoming call from:', call.parameters.From);
          this.currentCall = call;
          this.incomingListeners.forEach(listener => {
            try {
              listener(call);
            } catch (err) {
              console.error('[TwilioVoice] Error in incoming listener:', err);
            }
          });
        });

        await device.register();
        this.device = device;
        this.isRegistered = true;
        this.lastError = null;
        return true;
      } catch (err: any) {
        console.error('[TwilioVoice] Device initialization failed:', err);
        this.isRegistered = false;
        this.lastError = err.message || 'Failed to initialize Twilio Voice Device.';
        this.notifyState('error', this.lastError || undefined);
        return false;
      } finally {
        this.initPromise = null;
      }
    })();

    const success = await this.initPromise;
    return {
      success,
      isConfigured: this.isConfigured,
      error: this.lastError || undefined,
    };
  }

  public async makeCall(toPhoneNumber: string, customParams?: Record<string, string>): Promise<Call> {
    if (!this.device) {
      const initResult = await this.initializeDevice();
      if (!initResult.success || !this.device) {
        throw new Error(
          initResult.error ||
          'Twilio Voice is not configured or ready. Telephony provider credentials (Account SID, API Key, TwiML App) must be set in backend options.'
        );
      }
    }

    if (!this.isRegistered && this.device.state !== 'registered') {
      try {
        await this.device.register();
      } catch (regErr: any) {
        throw new Error(`Twilio Device registration failed: ${regErr.message || regErr}`);
      }
    }

    const params: Record<string, string> = {
      To: toPhoneNumber,
      ...(customParams || {}),
    };

    try {
      const call = await this.device.connect({ params });
      this.currentCall = call;
      return call;
    } catch (err: any) {
      console.error('[TwilioVoice] device.connect failed:', err);
      throw new Error(err.message || 'Failed to initiate outbound Twilio call.');
    }
  }

  public destroy() {
    if (this.currentCall) {
      try {
        this.currentCall.disconnect();
      } catch {}
      this.currentCall = null;
    }
    if (this.device) {
      try {
        this.device.unregister();
        this.device.destroy();
      } catch {}
      this.device = null;
    }
    this.isRegistered = false;
    this.incomingListeners.clear();
    this.stateListeners.clear();
  }
}

export const twilioVoiceService = new TwilioVoiceService();
