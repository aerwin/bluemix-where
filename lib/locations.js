/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var Cloudant = require('cloudant');

var countries  = require('country-data').countries;

// Default DB name. Can be overridden by 'dbName' in service options.
var DATABASE_NAME = 'where';

// Design document name
var DESIGN_DOCUMENT_NAME = 'where';
var DESIGN_DOCUMENT_NAME_USAGE_VIEWS = 'where_usage_views';

// Placeholders for connections
var cloudant;
var whereDB;

function getCloudant(serviceOptions, callback) {
	if (cloudant) {
		callback(null, cloudant);
	} else {
		var credentials = serviceOptions.credentials;
		var username = credentials.username;
		var password = credentials.password;
		
		Cloudant({account:username, password:password}, function(cloudantErr, cloudant) {
			if (cloudantErr) {
				console.error('Error connecting to Cloudant account %s: %s', username, cloudantErr.message);
			}
			callback(cloudantErr, cloudant);
		});
	}
}

function createIndex(whereDB, index, callback) {
	// Create the index
	whereDB.index(index, function(err, response) {
		if (err) {
			// Probably means index already created
			console.error(err);
		}
		
		callback(err, response);
	});
}

function createIndices(whereDB, callback) {
	var indices = [{
			// Index for userId and Time (time added so we can sort on it)
			ddoc: DESIGN_DOCUMENT_NAME,
			name: 'userId-time',
			type: 'json',
			index: {
				fields:['userId', 'time']
			}
		},{
			// Index for Device ID and Time (time added so we can sort on it)
			ddoc: DESIGN_DOCUMENT_NAME,
			name: 'deviceId-time',
			type: 'json',
			index: {
				fields:['deviceId', 'time']
			}
		},{
			// Index for Country, StateProvince, City
			ddoc: DESIGN_DOCUMENT_NAME,
			name: 'Country-StateProvince-City',
			type: 'json',
			index: {
				fields:['address.Country', 'address.StateProvince', 'address.City']
			}
		}
	];
	
	// Loop over the indices array and make sure all created in DB
	var next = function(counter) {
		if (counter < indices.length) {
			var indexToCreate = indices[counter];
			createIndex(whereDB, indexToCreate, function(response, err) {
				if (err) {
					// Probably means index previously created
					console.error(err);
				}
				
				// Loop
				next(counter + 1);
			});
		} else {
			// We're done, so callback
			callback(null, {result: true});
		}
	};
	next(0);
}

// In order to explicitly provide my own map functions for a view, I need to
// "manually" insert/update my own design document (there's no equivalent 
// to db.index for views with explcit map functions). 
//
// So, if my design document (with my custom view definitions) doesn't exist, it 
// will insert a new one. Otherwise, if my design document is found, it will update
// it if the view definitions do not match the desired ones.
function createViews(whereDB, callback) {
	var designDocument = {
		views: {
			byTime: {
				// This view allows us to examine our location documents as a time series. We
				// break the time information into it's component pieces (year, month, etc.). And, 
				// then we can get at different levels of time granularity based on the group 
				// level. See the getSummaryByTime function for more information.
				map: 'function(doc) {' +
					'	var then = new Date(Date.parse(doc.time));' +
					'	emit([then.getFullYear(), then.getMonth(), then.getDate(), then.getHours(), then.getMinutes(), then.getSeconds()], 1);' +
					'}',
				reduce: '_count'
			},
			byDevice: {
				// This view is intended to provide access to whether a given location
				// was logged by a Pebble or a Web browser and the OS that was used. See
				// the getSummaryByDevice function for more information.
				//
				// Note: This map function only does a VERY rudimentary analysis of the
				// user_agent field in each document.
				map: 'function(doc) {' +
					'	var device = doc.deviceId ? "Pebble" : "Browser";' +
					'	var os = "Other";' +
					'	var userAgent = doc.user_agent;' +
					'	if (userAgent) {' +
					'		if (userAgent.indexOf("iOS") >= 0 || ' +
					'			userAgent.indexOf("PebbleApp") >= 0) {' +
					'			os = "iOS";' +
					'		} else if (userAgent.indexOf("Android") >= 0) {' +
					'			os = "Android";' +
					'		} else if (userAgent.indexOf("Windows") >= 0) {' +
					'			os = "Windows";' +
					'		} else if (userAgent.indexOf("Linux") >= 0) {' +
					'			os = "Linux";' +
					'		}' +
					'	}' +
					'	emit([device, os], 1);' +
					'}',
				reduce: '_count'
			}
		}
	};
	
	var viewDesignDocId = '_design/' + DESIGN_DOCUMENT_NAME_USAGE_VIEWS;
	whereDB.get(viewDesignDocId, function(getErr, result) {
		if (!getErr || getErr.message === 'missing' || getErr.message === 'deleted') {
			if (!result ||
					result && JSON.stringify(designDocument.views) !== JSON.stringify(result.views)) {
				
				// Need to add the current rev if updating the document
				designDocument._rev = result && result._rev;

				// Add or update the design document
				whereDB.insert(designDocument, viewDesignDocId, function(err, body, header) {
					if (!err) {
						callback(null, {result:true});
					} else {
						callback(err, null);
					}
				});
			}
		} else {
			callback(getErr, null);
		}
	});
}

