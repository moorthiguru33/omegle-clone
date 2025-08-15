import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
`;

const VideoContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  gap: 10px;
  padding: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
    padding: 10px;
  }
`;

const VideoWrapper = styled.div`
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  min-height: 200px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
`;

const VideoLabel = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
`;

const PlaceholderMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  font-weight: 500;
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  gap: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
`;

const Button = styled.button`
  padding: 12px 24px;
  border: none;
  border-radius: 25px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;

  &.primary {
    background: linear-gradient(45deg, #ef4444, #dc2626);
    color: white;
    box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
  }

  &.secondary {
    background: linear-gradient(45deg, #10b981, #059669);
    color: white;
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

const StatusIndicator = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 25px;
  font-size: 14px;
  font-weight: 600;
  z-index: 1000;
`;

const ChatSection = styled.div`
  position: fixed;
  right: 20px;
  top: 20px;
  bottom: 100px;
  width: 300px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  z-index: 100;

  @media (max-width: 768px) {
    display: none;
  }
`;

const MessagesContainer = styled.div`
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  display: flex;
  flex-direction: column-reverse;
`;

const Message = styled.div`
  background: ${props => props.isOwn ? 'rgba(16, 185, 129, 0.8)' : 'rgba(255, 255, 255, 0.8)'};
  color: ${props => props.isOwn ? 'white' : '#333'};
  padding: 8px 12px;
  border-radius: 15px;
  margin: 5px 0;
  max-width: 80%;
  align-self: ${props => props.isOwn ? 'flex-end' : 'flex-start'};
  word-wrap: break-word;
`;

const ChatInput = styled.input`
  padding: 12px;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 0 0 12px 12px;
  outline: none;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }
`;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://omegle-clone-backend-production-8f06.up.railway.app';

// WebRTC Configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

const VideoChat = ({ user }) => {
    const navigate = useNavigate();
    
    // Refs
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const socketRef = useRef(null);
    const peerConnectionRef = useRef(null);
    
    // State
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState('');
    const [userCount, setUserCount] = useState('🔃');
    const [roomId, setRoomId] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const [reConnect, setReConnect] = useState(false);

    // Initialize connection
    useEffect(() => {
        initializeConnection();
        return cleanup;
    }, [reConnect]);

    const initializeConnection = async () => {
        try {
            console.log('Initializing connection...');
            setConnectionStatus('Requesting camera access...');

            // Get user media
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, facingMode: "user" },
                audio: true
            });
            
            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Initialize socket
            socketRef.current = io(BACKEND_URL, {
                transports: ['websocket', 'polling']
            });

            // Initialize peer connection
            peerConnectionRef.current = new RTCPeerConnection(configuration);

            // Add local stream to peer connection
            stream.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, stream);
            });
            console.log("ADDED LOCAL TRACKS TO PC");

            setupSocketListeners();
            setupPeerConnectionListeners();

            // Join the queue
            setConnectionStatus('Looking for partner...');
            socketRef.current.emit('join');

        } catch (error) {
            console.error('Error initializing connection:', error);
            setConnectionStatus('Failed to access camera/microphone');
        }
    };

    const setupSocketListeners = () => {
        const socket = socketRef.current;

        socket.on('joined', ({ room }) => {
            setRoomId(room);
            setConnectionStatus('Partner found! Connecting...');
            console.log('JOINED ROOM:', room);
        });

        socket.on('send-offer', async () => {
            console.log('OFFER REQUEST RECEIVED');
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);
            console.log('CREATED OFFER SENDING TO:', roomId);
            socket.emit('offer', roomId, offer);
        });

        socket.on('offer', async (offer) => {
            console.log('OFFER RECEIVED SENDING ANSWER');
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            socket.emit('answer', roomId, answer);
        });

        socket.on('answer', async (answer) => {
            console.log('ANSWER RECEIVED');
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            setConnectionStatus('Connected!');
        });

        socket.on('ice-candidates', async (iceCandidate) => {
            console.log('RECEIVED ICE CANDIDATES');
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(iceCandidate));
        });

        socket.on('message', (msg) => {
            setMessages(prev => [{ from: 'remote', message: msg }, ...prev]);
        });

        socket.on('user-count', (count) => {
            setUserCount(count);
        });

        socket.on('leaveRoom', () => {
            console.log('ROOM LEAVING REQUEST RECEIVED');
            handlePartnerLeft();
        });
    };

    const setupPeerConnectionListeners = () => {
        const pc = peerConnectionRef.current;

        pc.addEventListener('icecandidate', (event) => {
            if (event.candidate && roomId) {
                console.log('SENDING ICE CANDIDATES');
                socketRef.current.emit('ice-candidates', roomId, event.candidate);
            }
        });

        pc.addEventListener('track', (event) => {
            console.log('HANDLE TRACK LISTENER');
            const remoteStream = event.streams[0];
            setRemoteStream(remoteStream);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            setConnectionStatus('Connected!');
            console.log('SET THE REMOTE VIDEO REF');
        });

        pc.addEventListener('negotiationneeded', async () => {
            try {
                if (!roomId) return;
                console.log('NEGOTIATION NEEDED: Creating offer');
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socketRef.current.emit('offer', roomId, offer);
            } catch (error) {
                console.error('Error during negotiation:', error);
            }
        });
    };

    const handlePartnerLeft = () => {
        setMessages([]);
        setRemoteStream(null);
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        setRoomId('');
        setConnectionStatus('Partner left. Finding new partner...');
        
        // Auto-reconnect
        setTimeout(() => {
            setReConnect(prev => !prev);
        }, 2000);
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!roomId || !messageText.trim()) return;
        
        socketRef.current.emit('message', roomId, messageText);
        setMessages(prev => [{ from: 'host', message: messageText }, ...prev]);
        setMessageText('');
    };

    const handleSkip = () => {
        if (socketRef.current) {
            socketRef.current.emit('leaveRoom');
        }
    };

    const handleStop = () => {
        cleanup();
        navigate('/');
    };

    const cleanup = () => {
        console.log('CLEANUP ALL LISTENERS');
        
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
        }
        
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
        }
        
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
        }
        
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
        
        console.log('CLOSED PEER CONNECTION');
    };

    return (
        <Container>
            <StatusIndicator>
                {connectionStatus} • {userCount} users online
            </StatusIndicator>

            <VideoContainer>
                <VideoWrapper>
                    <Video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                    />
                    <VideoLabel>You</VideoLabel>
                </VideoWrapper>

                <VideoWrapper>
                    {remoteStream ? (
                        <Video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                        />
                    ) : (
                        <PlaceholderMessage>
                            {connectionStatus}
                        </PlaceholderMessage>
                    )}
                    <VideoLabel>Partner</VideoLabel>
                </VideoWrapper>
            </VideoContainer>

            <ChatSection>
                <MessagesContainer>
                    {messages.map((msg, index) => (
                        <Message key={index} isOwn={msg.from === 'host'}>
                            {msg.message}
                        </Message>
                    ))}
                </MessagesContainer>
                <ChatInput
                    type="text"
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSend(e);
                    }}
                />
            </ChatSection>

            <Controls>
                <Button className="secondary" onClick={handleSkip}>
                    🔄 Next Partner
                </Button>
                <Button className="primary" onClick={handleStop}>
                    🏠 End Chat
                </Button>
            </Controls>
        </Container>
    );
};

export default VideoChat;
