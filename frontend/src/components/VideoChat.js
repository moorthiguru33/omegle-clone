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
  display: ${props => props.show ? 'block' : 'none'};
`;

// Your Railway backend URL
const BACKEND_URL = 'https://omegle-clone-backend-production-8f06.up.railway.app';

// Optimized ICE servers
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

const VideoChat = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerConnectionRef = useRef();
  const retryTimeoutRef = useRef();
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Starting...');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('Initializing...');
  const [partnerId, setPartnerId] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  // Initialize user media
  const initializeMedia = useCallback(async () => {
    try {
      console.log('🎥 Requesting media access...');
      setConnectionStatus('Requesting camera access...');
      setDebugInfo('Getting media...');

      const constraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
      }
      
      console.log('✅ Media access granted');
      setDebugInfo('Media ready');
      return stream;
    } catch (error) {
      console.error('❌ Media access failed:', error);
      setConnectionStatus('Camera access denied');
      setDebugInfo(`Media error: ${error.name}`);
      throw error;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const config = {
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10
    };

    const pc = new RTCPeerConnection(config);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.connected) {
        console.log('📡 Sending ICE candidate');
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          to: partnerId
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('🎬 Received remote stream');
      const [stream] = event.streams;
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      setConnectionStatus('Connected!');
      setIsConnecting(false);
      setDebugInfo('Call active');
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      setDebugInfo(`WebRTC: ${pc.connectionState}`);
      
      switch (pc.connectionState) {
        case 'connected':
          setConnectionStatus('Connected!');
          setIsConnecting(false);
          break;
        case 'disconnected':
        case 'failed':
          setConnectionStatus('Connection lost');
          handlePartnerDisconnected();
          break;
        case 'connecting':
          setConnectionStatus('Connecting...');
          setIsConnecting(true);
          break;
        default:
          break;
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [partnerId]);

  // Initialize socket connection
  const initializeSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    console.log('🌐 Connecting to server...');
    setConnectionStatus('Connecting to server...');
    setDebugInfo('Connecting...');

    socketRef.current = io(BACKEND_URL, {
      transports: ['websocket'],
      timeout: 20000,
      forceNew: true
    });

    // Socket event handlers
    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server');
      setConnectionStatus('Connected! Looking for partner...');
      setDebugInfo(`Connected: ${socketRef.current.id?.slice(-6)}`);
      
      // Start looking for partner
      startLookingForPartner();
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setConnectionStatus('Server disconnected');
      setDebugInfo('Disconnected');
    });

    socketRef.current.on('matched', (data) => {
      console.log('🎯 Partner found:', data.partnerId);
      setPartnerId(data.partnerId);
      setConnectionStatus('Partner found! Connecting...');
      setDebugInfo(`Matched: ${data.partnerId?.slice(-6)}`);
      setIsConnecting(true);
      
      // If we're the caller, initiate the call
      if (data.shouldInitiate) {
        setTimeout(() => initiateCall(), 1000);
      }
    });

    socketRef.current.on('waiting', () => {
      console.log('⏳ Waiting for partner...');
      setConnectionStatus('Looking for partner...');
      setDebugInfo('Waiting...');
      setIsConnecting(false);
    });

    socketRef.current.on('offer', async (data) => {
      console.log('📞 Received offer');
      setPartnerId(data.from);
      await handleOffer(data.offer);
    });

    socketRef.current.on('answer', async (data) => {
      console.log('✅ Received answer');
      await handleAnswer(data.answer);
    });

    socketRef.current.on('ice-candidate', async (data) => {
      await handleIceCandidate(data.candidate);
    });

    socketRef.current.on('partner-disconnected', () => {
      console.log('👋 Partner disconnected');
      handlePartnerDisconnected();
    });

    socketRef.current.on('error', (error) => {
      console.error('❌ Socket error:', error);
      setConnectionStatus('Connection error');
      setDebugInfo('Socket error');
    });

  }, []);

  // Start looking for partner
  const startLookingForPartner = useCallback(() => {
    if (!socketRef.current?.connected || !user) return;

    console.log('🔍 Looking for partner...');
    setConnectionStatus('Looking for partner...');
    setDebugInfo('Searching...');
    setIsConnecting(false);
    setPartnerId(null);
    
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
      preferredGender: user.preferredGender || 'any'
    };

    socketRef.current.emit('find-partner', userData);
  }, [user]);

  // Initiate call (caller)
  const initiateCall = useCallback(async () => {
    if (!localStream || !socketRef.current?.connected || !partnerId) {
      console.log('❌ Cannot initiate call - missing requirements');
      return;
    }

    try {
      console.log('📞 Initiating call...');
      setConnectionStatus('Initiating call...');
      setDebugInfo('Creating offer...');

      const pc = createPeerConnection();
      
      // Add local stream tracks
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await pc.setLocalDescription(offer);
      
      socketRef.current.emit('offer', {
        offer,
        to: partnerId
      });

      setDebugInfo('Offer sent');
    } catch (error) {
      console.error('❌ Failed to initiate call:', error);
      setConnectionStatus('Failed to start call');
      setTimeout(() => startLookingForPartner(), 2000);
    }
  }, [localStream, partnerId, createPeerConnection, startLookingForPartner]);

  // Handle incoming offer (callee)
  const handleOffer = useCallback(async (offer) => {
    if (!localStream || !socketRef.current?.connected) {
      console.log('❌ Cannot handle offer - missing requirements');
      return;
    }

    try {
      console.log('📞 Handling offer...');
      setConnectionStatus('Incoming call...');
      setDebugInfo('Processing offer...');

      const pc = createPeerConnection();
      
      // Add local stream tracks
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('answer', {
        answer,
        to: partnerId
      });

      setDebugInfo('Answer sent');
    } catch (error) {
      console.error('❌ Failed to handle offer:', error);
      setConnectionStatus('Failed to connect');
      setTimeout(() => startLookingForPartner(), 2000);
    }
  }, [localStream, partnerId, createPeerConnection, startLookingForPartner]);

  // Handle answer
  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnectionRef.current) {
      console.log('❌ No peer connection for answer');
      return;
    }

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
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
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('📡 ICE candidate added');
    } catch (error) {
      console.error('❌ ICE candidate error:', error);
    }
  }, []);

  // Handle partner disconnection
  const handlePartnerDisconnected = useCallback(() => {
    console.log('👋 Partner disconnected');
    setConnectionStatus('Partner disconnected');
    setDebugInfo('Partner left');
    setIsConnecting(false);
    setPartnerId(null);
    
    // Clean up connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Auto find new partner after delay
    setTimeout(() => {
      if (socketRef.current?.connected) {
        startLookingForPartner();
      }
    }, 2000);
  }, [startLookingForPartner]);

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
    if (socketRef.current?.connected) {
      socketRef.current.emit('end-call', { partnerId });
    }
    handlePartnerDisconnected();
  };

  const stopCall = () => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.emit('end-call', { partnerId });
      socketRef.current.disconnect();
    }
    
    navigate('/');
  };

  // Initialize on mount
  useEffect(() => {
    if (!user?.id || !user?.gender) {
      navigate('/');
      return;
    }

    const init = async () => {
      try {
        await initializeMedia();
        initializeSocket();
      } catch (error) {
        console.error('❌ Initialization failed:', error);
        setConnectionStatus('Setup failed');
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
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
  }, [user, navigate, initializeMedia, initializeSocket]);

  return (
    <Container>
      <ConnectionStatus status={
        connectionStatus.includes('Connected!') ? 'connected' :
        isConnecting || connectionStatus.includes('Connecting') || connectionStatus.includes('connecting') ? 'connecting' :
        'disconnected'
      }>
        {connectionStatus}
      </ConnectionStatus>

      <DebugInfo show={showDebug}>
        User: {user?.id?.slice(-8)}<br/>
        Status: {debugInfo}<br/>
        Socket: {socketRef.current?.connected ? 'OK' : 'NO'}<br/>
        Partner: {partnerId?.slice(-6) || 'None'}
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
          disabled={isConnecting || !partnerId}
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

        {/* Debug toggle */}
        <ControlButton
          className="control"
          onClick={() => setShowDebug(!showDebug)}
          style={{ fontSize: '12px' }}
        >
          🐛
        </ControlButton>
      </Controls>
    </Container>
  );
};

export default VideoChat;
