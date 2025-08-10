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
    content: ${props => props.$hasStream ? '""' : '"👋 Waiting for partner..."'};
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    z-index: 1;
    text-align: center;
    background: ${props => props.$hasStream ? 'transparent' : 'linear-gradient(45deg, #2c3e50, #3498db)'};
    padding: ${props => props.$hasStream ? '0' : '20px'};
    border-radius: ${props => props.$hasStream ? '0' : '10px'};
    width: ${props => props.$hasStream ? 'auto' : '80%'};
    max-width: 300px;
    display: ${props => props.$hasStream ? 'none' : 'block'};
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
    console.log(`[VideoChat ${new Date().toLocaleTimeString()}]`, message);
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
      debug('📹 Requesting camera/microphone access...');
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Ensure all tracks are enabled
      mediaStream.getTracks().forEach(track => {
        track.enabled = true;
        debug(`✅ Track enabled: ${track.kind} - ${track.label}`);
      });
      
      debug(`✅ Media stream obtained - Video: ${mediaStream.getVideoTracks().length}, Audio: ${mediaStream.getAudioTracks().length}`);
      return mediaStream;
    } catch (err) {
      debug(`❌ Media access failed: ${err.message}`);
      throw new Error(`Camera/Microphone access denied: ${err.message}`);
    }
  };

  // CRITICAL FIX: Proper video setup with user interaction handling
  const setupVideo = async (videoElement, stream, type = 'unknown') => {
    if (!videoElement || !stream) {
      debug(`❌ Video setup failed - missing element or stream for ${type}`);
      return false;
    }
    
    try {
      debug(`🎬 Setting up ${type} video...`);
      
      // Clear any existing stream first
      if (videoElement.srcObject) {
        const existingTracks = videoElement.srcObject.getTracks();
        existingTracks.forEach(track => track.stop());
        videoElement.srcObject = null;
      }
      
      // Set the stream
      videoElement.srcObject = stream;
      
      // CRITICAL: Configure video element properties
      videoElement.playsInline = true;
      videoElement.autoplay = true;
      videoElement.controls = false;
      videoElement.muted = type === 'local'; // Only mute local video to prevent feedback
      videoElement.volume = type === 'partner' ? 1.0 : 0.0; // Ensure partner audio is audible
      
      // Set essential attributes for mobile
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.setAttribute('autoplay', 'true');
      
      // CRITICAL FIX: Wait for loadedmetadata event
      return new Promise((resolve) => {
        const handleMetadata = async () => {
          debug(`📊 ${type} video metadata loaded`);
          
          // Try to play the video
          try {
            await videoElement.play();
            debug(`▶️ ${type} video playing successfully`);
            resolve(true);
          } catch (playErr) {
            debug(`⚠️ ${type} video play error (may require user interaction): ${playErr.message}`);
            
            // For partner video, try to play on first user interaction
            if (type === 'partner') {
              const playOnInteraction = async () => {
                try {
                  await videoElement.play();
                  debug(`▶️ ${type} video playing after user interaction`);
                  document.removeEventListener('click', playOnInteraction);
                  document.removeEventListener('touchstart', playOnInteraction);
                } catch (err) {
                  debug(`❌ ${type} video still failed to play: ${err.message}`);
                }
              };
              
              document.addEventListener('click', playOnInteraction, { once: true });
              document.addEventListener('touchstart', playOnInteraction, { once: true });
            }
            
            resolve(true); // Consider it successful even if autoplay failed
          }
        };
        
        if (videoElement.readyState >= 1) {
          // Metadata already loaded
          handleMetadata();
        } else {
          videoElement.addEventListener('loadedmetadata', handleMetadata, { once: true });
          
          // Fallback timeout
          setTimeout(() => {
            debug(`⏰ ${type} video metadata timeout`);
            resolve(false);
          }, 5000);
        }
      });
      
    } catch (err) {
      debug(`❌ ${type} video setup failed completely: ${err.message}`);
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

  // CRITICAL FIX: Enhanced peer creation with proper stream handling
  const createPeer = (initiator, localStream) => {
    debug(`🤝 Creating peer - initiator: ${initiator}`);
    
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

    // CRITICAL: Enhanced stream handling with proper setup
    peer.on('stream', async (remoteStream) => {
      debug(`🎥 REMOTE STREAM RECEIVED with ${remoteStream.getTracks().length} tracks`);
      
      // Log detailed track information
      remoteStream.getTracks().forEach((track, index) => {
        debug(`📡 Remote Track ${index + 1}: ${track.kind} - ${track.label} - enabled: ${track.enabled} - readyState: ${track.readyState}`);
      });
      
      // CRITICAL: Set partner stream state IMMEDIATELY
      setPartnerStream(remoteStream);
      
      // CRITICAL: Setup partner video with immediate execution
      if (partnerVideo.current) {
        debug('🎬 Setting up partner video element...');
        
        const success = await setupVideo(partnerVideo.current, remoteStream, 'partner');
        
        if (success) {
          debug('✅ Partner video setup successful - YOU SHOULD SEE PARTNER NOW!');
          setStatus('🎥 Connected - You can see each other!');
        } else {
          debug('❌ Partner video setup failed');
          setStatus('⚠️ Connected but video issues detected');
        }
      } else {
        debug('❌ Partner video element not available');
        setStatus('❌ Partner video element not found');
      }
    });

    // Enhanced connection state monitoring
    peer.on('connect', () => {
      debug('✅ Peer connection established (data channel)');
      setCallAccepted(true);
    });

    peer.on('error', (err) => {
      debug(`❌ Peer error: ${err.type || 'unknown'} - ${err.message}`);
      setStatus('❌ Connection failed. Finding new partner...');
      setTimeout(() => findPartner(), 3000);
    });

    peer.on('close', () => {
      debug('🔌 Peer connection closed');
      setStatus('👋 Partner disconnected');
    });

    // Monitor ICE connection state
    if (peer._pc) {
      peer._pc.oniceconnectionstatechange = () => {
        debug(`🧊 ICE connection state: ${peer._pc.iceConnectionState}`);
        if (peer._pc.iceConnectionState === 'connected') {
          debug('🎉 ICE connection established successfully!');
        } else if (peer._pc.iceConnectionState === 'failed') {
          debug('💔 ICE connection failed');
          setStatus('❌ Connection failed due to network issues');
        }
      };
    }

    return peer;
  };

  // Initialize media and socket connection
  useEffect(() => {
    let mounted = true;

    const initializeChat = async () => {
      try {
        setStatus('🎥 Getting camera access...');
        debug('🚀 Starting initialization...');

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
        debug('🌐 Connecting to backend...');

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
        console.error('❌ Initialization error:', err);
        setStatus('❌ Camera/Microphone access denied. Please allow access and refresh.');
        debug(`💥 Initialization failed: ${err.message}`);
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
          $hasStream={!!partnerStream}
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
