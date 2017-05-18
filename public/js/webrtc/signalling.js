var bridge = "192.168.0.248:8043/"

var SignallingChannel = function(){

    var ws = new WebSocket("wss://" + bridge);
    ws.onopen = function(){
        console.log("Client WS connection open...");
    }

    ws.onmessage = function(event){
        console.log("Received Event",event)
            handleIncomingSignal(event);
    }

    return {
        send: function(json){
            if(this.isReady()) {
                console.log("Client Sending...", json);
                ws.send(json);
            }
        },
        isReady: function(){
            var ready =  WebSocket.OPEN == ws.readyState;
            if(!ready) {
                console.log("ws not ready");
            }
            return ready;
        }
    }
    function handleIncomingSignal(event){
        console.log("Client WS Received",event);
    }
}

signallingChannel = SignallingChannel();

