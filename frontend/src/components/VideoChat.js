import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #000;
  position: relative;
  overflow: hidden;
`;

const VideoContainer = styled.div`
  display: flex;
  flex: 1;
  position: relative;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const Video = styled.video`
  width: 50%;
  height: 100%;
  object-fit: cover;
  background: #1a1a1a;
  
  @media (max-width: 768px) {
    width: 100%;
    height: 50vh;
  }
`;

const MyVideo = styled(Video)`
  border-right: 3px solid #333;
  
  @media (max-width: 768px) {
    border-right: none;
    border-bottom: 3px solid #333;
  }
`;

const PartnerVideo = styled(Video)`
  position: relative;
  
  ${props => !props.hasStream && `
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #666;
    font-weight: bold;
    
    &:before {
      content: 'Waiting for partner...';
    }
  `}
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px;
  background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
  gap: 10px;
  flex-wrap: wrap;
  box-shadow: 0 -3px 10px rgba(0,0,0,0.3);
`;

const Button = styled.button`
  padding: 12px 18px;
  border: none;
  border-radius: 25px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  
  &.stop {
    background: #e74c3c;
    color: white;
    &:hover { background: #c0392b; }
  }
  
  &.next {
    background: #27ae60;
    color: white;
    &:hover { background: #229954; }
  }
  
  &.home {
    background: #95a5a6;
    color: white;
    &:hover { background: #7f8c8d; }
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
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
  padding: 12px 16px;
  border-radius: 25px;
  font-size: 14px;
  font-weight: 600;
  z-index: 1000;
  max-width: 300px;
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255,255,255,0.2);
`;

