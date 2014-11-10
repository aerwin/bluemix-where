/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var myModule = angular.module('whereHttp', []);

var TIMEOUT = 60 * 1000; // 60 seconds

myModule.factory('whereHttpService', function($q, $http, $log) {
	return {
		postGeolocation: function(coordinates) {
			// Prepare the payload
			var payload = {
				latitude: coordinates.latitude,
				longitude: coordinates.longitude,
				altitude: coordinates.altitude,
				accuracy: coordinates.accuracy,
				altitudeAccuracy: coordinates.altitudeAccuracy,
				heading: coordinates.heading,
				speed: coordinates.speed
			};
			
			// Post the payload to the server
			var promise = $http.post('/api/locations', payload, {timeout: TIMEOUT});
			return promise.then(
				function(result) {
					return result.data;
				},
				function(err) {
					$log.error(err);
					return $q.reject(err);
				});
		},

		getTravelBoundary: function(currentLocationId, queryParams) {
			// Prepare data to send to server
			var options = {
				params: queryParams
			};
			// Make server request
			var promise = $http.get('/api/locations/' + currentLocationId + '/boundary', options);
			return promise.then(
				function(result) {
					return result.data;
				},
				function(err) {
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
					// Sort the data
					var rows = result.data.rows;
					rows.sort(function(a, b) {
						return b.value - a.value;
					});
					
					// Resolve with the sorted rows
					return rows;
				},
				function(err) {
					$log.error(err);
					return $q.reject(err);
				});
		}
	};
});