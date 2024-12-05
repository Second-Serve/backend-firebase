const { initializeApp } = require('firebase-admin/app');

initializeApp();

const accounts = require('./accounts');
exports.createAccount = accounts.createAccount;
exports.deleteAccount = accounts.deleteAccount;
exports.deleteAuthAccount = accounts.deleteAuthAccount;
exports.createRestaurant = accounts.createRestaurant;
exports.verifyCampusID = accounts.verifyCampusID;

const maps = require('./maps');
exports.isAddressValid = maps.isAddressValid;
exports.geocodeAddress = maps.geocodeAddress;

const checkout = require('./checkout');
exports.placeOrder = checkout.placeOrder;