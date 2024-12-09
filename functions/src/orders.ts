import * as functions from 'firebase-functions/v1';
import { AggregateField, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getRestaurantById, getUserById } from './util';

interface OrderItem {
    restaurantId: string
    quantity: number
}

interface OrderToPlace {
    for: string // User ID
    items: OrderItem[]
}

export const placeOrder = functions.https.onCall(
    async (data, context) => {
        const responseData = await new Promise(async (resolve, reject) => {
            const userId = context.auth?.uid;
            if (!userId) {
                reject(new Error("User is not authenticated."));
                return;
            }

            const db = getFirestore();
            const order = data as OrderToPlace;
            const orderItemsData = order.items;

            const items = [];
            const now = Timestamp.now();
            let totalPrice = 0;
            for (const item of orderItemsData) {
                const restaurant = await getRestaurantById(item.restaurantId);
                const price = restaurant.bag_price * item.quantity;
                const itemJson = {
                    restaurant: db.doc(`restaurants/${item.restaurantId}`),
                    quantity: item.quantity,
                    price: price,
                    createdAt: now // Field duplication, but it makes some queries significantly faster
                }
                items.push(itemJson);
                totalPrice += price;
            }

            const orderDocument = db.collection('orders').doc();
            orderDocument.set({
                for: db.doc(`users/${userId}`),
                totalPrice: totalPrice,
                createdAt: now,
                fulfilled: false
            });

            // Add order item documents to subcollection
            const batch = db.batch();
            const itemsRef = orderDocument.collection('items');
            for (const item of items) {
                batch.set(itemsRef.doc(), item);
            }
            await batch.commit();

            resolve({ success: true });
        });
        return responseData;
    }
);

export const getRestaurantDashboardInformation = functions.https.onCall(
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
        const userDoc = db.collection("users").doc(userId);

        const restaurantDocs = await db.collection("restaurants")
            .where("owner", "==", userDoc)
            .get();
        if (restaurantDocs.size == 0) {
            return {
                success: false,
                reason: `User with id ${userId} does not have an associated restaurant.`
            }
        }

        const restaurant = restaurantDocs.docs[0];
        const restaurantDoc = db.collection("restaurants").doc(restaurant.id)

        const itemsQuery = db.collectionGroup("items")
            .where("restaurant", "==", restaurantDoc)
        
        const now = Timestamp.now();
        const oneDayAgo = new Timestamp(now.seconds - 86400, now.nanoseconds); // 86400 seconds = 24 hours
        const itemsLast24HoursQuery = itemsQuery
            .where("createdAt", ">=", oneDayAgo)

        const dataLast24HoursQuery = itemsLast24HoursQuery.aggregate({
            ordersLast24Hours: AggregateField.count(),
            earningsLast24Hours: AggregateField.sum("price")
        });
        const dataLast24HoursSnapshot = await dataLast24HoursQuery.get();

        const totalDataQuery = itemsQuery.aggregate({
            ordersAllTime: AggregateField.count(),
            earningsAllTime: AggregateField.sum("price")
        })
        const allTimeDataSnapshot = await totalDataQuery.get();

        const result = {
            success: true,
            ordersLast24Hours: dataLast24HoursSnapshot.data().ordersLast24Hours,
            earningsLast24Hours: dataLast24HoursSnapshot.data().earningsLast24Hours,
            ordersAllTime: allTimeDataSnapshot.data().ordersAllTime,
            earningsAllTime: allTimeDataSnapshot.data().earningsAllTime
        }
        return result;
    }
)