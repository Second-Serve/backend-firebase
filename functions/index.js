const { initializeApp } = require('firebase-admin/app');

initializeApp();

const accounts = require('./src/accounts');
exports.createAccount = accounts.createAccount;
exports.deleteAccount = accounts.deleteAccount;
exports.deleteAuthAccount = accounts.deleteAuthAccount;
exports.createRestaurant = accounts.createRestaurant;
exports.verifyCampusID = accounts.verifyCampusID;

const maps = require('./src/maps');
exports.isAddressValid = maps.isAddressValid;
exports.geocodeAddress = maps.geocodeAddress;
exports.distanceToRestaurant = maps.distanceToRestaurant

const checkout = require('./src/checkout');
exports.placeOrder = checkout.placeOrder;