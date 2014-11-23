/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var whereApp = angular.module('whereApp', [
	'ui.bootstrap', 'ngRoute', 'leaflet-directive', 'angularSpinner', 'geolocation', 'whereHttp'
]).config([
    // Make use of the where.html partial
	'$routeProvider', function($routeProvider) {
		$routeProvider.otherwise({
			controller: 'WhereController',
			templateUrl: '/partials/where.html'
		});
	}
]);

whereApp.controller('WhereController', [
	'$scope',
	'$http',
	'usSpinnerService',
	'geolocationService',
	'whereHttpService',
	function($scope, $http, usSpinnerService, geolocationService, whereHttpService) {
		var DEFAULT_ZOOM_LEVEL = 12;
		var DEFAULT_SEARCH_DISTANCE = 750;
		
		angular.extend($scope, {

			/***********************************************************
			 * Where am I?
			 **********************************************************/
			handleWhereAmI: function() {
				// Clear our current location data
				$scope.resetLocationData();
				
				// Clear any Where Am I? alert messages
				$scope.clearWhereAmIAlert();
				
				// Start a spinner over Where Am I? 
				var spinnerId = 'whereAmI-spinner';
				$scope.startSpin(spinnerId);
				
				geolocationService.getLocation().then(
					function(position) {
						var coords = $scope.currentCoordinates = position.coords;
						
						// Put info on map
						$scope.mapCenter = {
							lat: coords.latitude,
							lng: coords.longitude,
							zoom: DEFAULT_ZOOM_LEVEL
						};
						
						// Add a marker
						$scope.markers = {
							centerMarker: {
								lat: coords.latitude,
								lng: coords.longitude,
								message: 'You are here!',
								focus: false,
								draggable: false,
								icon: {
									iconUrl: 'images/map_pin25x38.png',
									iconSize:     [25, 38], // size of the icon
									iconAnchor:   [13, 38], // point of the icon which will correspond to marker's location
									popupAnchor:  [0, -36] // point from which the popup should open relative to the iconAnchor
								}
							}
						};

						// We have a good geolocation, so post it to server
						$scope.postGeolocation();
					},
					function(err) {
						// Show an error and stop the spinner
						$scope.setWhereAmIAlert('danger', (err.data && err.data.message));
						$scope.stopSpin(spinnerId);
					}
				);
			},

			postGeolocation: function() {
				// Start a spinner over Where Am I? 
				var spinnerId = 'whereAmI-spinner';
				$scope.startSpin(spinnerId);
				
				var options = {
					searchDistance: DEFAULT_SEARCH_DISTANCE,
					coordinates: $scope.currentCoordinates
				};
				whereHttpService.postGeolocation(options).then(
					function(data) {
						// Post was successful for make note of the address data
						$scope.currentLocation = data;
						$scope.addressAvailable = data.address && Object.keys(data.address).length;
						
						// If there's no near by address, so let give user a message
						// Show an error and stop the spinner
						if (!$scope.addressAvailable) {
							$scope.setWhereAmIAlert('info', 'No address within ' + options.searchDistance + ' ft.');
						}

						// Update the popular and recent lists because
						// data just changed
						$scope.updateWhereIsMostPopular();
						$scope.updateWhereHaveOthersBeen();

						// Stop the spinner
						$scope.stopSpin(spinnerId);
					},
					function(err) {
						// Show an error and stop the spinner
						var message = err.message || (err.data && err.data.message) || 'Error occurred posting geolocation to server.';
						$scope.setWhereAmIAlert('danger', message);
						$scope.stopSpin(spinnerId);
					}
				);
			},

			/***********************************************************
			 * Where Can I Go? -- aka Travel Doundary
			 **********************************************************/
			boundaryCost: 5,
			boundaryUnits: 'Minutes',
			
			handleWhereCanIGo: function() {
				// Start up a spinner
				var spinnerId = 'whereCanIGo-spinner';
				$scope.startSpin(spinnerId);
				
				// Clear out current boundary data
				$scope.resetBoundaryData();
				$scope.clearWhereCanIGoAlert();

				// Prepare params and use whereHttpService to make
				// the server call
				var currentLocationId = $scope.currentLocation.id;
				var queryParams = {
					cost: $scope.boundaryCost,
					units: $scope.boundaryUnits
				};
				whereHttpService.getTravelBoundary(currentLocationId, queryParams).then(
					function(data) {
						// Successfully got boundary so stop spinner
						$scope.stopSpin(spinnerId);

						// Set the geojson properties for Leaflet
						$scope.geojson = {
							data: data,
							style: {
								fillColor: '#0970CA',
								weight: 2,
								opacity: 0.9,
								color: '#0F2E4A',
								dashArray: '3',
								fillOpacity: 0.7
							}
						};
					},
					function(err) {
						// Show an error and stop the spinner
						var message = (err.data && err.data.message) || 'Error occurred retrieving travel boundary.';
						$scope.setWhereCanIGoAlert('danger', message);
						$scope.stopSpin(spinnerId);
					}
				);
			},
			
			/***********************************************************
			 * Where is most popular? -- location summary
			 **********************************************************/
			locationSummary: [],
			groupLevel: 1,
			updateWhereIsMostPopular: function() {
				// Start up a spinner
				var spinnerId = 'whereIsMostPopular-spinner';
				$scope.startSpin(spinnerId);
				
				whereHttpService.getLocationSummary($scope.groupLevel).then(
					function(data) {
						// Success, so stop spinner store the summary
						$scope.stopSpin(spinnerId);
						$scope.locationSummary = data;
					},
					function(err) {
						$scope.stopSpin(spinnerId);
					}
				);
			},
			
			/***********************************************************
			 * Where have others been? -- location summary
			 **********************************************************/
			recentLocations: [],
			updateWhereHaveOthersBeen: function(groupLevel) {
				// Start up a spinner
				var spinnerId = 'whereHaveOthersBeen-spinner';
				$scope.startSpin(spinnerId);
				
				whereHttpService.getRecentLocations().then(
					function(data) {
						// Success, so stop spinner store the summary
						$scope.stopSpin(spinnerId);
						$scope.recentLocations = data;
					},
					function(err) {
						$scope.stopSpin(spinnerId);
					}
				);
			},
			
			/***********************************************************
			 * Utils for resetting data
			 **********************************************************/
			resetLocationData: function() {
				// Address data
				$scope.currentCoordinates = null;
				$scope.currentLocation = null;
				$scope.addressAvailable = false;
				
				// Leaflet data
				$scope.resetBoundaryData();
			},
			
			resetBoundaryData: function() {
				// Leaflet data
				$scope.geojson = null;
			},
			
			/***********************************************************
			 * Leaflet data structures
			 **********************************************************/
			mapCenter: {
				// Nothing
			},
			
			markers: {
				// Nothing
			},
			
			defaults: {
				scrollWheelZoom: false
			},
			
			// Set this because we want to use https
			tiles: {
				url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
			},

			/************************************************
			 * Where Am I? --  Alerts
			 ************************************************/
			whereAmIAlerts: [],
			setWhereAmIAlert: function(type, msg) {
				var newAlert = {type: type, msg: msg};
				if ($scope.whereAmIAlerts.length) {
					$scope.whereAmIAlerts[0] = newAlert;
				} else {
					$scope.whereAmIAlerts.push(newAlert);
				}
			},
			clearWhereAmIAlert: function() {
				if ($scope.whereAmIAlerts.length) {
					$scope.whereAmIAlerts.splice(0, 1);
				}
			},
			
			whereCanIGoAlerts: [],
			setWhereCanIGoAlert: function(type, msg) {
				var newAlert = {type: type, msg: msg};
				if ($scope.whereCanIGoAlerts.length) {
					$scope.whereCanIGoAlerts[0] = newAlert;
				} else {
					$scope.whereCanIGoAlerts.push(newAlert);
				}
			},
			clearWhereCanIGoAlert: function() {
				if ($scope.whereCanIGoAlerts.length) {
					$scope.whereCanIGoAlerts.splice(0, 1);
				}
			},

			/**************************************
			 * Spinners
			 **************************************/
			spinningSpinners: {},
			startSpin: function(spinnerId) {
				$scope.spinningSpinners[spinnerId] = true;
				usSpinnerService.spin(spinnerId);
			},

			stopSpin: function(spinnerId) {
				$scope.spinningSpinners[spinnerId] = false;
				usSpinnerService.stop(spinnerId);
			}
		});
		
		// Kick off getting the user's location and
		// updating the display
		$scope.handleWhereAmI();
		$scope.updateWhereIsMostPopular();
		$scope.updateWhereHaveOthersBeen();
	}
]);

//Add a custom filter to convert a date/time to 
// # of secs, minutes, hours, or days from current time
whereApp.filter('getTimeDifference', function () {
	function getTimeDifference(startDate, endDate) {
		var retVal;
			
		var diff = endDate.getTime() - startDate.getTime();
		var secs = diff / 1000;
		if (secs < 60) {
			retVal = Math.round(secs) + ' s';
		} else {
			var mins = secs / 60;
			if (mins < 60) {
				retVal = Math.round(mins) + ' m';
			} else {
				var hours = mins / 60;
				if (hours < 24) {
					retVal = Math.round(hours) + ' h';
				} else {
					var days = hours / 24;
					if (days < 365) {
						retVal = Math.round(days) + ' d';
					}
				}
			}
		}
		
		return retVal;
	}
	
	return function (isoDateString) {
		var startDate = new Date(isoDateString);
		var endDate = new Date();
		return getTimeDifference(startDate, endDate);
	};
});
