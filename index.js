#!/usr/bin/env node
'use strict';
console.log('Init..');
var appServer = require('./server/server').appServer;
var wss  = require("./server/websockets").wss
