import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a1a;
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
  background: #000;
  
  /* Prevent video flickering on mobile */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  webkit-playsinline: true;
  playsinline: true;
  
  @media (max-width: 768px) {
    width: 100%;
    height: 40vh;
    max-height: 300px;
  }
`;

const MyVideo = styled(Video)`
  border-right: 2px solid #333;
  
  @media (max-width: 768px) {
    border-right: none;
    border-bottom: 2px solid #333;
  }
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: #333;
  gap: 15px;
  
  @media (max-width: 768px) {
    padding: 15px 10px;
    gap: 10px;
  }
`;

const Button = styled.button`
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;

  &.disconnect {
    background: #ff4757;
    color: white;
  }

  &.next {
    background: #2ed573;
    color: white;
  }

  &.home {
    background: #747d8c;
    color: white;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  }
  
  @media (max-width: 768px) {
    padding: 10px 15px;
    font-size: 14px;
  }
`;

const Status = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 10;
  
  @media (max-width: 768px) {
    top: 10px;
    left: 10px;
    font-size: 12px;
    padding: 8px 12px;
  }
`;

const ChatBox = styled.div`
  position: absolute;
  bottom: 80px;
  right: 20px;
  width: 300px;
  height: 200px;
  background: rgba(0,0,0,0.8);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  color: white;
  
  @media (max-width: 768px) {
    width: 250px;
    height: 150px;
    bottom: 70px;
    right: 10px;
  }
`;

const Messages = styled.div`
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  font-size: 12px;
`;

const MessageInput = styled.input`
  padding: 10px;
  border: none;
  background: rgba(255,255,255,0.1);
  color: white;
  border-radius: 0 0 8px 8px;

  &::placeholder {
    color: #ccc;
  }
`;

// Helper function to force video play on mobile
const forceVideoPlay = (videoElement) => {
  if (videoElement && videoElement.srcObject) {
    videoElement.play().catch(err => {
      console.log('Video play failed:', err);
      // Retry after user interaction
      setTimeout(() => {
        videoElement.play().catch(console.error);
      }, 1000);
    });
  }
};

