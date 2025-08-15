import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  position: relative;
  overflow: hidden;
`;

const VideoContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  gap: 2px;
  padding: 10px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }

  @media screen and (max-width: 768px) and (orientation: landscape) {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr;
  }
`;

const VideoWrapper = styled.div`
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  min-height: 200px;
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
  background: #000;
  -webkit-playsinline: true;
  -moz-playsinline: true;
  playsinline: true;
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
`;

const VideoLabel = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(10px);
  z-index: 10;
`;

const ConnectionStatus = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  background: ${props => {
    if (props.status === 'connected') return 'rgba(34, 197, 94, 0.9)';
    if (props.status === 'connecting') return 'rgba(251, 191, 36, 0.9)';
    return 'rgba(239, 68, 68, 0.9)';
  }};
  color: white;
  padding: 8px 16px;
  border-radius: 25px;
  font-size: 14px;
  font-weight: 600;
  backdrop-filter: blur(10px);
  z-index: 1000;
  max-width: 200px;
  text-align: center;

  @media (max-width: 480px) {
    font-size: 12px;
    padding: 6px 12px;
    max-width: 150px;
  }
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  gap: 16px;
  flex-wrap: wrap;
  min-height: 80px;

  @media (max-width: 480px) {
    padding: 15px;
    gap: 12px;
  }
`;

const ControlButton = styled.button`
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  touch-action: manipulation;
  position: relative;

  @media (max-width: 480px) {
    width: 48px;
    height: 48px;
    font-size: 18px;
  }

  &.primary {
    background: linear-gradient(45deg, #ef4444, #dc2626);
    color: white;
    box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(239, 68, 68, 0.5);
    }
  }

  &.secondary {
    background: linear-gradient(45deg, #10b981, #059669);
    color: white;
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5);
    }
  }

  &.control {
    background: ${props => props.active
      ? 'linear-gradient(45deg, #6366f1, #4f46e5)'
      : 'rgba(255, 255, 255, 0.2)'};
    color: white;
    border: 2px solid ${props => props.active ? '#6366f1' : 'rgba(255, 255, 255, 0.3)'};

    &:hover:not(:disabled) {
      background: ${props => props.active
        ? 'linear-gradient(45deg, #4f46e5, #4338ca)'
        : 'rgba(255, 255, 255, 0.3)'};
      transform: translateY(-1px);
    }
  }

  &.report {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border: 2px solid rgba(239, 68, 68, 0.6);

    &:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.3);
      transform: translateY(-1px);
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  &:active {
    transform: scale(0.95);
  }
`;

const PlaceholderMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  font-weight: 500;
  padding: 20px;

  @media (max-width: 480px) {
    font-size: 16px;
    padding: 15px;
  }
`;

const ErrorMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #ef4444;
  font-size: 16px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 12px;
  max-width: 300px;
  z-index: 1001;

  button {
    margin-top: 15px;
    padding: 10px 20px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;

    &:hover {
      background: #dc2626;
    }
  }
`;

const ReportModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1002;
  padding: 20px;
`;

const ReportContent = styled.div`
  background: white;
  padding: 30px;
  border-radius: 16px;
  max-width: 400px;
  width: 100%;
  text-align: center;
  color: #333;

  h3 {
    margin-bottom: 20px;
    color: #ef4444;
  }

  select, button {
    width: 100%;
    padding: 12px;
    margin: 8px 0;
    border-radius: 8px;
    border: 2px solid #e5e5e5;
    font-size: 16px;
  }

  button.submit {
    background: #ef4444;
    color: white;
    border: 2px solid #ef4444;
    font-weight: 600;

    &:hover {
      background: #dc2626;
    }
  }

  button.cancel {
    background: #6b7280;
    color: white;
    border: 2px solid #6b7280;

    &:hover {
      background: #4b5563;
    }
  }
`;

const StatsOverlay = styled.div`
  position: absolute;
  top: 70px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  font-family: monospace;
  z-index: 100;
  min-width: 200px;

  .stat-row {
    display: flex;
    justify-content: space-between;
    margin: 4px 0;
  }

  @media (max-width: 480px) {
    display: none;
  }
`;

const DebugPanel = styled.div`
  position: fixed;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px;
  border-radius: 5px;
  font-size: 12px;
  z-index: 1000;
  max-width: 300px;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://omegle-clone-backend-production-8f06.up.railway.app';

