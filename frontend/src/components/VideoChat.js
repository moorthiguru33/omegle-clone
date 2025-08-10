import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const VideoContainer = styled.div`
  display: flex;
  flex: 1;
  position: relative;
  gap: 2px;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const Video = styled.video`
  width: 50%;
  height: 100%;
  object-fit: cover;
  background: #000;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  
  @media (max-width: 768px) {
    width: 100%;
    height: 50vh;
    border-radius: 0;
  }
`;

const MyVideo = styled(Video)`
  border-right: 2px solid rgba(255,255,255,0.1);
  
  @media (max-width: 768px) {
    border-right: none;
    border-bottom: 2px solid rgba(255,255,255,0.1);
  }
`;

const PartnerVideo = styled(Video)`
  position: relative;
  
  &::before {
    content: ${props => props.hasStream ? '""' : '"👋 Waiting for partner..."'};
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    z-index: 1;
    text-align: center;
    background: ${props => props.hasStream ? 'transparent' : 'linear-gradient(45deg, #2c3e50, #3498db)'};
    padding: ${props => props.hasStream ? '0' : '20px'};
    border-radius: ${props => props.hasStream ? '0' : '10px'};
    width: ${props => props.hasStream ? 'auto' : '80%'};
    max-width: 300px;
  }
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  gap: 15px;
  flex-wrap: wrap;
  border-top: 1px solid rgba(255,255,255,0.2);
