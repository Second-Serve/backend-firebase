import * as functions from 'firebase-functions/v1';
// import * as admin from 'firebase-admin';
// import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { RestaurantData, validateRestaurantData } from './validation/restaurants';
import { getUserById } from './util';
import {
    onDocumentCreated,
    onDocumentDeleted
} from 'firebase-functions/v2/firestore';

const BARCODE_NUMBER_REGEX = /9[0-9]{9}0/; // A 9 followed, by 9 digits, followed by a 0

/**
 * Deletes the user's account if their info fails validation.
 */
export const createAccount = onDocumentCreated(
    "users/{userId}",
    async (event) => {
        // const snapshot = event.data;
        // if (!snapshot) {
        //     return;
        // }
        // const data = snapshot.data();

        // const campusID = data.campus_id;

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
export const deleteAccount = onDocumentDeleted(
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
export const deleteAuthAccount = functions.auth.user().onDelete(
    (user) => {
        // const db = getFirestore();
        // const usersRef = db.collection("users");
        // const query = usersRef.where("id", "==", user.uid);

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
export const createRestaurant = onDocumentCreated(
    "restaurants/{restaurantId}",
    async (event) => {
        const restaurantSnapshot = event.data;
        if (!restaurantSnapshot) {
            return;
        }
        // const data = restaurantSnapshot.data();

        // const address = data.address;

        // const geocodeResult = await _geocodeAddress(address);
        // const location = geocodeResult.geometry.location;

        // const db = getFirestore();
        // db.collection("restaurants").doc(restaurantSnapshot.id).set({
        //     location: new admin.firestore.GeoPoint(location.lat, location.lng)
        // }, { merge: true });
    }
)

export const verifyCampusID = onRequest(
    { cors: false },
    (request, response) => {
        if (!request.query.barcode) {
            throw new Error("Barcode field is required.");
        }

        const barcode = request.query.barcode.toString();
        const campusIDIsProperlyFormatted = isCampusIDProperlyFormatted(barcode);
        response.status(200).send(campusIDIsProperlyFormatted);
    }
)

function isCampusIDProperlyFormatted(campusID: string) {
    return BARCODE_NUMBER_REGEX.test(campusID);
}

// function isCampusIDUnique(campusID: string) {
//     const db = getFirestore();
//     const usersRef = db.collection("users");
//     const query = usersRef.where("campus_id", "==", campusID);
//     query.get().then((snapshot) => {
//         return snapshot.empty;
//     });
// }

export const updateRestaurantInformation = functions.https.onCall(
    async (data, context) => {
        const userId = context.auth?.uid;
        if (!userId) {
            return {
                success: false,
                reason: "User is not authenticated."
            }
        }

        const user = await getUserById(userId);

        if (user.account_type != "business") {
            return {
                success: false,
                reason: `User with id ${userId} is not a business account.`
            }
        }

        const db = getFirestore();
        const userReference = db.collection("users").doc(userId);
        const restaurantDocs = await db.collection("restaurants")
            .where("owner", "==", userReference)
            .get();

        if (restaurantDocs.empty) {
            return {
                success: false,
                reason: `User with id ${userId} does not have an associated restaurant.`
            }
        }

        const restaurant = restaurantDocs.docs[0];

        const updatedRestaurantData = data as RestaurantData;

        // Is the updated restaurant data valid?
        const restaurantDataValidationResult = validateRestaurantData(updatedRestaurantData);
        if (!restaurantDataValidationResult.isValid()) {
            console.log(`Restaurant data failed validation:`);
            const reasons = restaurantDataValidationResult.validationFailureReasons;
            for (const reason of reasons) {
                console.log(`- ${reason}`);
            }

            return {
                success: false,
                reason: reasons[0] // Just return the first reason
            }
        }

        // Updated data is valid, so let's update the document
        const restaurantReference = db.collection("restaurants").doc(restaurant.id);
        await restaurantReference.set(updatedRestaurantData, { merge: true });

        return {
            success: true
        }
    }
)