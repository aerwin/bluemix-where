var express = require('express');

var locations = require('./locations');
var pitneyBowes = require('./pitney-bowes');

var cfenv = require('./cfenv-wrapper');

// Initialize the cfenv wrapper
var appEnv = cfenv.getAppEnv();

// Initialize Reverse Geocoding -- By default use PitneyBowes. But, for fun, 
// showing one way modularization can allow us to swap in a different provider 
// for a given function. In this case, we don't care about the internals of the 
// module servicing reverse geocoding requests as long as it provides the 
// specified public interface.
var reverseGeocodingProvider = appEnv.getEnvVar('REVERSE_GEOCODING_PROVIDER');
console.log('Requested reverse geocoding provider = %s', reverseGeocodingProvider);
var reverseGeocoding;
if (!reverseGeocodingProvider || reverseGeocodingProvider === 'PitneyBowes') {
	reverseGeocoding = pitneyBowes.getReverseGeocoding(appEnv.getServiceCreds('ReverseGeocoding'));
} else if (reverseGeocodingProvider === 'Google') {
	var googleGeocoding = require('./google-geocoding');
	reverseGeocoding = googleGeocoding.getReverseGeocoding(appEnv.getServiceCreds('GoogleGeocoding'));
} else {
	console.error('Requested reverseGeocodingProvider %s is not available.', reverseGeocodingProvider);
}

// Initialize Travel Boundary
var travelBoundary = pitneyBowes.getTravelBoundary(appEnv.getServiceCreds('TravelBoundary'));

// Initialize the location manager
var locationsManagerOptions = {
	dbName: appEnv.getEnvVar('WHERE_DB_NAME'),
	credentials: appEnv.getServiceCreds('CloudantNoSQLDB')
};
var locationManager = locations.getLocationManager(locationsManagerOptions);
locationManager.initialize();

// Constant for a user id to sort of plan ahead to 
// adding authentication in the future.
var USER_ID_ANONYMOUS = 'USER_ID_ANONYMOUS';

// Constants for placing limits on some of the queries we'll support
var LOCATIONS_LIMIT = 50;
var GROUP_LEVEL_LIMIT_SUMMARY = 3;
var GROUP_LEVEL_LIMIT_SUMMARY_BY_TIME = 6;
var GROUP_LEVEL_DEFAULT_SUMMARY_BY_TIME = 3;
var GROUP_LEVEL_LIMIT_SUMMARY_BY_DEVICE = 2;
var GROUP_LEVEL_DEFAULT_SUMMARY_BY_DEVICE = GROUP_LEVEL_LIMIT_SUMMARY_BY_DEVICE;

// Utility function to validate numeric URL params
function validateNumericParam(paramName, valueStr, min, max) {
	if (valueStr) {
		var valueNum = Number(valueStr);
		if (typeof valueNum === 'number' && !isNaN(valueNum)) {
			if (valueNum < min || valueNum > max) {
				return  'GET error: "' + paramName + '" must be greater than or equal to ' + min +
						' or less or equal than ' + max + '.';
			}
		} else {
			return 'GET error: "' + paramName + '" must be a number value; value = ' + valueStr;
		}
		return valueNum;
	} else {
		return null;
	}
}

function postLocation(req, res, next) {
	// Make sure we have at least latitude and longitude in the payload
	if (!req.body.hasOwnProperty('latitude') || !req.body.hasOwnProperty('longitude')) {
		res.statusCode = 400;
		return res.json({
			message: 'POST body must contain both latitude and longitude.'
		});
	}

	var query = {
		latitude: req.body.latitude,
		longitude: req.body.longitude,
		searchDistance: req.body.searchDistance,
		
		deviceId: req.body.deviceId
	};
	
	// Retrieve the address from Reverse Geocoding service
	console.log('postLocation: Retrieving address from Reverse Geocoding for %d %d...', query.latitude, query.longitude);
	reverseGeocoding.getAddress(query, function(addressErr, addressResult) {
		if (!addressErr) {
			// Successfully got the address, so now let's create the
			// location document in the DB
			console.log('postLocation: SUCCESS getting address.');
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
			
			console.log('postLocation: Adding address to database.');
			locationManager.insertLocation(newLocationInfo, function(locationErr, locationResult) {
				if (!locationErr) {
					// Send response back to client
					console.log('postLocation: SUCCESS adding address to database.');
					res.json(locationResult);
				} else {
					// Error storing address, so pass the error along
					console.log('postLocation: FAILED adding address to database.');
					next(locationErr);
				}
			});
		} else {
			// Error getting address, so pass the error along
			console.log('postLocation: FAILED getting address from Reverse Geocoding.');
			next(addressErr);
		}
	});
}

function getLocation(req, res, next) {
	if (!req.params.hasOwnProperty('locationId')) {
		res.statusCode = 400;
		return res.json({
			message: 'GET request must contain locationId in url.'
		});
	}

	var query = {
		locationId: req.params.locationId
	};
	console.log('getLocation: Retrieve location from DB = %s', query.locationId);
	locationManager.getLocation(query, function(err, result) {
		if (!err) {
			// Successfully got the location from the DB
			console.log('getLocation: SUCCESS retrieving location from DB');
			res.json(result);
		} else {
			// Error getting location, so pass the error along
			console.log('getLocation: FAILED retrieving location from DB');
			next(err);
		}
	});
}

