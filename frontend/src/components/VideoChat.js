import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import styled from 'styled-components';

// Browser detection utilities
const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  return {
    isChrome: /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor),
    isSafari: /Safari/.test(ua) && /Apple Computer/.test(navigator.vendor),
    isFirefox: /Firefox/.test(ua),
    isEdge: /Edg/.test(ua),
    isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
    isIOS: /iPad|iPhone|iPod/.test(ua),
    isAndroid: /Android/.test(ua),
    browserType: (() => {
      if (/iPad|iPhone|iPod/.test(ua)) return 'iOS Safari';
      if (/Safari/.test(ua) && /Apple Computer/.test(navigator.vendor)) return 'Safari';
      if (/Chrome/.test(ua) && /Google Inc/.test(navigator.vendor)) return 'Chrome';
      if (/Firefox/.test(ua)) return 'Firefox';
      if (/Edg/.test(ua)) return 'Edge';
      if (/Android/.test(ua)) return 'Android';
      return 'Unknown';
    })()
  };
};

// Enhanced ICE servers with better reliability for all browsers
const ICE_SERVERS = [
  // Multiple Google STUN servers
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  
  // Additional reliable STUN servers
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.nextcloud.com:443' },
  { urls: 'stun:stun.sipgate.net:3478' },
  
  // Multiple TURN servers for better connectivity
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
  
  // Alternative TURN server
  {
    urls: 'turn:relay1.expressturn.com:3478',
    username: 'ef4IKQP7KOQC8QJZFR',
    credential: 'tWIcqVHfT8eDis7P'
  }
];

