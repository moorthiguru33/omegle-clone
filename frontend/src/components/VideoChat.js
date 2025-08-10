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
`;

const Video = styled.video`
  width: 50%;
  height: 100%;
  object-fit: cover;
  background: #000;
`;

const MyVideo = styled(Video)`
  border-right: 2px solid #333;
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

  // Memoized callUser function to prevent recreation on every render
  const callUser = useCallback((id) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
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
    // Get user media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
      })
      .catch((err) => {
        console.error('Error accessing media devices:', err);
        setStatus('Camera/Microphone access denied');
      });

    // Connect to signaling server - UPDATED WITH YOUR RAILWAY URL
    socket.current = io('https://omegle-clone-backend-production.up.railway.app');
    
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
      callUser(partnerId);
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

    // Join matching queue
    socket.current.emit('findPartner', {
      userId: user.id,
      gender: user.gender,
      preferredGender: user.preferredGender,
      hasFilterCredit: user.filterCredits > 0 || user.isPremium
    });

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [user.id, user.gender, user.preferredGender, user.filterCredits, user.isPremium, callUser, endCall]);

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
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (data) => {
      socket.current.emit('answerCall', { signal: data, to: caller });
    });

    peer.on('stream', (currentStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
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
      hasFilterCredit: user.filterCredits > 0 || user.isPremium
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