const DebugInfo = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
  z-index: 1000;
  max-width: 200px;
  display: ${props => props.show ? 'block' : 'none'};
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
  const [debugInfo, setDebugInfo] = useState('');
  const [showDebug, setShowDebug] = useState(true);

  // YOUR RAILWAY BACKEND URL
  const BACKEND_URL = 'https://omegle-clone-backend-production-8f06.up.railway.app';

  // Debug logger
  const debug = (message) => {
    console.log('[DEBUG]', message);
    setDebugInfo(prev => `${new Date().toLocaleTimeString()}: ${message}\n${prev}`.slice(0, 500));
  };

  // Force video play with multiple attempts
  const forceVideoPlay = async (videoElement) => {
    if (!videoElement || !videoElement.srcObject) return;
    
    try {
      // Multiple play attempts with different strategies
      for (let i = 0; i < 3; i++) {
        try {
          videoElement.muted = true; // Essential for mobile autoplay
          videoElement.playsInline = true;
          videoElement.setAttribute('playsinline', 'true');
          videoElement.setAttribute('webkit-playsinline', 'true');
          
          await videoElement.play();
          debug(`Video ${videoElement === myVideo.current ? 'my' : 'partner'} playing successfully`);
          return;
        } catch (err) {
          debug(`Video play attempt ${i + 1} failed: ${err.message}`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (err) {
      debug(`Video play completely failed: ${err.message}`);
    }
  };

  // Get user media with mobile optimization
  const getUserMedia = async () => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const constraints = {
      video: {
        width: isMobile ? { ideal: 480, max: 640 } : { ideal: 640, max: 1280 },
        height: isMobile ? { ideal: 640, max: 480 } : { ideal: 480, max: 720 },
        frameRate: isMobile ? { ideal: 15, max: 20 } : { ideal: 30, max: 30 },
        facingMode: 'user'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

    try {
      debug('Requesting camera/microphone access...');
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      debug(`Got media stream: video=${mediaStream.getVideoTracks().length}, audio=${mediaStream.getAudioTracks().length}`);
      return mediaStream;
    } catch (err) {
      debug(`Media access failed: ${err.message}`);
      throw err;
    }
  };

  // Enhanced peer configuration
  const getPeerConfig = () => ({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
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
    ],
    iceCandidatePoolSize: 10
  });

  // Initialize media and socket connection
  useEffect(() => {
    let mounted = true;

    const initializeChat = async () => {
      try {
        setStatus('Getting camera access...');
        debug('Starting initialization...');
        
        // Get user media
        const currentStream = await getUserMedia();
        
        if (!mounted) return;
        
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
          await forceVideoPlay(myVideo.current);
        }

        // Initialize socket connection
        setStatus('Connecting to server...');
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
        setStatus('Camera/Microphone access denied. Please allow access and refresh.');
        debug(`Initialization failed: ${err.message}`);
      }
    };

    const setupSocketListeners = () => {
      socket.current.on('connect', () => {
        if (!mounted) return;
        debug('Connected to server');
        setIsConnected(true);
        setStatus('Connected! Looking for partner...');
        findPartner();
      });

      socket.current.on('disconnect', () => {
        if (!mounted) return;
        setIsConnected(false);
        setStatus('Disconnected from server');
        debug('Disconnected from server');
      });

      socket.current.on('matched', (partnerId) => {
        if (!mounted) return;
        debug(`Partner matched: ${partnerId}`);
        setStatus('Partner found! Connecting...');
        setTimeout(() => callUser(partnerId), 1000);
      });

      socket.current.on('waiting', () => {
        if (!mounted) return;
        setStatus('Looking for a partner...');
        debug('Added to waiting queue');
      });

      socket.current.on('callUser', (data) => {
        if (!mounted) return;
        debug(`Incoming call from: ${data.from}`);
        setReceivingCall(true);
        setCaller(data.from);
        setCallerSignal(data.signal);
        setStatus('Incoming call...');
        // Auto-answer after short delay
        setTimeout(() => answerCall(data.signal, data.from), 1000);
      });

      socket.current.on('callAccepted', (signal) => {
        if (!mounted) return;
        debug('Call accepted');
        setCallAccepted(true);
        setStatus('Connected to partner');
        if (connectionRef.current) {
          connectionRef.current.signal(signal);
        }
      });

      socket.current.on('partnerDisconnected', () => {
        if (!mounted) return;
        setStatus('Partner disconnected');
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
    
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: getPeerConfig()
    });

    peer.on('signal', (data) => {
      debug('Sending call signal');
      socket.current.emit('callUser', {
        userToCall: partnerId,
        signalData: data,
        from: user.id
      });
    });

    peer.on('stream', async (currentStream) => {
      debug(`Received partner stream: ${currentStream.id}`);
      setPartnerStream(currentStream);
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
        await forceVideoPlay(userVideo.current);
      }
    });

    peer.on('connect', () => {
      debug('Peer connected successfully');
      setCallAccepted(true);
      setStatus('Connected to partner');
    });

    peer.on('error', (err) => {
      debug(`Peer error: ${err.message}`);
      setStatus('Connection failed. Finding new partner...');
      setTimeout(() => findPartner(), 2000);
    });

    connectionRef.current = peer;
  }, [stream, user.id]);

  const answerCall = useCallback(async (signal, from) => {
    debug(`Answering call from: ${from}`);
    
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
      config: getPeerConfig()
    });

    peer.on('signal', (data) => {
      debug('Sending answer signal');
      socket.current.emit('answerCall', { signal: data, to: from });
    });

    peer.on('stream', async (currentStream) => {
      debug(`Received partner stream (answer): ${currentStream.id}`);
      setPartnerStream(currentStream);
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
        await forceVideoPlay(userVideo.current);
      }
      setCallAccepted(true);
      setStatus('Connected to partner');
    });

    peer.on('connect', () => {
      debug('Peer connected (answer)');
      setCallAccepted(true);
      setStatus('Connected to partner');
    });

    peer.on('error', (err) => {
      debug(`Answer peer error: ${err.message}`);
      setStatus('Connection failed');
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
    
    setStatus('Call ended');
  };

  const nextPartner = () => {
    debug('Looking for next partner');
    endCall();
    setStatus('Looking for new partner...');
    setTimeout(() => findPartner(), 1000);
  };

  return (
    <Container>
      <Status status={status}>
        <span className={`status-indicator ${isConnected ? 'status-online' : 'status-offline'}`}></span>
        {status}
      </Status>

      <DebugInfo show={showDebug}>
        <div style={{ fontSize: '10px', color: '#ccc' }}>
          Debug Info:
        </div>
        <pre style={{ fontSize: '10px', whiteSpace: 'pre-wrap' }}>
          {debugInfo}
        </pre>
      </DebugInfo>

      <VideoContainer>
        <MyVideo ref={myVideo} autoPlay muted playsInline />
        <PartnerVideo 
          ref={userVideo} 
          autoPlay 
          playsInline 
          hasStream={!!partnerStream}
        />
      </VideoContainer>

      <Controls>
        <Button className="home" onClick={() => navigate('/')}>
          🏠 Home
        </Button>
        
        <Button 
          className="stop" 
          onClick={endCall} 
          disabled={!callAccepted}
          title="Stop current chat"
        >
          🛑 Stop
        </Button>
        
        <Button 
          className="next" 
          onClick={nextPartner}
          title="Find new partner"
        >
          🔄 Next
        </Button>

        <Button onClick={() => setShowDebug(!showDebug)}>
          {showDebug ? '🐛' : '📊'}
        </Button>
      </Controls>
    </Container>
  );
};

export default VideoChat;