// Enhanced ICE servers with multiple STUN/TURN servers
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.nextcloud.com:443' },
  { urls: 'stun:stun.sipgate.net:3478' },
  { urls: 'stun:stun.12voip.com:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:relay1.expressturn.com:3478',
    username: 'ef4IKQP7KOQC8QJZFR',
    credential: 'tWIcqVHfT8eDis7P'
  }
];

const VideoChat = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerConnectionRef = useRef();
  const connectionTimeoutRef = useRef();
  const reconnectTimeoutRef = useRef();

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('initializing');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [connectionStats, setConnectionStats] = useState({
    bytesReceived: 0,
    bytesSent: 0,
    packetsLost: 0,
    quality: 'good'
  });
  const [showStats, setShowStats] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    localStreamTracks: 0,
    remoteStreamTracks: 0,
    iceConnectionState: 'new',
    connectionState: 'new',
    signalingState: 'stable',
    iceGatheringState: 'new',
    lastError: null
  });

  // Enhanced getUserMedia with fallback options
  const getUserMedia = useCallback(async () => {
    const constraints = {
      video: {
        width: { min: 320, ideal: 640, max: 1280 },
        height: { min: 240, ideal: 480, max: 720 },
        frameRate: { min: 10, ideal: 24, max: 30 },
        facingMode: 'user'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 44100 }
      }
    };

    try {
      console.log('[MEDIA] Requesting media access with constraints:', constraints);
      setConnectionStatus('Requesting camera/microphone access...');

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[SUCCESS] Media access granted, tracks:', stream.getTracks().map(t => `${t.kind}: ${t.enabled}`));

      setLocalStream(stream);
      setError(null);

      setDebugInfo(prev => ({
        ...prev,
        localStreamTracks: stream.getTracks().length
      }));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.onloadedmetadata = () => {
          localVideoRef.current.play().catch(e => {
            console.error('[ERROR] Local video play failed:', e);
          });
        };
      }

      console.log('[SUCCESS] Local video stream set');
      return stream;
    } catch (error) {
      console.error('[ERROR] Media access failed:', error);
      setDebugInfo(prev => ({
        ...prev,
        lastError: `Media access failed: ${error.message}`
      }));

      // Try with progressively simpler constraints
      const fallbackConstraints = [
        { video: { width: 640, height: 480 }, audio: true },
        { video: { width: 320, height: 240 }, audio: true },
        { video: true, audio: true },
        { video: false, audio: true }
      ];

      for (let i = 0; i < fallbackConstraints.length; i++) {
        try {
          console.log(`[FALLBACK] Trying fallback ${i + 1}:`, fallbackConstraints[i]);
          const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints[i]);
          console.log('[SUCCESS] Fallback media access granted');

          setLocalStream(stream);
          setError(null);

          setDebugInfo(prev => ({
            ...prev,
            localStreamTracks: stream.getTracks().length,
            lastError: `Fallback ${i + 1} successful`
          }));

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.onloadedmetadata = () => {
              localVideoRef.current.play().catch(console.error);
            };
          }

          return stream;
        } catch (fallbackError) {
          console.log(`[FALLBACK] Fallback ${i + 1} failed:`, fallbackError.message);
        }
      }

      // All fallbacks failed
      let errorMessage = 'Camera/microphone access failed. ';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone access denied. Please allow access and refresh the page.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera/microphone found. Please connect a device and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera/microphone is already in use by another application.';
      }

      setError(errorMessage);
      setConnectionStatus('Media access failed');
      throw error;
    }
  }, []);

  // Create peer connection with enhanced configuration
  const createPeerConnection = useCallback(() => {
    const config = {
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all',
      sdpSemantics: 'unified-plan'
    };

    const pc = new RTCPeerConnection(config);

    const candidateBuffer = [];
    let remoteDescriptionSet = false;

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.connected) {
        console.log('[WEBRTC] Sending ICE candidate:', event.candidate.candidate);
        socketRef.current.emit('ice-candidate', event.candidate);
      } else if (!event.candidate) {
        console.log('[WEBRTC] ICE gathering complete');
      }
    };

    pc.ontrack = (event) => {
      console.log('[WEBRTC] Received remote stream, tracks:', event.streams[0].getTracks().length);
      const [stream] = event.streams;

      if (stream.getTracks().length === 0) {
        console.error('[ERROR] Remote stream has no tracks');
        return;
      }

      setRemoteStream(stream);
      setDebugInfo(prev => ({
        ...prev,
        remoteStreamTracks: stream.getTracks().length
      }));

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.onloadedmetadata = () => {
          remoteVideoRef.current.play().catch(e => {
            console.error('[ERROR] Remote video play failed:', e);
          });
        };
      }

      setConnectionStatus('Connected');
      setIsConnecting(false);
      clearTimeout(connectionTimeoutRef.current);

      monitorConnectionQuality(pc);
    };

    pc.onconnectionstatechange = () => {
      console.log('[WEBRTC] Connection state:', pc.connectionState);
      setDebugInfo(prev => ({
        ...prev,
        connectionState: pc.connectionState
      }));

      switch (pc.connectionState) {
        case 'connected':
          console.log('[SUCCESS] WebRTC connection established!');
          setConnectionStatus('Connected');
          setIsConnecting(false);
          setRetryCount(0);
          clearTimeout(connectionTimeoutRef.current);
          break;
        case 'connecting':
          console.log('[WEBRTC] WebRTC connecting...');
          setConnectionStatus('Establishing connection...');
          setIsConnecting(true);
          
          connectionTimeoutRef.current = setTimeout(() => {
            if (pc.connectionState === 'connecting') {
              console.log('[TIMEOUT] WebRTC connection timeout, retrying...');
              pc.close();
              setTimeout(() => {
                if (retryCount < 5) {
                  setRetryCount(prev => prev + 1);
                  findPartner();
                } else {
                  setConnectionStatus('Connection failed. Please refresh and try again.');
                }
              }, 2000);
            }
          }, 15000);
          break;
        case 'disconnected':
          console.log('[WEBRTC] Connection disconnected');
          setConnectionStatus('Partner disconnected');
          setIsConnecting(false);
          setTimeout(() => findPartner(), 3000);
          break;
        case 'failed':
          console.log('[ERROR] WebRTC connection failed, attempting recovery...');
          setConnectionStatus('Connection failed - retrying...');
          setIsConnecting(false);
          pc.close();

          if (retryCount < 5) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              console.log(`[RETRY] Retry attempt ${retryCount + 1}/5`);
              findPartner();
            }, 2000);
          } else {
            setConnectionStatus('Connection failed after multiple attempts. Please refresh.');
            setError('Unable to establish connection. Please refresh the page.');
          }
          break;
        case 'closed':
          console.log('[WEBRTC] Connection closed');
          break;
        default:
          console.log('[WEBRTC] Unknown connection state:', pc.connectionState);
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WEBRTC] ICE connection state:', pc.iceConnectionState);
      setDebugInfo(prev => ({
        ...prev,
        iceConnectionState: pc.iceConnectionState
      }));

      switch (pc.iceConnectionState) {
        case 'connected':
        case 'completed':
          console.log('[SUCCESS] ICE connection established!');
          setRetryCount(0);
          break;
        case 'disconnected':
          console.log('[WARNING] ICE connection disconnected');
          setConnectionStatus('Connection unstable...');
          break;
        case 'failed':
          console.log('[ERROR] ICE connection failed');
          if (retryCount < 3) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              nextPartner();
            }, 2000);
          }
          break;
        case 'checking':
          console.log('[INFO] ICE connectivity checks in progress...');
          setConnectionStatus('Checking connectivity...');
          break;
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('[WEBRTC] ICE gathering state:', pc.iceGatheringState);
      setDebugInfo(prev => ({
        ...prev,
        iceGatheringState: pc.iceGatheringState
      }));
    };

    pc.onsignalingstatechange = () => {
      console.log('[WEBRTC] Signaling state:', pc.signalingState);
      setDebugInfo(prev => ({
        ...prev,
        signalingState: pc.signalingState
      }));
      
      if (pc.signalingState === 'stable') {
        remoteDescriptionSet = true;
        candidateBuffer.forEach(candidate => {
          pc.addIceCandidate(candidate).catch(console.error);
        });
        candidateBuffer.length = 0;
      }
    };

    return pc;
  }, [retryCount]);

  // Monitor connection quality
  const monitorConnectionQuality = useCallback((pc) => {
    if (!pc) return;

    const interval = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        let bytesReceived = 0;
        let bytesSent = 0;
        let packetsLost = 0;

        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
            bytesReceived = report.bytesReceived || 0;
            packetsLost = report.packetsLost || 0;
          }
          if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
            bytesSent = report.bytesSent || 0;
          }
        });

        const quality = packetsLost > 100 ? 'poor' : packetsLost > 30 ? 'good' : 'excellent';

        setConnectionStats({
          bytesReceived,
          bytesSent,
          packetsLost,
          quality
        });
      } catch (error) {
        console.log('[STATS] Error getting connection stats:', error);
      }
    }, 5000);

    setTimeout(() => clearInterval(interval), 60000);
  }, []);

  // Initialize socket connection with retry logic
  const initializeSocket = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    console.log('[SOCKET] Connecting to signaling server...');
    setConnectionStatus('Connecting to server...');

    socketRef.current = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socketRef.current.on('connect', () => {
      console.log('[SUCCESS] Connected to signaling server');
      setConnectionStatus('Connected to server');
      setError(null);
      setRetryCount(0);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('[DISCONNECT] Disconnected from signaling server:', reason);
      setConnectionStatus('Disconnected from server');
      if (reason === 'io server disconnect') {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[RECONNECT] Attempting to reconnect...');
          initializeSocket();
        }, 3000);
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('[ERROR] Connection error:', error);
      setConnectionStatus('Server connection failed');
      setError('Failed to connect to server. Retrying...');
      
      setTimeout(() => {
        if (retryCount < 5) {
          setRetryCount(prev => prev + 1);
          initializeSocket();
        } else {
          setError('Unable to connect to server. Please check your internet connection.');
        }
      }, 3000);
    });

    // Enhanced matched handler
    socketRef.current.on('matched', (matchData) => {
      console.log('[MATCH] Partner matched:', matchData);
      setConnectionStatus('Partner found! Preparing connection...');
      setIsConnecting(true);

      setTimeout(() => {
        console.log('[WEBRTC] Initiating WebRTC connection...');
        initiateCall();
      }, 1500);
    });

    // Handle waiting for partner
    socketRef.current.on('waiting', () => {
      setConnectionStatus('Looking for partner...');
      setIsConnecting(false);
    });

    // Enhanced offer handler
    socketRef.current.on('offer', async (offer) => {
      console.log('[WEBRTC] Received offer:', offer);
      console.log('[WEBRTC] Offer SDP preview:', offer.sdp?.substring(0, 100) + '...');

      setConnectionStatus('Incoming call... Setting up connection...');
      setIsConnecting(true);

      try {
        await handleOffer(offer);
      } catch (error) {
        console.error('[ERROR] Failed to handle offer:', error);
        setDebugInfo(prev => ({
          ...prev,
          lastError: `Offer handling failed: ${error.message}`
        }));
      }
    });

    // Enhanced answer handler
    socketRef.current.on('answer', async (answer) => {
      console.log('[WEBRTC] Received answer:', answer);
      console.log('[WEBRTC] Answer SDP preview:', answer.sdp?.substring(0, 100) + '...');

      try {
        await handleAnswer(answer);
      } catch (error) {
        console.error('[ERROR] Failed to handle answer:', error);
        setDebugInfo(prev => ({
          ...prev,
          lastError: `Answer handling failed: ${error.message}`
        }));
      }
    });

    // Enhanced ICE candidate handler
    socketRef.current.on('ice-candidate', async (candidate) => {
      console.log('[WEBRTC] Received ICE candidate:', candidate?.candidate?.substring(0, 50) + '...');

      try {
        await handleIceCandidate(candidate);
      } catch (error) {
        console.error('[ERROR] Failed to handle ICE candidate:', error);
      }
    });

    // Handle partner disconnect
    socketRef.current.on('partnerDisconnected', () => {
      console.log('[PARTNER] Partner disconnected');
      setConnectionStatus('Partner disconnected');
      setRemoteStream(null);
      setIsConnecting(false);
      clearTimeout(connectionTimeoutRef.current);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      setTimeout(() => {
        findPartner();
      }, 2000);
    });

    // Handle user being reported
    socketRef.current.on('reported', (data) => {
      console.log('[REPORTED] You have been reported:', data);
      setError(`You have been reported for: ${data.reason}. Connection will be terminated.`);
      setTimeout(() => {
        navigate('/');
      }, 5000);
    });

    // Handle user being banned
    socketRef.current.on('banned', (data) => {
      console.log('[BANNED] User banned:', data);
      setError('You have been banned from the service due to multiple reports.');
      setTimeout(() => {
        navigate('/');
      }, 3000);
    });

    // Handle report received confirmation
    socketRef.current.on('reportReceived', (data) => {
      console.log('[REPORT] Report received:', data);
      setShowReportModal(false);
      setConnectionStatus('Report submitted. Finding new partner...');
      setTimeout(() => findPartner(), 2000);
    });

    // Handle errors
    socketRef.current.on('error', (error) => {
      console.error('[ERROR] Socket error:', error);
      setError(error.message || 'Connection error occurred');
    });

    // Handle timeout
    socketRef.current.on('timeout', (data) => {
      console.log('[TIMEOUT] Connection timeout:', data);
      setError('Connection timeout. Please refresh and try again.');
    });
  }, [retryCount]);

  // Initiate a call (create offer)
  const initiateCall = useCallback(async () => {
    if (!localStream || !socketRef.current?.connected) {
      console.log('[ERROR] Cannot initiate call: missing stream or socket');
      return;
    }

    try {
      console.log('[WEBRTC] Initiating call...');
      peerConnectionRef.current = createPeerConnection();

      // Add local stream tracks
      localStream.getTracks().forEach(track => {
        console.log('[WEBRTC] Adding local track:', track.kind, track.enabled);
        peerConnectionRef.current.addTrack(track, localStream);
      });

      // Create offer with specific constraints
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: false
      });

      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('[SUCCESS] Local description set (offer)');

      if (socketRef.current?.connected) {
        socketRef.current.emit('offer', offer);
        console.log('[WEBRTC] Offer sent to partner');
      }

    } catch (error) {
      console.error('[ERROR] Failed to initiate call:', error);
      setConnectionStatus('Failed to initiate call');
      setTimeout(() => nextPartner(), 2000);
    }
  }, [localStream, createPeerConnection]);

  // Handle incoming offer
  const handleOffer = useCallback(async (offer) => {
    if (!localStream) {
      console.error('[ERROR] Cannot handle offer: missing local stream');
      return;
    }

    try {
      console.log('[WEBRTC] Handling incoming offer...');
      peerConnectionRef.current = createPeerConnection();

      // Add local stream tracks first
      localStream.getTracks().forEach(track => {
        console.log('[WEBRTC] Adding local track:', track.kind, track.enabled);
        peerConnectionRef.current.addTrack(track, localStream);
      });

      // Set remote description
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[SUCCESS] Remote description set');

      // Create and send answer with specific constraints
      const answer = await peerConnectionRef.current.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await peerConnectionRef.current.setLocalDescription(answer);
      console.log('[SUCCESS] Local description set (answer)');

      if (socketRef.current?.connected) {
        socketRef.current.emit('answer', answer);
        console.log('[WEBRTC] Answer sent to partner');
      }

    } catch (error) {
      console.error('[ERROR] Failed to handle offer:', error);
      setConnectionStatus('Failed to connect');
      setTimeout(() => nextPartner(), 2000);
    }
  }, [localStream, createPeerConnection]);

  // Handle call answer
  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnectionRef.current) {
      console.log('[ERROR] Cannot handle answer: no peer connection');
      return;
    }

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[SUCCESS] Call answer processed');
    } catch (error) {
      console.error('[ERROR] Failed to handle answer:', error);
    }
  }, []);

  // Handle ICE candidates
  const handleIceCandidate = useCallback(async (candidate) => {
    if (!peerConnectionRef.current) {
      console.log('[ERROR] Cannot handle ICE candidate: no peer connection');
      return;
    }

    try {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WEBRTC] ICE candidate added');
    } catch (error) {
      console.error('[ERROR] Failed to add ICE candidate:', error);
    }
  }, []);

  // Find a partner
  const findPartner = useCallback(() => {
    if (!socketRef.current?.connected) {
      console.log('[ERROR] Cannot find partner: not connected to server');
      setTimeout(() => findPartner(), 3000);
      return;
    }

    console.log('[SEARCH] Looking for partner...');
    setConnectionStatus('Looking for partner...');
    setIsConnecting(false);
    setError(null);
    clearTimeout(connectionTimeoutRef.current);

    // Clean up previous connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Emit find partner with user data
    const userData = {
      userId: user.id,
      gender: user.gender,
      preferredGender: user.preferredGender,
      hasFilterCredit: user.filterCredits > 0 || user.isPremium
    };

    console.log('[SEARCH] Sending user data:', userData);
    socketRef.current.emit('findPartner', userData);
  }, [user]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
        console.log(`[AUDIO] Audio ${!audioEnabled ? 'enabled' : 'disabled'}`);
      }
    }
  }, [localStream, audioEnabled]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
        console.log(`[VIDEO] Video ${!videoEnabled ? 'enabled' : 'disabled'}`);
      }
    }
  }, [localStream, videoEnabled]);

  // Report current partner
  const reportPartner = useCallback(() => {
    setShowReportModal(true);
  }, []);

  // Submit report
  const submitReport = useCallback(() => {
    if (reportReason && socketRef.current?.connected) {
      console.log('[REPORT] Submitting report:', reportReason);
      socketRef.current.emit('reportUser', { reason: reportReason });
      setReportReason('');
    }
  }, [reportReason]);

  // End call and find next partner
  const nextPartner = useCallback(() => {
    console.log('[NEXT] Finding next partner...');
    clearTimeout(connectionTimeoutRef.current);
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit('endCall');
    }

    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setTimeout(() => {
      findPartner();
    }, 1000);
  }, [findPartner]);

  // Stop call and go home
  const stopCall = useCallback(() => {
    console.log('[STOP] Stopping call and going home');
    clearTimeout(connectionTimeoutRef.current);
    clearTimeout(reconnectTimeoutRef.current);

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Disconnect socket
    if (socketRef.current?.connected) {
      socketRef.current.emit('endCall');
      socketRef.current.disconnect();
    }

    navigate('/');
  }, [localStream, navigate]);

  // Retry connection
  const retryConnection = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setConnectionStatus('Retrying connection...');
    initializeSocket();
  }, [initializeSocket]);

  // Toggle stats display
  const toggleStats = useCallback(() => {
    setShowStats(!showStats);
  }, [showStats]);

  // Initialize everything
  useEffect(() => {
    const init = async () => {
      try {
        await getUserMedia();
        initializeSocket();
      } catch (error) {
        console.error('[ERROR] Initialization failed:', error);
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      console.log('[CLEANUP] Cleaning up VideoChat component');
      clearTimeout(connectionTimeoutRef.current);
      clearTimeout(reconnectTimeoutRef.current);

      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit('endCall');
        socketRef.current.disconnect();
      }
    };
  }, [getUserMedia, initializeSocket]);

  // Auto-find partner when local stream is ready
  useEffect(() => {
    if (localStream && socketRef.current?.connected && !isConnecting && connectionStatus !== 'Connected') {
      console.log('[AUTO] Auto-finding partner...');
      const timer = setTimeout(() => findPartner(), 1000);
      return () => clearTimeout(timer);
    }
  }, [localStream, findPartner, isConnecting, connectionStatus]);

  // Redirect to home if no user data
  useEffect(() => {
    if (!user.id || !user.gender) {
      console.log('[ERROR] No user data, redirecting to home');
      navigate('/');
    }
  }, [user, navigate]);

  if (error && error.includes('Camera/microphone')) {
    return (
      <ErrorMessage>
        ⚠️ {error}
        <button onClick={() => window.location.reload()}>
          Refresh Page
        </button>
      </ErrorMessage>
    );
  }

  return (
    <Container>
      <ConnectionStatus status={connectionStatus.toLowerCase().includes('connected') ? 'connected' : 
                                connectionStatus.toLowerCase().includes('connecting') ? 'connecting' : 'disconnected'}>
        {connectionStatus}
      </ConnectionStatus>

      {process.env.NODE_ENV === 'development' && (
        <DebugPanel>
          <div><strong>Debug Info:</strong></div>
          <div>Local Tracks: {debugInfo.localStreamTracks}</div>
          <div>Remote Tracks: {debugInfo.remoteStreamTracks}</div>
          <div>ICE State: {debugInfo.iceConnectionState}</div>
          <div>Conn State: {debugInfo.connectionState}</div>
          <div>Signal State: {debugInfo.signalingState}</div>
          <div>ICE Gathering: {debugInfo.iceGatheringState}</div>
          <div>Last Error: {debugInfo.lastError || 'None'}</div>
          <div>Status: {connectionStatus}</div>
          <div>Connecting: {isConnecting ? 'Yes' : 'No'}</div>
          <div>Has Remote: {remoteStream ? 'Yes' : 'No'}</div>
          <div>Retry Count: {retryCount}</div>
        </DebugPanel>
      )}

      {showStats && (
        <StatsOverlay>
          <div className="stat-row">
            <span>Quality:</span>
            <span className={`quality-${connectionStats.quality}`}>
              {connectionStats.quality}
            </span>
          </div>
          <div className="stat-row">
            <span>Received:</span>
            <span>{Math.round(connectionStats.bytesReceived / 1024)}KB</span>
          </div>
          <div className="stat-row">
            <span>Sent:</span>
            <span>{Math.round(connectionStats.bytesSent / 1024)}KB</span>
          </div>
          <div className="stat-row">
            <span>Lost Packets:</span>
            <span>{connectionStats.packetsLost}</span>
          </div>
          <div className="stat-row">
            <span>Retries:</span>
            <span>{retryCount}</span>
          </div>
        </StatsOverlay>
      )}

      <VideoContainer>
        <VideoWrapper>
          <VideoLabel>You {!videoEnabled && '(Camera Off)'}</VideoLabel>
          <Video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted={true}
          />
          {!localStream && (
            <PlaceholderMessage>
              📷 Starting camera...
            </PlaceholderMessage>
          )}
        </VideoWrapper>

        <VideoWrapper>
          <VideoLabel>Partner</VideoLabel>
          {remoteStream ? (
            <Video
              ref={remoteVideoRef}
              autoPlay
              playsInline
            />
          ) : (
            <PlaceholderMessage>
              {isConnecting ? '🔄 Connecting...' :
               error && !error.includes('Camera/microphone') ? '⚠️ Connection error' :
               connectionStatus.includes('Looking') ? '👋 Looking for partner...' :
               connectionStatus.includes('Partner disconnected') ? '💔 Partner left' :
               connectionStatus.includes('server') ? '🌐 Connecting to server...' :
               '💭 Waiting for partner...'}
            </PlaceholderMessage>
          )}
        </VideoWrapper>
      </VideoContainer>

      <Controls>
        <ControlButton
          className="control"
          active={audioEnabled}
          onClick={toggleAudio}
          disabled={!localStream}
          title={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
        >
          {audioEnabled ? '🎤' : '🔇'}
        </ControlButton>

        <ControlButton
          className="control"
          active={videoEnabled}
          onClick={toggleVideo}
          disabled={!localStream}
          title={videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {videoEnabled ? '📹' : '📷'}
        </ControlButton>

        <ControlButton
          className="secondary"
          onClick={nextPartner}
          disabled={isConnecting}
          title="Find New Partner"
        >
          {isConnecting ? '⏳' : '🔄'}
        </ControlButton>

        {remoteStream && (
          <ControlButton
            className="report"
            onClick={reportPartner}
            title="Report Partner"
          >
            🚩
          </ControlButton>
        )}

        <ControlButton
          className="primary"
          onClick={stopCall}
          title="End Chat"
        >
          ❌
        </ControlButton>

        {process.env.NODE_ENV === 'development' && (
          <ControlButton
            className="control"
            onClick={toggleStats}
            title="Toggle Stats"
          >
            📊
          </ControlButton>
        )}
      </Controls>

      {error && !error.includes('Camera/microphone') && !error.includes('banned') && (
        <ErrorMessage>
          ⚠️ {error}
          <button onClick={retryConnection}>
            Retry Connection
          </button>
        </ErrorMessage>
      )}

      {showReportModal && (
        <ReportModal>
          <ReportContent>
            <h3>🚩 Report User</h3>
            <p>Why are you reporting this user?</p>
            
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            >
              <option value="">Select a reason</option>
              <option value="Inappropriate Content">Inappropriate Content</option>
              <option value="Nudity">Nudity</option>
              <option value="Harassment">Harassment</option>
              <option value="Spam">Spam</option>
              <option value="Underage User">Underage User</option>
              <option value="Offensive Language">Offensive Language</option>
              <option value="Other">Other</option>
            </select>

            <button
              className="submit"
              onClick={submitReport}
              disabled={!reportReason}
            >
              Submit Report
            </button>

            <button
              className="cancel"
              onClick={() => setShowReportModal(false)}
            >
              Cancel
            </button>
          </ReportContent>
        </ReportModal>
      )}

      {error && (error.includes('banned') || error.includes('reported')) && (
        <ErrorMessage>
          ⚠️ {error}
          <button onClick={() => navigate('/')}>
            Go Home
          </button>
        </ErrorMessage>
      )}
    </Container>
  );
};

export default VideoChat;
