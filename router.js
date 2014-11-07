var express = require('express');

var locations = require('./locations');
var pitneyBowes = require('./pitney-bowes');

var cfenv = require('./cfenv-wrapper');

// Initialize the cfenv wrapper
var appEnv = cfenv.getAppEnv();

// Initialize Pitney Bowes services
var reverseGeocoding = pitneyBowes.getReverseGeocoding(appEnv.getServiceCreds('ReverseGeocoding'));
var travelBoundary = pitneyBowes.getTravelBoundary(appEnv.getServiceCreds('TravelBoundary'));

// Initialize the location manager
var locationManager = locations.getLocationManager(appEnv.getServiceCreds('CloudantNoSQLDB'));

//AWE TODO: This is kind of planning ahead
var USER_ID_ANONYMOUS = 'USER_ID_ANONYMOUS';

var LOCATIONS_LIMIT = 25;
var GROUP_LEVEL_LIMIT = 3;

// AWE TODO: Debate GET vs. POST
function postLocation(req, res, next) {
	// AWE TODO: should process other arguments?
	console.log('POST LOCATION!!!'); //AWE TODO
	
	/*//AWE TODO
	if (!req.query.hasOwnProperty('latitude') || !req.query.hasOwnProperty('longitude')) {
		// AWE TODO
		res.statusCode = 400;
		return res.json({
			message: 'GET request must contain both latitude and longitude in query parameters.'
		});
	}

	var query = {
		latitude: req.query.latitude,
		longitude: req.query.longitude
		// AWE TODO: deal with search distance
	};
	*/
	
	// AWE TODO: should process other arguments?
	console.log('POST LOCATION 2!!!'); //AWE TODO
	
	if (!req.body.hasOwnProperty('latitude') || !req.body.hasOwnProperty('longitude')) {
		// AWE TODO
		res.statusCode = 400;
		return res.json({
			message: 'POST body must contain both latitude and longitude.'
		});
	}

	// AWE TODO: should process other arguments?
	console.log('POST LOCATION 3!!!'); //AWE TODO
	
	var query = {
		latitude: req.body.latitude,
		longitude: req.body.longitude,
		searchDistance: req.body.searchDistance,
		
		deviceId: req.body.deviceId
	};
	
	// AWE TODO: should process other arguments?
	console.log('ABOUT TO GET ADDRESS!!! '); //AWE TODO
	reverseGeocoding.getAddress(query, function(addressErr, addressResult) {
		console.log('ADDRESS: ' + JSON.stringify(addressResult)); //AWE TODO
		if (!addressErr) {
			// Successfully got the address, so now let's create the
			// location document in the DB
			var newLocationInfo = {
				userId: USER_ID_ANONYMOUS,
				time: new Date(),
				latitude: query.latitude,
				longitude: query.longitude,
				altitude: req.body.altitude,
				accuracy: req.body.accuracy,
				altitudeAccuracy: req.body.altitudeAccuracy,
				heading: req.body.heading,
				speed: req.body.speed,
				
				deviceId: query.deviceId,
				address: addressResult,
				ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
				user_agent: req.headers['user-agent']
			};
			
			locationManager.insertLocation(newLocationInfo, function(locationErr, locationResult) {
				console.log('^^^^^ INSERT LOCATION HANDLER!!!' + JSON.stringify(locationResult)); //AWE TODO
				if (!locationErr) {
					// Send response
					res.json(locationResult);
				} else {
					// Error storing address... pass the error along //AWE TODO: is this right thing
					next(locationErr);
				}
			});
		} else {
			// Error getting address... pass the error along //AWE TODO: is this right thing
			next(addressErr);
		}
	});
}

function getLocation(req, res, next) {
	console.log('************ req.params = ' + JSON.stringify(req.params));
	if (!req.params.hasOwnProperty('locationId')) {
		res.statusCode = 400;
		return res.json({
			message: 'GET request must contain locationId in url.'
		});
	}

	var query = {
		locationId: req.params.locationId
	};
	// AWE TODO: should process other arguments?
	console.log('ABOUT TO GET LOCATION!!!'); //AWE TODO
	locationManager.getLocation(query, function(err, result) {
		if (!err) {
			res.json(result);
		} else {
			// Error getting address... pass the error along //AWE TODO: is this right thing
			next(err);
		}
	});
}

