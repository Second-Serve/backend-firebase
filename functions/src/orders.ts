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
            orderDocument.collection("items").add(items)
            resolve({ success: true });
        });
        return responseData;
    }
);