const VideoChat = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const socket = useRef();

  const [stream, setStream] = useState();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [status, setStatus] = useState('Connecting...');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(checkMobile);
    
    // Mobile browsers need user interaction for autoplay
    if (checkMobile) {
      const handleFirstTouch = () => {
        if (myVideo.current) forceVideoPlay(myVideo.current);
        if (userVideo.current) forceVideoPlay(userVideo.current);
      };
      
      document.addEventListener('touchstart', handleFirstTouch, { once: true });
      document.addEventListener('click', handleFirstTouch, { once: true });
      
      return () => {
        document.removeEventListener('touchstart', handleFirstTouch);
        document.removeEventListener('click', handleFirstTouch);
      };
    }
  }, []);

  // Memoized callUser function with mobile optimization
  const callUser = useCallback((id) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
          // Add free TURN servers for mobile networks
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    });

    peer.on('signal', (data) => {
      socket.current.emit('callUser', {
        userToCall: id,
        signalData: data,
        from: user.id
      });
    });

    peer.on('stream', (currentStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
        // Force play for mobile browsers with delay
        setTimeout(() => forceVideoPlay(userVideo.current), 500);
      }
    });

    socket.current.on('callAccepted', (signal) => {
      setCallAccepted(true);
      setStatus('Connected');
      peer.signal(signal);
    });

    connectionRef.current = peer;
  }, [stream, user.id]);

  // Memoized endCall function
  const endCall = useCallback(() => {
    setCallAccepted(false);
    setReceivingCall(false);
    if (connectionRef.current) {
      connectionRef.current.destroy();
    }
    if (userVideo.current) {
      userVideo.current.srcObject = null;
    }
    if (socket.current) {
      socket.current.emit('endCall');
    }
  }, []);

  useEffect(() => {
    // Mobile-optimized media constraints
    const constraints = {
      video: isMobile ? {
        width: { min: 160, ideal: 320, max: 480 },
        height: { min: 120, ideal: 240, max: 360 },
        frameRate: { ideal: 15, max: 24 },
        facingMode: 'user'
      } : {
        width: { min: 320, ideal: 640, max: 1280 },
        height: { min: 240, ideal: 480, max: 720 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: isMobile ? 16000 : 44100
      }
    };

    // Get user media with mobile-optimized settings
    navigator.mediaDevices.getUserMedia(constraints)
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
          // Force video to play on mobile
          if (isMobile) {
            setTimeout(() => forceVideoPlay(myVideo.current), 100);
          }
        }
      })
      .catch((err) => {
        console.error('Error accessing media devices:', err);
        setStatus('Camera/Microphone access denied');
      });

    // Connect to signaling server
    socket.current = io('https://omegle-clone-backend-production.up.railway.app', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });
    
    socket.current.on('connect', () => {
      console.log('Connected to server');
      setStatus('Connected to server...');
    });

    socket.current.on('disconnect', () => {
      console.log('Disconnected from server');
      setStatus('Disconnected from server');
    });
    
    socket.current.on('me', (id) => {
      console.log('My ID:', id);
    });

    socket.current.on('callUser', (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerSignal(data.signal);
      setStatus('Incoming call...');
    });

    socket.current.on('matched', (partnerId) => {
      setStatus('Partner found! Connecting...');
      // Add delay for mobile connection establishment
      setTimeout(() => {
        callUser(partnerId);
      }, isMobile ? 1000 : 100);
    });

    socket.current.on('waiting', () => {
      setStatus('Looking for a partner...');
    });

    socket.current.on('partnerDisconnected', () => {
      setStatus('Partner disconnected');
      endCall();
    });

    socket.current.on('message', (message) => {
      setMessages(prev => [...prev, { text: message.text, sender: 'partner' }]);
    });

    socket.current.on('connectionTimeout', () => {
      setStatus('Connection timeout - Try again');
    });

    // Join matching queue with mobile info
    socket.current.emit('findPartner', {
      userId: user.id,
      gender: user.gender,
      preferredGender: user.preferredGender,
      hasFilterCredit: user.filterCredits > 0 || user.isPremium,
      isMobile: isMobile
    });

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [user.id, user.gender, user.preferredGender, user.filterCredits, user.isPremium, callUser, endCall, isMobile]);

  const answerCall = () => {
    setCallAccepted(true);
    setStatus('Connected');
    
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    });

    peer.on('signal', (data) => {
      socket.current.emit('answerCall', { signal: data, to: caller });
    });

    peer.on('stream', (currentStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
        setTimeout(() => forceVideoPlay(userVideo.current), 500);
      }
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const findNext = () => {
    endCall();
    setStatus('Looking for next partner...');
    setMessages([]);
    
    socket.current.emit('findPartner', {
      userId: user.id,
      gender: user.gender,
      preferredGender: user.preferredGender,
      hasFilterCredit: user.filterCredits > 0 || user.isPremium,
      isMobile: isMobile
    });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && callAccepted) {
      socket.current.emit('sendMessage', { text: newMessage });
      setMessages(prev => [...prev, { text: newMessage, sender: 'me' }]);
      setNewMessage('');
    }
  };

  return (
    <Container>
      <VideoContainer>
        <MyVideo
          ref={myVideo}
          muted
          autoPlay
          playsInline
        />
        <Video
          ref={userVideo}
          autoPlay
          playsInline
        />
        
        <Status>{status}</Status>
        
        {callAccepted && (
          <ChatBox>
            <Messages>
              {messages.map((msg, index) => (
                <div key={index} style={{
                  textAlign: msg.sender === 'me' ? 'right' : 'left',
                  margin: '5px 0',
                  color: msg.sender === 'me' ? '#4ecdc4' : '#ff6b6b'
                }}>
                  {msg.text}
                </div>
              ))}
            </Messages>
            <form onSubmit={sendMessage}>
              <MessageInput
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
              />
            </form>
          </ChatBox>
        )}
      </VideoContainer>

      <Controls>
        <Button className="home" onClick={() => navigate('/')}>
          🏠 Home
        </Button>
        <Button className="disconnect" onClick={endCall}>
          ❌ End Call
        </Button>
        <Button className="next" onClick={findNext}>
          ⏭️ Next Partner
        </Button>
      </Controls>

      {receivingCall && !callAccepted && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '20px',
          borderRadius: '10px',
          textAlign: 'center',
          zIndex: 1000
        }}>
          <p>Someone is calling you...</p>
          <Button className="next" onClick={answerCall}>
            Accept Call
          </Button>
        </div>
      )}
    </Container>
  );
};

export default VideoChat;