function getLocations(req, res, next) {
	// Make sure limit (if specified) is a number and in range
	var limit;
	console.log('%%%%%%%%%%%%%%%%% limit = ' + req.query.limit);
	if (req.query.limit) {
		limit = Number(req.query.limit);
		console.log('%%%%%%%%%%%%%%%%% limit = ' + limit, ', typeof limit === "number" is ' + (typeof limit === 'number'));
		if (typeof limit === 'number' && !isNaN(limit)) {
			if (limit <= 0 || limit > LOCATIONS_LIMIT) {
				res.statusCode = 400;
				return res.json({
					message: 'GET error: "limit" must be greater than 0 or less or equal than ' + LOCATIONS_LIMIT + '.'
				});
			}
		} else {
			res.statusCode = 400;
			return res.json({
				message: 'GET error: "limit" must be a number value; limit = ' + req.query.limit
			});
		}
	}
	
	// Get the locations
	var query = {
		userId: USER_ID_ANONYMOUS,
		deviceId: req.query.deviceId,
		limit: limit || LOCATIONS_LIMIT
	};
	// AWE TODO: should process other arguments?
	console.log('ABOUT TO GET LOCATIONS!!! ' + JSON.stringify(query)); //AWE TODO
	locationManager.getLocations(query, function(err, result) {
		// AWE TODO
		if (!err) {
			var docs = result.docs;
			console.log('router.getLocations -- Found %d documents matching selector', docs.length); //AWE TODO

			res.json(docs);
		} else {
			// Error getting address... pass the error along //AWE TODO: is this right thing
			console.log('\t!!!!! ERROR getting locations ' + JSON.stringify(err)); //AWE TODO
			next(err);
		}
	});
}

function getSummary(req, res, next) {
	// Make sure groupLevel (if specified) is a number and in range
	var groupLevel;
	console.log('%%%%%%%%%%%%%%%%% groupLevel = ' + req.query.groupLevel); //AWE TODO
	if (req.query.groupLevel) {
		groupLevel = Number(req.query.groupLevel);
		console.log('%%%%%%%%%%%%%%%%% groupLevel = ' + groupLevel, ', typeof groupLevel === "number" is ' + (typeof groupLevel === 'number'));
		if (typeof groupLevel === 'number' && !isNaN(groupLevel)) {
			if (groupLevel < 0 || groupLevel > GROUP_LEVEL_LIMIT) {
				res.statusCode = 400;
				return res.json({
					message: 'GET error: "groupLevel" must be greater than or equal to 0 or less or equal than ' + GROUP_LEVEL_LIMIT + '.'
				});
			}
		} else {
			res.statusCode = 400;
			return res.json({
				message: 'GET error: "groupLevel" must be a number value; groupLevel = ' + req.query.groupLevel
			});
		}
	}
	
	// Get the summary
	var query = {
		groupLevel: groupLevel || GROUP_LEVEL_LIMIT
	};
	console.log('ABOUT TO GET SUMMARY!!! ' + JSON.stringify(query)); //AWE TODO
	locationManager.getSummary(query, function(err, result) {
		// AWE TODO
		if (!err) {
			console.log('SUMMARY!!!', JSON.stringify(result)); //AWE TODO
			res.json(result);
		} else {
			// Error getting address... pass the error along //AWE TODO: is this right thing
			console.log('\t!!!!! ERROR getting locations ' + JSON.stringify(err)); //AWE TODO
			next(err);
		}
	});
}

function getBoundary(req, res, next) {
	if (!req.params.hasOwnProperty('locationId')) {
		// AWE TODO
		res.statusCode = 400;
		return res.json({
			message: 'GET request must contain locationId in the URL.'
		});
	}

	var locationParams = {
		locationId: req.params.locationId
	};
	locationManager.getLocation(locationParams, function(err, result) {
		if (!err) {
			var query = {
				latitude: result.latitude,
				longitude: result.longitude,
				cost: req.query.cost,
				units: req.query.units
			};
			// AWE TODO: should process other arguments?
			console.log('ABOUT TO GET BOUNDARY!!!'); //AWE TODO
			travelBoundary.getBoundary(query, function(boundErr, boundResult) {
				if (!boundErr) {
					res.json(boundResult);
				} else {
					// Error getting boundary, so pass error along
					next(boundErr);
				}
			});
		} else {
			// Error getting location, so pass error along
			next(err);
		}
	});
}

// Export the router setup
module.exports = (function() {
	var router = express.Router();

	//AWE TODO: think about API... should it be GET /check-ins/boundary or GET /check-ins/:id/boundary
	router.post('/locations', postLocation);
	router.get('/locations/summary', getSummary);
	router.get('/locations/:locationId/boundary', getBoundary); //AWE TODO: Make this take a locationId
	router.get('/locations/:locationId', getLocation);
	router.get('/locations', getLocations);

    return router;
})();
