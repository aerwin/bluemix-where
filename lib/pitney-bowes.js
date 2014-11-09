/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var rest = require('restler');

var extend = require('node.extend');
var util = require('util');

// NOTE: Needed to fix UNABLE_TO_VERIFY_LEAF_SIGNATURE when using https/tls connection
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Default number of feet to use when querying for address based
// on latitude/longitude
var SEARCH_DISTANCE_DEFAULT = 1000;

/**************************************************************
 *			Reverse Geocoding
 **************************************************************/
function getReverseGeocoding(credentials) {
	if (!credentials) {
		throw new TypeError('service credentials are required');
	}

	var url = credentials.url;
	var appId = credentials.appId;

	return {
		// Get addresses near to latitude and longitude. Then, choose the first one.
		getAddress: function(query, callback) {
			console.log('pitney-bowes.getAddress: START... retrieving address...');
			this.getAddresses(query, function(err, result) {
				if (!err) {
					if (result && result.length > 0) {
						console.log('pitney-bowes.getAddress: SUCCESS finding address');
						callback(null, result[0]);
					} else {
						// No error returned, but no addresses either
						console.log('pitney-bowes.getAddress: SUCCESS, but NO address');
						callback(null, {});
					}
				} else{
					console.log('pitney-bowes.getAddress: FAILED to get address');
					callback(err, null);
				}
			});
		},
		
		getAddresses: function(query, callback) {
			// Build up the params required by Reverse Geocoding API
			console.log('pitney-bowes.getAddresses: START');
			var options = {
				query: {
					appId: appId,
					latitude: query.latitude,
					longitude: query.longitude,
					searchDistance: query.searchDistance || SEARCH_DISTANCE_DEFAULT
				}
			};

			// Make the call to the Reverse Geocoding API
			console.log('pitney-bowes.getAddresses: Retrieving addresses...');
			rest.get(url, options).on('complete', function(result) {
				console.log('pitney-bowes.getAddresses: Received Pitney Bowes response.');
				if (result instanceof Error) {
					// We have an error...
					console.error('pitney-bowes.getAddresses: Error:', result.message);
					callback(result, null);
				} else {
					if (!result.Output) {
						// Occasionally see cases where there is an error embedded in the response, so
						// gracefully handle:
						//	
						//		{"httpCode":"500","httpMessage":"Internal Server Error","moreInformation":"Failed to establish a backside connection"}

						console.error('pitney-bowes.getAddresses: NO result.Output, result = ' + JSON.stringify(result));
						callback(null, result);
					} else {
						console.log('pitney-bowes.getAddresses: SUCCESS getting addresses.');
						var addresses = (result.Output && result.Output.Result) || [];
						callback(null, addresses);
					}
				}
			});
			console.log('pitney-bowes.getAddresses: END');
		}
	};
}

/**************************************************************
 *			Travel Boundary
 **************************************************************/
function _transformToGeoJSON(boundaryJSON, query) {
	// Create the basic structure for the geojson
	var points = [];
	var name = 'Travel Boundary';
	var description = util.format('%s: %d %s from %s, %s',
			name, query.cost, query.units, Number(query.latitude).toPrecision(6), Number(query.longitude).toPrecision(6));
	var geoJSON = {
		type: 'FeatureCollection',
		features: [{
			type: 'Feature',
			properties: {
				name: name,
				description: description
			},
			geometry: {
				type: 'Polygon',
				coordinates: [points]
			}
		}]
	};
	
	// Make sure we have good boundary JSON. Below is an example of output 
	// for unsupported countries (like China)
	//
	//	Status: "FAIL", StatusCode: "Country not available", StatusDescription: "Country not available"
	//
	if (boundaryJSON && boundaryJSON.Output) {
		// There seems to be good boundary output, so let's transform it. Probably 
		// not the most elegant conversion routine, but works for a demo. :)
		var output = boundaryJSON.Output;
		if (output.IsoPolygonResponse) {
			if (output.IsoPolygonResponse.Polygon) {
				if (output.IsoPolygonResponse.Polygon[0].Exterior) {
					if (output.IsoPolygonResponse.Polygon[0].Exterior.LineString) {
						if (output.IsoPolygonResponse.Polygon[0].Exterior.LineString[0].Pos) {
							var polygonPoints = output.IsoPolygonResponse.Polygon[0].Exterior.LineString[0].Pos;
							for (var i = 0; i < polygonPoints.length; i++) {
								var polygonPoint = polygonPoints[i];
								points.push([polygonPoint.X, polygonPoint.Y]);
							}
						}
					}
				}
			}
		}
	}
	
	return geoJSON;
}

function getTravelBoundary(credentials) {
	if (!credentials) {
		throw new TypeError('service credentials are required');
	}

	var url = credentials.url;
	var appId = credentials.appId;
	
	return {
		/*
		 * options can include:
		 * 
		 *	- latitude (required)
		 *	- longitude (required)
		 *	- cost (optional, but required by Pitney Bowes)
		 *	- units (optional, but required by Pitney Bowes)
		 *	- majorRoads (optional, but required by Pitney Bowes)
		 *	- returnHoles (optional, but required by Pitney Bowes)
		 *	- returnIslands (optional, but required by Pitney Bowes)
		 *	- simplificationFactor (optional, but required by Pitney Bowes)
		 *
		 */
		getBoundary: function(options, callback) {
			// Build up the params required by Reverse Geocoding API
			console.log('pitney-bowes.getBoundary: START');
			
			// Build up the params required by Reverse Geocoding API. The format of the URL is 
			// of the form:
			//
			//		cost=10&units=Miles&majorRoads=Y&returnHoles=Y&returnIslands=Y&simplificationFactor=0.75
			//
			var defaults = {
				cost: 5,
				units: 'Minutes',
				majorRoads: true,
				returnHoles: true,
				returnIslands: true,
				simplificationFactor: 0.75
			};
			
			// Do a 'mixin' of the passed in options and the defaults, so
			// that a caller doesn't have to specify everything
			var query = extend(defaults, options, {appId: appId});
			
			// Covert booleans to 'Y' and 'N'
			query.majorRoads = query.majorRoads ? 'Y' : 'N';
			query.returnHoles = query.returnHoles ? 'Y' : 'N';
			query.returnIslands = query.returnIslands ? 'Y' : 'N';
			
			var restOptions = {
				query: query
			};
	
			// Make the call to the Reverse Geocoding API
			console.log('pitney-bowes.getBoundary: Retrieving boundary...');
			rest.get(url, restOptions).on('complete', function(result) {
				if (result instanceof Error) {
					// Failure...
					console.error('pitney-bowes.getBoundary: Error:', result.message);
					callback(result, {});
				} else {
					if (!result.Output) {
						// Seems like we have an error condition if result.Output is null, but
						// has happened a time or two
						console.error('pitney-bowes.getBoundary: NO result.Output, result = ' + JSON.stringify(result));
					}
	
					// Convert the result to GeoJSON
					var geoJSON = _transformToGeoJSON(result, query);
					
					// Make the callback
					callback(null, geoJSON);
				}
			});
		}
	};
}

/******************************************
 *	Export Public Functions
 ******************************************/
module.exports.getReverseGeocoding = getReverseGeocoding;
module.exports.getTravelBoundary = getTravelBoundary;