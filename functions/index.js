const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { onRequest } = require('firebase-functions/v2/https');
const {
    onDocumentCreated,
    onDocumentDeleted
} = require('firebase-functions/v2/firestore');

const https = require('https');

initializeApp();

const BARCODE_NUMBER_REGEX = /9[0-9]{9}0/; // A 9 followed, by 9 digits, followed by a 0

/**
 * Deletes the user's account if their info fails validation.
 */
exports.createAccount = onDocumentCreated(
    "users/{userId}",
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) {
            return;
        }
        const data = snapshot.data();

        const campusID = data.campus_id;

        // // Improperly formatted campus ID
        // if (!isCampusIDProperlyFormatted(campusID)) {
        //     await _deleteAccount(snapshot.id);
        // }

        // // Non-unique campus ID
        // if (!campusID || !isCampusIDUnique(campusID)) {
        //     await _deleteAccount(snapshot.id);
        // }
    }
)

/**
 * Deletes the user's auth account when their document is deleted.
 */
exports.deleteAccount = onDocumentDeleted(
    "users/{userId}",
    (event) => {
        const snapshot = event.data;
        if (!snapshot) {
            return;
        }

        // // Delete the auth account associated with the user if it exists
        // const user = admin.auth().getUser(snapshot.id);
        // if (user) {
        //     admin.auth().deleteUser(snapshot.id);
        // }
    }
)

/**
 * Deletes the user's document when their auth account is deleted.
 */
exports.deleteAuthAccount = functions.auth.user().onDelete(
    (user) => {
        const db = getFirestore();
        const usersRef = db.collection("users");
        const query = usersRef.where("id", "==", user.uid);

        // query.get().then((snapshot) => {
        //     snapshot.forEach((doc) => {
        //         doc.ref.delete();
        //     });
        // });
    }
)

/**
 * Deletes the restaurant owner's account if their information fails validation.
 */
exports.createRestaurant = onDocumentCreated(
    "restaurants/{restaurantId}",
    async (event) => {
        const restaurantSnapshot = event.data;
        if (!restaurantSnapshot) {
            return;
        }
        const data = restaurantSnapshot.data();

        const address = data.address;
        const ownerSnapshot = await data.owner.get()
        const ownerId = ownerSnapshot.id;

        // Just using this to populate the location field
        _isAddressValid(address, restaurantSnapshot.id)

        // try {
        //     const isValid = await _isAddressValid(address, restaurantSnapshot.id)
        //     if (!isValid) {
        //         await _deleteAccount(ownerId);
        //         throw new Error("Address is not within the bounds of the University of Wisconsin-Madison.");
        //     }
        // } catch (error) {
        //     await _deleteAccount(ownerId);
        //     throw new Error("Failed to validate the address.");
        // }
    }
)

exports.verifyCampusID = onRequest(
    { cors: false },
    (request, response) => {
        const barcode = request.query.barcode.toString();
        const campusIDIsProperlyFormatted = isCampusIDProperlyFormatted(barcode);
        response.status(200).send(campusIDIsProperlyFormatted);
    }
)

function isCampusIDProperlyFormatted(campusID) {
    return BARCODE_NUMBER_REGEX.test(campusID);
}

function isCampusIDUnique(campusID) {
    const db = getFirestore();
    const usersRef = db.collection("users");
    const query = usersRef.where("campus_id", "==", campusID);
    query.get().then((snapshot) => {
        return snapshot.empty;
    });
}

async function _deleteAccount(userId) {
    const db = getFirestore();

    const userDocument = db.collection("users").doc(userId).get();
    if (userDocument) {
        const data = snapshot.data()

        // if (data.account_type === "business") {
        //     userDocument.delete();
    
        //     // Find restaurant owned by user
        //     const restaurantSnapshot = await db.collection("restaurants").where("owner.id", "==", userId).get()
        //     restaurantSnapshot.forEach((doc) => {
        //         doc.ref.delete();
        //     })
        // }
    }

    // // Delete user in auth
    // const auth = admin.auth();

    // auth.getUser(userId).then((user) => {
    //     auth.deleteUser(userId);
    // }).catch((error) => {
    //     console.log("!!!CODE!!!", error.code); // auth/user-not-found
    //     // User does not exist in auth
    // });
}



// Google Maps stuff

const MAPS_API_KEY = defineSecret("MAPS_API_KEY");

// Bounds for the University of Wisconsin-Madison
const BOUNDS = {
    lat2: 43.06287379628286,
    long2: -89.44083184696541,
    lat1: 43.07860429818014,
    long1: -89.37878605972091
};

exports.geocodeAddress = functions.https.onCall(
    { secrets: ['MAPS_API_KEY'] },
    async (request) => {
        return this._geocodeAddress(request.data.address)
    }
);

async function _geocodeAddress(address) {
    if (!address || address.length === 0) {
        throw new Error("Address is required.");
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${MAPS_API_KEY.value()}`;

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
    { secrets: ['MAPS_API_KEY'] },
    async (request) => {
        return this._isAddressValid(request.data.address, request.data.restaurantId);
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
            resolve(false);
        }

        const db = getFirestore();
        const restaurantsRef = db.collection("restaurants");
        const restaurantDoc = restaurantsRef.doc(restaurantId);

        restaurantDoc.get().then((snapshot) => {
            if (snapshot.exists) {
                // Use the saved geopoint if it exists
                const data = snapshot.data();
                const location = data.location;
                resolve(isPointWithinBounds(location.latitude, location.longitude, BOUNDS));
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

                    resolve(isPointWithinBounds(location.lat, location.lng, BOUNDS));
                }).catch((error) => {
                    console.error("Error in geocoding:", error);
                    reject(new Error("Failed to geocode the address."));
                });
            }
        })
    });
}

function isPointWithinBounds(x, y, bounds) {
    return x >= bounds.lat1 && x <= bounds.lat2 && y >= bounds.long1 && y <= bounds.long2;
}