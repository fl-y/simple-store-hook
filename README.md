
# pStore   
Global / local state management with js proxies, originally made for React hooks but can be used without.  
  
### Disclaimer  
This package was not intended to replace redux.  
If your project has any level of complex logic that is best stored globally,  
please use a more reliable global state management package which npm has a [plethora](https://www.npmjs.com/search?q=state) to offer.  

## How to use  
`npm install pstore`
`yarn install pstore`

### Setup
```javascript
// in "src/contexts/myStore";
import pStore from "pStore";
const initWallet = {  
  sideMenu: false,  
  preview: false,
  langauge: "eng",
};
//	these are the default options, any missing options will be merged with defaults.
const options = {
  preventExtensions: false,  // 	true to prevent store having extra properties after init.
  useHooks: true,	//	true to use hooks
  useEventListener: false,	//	true to use bindEvent, unbindEvent methods
  debugMode: false,	//	true for extra debugging info
  immutable: false,	//	true for frozen objects from store (always)
  typeChecks: false,  //	true to prevent attempts to switch store value to a different type(currently based on typeof, planning to expand features)
};
  
//	initStore, keyName(if not set, integer will be assigned), storeOptions
const myStore = new Store(initWallet, "myStore", options);  
//	pick needed methods
const [useMyStore, getMyState, getMyValue, updateMyStore, bindMyStore, unbindMyStore] = [  
	myStore.createUseStore(),  //	hook HOC. Only use once per store.
	myStore.getStore,	//	returns copy of current store frozen.
	myStore.getValue,	//	get any value from store 
	myStore.updateStore,
	myStore.bindEvent,
	myStore,unbindEvent
];
export {useMyStore, getMyState, getMyValue, updateMyStore, bindMyStore, unbindMyStore};
```  
### Usage example - hooks
```javascript
//	...your imports
import {useMyStore} from "src/contexts/MyStore";  
  
export default function Header() {  
	// const [myStore, updateStore] = useMyStore(); // keep empty to get entire object
	const [sideMenu, updateStore] = useMyStore("sideMenu");	//	use param name for single parameter
	//	component will only rerender when that parameter is changed
	return (
		<div>
			{sideMenu ? <div>sidemenu</div>}
		</div>
	)
}

// some other component
//...
import {useMyStore} from "src/contexts/MyStore";

export default function Something() {
	const updateMyStore = useMyStore("");	//	undefined to only use updateStore
	React.useEffect(() => {
		//	update using object
		updateMyStore({sideMenu: true});
		
		//	update specifing property
		updateMyStore(true, "sideMenu");
		
		//	update using callback -> function input will be value inside "sideMenu"
		updateMyStore(v => !v, "sideMenu", {callback: true});
		
		//	update silently, store value will by updated but values will not rerender
		//	NOT RECOMMENDED TO USE EVER. Unless you know. Reasons.(I made it so guess)
		updateMyStore({sideMenu: true}, null, {silent: true});
		
		//	multiple simultaneous updates, single re-render. 
		//	Will be applied synchronously in order of array. 
		//	Can make silent by using third parameter.
		//	specifing second parameter does nothing atm.
		updateMyStore([
			[{sideMenu:true}],	//	enter params like single update in array form
			[v => !v, "preview"]
		]);
	}, [updateMyStore]);
}
```

### Usage example - inside functions
```javascript
//	...imports
import {updateMyStore, getMyValue} from "src/contexts/MyStore";

function myFunctionThatIsFiftyFunctionsNestedFromAnyReactComponent () {
	//	update using object
	updateMyStore({sideMenu: true});
	//	exactly the same as the hook example actually :)
	
	const value = getMyValue("sideMenu")	//	returns null if key is not defined
}
```

### Usage example - events
By binding events you can watch value changes, but being a React developer, this has not been even used before.(as of writing)
Will add example when the occasion calls for it.

### Which project is this for  
- The main dev `hates / is not bothered to use` redux  
- Stores do not need multi-nested data updates.
- The dev is sick of keeping multiple files open to check app logic  
- The dev wishes to update global state anywhere in the app without 'function drilling' the store update function  
- Intuitive for simple use, minimal learning curve for semi-advanced use.  
- Not for advanced usage. Learn redux and it's mega-ecosystem  
- As of writing this readme, this package has not been battle-tested by any production-level use-cases so is not recommended for large-scale serious apps(yet)
- A co-worker finds Redux difficult to use and you agree(the origin story)


### Plans
- Optimizations for multi-updates
- Currently only merges with store by default. Add different merge options
- Remove events dependency with custom made event functionality
- User suggestions if this package gets traction.
- Write some test code
- Use [typescript](https://medium.com/javascript-scene/the-typescript-tax-132ff4cb175b)?