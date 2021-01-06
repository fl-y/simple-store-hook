/**
 * @desc Store class
 * @namespace pstore
 */
export default class Store {
    static customEventCnt: number;
    static defaultOptions: {
        preventExtensions: boolean;
        debugMode: boolean;
        immutable: boolean;
        typeChecks: boolean;
        deepfreeze: boolean;
        deepCompare: boolean;
    };
    /**
     * The contructor
     * @param initValue {Object}
     * @param key {String}
     * @param inputOptions {Object}
     * @namespace pstore.constructor
     * @memberof pstore
     */
    constructor(initValue?: any, key?: string, inputOptions?: any);
    store: any;
    storeProxy: any;
    storeKey: any;
    options: any;
}
