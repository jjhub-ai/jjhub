import type { Terminal } from 'xterm';
import type { SSEClient } from './authenticatedEventSource';
import { hasRepoContext, type RepoContext, repoApiFetch } from './repoContext';

export interface WebRTCTerminalOptions {
    sessionId: string;
    term: Terminal;
    eventSource: SSEClient;
    repoContext: RepoContext;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (err: Error) => void;
}

export interface WebRTCTerminalSession {
    close: () => void;
    resize: (cols: number, rows: number) => void;
}

export async function connectWebRTCTerminal(opts: WebRTCTerminalOptions): Promise<WebRTCTerminalSession> {
    const { sessionId, term, eventSource, repoContext, onConnected, onDisconnected, onError } = opts;

    if (!hasRepoContext(repoContext)) {
        throw new Error('Repository context is required for workspace WebRTC');
    }

    const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    let dataChannel: RTCDataChannel | null = null;
    let isConnected = false;
    let hasAnswered = false;

    const cleanup = () => {
        if (dataChannel) {
            dataChannel.close();
            dataChannel = null;
        }
        if (peer.signalingState !== 'closed') {
            peer.close();
        }
        if (isConnected) {
            onDisconnected?.();
            isConnected = false;
        }
    };

    // Send local ICE candidates to runner
    peer.onicecandidate = async (e) => {
        if (e.candidate) {
            try {
                await repoApiFetch(`/workspace/sessions/${sessionId}/webrtc`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sdp: '',
                        ice_candidates: JSON.stringify(e.candidate.toJSON())
                    }),
                }, repoContext);
            } catch (err) {
                console.warn('Failed to send ICE candidate', err);
            }
        }
    };

    // The runner creates the data channel, so we wait for it
    peer.ondatachannel = (e) => {
        dataChannel = e.channel;

        dataChannel.onopen = () => {
            isConnected = true;
            onConnected?.();
        };

        dataChannel.onclose = () => {
            cleanup();
        };

        dataChannel.binaryType = 'arraybuffer';
        dataChannel.onmessage = async (msg) => {
            if (msg.data instanceof ArrayBuffer) {
                term.write(new Uint8Array(msg.data));
            } else if (typeof msg.data === 'string') {
                term.write(msg.data);
            }
        };

        const disposable = term.onData((data) => {
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(data);
            }
        });

        const originalClose = dataChannel.close.bind(dataChannel);
        dataChannel.close = () => {
            disposable.dispose();
            originalClose();
        };
    };

    // Listen for WebRTC signaling from the runner over SSE
    const handleStatusEvent = async (e: MessageEvent) => {
        try {
            const parsed = JSON.parse(e.data);
            if (parsed.status === 'webrtc_update' && parsed.webrtc?.is_runner) {
                const sdpStr = parsed.webrtc.sdp;
                const iceStr = parsed.webrtc.ice_candidates;

                if (sdpStr && !hasAnswered) {
                    hasAnswered = true;
                    const offerDesc = JSON.parse(sdpStr);
                    await peer.setRemoteDescription(new RTCSessionDescription(offerDesc));

                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);

                    await repoApiFetch(`/workspace/sessions/${sessionId}/webrtc`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sdp: JSON.stringify(answer),
                            ice_candidates: ''
                        }),
                    }, repoContext);
                }

                if (iceStr) {
                    const candidate = JSON.parse(iceStr);
                    await peer.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } else if (parsed.status === 'stopped' || parsed.status === 'failed') {
                cleanup();
            }
        } catch (err) {
            console.warn('Failed to process WebRTC SSE signal', err);
        }
    };

    eventSource.addEventListener('status', handleStatusEvent);

    return {
        close: () => {
            eventSource.removeEventListener('status', handleStatusEvent);
            cleanup();
        },
        resize: (cols: number, rows: number) => {
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify({ type: 'resize', cols, rows }));
            }
        }
    };
}
