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
  position: relative;
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
  -webkit-playsinline: true;
  playsinline: true;
  
  @media (max-width: 768px) {
    width: 100%;
    height: 40vh;
    max-height: 300px;
    min-height: 200px;
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
  background: #2c2c2c;
  gap: 15px;
  flex-wrap: wrap;
`;

const Button = styled.button`
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;
  
  &.disconnect {
    background: #dc3545;
    color: white;
  }
  
  &.next {
    background: #28a745;
    color: white;
  }
  
  &.home {
    background: #6c757d;
    color: white;
  }
  
  &.skip {
    background: #17a2b8;
    color: white;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const Status = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  z-index: 10;
  max-width: 300px;
`;

const ChatContainer = styled.div`
  position: absolute;
  bottom: 100px;
  right: 20px;
  width: 320px;
  height: 250px;
  background: rgba(0,0,0,0.9);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  color: white;
  border: 1px solid #444;
  
  @media (max-width: 768px) {
    width: calc(100% - 40px);
    right: 20px;
    left: 20px;
    height: 200px;
  }
`;

const Messages = styled.div`
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  font-size: 13px;
  
  .message {
    margin: 8px 0;
    padding: 6px 10px;
    border-radius: 6px;
    max-width: 80%;
    word-wrap: break-word;
  }
  
  .message.me {
    background: #007bff;
    margin-left: auto;
    text-align: right;
  }
  
  .message.partner {
    background: #495057;
    margin-right: auto;
  }
`;

const MessageForm = styled.form`
  display: flex;
  padding: 10px;
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 10px;
  border: none;
  background: rgba(255,255,255,0.1);
  color: white;
  border-radius: 6px;
  font-size: 14px;
  
  &::placeholder {
    color: #aaa;
  }
  
  &:focus {
    outline: none;
    background: rgba(255,255,255,0.15);
  }
`;

const SendButton = styled.button`
  margin-left: 8px;
  padding: 10px 15px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  
  &:hover {
    background: #0056b3;
  }
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 30px;
  border-radius: 12px;
  text-align: center;
  color: #333;
  max-width: 400px;
  margin: 20px;
`;

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
  const [isConnected, setIsConnected] = useState(false);
  const [skipCount, setSkipCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // YOUR RAILWAY BACKEND URL
  const BACKEND_URL = 'https://omegle-clone-backend-production-8f06.up.railway.app';

  // Mobile detection
  useEffect(() => {
    const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(checkMobile);
  }, []);

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

  // Initialize media and socket connection
  useEffect(() => {
    let mounted = true;

    const initializeChat = async () => {
      try {
        setStatus('Getting camera access...');
        
        const mediaConstraints = {
          video: isMobile ? {
            width: { ideal: 320, max: 640 },
            height: { ideal: 240, max: 480 },
            frameRate: { ideal: 15, max: 24 },
            facingMode: 'user'
          } : {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: isMobile ? 16000 : 44100
          }
        };

        const currentStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        
        if (!mounted) return;
        
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
          if (isMobile) {
            setTimeout(() => forceVideoPlay(myVideo.current), 200);
          }
        }

        // Initialize socket connection with YOUR Railway URL
        setStatus('Connecting to server...');
        socket.current = io(BACKEND_URL, {
          transports: ['websocket', 'polling'],
          timeout: 25000,
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 8,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000
        });

        setupSocketListeners();
        
      } catch (err) {
        console.error('Initialization error:', err);
        setStatus('Camera/Microphone access denied. Please allow access and refresh.');
      }
    };

    const setupSocketListeners = () => {
      socket.current.on('connect', () => {
        if (!mounted) return;
        console.log('Connected to server');
        setIsConnected(true);
        setStatus('Connected! Looking for partner...');
        
        // Join matching queue after connection
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
        setIsConnected(false);
        setStatus(`Disconnected: ${reason}`);
        console.log('Disconnected from server:', reason);
      });

      socket.current.on('connect_error', (error) => {
        if (!mounted) return;
        console.error('Connection error:', error);
        setStatus('Cannot connect to server - Retrying...');
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

      socket.current.on('callUser', (data) => {
        if (!mounted) return;
        console.log('Incoming call from:', data.from);
        setReceivingCall(true);
        setCaller(data.from);
        setCallerSignal(data.signal);
        setStatus('Incoming call...');
        // Auto-answer the call
        setTimeout(() => answerCall(data.signal, data.from), 1000);
      });

      socket.current.on('callAccepted', (signal) => {
        if (!mounted) return;
        setCallAccepted(true);
        setStatus('Connected to partner');
        if (connectionRef.current) {
          connectionRef.current.signal(signal);
        }
      });

      socket.current.on('message', (message) => {
        if (!mounted) return;
        setMessages(prev => [...prev, { text: message.text, sender: 'partner', timestamp: Date.now() }]);
      });

      socket.current.on('partnerDisconnected', () => {
        if (!mounted) return;
        setStatus('Partner disconnected');
        endCall();
      });

      socket.current.on('heartbeat', () => {
        if (socket.current && socket.current.connected) {
          socket.current.emit('heartbeat_response');
        }
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
  }, [user.id, user.gender, user.preferredGender, user.filterCredits, user.isPremium, isMobile]);

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

    peer.on('connect', () => {
      setCallAccepted(true);
      setStatus('Connected to partner');
    });

    peer.on('error', (err) => {
      console.error('Peer connection error:', err);
      setStatus('Connection failed - Trying again...');
    });

    connectionRef.current = peer;
  }, [stream, user.id]);

  const answerCall = useCallback((signal, from) => {
    console.log('Answering incoming call');
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
      socket.current.emit('answerCall', { signal: data, to: from });
    });

    peer.on('stream', (currentStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
        setTimeout(() => forceVideoPlay(userVideo.current), 500);
      }
      setCallAccepted(true);
      setStatus('Connected to partner');
    });

    peer.on('error', (err) => {
      console.error('Answer call error:', err);
      setStatus('Connection failed');
    });

    peer.signal(signal);
    connectionRef.current = peer;
    setReceivingCall(false);
  }, [stream]);

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
    setMessages([]);
    setStatus('Call ended');
  }, []);

  const skipPartner = () => {
    if (skipCount >= 5 && !user.isPremium) {
      alert('Skip limit reached. Upgrade to premium for unlimited skips.');
      return;
    }
    
    endCall();
    setSkipCount(prev => prev + 1);
    setStatus('Looking for next partner...');
    setTimeout(() => {
      if (socket.current && socket.current.connected) {
        socket.current.emit('findPartner', {
          userId: user.id,
          gender: user.gender,
          preferredGender: user.preferredGender,
          hasFilterCredit: user.filterCredits > 0 || user.isPremium,
          isMobile: isMobile
        });
      }
    }, 1000);
  };

  const findNext = () => {
    endCall();
    setStatus('Looking for next partner...');
    setTimeout(() => {
      if (socket.current && socket.current.connected) {
        socket.current.emit('findPartner', {
          userId: user.id,
          gender: user.gender,
          preferredGender: user.preferredGender,
          hasFilterCredit: user.filterCredits > 0 || user.isPremium,
          isMobile: isMobile
        });
      }
    }, 1000);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && callAccepted && socket.current) {
      const message = { text: newMessage, timestamp: Date.now() };
      socket.current.emit('sendMessage', message);
      setMessages(prev => [...prev, { ...message, sender: 'me' }]);
      setNewMessage('');
    }
  };

  return (
    <Container>
      <Status>
        <span className={`status-indicator ${isConnected ? 'status-online' : 'status-offline'}`}></span>
        {status}
      </Status>

      <VideoContainer>
        <MyVideo ref={myVideo} autoPlay muted playsInline />
        <Video ref={userVideo} autoPlay playsInline />
      </VideoContainer>

      {callAccepted && (
        <ChatContainer>
          <Messages>
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
          </Messages>
          <MessageForm onSubmit={sendMessage}>
            <MessageInput
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              maxLength={200}
            />
            <SendButton type="submit">Send</SendButton>
          </MessageForm>
        </ChatContainer>
      )}

      <Controls>
        <Button className="home" onClick={() => navigate('/')}>
          🏠 Home
        </Button>
        <Button className="disconnect" onClick={endCall} disabled={!callAccepted}>
          ❌ End Call
        </Button>
        <Button className="skip" onClick={skipPartner}>
          ⏭️ Skip ({5 - skipCount} left)
        </Button>
        <Button className="next" onClick={findNext}>
          🔄 New Chat
        </Button>
      </Controls>

      {receivingCall && !callAccepted && (
        <Modal>
          <ModalContent>
            <h3>Incoming Call</h3>
            <p>Someone wants to chat with you!</p>
            <div style={{ marginTop: '20px' }}>
              <Button className="next" onClick={() => answerCall(callerSignal, caller)}>
                Accept
              </Button>
            </div>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
};

export default VideoChat;
