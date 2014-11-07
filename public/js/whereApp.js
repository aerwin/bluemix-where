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
				$scope.startSpin();
				
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
					function(msg, code) {
						// Show an error and stop the spinner
						$scope.setWhereAmIAlert('danger', 'Error occurred getting geolocation.');
						$scope.stopSpin();
					}
				);
			},

			postGeolocation: function() {
				// Start a spinner over Where Am I? 
				$scope.startSpin();
				
				whereHttpService.postGeolocation($scope.currentCoordinates).then(
					function(data) {
						// Post was successful for make note of the address data
						$scope.currentLocation = data;

						// Update the location summary because rankings could change
						$scope.updateWhereHaveOthersBeen();

						// Stop the spinner
						$scope.stopSpin();
					},
					function(err) {
						// Show an error and stop the spinner
						$scope.setWhereAmIAlert('danger', 'Error occurred retrieving posting position to server.');
						$scope.stopSpin();
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
				$scope.startSpinBoundary();
				
				// Clear out current boundary data
				$scope.resetBoundaryData();

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
						$scope.stopSpinBoundary();

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
						$scope.setWhereCanIGoAlert('danger', 'Error occurred retrieving travel boundary.');
						$scope.stopSpinBoundary();
					}
				);
			},
			
			/***********************************************************
			 * Where have others been? -- location summary
			 **********************************************************/
			locationSummary: [],
			updateWhereHaveOthersBeen: function(groupLevel) {
				whereHttpService.getLocationSummary(groupLevel).then(
					function(data) {
						// Success, so store the summary
						$scope.locationSummary = data;
					},
					function(err) {
						// AWE TODO
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
			startSpin: function() {
				usSpinnerService.spin('whereAmI-spinner');
			},

			stopSpin: function() {
				usSpinnerService.stop('whereAmI-spinner');
			},
			
			startSpinBoundary: function() {
				usSpinnerService.spin('whereCanIGo-spinner');
			},

			stopSpinBoundary: function() {
				usSpinnerService.stop('whereCanIGo-spinner');
			}
		});
		
		// Kick off getting the user's location and
		// updating the display
		$scope.handleWhereAmI();
	}
]);
