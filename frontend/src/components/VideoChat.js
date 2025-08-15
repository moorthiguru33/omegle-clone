import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import styled from 'styled-components';

// Your existing styled components remain the same...
const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
`;

const VideoContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  gap: 2px;
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
  border-radius: 12px;
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  gap: 16px;
`;

const Button = styled.button`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &.primary {
    background: #ef4444;
    color: white;
  }
  
  &.secondary {
    background: #10b981;
    color: white;
  }
`;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://omegle-clone-backend-production-8f06.up.railway.app';

// Simple ICE servers configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

const VideoChat = ({ user }) => {
    const navigate = useNavigate();
    const localVideoRef = useRef();
    const remoteVideoRef = useRef();
    const socketRef = useRef();
    const peerConnectionRef = useRef();
    
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const [roomId, setRoomId] = useState('');
    const [reConnect, setReConnect] = useState(false);

    // Initialize WebRTC and Socket
    useEffect(() => {
        const initializeConnection = async () => {
            try {
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

                // Add local stream tracks
                stream.getTracks().forEach(track => {
                    peerConnectionRef.current.addTrack(track, stream);
                });

                setupSocketListeners();
                setupPeerConnectionListeners();

                // Join the matching queue
                socketRef.current.emit('join');
                setConnectionStatus('Looking for partner...');

            } catch (error) {
                console.error('Error initializing:', error);
                setConnectionStatus('Failed to access camera/microphone');
            }
        };

        const setupSocketListeners = () => {
            socketRef.current.on('joined', ({ room }) => {
                console.log('Joined room:', room);
                setRoomId(room);
                setConnectionStatus('Partner found! Connecting...');
            });

            socketRef.current.on('send-offer', async () => {
                console.log('Creating offer...');
                const offer = await peerConnectionRef.current.createOffer();
                await peerConnectionRef.current.setLocalDescription(offer);
                socketRef.current.emit('offer', roomId, offer);
            });

            socketRef.current.on('offer', async (offer) => {
                console.log('Received offer, sending answer...');
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnectionRef.current.createAnswer();
                await peerConnectionRef.current.setLocalDescription(answer);
                socketRef.current.emit('answer', roomId, answer);
            });

            socketRef.current.on('answer', async (answer) => {
                console.log('Received answer');
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                setConnectionStatus('Connected!');
            });

            socketRef.current.on('ice-candidates', async (iceCandidate) => {
                console.log('Received ICE candidate');
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(iceCandidate));
            });

            socketRef.current.on('leaveRoom', () => {
                console.log('Partner left, finding new partner...');
                handlePartnerLeft();
            });

            socketRef.current.on('user-count', (count) => {
                console.log('Users online:', count);
            });
        };

        const setupPeerConnectionListeners = () => {
            peerConnectionRef.current.addEventListener('icecandidate', (event) => {
                if (event.candidate && roomId) {
                    console.log('Sending ICE candidate');
                    socketRef.current.emit('ice-candidates', roomId, event.candidate);
                }
            });

            peerConnectionRef.current.addEventListener('track', (event) => {
                console.log('Received remote stream');
                const remoteStream = event.streams[0];
                setRemoteStream(remoteStream);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setConnectionStatus('Connected!');
            });

            peerConnectionRef.current.addEventListener('negotiationneeded', async () => {
                if (roomId) {
                    console.log('Negotiation needed, creating offer');
                    const offer = await peerConnectionRef.current.createOffer();
                    await peerConnectionRef.current.setLocalDescription(offer);
                    socketRef.current.emit('offer', roomId, offer);
                }
            });
        };

        initializeConnection();

        return () => {
            // Cleanup
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
        };
    }, [reConnect]);

    const handlePartnerLeft = () => {
        setRemoteStream(null);
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        setConnectionStatus('Partner left. Finding new partner...');
        setRoomId('');
        
        // Reconnect after delay
        setTimeout(() => {
            setReConnect(prev => !prev);
        }, 2000);
    };

    const handleNextPartner = () => {
        if (socketRef.current) {
            socketRef.current.emit('leaveRoom');
        }
        handlePartnerLeft();
    };

    const handleStopCall = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
        navigate('/');
    };

    return (
        <Container>
            <VideoContainer>
                <VideoWrapper>
                    <video 
                        ref={localVideoRef} 
                        autoPlay 
                        muted 
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', top: '10px', left: '10px', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '5px' }}>
                        You
                    </div>
                </VideoWrapper>
                
                <VideoWrapper>
                    {remoteStream ? (
                        <video 
                            ref={remoteVideoRef} 
                            autoPlay 
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white', fontSize: '18px' }}>
                            {connectionStatus}
                        </div>
                    )}
                    <div style={{ position: 'absolute', top: '10px', left: '10px', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '5px' }}>
                        Partner
                    </div>
                </VideoWrapper>
            </VideoContainer>

            <Controls>
                <Button className="secondary" onClick={handleNextPartner}>
                    🔄 Next Partner
                </Button>
                <Button className="primary" onClick={handleStopCall}>
                    🏠 End Chat
                </Button>
            </Controls>
        </Container>
    );
};

export default VideoChat;
