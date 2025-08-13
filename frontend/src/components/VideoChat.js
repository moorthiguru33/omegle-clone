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

const ErrorMessage = styled.div`
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239, 68, 68, 0.9);
  color: white;
  padding: 12px 20px;
  border-radius: 25px;
  font-size: 14px;
  font-weight: 600;
  z-index: 1001;
  max-width: 90%;
  text-align: center;
`;

const StatusInfo = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-family: monospace;
  z-index: 1000;
`;

// Your actual Railway backend URL
const BACKEND_URL = 'https://omegle-clone-backend-production-8f06.up.railway.app';

// Reliable ICE servers
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
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Starting...');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [statusInfo, setStatusInfo] = useState('Initializing...');

  // Check user data on mount
  useEffect(() => {
    if (!user || !user.id) {
      console.log('❌ No user data, redirecting to home');
      navigate('/');
      return;
    }
    
    if (!user.gender) {
      console.log('❌ No gender selected, redirecting to home');
      navigate('/');
      return;
    }
    
    console.log('✅ User data valid:', user);
  }, [user, navigate]);

  // Get user media with better error handling
  const getUserMedia = useCallback(async () => {
    try {
      console.log('🎥 Requesting camera access...');
      setStatusInfo('Requesting camera...');
      setConnectionStatus('Requesting camera access...');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera access');
      }

      const constraints = {
        video: {
          width: { min: 320, ideal: 640 },
          height: { min: 240, ideal: 480 },
          frameRate: { ideal: 24 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Camera access granted');
      setLocalStream(stream);
      setStatusInfo('Camera ready');
      setConnectionStatus('Camera ready');
      setError(null);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        
        try {
          await localVideoRef.current.play();
          console.log('✅ Local video playing');
        } catch (playError) {
          console.warn('Local video autoplay failed:', playError);
        }
      }
      
      return stream;
    } catch (error) {
      console.error('❌ Camera access failed:', error);
      
      let errorMessage = 'Camera access failed';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please allow camera access and refresh the page.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and refresh.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is being used by another application.';
      }
      
      setError(errorMessage);
      setConnectionStatus(errorMessage);
      setStatusInfo('Camera error');
      throw error;
    }
  }, []);

  // Initialize socket connection
  const initializeSocket = useCallback(() => {
    console.log('🌐 Connecting to server:', BACKEND_URL);
    setStatusInfo('Connecting to server...');
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
      reconnectionDelay: 1000
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server');
      setConnectionStatus('Connected! Finding partner...');
      setStatusInfo(`Connected: ${socketRef.current.id.slice(-6)}`);
      setError(null);
      
      // Auto-start partner search after connection
      setTimeout(() => {
        if (user && user.id && user.gender) {
          findPartner();
        }
      }, 1000);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ Disconnected:', reason);
      setConnectionStatus('Disconnected from server');
      setStatusInfo(`Disconnected: ${reason}`);
      setError('Connection lost. Trying to reconnect...');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setConnectionStatus('Connection failed');
      setStatusInfo('Connection failed');
      setError('Failed to connect to server. Please refresh the page.');
    });

    // Handle partner matching
    socketRef.current.on('matched', (partnerId) => {
      console.log('🎯 Partner found:', partnerId);
      setConnectionStatus('Partner found! Connecting...');
      setStatusInfo(`Matched: ${partnerId.slice(-6)}`);
      setIsConnecting(true);
      setError(null);
      
      setTimeout(() => {
        initiateCall();
      }, 1000);
    });

    socketRef.current.on('waiting', () => {
      console.log('⏳ Waiting for partner...');
      setConnectionStatus('Looking for partner...');
      setStatusInfo('In queue');
      setIsConnecting(false);
    });

    // Handle WebRTC signaling
    socketRef.current.on('offer', async (offer) => {
      console.log('📞 Received offer');
      setConnectionStatus('Incoming call...');
      setStatusInfo('Received offer');
      setIsConnecting(true);
      await handleOffer(offer);
    });

    socketRef.current.on('answer', async (answer) => {
      console.log('✅ Received answer');
      setStatusInfo('Received answer');
      await handleAnswer(answer);
    });

    socketRef.current.on('ice-candidate', async (candidate) => {
      await handleIceCandidate(candidate);
    });

    socketRef.current.on('partnerDisconnected', () => {
      console.log('👋 Partner disconnected');
      setConnectionStatus('Partner disconnected');
      setStatusInfo('Partner left');
      setRemoteStream(null);
      setIsConnecting(false);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      setTimeout(() => {
        findPartner();
      }, 2000);
    });

    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
      setError('Connection error occurred');
      setStatusInfo('Socket error');
    });

  }, [user]);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    const config = { iceServers: ICE_SERVERS };
    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log('🎬 Received remote stream');
      const [stream] = event.streams;
      setRemoteStream(stream);
      setConnectionStatus('Connected!');
      setStatusInfo('Video call active');
      setIsConnecting(false);
      setError(null);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.playsInline = true;
        
        remoteVideoRef.current.play().catch(error => {
          console.warn('Remote video play failed:', error);
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setStatusInfo(`WebRTC: ${pc.connectionState}`);
      
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setTimeout(() => findPartner(), 3000);
      }
    };

    return pc;
  }, []);

  // Find partner function
  const findPartner = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.log('❌ Socket not connected');
      return;
    }

    if (!user || !user.id || !user.gender) {
      console.log('❌ Invalid user data');
      return;
    }

    console.log('🔍 Looking for partner...');
    setConnectionStatus('Looking for partner...');
    setStatusInfo('Searching...');
    setIsConnecting(false);
    setError(null);

    // Clean up previous connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Send find partner request
    const userData = {
      userId: user.id,
      gender: user.gender,
      preferredGender: user.preferredGender || 'any',
      hasFilterCredit: (user.filterCredits > 0) || user.isPremium
    };

    console.log('📤 Sending findPartner:', userData);
    socketRef.current.emit('findPartner', userData);
  }, [user]);

  // Initiate call
  const initiateCall = useCallback(async () => {
    if (!localStream || !socketRef.current) return;

    try {
      console.log('📞 Starting call...');
      peerConnectionRef.current = createPeerConnection();

      // Add tracks
      localStream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStream);
      });

      // Create offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      socketRef.current.emit('offer', offer);
      setStatusInfo('Sent offer');

    } catch (error) {
      console.error('❌ Failed to start call:', error);
      setError('Failed to start call');
    }
  }, [localStream, createPeerConnection]);

  // Handle offer
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

      socketRef.current.emit('answer', answer);
      setStatusInfo('Sent answer');

    } catch (error) {
      console.error('❌ Failed to handle offer:', error);
    }
  }, [localStream, createPeerConnection]);

  // Handle answer
  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
    } catch (error) {
      console.error('❌ Failed to handle answer:', error);
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
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

    setTimeout(() => findPartner(), 1000);
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
      socketRef.current.emit('endCall');
      socketRef.current.disconnect();
    }

    navigate('/');
  };

  // Initialize on mount
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
      // Cleanup
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

  // Auto find partner when ready
  useEffect(() => {
    if (localStream && 
        socketRef.current && 
        socketRef.current.connected && 
        user && 
        user.id && 
        user.gender &&
        connectionStatus === 'Connected! Finding partner...') {
      
      setTimeout(() => findPartner(), 1000);
    }
  }, [localStream, user, connectionStatus, findPartner]);

  return (
    <Container>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      
      <ConnectionStatus status={
        connectionStatus.includes('Connected!') ? 'connected' :
        isConnecting || connectionStatus.includes('Connecting') || connectionStatus.includes('connecting') ? 'connecting' :
        'disconnected'
      }>
        {connectionStatus}
      </ConnectionStatus>

      <StatusInfo>
        User: {user?.id?.slice(-8)}<br/>
        Status: {statusInfo}
      </StatusInfo>

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
