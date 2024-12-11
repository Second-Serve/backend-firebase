import * as functions from 'firebase-functions/v2';
import { GeoPoint } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import * as https from 'https';
import { default as axios } from 'axios';
import { getRestaurantById } from './util';

const MAPS_API_KEY = defineSecret("MAPS_API_KEY");

// Bounds for the University of Wisconsin-Madison
const MADISON_CAMPUS_BOUNDS = {
    lat2: 43.06287379628286,
    long2: -89.44083184696541,
    lat1: 43.07860429818014,
    long1: -89.37878605972091
};

interface GeocodeAddressOptions {
    address: string
}

export const geocodeAddress = functions.https.onCall(
    async (request: { data: GeocodeAddressOptions }) => {
        return await _geocodeAddress(request.data.address)
    }
);

async function _geocodeAddress(address: string): Promise<GeoPoint> {
    if (!address || address.length === 0) {
        throw new Error("Address is required.");
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${MAPS_API_KEY.value()}`;

    try {
        const data: GeoPoint = await new Promise((resolve, reject) => {
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
                            // Resolve with the first result
                            const location = results[0].geometry.location;
                            resolve(new GeoPoint(
                                location.lat,
                                location.lng
                            ));
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
    } catch (error) {
        console.error("Error in geocoding:", error);
        throw new functions.https.HttpsError('unknown', 'Error in geocoding.');
    }
}

interface IsAddressValidOptions {
    address: string
}

interface IsAddressValidResponse {
    isValid: boolean
    reason?: string
}

export const isAddressValid = functions.https.onCall(
    async (request: { data: IsAddressValidOptions }) => {
        return _isAddressValid(request.data.address);
    }
);

/**
 * Get whether the address is within the bounds of the University of Wisconsin-Madison.
 * @param {string}  address      The address to check.
 */
async function _isAddressValid(address: string) {
    const data = await new Promise(async (resolve, reject) => {
        if (!address || address.length <= 0) {
            resolve({
                isValid: false,
                reason: "Address is missing or empty."
            });
            return;
        }

        try {
            // No saved geopoint, so geocode the address
            const location = await _geocodeAddress(address);

            const pointWithinBounds = isPointWithinBounds(location, MADISON_CAMPUS_BOUNDS);
            let result: IsAddressValidResponse = {
                isValid: pointWithinBounds
            }

            if (!pointWithinBounds) {
                result.reason = "Address is not within the UW-Madison campus."
            }
            
            resolve(result)
        } catch (e) {
            reject(new Error(`${e}`))
        }
    });
    return data;
}

interface DistanceToRestaurantOptions {
    restaurantId: string,
    startingPoint: GeoPoint
}

interface DistanceToRestaurantResponse {

}

export const distanceToRestaurant = functions.https.onCall(
    { secrets: ["MAPS_API_KEY"] },
    async (request) => {
        const { restaurantId, startingPoint } = request.data as DistanceToRestaurantOptions;
        const startingGeoPoint: GeoPoint = new GeoPoint(
            startingPoint.latitude,
            startingPoint.longitude
        );
        return await _distanceToRestaurant(restaurantId, startingGeoPoint);
    }
)

async function _distanceToRestaurant(
    restaurantId: string,
    startingPoint: GeoPoint
): Promise<DistanceToRestaurantResponse> {
    const restaurant = await getRestaurantById(restaurantId);
    const address = restaurant?.address;

    if (!address) {
        throw new Error(`Restaurant with id ${restaurantId} doesn't have an address.`);
    }

    const encodedAddress = encodeURIComponent(address);
    const encodedStartingPoint = encodeURIComponent(`${startingPoint.latitude},${startingPoint.longitude}`);

    const url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        + `?destinations=${encodedAddress}`
        + `&origins=${encodedStartingPoint}`
        + `&key=${MAPS_API_KEY.value()}`;

    try {
        const response = await axios.get(url);
        const results = response.data.rows[0];
        if (results.length === 0) {
            throw new Error("No results found.");
        } else {
            // Resolve with the first result
            const distance = results.elements[0].distance.value;
            console.log(`Distance to ${restaurantId}: ${distance} m`)
            return {
                distance: distance
            };
        }
    } catch (error) {
        throw new Error("Failed to parse the geocoding response.");
    }
}

interface LatLongBounds {
    lat1: number,
    lat2: number,
    long1: number,
    long2: number
}

function isPointWithinBounds(point: GeoPoint, bounds: LatLongBounds) {
    return point.latitude >= bounds.lat1
        && point.latitude <= bounds.lat2
        && point.longitude >= bounds.long1
        && point.longitude <= bounds.long2;
}

interface GetRestaurantMapImageOptions {
    restaurantId: string,
    type: MapImageType
}

enum MapImageType {
    BANNER = "banner",
    ICON = "icon"
}

interface ImageSize {
    x: Number,
    y: Number
}

export const getRestaurantMapImage = functions.https.onCall(
    { secrets: ["MAPS_API_KEY"] },
    async (request, response) => {
        const { restaurantId, type } = request.data as GetRestaurantMapImageOptions;

        const restaurant = await getRestaurantById(restaurantId);

        // A little hacky, but necessary to ensure the right address is used
        const madisonAddress = restaurant.address + " Madison, WI";
        const center = encodeURIComponent(madisonAddress);

        const typeLowerCase = type.toLowerCase();

        const folderName = typeLowerCase;
        const fileName = `${restaurantId}.jpg`;
        const filePath = `images/maps/${folderName}/${fileName}`;
        const bucket = getStorage().bucket();
        const file = bucket.file(filePath);

        // If the file already exists, use that
        const fileExists = await file.exists();
        if (fileExists[0]) {
            return {
                "image": file.publicUrl()
            }
        }

        let zoom: Number;
        let size: ImageSize;
        if (typeLowerCase == MapImageType.BANNER) {
            zoom = 20;
            size = { x: 500, y: 250 };
        } else if (typeLowerCase == MapImageType.ICON) {
            zoom = 20;
            size = { x: 128, y: 128 };
        } else {
            return {
                success: false,
                reason: `Unknown map image type: ${type}`
            };
        }

        const url = "https://maps.googleapis.com/maps/api/staticmap"
            + `?center=${center}`
            + `&zoom=${zoom}`
            + `&size=${size.x}x${size.y}`
            + "&format=jpg"
            + `&key=${MAPS_API_KEY.value()}`;
        console.log(url);

        const apiResponse = await axios.get(url, {
            responseType: "arraybuffer"
        });

        const buffer = apiResponse.data;
        await file.save(buffer);

        // // Annoyingly, we can't do these two in parallel
        await file.makePublic();
        await file.setMetadata({
            contentType: "image/jpeg",
            cacheControl: "public, max-age=86400"
        })

        console.log(file.publicUrl());

        return {
            "image": file.publicUrl()
        };
    }
)