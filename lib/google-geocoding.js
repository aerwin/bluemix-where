/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var rest = require('restler');

var extend = require('node.extend');
var util = require('util');
var countries  = require('country-data').countries;
var lookup = require('country-data').lookup;
var geolib = require('geolib');

// NOTE: Needed to fix UNABLE_TO_VERIFY_LEAF_SIGNATURE when using https/tls connection
//AWE TODO process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Default number of feet to use when querying for address based
// on latitude/longitude
var SEARCH_DISTANCE_DEFAULT = 1000; //AWE TODO

// Default timeout for address request
var TIMEOUT = 30 * 1000; //60 seconds //AWE TODO

var FEET_PER_METER = 3.28084;

/**************************************************************
 *			Reverse Geocoding
 **************************************************************/

// Utility function to help find certain pieces
// of data (e.g., city, country, etc.) within the Google
// JSON response
function getComponentType(result, type) {
	var foundComponent;
	
	var addressComponents = result.address_components;
	addressComponents.some(function(component) {
		if (component.types.indexOf(type) >= 0) {
			foundComponent = component;
			
			// break loop
			return true;
		}
	});
	
	return foundComponent;
}

// Utility function to transform a Google response into
// something a bit more like the Pitney Bowes response. We're
// doing this because a enhanced Pitney Bowes schema became our
// de facto public interface for addresses.
function transformResponse(query, retrievalTime, result) {
	var address;
	if (result.status === 'OK') {
		var mainResult = result.results[0];

		// Figure out first line of the address
		var formattedAddress = mainResult.formatted_address;
		var line1;
		if (formattedAddress) {
			var addrSplit = formattedAddress.split(',');
			line1 = addrSplit[0];
		}
		
		// Figure out city
		var cityComponent = getComponentType(mainResult, 'locality');
		if (!cityComponent) {
			cityComponent = getComponentType(mainResult, 'sublocality_level_1');
		}
		var city = cityComponent && cityComponent.long_name;
			
		// Figure out state/province
		var stateProvinceComponent = getComponentType(mainResult, 'administrative_area_level_1');
		var stateProvince = stateProvinceComponent && stateProvinceComponent.short_name;
		
		// Figure out postal code
		var postalCodeComponent = getComponentType(mainResult, 'postal_code');
		var postalCode = postalCodeComponent && postalCodeComponent.long_name;
		
		// Pull out country info
		var countryComponent = getComponentType(mainResult, 'country');
		var countryName = countryComponent && countryComponent.long_name;
		var countryShortName = countryComponent && countryComponent.short_name;
		var countryResults = lookup.countries({alpha2: countryShortName});
		var countryCode = countryResults && countryResults.length && countryResults[0].alpha3;

		// Determine last line for US addresses
		var lastLine;
		if (countryCode === 'USA') {
			lastLine = city + ', ' + stateProvince + ' ' + postalCode;
		}
		
		// Determine lat/lon of Google result
		var resultLatitude = mainResult.geometry.location.lat;
		var resultLongitude = mainResult.geometry.location.lng;
		
		// Calculate distance between requested lat/lon and
		// the result given by Google
		var distance = geolib.getDistance(
			{latitude: query.latitude, longitude: query.longitude},
			{latitude: resultLatitude, longitude: resultLongitude}
		);
		var distanceFt = Math.round(distance * FEET_PER_METER * 100) / 100;
		
		// Fill in the address data
		address = {
			AddressLine1: line1, //'4198 S TEMESCAL ST',
			AddressLine2: '',
			City: city,
			Country: countryCode,
			CountryName: countryName,
			PostalCode: postalCode,
			StateProvince: stateProvince,
			Latitude: resultLatitude,
			Longitude: resultLongitude,
			FirmName: '',
			LastLine: lastLine,
			LocationCode: '',
			MatchCode: '',
			'PostalCode.AddOn': '',
			'PostalCode.Base': postalCode,
			StreetDataType: '',
			Distance: distanceFt,
			Confidence: '',
			ProcessedBy: '',
			AdditionalInputData: '',
			USUrbanName: '',
			StreetSide: '',
			PercentGeocode: '',
			Ranges: [''],
			
			retrievalTime: retrievalTime,
			source: 'Google'
		};
	} else if (result.status === 'ZERO_RESULTS') {
		address = {};
	}
	return address;
}

function getReverseGeocoding(credentials) {
	if (!credentials) {
		throw new TypeError('service credentials are required');
	}

	var url = credentials.url;
	var appId = credentials.appId;

	return {
		// Get address nearest to latitude and longitude.
		getAddress: function(query, callback) {
			// Build up the params required by Reverse Geocoding API
			var options = {
				query: {
					key: appId,
					latlng: query.latitude + ',' + query.longitude
				},
				timeout: TIMEOUT
			};

			// Make the call to the Reverse Geocoding API
			console.log('google-geocoding.getAddresses: Retrieving addresses for ' + query.latitude + ', ' + query.longitude);
			var startDate = new Date();
			var restRequest = rest.get(url, options);
			restRequest.on('complete', function(result) {
				var timeDiff = ((new Date()).getTime() - startDate.getTime())/1000;
				console.log('google-geocoding.getAddresses: Received Pitney Bowes response. Time = %d s', timeDiff);
				if (result instanceof Error) {
					// We have an error...
					console.error('google-geocoding.getAddresses: Error:', result.message);
					callback(result, null);
				} else {
					// Transform the Google response to match
					// out public interface
					var address = transformResponse(query, timeDiff, result);
					console.log('google-geocoding.getAddress: SUCCESS finding address. ' + JSON.stringify(address));
					
					// Let keep record of the raw data as well
					address.source_raw = result;
					
					// We're done, let's do callback
					callback(null, address);
				}
			});
			
			// Handle a timeout
			restRequest.on('timeout', function(ms) {
				console.error('google-geocoding.getAddress: TIMEOUT!!!!!!!! did not return within %d ms', ms);
				restRequest.abort({message: 'Timeout connecting to Pitney Bowes. Please try again.'});
			});
		}
	};
}

/******************************************
 *	Export Public Functions
 ******************************************/
module.exports.getReverseGeocoding = getReverseGeocoding;