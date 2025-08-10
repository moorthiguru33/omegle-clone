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

// Helper function for mobile video play
const forceVideoPlay = (videoElement) => {
  if (videoElement && videoElement.srcObject) {
    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.log('Video play failed, retrying:', err);
        setTimeout(() => videoElement.play().catch(console.error), 1000);
      });
    }
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
  const [status, setStatus] = useState('Initializing...');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(checkMobile);
    console.log('Device detected as mobile:', checkMobile);
  }, []);

  // Enhanced callUser with better mobile support
  const callUser = useCallback((partnerId) => {
    console.log('Initiating call to:', partnerId);
    
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
          {
            urls: 'turn:relay1.expressturn.com:3478',
            username: 'efJBIBVF6XeyWJH23A8K',
            credential: 'nVnjF8qrBYFNjVmp'
          },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    });

    peer.on('signal', (data) => {
      console.log('Sending call signal');
      socket.current.emit('callUser', {
        userToCall: partnerId,
        signalData: data,
        from: user.id
      });
    });

    peer.on('stream', (currentStream) => {
      console.log('Received partner stream');
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
        setTimeout(() => forceVideoPlay(userVideo.current), 500);
      }
    });

    peer.on('error', (err) => {
      console.error('Peer connection error:', err);
      setStatus('Connection failed - Trying again...');
    });

    socket.current.on('callAccepted', (signal) => {
      console.log('Call accepted, establishing connection');
      setCallAccepted(true);
      setStatus('Connected');
      peer.signal(signal);
    });

    connectionRef.current = peer;
  }, [stream, user.id]);

  // Enhanced endCall
  const endCall = useCallback(() => {
    console.log('Ending call');
    setCallAccepted(false);
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
  }, []);

  // Main initialization effect
  useEffect(() => {
    let mounted = true;
    
    const initializeConnection = async () => {
      try {
        setStatus('Getting camera access...');
        
        // Mobile-optimized media constraints
        const constraints = {
          video: isMobile ? {
            width: { ideal: 320, max: 640 },
            height: { ideal: 240, max: 480 },
            frameRate: { ideal: 15, max: 24 },
            facingMode: 'user'
          } : {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: isMobile ? 16000 : 44100
          }
        };

        const currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!mounted) return;
        
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
          if (isMobile) {
            setTimeout(() => forceVideoPlay(myVideo.current), 200);
          }
        }
        
        // Initialize socket connection after media is ready
        setStatus('Connecting to server...');
        
        socket.current = io('https://omegle-clone-backend-production.up.railway.app', {
          transports: ['websocket', 'polling'],
          timeout: 25000,
          forceNew: true,
          reconnection: true,
          reconnectionDelay: 2000,
          reconnectionAttempts: 8,
          reconnectionDelayMax: 10000,
          randomizationFactor: 0.3
        });

        // Enhanced socket event handlers
        socket.current.on('connect', () => {
          if (!mounted) return;
          console.log('Successfully connected to server');
          setStatus('Connected! Looking for partner...');
          
          // Join matching queue immediately after connection
          setTimeout(() => {
            if (socket.current && socket.current.connected) {
              socket.current.emit('findPartner', {
                userId: user.id,
                gender: user.gender,
                preferredGender: user.preferredGender,
                hasFilterCredit: user.filterCredits > 0 || user.isPremium,
                isMobile: isMobile,
                userAgent: navigator.userAgent,
                timestamp: Date.now()
              });
            }
          }, 1000);
        });

        socket.current.on('disconnect', (reason) => {
          if (!mounted) return;
          console.log('Disconnected from server:', reason);
          setStatus(`Disconnected: ${reason}`);
          
          // Auto-reconnect for certain disconnect reasons
          if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'transport error') {
            setTimeout(() => {
              if (socket.current && !socket.current.connected) {
                console.log('Attempting to reconnect...');
                socket.current.connect();
              }
            }, 3000);
          }
        });

        socket.current.on('connect_error', (error) => {
          if (!mounted) return;
          console.error('Connection error:', error);
          setStatus('Cannot connect to server - Retrying...');
        });

        socket.current.on('reconnect', (attemptNumber) => {
          if (!mounted) return;
          console.log('Reconnected to server after', attemptNumber, 'attempts');
          setStatus('Reconnected! Looking for partner...');
        });

        socket.current.on('reconnect_failed', () => {
          if (!mounted) return;
          console.log('Failed to reconnect to server');
          setStatus('Connection failed - Please refresh');
        });

        socket.current.on('matched', (partnerId) => {
          if (!mounted) return;
          console.log('Partner found:', partnerId);
          setStatus('Partner found! Connecting...');
          setTimeout(() => callUser(partnerId), isMobile ? 2000 : 800);
        });

        socket.current.on('waiting', () => {
          if (!mounted) return;
          setStatus('Looking for a partner...');
        });

        socket.current.on('partnerDisconnected', () => {
          if (!mounted) return;
          console.log('Partner disconnected');
          setStatus('Partner disconnected');
          endCall();
        });

        socket.current.on('callUser', (data) => {
          if (!mounted) return;
          console.log('Incoming call from:', data.from);
          setReceivingCall(true);
          setCaller(data.from);
          setCallerSignal(data.signal);
          setStatus('Incoming call...');
        });

        socket.current.on('message', (message) => {
          if (!mounted) return;
          setMessages(prev => [...prev, { text: message.text, sender: 'partner' }]);
        });

      } catch (err) {
        if (!mounted) return;
        console.error('Initialization error:', err);
        setStatus('Camera/Microphone access denied');
      }
    };

    initializeConnection();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [user.id, user.gender, user.preferredGender, user.filterCredits, user.isPremium, isMobile, callUser, endCall]);

  const answerCall = () => {
    console.log('Answering incoming call');
    setCallAccepted(true);
    setStatus('Connecting...');
    
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
            urls: 'turn:relay1.expressturn.com:3478',
            username: 'efJBIBVF6XeyWJH23A8K',
            credential: 'nVnjF8qrBYFNjVmp'
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
      setStatus('Connected');
    });

    peer.on('error', (err) => {
      console.error('Answer call error:', err);
      setStatus('Connection failed');
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const findNext = () => {
    endCall();
    setStatus('Looking for next partner...');
    setMessages([]);
    
    if (socket.current && socket.current.connected) {
      socket.current.emit('findPartner', {
        userId: user.id,
        gender: user.gender,
        preferredGender: user.preferredGender,
        hasFilterCredit: user.filterCredits > 0 || user.isPremium,
        isMobile: isMobile
      });
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && callAccepted && socket.current) {
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
