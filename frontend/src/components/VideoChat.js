import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  font-family: 'Arial', sans-serif;
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
`;

const VideoWrapper = styled.div`
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
  -webkit-playsinline: true;
  playsinline: true;
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
  z-index: 1000;
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

  &.primary {
    background: linear-gradient(45deg, #ef4444, #dc2626);
    color: white;
    box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
  }

  &.secondary {
    background: linear-gradient(45deg, #10b981, #059669);
    color: white;
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
  }

  &.control {
    background: ${props => props.active
      ? 'linear-gradient(45deg, #6366f1, #4f46e5)'
      : 'rgba(255, 255, 255, 0.2)'};
    color: white;
    border: 2px solid ${props => props.active ? '#6366f1' : 'rgba(255, 255, 255, 0.3)'};
  }

  &.home {
    background: rgba(107, 114, 128, 0.8);
    color: white;
    border: 2px solid rgba(107, 114, 128, 0.6);
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
  z-index: 5;
`;

const DebugInfo = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-family: monospace;
  max-width: 200px;
  z-index: 1000;
`;

// Your Railway backend URL
const BACKEND_URL = 'https://omegle-clone-backend-production-8f06.up.railway.app';

// Enhanced ICE servers with multiple reliable TURN servers
const ICE_SERVERS = [
  // Google STUN servers
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  
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
  // Additional TURN servers
  {
    urls: 'turn:relay1.expressturn.com:3478',
    username: 'efJBIBF0YZZASRS6Q4',
    credential: 'sTunRaPkAVdAr7DyOo'
  }
];

const VideoChat = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerConnectionRef = useRef();
  const offerTimeoutRef = useRef();
  const connectionTimeoutRef = useRef();
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Starting...');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('Initializing...');

  // Clear timeouts
  const clearTimeouts = useCallback(() => {
    if (offerTimeoutRef.current) {
      clearTimeout(offerTimeoutRef.current);
      offerTimeoutRef.current = null;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  // Enhanced getUserMedia for mobile
  const getUserMedia = useCallback(async () => {
    try {
      console.log('🎥 Requesting camera access...');
      setDebugInfo('Requesting camera...');
      setConnectionStatus('Requesting camera access...');

      // Mobile-optimized constraints
      const constraints = {
        video: {
          width: { min: 240, ideal: 480, max: 640 },
          height: { min: 180, ideal: 360, max: 480 },
          frameRate: { min: 15, ideal: 20, max: 24 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 44100 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Camera access granted');
      setLocalStream(stream);
      setDebugInfo('Camera ready');
      setConnectionStatus('Camera ready - Connecting...');
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        localVideoRef.current.autoplay = true;
        
        // Force play for mobile
        try {
          await localVideoRef.current.play();
          console.log('✅ Local video playing');
        } catch (playError) {
          console.warn('Local video autoplay failed, trying manual play');
          // Try again after user interaction
          localVideoRef.current.onclick = () => {
            localVideoRef.current.play().catch(e => console.log('Manual play failed:', e));
          };
        }
      }
      
      return stream;
    } catch (error) {
      console.error('❌ Camera access failed:', error);
      setConnectionStatus('Camera access failed');
      setDebugInfo(`Camera error: ${error.name}`);
      throw error;
    }
  }, []);

  // Enhanced socket initialization
  const initializeSocket = useCallback(() => {
    console.log('🌐 Connecting to server:', BACKEND_URL);
    setDebugInfo('Connecting to server...');
    setConnectionStatus('Connecting to server...');
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    socketRef.current = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      upgrade: true
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server');
      setConnectionStatus('Connected! Looking for partner...');
      setDebugInfo(`Connected: ${socketRef.current.id.slice(-6)}`);
      
      // Auto-start partner search
      setTimeout(() => {
        if (user && user.id && user.gender) {
          findPartner();
        }
      }, 1000);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ Disconnected:', reason);
      setConnectionStatus('Server disconnected');
      setDebugInfo(`Disconnected: ${reason}`);
      clearTimeouts();
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setConnectionStatus('Connection failed');
      setDebugInfo('Connection failed');
    });

    // Partner matching
    socketRef.current.on('matched', (partnerId) => {
      console.log('🎯 Partner found:', partnerId);
      setConnectionStatus('Partner found! Connecting...');
      setDebugInfo(`Matched: ${partnerId.slice(-6)}`);
      setIsConnecting(true);
      clearTimeouts();
      
      // Start call with timeout
      setTimeout(() => {
        initiateCall();
      }, 1000);
    });

    socketRef.current.on('waiting', () => {
      console.log('⏳ Waiting for partner...');
      setConnectionStatus('Looking for partner...');
      setDebugInfo('In queue');
      setIsConnecting(false);
    });

    // WebRTC signaling
    socketRef.current.on('offer', async (offer) => {
      console.log('📞 Received offer');
      setConnectionStatus('Incoming call...');
      setDebugInfo('Received offer');
      setIsConnecting(true);
      clearTimeouts();
      await handleOffer(offer);
    });

    socketRef.current.on('answer', async (answer) => {
      console.log('✅ Received answer');
      setDebugInfo('Received answer');
      clearTimeouts();
      await handleAnswer(answer);
    });

    socketRef.current.on('ice-candidate', async (candidate) => {
      await handleIceCandidate(candidate);
    });

    socketRef.current.on('partnerDisconnected', () => {
      console.log('👋 Partner disconnected');
      setConnectionStatus('Partner disconnected');
      setDebugInfo('Partner left');
      setIsConnecting(false);
      clearTimeouts();
      
      // Clean up
      setRemoteStream(null);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Auto find new partner
      setTimeout(() => findPartner(), 2000);
    });

    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
      setDebugInfo(`Socket error`);
    });

  }, [user]);

  // Enhanced peer connection creation
  const createPeerConnection = useCallback(() => {
    console.log('🔗 Creating peer connection...');
    
    const config = {
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all',
      // Additional mobile-specific configurations
      sdpSemantics: 'unified-plan'
    };

    const pc = new RTCPeerConnection(config);

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && socketRef.current.connected) {
        console.log('📡 Sending ICE candidate');
        socketRef.current.emit('ice-candidate', event.candidate);
      } else if (!event.candidate) {
        console.log('✅ ICE gathering complete');
      }
    };

    // Remote stream handling
    pc.ontrack = (event) => {
      console.log('🎬 Received remote stream');
      const [stream] = event.streams;
      setRemoteStream(stream);
      setConnectionStatus('Connected!');
      setDebugInfo('Video call active');
      setIsConnecting(false);
      clearTimeouts();
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.playsInline = true;
        remoteVideoRef.current.autoplay = true;
        
        // Force play for mobile
        const playRemote = async () => {
          try {
            await remoteVideoRef.current.play();
            console.log('✅ Remote video playing');
          } catch (error) {
            console.warn('Remote video autoplay failed');
            // Add click handler for manual play
            remoteVideoRef.current.onclick = () => {
              remoteVideoRef.current.play().catch(e => console.log('Manual remote play failed:', e));
            };
          }
        };
        
        playRemote();
      }
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      setDebugInfo(`WebRTC: ${pc.connectionState}`);
      
      switch (pc.connectionState) {
        case 'connected':
          setConnectionStatus('Connected!');
          setIsConnecting(false);
          clearTimeouts();
          break;
        case 'disconnected':
        case 'failed':
          console.log('❌ Connection failed/disconnected');
          setConnectionStatus('Connection lost');
          setIsConnecting(false);
          clearTimeouts();
          
          // Auto-retry after a delay
          setTimeout(() => {
            findPartner();
          }, 3000);
          break;
        case 'connecting':
          setConnectionStatus('Connecting...');
          setIsConnecting(true);
          break;
      }
    };

    // ICE connection state monitoring
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE state:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed') {
        console.log('❌ ICE connection failed, restarting...');
        pc.restartIce();
      }
    };

    return pc;
  }, [clearTimeouts]);

  // Find partner function
  const findPartner = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.log('❌ Socket not connected');
      setDebugInfo('Socket not connected');
      return;
    }

    if (!user || !user.id || !user.gender) {
      console.log('❌ Invalid user data');
      return;
    }

    console.log('🔍 Looking for partner...');
    setConnectionStatus('Looking for partner...');
    setDebugInfo('Searching...');
    setIsConnecting(false);
    clearTimeouts();

    // Clean up previous connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    const userData = {
      userId: user.id,
      gender: user.gender,
      preferredGender: user.preferredGender || 'any',
      hasFilterCredit: (user.filterCredits > 0) || user.isPremium
    };

    console.log('📤 Sending findPartner:', userData);
    socketRef.current.emit('findPartner', userData);
  }, [user, clearTimeouts]);

  // Enhanced initiate call with timeout
  const initiateCall = useCallback(async () => {
    if (!localStream || !socketRef.current || !socketRef.current.connected) {
      console.log('❌ Cannot initiate call - missing requirements');
      return;
    }

    try {
      console.log('📞 Initiating call...');
      setDebugInfo('Creating offer...');
      
      peerConnectionRef.current = createPeerConnection();

      // Add local stream tracks
      localStream.getTracks().forEach(track => {
        console.log(`📤 Adding ${track.kind} track`);
        peerConnectionRef.current.addTrack(track, localStream);
      });

      // Create offer with enhanced options
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: false
      });

      await peerConnectionRef.current.setLocalDescription(offer);
      
      console.log('📞 Sending offer');
      socketRef.current.emit('offer', offer);
      setDebugInfo('Offer sent');

      // Set timeout for offer response
      offerTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Offer timeout');
        setConnectionStatus('Connection timeout - Finding new partner...');
        findPartner();
      }, 15000);

    } catch (error) {
      console.error('❌ Failed to initiate call:', error);
      setConnectionStatus('Failed to start call');
      setDebugInfo('Call failed');
      setTimeout(() => findPartner(), 2000);
    }
  }, [localStream, createPeerConnection, findPartner, clearTimeouts]);

  // Enhanced handle offer
  const handleOffer = useCallback(async (offer) => {
    if (!localStream) {
      console.log('❌ No local stream for offer');
      return;
    }

    try {
      console.log('📞 Handling offer...');
      setDebugInfo('Processing offer...');
      
      peerConnectionRef.current = createPeerConnection();

      // Add local stream tracks
      localStream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStream);
      });

      await peerConnectionRef.current.setRemoteDescription(offer);
      
      // Create answer
      const answer = await peerConnectionRef.current.createAnswer({
        voiceActivityDetection: false
      });
      
      await peerConnectionRef.current.setLocalDescription(answer);

      console.log('📞 Sending answer');
      socketRef.current.emit('answer', answer);
      setDebugInfo('Answer sent');

      // Set connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Connection timeout after answer');
        setConnectionStatus('Connection timeout - Finding new partner...');
        findPartner();
      }, 20000);

    } catch (error) {
      console.error('❌ Failed to handle offer:', error);
      setConnectionStatus('Failed to connect');
      setTimeout(() => findPartner(), 2000);
    }
  }, [localStream, createPeerConnection, findPartner]);

  // Handle answer
  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnectionRef.current) {
      console.log('❌ No peer connection for answer');
      return;
    }

    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
      console.log('✅ Answer processed');
      setDebugInfo('Answer processed');
    } catch (error) {
      console.error('❌ Failed to handle answer:', error);
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
      console.log('📡 ICE candidate added');
    } catch (error) {
      console.error('❌ ICE candidate error:', error);
    }
  }, []);

  // Control functions
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  const nextPartner = () => {
    clearTimeouts();
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('endCall');
    }

    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setTimeout(() => findPartner(), 1000);
  };

  const stopCall = () => {
    clearTimeouts();
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    if (socketRef.current) {
      socketRef.current.emit('endCall');
      socketRef.current.disconnect();
    }

    navigate('/');
  };

  // Initialize on mount
  useEffect(() => {
    if (!user || !user.id || !user.gender) {
      navigate('/');
      return;
    }

    const init = async () => {
      try {
        await getUserMedia();
        initializeSocket();
      } catch (error) {
        console.error('❌ Initialization failed:', error);
      }
    };

    init();

    return () => {
      clearTimeouts();
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [getUserMedia, initializeSocket, user, navigate, clearTimeouts]);

  return (
    <Container>
      <ConnectionStatus status={
        connectionStatus.includes('Connected!') ? 'connected' :
        isConnecting || connectionStatus.includes('Connecting') || connectionStatus.includes('connecting') ? 'connecting' :
        'disconnected'
      }>
        {connectionStatus}
      </ConnectionStatus>

      <DebugInfo>
        User: {user?.id?.slice(-8)}<br/>
        Status: {debugInfo}<br/>
        Socket: {socketRef.current?.connected ? 'OK' : 'NO'}
      </DebugInfo>

      <VideoContainer>
        <VideoWrapper>
          <VideoLabel>You</VideoLabel>
          <Video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
          />
          {!localStream && (
            <PlaceholderMessage>
              🎥 Starting camera...
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
              {isConnecting ? '🔄 Connecting...' : '👋 Waiting for partner...'}
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
        >
          {audioEnabled ? '🎤' : '🔇'}
        </ControlButton>

        <ControlButton
          className="control"
          active={videoEnabled}
          onClick={toggleVideo}
          disabled={!localStream}
        >
          {videoEnabled ? '📹' : '📷'}
        </ControlButton>

        <ControlButton
          className="secondary"
          onClick={nextPartner}
          disabled={isConnecting}
        >
          ⏭️
        </ControlButton>

        <ControlButton
          className="primary"
          onClick={stopCall}
        >
          ❌
        </ControlButton>

        <ControlButton
          className="home"
          onClick={stopCall}
        >
          🏠
        </ControlButton>
      </Controls>
    </Container>
  );
};

export default VideoChat;
