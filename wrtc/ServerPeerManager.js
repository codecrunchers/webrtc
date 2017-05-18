var args = require('minimist')(process.argv.slice(2));
var webrtc = require('wrtc');
var ws = require('ws');
var appServer = require('../server/server').appServer.getServer()
var offer = null;
var answer = null;

//WebSocket for RTC
var MAX_REQUEST_LENGHT = 1024;
var dataChannelSettings = {
    'reliable': {
        ordered: false,
        maxRetransmits: 0
    }
};


var host = args.h || '192.168.0.248';
var port = args.p || 8043;

var RTCSocket = function(){
    return {
        init: (function() {
            var wss = new ws.Server( { server: appServer } );
            wss.on('connection', function(ws)
                    {
                        console.info('ws connected');
                        var pendingDataChannels = {};
                        var dataChannels = {}
                        var pendingCandidates = [];

                        var offer,answer=null;
                        var pc = null;
                        var remoteReceived = false;

                        function doComplete()
                        {
                            console.info('@doComplete');
                        }

                        function doHandleError(error)
                        {
                            console.error(error);
                            throw error;
                        }

                        function doCreateAnswer()
                        {
                            console.log("@doCreateAnswer");
                            remoteReceived = true;
                            pendingCandidates.forEach(function(candidate)
                                    {
                                        if(candidate.sdp) {
                                            pc.addIceCandidate(new webrtc.RTCIceCandidate(candidate.sdp) ,
                                                    function(){
                                                        console.log("added candidate",candidate);
                                                    },
                                                    function(e){
                                                        console.log("failed to add candidate",e);

                                                    }

                                                    );
                                        }
                                    });
                            pc.createAnswer(
                                    doSetLocalDesc,
                                    doHandleError
                                    );
                        };

                        function doSetLocalDesc(desc)
                        {
                            console.log("@doSetLocalDesc Ans",answer);

                            answer = desc;
                            pc.setLocalDescription(
                                    desc,
                                    doSendAnswer,
                                    doHandleError
                                    );
                        };

                        function doSendAnswer()
                        {
                            console.log("@doSendAnswer");
                            ws.send(JSON.stringify(answer));
                            console.log('awaiting data channels');
                        }

                        function doHandleDataChannels()
                        {
                            console.log("@doHandleDataChannels");

                            var labels = Object.keys(dataChannelSettings);


                            pc.ondatachannel = function(evt) {
                                console.log("@wrtc:ondatachannel");
                                var channel = evt.channel;
                                console.log('@wrtc:ondatachannel', channel.label, channel.readyState);

                                var label = channel.label;
                                pendingDataChannels[label] = channel;
                                channel.binaryType = 'arraybuffer';

                                channel.onopen = function() {
                                    console.info('@onopen');
                                    dataChannels[label] = channel;
                                    delete pendingDataChannels[label];
                                    if(Object.keys(dataChannels).length === labels.length) {
                                        doComplete();
                                    }

                                };
                                channel.onmessage = function(evt) {
                                    console.info('@channel:onmessage');

                                    var data = evt.data;
                                    if (typeof data === 'string') {
                                        console.log('onmessage:', evt.data);
                                    } else {
                                        console.log('onmessage:', new Uint8Array(evt.data));
                                    }
                                    if('string' == typeof data) {
                                        channel.send("Hello peer!");
                                    } else {
                                        var response = new Uint8Array([107, 99, 97, 0]);
                                        channel.send(response.buffer);
                                    }

                                };

                                channel.onclose = function() {
                                    console.info('onclose');
                                };
                                channel.onerror = doHandleError;
                            };

                            doSetRemoteDesc();
                        };

                        function doSetRemoteDesc()
                        {
                            console.info("@doSetRemoteDesc");
                            pc.setRemoteDescription(
                                    offer,
                                    doCreateAnswer,
                                    doHandleError
                                    );
                        }

                        ws.on('message', function(data)
                                {
                                    console.log("@ws message Called");
                                    data = JSON.parse(data);
                                    if('offer' == data.type)
                                    {
                                        console.log("Processing Offer",data);

                                        offer = new webrtc.RTCSessionDescription(data);
                                        answer = null;
                                        remoteReceived = false;

                                        pc = new webrtc.RTCPeerConnection(
                                                {
                                                    iceServers: [{url:'stun:stun.l.google.com:19302'}]
                                                },
                                                {
                                                    'optional': [{DtlsSrtpKeyAgreement: false}]
                                                }
                                                );

                                        console.log("PC Created");

                                        pc.onsignalingstatechange = function(state)
                                        {
                                            console.info('signaling state change:', state);
                                        }
                                        pc.oniceconnectionstatechange = function(state)
                                        {
                                            console.info('ice connection state change:', state);
                                        }
                                        pc.onicegatheringstatechange = function(state)
                                        {
                                            console.info('ice gathering state change:', state);
                                        }
                                        pc.onicecandidate = function(candidate)
                                        {
                                            ws.send(JSON.stringify(
                                                        {'type': 'ice',
                                                            'sdp': {'candidate': candidate.candidate, 'sdpMid': candidate.sdpMid, 'sdpMLineIndex': candidate.sdpMLineIndex}
                                                        })
                                                   );
                                        } 

                                        pc.onaddstream = function(){
                                            console.log("Stream Added");
                                        }

                                        doHandleDataChannels();

                                        console.log("End Processing Offer");

                                    } else if('ice' == data.type)
                                    {
                                        console.log("Processing Ice");

                                        if(remoteReceived)
                                        {
                                            if(data.sdp.candidate) {
                                                pc.addIceCandidate(
                                                        new webrtc.RTCIceCandidate(data.sdp.candidate),
                                                        function(e){
                                                            console.log("addded candidate",candidate,e);
                                                        },
                                                        function(e){
                                                            console.log("failed to add candidate",e);

                                                        }
                                                        );
                                            }
                                        } else
                                        {
                                            pendingCandidates.push(data);
                                        }

                                        console.log("End Processing Ice");

                                    }
                                });
                    });



        })()
    }
}

rtcSocket =  RTCSocket();
exports.appSocket = rtcSocket;
