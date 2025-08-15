import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import styled from 'styled-components';

// WebRTC Configuration (improved from reference config.ts)
const configuration = {
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
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://omegle-clone-backend-production-8f06.up.railway.app';

// Styled components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  font-family: 'Inter', sans-serif;
  position: relative;
`;

const VideoContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  gap: 10px;
  padding: 10px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
`;

const VideoWrapper = styled.div`
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  min-height: 200px;
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
  border-radius: 12px;
`;

const VideoLabel = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 12px;
  z-index: 10;
`;

const StatusBar = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 12px;
  border-radius: 15px;
  font-size: 12px;
  z-index: 10;
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  gap: 15px;
  flex-wrap: wrap;
`;

const ControlButton = styled.button`
  width: 50px;
  height: 50px;
  border: none;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: ${props => {
    if (props.variant === 'primary') return 'linear-gradient(45deg, #ef4444, #dc2626)';
    if (props.variant === 'secondary') return 'linear-gradient(45deg, #10b981, #059669)';
    return 'rgba(255, 255, 255, 0.2)';
  }};

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PlaceholderMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  padding: 20px;
`;

const ChatContainer = styled.div`
  position: absolute;
  bottom: 100px;
  right: 20px;
  width: 300px;
  height: 250px;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 10px;
  display: ${props => props.show ? 'flex' : 'none'};
  flex-direction: column;
  z-index: 100;
  border: 1px solid rgba(255, 255, 255, 0.2);

  @media (max-width: 768px) {
    width: 280px;
    height: 200px;
    bottom: 110px;
  }
`;

const ChatHeader = styled.div`
  padding: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  color: white;
  font-size: 12px;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }
`;

const Message = styled.div`
  margin-bottom: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: ${props => props.isOwn ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'};
  color: ${props => props.isOwn ? '#60a5fa' : '#34d399'};
  word-wrap: break-word;
`;

const MessageInput = styled.input`
  padding: 10px;
  border: none;
  border-radius: 0 0 10px 10px;
  background: rgba(255, 255, 255, 0.9);
  outline: none;
  font-size: 14px;
  color: #333;

  &:focus {
    background: white;
  }
`;

const VideoChat = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Socket and WebRTC refs (like reference code)
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // State management (based on reference page.tsx)
  const [messageText, setMessageText] = useState("");
  const [userCount, setUserCount] = useState("🔃");
  const [messages, setMessages] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [reConnect, setReConnect] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // Handle send message (from reference code)
  const handleSend = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!roomId || !messageText.trim()) return;

    socketRef.current.emit("message", roomId, messageText);
    setMessages(prev => [{ from: "host", message: messageText }, ...prev]);
    setMessageText("");
  }, [roomId, messageText]);

  // Handle skip (from reference code)
  const handleSkip = useCallback(() => {
    console.log('[SKIP] Leaving room');
    if (socketRef.current) {
      socketRef.current.emit("leaveRoom");
    }
  }, []);

  // Get user media (improved from reference)
  const getUserMedia = useCallback(async () => {
    try {
      console.log('[CAMERA] Requesting media access...');
      setConnectionStatus('Requesting camera access...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Add tracks to peer connection (critical step from reference)
      if (peerConnectionRef.current && stream) {
        stream.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, stream);
        });
        console.log("ADDED LOCAL TRACKS TO PC");
      }

      setConnectionStatus('Camera ready');
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setConnectionStatus('Camera access failed');
      throw error;
    }
  }, []);

  // Create offer (from reference code)
  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current || !roomId) return;

    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log(`CREATED OFFER SENDING TO :: ${roomId}`);
      socketRef.current.emit("offer", roomId, offer);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }, [roomId]);

  // Send answer (from reference code)
  const sendAnswer = useCallback(async () => {
    if (!peerConnectionRef.current || !roomId) return;

    try {
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      console.log(`CREATED ANSWER SENDING TO :: ${roomId}`);
      socketRef.current.emit("answer", roomId, answer);
    } catch (error) {
      console.error('Error creating answer:', error);
    }
  }, [roomId]);

  // Control functions
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  }, [localStream, audioEnabled]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  }, [localStream, videoEnabled]);

  const stopCall = useCallback(() => {
    console.log('[STOP] Ending call');
    
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.emit("leaveRoom");
      socketRef.current.disconnect();
    }

    navigate('/');
  }, [localStream, remoteStream, navigate]);

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Main effect - Initialize everything (based on reference useEffect)
  useEffect(() => {
    console.log('[INIT] Starting connection...');
    setConnectionStatus('Connecting to server...');

    // Initialize socket
    socketRef.current = io(BACKEND_URL);

    // Initialize peer connection
    peerConnectionRef.current = new RTCPeerConnection(configuration);

    console.log("connection started .... sending join message");
    socketRef.current.emit("join");

    // Get user media
    getUserMedia();

    // WebRTC event handlers (from reference code)
    const handleIceCandidate = (event) => {
      if (event.candidate && roomId) {
        console.log("SENDING ICE CANDIDATES");
        socketRef.current.emit("ice-candidates", roomId, event.candidate);
      }
    };

    const handleTrack = (event) => {
      console.log("HANDLE TRACK LISTENER");
      const newMediaStream = new MediaStream();
      event.streams[0].getTracks().forEach(track => {
        newMediaStream.addTrack(track);
      });
      setRemoteStream(newMediaStream);
      console.log("SETTING REMOTE STREAM :: ", newMediaStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = newMediaStream;
      }
      console.log("SET THE remotevideo REF");
      setConnectionStatus('Connected');
    };

    const handleNegotiation = async () => {
      try {
        if (!roomId) return;
        console.log("NEGOTIATION NEEDED: Creating offer");
        await createOffer();
      } catch (error) {
        console.error("Error during negotiation:", error);
      }
    };

    // Add WebRTC event listeners
    peerConnectionRef.current.addEventListener('icecandidate', handleIceCandidate);
    peerConnectionRef.current.addEventListener('track', handleTrack);
    peerConnectionRef.current.addEventListener('negotiationneeded', handleNegotiation);
    console.log("ICE CANDIDATE EVENT LISTENER STARTED");

    // Socket event handlers (from reference code)
    socketRef.current.on("joined", ({ room }) => {
      setRoomId(room);
      setConnectionStatus(`Joined room`);
      console.log("JOINED ROOM :: ", room);
      console.log("MY SOCKET ID :: ", socketRef.current.id);
    });

    socketRef.current.on("leaveRoom", () => {
      setMessages([]);
      console.log("ROOM LEAVING REQUEST RECEIVED");
      setRemoteStream(null);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      setRoomId("");
      
      // Stop streams
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      setRemoteStream(null);
      
      console.log("Room Id after leave :: ", roomId);
      setConnectionStatus('Looking for new partner...');
      setReConnect(prev => !prev);
    });

    socketRef.current.on("answer", (offer) => {
      console.log("ANSWER RECEIVED");
      peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    });

    socketRef.current.on("send-offer", () => {
      console.log("OFFER REQUEST RECEIVED");
      createOffer();
    });

    socketRef.current.on('offer', (offer) => {
      console.log("OFFER RECEIVED SENDING ANSWER");
      peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      sendAnswer();
    });

    socketRef.current.on("ice-candidates", (iceCandidate) => {
      console.log("RECEIVED ICE CANDIDATES");
      peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(iceCandidate));
    });

    socketRef.current.on("message", (msg) => {
      setMessages(prev => [{ from: "remote", message: msg }, ...prev]);
    });

    socketRef.current.on('user-count', (count) => {
      setUserCount(count);
    });

    socketRef.current.on('connect', () => {
      console.log('[SOCKET] Connected to server');
      setConnectionStatus('Looking for partner...');
    });

    socketRef.current.on('disconnect', () => {
      console.log('[SOCKET] Disconnected from server');
      setConnectionStatus('Disconnected');
    });

    // Cleanup function (from reference code)
    return () => {
      console.log('[CLEANUP] Cleaning up...');
      
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.removeEventListener('icecandidate', handleIceCandidate);
        peerConnectionRef.current.removeEventListener('track', handleTrack);
        peerConnectionRef.current.removeEventListener('negotiationneeded', handleNegotiation);
        peerConnectionRef.current.close();
      }

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      console.log("CLOSED PEER CONNECTION");
    };
  }, [reConnect, getUserMedia, createOffer, sendAnswer, roomId, localStream, remoteStream]);

  // Auto-scroll messages (from reference code)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Redirect if no user data
  useEffect(() => {
    if (!user?.id || !user?.gender) {
      console.log('[ERROR] No user data, redirecting home');
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <Container>
      <StatusBar>
        {connectionStatus} | Users: {userCount}
      </StatusBar>

      <VideoContainer>
        <VideoWrapper>
          <VideoLabel>You {!videoEnabled && '(Camera Off)'}</VideoLabel>
          <Video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
          />
          {!localStream && (
            <PlaceholderMessage>
              📷 Starting camera...
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
              {roomId ? '🔄 Connecting to partner...' : '👋 Looking for partner...'}
            </PlaceholderMessage>
          )}
        </VideoWrapper>
      </VideoContainer>

      {/* Chat Container (from reference code) */}
      <ChatContainer show={roomId}>
        <ChatHeader>💬 Chat</ChatHeader>
        <MessagesContainer>
          {messages.map((msg, index) => (
            <Message key={index} isOwn={msg.from === 'host'}>
              <strong>{msg.from === 'host' ? 'You' : 'Partner'}:</strong> {msg.message}
            </Message>
          ))}
          <div ref={messagesEndRef} />
        </MessagesContainer>
        <MessageInput
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend(e);
          }}
          onTouchStart={focusInput}
        />
      </ChatContainer>

      <Controls>
        <ControlButton
          onClick={toggleAudio}
          disabled={!localStream}
          title="Toggle Audio"
        >
          {audioEnabled ? '🎤' : '🔇'}
        </ControlButton>

        <ControlButton
          onClick={toggleVideo}
          disabled={!localStream}
          title="Toggle Video"
        >
          {videoEnabled ? '📹' : '📷'}
        </ControlButton>

        <ControlButton
          variant="secondary"
          onClick={handleSkip}
          disabled={!roomId}
          title="Skip Partner"
        >
          ⏭️
        </ControlButton>

        <ControlButton
          variant="primary"
          onClick={stopCall}
          title="End Call"
        >
          ❌
        </ControlButton>
      </Controls>
    </Container>
  );
};

export default VideoChat;