function getLocations(req, res, next) {
	// Make sure limit (if specified) is a number and in range
	var limit = validateNumericParam('limit', req.query.limit, 0, LOCATIONS_LIMIT);
	if (typeof limit === 'string') {
		// Error validating number, so respond with error message
		res.statusCode = 400;
		return res.json({
			message: limit
		});
	}
	
	// Get the locations
	var query = {
		userId: USER_ID_ANONYMOUS,
		deviceId: req.query.deviceId,
		limit: limit || LOCATIONS_LIMIT
	};
	console.log('getLocations: RETRIEVING list of locations...');
	locationManager.getLocations(query, function(err, result) {
		if (!err) {
			// Successfully found matching documents
			var docs = result.docs;
			console.log('getLocations: SUCCESS retrieving docs -- Found %d documents matching selector', docs.length);
			res.json(docs);
		} else {
			// Error getting locations, so pass the error along
			console.log('getLocations: FAILED retrieving list of locations.');
			next(err);
		}
	});
}

function getSummary(req, res, next) {
	// Make sure groupLevel (if specified) is a number and in range
	var groupLevel = validateNumericParam('groupLevel', req.query.groupLevel, 0, GROUP_LEVEL_LIMIT_SUMMARY);
	if (typeof groupLevel === 'string') {
		// Error validating number, so respond with error message
		res.statusCode = 400;
		return res.json({
			message: groupLevel
		});
	}
	
	// Get the summary
	console.log('getSummary: Retrieving summary...');
	var query = {
		groupLevel: groupLevel || GROUP_LEVEL_LIMIT_SUMMARY
	};
	locationManager.getSummary(query, function(err, result) {
		if (!err) {
			console.log('getSummary: SUCCESS retrieving summary.');
			res.json(result);
		} else {
			// Error getting summary, so pass the error along
			console.log('getSummary: FAILED retrieving summary.');
			next(err);
		}
	});
}

function getSummaryByTime(req, res, next) {
	// Make sure groupLevel (if specified) is a number and in range
	var groupLevel = validateNumericParam('groupLevel', req.query.groupLevel, 0, GROUP_LEVEL_LIMIT_SUMMARY_BY_TIME);
	if (typeof groupLevel === 'string') {
		// Error validating number, so respond with error message
		res.statusCode = 400;
		return res.json({
			message: groupLevel
		});
	}
	
	// Get the summary
	console.log('getSummaryByTime: Retrieving summary...');
	var query = {
		groupLevel: groupLevel || GROUP_LEVEL_DEFAULT_SUMMARY_BY_TIME
	};
	locationManager.getSummaryByTime(query, function(err, result) {
		if (!err) {
			console.log('getSummaryByTime: SUCCESS retrieving summary.');
			res.json(result);
		} else {
			// Error getting summary, so pass the error along
			console.log('getSummaryByTime: FAILED retrieving summary.');
			next(err);
		}
	});
}

function getSummaryByDevice(req, res, next) {
	// Make sure groupLevel (if specified) is a number and in range
	var groupLevel = validateNumericParam('groupLevel', req.query.groupLevel, 0, GROUP_LEVEL_LIMIT_SUMMARY_BY_DEVICE);
	if (typeof groupLevel === 'string') {
		// Error validating number, so respond with error message
		res.statusCode = 400;
		return res.json({
			message: groupLevel
		});
	}
	
	// Get the summary
	console.log('getSummaryByDevice: Retrieving summary...');
	var query = {
		groupLevel: groupLevel || GROUP_LEVEL_DEFAULT_SUMMARY_BY_DEVICE
	};
	locationManager.getSummaryByDevice(query, function(err, result) {
		if (!err) {
			console.log('getSummaryByDevice: SUCCESS retrieving summary.');
			res.json(result);
		} else {
			// Error getting summary, so pass the error along
			console.log('getSummaryByDevice: FAILED retrieving summary.');
			next(err);
		}
	});
}

function getBoundary(req, res, next) {
	// Make sure calling has included a location ID
	if (!req.params.hasOwnProperty('locationId')) {
		res.statusCode = 400;
		return res.json({
			message: 'GET request must contain locationId in the URL.'
		});
	}

	// First look up the location entry
	var locationParams = {
		locationId: req.params.locationId
	};
	console.log('getBoundary: RETRIEVING location %s', locationParams.locationId);
	locationManager.getLocation(locationParams, function(err, result) {
		if (!err) {
			console.log('getBoundary: SUCCESS getting location. Retrieving boundary...');
			var query = {
				latitude: result.latitude,
				longitude: result.longitude,
				cost: req.query.cost,
				units: req.query.units
			};
			travelBoundary.getBoundary(query, function(boundaryErr, boundaryResult) {
				if (!boundaryErr) {
					console.log('getBoundary: SUCCESS getting boundary.');
					res.json(boundaryResult);
				} else {
					// Error getting boundary, so pass error along
					console.log('getBoundary: FAILED getting boundary.');
					next(boundaryErr);
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

	// Define the routes for our API
	router.post('/locations', postLocation);
	router.get('/locations/summary', getSummary);
	router.get('/locations/summary/time', getSummaryByTime);
	router.get('/locations/summary/device', getSummaryByDevice);
	router.get('/locations/:locationId/boundary', getBoundary);
	router.get('/locations/:locationId', getLocation);
	router.get('/locations', getLocations);

    return router;
})();
