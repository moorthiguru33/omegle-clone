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
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
  -webkit-playsinline: true;
  playsinline: true;
  muted: ${props => props.muted || false};
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

  &:active:not(:disabled) {
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
  z-index: 5;
  
  @media (max-width: 480px) {
    font-size: 16px;
  }
`;

const ErrorMessage = styled.div`
  position: absolute;
  top: 20px;
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

// Environment-based backend URL
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://omegle-clone-backend-production-8f06.up.railway.app' 
    : 'http://localhost:5000');

// Enhanced ICE servers with reliable public servers
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Reliable free TURN servers
  {
    urls: 'turn:relay1.expressturn.com:3478',
    username: 'efJBIBF0YZZASRS6Q4',
    credential: 'sTunRaPkAVdAr7DyOo'
  },
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
  const connectionTimeoutRef = useRef();
  const retryTimeoutRef = useRef();
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('initializing');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Clear all timeouts
  const clearTimeouts = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Enhanced getUserMedia with progressive fallback
  const getUserMedia = useCallback(async () => {
    const constraints = [
      // First try: HD quality
      {
        video: {
          width: { min: 320, ideal: 720, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
          frameRate: { min: 15, ideal: 24, max: 30 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      },
      // Fallback: Standard quality
      {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 },
          facingMode: 'user'
        },
        audio: true
      },
      // Final fallback: Basic quality
      {
        video: { 
          width: 320, 
          height: 240,
          facingMode: 'user'
        },
        audio: true
      },
      // Last resort: Audio only
      {
        video: false,
        audio: true
      }
    ];

    setError(null);

    for (let i = 0; i < constraints.length; i++) {
      try {
        console.log(`🎥 Attempting media access with constraints ${i + 1}/${constraints.length}`);
        const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
        
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          // Ensure video plays on mobile
          localVideoRef.current.playsInline = true;
          localVideoRef.current.muted = true;
          
          try {
            await localVideoRef.current.play();
          } catch (playError) {
            console.warn('Local video autoplay failed:', playError);
          }
        }
        
        console.log(`✅ Media access successful with constraints ${i + 1}`);
        return stream;
        
      } catch (error) {
        console.warn(`❌ Media access failed with constraints ${i + 1}:`, error);
        
        if (i === constraints.length - 1) {
          // All attempts failed
          const errorMessage = error.name === 'NotAllowedError' 
            ? 'Camera/microphone access denied. Please allow access and refresh the page.'
            : error.name === 'NotFoundError'
            ? 'No camera/microphone found. Please connect a device and refresh.'
            : 'Failed to access camera/microphone. Please check your device and try again.';
          
          setError(errorMessage);
          throw new Error(errorMessage);
        }
      }
    }
  }, []);

  // Create peer connection with enhanced error handling
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
      if (event.candidate && socketRef.current) {
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
        remoteVideoRef.current.playsInline = true;
        
        // Try to play remote video
        remoteVideoRef.current.play().catch(error => {
          console.warn('Remote video play failed:', error);
        });
      }
      
      setConnectionStatus('connected');
      setIsConnecting(false);
      clearTimeouts();
      setRetryCount(0);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      
      switch (pc.connectionState) {
        case 'connected':
          setConnectionStatus('connected');
          setIsConnecting(false);
          clearTimeouts();
          setRetryCount(0);
          break;
          
        case 'disconnected':
        case 'failed':
          console.log('Connection failed or disconnected');
          setConnectionStatus('Connection lost');
          setIsConnecting(false);
          
          // Auto-retry with exponential backoff
          if (retryCount < 3) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            retryTimeoutRef.current = setTimeout(() => {
              setRetryCount(prev => prev + 1);
              findPartner();
            }, delay);
          } else {
            setConnectionStatus('Connection failed. Please try again.');
          }
          break;
          
        case 'connecting':
          setConnectionStatus('connecting');
          setIsConnecting(true);
          
          // Set connection timeout
          connectionTimeoutRef.current = setTimeout(() => {
            console.log('Connection timeout');
            setConnectionStatus('Connection timeout');
            setIsConnecting(false);
            if (pc.connectionState !== 'connected') {
              findPartner();
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
        console.log('ICE connection failed, attempting restart');
        pc.restartIce();
      }
    };

    return pc;
  }, [retryCount, clearTimeouts]);

  // Initialize socket connection with retry logic
  const initializeSocket = useCallback(() => {
    console.log('🌐 Connecting to signaling server...');
    
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
      setConnectionStatus('Looking for partner...');
      setError(null);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ Disconnected from signaling server:', reason);
      setConnectionStatus('Disconnected from server');
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        setTimeout(() => {
          if (socketRef.current) {
            socketRef.current.connect();
          }
        }, 2000);
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
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
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      // Auto find new partner after delay
      setTimeout(() => {
        findPartner();
      }, 2000);
    });

    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
      setError('Connection error occurred. Trying to reconnect...');
    });

  }, []);

  // Initiate a call (create offer)
  const initiateCall = useCallback(async () => {
    if (!localStream || !socketRef.current) return;

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
      setError('Failed to start call. Please try again.');
    }
  }, [localStream, createPeerConnection]);

  // Handle incoming offer
  const handleOffer = useCallback(async (offer) => {
    if (!localStream) return;

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
      setError('Failed to answer call. Please try again.');
    }
  }, [localStream, createPeerConnection]);

  // Handle call answer
  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
      console.log('✅ Call answer processed');
    } catch (error) {
      console.error('❌ Failed to handle answer:', error);
      setError('Failed to process call answer.');
    }
  }, []);

  // Handle ICE candidates
  const handleIceCandidate = useCallback(async (candidate) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
      console.log('📡 ICE candidate added');
    } catch (error) {
      console.error('❌ Failed to add ICE candidate:', error);
    }
  }, []);

  // Find a partner with improved credit handling
  const findPartner = useCallback(() => {
    if (!socketRef.current) return;

    console.log('🔍 Looking for partner...');
    setConnectionStatus('Looking for partner...');
    setIsConnecting(false);
    setError(null);
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

    // Determine if user has filter credits
    const hasFilterCredit = user.isPremium || user.filterCredits > 0;
    const shouldUseFilter = user.preferredGender && 
                           user.preferredGender !== 'any' && 
                           hasFilterCredit;

    socketRef.current.emit('findPartner', {
      userId: user.id,
      gender: user.gender,
      preferredGender: shouldUseFilter ? user.preferredGender : 'any',
      hasFilterCredit: hasFilterCredit
    });

    // Update user credits if filter is used
    if (shouldUseFilter && !user.isPremium && user.filterCredits > 0) {
      const updatedUser = {
        ...user,
        filterCredits: user.filterCredits - 1
      };
      updateUser(updatedUser);
    }
  }, [user, updateUser, clearTimeouts]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
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
      }
    }
  }, [localStream, videoEnabled]);

  // End call and find next partner
  const nextPartner = useCallback(() => {
    console.log('🔄 Finding next partner...');
    
    clearTimeouts();
    
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
  }, [findPartner, clearTimeouts]);

  // Stop call and go home
  const stopCall = useCallback(() => {
    console.log('🛑 Stopping call');
    
    clearTimeouts();
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
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
  }, [localStream, navigate, clearTimeouts]);

  // Initialize everything
  useEffect(() => {
    const init = async () => {
      try {
        await getUserMedia();
        initializeSocket();
      } catch (error) {
        console.error('❌ Initialization failed:', error);
        setConnectionStatus('Initialization failed');
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up VideoChat component');
      
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
  }, [getUserMedia, initializeSocket, clearTimeouts]);

  // Auto-find partner when local stream is ready
  useEffect(() => {
    if (localStream && socketRef.current && socketRef.current.connected) {
      setTimeout(() => {
        findPartner();
      }, 1000);
    }
  }, [localStream, findPartner]);

  // Redirect if user data is invalid
  useEffect(() => {
    if (!user || !user.id || !user.gender) {
      console.log('Invalid user data, redirecting to home');
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <Container>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      
      <ConnectionStatus status={
        connectionStatus === 'connected' ? 'connected' :
        isConnecting || connectionStatus.includes('connecting') ? 'connecting' :
        'disconnected'
      }>
        {connectionStatus}
      </ConnectionStatus>

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
          title={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
        >
          {audioEnabled ? '🎤' : '🔇'}
        </ControlButton>

        <ControlButton
          className="control"
          active={videoEnabled}
          onClick={toggleVideo}
          disabled={!localStream}
          title={videoEnabled ? 'Turn Off Video' : 'Turn On Video'}
        >
          {videoEnabled ? '📹' : '📷'}
        </ControlButton>

        <ControlButton
          className="secondary"
          onClick={nextPartner}
          disabled={isConnecting}
          title="Find Next Partner"
        >
          ⏭️
        </ControlButton>

        <ControlButton
          className="primary"
          onClick={stopCall}
          title="End Call"
        >
          ❌
        </ControlButton>

        <ControlButton
          className="home"
          onClick={stopCall}
          title="Go Home"
        >
          🏠
        </ControlButton>
      </Controls>
    </Container>
  );
};

export default VideoChat;
