import { initializeApp } from 'firebase-admin/app';

initializeApp({
    storageBucket: "secondserve-fd53ceff.firebasestorage.app"
});

import * as accounts from './accounts';
exports.createAccount = accounts.createAccount;
exports.deleteAccount = accounts.deleteAccount;
exports.deleteAuthAccount = accounts.deleteAuthAccount;
exports.createRestaurant = accounts.createRestaurant;
exports.verifyCampusID = accounts.verifyCampusID;
exports.updateRestaurantInformation = accounts.updateRestaurantInformation;

import * as maps from './maps'
exports.isAddressValid = maps.isAddressValid;
exports.geocodeAddress = maps.geocodeAddress;
exports.distanceToRestaurant = maps.distanceToRestaurant
exports.getRestaurantMapImage = maps.getRestaurantMapImage

import * as orders from './orders'
exports.getOrders = orders.getOrders;
exports.placeOrder = orders.placeOrder;
exports.confirmOrderItem = orders.confirmOrderItem;
exports.getRestaurantDashboardInformation = orders.getRestaurantDashboardInformation