function getDatabase(serviceOptions, callback) {
	if (whereDB) {
		// Previouly initalized the DB, so we can do the callback immediately
		callback(null, whereDB);
	} else {
		console.log('locations:getDatabase -- Getting Cloudant object...');
		getCloudant(serviceOptions, function(err, cloudant) {
			if (!err) {
				// Create a database (if it doesn't exist)
				var dbName = serviceOptions.dbName || DATABASE_NAME;
				console.log('locations:getDatabase -- Attempting to create/connect to Cloudant DB = ' + dbName);
				cloudant.db.create(dbName, function(createErr, createResult) {
					if (!createErr || createErr.error === 'file_exists') {
						// Database created (or previously existed). Now, tell
						// specify that we're going to use it.
						console.log('locations:getDatabase -- SUCCESS connecting to Cloudant DB = ' + dbName);
						whereDB = cloudant.use(dbName);
						
						// Next, we create the indices that will allow us to perform the queries
						// we need..
						createIndices(whereDB, function(indexErr, indexResult) {
							if (!indexErr) {
								// Finally, update the design document with view definitions.
								createViews(whereDB, function(viewErr, viewResult) {
									if (!viewErr) {
										callback(null, whereDB);
									} else {
										console.error('Problem creating views: ' + JSON.stringify(viewErr));
										callback(viewErr, null);
									}
								});
								
								
							} else {
								console.error('Problem creating indices: ' + JSON.stringify(indexErr));
								callback(indexErr, null);
							}
						});
					} else {
						console.error('Problem creating database: ' + JSON.stringify(createErr));
						callback(createErr, null);
					}
				});
			} else {
				console.error('Problem connecting to Cloudant: ' + JSON.stringify(err));
				callback(err, null);
			}
		});
	}
}

/*****************************************************
 * Implementation of the "public" facing functions
 *****************************************************/
