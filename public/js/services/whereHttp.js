/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var myModule = angular.module('whereHttp', []);
myModule.factory('whereHttpService', function($q, $http, $log) {
	return {
		postGeolocation: function(coordinates) {
			// Post the coordinates to the server
			var deferred = $q.defer();
			$http.post('/api/locations', coordinates).
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
						if (a.value === b.value) {
							return 0;
						} else {
							return a.value < b.value;
						}
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