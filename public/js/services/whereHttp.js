/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var myModule = angular.module('whereHttp', []);
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
			var deferred = $q.defer();
			$http.post('/api/locations', payload).
				success(function(data, status, headers, config) {
					deferred.resolve(data);
				}).
				error(function(data, status, headers, config) {
					$log.error(data);
					deferred.reject(data);
				});
			return deferred.promise;
		},

		getTravelBoundary: function(currentLocationId, queryParams) {
			// Prepare data to send to server
			var options = {
				params: queryParams
			};
			// Make server request
			var deferred = $q.defer();
			$http.get('/api/locations/' + currentLocationId + '/boundary', options).
				success(function(data, status, headers, config) {
					deferred.resolve(data);
				}).
				error(function(data, status, headers, config) {
					$log.error(data);
					deferred.reject(data);
				});
			return deferred.promise;
		},

		getLocationSummary: function(groupLevel) {
			// Prepare data to send to server
			var options = {
				params: {
					groupLevel: groupLevel || 3
				}
			};
			// Make server request
			var deferred = $q.defer();
			$http.get('/api/locations/summary', options).
				success(function(data, status, headers, config) {
					// Sort the data
					data.rows.sort(function(a, b) {
						return b.value - a.value;
					});
					
					// Resolve with the sorted rows
					deferred.resolve(data.rows);
				}).
				error(function(data, status, headers, config) {
					$log.error(data);
					deferred.reject(data);
				});
			return deferred.promise;
		}
	};
});