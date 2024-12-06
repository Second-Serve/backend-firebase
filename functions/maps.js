const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');

const https = require('https');

const MAPS_API_KEY = process.env.MAPS_API_KEY;

// Bounds for the University of Wisconsin-Madison
const BOUNDS = {
    lat2: 43.06287379628286,
    long2: -89.44083184696541,
    lat1: 43.07860429818014,
    long1: -89.37878605972091
};

exports.geocodeAddress = functions.https.onCall(
    async (request) => {
        return _geocodeAddress(request.data.address)
    }
);

async function _geocodeAddress(address) {
    if (!address || address.length === 0) {
        throw new Error("Address is required.");
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${MAPS_API_KEY}`;

    try {
        const data = await new Promise((resolve, reject) => {
            https.get(url, (httpResponse) => {
                let data = '';

                httpResponse.on('data', (chunk) => {
                    data += chunk;
                });

                httpResponse.on('end', () => {
                    try {
                        const results = JSON.parse(data).results;
                        if (results.length === 0) {
                            reject(new Error("No results found."));
                        } else {
                            resolve(results[0]); // Resolve with the first result
                        }
                    } catch (error) {
                        reject(new Error("Failed to parse the geocoding response."));
                    }
                });

                httpResponse.on('error', (error) => {
                    reject(new Error("HTTP request failed: " + error.message));
                });
            });
        });

        return { result: data }; // Return the geocode result
    } catch (error) {
        console.error("Error in geocoding:", error);
        throw new functions.https.HttpsError('unknown', 'Error in geocoding.');
    }
}

exports.isAddressValid = functions.https.onCall(
    async (request) => {
        return _isAddressValid(request.address, request.restaurantId);
    }
);

/**
 * Get whether the address is within the bounds of the University of Wisconsin-Madison.
 * @param {string}  address      The address to check.
 * @param {?string} restaurantId The restaurant this address is associated with. Makes check use saved geopoint if it exists.
 * @param {boolean} saveGeopoint Whether to save the geopoint if the address is valid.
 */
async function _isAddressValid(address, restaurantId = null, saveGeopoint = true) {
    const data = await new Promise((resolve, reject) => {
        if (address && address.length > 0) {
            resolve({ isValid: false });
        }

        const db = getFirestore();
        const restaurantsRef = db.collection("restaurants");
        const restaurantDoc = restaurantsRef.doc(restaurantId);

        restaurantDoc.get().then((snapshot) => {
            if (snapshot.exists) {
                // Use the saved geopoint if it exists
                const data = snapshot.data();
                const location = data.location;
                resolve({
                    isValid: isPointWithinBounds(location.latitude, location.longitude, BOUNDS)
                });
            } else {
                // No saved geopoint, so geocode the address
                _geocodeAddress(address).then((geocodeResult) => {
                    const location = geocodeResult.geometry.location;

                    if (saveGeopoint) {
                        // Save the geopoint
                        restaurantDoc.set({
                            location: new admin.firestore.GeoPoint(location.lat, location.lng)
                        }, { merge: true });
                    }

                    resolve({
                        isValid: isPointWithinBounds(location.lat, location.lng, BOUNDS)
                    });
                }).catch((error) => {
                    console.error("Error in geocoding:", error);
                    reject(new Error("Failed to geocode the address."));
                });
            }
        })
    });
    return data;
}

exports.distanceToRestaurant = functions.https.onRequest(
    async (request, response) => {
        const data = await new Promise(async (resolve, reject) => {
            const restaurantId = request.restaurantId;
            const startingPoint = request.startingPoint;

            // Get address of restaurant from database
            const db = getFirestore();
            const restaurantDoc = await db.collection("restaurants")
                .doc(restaurantId)
                .get();

            if (!restaurantDoc.exists) {
                reject(new Error(`Restaurant with id ${restaurantId} does not exist.`));
                return;
            }

            const restaurant = restaurantDoc.data()
            const address = restaurant.address;

            if (!address) {
                reject(new Error(`Restaurant with id ${restaurantId} doesn't have an address.`));
                return;
            }

            const encodedAddress = encodeURIComponent(address);
            const encodedStartingPoint = encodeURIComponent(`${startingPoint.longitude},${startingPoint.latitude}`);

            const url = `https://maps.googleapis.com/maps/api/distancematrix/json
                ?destinations=${encodedAddress}
                &origins=${encodedStartingPoint}
                &key=${MAPS_API_KEY}`;

            https.get(url, (httpResponse) => {
                let data = '';

                httpResponse.on('data', (chunk) => {
                    data += chunk;
                });

                httpResponse.on('end', () => {
                    try {
                        const results = JSON.parse(data).results;
                        if (results.length === 0) {
                            reject(new Error("No results found."));
                        } else {
                            resolve(results[0]); // Resolve with the first result
                        }
                    } catch (error) {
                        reject(new Error("Failed to parse the geocoding response."));
                    }
                });

                httpResponse.on('error', (error) => {
                    reject(new Error("HTTP request failed: " + error.message));
                });
            });
        });
        return data;
    }
)

function isPointWithinBounds(x, y, bounds) {
    return x >= bounds.lat1 && x <= bounds.lat2 && y >= bounds.long1 && y <= bounds.long2;
}