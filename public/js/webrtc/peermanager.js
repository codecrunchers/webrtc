
var WConnections = function(){

    pc = null;
    localConnection = null;
    remoteConnection = null;
    pendingCandidates = [];

    return {

        apply: function(){
            localConnection = new RTCPeerConnection(
                    {
                        iceServers: [{url:'stun:stun.l.google.com:19302'}]
                    }
                    );

            // Create the data channel and establish its event listeners
            sendChannel = localConnection.createDataChannel("sendChannel",
                    JSON.stringify({
                        ordered: false,
                        maxRetransmits: 10
                    }));
            sendChannel.onopen = handleSendChannelStatusChange;
            sendChannel.onclose = handleSendChannelStatusChange;
            sendChannel.onnmessage = function(message){ console.log("message",message); }
            sendChannel.onerror = doHandleError;

            // Set up the ICE candidates for the two peers
            localConnection.onicecandidate =  function(event){
                console.log("** Local ICE Candidate", event.candidate);
                var candidate = event.candidate;
                if(!candidate) return;
                if(signallingChannel.isReady()){
                    signallingChannel.send(
                            JSON.stringify(
                                {'type': 'ice',
                                    'sdp': {'candidate': candidate.candidate, 'sdpMid': candidate.sdpMid, 'sdpMLineIndex': candidate.sdpMLineIndex}
                                })
                            );
                }}


            localConnection.onnegotiationneeded = handleNegotiationNeededEvent;
            console.log("Local Peer Initiated");
        },
        getLocalPeer: function(){
            return localConnection;
        },
        getRemotePeer: function() {
            return remoteConnection;
        },
        registerServerPeer: function(){
            remoteConnection = new RTCPeerConnection({
                iceServers: [{url:'stun:stun.l.google.com:19302'}]
            });

            remoteConnection.ondatachannel = receiveChannelCallback;

            remoteConnection.onicecandidate = function(event){
                console.log("** Remote ICE Candidate",event.candidate);
                var candidate = event.candidate;
                if(!candidate) return;
                localConnection.addIceCandidate(e.candidate).catch(handleAddCandidateError);
            }

            remoteConnection.onnegotiationneeded = handleNegotiationNeededEvent;
        }
    }

    function handleNegotiationNeededEvent() {

        console.log("*** Negotiation needed");

        console.log("---> Creating offer");
        localConnection.createOffer().then(function(offer) {
            console.log("---> Creating new description object to send to remote peer", offer);
            return localConnection.setLocalDescription(offer);
        })
        .then(function() {
            console.log("---> Sending ICE Pendings to remote peer");
            pendingCandidates.forEach(function(candidate)
                    {
                        ws.send(JSON.stringify(
                                    {'type': 'ice',
                                        'sdp': {'candidate': candidate.candidate, 'sdpMid': candidate.sdpMid, 'sdpMLineIndex': candidate.sdpMLineIndex}
                                    })
                               );
                    });

            signallingChannel.send(JSON.stringify({
                type: "video-offer",
                sdp: localConnection.localDescription
            }));
        }).catch(function(e){console.log(e);})

    }

    function handleCreateDescriptionError(error) {
        console.log("Unable to create an offer: " + error.toString());
    }

    // Handle successful addition of the ICE candidate
    // on the "local" end of the connection.

    function handleLocalAddCandidateSuccess() {
        connectButton.disabled = true;
    }

    // Handle successful addition of the ICE candidate
    // on the "remote" end of the connection.

    function handleRemoteAddCandidateSuccess() {
        disconnectButton.disabled = false;
    }

    // Handle an error that occurs during addition of ICE candidate.

    function handleAddCandidateError(e) {
        console.log("Oh noes! addICECandidate failed!",e);
    }

    // Handles clicks on the "Send" button by transmitting
    // a message to the remote peer.

    function sendMessage() {
        sendChannel.send("A Message");
    }

    // Handle status changes on the local end of the data
    // channel; this is the end doing the sending of data
    // in this example.

    function handleSendChannelStatusChange(event) {
        if (sendChannel) {
            var state = sendChannel.readyState;
        }
        console.log("Send Channel State", state);
    }

    // Called when the connection opens and the data
    // channel is ready to be connected to the remote.

    function receiveChannelCallback(event) {
        receiveChannel = event.channel;
        receiveChannel.onmessage = handleReceiveMessage;
        receiveChannel.onopen = handleReceiveChannelStatusChange;
        receiveChannel.onclose = handleReceiveChannelStatusChange;
    }

    // Handle onmessage events for the receiving channel.
    // These are the data messages sent by the sending channel.

    function handleReceiveMessage(event) {
        console.log("Recevied Event",event);
    }

    // Handle status changes on the receiver's channel.

    function handleReceiveChannelStatusChange(event) {
        if (receiveChannel) {
            console.log("Receive channel's status has changed to " +
                    receiveChannel.readyState);
        }

        // Here you would do stuff that needs to be done
        // when the channel's status changes.
    }

    // Close the connection, including data channels if they're open.
    // Also update the UI to reflect the disconnected status.

    function disconnectPeers() {

        // Close the RTCDataChannels if they're open.

        sendChannel.close();
        receiveChannel.close();

        // Close the RTCPeerConnections

        localConnection.close();
        remoteConnection.close();

        sendChannel = null;
        receiveChannel = null;
        localConnection = null;
        remoteConnection = null;
    }
}

wrtcConnections = WConnections();
wrtcConnections.apply();

function doHandleError(error){
    throw error;
}
