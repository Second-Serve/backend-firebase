import { DocumentData } from "firebase-admin/firestore";

/**
 * NOTE: Only modifiable properties of a restaurant are represented here.
 * 
 * It's unfortunate that these properties have to be written in `snake_case` to match
 * their database counterparts. Oh well.
 */
export interface RestaurantData {
    address: string,
    bag_price: number | null,
    bags_available: number,
    name: string
}

export class RestaurantDataValidationResult {
    constructor(
        public validationFailureReasons: string[] = [],
        public isAddressValid: boolean | undefined = undefined,
        public isBagPriceValid: boolean | undefined = undefined,
        public isBagsAvailableValid: boolean | undefined = undefined,
        public isNameValid: boolean | undefined = undefined
    ) { }

    public isValid() {
        return (
            this.isAddressValid !== false
            && this.isBagPriceValid !== false
            && this.isBagsAvailableValid !== false
            && this.isNameValid !== false
        );
    }
}

const BAG_PRICE_MIN = 1.00;
const BAG_PRICE_MAX = 10_000.00;

const BAGS_AVAILABLE_MAX = 1_000;

const NAME_LENGTH_MIN = 3;
const NAME_LENGTH_MAX = 100;

/**
 * Validate the given restaurant data. For fields such as addresses, the validation is superficial
 * (i.e. it doesn't check that the address is well-formed or in Madison).
 * @param restaurantData The restaurant data to validate
 */
export const validateRestaurantData = (restaurantData: RestaurantData): RestaurantDataValidationResult => {
    const result = new RestaurantDataValidationResult();

    // Validate address if it is present
    if (restaurantData.address) {
        result.isAddressValid = true;

        // Address cannot be just whitespace
        if (restaurantData.address.trim().length == 0) {
            result.isAddressValid = false;
            result.validationFailureReasons.push("Address cannot be empty.");
        }
    }

    // Validate bag price if it is present
    if (restaurantData.bag_price) {
        result.isBagPriceValid = true;

        // Bag price cannot be less than the minimum
        if (restaurantData.bag_price < BAG_PRICE_MIN) {
            result.isBagPriceValid = false;
            result.validationFailureReasons.push(`Bag price cannot be less than $${BAG_PRICE_MIN}.`);
        }

        // Bag price cannot exceed than the maximum
        if (restaurantData.bag_price > BAG_PRICE_MAX) {
            result.isBagPriceValid = false;
            result.validationFailureReasons.push(`Bag price cannot exceed $${BAG_PRICE_MAX}.`);
        }
    }

    // Validate available bag count if it is present
    if (restaurantData.bags_available) {
        result.isBagsAvailableValid = true;

        // Available bag count must be an integer
        if (restaurantData.bags_available % 1 != 0) {
            result.isBagsAvailableValid = false;
            result.validationFailureReasons.push("Available bag count must be an integer.");
        }

        // Available bag count cannot be negative
        if (restaurantData.bags_available < 0) {
            result.isBagsAvailableValid = false;
            result.validationFailureReasons.push("Available bag count cannot be negative.");
        }

        // Available bag count cannot exceed the maximum
        if (restaurantData.bags_available > BAGS_AVAILABLE_MAX) {
            result.isBagsAvailableValid = false;
            result.validationFailureReasons.push(`Available bag count cannot exceed ${BAGS_AVAILABLE_MAX}.`);
        }
    }

    // Validate restaurant name if it is present
    if (restaurantData.name) {
        result.isNameValid = true;

        const nameTrimmed = restaurantData.name.trim();

        // Name minus whitespace cannot be less than the minimum length
        if (nameTrimmed.length < NAME_LENGTH_MIN) {
            result.isNameValid = false;
            result.validationFailureReasons.push(`Name must be at least ${NAME_LENGTH_MIN} characters long.`);
        }

        // Name minus whitespace cannot exceed the maximum length
        if (nameTrimmed.length > NAME_LENGTH_MAX) {
            result.isNameValid = false;
            result.validationFailureReasons.push(`Name cannot exceed ${NAME_LENGTH_MAX} characters.`);
        }
    }

    return result;
}

export const validateRestaurantDocument = (restaurantDocument: DocumentData): RestaurantDataValidationResult => {
    const restaurantData = restaurantDocument as RestaurantData;
    return validateRestaurantData(restaurantData);
}