`;

const Button = styled.button`
  padding: 12px 24px;
  border: none;
  border-radius: 50px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  &.stop {
    background: linear-gradient(45deg, #e74c3c, #c0392b);
    color: white;
    box-shadow: 0 4px 15px rgba(231,76,60,0.3);
    
    &:hover { 
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(231,76,60,0.4);
    }
  }

  &.next {
    background: linear-gradient(45deg, #27ae60, #2ecc71);
    color: white;
    box-shadow: 0 4px 15px rgba(39,174,96,0.3);
    
    &:hover { 
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(39,174,96,0.4);
    }
  }

  &.home {
    background: linear-gradient(45deg, #95a5a6, #34495e);
    color: white;
    box-shadow: 0 4px 15px rgba(149,165,166,0.3);
    
    &:hover { 
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(149,165,166,0.4);
    }
  }

  &.control {
    background: linear-gradient(45deg, #f39c12, #e67e22);
    color: white;
    box-shadow: 0 4px 15px rgba(243,156,18,0.3);
    min-width: 60px;
    
    &:hover { 
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(243,156,18,0.4);
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const Status = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  background: ${props => {
    if (props.status.includes('Connected') || props.status.includes('partner')) return 'rgba(39, 174, 96, 0.9)';
    if (props.status.includes('Looking') || props.status.includes('Connecting')) return 'rgba(241, 196, 15, 0.9)';
    if (props.status.includes('failed') || props.status.includes('Error')) return 'rgba(231, 76, 60, 0.9)';
    return 'rgba(52, 73, 94, 0.9)';
  }};
  color: white;
  padding: 12px 20px;
  border-radius: 25px;
  font-size: 14px;
  font-weight: 600;
  z-index: 1000;
  max-width: 300px;
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255,255,255,0.2);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
`;

const VideoChat = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const myVideo = useRef();
  const partnerVideo = useRef();
  const connectionRef = useRef();
  const socket = useRef();
  
  const [stream, setStream] = useState();
  const [partnerStream, setPartnerStream] = useState();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [isConnected, setIsConnected] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://omegle-clone-backend-production-8f06.up.railway.app';

  // Debug logger
  const debug = (message) => {
    console.log('[VideoChat DEBUG]', message);
  };

  // Enhanced getUserMedia with mobile optimization
  const getUserMedia = async () => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const constraints = {
      video: {
        width: isMobile ? { min: 320, ideal: 480, max: 640 } : { min: 480, ideal: 720, max: 1280 },
        height: isMobile ? { min: 240, ideal: 360, max: 480 } : { min: 360, ideal: 480, max: 720 },
        frameRate: { min: 15, ideal: 24, max: 30 },
        facingMode: { ideal: 'user' }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100,
        channelCount: 1
      }
    };

    try {
      debug('Requesting camera/microphone access...');
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Ensure all tracks are enabled
      mediaStream.getTracks().forEach(track => {
        track.enabled = true;
        debug(`Track enabled: ${track.kind} - ${track.label}`);
      });
      
      debug(`Media stream obtained - Video: ${mediaStream.getVideoTracks().length}, Audio: ${mediaStream.getAudioTracks().length}`);
      return mediaStream;
    } catch (err) {
      debug(`Media access failed: ${err.message}`);
      throw new Error(`Camera/Microphone access denied: ${err.message}`);
    }
  };

  // Fixed video play function with multiple fallbacks
  const setupVideo = async (videoElement, stream, type = 'unknown') => {
    if (!videoElement || !stream) {
      debug(`Video setup failed - missing element or stream for ${type}`);
      return false;
    }
    
    try {
      debug(`Setting up ${type} video...`);
      
      // Clear any existing stream first
      if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
      }
      
      // Set the stream
      videoElement.srcObject = stream;
      
      // Configure video element properties
      videoElement.playsInline = true;
      videoElement.autoplay = true;
      videoElement.controls = false;
      videoElement.muted = type === 'local'; // Only mute local video to prevent feedback
      
      // Set essential attributes for mobile
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.setAttribute('autoplay', 'true');
      
      // Wait for metadata to load
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Metadata timeout')), 5000);
        
        videoElement.onloadedmetadata = () => {
          clearTimeout(timeout);
          debug(`${type} video metadata loaded`);
          resolve();
        };
        
        videoElement.onerror = (err) => {
          clearTimeout(timeout);
          reject(err);
        };
      });
      
      // Attempt to play with multiple retries
      for (let i = 0; i < 3; i++) {
        try {
          await videoElement.play();
          debug(`${type} video playing successfully`);
          return true;
        } catch (playErr) {
          debug(`${type} video play attempt ${i + 1} failed: ${playErr.message}`);
          
          if (playErr.name === 'NotAllowedError') {
            // User interaction required
            debug(`${type} video requires user interaction`);
            break;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      debug(`${type} video setup completed with potential play issues`);
      return true;
      
    } catch (err) {
      debug(`${type} video setup failed completely: ${err.message}`);
      return false;
    }
  };

  // Enhanced peer configuration with better TURN servers
  const getPeerConfig = () => ({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.relay.metered.ca:80' },
      {
        urls: 'turn:a.relay.metered.ca:80',
        username: 'a40c231adf24f7f89414c5be',
        credential: 'o+bz7wkBa2Cxr+n2'
      },
      {
        urls: 'turn:a.relay.metered.ca:80?transport=tcp',
        username: 'a40c231adf24f7f89414c5be',
        credential: 'o+bz7wkBa2Cxr+n2'
      },
      {
        urls: 'turn:a.relay.metered.ca:443',
        username: 'a40c231adf24f7f89414c5be',
        credential: 'o+bz7wkBa2Cxr+n2'
      }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  });

  // Enhanced peer creation with better stream handling
  const createPeer = (initiator, localStream) => {
    debug(`Creating peer - initiator: ${initiator}`);
    
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: localStream,
      config: getPeerConfig(),
      offerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: false
      }
    });

    // Enhanced stream handling
    peer.on('stream', async (remoteStream) => {
      debug(`🎥 Received remote stream with ${remoteStream.getTracks().length} tracks`);
      
      // Log track details
      remoteStream.getTracks().forEach(track => {
        debug(`Remote track: ${track.kind} - ${track.label} - enabled: ${track.enabled}`);
      });
      
      // Set partner stream state
      setPartnerStream(remoteStream);
      
      // Setup partner video with retry logic
      if (partnerVideo.current) {
        const success = await setupVideo(partnerVideo.current, remoteStream, 'partner');
        if (success) {
          debug('✅ Partner video setup successful');
          setStatus('🎥 Connected - You can see each other!');
        } else {
          debug('❌ Partner video setup failed');
          setStatus('⚠️ Connected but video issues detected');
        }
      } else {
        debug('❌ Partner video element not available');
      }
    });

    peer.on('connect', () => {
      debug('✅ Peer connection established');
      setCallAccepted(true);
    });

    peer.on('error', (err) => {
      debug(`❌ Peer error: ${err.message}`);
      setStatus('❌ Connection failed. Finding new partner...');
      setTimeout(() => findPartner(), 3000);
    });

    peer.on('close', () => {
      debug('🔌 Peer connection closed');
      setStatus('👋 Partner disconnected');
    });

    return peer;
  };

  // Initialize media and socket connection
  useEffect(() => {
    let mounted = true;

    const initializeChat = async () => {
      try {
        setStatus('🎥 Getting camera access...');
        debug('Starting initialization...');

        // Get user media first
        const currentStream = await getUserMedia();
        if (!mounted) return;

        setStream(currentStream);
        
        // Setup local video
        if (myVideo.current) {
          await setupVideo(myVideo.current, currentStream, 'local');
        }

        // Initialize socket connection
        setStatus('🔌 Connecting to server...');
        debug('Connecting to backend...');

        socket.current = io(BACKEND_URL, {
          transports: ['websocket', 'polling'],
          timeout: 20000,
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });

        setupSocketListeners();

      } catch (err) {
        console.error('Initialization error:', err);
        setStatus('❌ Camera/Microphone access denied. Please allow access and refresh.');
        debug(`Initialization failed: ${err.message}`);
      }
    };

    const setupSocketListeners = () => {
      socket.current.on('connect', () => {
        if (!mounted) return;
        debug('✅ Connected to server');
        setIsConnected(true);
        setStatus('✅ Connected! Looking for partner...');
        findPartner();
      });

      socket.current.on('disconnect', () => {
        if (!mounted) return;
        setIsConnected(false);
        setStatus('❌ Disconnected from server');
        debug('❌ Disconnected from server');
      });

      socket.current.on('matched', (partnerId) => {
        if (!mounted) return;
        debug(`🎯 Partner matched: ${partnerId}`);
        setStatus('🎯 Partner found! Connecting...');
        setTimeout(() => callUser(partnerId), 1000);
      });

      socket.current.on('waiting', () => {
        if (!mounted) return;
        setStatus('👀 Looking for a partner...');
        debug('👀 Added to waiting queue');
      });

      socket.current.on('callUser', (data) => {
        if (!mounted) return;
        debug(`📞 Incoming call from: ${data.from}`);
        setReceivingCall(true);
        setCaller(data.from);
        setCallerSignal(data.signal);
        setStatus('📞 Incoming call... Connecting...');
        // Auto-answer after a short delay
        setTimeout(() => answerCall(data.signal, data.from), 1500);
      });

      socket.current.on('callAccepted', (signal) => {
        if (!mounted) return;
        debug('✅ Call accepted by partner');
        setCallAccepted(true);
        if (connectionRef.current) {
          connectionRef.current.signal(signal);
        }
      });

      socket.current.on('partnerDisconnected', () => {
        if (!mounted) return;
        setStatus('👋 Partner disconnected');
        debug('👋 Partner disconnected');
        endCall();
      });
    };

    initializeChat();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (socket.current) {
        socket.current.disconnect();
      }
      if (connectionRef.current) {
        connectionRef.current.destroy();
      }
    };
  }, []);

  const callUser = useCallback((partnerId) => {
    if (!stream) {
      debug('❌ No local stream available for calling');
      return;
    }

    debug(`📞 Calling user: ${partnerId}`);
    const peer = createPeer(true, stream);

    peer.on('signal', (data) => {
      debug('📡 Sending call signal');
      socket.current.emit('callUser', {
        userToCall: partnerId,
        signalData: data,
        from: user.id
      });
    });

    connectionRef.current = peer;
  }, [stream, user.id]);

  const answerCall = useCallback(async (signal, from) => {
    if (!stream) {
      debug('❌ No local stream available for answering');
      return;
    }

    debug(`📞 Answering call from: ${from}`);
    const peer = createPeer(false, stream);

    peer.on('signal', (data) => {
      debug('📡 Sending answer signal');
      socket.current.emit('answerCall', { signal: data, to: from });
    });

    peer.signal(signal);
    connectionRef.current = peer;
    setReceivingCall(false);
  }, [stream]);

  const findPartner = () => {
    if (socket.current && socket.current.connected) {
      debug('🔍 Finding partner...');
      socket.current.emit('findPartner', {
        userId: user.id,
        gender: user.gender,
        preferredGender: user.preferredGender,
        hasFilterCredit: user.filterCredits > 0 || user.isPremium
      });
    }
  };

  const endCall = () => {
    debug('🛑 Ending call');
    setCallAccepted(false);
    setPartnerStream(null);
    setReceivingCall(false);
    
    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }

    if (partnerVideo.current) {
      partnerVideo.current.srcObject = null;
    }

    if (socket.current) {
      socket.current.emit('endCall');
    }

    setStatus('📞 Call ended');
  };

  const nextPartner = () => {
    debug('🔄 Looking for next partner');
    endCall();
    setStatus('🔍 Looking for new partner...');
    setTimeout(() => findPartner(), 1000);
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
        debug(`🎤 Audio ${audioEnabled ? 'disabled' : 'enabled'}`);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
        debug(`📹 Video ${videoEnabled ? 'disabled' : 'enabled'}`);
      }
    }
  };

  return (
    <Container>
      <Status status={status}>{status}</Status>
      
      <VideoContainer>
        <MyVideo ref={myVideo} autoPlay playsInline muted />
        <PartnerVideo 
          ref={partnerVideo} 
          autoPlay 
          playsInline 
          hasStream={!!partnerStream}
        />
      </VideoContainer>

      <Controls>
        <Button 
          className="home" 
          onClick={() => navigate('/')}
        >
          🏠 Home
        </Button>
        
        <Button 
          className="control" 
          onClick={toggleAudio}
        >
          {audioEnabled ? '🔊' : '🔇'}
        </Button>
        
        <Button 
          className="control" 
          onClick={toggleVideo}
        >
          {videoEnabled ? '📹' : '📷'}
        </Button>
        
        <Button 
          className="stop" 
          onClick={endCall}
          disabled={!callAccepted}
        >
          🛑 Stop
        </Button>
        
        <Button 
          className="next" 
          onClick={nextPartner}
        >
          🔄 Next
        </Button>
      </Controls>
    </Container>
  );
};

export default VideoChat;
