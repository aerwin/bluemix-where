/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var express = require('express');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');

// Router module will handle our REST API
var router = require('./lib/router');

// Bring in the module providing the wrapper for cf env
var cfenv = require('./lib/cfenv-wrapper');

// Initialize the cfenv wrapper
var appEnv = cfenv.getAppEnv();

//Configure Express
var app = express();
app.use(bodyParser.json()); // needed to parse application/json
app.use(express.static(__dirname + '/public'));
app.use(favicon(__dirname + '/public/images/bluemixGlobeColor32.png'));

// Register our router
app.use('/api', router);

// Add a basic error handler
app.use(function(err, req, res, next) {
	console.error('ERROR: ' + JSON.stringify(err));
	res.status(500);
	res.send({message: err.message});
});

//start the server on the given port
var server = app.listen(appEnv.port, function() {
    console.log('Server started on %d', server.address().port);
});
