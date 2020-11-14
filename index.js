/*
 * OK really should write a readme at this point
 */
/*
 * a hacky version of redux that works by just using hooks
 * but at a price of hours of getting it to work
 */

import { useState, useEffect, useMemo, useCallback } from "react"
// import every from "lodash/every";
import includes from "lodash/includes";
import each from "lodash/each";
import isObject from "lodash/isObject";
import getKeys from "lodash/keys";
import isUndefined from "lodash/isUndefined";
import isFunction from "lodash/isFunction";

const cloneDeep = require("rfdc")({proto: true, circles: true});

export default class Store {
  #store;
  #storeProxy;
  #storeKey;
  static customEventCnt = 0;
  static defaultOptions = {
    preventExtensions: false,
    useHooks: true,
    useEventListener: false,
    debugMode: false,
    immutable: true,
  };

  constructor(initValue = {}, inputOptions = Store.defaultOptions, key = null) {
    if (!isObject(initValue)) throw new Error(`[jStore] non-object value given to initValue`);
    const options = {...Store.defaultOptions, ...inputOptions};
    const keys = getKeys(initValue);

    this.#storeKey = key ? key : Store.customEventCnt++;
    if (options.debugMode) console.log(`[jStore debug {${this.#storeKey}}] making store with key ${this.#storeKey}`);

    const eventName = key ? key : `jStoreEvent-${this.#storeKey}`;

    this.#store = cloneDeep(initValue);

    this.#storeProxy = new Proxy(this.#store, {
      set: function (obj, prop, value) {
        if (options.debugMode) console.log(`[jStore debug] SET -`, {prop, value});
        if (options.preventExtensions && !includes(keys, prop)) {
          if (options.debugMode)
            console.log(`[jStore debug] SET fail - attempted to extend with preventExtensions true`);
          return true;
        }
        // console.log(obj, prop, value);
        //  checks
        obj[prop] = value;
        return true;
      },
      get: function (target, prop, receiver) {
        const obj = Reflect.get(...arguments);
        Store.optionalReturn(obj, options);
      },
    });

    this.updateStore = obj => {
      if (!isObject(obj)) return console.warn(`[jStore] Update ignored, not an object - ${obj}`);
      // merge(this.#storeProxy, obj);
      each(getKeys(obj), key => (this.#storeProxy[key] = obj[key]));
      Store.DispatchEvent(eventName);
      console.log("updateStore", eventName);
    };

    if (!options.useHooks) {
      this.createUseStore = () => throw new Error("[jStore] Hooks were not enabled, enable by setting 'useHooks' to true in options");
      return;
    } else {
      this.createUseStore = () => watch => {
        const [dummy, setDummy] = useState(false);
        const rerender = useCallback(() => setDummy(v => !v), [setDummy]);

        //  verify property to watch is valid
        useEffect(() => {
          if (!isUndefined(watch) && isUndefined(this.#store[watch]))
            throw new Error(`${watch} is not a watchable property`);
          const eventHandler = e => {
            //  prevent useless stuff from happening
            e.preventDefault();
            e.stopPropagation();
            rerender();
          };
          document.addEventListener(eventName, eventHandler);
          return () => document.removeEventListener(eventName, eventHandler);
        }, [watch, rerender]);

        const updateLayout = useCallback(obj => this.updateStore(obj), []);
        return useMemo(() => {
          return [Store.optionalReturn(watch ? this.#store[watch] : this.#store, options), updateLayout];
          //  ignored on purpose
          // eslint-disable-next-line
        }, [watch, dummy]);
      };
    }
    if (!options.useEventListener) {
      this.bindEvent = () =>
        throw new Error(
          `[jStore {${
            this.#storeKey
          }}] event listener were not enabled, enable by setting 'useEventListener' to true in options`
        );
      this.unbindEvent = () =>
        throw new Error(
          `[jStore ${
            this.#storeKey
          }] event listener were not enabled, enable by setting 'useEventListener' to true in options`
        );
    } else {
      this.bindEvent = handler => {
        if (!isFunction(handler)) throw new Error(`[jStore {${this.#storeKey}}] bindEvent needs a function input`);
        if (options.debugMode) console.log(`[jStore debug {${this.#storeKey}}] handler bound`);
        document.addEventListener(eventName, handler);
      };
      this.unbindEvent = handler => {
        if (!isFunction(handler)) throw new Error(`[jStore {${this.#storeKey}}] unbindEvent needs a function input`);
        if (options.debugMode) console.log(`[jStore debug {${this.#storeKey}}] handler unbound`);
        document.removeEventListener(eventName, handler);
      };
    }
  }

  set storeProxy(obj) {
    if (!isObject(obj)) return throw new Error(`[jStore] tried to SET store proxy with non-object`);
    this.updateStore(obj);
  }
  get storeProxy() {
    return this.#storeProxy;
  }
  get getStore() {
    return () => cloneDeep(this.#store);
  }

  //  event dispatcher
  static DispatchEvent(eventName) {
    const ev = new CustomEvent(eventName, {cancelable: true});
    document.dispatchEvent(ev);
  }

  //  return value with options applied
  static optionalReturn(value, options = this.defaultOptions) {
    if (!isObject(options)) return throw new Error(`[jStore] called optionalReturn with non-object options`);
    if (options.immutable) {
      if (isObject(value)) return Object.freeze(value);
      return value;
    }
    return value;
  }
}

// let customEventCnt = 0;
//
// const defaultOptions = {
// 	noChecks: false,
// 	immutable: false,
// 	preventExtensions: false,
// };
//
// //  legacy HOC approach
// const createStore(initObj, options = defaultOptions, key) {
// 	const layoutKeys = getKeys(initObj);
// 	const layout = cloneDeep(initObj);
// 	const eventName = key ? key : `jStoreEvent-${customEventCnt++}`;
// 	const layoutProxy = new Proxy(layout, {
// 		set: function (obj, prop, value) {
// 			obj[prop] = value;
// 			const ev = new CustomEvent(eventName);
// 			window.dispatchEvent(ev);
// 			return true;
// 		},
// 	});
//
// 	const updateProxy = obj => {
// 		if (options?.noChecks !== true) {
// 			if (!isObject(obj)) return console.warn(`[useStore] Update ignored, not an object - ${obj}`);
// 			const keys = getKeys(obj);
// 			if (!every(keys, key => includes(layoutKeys, key))) {
// 				console.warn(`[useStore] Update ignored, one or more keys not in layout`, keys);
// 				return;
// 			}
// 		}
// 		merge(layoutProxy, obj);
// 	};
// 	const useStore = watch => {
// 		const [dummy, setDummy] = useState(false);
// 		const rerender = useCallback(() => setDummy(v => !v), [setDummy]);
//
// 		//  verify property to watch is valid
// 		useEffect(() => {
// 			if (!isUndefined(watch) && isUndefined(layout[watch])) throw new Error(`${watch} is not a watchable property`);
// 			const eventHandler = () => rerender();
// 			window.addEventListener(eventName, eventHandler);
// 			return () => window.removeEventListener(eventName, eventHandler);
// 		}, [watch, rerender]);
//
// 		const updateLayout = useCallback(obj => updateProxy(obj), []);
// 		return useMemo(() => {
// 			return [watch ? layout[watch] : layout, updateLayout];
// 			//  ignored on purpose
// 			// eslint-disable-next-line react-hooks/exhaustive-deps
// 		}, [watch, dummy]);
// 	};
//
// 	return [useStore, () => layout, updateProxy];
// }
