bluemix-where
==================
Overview
--------
The code here is for an [IBM Bluemix](https://www.bluemix.net)-powered demo called the [*Where?*](https://where.mybluemix.net/) app. It helps to answer the "where" questions of life like *where am I?*, *where can I go?*, and *where have others been?* It is composed of two parts:

* [Node.js](http://nodejs.org/) backend for deployment to Bluemix which: 
	* Provides a REST API that:
		* allows client apps to register a user's geolocation with the server (stored in a [Cloudant NoSQL DB](https://cloudant.com/))
		* retrieves the postal address associated with the location (using [Pitney Bowes](http://www.pitneybowes.com) [Reverse Geocoding](https://ace.ng.bluemix.net/#/store/cloudOEPaneId=store&serviceOfferingGuid=76273f6f-6e7b-4028-b77d-53553771e208&fromCatalog=true))
		* allows a user to retrieve a “travel boundary” from that location (using Pitney Bowes [Travel Boundary](https://ace.ng.bluemix.net/#/store/cloudOEPaneId=store&serviceOfferingGuid=a38d0eb4-d4a8-4812-8be2-239680457777))
		* provides worldwide statistics for the most commonly “visited” cities (using the map-reduce capabilities of Cloudant). 
	* Leverages third-party Node modules including:
		* [Express](http://expressjs.com/)
		* [Cloudant](https://github.com/cloudant/nodejs-cloudant)
		* [CFEnv](https://github.com/cloudfoundry-community/node-cfenv#readme)
		* [Restler](https://github.com/danwrong/restler) 
	* Serves static resources (e.g., JavaScript, HTML, and CSS) in support of the web client
* Web front-end written as a since-page app and using the following third-party frameworks or components:
	* [Bootstrap](http://getbootstrap.com/)
	* [AngularJS](https://angularjs.org/)
	* [UI Bootstrap](http://angular-ui.github.io/bootstrap/)
	* [Leaflet.js](http://leafletjs.com/) and [Angular Directive for Leaflet.js](https://github.com/tombatossals/angular-leaflet-directive)
	* [Spin.js](http://fgnass.github.io/spin.js/) and [Angular Directive for Spin.js](https://github.com/urish/angular-spinner)
	
Client for Pebble Smartwatch
----------------------------
A client for the Pebble Smartwatch is available in the separate [bluemix-where-pebble](https://github.com/aerwin/bluemix-where-pebble) repository. That code was written in JavaScript leveraging [Pebble.js](http://pebble.github.io/pebblejs/) and using the [CloudPebble IDE](https://cloudpebble.net/).
Tutorial
===================
A tutorial for using the code in this repository is available on IBM developerWorks:

* [*Build a Where? app for web and Pebble users*](http://www.ibm.com/developerworks/library/mo-pebble-where-app/index.html)

License
===================
Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
