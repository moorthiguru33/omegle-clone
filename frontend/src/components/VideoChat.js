import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import styled from 'styled-components';

// All your existing styled components remain the same...
const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    font-family: 'Arial', sans-serif;
    position: relative;
    overflow: hidden;
`;

// ... (keep all other styled components as they are) ...

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://omegle-clone-backend-production-8f06.up.railway.app';

// Stable ICE servers
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
];

const VideoChat = ({ user, updateUser }) => {
    const navigate = useNavigate();
    
    // Refs - stable references
    const localVideoRef = useRef();
    const remoteVideoRef = useRef();
    const socketRef = useRef();
    const peerConnectionRef = useRef();
    const localStreamRef = useRef();
    const mountedRef = useRef(true);
    
    // State
    const [connectionStatus, setConnectionStatus] = useState('Starting...');
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [hasLocalVideo, setHasLocalVideo] = useState(false);
    const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

    // **ANTI-FLICKER FIX**: Stable video stream management
    const setLocalVideoStream = useCallback((stream) => {
        if (!mountedRef.current) return;
        
        localStreamRef.current = stream;
        setHasLocalVideo(!!stream);
        
        if (localVideoRef.current && stream) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.muted = true;
            localVideoRef.current.playsInline = true;
            
            // Auto-play with error handling
            localVideoRef.current.play().catch(e => {
                console.log('Local video autoplay prevented');
            });
        }
    }, []);

    const setRemoteVideoStream = useCallback((stream) => {
        if (!mountedRef.current) return;
        
        setHasRemoteVideo(!!stream);
        
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            remoteVideoRef.current.playsInline = true;
            
            if (stream) {
                remoteVideoRef.current.play().catch(e => {
                    console.log('Remote video autoplay prevented');
                });
            }
        }
    }, []);

    // Get user media with error handling
    const getUserMedia = useCallback(async () => {
        try {
            console.log('🎥 Requesting camera access...');
            setConnectionStatus('Requesting camera access...');
            
            const constraints = {
                video: {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 24, max: 30 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Camera access granted');
            
            setLocalVideoStream(stream);
            setConnectionStatus('Camera ready');
            
            return stream;
            
        } catch (error) {
            console.error('❌ Camera access failed:', error);
            setConnectionStatus('Camera access denied');
            throw error;
        }
    }, [setLocalVideoStream]);

    // **FIXED**: Socket initialization with proper event handlers
    const initializeSocket = useCallback(() => {
        if (socketRef.current?.connected) {
            return socketRef.current;
        }

        console.log('🌐 Connecting to server...');
        setConnectionStatus('Connecting to server...');

        socketRef.current = io(BACKEND_URL, {
            transports: ['websocket', 'polling'],
            timeout: 20000,
            forceNew: true,
            reconnection: false  // **ANTI-FLICKER**: Disable auto-reconnection
        });

        socketRef.current.on('connect', () => {
            if (!mountedRef.current) return;
            console.log('✅ Connected to server');
            setConnectionStatus('Connected! Looking for partner...');
            
            // Auto-start search after connection
            setTimeout(() => {
                if (mountedRef.current && user?.id && user?.gender) {
                    findPartner();
                }
            }, 1000);
        });

        socketRef.current.on('matched', (partnerId) => {
            if (!mountedRef.current) return;
            console.log('🎯 Partner found:', partnerId);
            setConnectionStatus('Partner found! Connecting...');
            setIsConnecting(true);
            
            // Start call process
            setTimeout(() => {
                if (mountedRef.current) {
                    initiateCall();
                }
            }, 1000);
        });

        socketRef.current.on('waiting', () => {
            if (!mountedRef.current) return;
            console.log('⏳ Waiting for partner...');
            setConnectionStatus('Looking for partner...');
            setIsConnecting(false);
        });

        // WebRTC signaling
        socketRef.current.on('offer', async (offer) => {
            if (!mountedRef.current) return;
            console.log('📞 Received offer');
            setConnectionStatus('Incoming call...');
            await handleOffer(offer);
        });

        socketRef.current.on('answer', async (answer) => {
            if (!mountedRef.current) return;
            console.log('✅ Received answer');
            await handleAnswer(answer);
        });

        socketRef.current.on('ice-candidate', async (candidate) => {
            if (!mountedRef.current) return;
            await handleIceCandidate(candidate);
        });

        socketRef.current.on('partnerDisconnected', () => {
            if (!mountedRef.current) return;
            console.log('👋 Partner disconnected');
            setConnectionStatus('Partner disconnected');
            setIsConnecting(false);
            
            // Clean up remote video
            setRemoteVideoStream(null);
            
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            
            // Auto find new partner
            setTimeout(() => {
                if (mountedRef.current) {
                    findPartner();
                }
            }, 2000);
        });

        socketRef.current.on('disconnect', () => {
            if (!mountedRef.current) return;
            console.log('❌ Disconnected from server');
            setConnectionStatus('Disconnected');
        });

        return socketRef.current;
    }, [user]);

    // Create peer connection
    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({
            iceServers: ICE_SERVERS,
            iceCandidatePoolSize: 10
        });

        pc.onicecandidate = (event) => {
            if (event.candidate && socketRef.current?.connected) {
                socketRef.current.emit('ice-candidate', event.candidate);
            }
        };

        pc.ontrack = (event) => {
            if (!mountedRef.current) return;
            console.log('🎬 Received remote stream');
            const [stream] = event.streams;
            setRemoteVideoStream(stream);
            setConnectionStatus('Connected!');
            setIsConnecting(false);
        };

        pc.onconnectionstatechange = () => {
            if (!mountedRef.current) return;
            console.log('🔗 Connection state:', pc.connectionState);
            
            switch (pc.connectionState) {
                case 'connected':
                    setConnectionStatus('Connected!');
                    setIsConnecting(false);
                    break;
                case 'disconnected':
                case 'failed':
                    setConnectionStatus('Connection lost');
                    setIsConnecting(false);
                    setTimeout(() => {
                        if (mountedRef.current) {
                            findPartner();
                        }
                    }, 3000);
                    break;
            }
        };

        return pc;
    }, [setRemoteVideoStream]);

    // **FIXED**: Find partner function with correct event name
    const findPartner = useCallback(() => {
        if (!socketRef.current?.connected || !user?.id || !user?.gender) {
            console.log('❌ Cannot find partner - missing requirements');
            return;
        }

        console.log('🔍 Looking for partner...');
        setConnectionStatus('Looking for partner...');
        setIsConnecting(false);
        
        // Clean up previous connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        
        setRemoteVideoStream(null);

        const userData = {
            userId: user.id,
            gender: user.gender,
            preferredGender: user.preferredGender || 'any'
        };

        // **CRITICAL FIX**: Use the correct event name
        socketRef.current.emit('find-partner', userData);
    }, [user, setRemoteVideoStream]);

    // Initiate call
    const initiateCall = useCallback(async () => {
        if (!localStreamRef.current || !socketRef.current?.connected) {
            console.log('❌ Cannot initiate call');
            return;
        }

        try {
            console.log('📞 Initiating call...');
            peerConnectionRef.current = createPeerConnection();
            
            // Add local stream tracks
            localStreamRef.current.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, localStreamRef.current);
            });

            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);
            
            socketRef.current.emit('offer', offer);
            console.log('📞 Offer sent');
            
        } catch (error) {
            console.error('❌ Failed to initiate call:', error);
            setConnectionStatus('Failed to start call');
        }
    }, [createPeerConnection]);

    // Handle offer
    const handleOffer = useCallback(async (offer) => {
        if (!localStreamRef.current) return;

        try {
            peerConnectionRef.current = createPeerConnection();
            
            localStreamRef.current.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, localStreamRef.current);
            });

            await peerConnectionRef.current.setRemoteDescription(offer);
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            
            socketRef.current.emit('answer', answer);
            console.log('📞 Answer sent');
            
        } catch (error) {
            console.error('❌ Failed to handle offer:', error);
        }
    }, [createPeerConnection]);

    // Handle answer
    const handleAnswer = useCallback(async (answer) => {
        if (!peerConnectionRef.current) return;
        
        try {
            await peerConnectionRef.current.setRemoteDescription(answer);
            console.log('✅ Answer processed');
        } catch (error) {
            console.error('❌ Failed to handle answer:', error);
        }
    }, []);

    // Handle ICE candidate
    const handleIceCandidate = useCallback(async (candidate) => {
        if (!peerConnectionRef.current) return;
        
        try {
            await peerConnectionRef.current.addIceCandidate(candidate);
        } catch (error) {
            console.error('❌ ICE candidate error:', error);
        }
    }, []);

    // Control functions
    const toggleAudio = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioEnabled;
                setAudioEnabled(!audioEnabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoEnabled;
                setVideoEnabled(!videoEnabled);
            }
        }
    };

    const nextPartner = () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        
        if (socketRef.current?.connected) {
            socketRef.current.emit('endCall');
        }
        
        setRemoteVideoStream(null);
        setTimeout(() => findPartner(), 1000);
    };

    const stopCall = () => {
        mountedRef.current = false;
        
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
        
        if (socketRef.current) {
            socketRef.current.emit('endCall');
            socketRef.current.disconnect();
        }
        
        navigate('/');
    };

    // Initialize on mount
    useEffect(() => {
        if (!user?.id || !user?.gender) {
            navigate('/');
            return;
        }

        const init = async () => {
            try {
                await getUserMedia();
                initializeSocket();
            } catch (error) {
                console.error('❌ Initialization failed:', error);
                setConnectionStatus('Failed to start video chat');
            }
        };

        init();

        // Cleanup on unmount
        return () => {
            mountedRef.current = false;
            
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
            
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [getUserMedia, initializeSocket, user, navigate]);

    return (
        <Container>
            <ConnectionStatus status={connectionStatus}>
                {connectionStatus}
            </ConnectionStatus>

            <VideoContainer>
                <VideoWrapper>
                    <VideoLabel>You</VideoLabel>
                    <Video 
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{ display: hasLocalVideo ? 'block' : 'none' }}
                    />
                    {!hasLocalVideo && (
                        <PlaceholderMessage>
                            🎥 Starting camera...
                        </PlaceholderMessage>
                    )}
                </VideoWrapper>

                <VideoWrapper>
                    <VideoLabel>Partner</VideoLabel>
                    <Video 
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        style={{ display: hasRemoteVideo ? 'block' : 'none' }}
                    />
                    {!hasRemoteVideo && (
                        <PlaceholderMessage>
                            {isConnecting ? '🔄 Connecting...' : '👋 Waiting for partner...'}
                        </PlaceholderMessage>
                    )}
                </VideoWrapper>
            </VideoContainer>

            <Controls>
                <ControlButton 
                    className="control" 
                    active={audioEnabled}
                    onClick={toggleAudio}
                    title={audioEnabled ? 'Mute' : 'Unmute'}
                >
                    {audioEnabled ? '🎤' : '🔇'}
                </ControlButton>
                
                <ControlButton 
                    className="control" 
                    active={videoEnabled}
                    onClick={toggleVideo}
                    title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                    {videoEnabled ? '📹' : '📷'}
                </ControlButton>
                
                <ControlButton 
                    className="secondary" 
                    onClick={nextPartner}
                    title="Next partner"
                >
                    ⏭️
                </ControlButton>
                
                <ControlButton 
                    className="primary" 
                    onClick={stopCall}
                    title="End chat"
                >
                    ❌
                </ControlButton>
                
                <ControlButton 
                    className="home" 
                    onClick={() => navigate('/')}
                    title="Home"
                >
                    🏠
                </ControlButton>
            </Controls>
        </Container>
    );
};

export default VideoChat;
