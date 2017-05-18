console.log("Init..");



var constraints = window.constraints = {
    audio: false,
    video: true
};

navigator.mediaDevices.getUserMedia(constraints).
    then(successCallback).catch(errorCallback);

function successCallback(stream) {
    var video = $('#srcVideo');
    var videoTracks = stream.getVideoTracks();
    console.log('Got stream with constraints:', constraints);
    console.log('Using video device: ' + videoTracks[0].label);
    video.srcObject = stream;
    wrtcConnections.getLocalPeer().addStream(stream);
}

function errorCallback(error) {
    console.log(error);
}