function getLocationManager(serviceOptions) {
	if (!serviceOptions || !serviceOptions.credentials) {
		throw new TypeError('service credentials are required');
	}

	return {
		// Provides a convenience to get DB setup out of the way before
		// clients start connecting
		initialize: function(callback) {
			getDatabase(serviceOptions, function(initErr, db) {
				if (db && !initErr) {
					// Success
					if (callback) {
						callback(null, {success: true});
					}
				} else {
					// We have an error
					if (callback) {
						console.error(JSON.stringify(initErr));
						callback(initErr, null);
					}
				}
			});
		},
		
		// Insert location data into the database
		insertLocation: function(locationData, callback) {
			getDatabase(serviceOptions, function(initErr, db) {
				if (db && !initErr) {
					// and insert a document in it
					db.insert(locationData, null, function(err, body, header) {
						if (!err) {
							// Add an id from the insertion and then invoke callback
							locationData.id = body.id;
							callback(null, locationData);
						} else {
							callback(err, null);
						}
					});
				} else {
					// We have an error
					callback(initErr, null);
				}
			});
		},
		
		// Get a single location based on a query
		getLocation: function(query, callback) {
			getDatabase(serviceOptions, function(initErr, db) {
				if (db && !initErr) {
					db.get(query.locationId, function(err, result) {
						if (err) {
							console.log('getLocation ERROR: ' + JSON.stringify(err));
						}
						callback(err, result);
					});
					
				} else {
					// Problem initializing the database
					callback(initErr, null);
				}
			});
		},
		
		// Get a list of locations based on a query
		getLocations: function(query, callback) {
			getDatabase(serviceOptions, function(initErr, db) {
				if (db && !initErr) {
					// Set up selector to query either for
					// deviceId or userId
					var selector = {
						time: {
							'$exists': true
						}
					};
					if (query.deviceId) {
						selector.deviceId = query.deviceId;
					} else {
						selector.userId = query.userId;
					}
					
					// All userId's (or deviceId's) in this case should be 
					// same. But want to sort by time, so most recent is first.
					var sort = [];
					if (query.deviceId) {
						sort.push({deviceId: 'desc'});
					} else {
						sort.push({userId: 'desc'});
					}
					sort.push({time: 'desc'});
					
					// Combine everything into find options to send to DB
					var findOptions = {
						limit: query.limit,
						selector: selector,
						sort: sort
					};
					
					// We don't want to make exact location data available to
					// everyone. So, let's limit the fields we return if
					// there's no device id. Eventually, we'd would want
					// to build in some real security with authorization
					// and roles. We'll use "fields" to limit what's in the
					// JSON response.
					if (!query.deviceId) {
						findOptions.fields =
							['time', 'address.Country', 'address.CountryName', 'address.StateProvince', 'address.City'];
					}
					
					// Make the query to the DB
					db.find(findOptions, function(err, result) {
						callback(err, result);
					});
				} else {
					// Problem initializing the database
					callback(initErr, null);
				}
			});
		},
		
		// Get summary of posted locations based on options, which
		// must include:
		//
		//		- groupLevel: 
		//          - 0 = no grouping (basically the total number of locations)
		//			- 1 = Country
		//			- 2 = Country and State
		//			- 3 = Country, State, City
		//
		getSummary: function(options, callback) {
			getDatabase(serviceOptions, function(initErr, db) {
				if (db && !initErr) {
					var params = {
						reduce: true,
						group_level: options.groupLevel || 3,
					};
					db.view(DESIGN_DOCUMENT_NAME, 'Country-StateProvince-City', params,
						function(viewErr, viewResponse) {
							if (!viewErr) {
								// Sort the view response rows
								var rows = viewResponse.rows;
								rows.sort(function(a, b) {
									return b.value - a.value;
								});
								
								// Add in English country names for client convenience
								if (options.groupLevel > 0) {
									rows.forEach(function(item) {
										var countryCode = item.key[0];
										var countryName
											= (countries[countryCode] && countries[countryCode].name) || countryCode;
										item.countryName = countryName;
									});
								}
								
								// Callback with sorted data
								callback(null, viewResponse);
							} else {
								console.log('ERROR getSummary: ' + JSON.stringify(viewErr));
								callback(viewErr, null);
							}
						}
					);
				} else {
					// Problem initializing the database
					callback(initErr, null);
				}
			});
		},
		
		// Get usage info related to the date/time a location was posted locations based on 'options', which
		// must include:
		//
		//		- groupLevel: 
		//          - 0 = Year
		//			- 2 = Year and Month
		//			- 3 = Year, Month, Day of Month
		//			- 4 = Year, Month, Day of Month, Hour of Day
		//			- 5 = Year, Month, Day of Month, Hour of Day, Minute of Hour
		//			- 6 = Year, Month, Day of Month, Hour of Day, Minute of Hour, Second of Minute
		//
		getSummaryByTime: function(options, callback) {
			getDatabase(serviceOptions, function(initErr, db) {
				if (db && !initErr) {
					var params = {
						reduce: true,
						group_level: options.groupLevel || 3,
					};
					db.view(DESIGN_DOCUMENT_NAME_USAGE_VIEWS, 'byTime', params,
						function(viewErr, viewResponse) {
							if (!viewErr) {
								// Callback with sorted data
								callback(null, viewResponse);
							} else {
								console.log('ERROR getSummary: ' + JSON.stringify(viewErr));
								callback(viewErr, null);
							}
						}
					);
				} else {
					// Problem initializing the database
					callback(initErr, null);
				}
			});
		},
		
		// Get usage info related to the devices used to post locations based on 'options', which
		// must include:
		//
		//		- groupLevel: 
		//          - 0 = Device (E.g., Pebble or Browser)
		//			- 1 = Device + Operating System (e.g., iOS, Android, Windows, Linux)
		//
		getSummaryByDevice: function(options, callback) {
			getDatabase(serviceOptions, function(initErr, db) {
				if (db && !initErr) {
					var params = {
						reduce: true,
						group_level: options.groupLevel || 2,
					};
					db.view(DESIGN_DOCUMENT_NAME_USAGE_VIEWS, 'byDevice', params,
						function(viewErr, viewResponse) {
							if (!viewErr) {
								// Callback with sorted data
								callback(null, viewResponse);
							} else {
								console.log('ERROR getSummary: ' + JSON.stringify(viewErr));
								callback(viewErr, null);
							}
						}
					);
				} else {
					// Problem initializing the database
					callback(initErr, null);
				}
			});
		}
	};
}

/**************************************************************
 *			Export Functions
 **************************************************************/
module.exports.getLocationManager = getLocationManager;