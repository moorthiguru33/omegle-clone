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
  
  /* Enhanced mobile support */
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://omegle-clone-backend-production-8f06.up.railway.app';

// Enhanced ICE servers with more reliable options
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Public TURN servers (replace with your own for production)
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
  }
];

const VideoChat = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerConnectionRef = useRef();
  const connectionTimeoutRef = useRef();
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('initializing');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Enhanced getUserMedia with mobile optimizations
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
      console.log('🎥 Requesting media access...');
      setConnectionStatus('Requesting camera/microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setError(null);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      console.log('✅ Media access granted');
      return stream;
    } catch (error) {
      console.error('❌ Media access failed:', error);
      
      let errorMessage = 'Camera/microphone access failed. ';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone access denied. Please allow access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera/microphone found. Please connect a device and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera/microphone is already in use by another application.';
      }
      
      setError(errorMessage);
      setConnectionStatus('Media access failed');
      
      // Try with fallback constraints
      try {
        const fallbackConstraints = {
          video: { width: 320, height: 240, frameRate: 15 },
          audio: true
        };
        const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        setLocalStream(fallbackStream);
        setError(null);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = fallbackStream;
        }
        
        console.log('✅ Fallback media access granted');
        return fallbackStream;
      } catch (fallbackError) {
        console.error('❌ Fallback media access failed:', fallbackError);
        throw error;
      }
    }
  }, []);
  
  // Create peer connection with enhanced configuration
  const createPeerConnection = useCallback(() => {
    const config = {
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all'
    };
    
    const pc = new RTCPeerConnection(config);
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.connected) {
        console.log('📡 Sending ICE candidate');
        socketRef.current.emit('ice-candidate', event.candidate);
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
      
      setConnectionStatus('connected');
      setIsConnecting(false);
      clearTimeout(connectionTimeoutRef.current);
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      
      switch (pc.connectionState) {
        case 'connected':
          setConnectionStatus('connected');
          setIsConnecting(false);
          setRetryCount(0);
          clearTimeout(connectionTimeoutRef.current);
          break;
        case 'disconnected':
          setConnectionStatus('Partner disconnected');
          setIsConnecting(false);
          setTimeout(() => findPartner(), 3000);
          break;
        case 'failed':
          setConnectionStatus('Connection failed');
          setIsConnecting(false);
          setTimeout(() => findPartner(), 2000);
          break;
        case 'connecting':
          setConnectionStatus('Connecting to partner...');
          setIsConnecting(true);
          // Set connection timeout
          connectionTimeoutRef.current = setTimeout(() => {
            if (pc.connectionState === 'connecting') {
              console.log('⏰ Connection timeout, trying next partner');
              nextPartner();
            }
          }, 30000);
          break;
        default:
          break;
      }
    };
    
    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.log('❌ ICE connection failed, retrying...');
        if (retryCount < 3) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => nextPartner(), 2000);
        } else {
          setConnectionStatus('Connection failed. Please refresh and try again.');
        }
      }
    };
    
    return pc;
  }, [retryCount]);
  
  // Initialize socket connection
  const initializeSocket = useCallback(() => {
    if (socketRef.current?.connected) {
      return; // Already connected
    }
    
    console.log('🌐 Connecting to signaling server...');
    setConnectionStatus('Connecting to server...');
    
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
      setConnectionStatus('Connected to server');
      setError(null);
    });
    
    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ Disconnected from signaling server:', reason);
      setConnectionStatus('Disconnected from server');
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        setTimeout(() => initializeSocket(), 3000);
      }
    });
    
    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setConnectionStatus('Server connection failed');
      setError('Failed to connect to server. Please check your internet connection.');
    });
    
    // Handle partner found
    socketRef.current.on('matched', (partnerId) => {
      console.log('🎯 Partner matched:', partnerId);
      setConnectionStatus('Partner found! Connecting...');
      setIsConnecting(true);
      
      setTimeout(() => {
        initiateCall();
      }, 1000);
    });
    
    // Handle waiting for partner
    socketRef.current.on('waiting', () => {
      setConnectionStatus('Looking for partner...');
      setIsConnecting(false);
    });
    
    // Handle incoming call
    socketRef.current.on('offer', async (offer) => {
      console.log('📞 Received call offer');
      setConnectionStatus('Incoming call... Connecting...');
      setIsConnecting(true);
      
      await handleOffer(offer);
    });
    
    // Handle call answer
    socketRef.current.on('answer', async (answer) => {
      console.log('✅ Received call answer');
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
      clearTimeout(connectionTimeoutRef.current);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      
      // Auto find new partner after delay
      setTimeout(() => {
        findPartner();
      }, 2000);
    });

    // Handle errors
    socketRef.current.on('error', (error) => {
      console.error('❌ Socket error:', error);
      setError('Connection error occurred');
    });
  }, []);
  
  // Initiate a call (create offer)
  const initiateCall = useCallback(async () => {
    if (!localStream || !socketRef.current?.connected) {
      console.log('❌ Cannot initiate call: missing stream or socket');
      return;
    }
    
    try {
      peerConnectionRef.current = createPeerConnection();
      
      // Add local stream tracks
      localStream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStream);
      });
      
      // Create and send offer
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnectionRef.current.setLocalDescription(offer);
      
      console.log('📞 Sending call offer');
      socketRef.current.emit('offer', offer);
      
    } catch (error) {
      console.error('❌ Failed to initiate call:', error);
      setConnectionStatus('Failed to initiate call');
      setTimeout(() => nextPartner(), 2000);
    }
  }, [localStream, createPeerConnection]);
  
  // Handle incoming offer
  const handleOffer = useCallback(async (offer) => {
    if (!localStream) {
      console.log('❌ Cannot handle offer: missing local stream');
      return;
    }
    
    try {
      peerConnectionRef.current = createPeerConnection();
      
      // Add local stream tracks
      localStream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStream);
      });
      
      await peerConnectionRef.current.setRemoteDescription(offer);
      
      // Create and send answer
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      console.log('📞 Sending call answer');
      socketRef.current.emit('answer', answer);
      
    } catch (error) {
      console.error('❌ Failed to handle offer:', error);
      setConnectionStatus('Failed to connect');
      setTimeout(() => nextPartner(), 2000);
    }
  }, [localStream, createPeerConnection]);
  
  // Handle call answer
  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnectionRef.current) {
      console.log('❌ Cannot handle answer: no peer connection');
      return;
    }
    
    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
      console.log('✅ Call answer processed');
    } catch (error) {
      console.error('❌ Failed to handle answer:', error);
    }
  }, []);
  
  // Handle ICE candidates
  const handleIceCandidate = useCallback(async (candidate) => {
    if (!peerConnectionRef.current) {
      console.log('❌ Cannot handle ICE candidate: no peer connection');
      return;
    }
    
    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
      console.log('📡 ICE candidate added');
    } catch (error) {
      console.error('❌ Failed to add ICE candidate:', error);
    }
  }, []);
  
  // Find a partner
  const findPartner = useCallback(() => {
    if (!socketRef.current?.connected) {
      console.log('❌ Cannot find partner: not connected to server');
      setTimeout(() => findPartner(), 3000);
      return;
    }
    
    console.log('🔍 Looking for partner...');
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
    
    console.log('Sending user data:', userData);
    socketRef.current.emit('findPartner', userData);
  }, [user]);
  
  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
        console.log(`🎤 Audio ${!audioEnabled ? 'enabled' : 'disabled'}`);
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
        console.log(`📹 Video ${!videoEnabled ? 'enabled' : 'disabled'}`);
      }
    }
  }, [localStream, videoEnabled]);
  
  // End call and find next partner
  const nextPartner = useCallback(() => {
    console.log('🔄 Finding next partner...');
    
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
    console.log('🛑 Stopping call');
    
    clearTimeout(connectionTimeoutRef.current);
    
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
    initializeSocket();
  }, [initializeSocket]);
  
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
    
    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up VideoChat component');
      
      clearTimeout(connectionTimeoutRef.current);
      
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
    if (localStream && socketRef.current?.connected && !isConnecting && connectionStatus !== 'connected') {
      console.log('🚀 Auto-finding partner...');
      setTimeout(() => findPartner(), 1000);
    }
  }, [localStream, findPartner, isConnecting, connectionStatus]);
  
  // Redirect to home if no user data
  useEffect(() => {
    if (!user.id || !user.gender) {
      console.log('❌ No user data, redirecting to home');
      navigate('/');
    }
  }, [user, navigate]);
  
  if (error && error.includes('Camera/microphone')) {
    return (
      <Container>
        <ErrorMessage>
          <div>❌ {error}</div>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </ErrorMessage>
      </Container>
    );
  }
  
  return (
    <Container>
      <ConnectionStatus status={
        connectionStatus.includes('connected') ? 'connected' : 
        connectionStatus.includes('connecting') || connectionStatus.includes('Looking') || isConnecting ? 'connecting' : 'disconnected'
      }>
        {connectionStatus}
      </ConnectionStatus>
      
      <VideoContainer>
        <VideoWrapper>
          <Video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMDAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+"
          />
          <VideoLabel>You {!videoEnabled && '(Camera Off)'}</VideoLabel>
        </VideoWrapper>
        
        <VideoWrapper>
          {remoteStream ? (
            <Video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMDAwIi8+PC9zdmc+"
            />
          ) : (
            <PlaceholderMessage>
              {isConnecting ? '🔄 Connecting...' : 
               error ? '❌ Connection error' :
               connectionStatus.includes('Looking') ? '👋 Looking for partner...' : 
               '💭 Waiting for partner...'}
            </PlaceholderMessage>
          )}
          <VideoLabel>Partner</VideoLabel>
        </VideoWrapper>
      </VideoContainer>
      
      <Controls>
        <ControlButton
          className="control"
          active={audioEnabled}
          onClick={toggleAudio}
          title={audioEnabled ? 'Mute audio' : 'Unmute audio'}
          disabled={!localStream}
        >
          {audioEnabled ? '🎤' : '🔇'}
        </ControlButton>
        
        <ControlButton
          className="control"
          active={videoEnabled}
          onClick={toggleVideo}
          title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          disabled={!localStream}
        >
          {videoEnabled ? '📹' : '📷'}
        </ControlButton>
        
        <ControlButton
          className="primary"
          onClick={stopCall}
          title="End call and go home"
        >
          🏠
        </ControlButton>
        
        <ControlButton
          className="secondary"
          onClick={nextPartner}
          disabled={isConnecting || !localStream}
          title="Find next partner"
        >
          {isConnecting ? '⏳' : '🔄'}
        </ControlButton>
        
        {error && !error.includes('Camera/microphone') && (
          <ControlButton
            className="control"
            onClick={retryConnection}
            title="Retry connection"
          >
            🔁
          </ControlButton>
        )}
      </Controls>
    </Container>
  );
};

export default VideoChat;
