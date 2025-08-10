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
  ${props => !props.hasStream && `
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #fff;
    font-weight: 600;
    background: linear-gradient(45deg, #2c3e50, #3498db);
    
    &:before {
      content: '👋 Waiting for partner...';
      text-align: center;
    }
  `}
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
  const userVideo = useRef();
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
    console.log('[DEBUG]', message);
  };

  // Enhanced getUserMedia with mobile optimization
  const getUserMedia = async () => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const constraints = {
      video: {
        width: isMobile ? { min: 320, ideal: 480, max: 640 } : { min: 480, ideal: 720, max: 1280 },
        height: isMobile ? { min: 240, ideal: 640, max: 480 } : { min: 360, ideal: 480, max: 720 },
        frameRate: { min: 15, ideal: 24, max: 30 },
        facingMode: { ideal: 'user' }
      },
      audio: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        sampleRate: { ideal: 44100 },
        channelCount: { ideal: 1 }
      }
    };

    try {
      debug('Requesting camera/microphone access...');
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Ensure audio tracks are enabled
      mediaStream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log('Audio track enabled:', track.label);
      });
      
      // Ensure video tracks are enabled
      mediaStream.getVideoTracks().forEach(track => {
        track.enabled = true;
        console.log('Video track enabled:', track.label);
      });
      
      debug(`Media stream obtained - Video: ${mediaStream.getVideoTracks().length}, Audio: ${mediaStream.getAudioTracks().length}`);
      return mediaStream;
    } catch (err) {
      debug(`Media access failed: ${err.message}`);
      throw new Error(`Camera/Microphone access denied: ${err.message}`);
    }
  };

  // Fixed video play function
  const forceVideoPlay = async (videoElement, streamType = 'unknown') => {
    if (!videoElement || !videoElement.srcObject) return;
    
    try {
      // Essential mobile settings
      videoElement.muted = streamType === 'local'; // Only mute local video to prevent feedback
      videoElement.playsInline = true;
      videoElement.autoplay = true;
      videoElement.controls = false;
      
      // Set attributes for mobile compatibility
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.setAttribute('autoplay', 'true');
      
      // Multiple play attempts
      for (let i = 0; i < 5; i++) {
        try {
          await videoElement.play();
          debug(`${streamType} video playing successfully`);
          return;
        } catch (err) {
          if (err.name === 'NotAllowedError') {
            debug(`Video play blocked by user - attempt ${i + 1}`);
          } else if (err.name === 'AbortError') {
            debug(`Video play aborted - attempt ${i + 1}`);
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (err) {
      debug(`Video play completely failed for ${streamType}: ${err.message}`);
    }
  };

  // Enhanced peer configuration
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

  // Enhanced peer creation
  const createPeer = (initiator, stream) => {
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: stream,
      config: getPeerConfig(),
      offerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: false
      }
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

        // Get user media
        const currentStream = await getUserMedia();
        if (!mounted) return;

        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
          await forceVideoPlay(myVideo.current, 'local');
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
        debug('Connected to server');
        setIsConnected(true);
        setStatus('✅ Connected! Looking for partner...');
        findPartner();
      });

      socket.current.on('disconnect', () => {
        if (!mounted) return;
        setIsConnected(false);
        setStatus('❌ Disconnected from server');
        debug('Disconnected from server');
      });

      socket.current.on('matched', (partnerId) => {
        if (!mounted) return;
        debug(`Partner matched: ${partnerId}`);
        setStatus('🎯 Partner found! Connecting...');
        setTimeout(() => callUser(partnerId), 1000);
      });

      socket.current.on('waiting', () => {
        if (!mounted) return;
        setStatus('👀 Looking for a partner...');
        debug('Added to waiting queue');
      });

      socket.current.on('callUser', (data) => {
        if (!mounted) return;
        debug(`Incoming call from: ${data.from}`);
        setReceivingCall(true);
        setCaller(data.from);
        setCallerSignal(data.signal);
        setStatus('📞 Incoming call...');
        setTimeout(() => answerCall(data.signal, data.from), 1000);
      });

      socket.current.on('callAccepted', (signal) => {
        if (!mounted) return;
        debug('Call accepted');
        setCallAccepted(true);
        setStatus('🎥 Connected to partner');
        if (connectionRef.current) {
          connectionRef.current.signal(signal);
        }
      });

      socket.current.on('partnerDisconnected', () => {
        if (!mounted) return;
        setStatus('👋 Partner disconnected');
        debug('Partner disconnected');
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
    debug(`Calling user: ${partnerId}`);
    const peer = createPeer(true, stream);

    peer.on('signal', (data) => {
      debug('Sending call signal');
      socket.current.emit('callUser', {
        userToCall: partnerId,
        signalData: data,
        from: user.id
      });
    });

    peer.on('stream', async (partnerStream) => {
      debug(`Received partner stream`);
      setPartnerStream(partnerStream);
      
      if (userVideo.current) {
        userVideo.current.srcObject = partnerStream;
        // Don't mute partner video - you want to hear them!
        userVideo.current.muted = false;
        userVideo.current.volume = 1.0;
        await forceVideoPlay(userVideo.current, 'partner');
      }
    });

    peer.on('connect', () => {
      debug('Peer connected successfully');
      setCallAccepted(true);
      setStatus('🎥 Connected to partner');
    });

    peer.on('error', (err) => {
      debug(`Peer error: ${err.code} - ${err.message}`);
      setStatus('❌ Connection failed. Finding new partner...');
      setTimeout(() => findPartner(), 3000);
    });

    connectionRef.current = peer;
  }, [stream, user.id]);

  const answerCall = useCallback(async (signal, from) => {
    debug(`Answering call from: ${from}`);
    const peer = createPeer(false, stream);

    peer.on('signal', (data) => {
      debug('Sending answer signal');
      socket.current.emit('answerCall', { signal: data, to: from });
    });

    peer.on('stream', async (partnerStream) => {
      debug(`Received partner stream (answer)`);
      setPartnerStream(partnerStream);
      
      if (userVideo.current) {
        userVideo.current.srcObject = partnerStream;
        userVideo.current.muted = false; // Essential for hearing partner
        userVideo.current.volume = 1.0;
        await forceVideoPlay(userVideo.current, 'partner');
      }
      
      setCallAccepted(true);
      setStatus('🎥 Connected to partner');
    });

    peer.on('error', (err) => {
      debug(`Answer peer error: ${err.message}`);
      setStatus('❌ Connection failed');
    });

    peer.signal(signal);
    connectionRef.current = peer;
    setReceivingCall(false);
  }, [stream]);

  const findPartner = () => {
    if (socket.current && socket.current.connected) {
      debug('Finding partner...');
      socket.current.emit('findPartner', {
        userId: user.id,
        gender: user.gender,
        preferredGender: user.preferredGender,
        hasFilterCredit: user.filterCredits > 0 || user.isPremium
      });
    }
  };

  const endCall = () => {
    debug('Ending call');
    setCallAccepted(false);
    setPartnerStream(null);
    setReceivingCall(false);
    
    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }

    if (userVideo.current) {
      userVideo.current.srcObject = null;
    }

    if (socket.current) {
      socket.current.emit('endCall');
    }

    setStatus('📞 Call ended');
  };

  const nextPartner = () => {
    debug('Looking for next partner');
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
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  return (
    <Container>
      <Status status={status}>{status}</Status>
      
      <VideoContainer>
        <MyVideo ref={myVideo} autoPlay playsInline muted />
        <PartnerVideo 
          ref={userVideo} 
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
