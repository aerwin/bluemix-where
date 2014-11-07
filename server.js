/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var express = require('express');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');

// Router module will handle our REST API
var router = require('./router');

// Bring in the module providing the wrapper for cf env
var cfenv = require('./cfenv-wrapper');

// Initialize the cfenv wrapper
var appEnv = cfenv.getAppEnv();

//Configure Express
var app = express();
app.use(bodyParser.json()); // needed to parse application/json //AWE TODO
app.use(express.static(__dirname + '/public'));
app.use(favicon(__dirname + '/public/images/bluemixGlobeColor32.png')); //AWE TODO

// Register our router
app.use('/api', router);

//start the server on the given port
var server = app.listen(appEnv.port, function() {
    console.log('Server started on %d', server.address().port);
});
