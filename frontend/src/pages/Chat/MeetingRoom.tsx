import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  Users,
  Maximize2,
  Minimize2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { ChatMember } from '../../types';

interface Participant {
  id: string;
  name: string;
  avatarUrl?: string;
  roleName?: string;
}

interface MeetingRoomProps {
  meetingId: string;
  participants: Participant[];
  callMode?: 'video' | 'audio';
  me: ChatMember;
  onClose: () => void;
  onCallEnded?: (durationStr: string) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  meetingId,
  participants,
  callMode = 'video',
  me,
  onClose,
  onCallEnded,
}) => {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callMode !== 'audio');
  const [screenSharing, setScreenSharing] = useState(false);
  const [activeParticipants, setActiveParticipants] = useState<Participant[]>(() => {
    const list = [...participants];
    if (!list.some(p => p.id === me.id)) {
      list.push({ id: me.id, name: me.name, roleName: me.roleName });
    }
    return list;
  });
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [error, setError] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

  interface PeerState {
    makingOffer: boolean;
    ignoreOffer: boolean;
  }
  const peerStates = useRef<Record<string, PeerState>>({});
  const pendingCandidates = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const [mediaReady, setMediaReady] = useState(false);

  // Timer counter
  useEffect(() => {
    const timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isPolite = useCallback((targetUserId: string) => {
    return (me.id || '') > targetUserId;
  }, [me.id]);

  const drainCandidates = useCallback(async (targetUserId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidates.current[targetUserId] || [];
    delete pendingCandidates.current[targetUserId];
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('[WebRTC] Queued candidate error:', err);
      }
    }
  }, []);

  const createPeerConnection = useCallback((targetUserId: string) => {
    if (peerConnections.current[targetUserId]) {
      return peerConnections.current[targetUserId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[targetUserId] = pc;
    peerStates.current[targetUserId] = { makingOffer: false, ignoreOffer: false };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStreams(prev => ({ ...prev, [targetUserId]: stream }));
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && (window as any).nexusChatSocket) {
        (window as any).nexusChatSocket.emit('webrtc:ice-candidate', {
          meetingId,
          candidate: event.candidate,
          to: targetUserId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[targetUserId];
          return next;
        });
      }
    };

    return pc;
  }, [meetingId]);

  // Acquire local media
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callMode !== 'audio',
          audio: true,
        });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        Object.values(peerConnections.current).forEach(pc => {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
        });
        setMediaReady(true);
      } catch (err) {
        console.warn('Camera/Mic permission failed:', err);
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          if (!mounted) {
            audioOnly.getTracks().forEach(t => t.stop());
            return;
          }
          localStreamRef.current = audioOnly;
          setCamOn(false);
          setMediaReady(true);
        } catch {
          if (!mounted) return;
          setError('Microphone access is unavailable or denied. Participating in listen-only mode.');
          setMicOn(false);
          setCamOn(false);
          setMediaReady(true);
        }
      }
    })();

    return () => {
      mounted = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peerConnections.current).forEach(pc => pc.close());
    };
  }, [callMode]);

  // Socket event binding if socket exists
  useEffect(() => {
    const socket = (window as any).nexusChatSocket;
    if (!socket || !mediaReady) return;

    socket.emit('meeting:join', meetingId);

    const onParticipantJoined = (data: { userId: string; name: string }) => {
      setActiveParticipants(prev => {
        if (prev.some(p => p.id === data.userId)) return prev;
        return [...prev, { id: data.userId, name: data.name }];
      });
      if (data.userId !== me.id) {
        createPeerConnection(data.userId);
      }
    };

    const onParticipantLeft = (data: { userId: string }) => {
      setActiveParticipants(prev => prev.filter(p => p.id !== data.userId));
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
    };

    socket.on('meeting:participant_joined', onParticipantJoined);
    socket.on('meeting:participant_left', onParticipantLeft);

    return () => {
      socket.off('meeting:participant_joined', onParticipantJoined);
      socket.off('meeting:participant_left', onParticipantLeft);
    };
  }, [meetingId, mediaReady, me.id, createPeerConnection]);

  // Controls
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const next = !micOn;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = next; });
    setMicOn(next);
  };

  const toggleCam = async () => {
    if (!localStreamRef.current) return;
    const next = !camOn;
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = next; });
    setCamOn(next);
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        setScreenSharing(true);

        screenTrack.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.warn('Screen share canceled or failed', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    Object.values(peerConnections.current).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender && camTrack) sender.replaceTrack(camTrack);
    });
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setScreenSharing(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleEndCall = () => {
    const durationStr = formatDuration(callDuration);
    onCallEnded?.(durationStr);
    onClose();
  };

  const remoteParticipants = activeParticipants.filter(p => p.id !== me.id);

  return (
    <div ref={containerRef} className="meeting-room-overlay">
      {/* Top Header Bar */}
      <div className="meeting-header-bar">
        <div className="meeting-title-box">
          <div className="meeting-brand-pill">
            <span className="meeting-pulse-indicator" />
            <span className="meeting-brand-text">NexusLive Meeting</span>
          </div>
          <span className="meeting-mode-badge">{callMode === 'video' ? 'Video Conference' : 'Audio Call'}</span>
        </div>

        <div className="meeting-timer-box">
          <Clock size={14} style={{ color: 'var(--primary-400)' }} />
          <span>{formatDuration(callDuration)}</span>
        </div>

        <div className="meeting-header-actions">
          <button
            type="button"
            className={`meeting-hdr-btn ${showParticipantsDrawer ? 'active' : ''}`}
            title="Toggle Participants"
            onClick={() => setShowParticipantsDrawer(prev => !prev)}
          >
            <Users size={16} />
            <span className="meeting-part-count">{activeParticipants.length}</span>
          </button>
          <button
            type="button"
            className="meeting-hdr-btn"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="meeting-alert-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Video Grid Canvas */}
      <div className="meeting-grid-canvas">
        {/* Local Participant Tile */}
        <div className="meeting-video-tile local">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`meeting-video-feed ${!camOn && !screenSharing ? 'hidden' : ''}`}
          />
          {(!camOn && !screenSharing) && (
            <div className="meeting-avatar-placeholder">
              <div className="meeting-voice-ring" />
              <div className="meeting-avatar-circle">{initials(me.name)}</div>
              <div className="meeting-avatar-name">{me.name} (You)</div>
            </div>
          )}
          <div className="meeting-tile-caption">
            <span>{me.name} (You)</span>
            {!micOn && <MicOff size={13} className="meeting-tile-muted" />}
          </div>
        </div>

        {/* Remote Participant Tiles */}
        {remoteParticipants.length === 0 && (
          <div className="meeting-waiting-tile">
            <div className="meeting-waiting-ring" />
            <div className="meeting-waiting-text">Waiting for other participants to join…</div>
            <div className="meeting-waiting-sub">Room ID: {meetingId}</div>
          </div>
        )}

        {remoteParticipants.map(part => {
          const stream = remoteStreams[part.id];
          return (
            <div key={part.id} className="meeting-video-tile remote">
              {stream ? (
                <video
                  autoPlay
                  playsInline
                  ref={el => { if (el && stream) el.srcObject = stream; }}
                  className="meeting-video-feed"
                />
              ) : (
                <div className="meeting-avatar-placeholder">
                  <div className="meeting-voice-ring" />
                  <div className="meeting-avatar-circle">{initials(part.name)}</div>
                  <div className="meeting-avatar-name">{part.name}</div>
                  <div className="meeting-avatar-role">{part.roleName || 'Team Member'}</div>
                </div>
              )}
              <div className="meeting-tile-caption">
                <span>{part.name}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Participants Drawer */}
      {showParticipantsDrawer && (
        <div className="meeting-side-drawer">
          <div className="meeting-drawer-header">
            <h4>In This Call ({activeParticipants.length})</h4>
            <button type="button" className="btn-close-sm" onClick={() => setShowParticipantsDrawer(false)}>×</button>
          </div>
          <div className="meeting-drawer-list">
            {activeParticipants.map(p => (
              <div key={p.id} className="meeting-drawer-item">
                <div className="meeting-drawer-avatar">{initials(p.name)}</div>
                <div className="meeting-drawer-info">
                  <div className="meeting-drawer-name">{p.name} {p.id === me.id ? '(You)' : ''}</div>
                  <div className="meeting-drawer-sub">{p.roleName || 'Member'}</div>
                </div>
                {p.id === me.id && !micOn && <MicOff size={14} style={{ color: 'var(--danger-500)' }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Control Bar */}
      <div className="meeting-controls-floating">
        <button
          type="button"
          className={`meeting-ctrl-btn ${!micOn ? 'danger' : ''}`}
          onClick={toggleMic}
          title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          <span>{micOn ? 'Mute' : 'Unmuted'}</span>
        </button>

        <button
          type="button"
          className={`meeting-ctrl-btn ${!camOn ? 'danger' : ''}`}
          onClick={toggleCam}
          title={camOn ? 'Turn Camera Off' : 'Turn Camera On'}
        >
          {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          <span>{camOn ? 'Stop Video' : 'Start Video'}</span>
        </button>

        <button
          type="button"
          className={`meeting-ctrl-btn ${screenSharing ? 'active' : ''}`}
          onClick={toggleScreenShare}
          title={screenSharing ? 'Stop Screen Sharing' : 'Share Your Screen'}
        >
          <ScreenShare size={20} />
          <span>{screenSharing ? 'Stop Share' : 'Share Screen'}</span>
        </button>

        <button
          type="button"
          className="meeting-ctrl-btn leave-call"
          onClick={handleEndCall}
          title="Leave or End Call"
        >
          <PhoneOff size={20} />
          <span>Leave Call</span>
        </button>
      </div>
    </div>
  );
};
