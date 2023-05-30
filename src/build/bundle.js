
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var ui = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function append_styles(target, style_sheet_id, styles) {
        const append_styles_to = get_root_for_style(target);
        if (!append_styles_to.getElementById(style_sheet_id)) {
            const style = element('style');
            style.id = style_sheet_id;
            style.textContent = styles;
            append_stylesheet(append_styles_to, style);
        }
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
        return style.sheet;
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.50.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    // current active tab
    const activeTab = writable('swap');

    // current active menu
    const activeMenu = writable('color');

    /* src/components/Tab.svelte generated by Svelte v3.50.0 */
    const file = "src/components/Tab.svelte";

    function add_css(target) {
    	append_styles(target, "svelte-5eud6d", ".tab.svelte-5eud6d{padding:16px;display:flex;flex-direction:row;justify-content:center;gap:8px;color:#666666}.tab.svelte-5eud6d:hover{color:#172D2D;cursor:pointer;transition:all 500ms}.tab--state-active.svelte-5eud6d{color:#172D2D}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFiLnN2ZWx0ZSIsInNvdXJjZXMiOlsiVGFiLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICAgIGltcG9ydCB7IGFjdGl2ZVRhYiB9IGZyb20gXCIuLi9zdG9yZVwiO1xuICAgIGV4cG9ydCBsZXQgaXNBY3RpdmU7XG4gICAgZXhwb3J0IGxldCBuYW1lO1xuICAgIGV4cG9ydCBsZXQgaWQ7XG5cbiAgICAvLyBzZXQgY3VycmVudCB0YWJcbiAgICBmdW5jdGlvbiBvbkNsaWNrKCkge1xuICAgICAgICBhY3RpdmVUYWIuc2V0KGlkKVxuICAgIH1cbjwvc2NyaXB0PlxuXG48ZGl2XG4gICAgY2xhc3M9e2B0YWIgdGV4dC1zbS1tZWQgJHtcbiAgICAgICAgaXNBY3RpdmUgPyBcInRhYi0tc3RhdGUtYWN0aXZlXCIgOiBcInRhYlwiXG4gICAgfWB9XG4gICAgb246Y2xpY2s9e29uQ2xpY2t9XG4+XG4gICAge25hbWV9XG48L2Rpdj5cblxuPHN0eWxlPlxuICAgIC50YWIge1xuICAgICAgICBwYWRkaW5nOiAxNnB4O1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgIGNvbG9yOiAjNjY2NjY2O1xuICAgIH1cbiAgICAudGFiOmhvdmVyIHtcbiAgICAgICAgY29sb3I6ICMxNzJEMkQ7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgdHJhbnNpdGlvbjogYWxsIDUwMG1zO1xuICAgIH1cblxuICAgIC50YWItLXN0YXRlLWFjdGl2ZSB7XG4gICAgICAgIGNvbG9yOiAjMTcyRDJEO1xuICAgIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBc0JJLElBQUksY0FBQyxDQUFDLEFBQ0YsT0FBTyxDQUFFLElBQUksQ0FDYixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxNQUFNLENBQ3ZCLEdBQUcsQ0FBRSxHQUFHLENBQ1IsS0FBSyxDQUFFLE9BQU8sQUFDbEIsQ0FBQyxBQUNELGtCQUFJLE1BQU0sQUFBQyxDQUFDLEFBQ1IsS0FBSyxDQUFFLE9BQU8sQ0FDZCxNQUFNLENBQUUsT0FBTyxDQUNmLFVBQVUsQ0FBRSxHQUFHLENBQUMsS0FBSyxBQUN6QixDQUFDLEFBRUQsa0JBQWtCLGNBQUMsQ0FBQyxBQUNoQixLQUFLLENBQUUsT0FBTyxBQUNsQixDQUFDIn0= */");
    }

    function create_fragment(ctx) {
    	let div;
    	let t;
    	let div_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*name*/ ctx[1]);
    			attr_dev(div, "class", div_class_value = "" + (null_to_empty(`tab text-sm-med ${/*isActive*/ ctx[0] ? "tab--state-active" : "tab"}`) + " svelte-5eud6d"));
    			add_location(div, file, 12, 0, 208);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);

    			if (!mounted) {
    				dispose = listen_dev(div, "click", /*onClick*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 2) set_data_dev(t, /*name*/ ctx[1]);

    			if (dirty & /*isActive*/ 1 && div_class_value !== (div_class_value = "" + (null_to_empty(`tab text-sm-med ${/*isActive*/ ctx[0] ? "tab--state-active" : "tab"}`) + " svelte-5eud6d"))) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Tab', slots, []);
    	let { isActive } = $$props;
    	let { name } = $$props;
    	let { id } = $$props;

    	// set current tab
    	function onClick() {
    		activeTab.set(id);
    	}

    	const writable_props = ['isActive', 'name', 'id'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Tab> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('isActive' in $$props) $$invalidate(0, isActive = $$props.isActive);
    		if ('name' in $$props) $$invalidate(1, name = $$props.name);
    		if ('id' in $$props) $$invalidate(3, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({ activeTab, isActive, name, id, onClick });

    	$$self.$inject_state = $$props => {
    		if ('isActive' in $$props) $$invalidate(0, isActive = $$props.isActive);
    		if ('name' in $$props) $$invalidate(1, name = $$props.name);
    		if ('id' in $$props) $$invalidate(3, id = $$props.id);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [isActive, name, onClick, id];
    }

    class Tab extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { isActive: 0, name: 1, id: 3 }, add_css);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tab",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*isActive*/ ctx[0] === undefined && !('isActive' in props)) {
    			console.warn("<Tab> was created without expected prop 'isActive'");
    		}

    		if (/*name*/ ctx[1] === undefined && !('name' in props)) {
    			console.warn("<Tab> was created without expected prop 'name'");
    		}

    		if (/*id*/ ctx[3] === undefined && !('id' in props)) {
    			console.warn("<Tab> was created without expected prop 'id'");
    		}
    	}

    	get isActive() {
    		throw new Error("<Tab>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isActive(value) {
    		throw new Error("<Tab>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get name() {
    		throw new Error("<Tab>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Tab>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Tab>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Tab>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Tabbar.svelte generated by Svelte v3.50.0 */
    const file$1 = "src/components/Tabbar.svelte";

    function add_css$1(target) {
    	append_styles(target, "svelte-1k4kkje", ".tabbar.svelte-1k4kkje{display:flex;grid-gap:16px;border-bottom-style:solid;border-color:#ebebf0;border-width:1px;justify-items:center;align-items:center}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFiYmFyLnN2ZWx0ZSIsInNvdXJjZXMiOlsiVGFiYmFyLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICAgIGltcG9ydCBUYWIgZnJvbSBcIi4vVGFiLnN2ZWx0ZVwiO1xuICAgIGltcG9ydCB7YWN0aXZlVGFiIH0gZnJvbSAnLi4vc3RvcmUnXG5cbiAgICAvLyBzZXQgdGhlIGFjdGl2ZSB0YWJcbiAgICBsZXQgYWN0aXZlO1xuICAgIGFjdGl2ZVRhYi5zdWJzY3JpYmUodmFsdWUgPT4ge1xuICAgICAgICBhY3RpdmUgPSB2YWx1ZTtcbiAgICB9KVxuPC9zY3JpcHQ+XG5cbjxkaXYgY2xhc3M9XCJ0YWJiYXJcIj5cbiAgICA8VGFiIG5hbWU9e1wiUGFnZVwifSBpZD17XCJzd2FwXCJ9IGlzQWN0aXZlPXthY3RpdmUgPT0gXCJzd2FwXCJ9Lz5cbiAgICA8VGFiIG5hbWU9e1wiU2VsZWN0aW9uXCJ9IGlkPXtcImhpc3RvcnlcIn0gaXNBY3RpdmU9e2FjdGl2ZSA9PSBcImhpc3RvcnlcIn0vPlxuICAgIDxUYWIgbmFtZT17XCJDb25maWd1cmF0aW9uXCJ9IGlkPXtcImNvbmZpZ1wifSBpc0FjdGl2ZT17YWN0aXZlID09IFwiY29uZmlnXCJ9Lz5cbjwvZGl2PlxuXG48c3R5bGU+XG4gICAgLnRhYmJhciB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGdyaWQtZ2FwOiAxNnB4O1xuICAgICAgICBib3JkZXItYm90dG9tLXN0eWxlOiBzb2xpZDtcbiAgICAgICAgYm9yZGVyLWNvbG9yOiAjZWJlYmYwO1xuICAgICAgICBib3JkZXItd2lkdGg6IDFweDtcbiAgICAgICAganVzdGlmeS1pdGVtczogY2VudGVyO1xuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBa0JJLE9BQU8sZUFBQyxDQUFDLEFBQ0wsT0FBTyxDQUFFLElBQUksQ0FDYixRQUFRLENBQUUsSUFBSSxDQUNkLG1CQUFtQixDQUFFLEtBQUssQ0FDMUIsWUFBWSxDQUFFLE9BQU8sQ0FDckIsWUFBWSxDQUFFLEdBQUcsQ0FDakIsYUFBYSxDQUFFLE1BQU0sQ0FDckIsV0FBVyxDQUFFLE1BQU0sQUFDdkIsQ0FBQyJ9 */");
    }

    function create_fragment$1(ctx) {
    	let div;
    	let tab0;
    	let t0;
    	let tab1;
    	let t1;
    	let tab2;
    	let current;

    	tab0 = new Tab({
    			props: {
    				name: "Page",
    				id: "swap",
    				isActive: /*active*/ ctx[0] == "swap"
    			},
    			$$inline: true
    		});

    	tab1 = new Tab({
    			props: {
    				name: "Selection",
    				id: "history",
    				isActive: /*active*/ ctx[0] == "history"
    			},
    			$$inline: true
    		});

    	tab2 = new Tab({
    			props: {
    				name: "Configuration",
    				id: "config",
    				isActive: /*active*/ ctx[0] == "config"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(tab0.$$.fragment);
    			t0 = space();
    			create_component(tab1.$$.fragment);
    			t1 = space();
    			create_component(tab2.$$.fragment);
    			attr_dev(div, "class", "tabbar svelte-1k4kkje");
    			add_location(div, file$1, 11, 0, 205);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(tab0, div, null);
    			append_dev(div, t0);
    			mount_component(tab1, div, null);
    			append_dev(div, t1);
    			mount_component(tab2, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const tab0_changes = {};
    			if (dirty & /*active*/ 1) tab0_changes.isActive = /*active*/ ctx[0] == "swap";
    			tab0.$set(tab0_changes);
    			const tab1_changes = {};
    			if (dirty & /*active*/ 1) tab1_changes.isActive = /*active*/ ctx[0] == "history";
    			tab1.$set(tab1_changes);
    			const tab2_changes = {};
    			if (dirty & /*active*/ 1) tab2_changes.isActive = /*active*/ ctx[0] == "config";
    			tab2.$set(tab2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tab0.$$.fragment, local);
    			transition_in(tab1.$$.fragment, local);
    			transition_in(tab2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tab0.$$.fragment, local);
    			transition_out(tab1.$$.fragment, local);
    			transition_out(tab2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(tab0);
    			destroy_component(tab1);
    			destroy_component(tab2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Tabbar', slots, []);
    	let active;

    	activeTab.subscribe(value => {
    		$$invalidate(0, active = value);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Tabbar> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Tab, activeTab, active });

    	$$self.$inject_state = $$props => {
    		if ('active' in $$props) $$invalidate(0, active = $$props.active);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [active];
    }

    class Tabbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {}, add_css$1);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tabbar",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/components/Menu/First.svelte generated by Svelte v3.50.0 */

    const file$2 = "src/components/Menu/First.svelte";

    function add_css$2(target) {
    	append_styles(target, "svelte-u61s2u", ".first.svelte-u61s2u{padding:12px 16px;color:#121212;text-align:left}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRmlyc3Quc3ZlbHRlIiwic291cmNlcyI6WyJGaXJzdC5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdCA+XG4gICAgZXhwb3J0IGxldCBuYW1lO1xuPC9zY3JpcHQ+XG5cbjxkaXYgY2xhc3M9XCJ0ZXh0LXNtLW1lZCBmaXJzdFwiPntuYW1lfTwvZGl2PlxuXG48c3R5bGU+XG4gICAgLmZpcnN0IHtcbiAgICAgICAgcGFkZGluZzogMTJweCAxNnB4O1xuICAgICAgICBjb2xvcjogIzEyMTIxMjtcbiAgICAgICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgICB9XG48L3N0eWxlPiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFPSSxNQUFNLGNBQUMsQ0FBQyxBQUNKLE9BQU8sQ0FBRSxJQUFJLENBQUMsSUFBSSxDQUNsQixLQUFLLENBQUUsT0FBTyxDQUNkLFVBQVUsQ0FBRSxJQUFJLEFBQ3BCLENBQUMifQ== */");
    }

    function create_fragment$2(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*name*/ ctx[0]);
    			attr_dev(div, "class", "text-sm-med first svelte-u61s2u");
    			add_location(div, file$2, 4, 0, 42);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t, /*name*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('First', slots, []);
    	let { name } = $$props;
    	const writable_props = ['name'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<First> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({ name });

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name];
    }

    class First extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { name: 0 }, add_css$2);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "First",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !('name' in props)) {
    			console.warn("<First> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<First>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<First>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Menu/Second.svelte generated by Svelte v3.50.0 */

    const { console: console_1 } = globals;
    const file$3 = "src/components/Menu/Second.svelte";

    function add_css$3(target) {
    	append_styles(target, "svelte-867s0j", ".second.svelte-867s0j{padding:12px 32px;color:#121212;text-align:left}.second--state-active.svelte-867s0j{background-color:#E5F0E8}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2Vjb25kLnN2ZWx0ZSIsInNvdXJjZXMiOlsiU2Vjb25kLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICAgIGltcG9ydCB7IGFjdGl2ZU1lbnUgfSBmcm9tIFwiLi4vLi4vc3RvcmVcIjtcbiAgICBleHBvcnQgbGV0IGlzQWN0aXZlO1xuICAgIGV4cG9ydCBsZXQgbmFtZTtcbiAgICBleHBvcnQgbGV0IGlkO1xuXG4gICAgLy8gc2V0IGN1cnJlbnQgbWVudVxuICAgIGZ1bmN0aW9uIG9uQ2xpY2soKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ2xpY2tcIilcbiAgICAgICAgYWN0aXZlTWVudS5zZXQoaWQpO1xuICAgIH1cbjwvc2NyaXB0PlxuXG48ZGl2XG4gICAgY2xhc3M9e2BzZWNvbmQgdGV4dC1zbS1yZWcgJHtpc0FjdGl2ZSA/IFwic2Vjb25kLS1zdGF0ZS1hY3RpdmVcIiA6IFwibm90XCJ9YH1cbiAgICBvbjpjbGljaz17b25DbGlja31cbj5cbiAgICB7bmFtZX1cbjwvZGl2PlxuXG48c3R5bGU+XG4gICAgLnNlY29uZCB7XG4gICAgICAgIHBhZGRpbmc6IDEycHggMzJweDtcbiAgICAgICAgY29sb3I6ICMxMjEyMTI7XG4gICAgICAgIHRleHQtYWxpZ246IGxlZnQ7XG4gICAgfVxuXG4gICAgLnNlY29uZC0tc3RhdGUtYWN0aXZlIHtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjojRTVGMEU4O1xuICAgIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBcUJJLE9BQU8sY0FBQyxDQUFDLEFBQ0wsT0FBTyxDQUFFLElBQUksQ0FBQyxJQUFJLENBQ2xCLEtBQUssQ0FBRSxPQUFPLENBQ2QsVUFBVSxDQUFFLElBQUksQUFDcEIsQ0FBQyxBQUVELHFCQUFxQixjQUFDLENBQUMsQUFDbkIsaUJBQWlCLE9BQU8sQUFDNUIsQ0FBQyJ9 */");
    }

    function create_fragment$3(ctx) {
    	let div;
    	let t;
    	let div_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*name*/ ctx[1]);
    			attr_dev(div, "class", div_class_value = "" + (null_to_empty(`second text-sm-reg ${/*isActive*/ ctx[0] ? "second--state-active" : "not"}`) + " svelte-867s0j"));
    			add_location(div, file$3, 13, 0, 244);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);

    			if (!mounted) {
    				dispose = listen_dev(div, "click", /*onClick*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 2) set_data_dev(t, /*name*/ ctx[1]);

    			if (dirty & /*isActive*/ 1 && div_class_value !== (div_class_value = "" + (null_to_empty(`second text-sm-reg ${/*isActive*/ ctx[0] ? "second--state-active" : "not"}`) + " svelte-867s0j"))) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Second', slots, []);
    	let { isActive } = $$props;
    	let { name } = $$props;
    	let { id } = $$props;

    	// set current menu
    	function onClick() {
    		console.log("Click");
    		activeMenu.set(id);
    	}

    	const writable_props = ['isActive', 'name', 'id'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Second> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('isActive' in $$props) $$invalidate(0, isActive = $$props.isActive);
    		if ('name' in $$props) $$invalidate(1, name = $$props.name);
    		if ('id' in $$props) $$invalidate(3, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({ activeMenu, isActive, name, id, onClick });

    	$$self.$inject_state = $$props => {
    		if ('isActive' in $$props) $$invalidate(0, isActive = $$props.isActive);
    		if ('name' in $$props) $$invalidate(1, name = $$props.name);
    		if ('id' in $$props) $$invalidate(3, id = $$props.id);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [isActive, name, onClick, id];
    }

    class Second extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { isActive: 0, name: 1, id: 3 }, add_css$3);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Second",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*isActive*/ ctx[0] === undefined && !('isActive' in props)) {
    			console_1.warn("<Second> was created without expected prop 'isActive'");
    		}

    		if (/*name*/ ctx[1] === undefined && !('name' in props)) {
    			console_1.warn("<Second> was created without expected prop 'name'");
    		}

    		if (/*id*/ ctx[3] === undefined && !('id' in props)) {
    			console_1.warn("<Second> was created without expected prop 'id'");
    		}
    	}

    	get isActive() {
    		throw new Error("<Second>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isActive(value) {
    		throw new Error("<Second>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get name() {
    		throw new Error("<Second>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Second>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Second>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Second>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Menu/Menu.svelte generated by Svelte v3.50.0 */
    const file$4 = "src/components/Menu/Menu.svelte";

    function create_fragment$4(ctx) {
    	let div2;
    	let div0;
    	let first0;
    	let t0;
    	let second0;
    	let t1;
    	let second1;
    	let t2;
    	let div1;
    	let first1;
    	let t3;
    	let second2;
    	let t4;
    	let second3;
    	let current;

    	first0 = new First({
    			props: { name: "Error", id: "error" },
    			$$inline: true
    		});

    	second0 = new Second({
    			props: {
    				name: "Color",
    				id: "color",
    				isActive: /*active*/ ctx[0] == "color"
    			},
    			$$inline: true
    		});

    	second1 = new Second({
    			props: {
    				name: "Font",
    				id: "font",
    				isActive: /*active*/ ctx[0] == "font"
    			},
    			$$inline: true
    		});

    	first1 = new First({
    			props: {
    				name: "Beta",
    				id: "beta",
    				isActive: /*active*/ ctx[0] == "beta"
    			},
    			$$inline: true
    		});

    	second2 = new Second({
    			props: {
    				name: "Frame",
    				id: "frame",
    				isActive: /*active*/ ctx[0] == "frame"
    			},
    			$$inline: true
    		});

    	second3 = new Second({
    			props: {
    				name: "Component",
    				id: "component",
    				isActive: /*active*/ ctx[0] == "component"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			create_component(first0.$$.fragment);
    			t0 = space();
    			create_component(second0.$$.fragment);
    			t1 = space();
    			create_component(second1.$$.fragment);
    			t2 = space();
    			div1 = element("div");
    			create_component(first1.$$.fragment);
    			t3 = space();
    			create_component(second2.$$.fragment);
    			t4 = space();
    			create_component(second3.$$.fragment);
    			add_location(div0, file$4, 14, 4, 272);
    			add_location(div1, file$4, 19, 4, 488);
    			add_location(div2, file$4, 13, 0, 262);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			mount_component(first0, div0, null);
    			append_dev(div0, t0);
    			mount_component(second0, div0, null);
    			append_dev(div0, t1);
    			mount_component(second1, div0, null);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			mount_component(first1, div1, null);
    			append_dev(div1, t3);
    			mount_component(second2, div1, null);
    			append_dev(div1, t4);
    			mount_component(second3, div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const second0_changes = {};
    			if (dirty & /*active*/ 1) second0_changes.isActive = /*active*/ ctx[0] == "color";
    			second0.$set(second0_changes);
    			const second1_changes = {};
    			if (dirty & /*active*/ 1) second1_changes.isActive = /*active*/ ctx[0] == "font";
    			second1.$set(second1_changes);
    			const first1_changes = {};
    			if (dirty & /*active*/ 1) first1_changes.isActive = /*active*/ ctx[0] == "beta";
    			first1.$set(first1_changes);
    			const second2_changes = {};
    			if (dirty & /*active*/ 1) second2_changes.isActive = /*active*/ ctx[0] == "frame";
    			second2.$set(second2_changes);
    			const second3_changes = {};
    			if (dirty & /*active*/ 1) second3_changes.isActive = /*active*/ ctx[0] == "component";
    			second3.$set(second3_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(first0.$$.fragment, local);
    			transition_in(second0.$$.fragment, local);
    			transition_in(second1.$$.fragment, local);
    			transition_in(first1.$$.fragment, local);
    			transition_in(second2.$$.fragment, local);
    			transition_in(second3.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(first0.$$.fragment, local);
    			transition_out(second0.$$.fragment, local);
    			transition_out(second1.$$.fragment, local);
    			transition_out(first1.$$.fragment, local);
    			transition_out(second2.$$.fragment, local);
    			transition_out(second3.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(first0);
    			destroy_component(second0);
    			destroy_component(second1);
    			destroy_component(first1);
    			destroy_component(second2);
    			destroy_component(second3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Menu', slots, []);
    	let active;

    	activeMenu.subscribe(value => {
    		$$invalidate(0, active = value);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Menu> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ First, Second, activeMenu, active });

    	$$self.$inject_state = $$props => {
    		if ('active' in $$props) $$invalidate(0, active = $$props.active);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [active];
    }

    class Menu extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Menu",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/pages/Lint.svelte generated by Svelte v3.50.0 */

    function create_fragment$5(ctx) {
    	let menu;
    	let current;
    	menu = new Menu({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(menu.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(menu, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(menu, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Lint', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Lint> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Menu });
    	return [];
    }

    class Lint extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Lint",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/PluginUI.svelte generated by Svelte v3.50.0 */
    const file$5 = "src/PluginUI.svelte";

    function add_css$4(target) {
    	append_styles(target, "svelte-kczk98", "@import url(\"https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&display=swap\");body{font:12px \"Libre Franklin\", \"cursive\";font-family:\"Libre Franklin\", \"cursive\";text-align:center;margin:0;background-color:white}.text-sm-reg{font:12px \"Libre Franklin\";font-weight:400}.text-sm-med{font:12px \"Libre Franklin\";font-weight:500}.text-md-reg{font:14px \"Libre Franklin\";font-weight:400}.text-md-med{font:14px \"Libre Franklin\";font-weight:500}.text-lg-med{font:16px \"Libre Franklin\";font-weight:500}.text-lg-semibold{font:16px \"Libre Franklin\";font-weight:600}.text-xl-semibold{font:18px \"Libre Franklin\";font-weight:600}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGx1Z2luVUkuc3ZlbHRlIiwic291cmNlcyI6WyJQbHVnaW5VSS5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cblx0aW1wb3J0IFRhYmJhciBmcm9tIFwiLi9jb21wb25lbnRzL1RhYmJhci5zdmVsdGVcIjtcblx0aW1wb3J0IExpbnQgZnJvbSBcIi4vcGFnZXMvTGludC5zdmVsdGVcIjtcblxuXHRmdW5jdGlvbiBjcmVhdGVTaGFwZXMoKSB7XG5cdFx0cGFyZW50LnBvc3RNZXNzYWdlKFxuXHRcdFx0e1xuXHRcdFx0XHRwbHVnaW5NZXNzYWdlOiB7XG5cdFx0XHRcdFx0dHlwZTogXCJjcmVhdGUtc2hhcGVzXCIsXG5cdFx0XHRcdFx0Y291bnQ6IGNvdW50LFxuXHRcdFx0XHRcdHNoYXBlOiBzZWxlY3RlZFNoYXBlLnZhbHVlLFxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdFwiKlwiXG5cdFx0KTtcblx0fVxuXG5cdGZ1bmN0aW9uIGNhbmNlbCgpIHtcblx0XHRwYXJlbnQucG9zdE1lc3NhZ2UoeyBwbHVnaW5NZXNzYWdlOiB7IHR5cGU6IFwiY2FuY2VsXCIgfSB9LCBcIipcIik7XG5cdH1cbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwiXCI+XG5cdDxUYWJiYXIgLz5cblx0PExpbnQgLz5cbjwvZGl2PlxuXG48c3R5bGUgZ2xvYmFsPlxuXHRAaW1wb3J0IHVybChcImh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzMj9mYW1pbHk9TGlicmUrRnJhbmtsaW46d2dodEA0MDA7NTAwOzYwMDs3MDAmZGlzcGxheT1zd2FwXCIpO1xuXG5cdC8qIEJvZHkgU3RydWN0dXJlcyAqL1xuXHQ6Z2xvYmFsKGJvZHkpIHtcblx0XHRmb250OiAxMnB4IFwiTGlicmUgRnJhbmtsaW5cIiwgXCJjdXJzaXZlXCI7XG5cdFx0Zm9udC1mYW1pbHk6IFwiTGlicmUgRnJhbmtsaW5cIiwgXCJjdXJzaXZlXCI7XG5cdFx0dGV4dC1hbGlnbjogY2VudGVyO1xuXHRcdG1hcmdpbjogMDtcblx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTtcblx0fVxuXG5cdC8qIFRleHQgKi9cblx0Omdsb2JhbCgudGV4dC1zbS1yZWcpIHtcblx0XHRmb250OiAxMnB4IFwiTGlicmUgRnJhbmtsaW5cIjtcblx0XHRmb250LXdlaWdodDogNDAwO1xuXHR9XG5cblx0Omdsb2JhbCgudGV4dC1zbS1tZWQpIHtcblx0XHRmb250OiAxMnB4IFwiTGlicmUgRnJhbmtsaW5cIjtcblx0XHRmb250LXdlaWdodDogNTAwO1xuXHR9XG5cblx0Omdsb2JhbCgudGV4dC1tZC1yZWcpIHtcblx0XHRmb250OiAxNHB4IFwiTGlicmUgRnJhbmtsaW5cIjtcblx0XHRmb250LXdlaWdodDogNDAwO1xuXHR9XG5cblx0Omdsb2JhbCgudGV4dC1tZC1tZWQpIHtcblx0XHRmb250OiAxNHB4IFwiTGlicmUgRnJhbmtsaW5cIjtcblx0XHRmb250LXdlaWdodDogNTAwO1xuXHR9XG5cblx0Omdsb2JhbCgudGV4dC1sZy1tZWQpIHtcblx0XHRmb250OiAxNnB4IFwiTGlicmUgRnJhbmtsaW5cIjtcblx0XHRmb250LXdlaWdodDogNTAwO1xuXHR9XG5cblx0Omdsb2JhbCgudGV4dC1sZy1zZW1pYm9sZCkge1xuXHRcdGZvbnQ6IDE2cHggXCJMaWJyZSBGcmFua2xpblwiO1xuXHRcdGZvbnQtd2VpZ2h0OiA2MDA7XG5cdH1cblxuXHQ6Z2xvYmFsKC50ZXh0LXhsLXNlbWlib2xkKSB7XG5cdFx0Zm9udDogMThweCBcIkxpYnJlIEZyYW5rbGluXCI7XG5cdFx0Zm9udC13ZWlnaHQ6IDYwMDtcblx0fVxuXHQvKiBBZGQgYWRkaXRpb25hbCBnbG9iYWwgb3Igc2NvcGVkIHN0eWxlcyBoZXJlICovXG48L3N0eWxlPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQTRCQyxRQUFRLElBQUksMkZBQTJGLENBQUMsQ0FBQyxBQUdqRyxJQUFJLEFBQUUsQ0FBQyxBQUNkLElBQUksQ0FBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxTQUFTLENBQ3RDLFdBQVcsQ0FBRSxnQkFBZ0IsQ0FBQyxDQUFDLFNBQVMsQ0FDeEMsVUFBVSxDQUFFLE1BQU0sQ0FDbEIsTUFBTSxDQUFFLENBQUMsQ0FDVCxnQkFBZ0IsQ0FBRSxLQUFLLEFBQ3hCLENBQUMsQUFHTyxZQUFZLEFBQUUsQ0FBQyxBQUN0QixJQUFJLENBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUMzQixXQUFXLENBQUUsR0FBRyxBQUNqQixDQUFDLEFBRU8sWUFBWSxBQUFFLENBQUMsQUFDdEIsSUFBSSxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0IsV0FBVyxDQUFFLEdBQUcsQUFDakIsQ0FBQyxBQUVPLFlBQVksQUFBRSxDQUFDLEFBQ3RCLElBQUksQ0FBRSxJQUFJLENBQUMsZ0JBQWdCLENBQzNCLFdBQVcsQ0FBRSxHQUFHLEFBQ2pCLENBQUMsQUFFTyxZQUFZLEFBQUUsQ0FBQyxBQUN0QixJQUFJLENBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUMzQixXQUFXLENBQUUsR0FBRyxBQUNqQixDQUFDLEFBRU8sWUFBWSxBQUFFLENBQUMsQUFDdEIsSUFBSSxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0IsV0FBVyxDQUFFLEdBQUcsQUFDakIsQ0FBQyxBQUVPLGlCQUFpQixBQUFFLENBQUMsQUFDM0IsSUFBSSxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0IsV0FBVyxDQUFFLEdBQUcsQUFDakIsQ0FBQyxBQUVPLGlCQUFpQixBQUFFLENBQUMsQUFDM0IsSUFBSSxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0IsV0FBVyxDQUFFLEdBQUcsQUFDakIsQ0FBQyJ9 */");
    }

    function create_fragment$6(ctx) {
    	let div;
    	let tabbar;
    	let t;
    	let lint;
    	let current;
    	tabbar = new Tabbar({ $$inline: true });
    	lint = new Lint({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(tabbar.$$.fragment);
    			t = space();
    			create_component(lint.$$.fragment);
    			attr_dev(div, "class", "");
    			add_location(div, file$5, 22, 0, 386);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(tabbar, div, null);
    			append_dev(div, t);
    			mount_component(lint, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tabbar.$$.fragment, local);
    			transition_in(lint.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tabbar.$$.fragment, local);
    			transition_out(lint.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(tabbar);
    			destroy_component(lint);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function createShapes() {
    	parent.postMessage(
    		{
    			pluginMessage: {
    				type: "create-shapes",
    				count,
    				shape: selectedShape.value
    			}
    		},
    		"*"
    	);
    }

    function cancel() {
    	parent.postMessage({ pluginMessage: { type: "cancel" } }, "*");
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PluginUI', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<PluginUI> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Tabbar, Lint, createShapes, cancel });
    	return [];
    }

    class PluginUI extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {}, add_css$4);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PluginUI",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    const app = new PluginUI({
    	target: document.body,
    });

    return app;

}());
