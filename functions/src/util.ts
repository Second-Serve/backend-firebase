import { getFirestore, DocumentData, DocumentReference } from 'firebase-admin/firestore';

export const getUserById = async (userId: string): Promise<DocumentData> => {
    return getDocumentById("users", userId);
}

export const getRestaurantById = async (restaurantId: string): Promise<DocumentData> => {
    return getDocumentById("restaurants", restaurantId);
}

export const getDocumentById = async (collection: string, id: string): Promise<DocumentData> => {
    const db = getFirestore();
    const document = await db.collection(collection)
        .doc(id)
        .get();

    if (!document.exists) {
        throw new Error(`Document in collection '${collection}' with id ${id} does not exist.`);
    }

    const data = document.data();
    if (!data) {
        throw new Error(`Document in collection '${collection}' with id ${id} does not have any associated data.`);
    }
    return data;
}

export const getRestaurantByUserId = async (userId: string): Promise<DocumentData> => {
    const db = getFirestore();
    const userDoc = await db.collection("users")
        .doc(userId)
        .get();
    
    if (!userDoc.exists) {
        throw new Error(`User with id ${userId} does not exist.`);
    }

    const userData = userDoc.data();
    if (!userData) {
        throw new Error(`User with id ${userId} does not have any associated data.`);
    }

    if (userData.account_type != "business") {
        throw new Error(`User with id ${userId} is not a business account.`);
    }

    if (!userData.restaurant) {
        throw new Error(`User with id ${userId} does not have an associated restaurant.`);
    }

    const userRestaurantReference: DocumentReference = userData.restaurant;
    const userRestaurantDoc: DocumentData = await userRestaurantReference.get();
    if (!userRestaurantDoc.exists) {
        throw new Error(`Restaurant associated with user with id ${userId} does not exist in the database.`);
    }

    const userRestaurantDocData: DocumentData[string] = userRestaurantDoc.data();
    if (!userRestaurantDocData) {
        throw new Error(`Restaurant with id ${userRestaurantReference.id} does not have any associated data.`);
    }

    return userRestaurantDoc;
}