import {useCallback, useEffect, useMemo, useRef, useState} from "react";

import each from "lodash/each";
import includes from "lodash/includes";
import isArray from "lodash/isArray";
import isFunction from "lodash/isFunction";
import isNil from "lodash/isNil";
import isObject from "lodash/isObject";
import isUndefined from "lodash/isUndefined";
import getKeys from "lodash/keys";

//  this is dangerous in certain environments
import {deepFreeze} from "./utils";

//TODO
//  Create a custom event emitter
//  Choose which order events are called(first -> last or last -> first)

const cloneDeep = require("rfdc")({proto: true, circles: true});

//  because using document events doesn't work on SSG / SSR
const Emitter = require("events");
const EventEmitter = new Emitter();

//  virtually no limit for listeners
EventEmitter.setMaxListeners(Number.MAX_SAFE_INTEGER);

/**
 * @desc Store class
 * @namespace pstore
 */
export default class Store {
	#store;
	#storeProxy;
	#storeKey;
	#options;
	static customEventCnt = 0;
	static defaultOptions = {
		preventExtensions: false,
		debugMode: false,
		immutable: false,
		typeChecks: false,
		deepfreeze: false,
		deepCompare: false,
	};
	
	/**
	 * The contructor
	 * @param initValue {Object}
	 * @param key {String}
	 * @param inputOptions {Object}
	 * @namespace pstore.constructor
	 * @memberof pstore
	 */
	constructor(initValue = {}, key = null, inputOptions = Store.defaultOptions) {
		if (!isObject(initValue)) throw new Error(`[pStore] non-object value given to initValue`);
		const options = {...Store.defaultOptions, ...inputOptions};
		this.#options = options;
		//  force debugMode off on production
		if (process.env.NODE_ENV === "production" && options.debugMode) options.debugMode = false;
		
		const keys = getKeys(initValue);
		
		this.#storeKey = key ? key : Store.customEventCnt++;
		if (options.debugMode) console.log(`[pStore debug {${this.#storeKey}}] making store with key ${this.#storeKey}`);
		
		const eventName = key ? key : `pStoreEvent-${this.#storeKey}`;
		
		this.#store = cloneDeep(initValue);
		this.#storeProxy = new Proxy(this.#store, {
			set: function (obj, prop, value) {
				if (options.debugMode) console.log(`[pStore debug] SET -`, {prop, value});
				if (options.preventExtensions && !includes(keys, prop)) {
					if (options.debugMode)
						console.log(`[pStore debug] SET fail - attempted to extend with preventExtensions true`);
					return true;
				}
				if (options.typeChecks) {
					// TODO : fix this to be more human friendly(because js says null is a bloody object)
					if (typeof obj[prop] !== typeof value) {
						if (options.debugMode)
							console.log(
								`[pStore debug] SET fail - type mismatch, attempted to set ${prop} to {${typeof value}} when type was {${typeof obj[
									prop
									]}}`
							);
						return true;
					}
				}
				
				obj[prop] = value;
				return true;
			},
			get: function (target, prop, receiver) {
				const obj = Reflect.get(...arguments);
				return Store.optionalReturn(obj, options);
			},
		});
		
		/**
		 * @desc function that updates store
		 * @memberof pstore.constructor
		 * @method updateStore
		 * @type function
		 * @param obj
		 * @param targetKey
		 * @param updateOptions
		 */
		this.updateStore = (obj, targetKey, updateOptions = {callback: false, silent: false}) => {
			// for multiple updates with array
			if (isArray(obj)) {
				each(obj, paramArray => {
					if (!isArray(paramArray)) {
						console.warn(`[pStore {${this.#storeKey}} MultiUpdate] ignored, expected array of params -`, paramArray);
						return;
					}
					//  setting silent to true if options exist
					const silentObj = {silent: true};
					if (paramArray.length === 3) {
						if (!isObject(paramArray[2])) {
							if (options.debugMode)
								console.warn(
									`[pStore debug {${this.#storeKey}} MultiUpdate] options was not an object - overwriting -`,
									paramArray
								);
							paramArray[2] = {silent: true};
						} else {
							const newOptions = {...paramArray.pop(), ...silentObj};
							paramArray.push(newOptions);
						}
					} else if (paramArray.length === 2) {
						paramArray.push(silentObj);
					} else if (paramArray.length === 1) {
						paramArray.push(null, silentObj);
					}
					this.updateStore(...paramArray);
				});
				//  make sure above has finished?...
				setTimeout(() => {
					// TODO
					//  pick out which keys are updated and make array, switch out keys
					//  currently all keys are updated
					if (!updateOptions.silent) Store.DispatchEvent(eventName, keys);
				}, 0);
				return;
			}
			
			//  actual update logic
			let updateKeys;
			if (!isObject(obj) && isNil(targetKey))
				return console.warn(
					`[pStore {${this.#storeKey}}] Update ignored, not an object and targetKey undefined - ${obj}`
				);
			if (isNil(targetKey)) {
				// merge(this.#storeProxy, obj);
				updateKeys = getKeys(obj);
				each(updateKeys, key => (this.#storeProxy[key] = obj[key]));
			}
				//  single updates
				//  update by callback
				// Dev notes - if you're resorting to using this with complicated logic,
				// it is probably recommended to use Redux
			// return undefined to cancel
			else if (updateOptions?.callback === true) {
				if (isFunction(obj)) {
					const curValue = cloneDeep(this.#store[targetKey]);
					let newValue;
					try {
						newValue = obj(curValue);
					} catch (ex) {
						console.warn(`[pStore {${this.#storeKey}}] Exception occurred while updating by callback - {${targetKey}}`);
						console.log(obj);
					}
					if (isUndefined(newValue)) return;
					this.#storeProxy[targetKey] = newValue;
					updateKeys = [targetKey];
				}
			}
			//  update by key
			else {
				if (isObject(targetKey) || !includes(keys, targetKey))
					return console.warn(`[pStore {${this.#storeKey}}] Update ignored, targetKey was not found - ${targetKey}`);
				
				// TODO
				//  currently merges by default, might also have options for different behaviour in the future
				this.#storeProxy[targetKey] = {...this.#store[targetKey], ...obj};
				updateKeys = [targetKey];
			}
			if (!updateOptions.silent) Store.DispatchEvent(eventName, updateKeys);
		};
		/**
		 * @desc create useStore hook for React
		 * @memberof pstore.constructor
		 * @type function
		 * @returns {function(*=): unknown}
		 */
		this.createUseStore = () => watch => {
			const [dummy, setDummy] = useState(false);
			const rerender = useCallback(() => setDummy(v => !v), [setDummy]);
			
			//  verify property to watch is valid
			useEffect(() => {
				if (watch === "") return; //  ignore updating logic if watch is empty string
				if (!isUndefined(watch) && isUndefined(this.#store[watch]))
					throw new Error(`${watch} is not a watchable property`);
				const eventHandler = keys => {
					//  if edited keys are not being watched, don't rerender
					if (watch && !includes(keys, watch)) return;
					rerender();
				};
				EventEmitter.on(eventName, eventHandler);
				return () => {
					EventEmitter.removeListener(eventName, eventHandler);
				};
			}, [watch, rerender]);
			
			// const updateLayout = useCallback((...params) => this.updateStore(...params), []);
			return useMemo(() => {
				if (watch === "") return this.updateStore;
				return [Store.optionalReturn(watch ? this.#store[watch] : this.#store, options), this.updateStore];
				//  ignored on purpose
				// eslint-disable-next-line
			}, [watch, dummy]);
			
			// //  deep compare with last value for changes
			// const prevValue = usePrevious(retValue);
			// const isNew = this.#options.deepCompare ? deepEqual(retValue, prevValue) : null;
			//
			// return useMemo(() => {
			// 	return retValue;
			// }, [retValue, isNew]);
		};
		//  bindable events for non-react savvy users
		this.bindEvent = handler => {
			if (!isFunction(handler)) throw new Error(`[pStore {${this.#storeKey}}] bindEvent needs a function input`);
			if (options.debugMode) console.log(`[pStore debug {${this.#storeKey}}] handler bound`);
			
			EventEmitter.on(eventName, handler);
		};
		this.unbindEvent = handler => {
			if (!isFunction(handler)) throw new Error(`[pStore {${this.#storeKey}}] unbindEvent needs a function input`);
			if (options.debugMode) console.log(`[pStore debug {${this.#storeKey}}] handler unbound`);
			EventEmitter.removeListener(eventName, handler);
		};
		this.getValue = this.getValue.bind(this);
	}
	
	//  get the storeProxy itself if you know what you're doing
	/**
	 * @method storeProxy
	 * @type function
	 * @memberof pstore
	 * @returns {object}
	 */
	get storeProxy() {
		return this.#storeProxy;
	}
	
	//  safe public get store
	/**
	 * @method getStore
	 * @type function
	 * @memberof pstore
	 * @returns {function(): *|Date|{}}
	 */
	get getStore() {
		return () => Store.optionalReturn(this.#store, this.#options);
	}
	
	//  private unsafe get store
	get _getStore() {
		return this.#store;
	}
	
	/**
	 * @desc returns target value from key
	 * @method getValue
	 * @type function
	 * @param key {{string}|{array}}
	 * @returns {{}|null|*}
	 */
	getValue(key) {
		//  because of private member limitations
		if (isArray(key)) {
			const obj = {};
			each(key, value => {
				obj[value] = this.getValue(value);
			});
			return obj;
		}
		if (isObject(key)) {
			console.warn(`[pStore {${this.#storeKey}}] key was object on getValue, returning null`);
			return null;
		}
		const store = this._getStore;
		if (isUndefined(store[key])) {
			console.warn(`[pStore {${this.#storeKey}}] key not found, returning null for key[${key}]`);
			return null;
		}
		if (isObject(store[key])) return cloneDeep(store[key]);
		return store[key];
	}
	
	//  event dispatcher
	static DispatchEvent(eventName, keys) {
		// console.log("event emit - ", eventName);
		EventEmitter.emit(eventName, keys);
	}
	
	//  return value with options applied
	static optionalReturn(value, options = this.defaultOptions) {
		if (!isObject(options)) return throw new Error(`[pStore] called optionalReturn with non-object options`);
		if (options.immutable) {
			if (isObject(value)) return cloneDeep(value);
			return value;
		} else if (options.deepfreeze) {
			if (isObject(value)) return deepFreeze(value);
			return value;
		}
		return value;
	}
}

const usePrevious = value => {
	const ref = useRef();
	
	useEffect(() => {
		ref.current = value;
	}, [value]);
	
	return ref.current;
};
