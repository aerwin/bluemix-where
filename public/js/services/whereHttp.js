/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var myModule = angular.module('whereHttp', []);

var TIMEOUT = 60 * 1000; // 60 seconds

myModule.factory('whereHttpService', function($q, $http, $log) {
	return {
		postGeolocation: function(options) {
			// Prepare the payload
			var coordinates = options.coordinates;
			var payload = {
				latitude: coordinates.latitude,
				longitude: coordinates.longitude,
				altitude: coordinates.altitude,
				accuracy: coordinates.accuracy,
				altitudeAccuracy: coordinates.altitudeAccuracy,
				heading: coordinates.heading,
				speed: coordinates.speed,
				
				searchDistance: options.searchDistance
			};
			
			// Post the payload to the server
			var promise = $http.post('/api/locations', payload, {timeout: TIMEOUT});
			return promise.then(
				function(result) {
					return result.data;
				},
				function(err) {
					if (!err.data) {
						err.data = {
							message: 'Timeout occurred. Please try again.'
						};
					}
					$log.error(err);
					return $q.reject(err);
				});
		},

		getTravelBoundary: function(currentLocationId, queryParams) {
			// Prepare data to send to server
			var options = {
				params: queryParams,
				timeout: TIMEOUT
			};
			// Make server request
			var promise = $http.get('/api/locations/' + currentLocationId + '/boundary', options);
			return promise.then(
				function(result) {
					return result.data;
				},
				function(err) {
					if (!err.data) {
						err.data = {
							message: 'Timeout occurred. Please try again.'
						};
					}
					$log.error(err);
					return $q.reject(err);
				});
		},
		
		getRecentLocations: function(limit) {
			// Prepare data to send to server
			var options = {
				params: {
					limit: limit || 10
				}
			};
			// Make server request
			var promise = $http.get('/api/locations/', options);
			return promise.then(
				function(result) {
					return result.data;
				},
				function(err) {
					$log.error(err);
					return $q.reject(err);
				});
		},

		getLocationSummary: function(groupLevel) {
			// Prepare data to send to server
			var options = {
				params: {
					groupLevel: groupLevel || 3
				}
			};
			// Make server request
			var promise = $http.get('/api/locations/summary', options);
			return promise.then(
				function(result) {
					// Resolve with rows
					var rows = result.data.rows;
					return rows;
				},
				function(err) {
					$log.error(err);
					return $q.reject(err);
				});
		},
		
		getLocationSummaryByTime: function(groupLevel) {
			// Prepare data to send to server
			var options = {
				params: {
					groupLevel: groupLevel || 3
				}
			};
			// Make server request
			var promise = $http.get('/api/locations/summary/time', options);
			return promise.then(
				function(result) {
					// Resolve with rows
					var rows = result.data.rows;
					return rows;
				},
				function(err) {
					$log.error(err);
					return $q.reject(err);
				});
		},
		
		getLocationSummaryByDevice: function(groupLevel) {
			// Prepare data to send to server
			var options = {
				params: {
					groupLevel: groupLevel || 2
				}
			};
			// Make server request
			var promise = $http.get('/api/locations/summary/device', options);
			return promise.then(
				function(result) {
					// Resolve with rows
					var rows = result.data.rows;
					return rows;
				},
				function(err) {
					$log.error(err);
					return $q.reject(err);
				});
		}
	};
});