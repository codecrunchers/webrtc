var port = process.argv[2] || 8043;
var https = require('https');
var fs = require('fs');
var path = require('path');
var util = require('util');
var staticServer = require('node-static');

var AppServer = function(){

    server = null;

    return {
        init: (function() {
            console.log("HTTPS Startup...");
            var webroot = './public';
            var file = new(staticServer.Server)(webroot, {
                cache: 600,
                headers: { 'X-Powered-By': 'node-static' }
            });

            var options = {
                key: fs.readFileSync(path.join(__dirname, '../../','certs', 'server', 'privkey.pem'))
                    , cert: fs.readFileSync(path.join(__dirname, '../../','certs', 'server', 'fullchain.pem'))
            };

            function app(req, res) {
                file.serve(req, res, function(err, result) {
                    if (err) {
                        console.error('Error serving %s - %s', req.url, err.message);
                        if (err.status === 404 || err.status === 500) {
                            res.setHeader('Content-Type', 'text/plain');
                            file.serveFile(util.format('/%d.html', err.status), err.status, {}, req, res);
                        } else {
                            res.setHeader('Content-Type', 'text/plain');                        
                            res.writeHead(err.status, err.headers);
                            res.end();
                        }
                    } else {
                        console.log('%s - %s', req.url, res.message);
                    }
                });
            }

            server = https.createServer(options, app).listen(port, function () {
                port = server.address().port;
                console.log('Listening on port ' + port);
                console.log('Listening on https://' + server.address().address + ':' + port);
                console.log('Listening on https://localhost.codecrunchers.com:' + port);
            });

        })(),
        getServer: function(){
            return server;
        }
    }
}
appServer = AppServer();
exports.appServer = appServer;
