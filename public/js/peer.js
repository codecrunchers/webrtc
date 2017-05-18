var _pc;
(function() {

    var host = window.location.host.split(':')[0];
    var bridge = window.location.toString().split('?')[1] || host + ':8043';

    var RTCPeerConnection     = wrtc.RTCPeerConnection;
    var RTCSessionDescription = wrtc.RTCSessionDescription;
    var RTCIceCandidate       = wrtc.RTCIceCandidate;

    var dataChannelSettings = {
        'reliable': {
            ordered: false,
            maxRetransmits: 10
        },
        /*
           'reliable': {},
           '@control': {
           outOfOrderAllowed: true,
           maxRetransmitNum: 0
           }
           */
    };

    var pendingDataChannels = {};
    var dataChannels = {};
    var pendingCandidates = [];

    function doHandleError(error)
    {
        throw error;
    }

    function doComplete()
    {
        console.log('complete');
        var data = new Uint8Array([97, 99, 107, 0]);
        dataChannels['reliable'].send(data.buffer);
        dataChannels['reliable'].send("Hello bridge!");
    }

    function doWaitforDataChannels()
    {
        console.log('awaiting data channels');
    }

    var ws = null;
    var pc = _pc = new RTCPeerConnection(
            {
                iceServers: [{url:'stun:stun.l.google.com:19302'}]
            },
            {
                'optional': []
            }
            );

    pc.onaddstream = function(stream){
        console.log("@stream added",stream);
    }

    pc.ontrack = function(stream){
        console.log("@track added",stream);
    }

    pc.ondatachannel = function(datac){
        console.log("@data channell added",datac);
    }

    pc.onidentityresult = function(id){
        console.log("@identity result",id);

    }

/*    pc.onnegotiationneeded =  function(event){
        console.debug("@onnegotiationneeded", event);
        setTimeout(function(t){
            console.log("---> Sending offer to remote peer");

            doSendOffer({
                type: "video-offer",
                sdp: pc.localDescription
            });
        },2000);
    }
*/

    pc.onsignalingstatechange = function(event)
    {
        console.info("signaling state change: ", event.target.signalingState);
    };
    pc.oniceconnectionstatechange = function(event)
    {
        console.info("ice connection state change: ", event.target.iceConnectionState);
    };
    pc.onicegatheringstatechange = function(event)
    {
        console.info("ice gathering state change: ", event.target.iceGatheringState);
    };
    pc.onicecandidate = function(event)
    {
        var candidate = event.candidate;
        if(!candidate) return;
        console.log("candidate",event.candidate);

        if(WebSocket.OPEN == ws.readyState)
        {
            ws.send(JSON.stringify(
                        {'type': 'ice',
                            'sdp': {'candidate': candidate.candidate, 'sdpMid': candidate.sdpMid, 'sdpMLineIndex': candidate.sdpMLineIndex}
                        })
                   );
        } else
        {
            pendingCandidates.push(candidate);
        }
    };

    doCreateDataChannels();

    function doCreateDataChannels()
    {
        var labels = Object.keys(dataChannelSettings);
        labels.forEach(function(label) {
            var channelOptions = dataChannelSettings[label];
            var channel = pendingDataChannels[label] = pc.createDataChannel(label, channelOptions);
            channel.binaryType = 'arraybuffer';
            channel.onopen = function() {
                console.info('onopen');
                dataChannels[label] = channel;
                delete pendingDataChannels[label];
                if(Object.keys(dataChannels).length === labels.length) {
                    doComplete();
                }
            };
            channel.onmessage = function(event) {
                var data = event.data;
                if('string' == typeof data) {
                    console.log('onmessage:', data);
                } else {
                    console.log('onmessage:', new Uint8Array(data));
                }
            };
            channel.onclose = function(event) {
                console.info('onclose');
            };
            channel.onerror = doHandleError;
        });
        doCreateOffer();
    }

    function doCreateOffer()
    {
        pc.createOffer(
                doSetLocalDesc,
                doHandleError
                );
    }

    function doSetLocalDesc(desc)
    {
        pc.setLocalDescription(
                new RTCSessionDescription(desc),
                doSendOffer.bind(undefined, desc),
                doHandleError
                );
    }

    function doSendOffer(offer)
    {
        ws = new WebSocket("wss://" + bridge);
        ws.onopen = function()
        {
            pendingCandidates.forEach(function(candidate)
                    {
                        ws.send(JSON.stringify(
                                    {'type': 'ice',
                                        'sdp': {'candidate': candidate.candidate, 'sdpMid': candidate.sdpMid, 'sdpMLineIndex': candidate.sdpMLineIndex}
                                    })
                               );
                    });
            ws.send(JSON.stringify(
                        {'type': offer.type, 'sdp': offer.sdp})
                   );
        };
        ws.onmessage = function(event)
        {
            data = JSON.parse(event.data);
            if('answer' == data.type)
            {
                doSetRemoteDesc(data);
            } else if('ice' == data.type)
            {
                if(data.sdp.candidate) {
                    var candidate = new RTCIceCandidate(data.sdp.candidate);
                    pc.addIceCandidate(candidate, handleAddIceCandidateSuccess, handleAddIceCandidateError);
                }
            }
        };
    }

    function handleAddIceCandidateSuccess() {

    }

    function handleAddIceCandidateError() {

    }

    function doSetRemoteDesc(desc)
    {
        pc.setRemoteDescription(
                new RTCSessionDescription(desc),
                doWaitforDataChannels,
                doHandleError
                );
    }

})();
