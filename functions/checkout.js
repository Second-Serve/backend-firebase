// const functions = require('firebase-functions/v1');
// const admin = require('firebase-admin');
// const { getFirestore } = require('firebase-admin/firestore');

exports.placeOrder = functions.https.onCall(
    async (request, response) => {
        const data = await new Promise((resolve, reject) => {
            const db = getFirestore();
            const orderItemsData = request.data.items;
            const items = [];
            for (const item of orderItemsData) {
                const itemJson = {
                    restaurant: db.doc(`restaurants/${item.restaurantId}`),
                    quantity: item.quantity
                }
                items.push(itemJson)
            }

            const order = db.collection('orders').doc();
            const userId = request.auth.uid;
            order.set({
                for: db.doc(`users/${userId}`),
                items: items
            }).then(() => {
                resolve({
                    success: true
                });
            }).catch((error) => {
                reject({
                    success: false,
                    error: error.message
                });
            });
        });
        return data;
    }
);