var webrtc = require('wrtc');
var ws = require('ws');
var args = require('minimist')(process.argv.slice(2));
var appServer = require('../server/server').appServer.getServer()
var fs = require('fs');  // file system


var MAX_REQUEST_LENGHT = 1024;
var pc = null;
var offer = null;
var answer = null;
var remoteReceived = false;


var dataChannelSettings = {
    'reliable': {
        ordered: false,
        maxRetransmits: 0
    }
};

var pendingDataChannels = {};
var dataChannels = {}
var pendingCandidates = [];

var host = args.h || '192.168.0.248';
var port = args.p || 8043;

var wss = new ws.Server( { server: appServer } );
wss.on('connection', function(ws)
        {
            console.info('ws connected');
            function doComplete()
            {
                console.info('complete');
            }

            function doHandleError(error)
            {
                throw error;
            }

            function doCreateAnswer()
            {
                remoteReceived = true;
                pendingCandidates.forEach(function(candidate)
                        {
                            if(candidate.sdp) {
                                pc.addIceCandidate(new webrtc.RTCIceCandidate(candidate.sdp),handleIceAddSuccess,handleIceAddFailure);
                            }
                        });
                pc.createAnswer(
                        doSetLocalDesc,
                        doHandleError
                        );
            };

            function doSetLocalDesc(desc)
            {
                answer = desc;
                console.log('LocalDesc Being Set %s:', desc.type);
                pc.setLocalDescription(
                        desc,
                        doSendAnswer,
                        doHandleError
                        );
            };

            function doSendAnswer()
            {
                ws.send(JSON.stringify(answer));
                console.log('awaiting data channels');
            }

            function doHandleDataChannels()
            {
                var labels = Object.keys(dataChannelSettings);
                pc.ondatachannel = function(evt) {
                    var channel = evt.channel;

                    console.log('ondatachannel', channel.label, channel.readyState);
                    var label = channel.label;
                    pendingDataChannels[label] = channel;
                    channel.binaryType = 'arraybuffer';

                    channel.onopen = function() {
                        console.info('onopen');
                        dataChannels[label] = channel;
                        delete pendingDataChannels[label];
                        if(Object.keys(dataChannels).length === labels.length) {
                            doComplete();
                        }
                    };
                    channel.onmessage = function(evt) {
                        var data = evt.data;
                        if (typeof data === 'string') {
                            console.log('onmessage:', evt.data);
                        } else {
                            writeVideo(evt.data);
                        }
                        /*if('string' == typeof data) {
                          channel.send("Hello peer!");
                          } else {
                          var response = new Uint8Array([107, 99, 97, 0]);
                          channel.send(response.buffer);
                          }*/
                    };
                    channel.onclose = function() {
                        console.log('onclose');
                    };

                    channel.onerror = doHandleError;
                };
                doSetRemoteDesc();
            };

            function doSetRemoteDesc()
            {
                console.info("Offer Received");
                pc.setRemoteDescription(
                        offer,
                        doCreateAnswer,
                        doHandleError
                        );
            }

            ws.on('message', function(data)
                    {
                        data = JSON.parse(data);
                        console.log("Data Type = ",data.type);
                        if('offer' == data.type)
                        {
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
                            pc.onaddstream = function(stream){
                                console.log("@-----stream added",stream);
                            }

                            pc.onsignalingstatechange = function(state)
                            {
                                console.info('signaling state change:', state);
                            }
                            pc.oniceconnectionstatechange = function(state)
                            {
                                console.log('ice connection state change:', state);
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

                            doHandleDataChannels();
                        } else if('ice' == data.type)
                        {

                            console.log("ICE ID Type = ",JSON.stringify(data));

                            if(remoteReceived)
                            {
                                if(data.sdp.candidate) {
                                    pc.addIceCandidate(new webrtc.RTCIceCandidate(data.sdp.candidate),handleIceAddSuccess,handleIceAddFailure);
                                }
                            } else
                            {
                                console.log('Candidate Adding to pending %s',data.sdp.candidate);
                                pendingCandidates.push(data);
                            }
                        }
                    });
        });


function handleIceAddFailure(error) {
    console.log("Failure adding an ice candiate",error);

}
function handleIceAddSuccess() {
    console.log("Success adding an ice candiate");
}

function writeVideo(blob){
    const buf5 = Buffer.from(blob);
    fs.appendFile('./video.webpm', buf5, function (err) {
        if (err) throw err;
        console.log('Saved!');
    });
}
