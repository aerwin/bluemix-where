/* Copyright IBM Corp. 2014 All Rights Reserved                      */

var Cloudant = require('cloudant');

var DATABASE_NAME = 'where';
var DESIGN_DOCUMENT_NAME = 'where-design';

var cloudant;
var whereDB;

function getCloudant(credentials, callback) {
	if (cloudant) {
		callback(null, cloudant);
	} else {
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

function getDatabase(credentials, callback) {
	if (whereDB) {
		// Previouly initalized the DB, so we can do the callback immediately
		callback(null, whereDB);
	} else {
		getCloudant(credentials, function(err, cloudant) {
			if (!err) {
				// Create a database (if it doesn't exist)
				cloudant.db.create(DATABASE_NAME, function(createErr, createResult) {
					if (!createErr || createErr.error === 'file_exists') {
						// Database created (or previously existed). Now, tell
						// specify that we're going to use it.
						whereDB = cloudant.use(DATABASE_NAME);
						
						// We need to do a final piece of setup. We create the
						// indices that will allow us to perform the queries
						// we need to perform.
						createIndices(whereDB, function(indexErr, indexResult) {
							if (!indexErr) {
								callback(null, whereDB);
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
function getLocationManager(credentials) {
	if (!credentials) {
		throw new TypeError('service credentials are required');
	}

	return {
		// Insert location data into the database
		insertLocation: function(locationData, callback) {
			getDatabase(credentials, function(initErr, db) {
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
			getDatabase(credentials, function(initErr, db) {
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
			getDatabase(credentials, function(initErr, db) {
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
							['time', 'address.Country', 'address.StateProvince', 'address.City'];
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
		//          - 0 = no grouping (basically the total number of locations
		//			- 1 = Country
		//			- 2 = Country and State
		//			- 3 = Country, State, City
		//
		getSummary: function(options, callback) {
			getDatabase(credentials, function(initErr, db) {
				if (db && !initErr) {
					var params = {
						reduce: true,
						group_level: options.groupLevel || 3,
					};
					db.view(DESIGN_DOCUMENT_NAME, 'Country-StateProvince-City', params,
						function(viewErr, viewResponse) {
							if (!viewErr) {
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