import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import styled from 'styled-components';

// Your existing styled components remain the same...
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
  background: rgba(0, 0, 0, 0.7);
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

  &.home {
    background: rgba(107, 114, 128, 0.8);
    color: white;
    border: 2px solid rgba(107, 114, 128, 0.6);

    &:hover:not(:disabled) {
      background: rgba(75, 85, 99, 0.9);
      transform: translateY(-1px);
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
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
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
  font-family: monospace;
  max-width: 250px;
  word-break: break-all;
  z-index: 1000;
`;

// Use your Railway backend URL
const BACKEND_URL = 'https://omegle-clone-backend-production-8f06.up.railway.app';

// Enhanced ICE servers
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
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
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('Starting...');

  // Validate user data on component mount
  useEffect(() => {
    if (!user || !user.id || !user.gender) {
      console.log('❌ Invalid user data, redirecting to home');
      navigate('/');
      return;
    }
    console.log('✅ User data validated:', user);
  }, [user, navigate]);

  // Enhanced getUserMedia
  const getUserMedia = useCallback(async () => {
    try {
      console.log('🎥 Requesting media access...');
      setDebugInfo('Requesting camera access...');
      
      const constraints = {
        video: {
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
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
      setDebugInfo('Camera access granted');
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        
        try {
          await localVideoRef.current.play();
          console.log('✅ Local video started');
        } catch (playError) {
          console.warn('Local video autoplay failed:', playError);
        }
      }
      
      return stream;
    } catch (error) {
      console.error('❌ Media access failed:', error);
      setConnectionStatus('Camera access failed');
      setDebugInfo(`Media error: ${error.name}`);
      throw error;
    }
  }, []);

  // Initialize socket with auto partner finding
  const initializeSocket = useCallback(() => {
    console.log('🌐 Connecting to:', BACKEND_URL);
    setDebugInfo('Connecting to server...');
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    socketRef.current = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to signaling server');
      setConnectionStatus('Connected! Starting search...');
      setDebugInfo(`Connected: ${socketRef.current.id.slice(-6)}`);
      
      // **KEY FIX: Automatically start finding partner after connection**
      setTimeout(() => {
        if (localStream && user && user.id && user.gender) {
          console.log('🔍 Auto-starting partner search...');
          findPartner();
        } else {
          console.log('⚠️ Not ready for partner search yet');
          setDebugInfo('Waiting for camera...');
        }
      }, 1000);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ Disconnected:', reason);
      setConnectionStatus('Disconnected from server');
      setDebugInfo(`Disconnected: ${reason}`);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setConnectionStatus('Connection failed');
      setDebugInfo(`Error: ${error.message}`);
    });

    // Handle partner found
    socketRef.current.on('matched', (partnerId) => {
      console.log('🎯 Partner matched:', partnerId);
      setConnectionStatus('Partner found! Connecting...');
      setIsConnecting(true);
      setDebugInfo(`Matched: ${partnerId.slice(-6)}`);
      
      setTimeout(() => {
        initiateCall();
      }, 1000);
    });

    // Handle waiting for partner
    socketRef.current.on('waiting', () => {
      console.log('⏳ Waiting for partner...');
      setConnectionStatus('Looking for partner...');
      setIsConnecting(false);
      setDebugInfo('In waiting queue');
    });

    // Handle incoming call
    socketRef.current.on('offer', async (offer) => {
      console.log('📞 Received call offer');
      setConnectionStatus('Incoming call...');
      setIsConnecting(true);
      setDebugInfo('Received offer');
      await handleOffer(offer);
    });

    // Handle call answer
    socketRef.current.on('answer', async (answer) => {
      console.log('✅ Received call answer');
      setDebugInfo('Received answer');
      await handleAnswer(answer);
    });

    // Handle ICE candidates
    socketRef.current.on('ice-candidate', async (candidate) => {
      console.log('📡 Received ICE candidate');
      await handleIceCandidate(candidate);
    });

    // Handle partner disconnect
    socketRef.current.on('partnerDisconnected', () => {
      console.log('👋 Partner disconnected');
      setConnectionStatus('Partner disconnected');
      setRemoteStream(null);
      setIsConnecting(false);
      setDebugInfo('Partner left');
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      setTimeout(() => {
        findPartner();
      }, 2000);
    });

  }, [localStream, user]);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    const config = {
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10
    };

    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log('📡 Sending ICE candidate');
        socketRef.current.emit('ice-candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log('🎬 Received remote stream');
      const [stream] = event.streams;
      setRemoteStream(stream);
      setConnectionStatus('Connected!');
      setIsConnecting(false);
      setDebugInfo('Video call active');
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.playsInline = true;
        
        remoteVideoRef.current.play().catch(error => {
          console.warn('Remote video play failed:', error);
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      setDebugInfo(`WebRTC: ${pc.connectionState}`);
    };

    return pc;
  }, []);

  // Find partner function
  const findPartner = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.log('❌ Socket not connected, cannot find partner');
      setDebugInfo('Socket not connected');
      return;
    }

    if (!user || !user.id || !user.gender) {
      console.log('❌ Invalid user data');
      setDebugInfo('Invalid user data');
      return;
    }

    console.log('🔍 Looking for partner...');
    setConnectionStatus('Looking for partner...');
    setIsConnecting(false);
    setDebugInfo('Searching...');

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

    console.log('📤 Sending findPartner with:', userData);
    socketRef.current.emit('findPartner', userData);
  }, [user]);

  // Initiate call
  const initiateCall = useCallback(async () => {
    if (!localStream || !socketRef.current) return;

    try {
      console.log('📞 Initiating call...');
      peerConnectionRef.current = createPeerConnection();

      localStream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStream);
      });

      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      console.log('📞 Sending call offer');
      socketRef.current.emit('offer', offer);

    } catch (error) {
      console.error('❌ Failed to initiate call:', error);
      setConnectionStatus('Failed to start call');
      setDebugInfo('Call failed');
    }
  }, [localStream, createPeerConnection]);

  // Handle incoming offer
  const handleOffer = useCallback(async (offer) => {
    if (!localStream) return;

    try {
      peerConnectionRef.current = createPeerConnection();

      localStream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStream);
      });

      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      console.log('📞 Sending call answer');
      socketRef.current.emit('answer', answer);

    } catch (error) {
      console.error('❌ Failed to handle offer:', error);
    }
  }, [localStream, createPeerConnection]);

  // Handle answer
  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
      console.log('✅ Call answer processed');
    } catch (error) {
      console.error('❌ Failed to handle answer:', error);
    }
  }, []);

  // Handle ICE candidates
  const handleIceCandidate = useCallback(async (candidate) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
    } catch (error) {
      console.error('❌ Failed to add ICE candidate:', error);
    }
  }, []);

  // Control functions
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  }, [localStream, audioEnabled]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  }, [localStream, videoEnabled]);

  const nextPartner = useCallback(() => {
    console.log('🔄 Finding next partner...');
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (socketRef.current) {
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

  const stopCall = useCallback(() => {
    console.log('🛑 Stopping call');
    
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
  }, [localStream, navigate]);

  // Initialize everything
  useEffect(() => {
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
      console.log('🧹 Cleaning up...');
      
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
  }, [getUserMedia, initializeSocket]);

  // **KEY FIX: Auto-start partner search when everything is ready**
  useEffect(() => {
    if (localStream && 
        socketRef.current && 
        socketRef.current.connected && 
        user && 
        user.id && 
        user.gender &&
        connectionStatus === 'Connected! Starting search...') {
      
      console.log('✅ All ready - starting partner search');
      setTimeout(() => {
        findPartner();
      }, 2000);
    }
  }, [localStream, user, connectionStatus, findPartner]);

  return (
    <Container>
      <ConnectionStatus status={
        connectionStatus === 'Connected!' ? 'connected' :
        isConnecting || connectionStatus.includes('connecting') || connectionStatus.includes('Connecting') ? 'connecting' :
        'disconnected'
      }>
        {connectionStatus}
      </ConnectionStatus>

      <DebugInfo>
        Backend: ...{BACKEND_URL.split('.')[0].slice(-10)}<br/>
        User: {user?.id?.slice(-8)}<br/>
        Gender: {user?.gender}<br/>
        Status: {debugInfo}
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
