import { getFirestore, DocumentData } from 'firebase-admin/firestore';

export const getRestaurantById = async (restaurantId: string): Promise<DocumentData> => {
    const db = getFirestore();
    const restaurantDoc = await db.collection("restaurants")
        .doc(restaurantId)
        .get();

    if (!restaurantDoc.exists) {
        throw new Error(`Restaurant with id ${restaurantId} does not exist.`);
    }

    const restaurantData = restaurantDoc.data();
    if (!restaurantData) {
        throw new Error(`Restaurant with id ${restaurantId} does not have data.`);
    }
    return restaurantData;
}