// Styled components (same as before, keeping existing styling)
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
  max-width: 250px;
  text-align: center;

  @media (max-width: 480px) {
    font-size: 12px;
    padding: 6px 12px;
    max-width: 180px;
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

const VideoChat = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerConnectionRef = useRef();
  const connectionTimeoutRef = useRef();
  const reconnectTimeoutRef = useRef();
  const browserInfo = getBrowserInfo();

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
  const [connectionStrategy, setConnectionStrategy] = useState(null);
  const [isPoliteMode, setIsPoliteMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    localStreamTracks: 0,
    remoteStreamTracks: 0,
    iceConnectionState: 'new',
    connectionState: 'new',
    signalingState: 'stable',
    iceGatheringState: 'new',
    lastError: null,
    browserType: browserInfo.browserType
  });

  // Enhanced getUserMedia with browser-specific constraints
  const getUserMedia = useCallback(async () => {
    let constraints;
    
    // Browser-specific media constraints
    if (browserInfo.isIOS) {
      // iOS Safari specific constraints
      constraints = {
        video: {
          width: { ideal: 480, max: 640 },
          height: { ideal: 320, max: 480 },
          frameRate: { ideal: 15, max: 24 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false // iOS handles this
        }
      };
    } else if (browserInfo.isSafari) {
      // Desktop Safari constraints
      constraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
    } else if (browserInfo.isMobile) {
      // Other mobile browsers
      constraints = {
        video: {
          width: { ideal: 640, max: 854 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 20, max: 30 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
    } else {
      // Desktop browsers
      constraints = {
        video: {
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
          frameRate: { min: 15, ideal: 24, max: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 44100 }
        }
      };
    }

    const fallbackConstraints = [
      constraints,
      { video: { width: 480, height: 320 }, audio: true },
      { video: { width: 320, height: 240 }, audio: true },
      { video: true, audio: true },
      { audio: true } // Audio only fallback
    ];

    for (let i = 0; i < fallbackConstraints.length; i++) {
      try {
        console.log(`[MEDIA] Attempting constraints ${i + 1}:`, fallbackConstraints[i]);
        setConnectionStatus(`Requesting camera access (${browserInfo.browserType})...`);
        
        const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints[i]);
        
        setLocalStream(stream);
        setDebugInfo(prev => ({
          ...prev,
          localStreamTracks: stream.getTracks().length,
          lastError: null
        }));
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          
          // Browser-specific video handling
          if (browserInfo.isIOS || browserInfo.isSafari) {
            localVideoRef.current.playsInline = true;
            localVideoRef.current.autoplay = true;
            localVideoRef.current.muted = true;
          }
          
          localVideoRef.current.onloadedmetadata = () => {
            localVideoRef.current.play().catch(console.error);
          };
        }
        
        console.log(`[SUCCESS] Media access granted with constraint set ${i + 1} (${browserInfo.browserType})`);
        return stream;
      } catch (error) {
        console.log(`[FALLBACK] Constraint set ${i + 1} failed:`, error.message);
        setDebugInfo(prev => ({
          ...prev,
          lastError: `Media constraint ${i + 1} failed: ${error.message}`
        }));
        
        if (i === fallbackConstraints.length - 1) {
          throw error;
        }
      }
    }
  }, [browserInfo]);

  // Create peer connection with browser-specific configuration
  const createPeerConnection = useCallback(() => {
    let config = {
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all',
      sdpSemantics: 'unified-plan'
    };

    // Browser-specific configuration adjustments
    if (browserInfo.isIOS) {
      // iOS Safari needs special handling
      config.iceTransportPolicy = 'relay'; // Force TURN for better iOS compatibility
      config.iceCandidatePoolSize = 5;
    } else if (browserInfo.isSafari) {
      config.bundlePolicy = 'balanced'; // Safari prefers balanced
    } else if (browserInfo.isFirefox) {
      config.iceCandidatePoolSize = 5; // Firefox optimization
    }

    const pc = new RTCPeerConnection(config);
    
    // Enhanced ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.connected) {
        console.log(`[ICE] Sending candidate (${browserInfo.browserType}):`, event.candidate.candidate.substring(0, 50) + '...');
        socketRef.current.emit('ice-candidate', event.candidate);
      } else if (!event.candidate) {
        console.log('[ICE] Gathering complete');
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WEBRTC] Remote stream received (${browserInfo.browserType})`);
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
        
        // Browser-specific remote video handling
        if (browserInfo.isIOS || browserInfo.isSafari) {
          remoteVideoRef.current.playsInline = true;
          remoteVideoRef.current.autoplay = true;
          
          // iOS needs user interaction for autoplay
          if (browserInfo.isIOS) {
            remoteVideoRef.current.muted = false;
            setTimeout(() => {
              remoteVideoRef.current.play().catch(e => {
                console.log('[iOS] Autoplay prevented, user interaction needed');
                setConnectionStatus('Tap video to start');
              });
            }, 100);
          }
        }
        
        remoteVideoRef.current.onloadedmetadata = () => {
          remoteVideoRef.current.play().catch(console.error);
        };
      }
      
      setConnectionStatus('Connected');
      setIsConnecting(false);
      clearTimeout(connectionTimeoutRef.current);
    };

    // Enhanced connection state handling with browser-specific timeouts
    pc.onconnectionstatechange = () => {
      console.log(`[WEBRTC] Connection state: ${pc.connectionState} (${browserInfo.browserType})`);
      setDebugInfo(prev => ({
        ...prev,
        connectionState: pc.connectionState
      }));
      
      switch (pc.connectionState) {
        case 'connected':
          setConnectionStatus('Connected');
          setIsConnecting(false);
          setRetryCount(0);
          clearTimeout(connectionTimeoutRef.current);
          break;
        case 'connecting':
          setConnectionStatus('Establishing connection...');
          setIsConnecting(true);
          
          // Browser-specific timeout handling
          const timeout = connectionStrategy?.iceTimeout || 
                         (browserInfo.isIOS ? 25000 : 
                          browserInfo.isSafari ? 20000 : 
                          browserInfo.isMobile ? 15000 : 12000);
          
          connectionTimeoutRef.current = setTimeout(() => {
            if (pc.connectionState === 'connecting') {
              console.log(`[TIMEOUT] Connection timeout (${browserInfo.browserType}), retrying...`);
              nextPartner();
            }
          }, timeout);
          break;
        case 'disconnected':
          setConnectionStatus('Connection lost');
          setIsConnecting(false);
          setTimeout(() => findPartner(), 3000);
          break;
        case 'failed':
          console.log(`[ERROR] Connection failed (${browserInfo.browserType})`);
          setConnectionStatus('Connection failed - retrying...');
          setIsConnecting(false);
          if (retryCount < 3) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              findPartner();
            }, 2000);
          } else {
            setConnectionStatus('Connection failed. Please refresh.');
            setError('Unable to establish connection. Please refresh the page.');
          }
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[ICE] Connection state: ${pc.iceConnectionState} (${browserInfo.browserType})`);
      setDebugInfo(prev => ({
        ...prev,
        iceConnectionState: pc.iceConnectionState
      }));
      
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setRetryCount(0);
      } else if (pc.iceConnectionState === 'failed') {
        console.log('[ICE] Connection failed, trying next partner');
        if (retryCount < 3) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            nextPartner();
          }, 2000);
        }
      }
    };

    pc.onsignalingstatechange = () => {
      console.log(`[SIGNALING] State: ${pc.signalingState} (${browserInfo.browserType})`);
      setDebugInfo(prev => ({
        ...prev,
        signalingState: pc.signalingState
      }));
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[ICE] Gathering state: ${pc.iceGatheringState} (${browserInfo.browserType})`);
      setDebugInfo(prev => ({
        ...prev,
        iceGatheringState: pc.iceGatheringState
      }));
    };

    return pc;
  }, [connectionStrategy, browserInfo, retryCount]);

  // Browser-specific offer/answer handling
  const createOffer = useCallback(async (pc) => {
    let constraints = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    };

    // Safari-specific constraints
    if (browserInfo.isSafari) {
      constraints.voiceActivityDetection = false;
    }

    // iOS-specific constraints
    if (browserInfo.isIOS) {
      constraints.iceRestart = false;
    }

    return await pc.createOffer(constraints);
  }, [browserInfo]);

  const createAnswer = useCallback(async (pc) => {
    let constraints = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    };

    if (browserInfo.isSafari) {
      constraints.voiceActivityDetection = false;
    }

    return await pc.createAnswer(constraints);
  }, [browserInfo]);

  // Initialize socket connection with enhanced browser detection
  const initializeSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    console.log(`[SOCKET] Initializing connection (${browserInfo.browserType})...`);
    setConnectionStatus(`Connecting to server (${browserInfo.browserType})...`);

    socketRef.current = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current.on('connect', () => {
      console.log(`[SUCCESS] Connected to server (${browserInfo.browserType})`);
      setConnectionStatus('Connected to server');
      setError(null);
      setRetryCount(0);
    });

    socketRef.current.on('matched', (matchData) => {
      console.log(`[MATCH] Partner matched (${browserInfo.browserType}):`, matchData);
      setConnectionStatus('Partner found! Preparing connection...');
      setIsConnecting(true);
      
      // Store connection strategy
      if (matchData.connectionStrategy) {
        setConnectionStrategy(matchData.connectionStrategy);
        console.log(`[STRATEGY] Connection strategy: ${matchData.connectionStrategy.type}`);
      }
      
      // Determine if we should be polite or impolite
      setIsPoliteMode(matchData.isPolite || false);
      
      // Browser-specific delay before starting WebRTC
      const delay = browserInfo.isIOS ? 3000 : 
                   browserInfo.isSafari ? 2500 : 
                   browserInfo.isMobile ? 2000 : 1500;
      
      setTimeout(() => {
        initiateCall();
      }, delay);
    });

    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleIceCandidate);

    socketRef.current.on('partnerDisconnected', () => {
      console.log(`[PARTNER] Partner disconnected (${browserInfo.browserType})`);
      setConnectionStatus('Partner left');
      setRemoteStream(null);
      setIsConnecting(false);
      clearTimeout(connectionTimeoutRef.current);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      setTimeout(() => findPartner(), 2000);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log(`[DISCONNECT] Disconnected from server: ${reason} (${browserInfo.browserType})`);
      setConnectionStatus('Disconnected from server');
      if (reason === 'io server disconnect') {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`[RECONNECT] Attempting to reconnect (${browserInfo.browserType})...`);
          initializeSocket();
        }, 3000);
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.error(`[ERROR] Connection error (${browserInfo.browserType}):`, error);
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

    // Handle other socket events (error, timeout, report, ban)
    socketRef.current.on('error', (error) => {
      console.error(`[ERROR] Socket error (${browserInfo.browserType}):`, error);
      setError(error.message || 'Connection error occurred');
    });

    socketRef.current.on('reported', (data) => {
      console.log(`[REPORTED] You have been reported (${browserInfo.browserType}):`, data);
      setError(`You have been reported for: ${data.reason}. Connection will be terminated.`);
      setTimeout(() => navigate('/'), 5000);
    });

    socketRef.current.on('banned', (data) => {
      console.log(`[BANNED] User banned (${browserInfo.browserType}):`, data);
      setError('You have been banned from the service due to multiple reports.');
      setTimeout(() => navigate('/'), 3000);
    });

    socketRef.current.on('reportReceived', () => {
      setShowReportModal(false);
      setConnectionStatus('Report submitted. Finding new partner...');
      setTimeout(() => findPartner(), 2000);
    });

  }, [browserInfo, retryCount]);

  // Initiate call with polite/impolite pattern for better browser compatibility
  const initiateCall = useCallback(async () => {
    if (!localStream || !socketRef.current?.connected) {
      console.log(`[ERROR] Cannot initiate call: missing requirements (${browserInfo.browserType})`);
      return;
    }

    try {
      console.log(`[WEBRTC] Initiating call (${browserInfo.browserType})...`);
      peerConnectionRef.current = createPeerConnection();

      // Add tracks to peer connection
      localStream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStream);
        console.log(`[WEBRTC] Added ${track.kind} track (${browserInfo.browserType})`);
      });

      // Create offer with browser-specific handling
      const offer = await createOffer(peerConnectionRef.current);
      await peerConnectionRef.current.setLocalDescription(offer);

      console.log(`[WEBRTC] Sending offer (${browserInfo.browserType})`);
      socketRef.current.emit('offer', offer);

    } catch (error) {
      console.error(`[ERROR] Failed to initiate call (${browserInfo.browserType}):`, error);
      setConnectionStatus('Failed to start call');
      setDebugInfo(prev => ({
        ...prev,
        lastError: `Call initiation failed: ${error.message}`
      }));
      setTimeout(() => nextPartner(), 2000);
    }
  }, [localStream, createPeerConnection, createOffer, browserInfo]);

  // Handle incoming offer with polite/impolite pattern
  const handleOffer = useCallback(async (offer) => {
    if (!localStream) {
      console.log(`[ERROR] Cannot handle offer: missing local stream (${browserInfo.browserType})`);
      return;
    }

    try {
      console.log(`[WEBRTC] Handling offer (${browserInfo.browserType})...`);
      peerConnectionRef.current = createPeerConnection();

      // Add tracks first
      localStream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStream);
        console.log(`[WEBRTC] Added ${track.kind} track (${browserInfo.browserType})`);
      });

      await peerConnectionRef.current.setRemoteDescription(offer);
      
      const answer = await createAnswer(peerConnectionRef.current);
      await peerConnectionRef.current.setLocalDescription(answer);

      console.log(`[WEBRTC] Sending answer (${browserInfo.browserType})`);
      socketRef.current.emit('answer', answer);

    } catch (error) {
      console.error(`[ERROR] Failed to handle offer (${browserInfo.browserType}):`, error);
      setConnectionStatus('Failed to accept call');
      setDebugInfo(prev => ({
        ...prev,
        lastError: `Offer handling failed: ${error.message}`
      }));
      setTimeout(() => nextPartner(), 2000);
    }
  }, [localStream, createPeerConnection, createAnswer, browserInfo]);

  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
      console.log(`[SUCCESS] Answer processed (${browserInfo.browserType})`);
    } catch (error) {
      console.error(`[ERROR] Failed to handle answer (${browserInfo.browserType}):`, error);
      setDebugInfo(prev => ({
        ...prev,
        lastError: `Answer handling failed: ${error.message}`
      }));
    }
  }, [browserInfo]);

  const handleIceCandidate = useCallback(async (candidate) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
      console.log(`[ICE] Candidate added (${browserInfo.browserType})`);
    } catch (error) {
      console.error(`[ERROR] Failed to add ICE candidate (${browserInfo.browserType}):`, error);
    }
  }, [browserInfo]);

  const findPartner = useCallback(() => {
    if (!socketRef.current?.connected) {
      setTimeout(() => findPartner(), 3000);
      return;
    }

    console.log(`[SEARCH] Looking for partner (${browserInfo.browserType})...`);
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

    // Send enhanced user data with browser info
    const userData = {
      userId: user.id,
      gender: user.gender,
      preferredGender: user.preferredGender,
      hasFilterCredit: user.filterCredits > 0 || user.isPremium,
      browserInfo: browserInfo
    };

    console.log(`[SEARCH] Sending user data (${browserInfo.browserType}):`, userData);
    socketRef.current.emit('findPartner', userData);
  }, [user, browserInfo]);

  const nextPartner = useCallback(() => {
    console.log(`[NEXT] Finding next partner (${browserInfo.browserType})...`);
    clearTimeout(connectionTimeoutRef.current);
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit('endCall');
    }

    setRemoteStream(null);
    setTimeout(() => findPartner(), 1000);
  }, [findPartner, browserInfo]);

  const stopCall = useCallback(() => {
    console.log(`[STOP] Stopping call and going home (${browserInfo.browserType})`);
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
  }, [localStream, navigate, browserInfo]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
        console.log(`[AUDIO] Audio ${!audioEnabled ? 'enabled' : 'disabled'} (${browserInfo.browserType})`);
      }
    }
  }, [localStream, audioEnabled, browserInfo]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
        console.log(`[VIDEO] Video ${!videoEnabled ? 'enabled' : 'disabled'} (${browserInfo.browserType})`);
      }
    }
  }, [localStream, videoEnabled, browserInfo]);

  const reportPartner = useCallback(() => {
    setShowReportModal(true);
  }, []);

  const submitReport = useCallback(() => {
    if (reportReason && socketRef.current?.connected) {
      console.log(`[REPORT] Submitting report (${browserInfo.browserType}):`, reportReason);
      socketRef.current.emit('reportUser', { reason: reportReason });
      setReportReason('');
    }
  }, [reportReason, browserInfo]);

  const retryConnection = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setConnectionStatus('Retrying connection...');
    initializeSocket();
  }, [initializeSocket]);

  // Initialize everything
  useEffect(() => {
    const init = async () => {
      try {
        console.log(`[INIT] Browser info: ${browserInfo.browserType} (Mobile: ${browserInfo.isMobile}, iOS: ${browserInfo.isIOS})`);
        await getUserMedia();
        initializeSocket();
      } catch (error) {
        console.error(`[ERROR] Initialization failed (${browserInfo.browserType}):`, error);
        setConnectionStatus('Initialization failed');
        setError('Failed to access camera/microphone. Please allow permissions and refresh.');
      }
    };

    init();

    return () => {
      console.log(`[CLEANUP] Cleaning up VideoChat component (${browserInfo.browserType})`);
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
  }, [getUserMedia, initializeSocket, browserInfo]);

  // Auto-find partner when ready
  useEffect(() => {
    if (localStream && socketRef.current?.connected && connectionStatus === 'Connected to server') {
      const timer = setTimeout(() => findPartner(), 1000);
      return () => clearTimeout(timer);
    }
  }, [localStream, connectionStatus, findPartner]);

  // Redirect to home if no user data
  useEffect(() => {
    if (!user.id || !user.gender) {
      console.log(`[ERROR] No user data, redirecting to home (${browserInfo.browserType})`);
      navigate('/');
    }
  }, [user, navigate, browserInfo]);

  // Handle iOS video click to play
  const handleVideoClick = useCallback(() => {
    if (browserInfo.isIOS && remoteVideoRef.current) {
      remoteVideoRef.current.play().catch(console.error);
    }
  }, [browserInfo]);

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
        {browserInfo.isIOS && connectionStatus.includes('Tap') && ' 👆'}
      </ConnectionStatus>

      {process.env.NODE_ENV === 'development' && (
        <DebugPanel>
          <div><strong>Debug Info ({browserInfo.browserType}):</strong></div>
          <div>Local Tracks: {debugInfo.localStreamTracks}</div>
          <div>Remote Tracks: {debugInfo.remoteStreamTracks}</div>
          <div>ICE State: {debugInfo.iceConnectionState}</div>
          <div>Conn State: {debugInfo.connectionState}</div>
          <div>Signal State: {debugInfo.signalingState}</div>
          <div>ICE Gathering: {debugInfo.iceGatheringState}</div>
          <div>Strategy: {connectionStrategy?.type || 'none'}</div>
          <div>Polite Mode: {isPoliteMode ? 'Yes' : 'No'}</div>
          <div>Last Error: {debugInfo.lastError ? debugInfo.lastError.substring(0, 30) + '...' : 'None'}</div>
          <div>Retry Count: {retryCount}</div>
        </DebugPanel>
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
              📷 Starting camera ({browserInfo.browserType})...
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
              onClick={handleVideoClick}
              style={{ cursor: browserInfo.isIOS ? 'pointer' : 'default' }}
            />
          ) : (
            <PlaceholderMessage>
              {isConnecting ? '🔄 Connecting...' :
               error && !error.includes('Camera/microphone') ? '⚠️ Connection error' :
               connectionStatus.includes('Looking') ? '👋 Looking for partner...' :
               connectionStatus.includes('Partner left') ? '💔 Partner left' :
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
