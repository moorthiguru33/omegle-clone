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
  ${props => props.isWaiting && `
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: #666;
    font-weight: bold;
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
  
  &.skip {
    background: #f39c12;
    color: white;
    &:hover { background: #e67e22; }
  }
  
  &.chat-toggle {
    background: #9b59b6;
    color: white;
    &:hover { background: #8e44ad; }
  }
  
  &.report {
    background: #e67e22;
    color: white;
    &:hover { background: #d35400; }
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
    if (props.status.includes('Disconnected') || props.status.includes('failed')) return 'rgba(231, 76, 60, 0.9)';
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

const ChatContainer = styled.div`
  position: absolute;
  bottom: 100px;
  right: 20px;
  width: 350px;
  height: 300px;
  background: rgba(0,0,0,0.95);
  border-radius: 15px;
  display: ${props => props.show ? 'flex' : 'none'};
  flex-direction: column;
  color: white;
  border: 2px solid #3498db;
  backdrop-filter: blur(10px);
  
  @media (max-width: 768px) {
    width: calc(100% - 40px);
    right: 20px;
    left: 20px;
    height: 250px;
  }
`;

const ChatHeader = styled.div`
  padding: 12px 15px;
  background: #3498db;
  border-radius: 13px 13px 0 0;
  font-weight: bold;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CloseChat = styled.button`
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(255,255,255,0.2);
  }
`;

const Messages = styled.div`
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  font-size: 13px;
  
  .message {
    margin: 8px 0;
    padding: 8px 12px;
    border-radius: 15px;
    max-width: 85%;
    word-wrap: break-word;
    animation: fadeIn 0.3s ease;
  }
  
  .message.me {
    background: #3498db;
    margin-left: auto;
    text-align: right;
  }
  
  .message.partner {
    background: #34495e;
    margin-right: auto;
  }
  
  .message.system {
    background: #f39c12;
    margin: 10px auto;
    text-align: center;
    font-size: 12px;
    max-width: 70%;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const MessageForm = styled.form`
  display: flex;
  padding: 12px;
  gap: 8px;
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 10px 15px;
  border: none;
  background: rgba(255,255,255,0.1);
  color: white;
  border-radius: 20px;
  font-size: 14px;
  
  &::placeholder {
    color: #bdc3c7;
  }
  
  &:focus {
    outline: none;
    background: rgba(255,255,255,0.2);
    box-shadow: 0 0 0 2px #3498db;
  }
`;

const SendButton = styled.button`
  padding: 10px 15px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  
  &:hover {
    background: #2980b9;
  }
`;

const PartnerInfo = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 10px 15px;
  border-radius: 20px;
  font-size: 12px;
  z-index: 1000;
  display: ${props => props.show ? 'block' : 'none'};
`;

const WaitingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.8);
  display: ${props => props.show ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 999;
  color: white;
  font-size: 18px;
  font-weight: bold;
  backdrop-filter: blur(5px);
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
  const [showChat, setShowChat] = useState(false);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [connectionTime, setConnectionTime] = useState(0);

  // YOUR RAILWAY BACKEND URL
  const BACKEND_URL = 'https://omegle-clone-backend-production-8f06.up.railway.app';

  // Connection timer
  useEffect(() => {
    let timer;
    if (callAccepted && partnerConnected) {
      timer = setInterval(() => {
        setConnectionTime(prev => prev + 1);
      }, 1000);
    } else {
      setConnectionTime(0);
    }
    return () => clearInterval(timer);
  }, [callAccepted, partnerConnected]);

  // Initialize media and socket connection
  useEffect(() => {
    let mounted = true;

    const initializeChat = async () => {
      try {
        setStatus('Getting camera access...');
        
        const mediaConstraints = {
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        };

        const currentStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        
        if (!mounted) return;
        
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
          myVideo.current.play().catch(console.error);
        }

        // Initialize socket connection
        setStatus('Connecting to server...');
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
      }
    };

    const setupSocketListeners = () => {
      socket.current.on('connect', () => {
        if (!mounted) return;
        console.log('✅ Connected to server');
        setIsConnected(true);
        setStatus('Connected! Looking for partner...');
        findPartner();
      });

      socket.current.on('disconnect', () => {
        if (!mounted) return;
        setIsConnected(false);
        setStatus('Disconnected from server');
      });

      socket.current.on('matched', (partnerId) => {
        if (!mounted) return;
        console.log('🎯 Partner matched:', partnerId);
        setStatus('Partner found! Connecting...');
        setTimeout(() => callUser(partnerId), 1000);
      });

      socket.current.on('waiting', () => {
        if (!mounted) return;
        setStatus('Looking for a partner...');
      });

      socket.current.on('callUser', (data) => {
        if (!mounted) return;
        console.log('📞 Incoming call from:', data.from);
        setReceivingCall(true);
        setCaller(data.from);
        setCallerSignal(data.signal);
        setStatus('Incoming call...');
        // Auto-answer the call
        setTimeout(() => answerCall(data.signal, data.from), 500);
      });

      socket.current.on('callAccepted', (signal) => {
        if (!mounted) return;
        console.log('✅ Call accepted');
        setCallAccepted(true);
        setPartnerConnected(true);
        setStatus('Connected to partner');
        if (connectionRef.current) {
          connectionRef.current.signal(signal);
        }
      });

      socket.current.on('message', (message) => {
        if (!mounted) return;
        setMessages(prev => [...prev, { 
          text: message.text, 
          sender: 'partner', 
          timestamp: Date.now() 
        }]);
      });

      socket.current.on('partnerDisconnected', () => {
        if (!mounted) return;
        setStatus('Partner disconnected');
        setMessages(prev => [...prev, { 
          text: 'Partner left the chat', 
          sender: 'system', 
          timestamp: Date.now() 
        }]);
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
    console.log('📞 Calling user:', partnerId);
    
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    });

    peer.on('signal', (data) => {
      console.log('📡 Sending call signal');
      socket.current.emit('callUser', {
        userToCall: partnerId,
        signalData: data,
        from: user.id
      });
    });

    peer.on('stream', (currentStream) => {
      console.log('🎥 Received partner stream');
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
        userVideo.current.play().catch(console.error);
        setPartnerConnected(true);
      }
    });

    peer.on('connect', () => {
      console.log('🔗 Peer connected');
      setCallAccepted(true);
      setPartnerConnected(true);
      setStatus('Connected to partner');
    });

    peer.on('error', (err) => {
      console.error('❌ Peer error:', err);
      setStatus('Connection failed. Finding new partner...');
      setTimeout(() => findPartner(), 2000);
    });

    connectionRef.current = peer;
  }, [stream, user.id]);

  const answerCall = useCallback((signal, from) => {
    console.log('📞 Answering call from:', from);
    
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (data) => {
      console.log('📡 Sending answer signal');
      socket.current.emit('answerCall', { signal: data, to: from });
    });

    peer.on('stream', (currentStream) => {
      console.log('🎥 Received partner stream (answer)');
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
        userVideo.current.play().catch(console.error);
        setPartnerConnected(true);
      }
    });

    peer.on('connect', () => {
      console.log('🔗 Peer connected (answer)');
      setCallAccepted(true);
      setPartnerConnected(true);
      setStatus('Connected to partner');
    });

    peer.on('error', (err) => {
      console.error('❌ Answer peer error:', err);
      setStatus('Connection failed');
    });

    peer.signal(signal);
    connectionRef.current = peer;
    setReceivingCall(false);
  }, [stream]);

  const findPartner = () => {
    if (socket.current && socket.current.connected) {
      console.log('🔍 Finding partner...');
      socket.current.emit('findPartner', {
        userId: user.id,
        gender: user.gender,
        preferredGender: user.preferredGender,
        hasFilterCredit: user.filterCredits > 0 || user.isPremium
      });
    }
  };

  const endCall = () => {
    console.log('❌ Ending call');
    setCallAccepted(false);
    setPartnerConnected(false);
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
    setShowChat(false);
    setStatus('Call ended');
  };

  const skipPartner = () => {
    if (skipCount >= 5 && !user.isPremium) {
      alert('Skip limit reached. Upgrade to premium for unlimited skips.');
      return;
    }
    
    endCall();
    setSkipCount(prev => prev + 1);
    setStatus('Looking for next partner...');
    setTimeout(() => findPartner(), 1000);
  };

  const nextPartner = () => {
    endCall();
    setStatus('Looking for new partner...');
    setTimeout(() => findPartner(), 1000);
  };

  const reportPartner = () => {
    if (window.confirm('Report this partner for inappropriate behavior?')) {
      // In real app, send report to server
      alert('Partner reported. Thank you for keeping the community safe.');
      nextPartner();
    }
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Container>
      <Status status={status}>
        <span className={`status-indicator ${isConnected ? 'status-online' : 'status-offline'}`}></span>
        {status}
        {partnerConnected && connectionTime > 0 && ` • ${formatTime(connectionTime)}`}
      </Status>

      <PartnerInfo show={partnerConnected}>
        🟢 Partner Connected
        {connectionTime > 0 && <div>⏱️ {formatTime(connectionTime)}</div>}
      </PartnerInfo>

      <VideoContainer>
        <MyVideo ref={myVideo} autoPlay muted playsInline />
        <PartnerVideo 
          ref={userVideo} 
          autoPlay 
          playsInline 
          isWaiting={!partnerConnected}
        />
        {!partnerConnected && (
          <WaitingOverlay show={!partnerConnected}>
            <div>
              <div>🔍 Looking for partner...</div>
              <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
                Please wait while we find someone for you to chat with
              </div>
            </div>
          </WaitingOverlay>
        )}
      </VideoContainer>

      <ChatContainer show={showChat && callAccepted}>
        <ChatHeader>
          💬 Chat
          <CloseChat onClick={() => setShowChat(false)}>×</CloseChat>
        </ChatHeader>
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
        
        <Button 
          className="skip" 
          onClick={skipPartner}
          title={`Skip partner (${5 - skipCount} left)`}
        >
          ⏭️ Skip ({5 - skipCount})
        </Button>
        
        <Button 
          className="chat-toggle" 
          onClick={() => setShowChat(!showChat)}
          disabled={!callAccepted}
          title="Toggle text chat"
        >
          💬 Chat
        </Button>
        
        <Button 
          className="report" 
          onClick={reportPartner}
          disabled={!callAccepted}
          title="Report inappropriate behavior"
        >
          🚫 Report
        </Button>
      </Controls>
    </Container>
  );
};

export default VideoChat;
