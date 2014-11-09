/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var myModule = angular.module('geolocation', []);
myModule.factory('geolocationService', function($q) {
	return {
		getLocation: function() {
			var deferred = $q.defer();
			
			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(
					function(position) {
						// Successfully got the position
						deferred.resolve(position);
					},
					function(error) {
						var msg;
						switch (error.code) {
							case error.PERMISSION_DENIED:
								msg = 'User denied the request for Geolocation.';
								break;
								
							case error.POSITION_UNAVAILABLE:
								msg = 'Location information is unavailable.';
								break;
								
							case error.TIMEOUT:
								msg = 'The request to get user location timed out.';
								break;
								
							case error.UNKNOWN_ERROR:
								msg = 'An unknown error occurred.';
								break;
						}
						deferred.reject({
							data: {
								message: msg
							}
						});
					});
			} else {
				// Geolocation not supported, so reject deferred
				var notSupported = 'Geolocation is not supported by this browser.';
				deferred.reject(notSupported);
			}
			
			return deferred.promise;
		}
	};
});