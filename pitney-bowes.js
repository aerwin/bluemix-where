/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var rest = require('restler');

var extend = require('node.extend');
var util = require('util');

// AWE TODO: Needed to fix UNABLE_TO_VERIFY_LEAF_SIGNATURE when using https/tls connection
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// AWE TODO: example of response with a failed PB call
/*
 { Output: 
 { Status: 'FAIL',
 StatusCode: 'Unable to Reverse Geocode',
 StatusDescription: 'Unable to Reverse Geocode' } }
 */

/**************************************************************
 *			Reverse Geocoding
 **************************************************************/
function getReverseGeocoding(credentials) {
	console.log('^^^^^^ credentials = ' + JSON.stringify(credentials)); //AWE TODO
	if (!credentials) {
		throw new TypeError('service credentials are required');
	}

	var url = credentials.url;
	var appId = credentials.appId;

	return {
		// Get addresses and chooses the first one
		getAddress: function(query, callback) {
			console.log('******** GET ADDRESS 1'); //AWE TODO
			this.getAddresses(query, function(err, result) {
				console.log('\t******** GET ADDRESS 2'); //AWE TODO
				if (!err) {
					// AWE TODO: $$$$$$$$$$$$$
					if (!result) {
						// AWE TODO: Had a random time or two where result was null... seems like
						// an error condition??
						console.error('NO result!!!!!!');
					}
					
					if (result && result.length > 0) {
						callback(null, result[0]);
					} else {
						// AWE TODO: need to test this case
						callback(null, {});
					}
				} else{
					callback(err, null);
				}
			});
		},
		
		getAddresses: function(query, callback) {
			// Build up the params required by Reverse Geocoding API
			var options = {
				query: {
					appId: appId,
					latitude: query.latitude,
					longitude: query.longitude,
					searchDistance: query.searchDistance || 1000 //AWE TODO: ??
				}
			};

			// AWE TODO: Why does this call seem so slow??
			// Make the call to the Reverse Geocoding API
			rest.get(url, options).on('complete', function(result) {
				console.log('PITNEY BOWES RESPONSE!!!!'); //AWE TODO
				if (result instanceof Error) {
					// AWE TODO: handle error
					console.error('Error:', result.message);
					callback(result, null);
				} else {
					// AWE TODO: $$$$$$$$$$$$$
					if (!result.Output) {
						// AWE TODO: feels like we have an error condition if result.Output is null, but
						// has happened a time or too
						/* Saw this again on 10-13
						 * 
						 * NO result.Output, result = {"httpCode":"500","httpMessage":"Internal Server Error","moreInformati
on":"Failed to establish a backside connection"}
						*
						 */
						console.error('NO result.Output, result = ' + JSON.stringify(result));
						callback(null, result);
					} else {
						var addresses = (result.Output && result.Output.Result) || [];
						callback(null, addresses);
					}
				}
			});
		}
	};
}

/**************************************************************
 *			Travel Boundary
 **************************************************************/
/*
 * AWE TODO: another example error
 
 NO result.Output, result = {"httpCode
":"500","httpMessage":"Internal Server Error","moreInformation":"Failed to estab
lish a backside connection"}

 */

/* AWE TODO
 {
    "type": "Feature",
    "properties": {"party": "Democrat"},
    "geometry": {
        "type": "Polygon",
        "coordinates": [[
            [-109.05, 41.00],
            [-102.06, 40.99],
            [-102.03, 36.99],
            [-109.04, 36.99],
            [-109.05, 41.00]
        ]]
    }
 */
function _transformToGeoJSON(boundaryJSON, query) {
	//Output.IsoPolygonResponse.Polygon.Exterior.LineString.Pos

	util.format('%s:%s', 'foo'); // 'foo:%s'
	
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
	
	if (boundaryJSON && boundaryJSON.Output) {
		// AWE TODO: should probably do more guarding here
		var output = boundaryJSON.Output;
		
		/* AWE TODO: deal with countries not available, like China
		 * Status: "FAIL"
StatusCode: "Country not available"
StatusDescription: "Country not available"
		 */
		
		// AWE TODO
		// AWE TODO: don't like array in polygon
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

//TODO
function getTravelBoundary(credentials) {
	console.log('^^^^^^ credentials = ' + JSON.stringify(credentials)); //AWE TODO
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
			
			//AWE TODO cost=10&units=Miles&majorRoads=Y&returnHoles=Y&returnIslands=Y&simplificationFactor=0.75
			var defaults = {
				// AWE TODO: think about the defaults
				cost: 5,
				units: 'Minutes',
				majorRoads: true,
				returnHoles: true,
				returnIslands: false,
				simplificationFactor: 0.75
			};
			var query = extend(defaults, options, {appId: appId});
	
			var restOptions = {
				query: query
			};
	
			// AWE TODO: Why does this call seem so slow??
			// Make the call to the Reverse Geocoding API
			console.log('^^^^^^^^^^^^ travelBoundaryURL = ' + url + ', travelBoundaryAppId = ' + appId); //AWE TODO
			rest.get(url, restOptions).on('complete', function(result) {
				console.log('PITNEY BOWES RESPONSE travelBoundary!!!!'); //AWE TODO
				if (result instanceof Error) {
					// AWE TODO: handle error
					console.error('Error:', result.message);
					callback(result, {});
				} else {
					// AWE TODO: $$$$$$$$$$$$$
					if (!result.Output) {
						// AWE TODO: feels like we have an error condition if result.Output is null, but
						// has happened a time or too
						console.error('NO result.Output, result = ' + JSON.stringify(result));
					}
	
					//var addresses = (result.Output && result.Output.Result) || [];
					// AWE TOOD: Want to convert this to GeoJSON
					var geoJSON = _transformToGeoJSON(result, query);
					callback(null, geoJSON);
				}
			});
		}
	};
}

/**************************************************************
 *			Validate Address
 **************************************************************/
//TODO
function getValidateAddress(credentials) {
	return null;
}

/**************************************************************
 *			Geocoding
 **************************************************************/
// TODO
function getGeocoding(credentials) {
	return null;
}

/**************************************************************
 *			Export Functions
 **************************************************************/
module.exports.getReverseGeocoding = getReverseGeocoding;
module.exports.getTravelBoundary = getTravelBoundary;
module.exports.getGeocoding = getGeocoding;
module.exports.getValidateAddress = getValidateAddress; //AWE TODO