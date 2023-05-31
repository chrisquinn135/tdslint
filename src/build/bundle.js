
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var ui = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
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
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
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
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
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
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
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

    // current focus
    const activeFocus = writable(-1);

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
    	append_styles(target, "svelte-52k52l", ".tabbar.svelte-52k52l{display:flex;grid-gap:16px;border-bottom-style:solid;border-color:#d5d5d5;border-width:1px;justify-items:center;align-items:center}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFiYmFyLnN2ZWx0ZSIsInNvdXJjZXMiOlsiVGFiYmFyLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICAgIGltcG9ydCBUYWIgZnJvbSBcIi4vVGFiLnN2ZWx0ZVwiO1xuICAgIGltcG9ydCB7YWN0aXZlVGFiIH0gZnJvbSAnLi4vc3RvcmUnXG5cbiAgICAvLyBzZXQgdGhlIGFjdGl2ZSB0YWJcbiAgICBsZXQgYWN0aXZlO1xuICAgIGFjdGl2ZVRhYi5zdWJzY3JpYmUodmFsdWUgPT4ge1xuICAgICAgICBhY3RpdmUgPSB2YWx1ZTtcbiAgICB9KVxuPC9zY3JpcHQ+XG5cbjxkaXYgY2xhc3M9XCJ0YWJiYXJcIj5cbiAgICA8VGFiIG5hbWU9e1wiUGFnZVwifSBpZD17XCJzd2FwXCJ9IGlzQWN0aXZlPXthY3RpdmUgPT0gXCJzd2FwXCJ9Lz5cbiAgICA8VGFiIG5hbWU9e1wiU2VsZWN0aW9uXCJ9IGlkPXtcImhpc3RvcnlcIn0gaXNBY3RpdmU9e2FjdGl2ZSA9PSBcImhpc3RvcnlcIn0vPlxuICAgIDxUYWIgbmFtZT17XCJDb25maWd1cmF0aW9uXCJ9IGlkPXtcImNvbmZpZ1wifSBpc0FjdGl2ZT17YWN0aXZlID09IFwiY29uZmlnXCJ9Lz5cbjwvZGl2PlxuXG48c3R5bGU+XG4gICAgLnRhYmJhciB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGdyaWQtZ2FwOiAxNnB4O1xuICAgICAgICBib3JkZXItYm90dG9tLXN0eWxlOiBzb2xpZDtcbiAgICAgICAgYm9yZGVyLWNvbG9yOiAjZDVkNWQ1O1xuICAgICAgICBib3JkZXItd2lkdGg6IDFweDtcbiAgICAgICAganVzdGlmeS1pdGVtczogY2VudGVyO1xuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBa0JJLE9BQU8sY0FBQyxDQUFDLEFBQ0wsT0FBTyxDQUFFLElBQUksQ0FDYixRQUFRLENBQUUsSUFBSSxDQUNkLG1CQUFtQixDQUFFLEtBQUssQ0FDMUIsWUFBWSxDQUFFLE9BQU8sQ0FDckIsWUFBWSxDQUFFLEdBQUcsQ0FDakIsYUFBYSxDQUFFLE1BQU0sQ0FDckIsV0FBVyxDQUFFLE1BQU0sQUFDdkIsQ0FBQyJ9 */");
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
    			attr_dev(div, "class", "tabbar svelte-52k52l");
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
    	append_styles(target, "svelte-chzx9", ".first.svelte-chzx9{padding:12px 8px;color:#121212;text-align:left}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRmlyc3Quc3ZlbHRlIiwic291cmNlcyI6WyJGaXJzdC5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdCA+XG4gICAgZXhwb3J0IGxldCBuYW1lO1xuPC9zY3JpcHQ+XG5cbjxkaXYgY2xhc3M9XCJ0ZXh0LXNtLW1lZCBmaXJzdFwiPntuYW1lfTwvZGl2PlxuXG48c3R5bGU+XG4gICAgLmZpcnN0IHtcbiAgICAgICAgcGFkZGluZzogMTJweCA4cHg7XG4gICAgICAgIGNvbG9yOiAjMTIxMjEyO1xuICAgICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xuICAgIH1cbjwvc3R5bGU+Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQU9JLE1BQU0sYUFBQyxDQUFDLEFBQ0osT0FBTyxDQUFFLElBQUksQ0FBQyxHQUFHLENBQ2pCLEtBQUssQ0FBRSxPQUFPLENBQ2QsVUFBVSxDQUFFLElBQUksQUFDcEIsQ0FBQyJ9 */");
    }

    function create_fragment$2(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*name*/ ctx[0]);
    			attr_dev(div, "class", "text-sm-med first svelte-chzx9");
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

    /* src/components/Tag.svelte generated by Svelte v3.50.0 */

    const file$3 = "src/components/Tag.svelte";

    function add_css$3(target) {
    	append_styles(target, "svelte-1is2zsv", ".tag.svelte-1is2zsv{padding:2px 8px;background-color:#172D2D;color:#ffffff;border-radius:16px;align-self:center}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFnLnN2ZWx0ZSIsInNvdXJjZXMiOlsiVGFnLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICAgIGV4cG9ydCBsZXQgbnVtYmVyO1xuPC9zY3JpcHQ+XG5cbjxkaXYgY2xhc3M9XCJ0ZXh0LXNtLXJlZyB0YWdcIj57bnVtYmVyfTwvZGl2PlxuXG48c3R5bGU+XG4gICAgLnRhZyB7XG4gICAgICAgIHBhZGRpbmc6IDJweCA4cHg7XG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6ICMxNzJEMkQ7XG4gICAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgICBib3JkZXItcmFkaXVzOiAxNnB4O1xuICAgICAgICBhbGlnbi1zZWxmOiBjZW50ZXI7XG4gICAgfVxuPC9zdHlsZT4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBT0ksSUFBSSxlQUFDLENBQUMsQUFDRixPQUFPLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FDaEIsZ0JBQWdCLENBQUUsT0FBTyxDQUN6QixLQUFLLENBQUUsT0FBTyxDQUNkLGFBQWEsQ0FBRSxJQUFJLENBQ25CLFVBQVUsQ0FBRSxNQUFNLEFBQ3RCLENBQUMifQ== */");
    }

    function create_fragment$3(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*number*/ ctx[0]);
    			attr_dev(div, "class", "text-sm-reg tag svelte-1is2zsv");
    			add_location(div, file$3, 4, 0, 43);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*number*/ 1) set_data_dev(t, /*number*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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
    	validate_slots('Tag', slots, []);
    	let { number } = $$props;
    	const writable_props = ['number'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Tag> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('number' in $$props) $$invalidate(0, number = $$props.number);
    	};

    	$$self.$capture_state = () => ({ number });

    	$$self.$inject_state = $$props => {
    		if ('number' in $$props) $$invalidate(0, number = $$props.number);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [number];
    }

    class Tag extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { number: 0 }, add_css$3);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tag",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*number*/ ctx[0] === undefined && !('number' in props)) {
    			console.warn("<Tag> was created without expected prop 'number'");
    		}
    	}

    	get number() {
    		throw new Error("<Tag>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set number(value) {
    		throw new Error("<Tag>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Menu/Second.svelte generated by Svelte v3.50.0 */
    const file$4 = "src/components/Menu/Second.svelte";

    function add_css$4(target) {
    	append_styles(target, "svelte-cp81qn", ".second.svelte-cp81qn{padding:12px 16px;border-radius:8px;color:#666666;text-align:left;display:flex;justify-content:space-between;align-items:center}.second.svelte-cp81qn:hover{background-color:#F2F2F2;color:#121212;cursor:pointer;transition:all 100ms}.second--state-active.svelte-cp81qn{padding:12px 16px;border-radius:8px;color:#121212;text-align:left;display:flex;background-color:#E5F0E8;justify-content:space-between;align-items:center}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2Vjb25kLnN2ZWx0ZSIsInNvdXJjZXMiOlsiU2Vjb25kLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICAgIGltcG9ydCB7IGFjdGl2ZU1lbnUgfSBmcm9tIFwiLi4vLi4vc3RvcmVcIjtcbiAgICBpbXBvcnQgVGFnIGZyb20gXCIuLi9UYWcuc3ZlbHRlXCI7XG5cbiAgICBleHBvcnQgbGV0IGlzQWN0aXZlO1xuICAgIGV4cG9ydCBsZXQgbmFtZTtcbiAgICBleHBvcnQgbGV0IGlkO1xuICAgIGV4cG9ydCBsZXQgbnVtYmVyO1xuXG4gICAgLy8gc2V0IGN1cnJlbnQgbWVudVxuICAgIGZ1bmN0aW9uIG9uQ2xpY2soKSB7XG4gICAgICAgIGFjdGl2ZU1lbnUuc2V0KGlkKTtcbiAgICB9XG48L3NjcmlwdD5cblxuPGRpdlxuICAgIGNsYXNzPXtgdGV4dC1zbS1yZWcgJHtpc0FjdGl2ZSA/IFwic2Vjb25kLS1zdGF0ZS1hY3RpdmVcIiA6IFwic2Vjb25kXCJ9YH1cbiAgICBvbjpjbGljaz17b25DbGlja31cbj5cbiAgICB7bmFtZX1cbiAgICB7I2lmIG51bWJlciA+IDB9IFxuICAgICAgICA8VGFnIG51bWJlcj17bnVtYmVyfSAvPlxuICAgIHsvaWZ9XG48L2Rpdj5cblxuPHN0eWxlPlxuICAgIC5zZWNvbmQge1xuICAgICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgY29sb3I6ICM2NjY2NjY7XG4gICAgICAgIHRleHQtYWxpZ246IGxlZnQ7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICB9XG4gICAgLnNlY29uZDpob3ZlciB7XG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6I0YyRjJGMjtcbiAgICAgICAgY29sb3I6ICMxMjEyMTI7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgdHJhbnNpdGlvbjogYWxsIDEwMG1zO1xuICAgIH1cbiAgICAuc2Vjb25kLS1zdGF0ZS1hY3RpdmUge1xuICAgICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgY29sb3I6ICMxMjEyMTI7XG4gICAgICAgIHRleHQtYWxpZ246IGxlZnQ7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6I0U1RjBFODtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBMEJJLE9BQU8sY0FBQyxDQUFDLEFBQ0wsT0FBTyxDQUFFLElBQUksQ0FBQyxJQUFJLENBQ2xCLGFBQWEsQ0FBRSxHQUFHLENBQ2xCLEtBQUssQ0FBRSxPQUFPLENBQ2QsVUFBVSxDQUFFLElBQUksQ0FDaEIsT0FBTyxDQUFFLElBQUksQ0FDYixlQUFlLENBQUUsYUFBYSxDQUM5QixXQUFXLENBQUUsTUFBTSxBQUN2QixDQUFDLEFBQ0QscUJBQU8sTUFBTSxBQUFDLENBQUMsQUFDWCxpQkFBaUIsT0FBTyxDQUN4QixLQUFLLENBQUUsT0FBTyxDQUNkLE1BQU0sQ0FBRSxPQUFPLENBQ2YsVUFBVSxDQUFFLEdBQUcsQ0FBQyxLQUFLLEFBQ3pCLENBQUMsQUFDRCxxQkFBcUIsY0FBQyxDQUFDLEFBQ25CLE9BQU8sQ0FBRSxJQUFJLENBQUMsSUFBSSxDQUNsQixhQUFhLENBQUUsR0FBRyxDQUNsQixLQUFLLENBQUUsT0FBTyxDQUNkLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsaUJBQWlCLE9BQU8sQ0FDeEIsZUFBZSxDQUFFLGFBQWEsQ0FDOUIsV0FBVyxDQUFFLE1BQU0sQUFDdkIsQ0FBQyJ9 */");
    }

    // (21:4) {#if number > 0}
    function create_if_block(ctx) {
    	let tag;
    	let current;

    	tag = new Tag({
    			props: { number: /*number*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(tag.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(tag, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tag_changes = {};
    			if (dirty & /*number*/ 4) tag_changes.number = /*number*/ ctx[2];
    			tag.$set(tag_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tag.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tag.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tag, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(21:4) {#if number > 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let div_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*number*/ ctx[2] > 0 && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text(/*name*/ ctx[1]);
    			t1 = space();
    			if (if_block) if_block.c();
    			attr_dev(div, "class", div_class_value = "" + (null_to_empty(`text-sm-reg ${/*isActive*/ ctx[0] ? "second--state-active" : "second"}`) + " svelte-cp81qn"));
    			add_location(div, file$4, 15, 0, 276);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			append_dev(div, t1);
    			if (if_block) if_block.m(div, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div, "click", /*onClick*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*name*/ 2) set_data_dev(t0, /*name*/ ctx[1]);

    			if (/*number*/ ctx[2] > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*number*/ 4) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*isActive*/ 1 && div_class_value !== (div_class_value = "" + (null_to_empty(`text-sm-reg ${/*isActive*/ ctx[0] ? "second--state-active" : "second"}`) + " svelte-cp81qn"))) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
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
    	validate_slots('Second', slots, []);
    	let { isActive } = $$props;
    	let { name } = $$props;
    	let { id } = $$props;
    	let { number } = $$props;

    	// set current menu
    	function onClick() {
    		activeMenu.set(id);
    	}

    	const writable_props = ['isActive', 'name', 'id', 'number'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Second> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('isActive' in $$props) $$invalidate(0, isActive = $$props.isActive);
    		if ('name' in $$props) $$invalidate(1, name = $$props.name);
    		if ('id' in $$props) $$invalidate(4, id = $$props.id);
    		if ('number' in $$props) $$invalidate(2, number = $$props.number);
    	};

    	$$self.$capture_state = () => ({
    		activeMenu,
    		Tag,
    		isActive,
    		name,
    		id,
    		number,
    		onClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('isActive' in $$props) $$invalidate(0, isActive = $$props.isActive);
    		if ('name' in $$props) $$invalidate(1, name = $$props.name);
    		if ('id' in $$props) $$invalidate(4, id = $$props.id);
    		if ('number' in $$props) $$invalidate(2, number = $$props.number);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [isActive, name, number, onClick, id];
    }

    class Second extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { isActive: 0, name: 1, id: 4, number: 2 }, add_css$4);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Second",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*isActive*/ ctx[0] === undefined && !('isActive' in props)) {
    			console.warn("<Second> was created without expected prop 'isActive'");
    		}

    		if (/*name*/ ctx[1] === undefined && !('name' in props)) {
    			console.warn("<Second> was created without expected prop 'name'");
    		}

    		if (/*id*/ ctx[4] === undefined && !('id' in props)) {
    			console.warn("<Second> was created without expected prop 'id'");
    		}

    		if (/*number*/ ctx[2] === undefined && !('number' in props)) {
    			console.warn("<Second> was created without expected prop 'number'");
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

    	get number() {
    		throw new Error("<Second>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set number(value) {
    		throw new Error("<Second>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Menu/Menu.svelte generated by Svelte v3.50.0 */
    const file$5 = "src/components/Menu/Menu.svelte";

    function add_css$5(target) {
    	append_styles(target, "svelte-3d56ht", ".container.svelte-3d56ht{margin:0px 8px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWVudS5zdmVsdGUiLCJzb3VyY2VzIjpbIk1lbnUuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gICAgaW1wb3J0IEZpcnN0IGZyb20gXCIuL0ZpcnN0LnN2ZWx0ZVwiO1xuICAgIGltcG9ydCBTZWNvbmQgZnJvbSBcIi4vU2Vjb25kLnN2ZWx0ZVwiO1xuXG4gICAgaW1wb3J0IHsgYWN0aXZlTWVudSB9IGZyb20gXCIuLi8uLi9zdG9yZVwiO1xuXG4gICAgLy8gc2V0IHRoZSBhY3RpdmUgdGFiXG4gICAgbGV0IGFjdGl2ZTtcbiAgICBhY3RpdmVNZW51LnN1YnNjcmliZSgodmFsdWUpID0+IHtcbiAgICAgICAgYWN0aXZlID0gdmFsdWU7XG4gICAgfSk7XG48L3NjcmlwdD5cblxuPGRpdiBjbGFzcz0nY29udGFpbmVyJz5cbiAgICA8ZGl2PlxuICAgICAgICA8Rmlyc3QgbmFtZT17XCJFcnJvclwifSBpZD17XCJlcnJvclwifSAvPlxuICAgICAgICA8U2Vjb25kIG5hbWU9e1wiQ29sb3JcIn0gaWQ9e1wiY29sb3JcIn0gaXNBY3RpdmU9e2FjdGl2ZSA9PSBcImNvbG9yXCJ9IG51bWJlcj17MTB9Lz5cbiAgICAgICAgPFNlY29uZCBuYW1lPXtcIkZvbnRcIn0gaWQ9e1wiZm9udFwifSBpc0FjdGl2ZT17YWN0aXZlID09IFwiZm9udFwifSBudW1iZXI9ezEwfS8+XG4gICAgPC9kaXY+XG4gICAgPGRpdj5cbiAgICAgICAgPEZpcnN0IG5hbWU9e1wiQmV0YVwifSBpZD17XCJiZXRhXCJ9IGlzQWN0aXZlPXthY3RpdmUgPT0gXCJiZXRhXCJ9IC8+XG4gICAgICAgIDxTZWNvbmQgbmFtZT17XCJBdXRvIExheW91dFwifSBpZD17XCJmcmFtZVwifSBpc0FjdGl2ZT17YWN0aXZlID09IFwiZnJhbWVcIn0gbnVtYmVyPXs1MH0vPlxuICAgICAgICA8U2Vjb25kIG5hbWU9e1wiQ29tcG9uZW50XCJ9IGlkPXtcImNvbXBvbmVudFwifSBpc0FjdGl2ZT17YWN0aXZlID09IFwiY29tcG9uZW50XCJ9IG51bWJlcj17MTB9Lz5cbiAgICA8L2Rpdj5cbjwvZGl2PlxuXG48c3R5bGU+XG4gICAgLmNvbnRhaW5lciB7XG4gICAgICAgIG1hcmdpbjogMHB4IDhweDtcbiAgICB9XG48L3N0eWxlPiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUEyQkksVUFBVSxjQUFDLENBQUMsQUFDUixNQUFNLENBQUUsR0FBRyxDQUFDLEdBQUcsQUFDbkIsQ0FBQyJ9 */");
    }

    function create_fragment$5(ctx) {
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
    				isActive: /*active*/ ctx[0] == "color",
    				number: 10
    			},
    			$$inline: true
    		});

    	second1 = new Second({
    			props: {
    				name: "Font",
    				id: "font",
    				isActive: /*active*/ ctx[0] == "font",
    				number: 10
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
    				name: "Auto Layout",
    				id: "frame",
    				isActive: /*active*/ ctx[0] == "frame",
    				number: 50
    			},
    			$$inline: true
    		});

    	second3 = new Second({
    			props: {
    				name: "Component",
    				id: "component",
    				isActive: /*active*/ ctx[0] == "component",
    				number: 10
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
    			add_location(div0, file$5, 14, 4, 290);
    			add_location(div1, file$5, 19, 4, 528);
    			attr_dev(div2, "class", "container svelte-3d56ht");
    			add_location(div2, file$5, 13, 0, 262);
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
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {}, add_css$5);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Menu",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    const parseNumber = parseFloat;

    function joinCss(obj, separator = ';') {
      let texts;
      if (Array.isArray(obj)) {
        texts = obj.filter((text) => text);
      } else {
        texts = [];
        for (const prop in obj) {
          if (obj[prop]) {
            texts.push(`${prop}:${obj[prop]}`);
          }
        }
      }
      return texts.join(separator);
    }

    function getStyles(style, size, pull, fw) {
      let float;
      let width;
      const height = '1em';
      let lineHeight;
      let fontSize;
      let textAlign;
      let verticalAlign = '-.125em';
      const overflow = 'visible';

      if (fw) {
        textAlign = 'center';
        width = '1.25em';
      }

      if (pull) {
        float = pull;
      }

      if (size) {
        if (size == 'lg') {
          fontSize = '1.33333em';
          lineHeight = '.75em';
          verticalAlign = '-.225em';
        } else if (size == 'xs') {
          fontSize = '.75em';
        } else if (size == 'sm') {
          fontSize = '.875em';
        } else {
          fontSize = size.replace('x', 'em');
        }
      }

      return joinCss([
        joinCss({
          float,
          width,
          height,
          'line-height': lineHeight,
          'font-size': fontSize,
          'text-align': textAlign,
          'vertical-align': verticalAlign,
          'transform-origin': 'center',
          overflow,
        }),
        style,
      ]);
    }

    function getTransform(
      scale,
      translateX,
      translateY,
      rotate,
      flip,
      translateTimes = 1,
      translateUnit = '',
      rotateUnit = '',
    ) {
      let flipX = 1;
      let flipY = 1;

      if (flip) {
        if (flip == 'horizontal') {
          flipX = -1;
        } else if (flip == 'vertical') {
          flipY = -1;
        } else {
          flipX = flipY = -1;
        }
      }

      return joinCss(
        [
          `translate(${parseNumber(translateX) * translateTimes}${translateUnit},${parseNumber(translateY) * translateTimes}${translateUnit})`,
          `scale(${flipX * parseNumber(scale)},${flipY * parseNumber(scale)})`,
          rotate && `rotate(${rotate}${rotateUnit})`,
        ],
        ' ',
      );
    }

    /* node_modules/svelte-fa/src/fa.svelte generated by Svelte v3.50.0 */
    const file$6 = "node_modules/svelte-fa/src/fa.svelte";

    function add_css$6(target) {
    	append_styles(target, "svelte-1cj2gr0", ".spin.svelte-1cj2gr0{animation:svelte-1cj2gr0-spin 2s 0s infinite linear}.pulse.svelte-1cj2gr0{animation:svelte-1cj2gr0-spin 1s infinite steps(8)}@keyframes svelte-1cj2gr0-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmEuc3ZlbHRlIiwic291cmNlcyI6WyJmYS5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbmltcG9ydCB7XG4gIGdldFN0eWxlcyxcbiAgZ2V0VHJhbnNmb3JtLFxufSBmcm9tICcuL3V0aWxzJztcblxubGV0IGNsYXp6ID0gJyc7XG5leHBvcnQgeyBjbGF6eiBhcyBjbGFzcyB9O1xuZXhwb3J0IGxldCBpZCA9ICcnO1xuZXhwb3J0IGxldCBzdHlsZSA9ICcnO1xuXG5leHBvcnQgbGV0IGljb247XG5cbmV4cG9ydCBsZXQgc2l6ZSA9ICcnO1xuZXhwb3J0IGxldCBjb2xvciA9ICcnO1xuXG5leHBvcnQgbGV0IGZ3ID0gZmFsc2U7XG5leHBvcnQgbGV0IHB1bGwgPSAnJztcblxuZXhwb3J0IGxldCBzY2FsZSA9IDE7XG5leHBvcnQgbGV0IHRyYW5zbGF0ZVggPSAwO1xuZXhwb3J0IGxldCB0cmFuc2xhdGVZID0gMDtcbmV4cG9ydCBsZXQgcm90YXRlID0gJyc7XG5leHBvcnQgbGV0IGZsaXAgPSBmYWxzZTtcblxuZXhwb3J0IGxldCBzcGluID0gZmFsc2U7XG5leHBvcnQgbGV0IHB1bHNlID0gZmFsc2U7XG5cbi8vIER1b3RvbmUgSWNvbnNcbmV4cG9ydCBsZXQgcHJpbWFyeUNvbG9yID0gJyc7XG5leHBvcnQgbGV0IHNlY29uZGFyeUNvbG9yID0gJyc7XG5leHBvcnQgbGV0IHByaW1hcnlPcGFjaXR5ID0gMTtcbmV4cG9ydCBsZXQgc2Vjb25kYXJ5T3BhY2l0eSA9IDAuNDtcbmV4cG9ydCBsZXQgc3dhcE9wYWNpdHkgPSBmYWxzZTtcblxubGV0IGk7XG5sZXQgcztcbmxldCB0cmFuc2Zvcm07XG5cbiQ6IGkgPSAoaWNvbiAmJiBpY29uLmljb24pIHx8IFswLCAwLCAnJywgW10sICcnXTtcblxuJDogcyA9IGdldFN0eWxlcyhzdHlsZSwgc2l6ZSwgcHVsbCwgZncpO1xuXG4kOiB0cmFuc2Zvcm0gPSBnZXRUcmFuc2Zvcm0oc2NhbGUsIHRyYW5zbGF0ZVgsIHRyYW5zbGF0ZVksIHJvdGF0ZSwgZmxpcCwgNTEyKTtcbjwvc2NyaXB0PlxuXG48c3R5bGU+XG4uc3BpbiB7XG4gIGFuaW1hdGlvbjogc3BpbiAycyAwcyBpbmZpbml0ZSBsaW5lYXI7XG59XG5cbi5wdWxzZSB7XG4gIGFuaW1hdGlvbjogc3BpbiAxcyBpbmZpbml0ZSBzdGVwcyg4KTtcbn1cblxuQGtleWZyYW1lcyBzcGluIHtcbiAgMCUge1xuICAgIHRyYW5zZm9ybTogcm90YXRlKDBkZWcpO1xuICB9XG4gIDEwMCUge1xuICAgIHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7XG4gIH1cbn1cbjwvc3R5bGU+XG5cbnsjaWYgaVs0XX1cbiAgPHN2Z1xuICAgIGlkPXtpZCB8fCB1bmRlZmluZWR9XG4gICAgY2xhc3M9XCJzdmVsdGUtZmEge2NsYXp6fVwiXG4gICAgY2xhc3M6cHVsc2VcbiAgICBjbGFzczpzcGluXG4gICAgc3R5bGU9e3N9XG4gICAgdmlld0JveD1cIjAgMCB7aVswXX0ge2lbMV19XCJcbiAgICBhcmlhLWhpZGRlbj1cInRydWVcIlxuICAgIHJvbGU9XCJpbWdcIlxuICAgIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIlxuICA+XG4gICAgPGdcbiAgICAgIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSh7aVswXSAvIDJ9IHtpWzFdIC8gMn0pXCJcbiAgICAgIHRyYW5zZm9ybS1vcmlnaW49XCJ7aVswXSAvIDR9IDBcIlxuICAgID5cbiAgICAgIDxnIHt0cmFuc2Zvcm19PlxuICAgICAgICB7I2lmIHR5cGVvZiBpWzRdID09ICdzdHJpbmcnfVxuICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICBkPXtpWzRdfVxuICAgICAgICAgICAgZmlsbD17Y29sb3IgfHwgcHJpbWFyeUNvbG9yIHx8ICdjdXJyZW50Q29sb3InfVxuICAgICAgICAgICAgdHJhbnNmb3JtPVwidHJhbnNsYXRlKHtpWzBdIC8gLTJ9IHtpWzFdIC8gLTJ9KVwiXG4gICAgICAgICAgLz5cbiAgICAgICAgezplbHNlfVxuICAgICAgICAgIDwhLS0gRHVvdG9uZSBpY29ucyAtLT5cbiAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgZD17aVs0XVswXX1cbiAgICAgICAgICAgIGZpbGw9e3NlY29uZGFyeUNvbG9yIHx8IGNvbG9yIHx8ICdjdXJyZW50Q29sb3InfVxuICAgICAgICAgICAgZmlsbC1vcGFjaXR5PXtzd2FwT3BhY2l0eSAhPSBmYWxzZSA/IHByaW1hcnlPcGFjaXR5IDogc2Vjb25kYXJ5T3BhY2l0eX1cbiAgICAgICAgICAgIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSh7aVswXSAvIC0yfSB7aVsxXSAvIC0yfSlcIlxuICAgICAgICAgIC8+XG4gICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgIGQ9e2lbNF1bMV19XG4gICAgICAgICAgICBmaWxsPXtwcmltYXJ5Q29sb3IgfHwgY29sb3IgfHwgJ2N1cnJlbnRDb2xvcid9XG4gICAgICAgICAgICBmaWxsLW9wYWNpdHk9e3N3YXBPcGFjaXR5ICE9IGZhbHNlID8gc2Vjb25kYXJ5T3BhY2l0eSA6IHByaW1hcnlPcGFjaXR5fVxuICAgICAgICAgICAgdHJhbnNmb3JtPVwidHJhbnNsYXRlKHtpWzBdIC8gLTJ9IHtpWzFdIC8gLTJ9KVwiXG4gICAgICAgICAgLz5cbiAgICAgICAgey9pZn1cbiAgICAgIDwvZz5cbiAgICA8L2c+XG4gIDwvc3ZnPlxuey9pZn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUErQ0EsS0FBSyxlQUFDLENBQUMsQUFDTCxTQUFTLENBQUUsbUJBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEFBQ3ZDLENBQUMsQUFFRCxNQUFNLGVBQUMsQ0FBQyxBQUNOLFNBQVMsQ0FBRSxtQkFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQUFDdEMsQ0FBQyxBQUVELFdBQVcsbUJBQUssQ0FBQyxBQUNmLEVBQUUsQUFBQyxDQUFDLEFBQ0YsU0FBUyxDQUFFLE9BQU8sSUFBSSxDQUFDLEFBQ3pCLENBQUMsQUFDRCxJQUFJLEFBQUMsQ0FBQyxBQUNKLFNBQVMsQ0FBRSxPQUFPLE1BQU0sQ0FBQyxBQUMzQixDQUFDLEFBQ0gsQ0FBQyJ9 */");
    }

    // (66:0) {#if i[4]}
    function create_if_block$1(ctx) {
    	let svg;
    	let g1;
    	let g0;
    	let g1_transform_value;
    	let g1_transform_origin_value;
    	let svg_id_value;
    	let svg_class_value;
    	let svg_viewBox_value;

    	function select_block_type(ctx, dirty) {
    		if (typeof /*i*/ ctx[10][4] == 'string') return create_if_block_1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g1 = svg_element("g");
    			g0 = svg_element("g");
    			if_block.c();
    			attr_dev(g0, "transform", /*transform*/ ctx[12]);
    			add_location(g0, file$6, 81, 6, 1397);
    			attr_dev(g1, "transform", g1_transform_value = "translate(" + /*i*/ ctx[10][0] / 2 + " " + /*i*/ ctx[10][1] / 2 + ")");
    			attr_dev(g1, "transform-origin", g1_transform_origin_value = "" + (/*i*/ ctx[10][0] / 4 + " 0"));
    			add_location(g1, file$6, 77, 4, 1293);
    			attr_dev(svg, "id", svg_id_value = /*id*/ ctx[1] || undefined);
    			attr_dev(svg, "class", svg_class_value = "svelte-fa " + /*clazz*/ ctx[0] + " svelte-1cj2gr0");
    			attr_dev(svg, "style", /*s*/ ctx[11]);
    			attr_dev(svg, "viewBox", svg_viewBox_value = "0 0 " + /*i*/ ctx[10][0] + " " + /*i*/ ctx[10][1]);
    			attr_dev(svg, "aria-hidden", "true");
    			attr_dev(svg, "role", "img");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			toggle_class(svg, "pulse", /*pulse*/ ctx[4]);
    			toggle_class(svg, "spin", /*spin*/ ctx[3]);
    			add_location(svg, file$6, 66, 2, 1071);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, g1);
    			append_dev(g1, g0);
    			if_block.m(g0, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(g0, null);
    				}
    			}

    			if (dirty & /*transform*/ 4096) {
    				attr_dev(g0, "transform", /*transform*/ ctx[12]);
    			}

    			if (dirty & /*i*/ 1024 && g1_transform_value !== (g1_transform_value = "translate(" + /*i*/ ctx[10][0] / 2 + " " + /*i*/ ctx[10][1] / 2 + ")")) {
    				attr_dev(g1, "transform", g1_transform_value);
    			}

    			if (dirty & /*i*/ 1024 && g1_transform_origin_value !== (g1_transform_origin_value = "" + (/*i*/ ctx[10][0] / 4 + " 0"))) {
    				attr_dev(g1, "transform-origin", g1_transform_origin_value);
    			}

    			if (dirty & /*id*/ 2 && svg_id_value !== (svg_id_value = /*id*/ ctx[1] || undefined)) {
    				attr_dev(svg, "id", svg_id_value);
    			}

    			if (dirty & /*clazz*/ 1 && svg_class_value !== (svg_class_value = "svelte-fa " + /*clazz*/ ctx[0] + " svelte-1cj2gr0")) {
    				attr_dev(svg, "class", svg_class_value);
    			}

    			if (dirty & /*s*/ 2048) {
    				attr_dev(svg, "style", /*s*/ ctx[11]);
    			}

    			if (dirty & /*i*/ 1024 && svg_viewBox_value !== (svg_viewBox_value = "0 0 " + /*i*/ ctx[10][0] + " " + /*i*/ ctx[10][1])) {
    				attr_dev(svg, "viewBox", svg_viewBox_value);
    			}

    			if (dirty & /*clazz, pulse*/ 17) {
    				toggle_class(svg, "pulse", /*pulse*/ ctx[4]);
    			}

    			if (dirty & /*clazz, spin*/ 9) {
    				toggle_class(svg, "spin", /*spin*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(66:0) {#if i[4]}",
    		ctx
    	});

    	return block;
    }

    // (89:8) {:else}
    function create_else_block(ctx) {
    	let path0;
    	let path0_d_value;
    	let path0_fill_value;
    	let path0_fill_opacity_value;
    	let path0_transform_value;
    	let path1;
    	let path1_d_value;
    	let path1_fill_value;
    	let path1_fill_opacity_value;
    	let path1_transform_value;

    	const block = {
    		c: function create() {
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "d", path0_d_value = /*i*/ ctx[10][4][0]);
    			attr_dev(path0, "fill", path0_fill_value = /*secondaryColor*/ ctx[6] || /*color*/ ctx[2] || 'currentColor');

    			attr_dev(path0, "fill-opacity", path0_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*primaryOpacity*/ ctx[7]
    			: /*secondaryOpacity*/ ctx[8]);

    			attr_dev(path0, "transform", path0_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")");
    			add_location(path0, file$6, 90, 10, 1678);
    			attr_dev(path1, "d", path1_d_value = /*i*/ ctx[10][4][1]);
    			attr_dev(path1, "fill", path1_fill_value = /*primaryColor*/ ctx[5] || /*color*/ ctx[2] || 'currentColor');

    			attr_dev(path1, "fill-opacity", path1_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*secondaryOpacity*/ ctx[8]
    			: /*primaryOpacity*/ ctx[7]);

    			attr_dev(path1, "transform", path1_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")");
    			add_location(path1, file$6, 96, 10, 1935);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path0, anchor);
    			insert_dev(target, path1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*i*/ 1024 && path0_d_value !== (path0_d_value = /*i*/ ctx[10][4][0])) {
    				attr_dev(path0, "d", path0_d_value);
    			}

    			if (dirty & /*secondaryColor, color*/ 68 && path0_fill_value !== (path0_fill_value = /*secondaryColor*/ ctx[6] || /*color*/ ctx[2] || 'currentColor')) {
    				attr_dev(path0, "fill", path0_fill_value);
    			}

    			if (dirty & /*swapOpacity, primaryOpacity, secondaryOpacity*/ 896 && path0_fill_opacity_value !== (path0_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*primaryOpacity*/ ctx[7]
    			: /*secondaryOpacity*/ ctx[8])) {
    				attr_dev(path0, "fill-opacity", path0_fill_opacity_value);
    			}

    			if (dirty & /*i*/ 1024 && path0_transform_value !== (path0_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")")) {
    				attr_dev(path0, "transform", path0_transform_value);
    			}

    			if (dirty & /*i*/ 1024 && path1_d_value !== (path1_d_value = /*i*/ ctx[10][4][1])) {
    				attr_dev(path1, "d", path1_d_value);
    			}

    			if (dirty & /*primaryColor, color*/ 36 && path1_fill_value !== (path1_fill_value = /*primaryColor*/ ctx[5] || /*color*/ ctx[2] || 'currentColor')) {
    				attr_dev(path1, "fill", path1_fill_value);
    			}

    			if (dirty & /*swapOpacity, secondaryOpacity, primaryOpacity*/ 896 && path1_fill_opacity_value !== (path1_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*secondaryOpacity*/ ctx[8]
    			: /*primaryOpacity*/ ctx[7])) {
    				attr_dev(path1, "fill-opacity", path1_fill_opacity_value);
    			}

    			if (dirty & /*i*/ 1024 && path1_transform_value !== (path1_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")")) {
    				attr_dev(path1, "transform", path1_transform_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path0);
    			if (detaching) detach_dev(path1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(89:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (83:8) {#if typeof i[4] == 'string'}
    function create_if_block_1(ctx) {
    	let path;
    	let path_d_value;
    	let path_fill_value;
    	let path_transform_value;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", path_d_value = /*i*/ ctx[10][4]);
    			attr_dev(path, "fill", path_fill_value = /*color*/ ctx[2] || /*primaryColor*/ ctx[5] || 'currentColor');
    			attr_dev(path, "transform", path_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")");
    			add_location(path, file$6, 83, 10, 1461);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*i*/ 1024 && path_d_value !== (path_d_value = /*i*/ ctx[10][4])) {
    				attr_dev(path, "d", path_d_value);
    			}

    			if (dirty & /*color, primaryColor*/ 36 && path_fill_value !== (path_fill_value = /*color*/ ctx[2] || /*primaryColor*/ ctx[5] || 'currentColor')) {
    				attr_dev(path, "fill", path_fill_value);
    			}

    			if (dirty & /*i*/ 1024 && path_transform_value !== (path_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")")) {
    				attr_dev(path, "transform", path_transform_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(83:8) {#if typeof i[4] == 'string'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let if_block_anchor;
    	let if_block = /*i*/ ctx[10][4] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*i*/ ctx[10][4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Fa', slots, []);
    	let { class: clazz = '' } = $$props;
    	let { id = '' } = $$props;
    	let { style = '' } = $$props;
    	let { icon } = $$props;
    	let { size = '' } = $$props;
    	let { color = '' } = $$props;
    	let { fw = false } = $$props;
    	let { pull = '' } = $$props;
    	let { scale = 1 } = $$props;
    	let { translateX = 0 } = $$props;
    	let { translateY = 0 } = $$props;
    	let { rotate = '' } = $$props;
    	let { flip = false } = $$props;
    	let { spin = false } = $$props;
    	let { pulse = false } = $$props;
    	let { primaryColor = '' } = $$props;
    	let { secondaryColor = '' } = $$props;
    	let { primaryOpacity = 1 } = $$props;
    	let { secondaryOpacity = 0.4 } = $$props;
    	let { swapOpacity = false } = $$props;
    	let i;
    	let s;
    	let transform;

    	const writable_props = [
    		'class',
    		'id',
    		'style',
    		'icon',
    		'size',
    		'color',
    		'fw',
    		'pull',
    		'scale',
    		'translateX',
    		'translateY',
    		'rotate',
    		'flip',
    		'spin',
    		'pulse',
    		'primaryColor',
    		'secondaryColor',
    		'primaryOpacity',
    		'secondaryOpacity',
    		'swapOpacity'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Fa> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('class' in $$props) $$invalidate(0, clazz = $$props.class);
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('style' in $$props) $$invalidate(13, style = $$props.style);
    		if ('icon' in $$props) $$invalidate(14, icon = $$props.icon);
    		if ('size' in $$props) $$invalidate(15, size = $$props.size);
    		if ('color' in $$props) $$invalidate(2, color = $$props.color);
    		if ('fw' in $$props) $$invalidate(16, fw = $$props.fw);
    		if ('pull' in $$props) $$invalidate(17, pull = $$props.pull);
    		if ('scale' in $$props) $$invalidate(18, scale = $$props.scale);
    		if ('translateX' in $$props) $$invalidate(19, translateX = $$props.translateX);
    		if ('translateY' in $$props) $$invalidate(20, translateY = $$props.translateY);
    		if ('rotate' in $$props) $$invalidate(21, rotate = $$props.rotate);
    		if ('flip' in $$props) $$invalidate(22, flip = $$props.flip);
    		if ('spin' in $$props) $$invalidate(3, spin = $$props.spin);
    		if ('pulse' in $$props) $$invalidate(4, pulse = $$props.pulse);
    		if ('primaryColor' in $$props) $$invalidate(5, primaryColor = $$props.primaryColor);
    		if ('secondaryColor' in $$props) $$invalidate(6, secondaryColor = $$props.secondaryColor);
    		if ('primaryOpacity' in $$props) $$invalidate(7, primaryOpacity = $$props.primaryOpacity);
    		if ('secondaryOpacity' in $$props) $$invalidate(8, secondaryOpacity = $$props.secondaryOpacity);
    		if ('swapOpacity' in $$props) $$invalidate(9, swapOpacity = $$props.swapOpacity);
    	};

    	$$self.$capture_state = () => ({
    		getStyles,
    		getTransform,
    		clazz,
    		id,
    		style,
    		icon,
    		size,
    		color,
    		fw,
    		pull,
    		scale,
    		translateX,
    		translateY,
    		rotate,
    		flip,
    		spin,
    		pulse,
    		primaryColor,
    		secondaryColor,
    		primaryOpacity,
    		secondaryOpacity,
    		swapOpacity,
    		i,
    		s,
    		transform
    	});

    	$$self.$inject_state = $$props => {
    		if ('clazz' in $$props) $$invalidate(0, clazz = $$props.clazz);
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('style' in $$props) $$invalidate(13, style = $$props.style);
    		if ('icon' in $$props) $$invalidate(14, icon = $$props.icon);
    		if ('size' in $$props) $$invalidate(15, size = $$props.size);
    		if ('color' in $$props) $$invalidate(2, color = $$props.color);
    		if ('fw' in $$props) $$invalidate(16, fw = $$props.fw);
    		if ('pull' in $$props) $$invalidate(17, pull = $$props.pull);
    		if ('scale' in $$props) $$invalidate(18, scale = $$props.scale);
    		if ('translateX' in $$props) $$invalidate(19, translateX = $$props.translateX);
    		if ('translateY' in $$props) $$invalidate(20, translateY = $$props.translateY);
    		if ('rotate' in $$props) $$invalidate(21, rotate = $$props.rotate);
    		if ('flip' in $$props) $$invalidate(22, flip = $$props.flip);
    		if ('spin' in $$props) $$invalidate(3, spin = $$props.spin);
    		if ('pulse' in $$props) $$invalidate(4, pulse = $$props.pulse);
    		if ('primaryColor' in $$props) $$invalidate(5, primaryColor = $$props.primaryColor);
    		if ('secondaryColor' in $$props) $$invalidate(6, secondaryColor = $$props.secondaryColor);
    		if ('primaryOpacity' in $$props) $$invalidate(7, primaryOpacity = $$props.primaryOpacity);
    		if ('secondaryOpacity' in $$props) $$invalidate(8, secondaryOpacity = $$props.secondaryOpacity);
    		if ('swapOpacity' in $$props) $$invalidate(9, swapOpacity = $$props.swapOpacity);
    		if ('i' in $$props) $$invalidate(10, i = $$props.i);
    		if ('s' in $$props) $$invalidate(11, s = $$props.s);
    		if ('transform' in $$props) $$invalidate(12, transform = $$props.transform);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 16384) {
    			 $$invalidate(10, i = icon && icon.icon || [0, 0, '', [], '']);
    		}

    		if ($$self.$$.dirty & /*style, size, pull, fw*/ 237568) {
    			 $$invalidate(11, s = getStyles(style, size, pull, fw));
    		}

    		if ($$self.$$.dirty & /*scale, translateX, translateY, rotate, flip*/ 8126464) {
    			 $$invalidate(12, transform = getTransform(scale, translateX, translateY, rotate, flip, 512));
    		}
    	};

    	return [
    		clazz,
    		id,
    		color,
    		spin,
    		pulse,
    		primaryColor,
    		secondaryColor,
    		primaryOpacity,
    		secondaryOpacity,
    		swapOpacity,
    		i,
    		s,
    		transform,
    		style,
    		icon,
    		size,
    		fw,
    		pull,
    		scale,
    		translateX,
    		translateY,
    		rotate,
    		flip
    	];
    }

    class Fa extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$6,
    			create_fragment$6,
    			safe_not_equal,
    			{
    				class: 0,
    				id: 1,
    				style: 13,
    				icon: 14,
    				size: 15,
    				color: 2,
    				fw: 16,
    				pull: 17,
    				scale: 18,
    				translateX: 19,
    				translateY: 20,
    				rotate: 21,
    				flip: 22,
    				spin: 3,
    				pulse: 4,
    				primaryColor: 5,
    				secondaryColor: 6,
    				primaryOpacity: 7,
    				secondaryOpacity: 8,
    				swapOpacity: 9
    			},
    			add_css$6
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Fa",
    			options,
    			id: create_fragment$6.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*icon*/ ctx[14] === undefined && !('icon' in props)) {
    			console.warn("<Fa> was created without expected prop 'icon'");
    		}
    	}

    	get class() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get icon() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set icon(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fw() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fw(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pull() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pull(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get scale() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set scale(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get translateX() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set translateX(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get translateY() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set translateY(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rotate() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rotate(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get flip() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set flip(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get spin() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set spin(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pulse() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pulse(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get primaryColor() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set primaryColor(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get secondaryColor() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set secondaryColor(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get primaryOpacity() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set primaryOpacity(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get secondaryOpacity() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set secondaryOpacity(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get swapOpacity() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set swapOpacity(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var faEllipsis = {
      prefix: 'fas',
      iconName: 'ellipsis',
      icon: [448, 512, ["ellipsis-h"], "f141", "M8 256a56 56 0 1 1 112 0A56 56 0 1 1 8 256zm160 0a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm216-56a56 56 0 1 1 0 112 56 56 0 1 1 0-112z"]
    };

    /* src/components/List/Error.svelte generated by Svelte v3.50.0 */

    const { Error: Error_1, console: console_1 } = globals;
    const file$7 = "src/components/List/Error.svelte";

    function add_css$7(target) {
    	append_styles(target, "svelte-6w94ad", ".container.svelte-6w94ad{padding:16px;display:flex;flex-direction:column;justify-content:center;align-items:stretch;gap:8px;border-style:solid;border-width:1px;border-color:#d5d5d5;border-radius:8px;cursor:pointer}.container.svelte-6w94ad:hover{border-color:#808080;background-color:#F2F2F2}.container--state-active.svelte-6w94ad{border-color:#128ba6;background-color:#F2F2F2;padding:16px;display:flex;flex-direction:column;justify-content:center;align-items:stretch;gap:8px;border-style:solid;border-width:1px;border-radius:8px;cursor:pointer}.top.svelte-6w94ad{display:flex;flex-direction:row;justify-content:space-between;text-align:left;align-items:start;gap:8px}.bot.svelte-6w94ad{color:#6c6c70;text-align:left}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRXJyb3Iuc3ZlbHRlIiwic291cmNlcyI6WyJFcnJvci5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgICBleHBvcnQgbGV0IHRpdGxlO1xuICAgIGV4cG9ydCBsZXQgaWQ7XG4gICAgZXhwb3J0IGxldCBpc19mb2N1cztcbiAgICBleHBvcnQgbGV0IGRlc2M7XG5cbiAgICBpbXBvcnQgRmEgZnJvbSBcInN2ZWx0ZS1mYVwiO1xuICAgIGltcG9ydCB7IGZhRWxsaXBzaXMgfSBmcm9tIFwiQGZvcnRhd2Vzb21lL2ZyZWUtc29saWQtc3ZnLWljb25zXCI7XG4gICAgaW1wb3J0IHthY3RpdmVGb2N1c30gZnJvbSAnLi4vLi4vc3RvcmUnXG5cbiAgICBmdW5jdGlvbiBvbkNsaWNrKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIkNsaWNrXCIpXG4gICAgICAgIGFjdGl2ZUZvY3VzLnNldChpZCk7XG4gICAgfVxuPC9zY3JpcHQ+XG5cbjxkaXYgY2xhc3M9e2Ake2lkID09IGlzX2ZvY3VzID8gXCJjb250YWluZXItLXN0YXRlLWFjdGl2ZVwiIDogXCJjb250YWluZXJcIn1gfSBvbjpjbGljaz17b25DbGlja30+XG4gICAgPGRpdiBjbGFzcz1cInRvcCB0ZXh0LW1kLW1lZFwiPlxuICAgICAgICB7dGl0bGV9XG4gICAgICAgIDxGYSBpY29uPXtmYUVsbGlwc2lzfSAvPlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJib3QgdGV4dC1zbS1yZWdcIj57ZGVzY308L2Rpdj5cbjwvZGl2PlxuXG48c3R5bGU+XG4gICAgLmNvbnRhaW5lciB7XG4gICAgICAgIHBhZGRpbmc6IDE2cHg7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICBhbGlnbi1pdGVtczogc3RyZXRjaDtcbiAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgIGJvcmRlci1zdHlsZTogc29saWQ7XG4gICAgICAgIGJvcmRlci13aWR0aDogMXB4O1xuICAgICAgICBib3JkZXItY29sb3I6ICNkNWQ1ZDU7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgIH1cblxuICAgIC5jb250YWluZXI6aG92ZXIge1xuICAgICAgICBib3JkZXItY29sb3I6ICM4MDgwODA7XG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6ICNGMkYyRjI7XG4gICAgfVxuXG4gICAgLmNvbnRhaW5lci0tc3RhdGUtYWN0aXZlIHtcbiAgICAgICAgYm9yZGVyLWNvbG9yOiAjMTI4YmE2O1xuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjRjJGMkYyO1xuICAgICAgICBwYWRkaW5nOiAxNnB4O1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgYWxpZ24taXRlbXM6IHN0cmV0Y2g7XG4gICAgICAgIGdhcDogOHB4O1xuICAgICAgICBib3JkZXItc3R5bGU6IHNvbGlkO1xuICAgICAgICBib3JkZXItd2lkdGg6IDFweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgfVxuICAgIC50b3Age1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIHRleHQtYWxpZ246IGxlZnQ7XG4gICAgICAgIGFsaWduLWl0ZW1zOiBzdGFydDtcbiAgICAgICAgZ2FwOiA4cHg7XG4gICAgfVxuICAgIC5ib3Qge1xuICAgICAgICBjb2xvcjogIzZjNmM3MDtcbiAgICAgICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgICB9XG48L3N0eWxlPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXlCSSxVQUFVLGNBQUMsQ0FBQyxBQUNSLE9BQU8sQ0FBRSxJQUFJLENBQ2IsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxDQUN0QixlQUFlLENBQUUsTUFBTSxDQUN2QixXQUFXLENBQUUsT0FBTyxDQUNwQixHQUFHLENBQUUsR0FBRyxDQUNSLFlBQVksQ0FBRSxLQUFLLENBQ25CLFlBQVksQ0FBRSxHQUFHLENBQ2pCLFlBQVksQ0FBRSxPQUFPLENBQ3JCLGFBQWEsQ0FBRSxHQUFHLENBQ2xCLE1BQU0sQ0FBRSxPQUFPLEFBQ25CLENBQUMsQUFFRCx3QkFBVSxNQUFNLEFBQUMsQ0FBQyxBQUNkLFlBQVksQ0FBRSxPQUFPLENBQ3JCLGdCQUFnQixDQUFFLE9BQU8sQUFDN0IsQ0FBQyxBQUVELHdCQUF3QixjQUFDLENBQUMsQUFDdEIsWUFBWSxDQUFFLE9BQU8sQ0FDckIsZ0JBQWdCLENBQUUsT0FBTyxDQUN6QixPQUFPLENBQUUsSUFBSSxDQUNiLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLE1BQU0sQ0FDdEIsZUFBZSxDQUFFLE1BQU0sQ0FDdkIsV0FBVyxDQUFFLE9BQU8sQ0FDcEIsR0FBRyxDQUFFLEdBQUcsQ0FDUixZQUFZLENBQUUsS0FBSyxDQUNuQixZQUFZLENBQUUsR0FBRyxDQUNqQixhQUFhLENBQUUsR0FBRyxDQUNsQixNQUFNLENBQUUsT0FBTyxBQUNuQixDQUFDLEFBQ0QsSUFBSSxjQUFDLENBQUMsQUFDRixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxhQUFhLENBQzlCLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLFdBQVcsQ0FBRSxLQUFLLENBQ2xCLEdBQUcsQ0FBRSxHQUFHLEFBQ1osQ0FBQyxBQUNELElBQUksY0FBQyxDQUFDLEFBQ0YsS0FBSyxDQUFFLE9BQU8sQ0FDZCxVQUFVLENBQUUsSUFBSSxBQUNwQixDQUFDIn0= */");
    }

    function create_fragment$7(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let t1;
    	let fa;
    	let t2;
    	let div1;
    	let t3;
    	let div2_class_value;
    	let current;
    	let mounted;
    	let dispose;

    	fa = new Fa({
    			props: { icon: faEllipsis },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text(/*title*/ ctx[0]);
    			t1 = space();
    			create_component(fa.$$.fragment);
    			t2 = space();
    			div1 = element("div");
    			t3 = text(/*desc*/ ctx[3]);
    			attr_dev(div0, "class", "top text-md-med svelte-6w94ad");
    			add_location(div0, file$7, 17, 4, 441);
    			attr_dev(div1, "class", "bot text-sm-reg svelte-6w94ad");
    			add_location(div1, file$7, 21, 4, 535);

    			attr_dev(div2, "class", div2_class_value = "" + (null_to_empty(`${/*id*/ ctx[1] == /*is_focus*/ ctx[2]
			? "container--state-active"
			: "container"}`) + " svelte-6w94ad"));

    			add_location(div2, file$7, 16, 0, 342);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			mount_component(fa, div0, null);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div1, t3);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div2, "click", /*onClick*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*title*/ 1) set_data_dev(t0, /*title*/ ctx[0]);
    			if (!current || dirty & /*desc*/ 8) set_data_dev(t3, /*desc*/ ctx[3]);

    			if (!current || dirty & /*id, is_focus*/ 6 && div2_class_value !== (div2_class_value = "" + (null_to_empty(`${/*id*/ ctx[1] == /*is_focus*/ ctx[2]
			? "container--state-active"
			: "container"}`) + " svelte-6w94ad"))) {
    				attr_dev(div2, "class", div2_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(fa);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Error', slots, []);
    	let { title } = $$props;
    	let { id } = $$props;
    	let { is_focus } = $$props;
    	let { desc } = $$props;

    	function onClick() {
    		console.log("Click");
    		activeFocus.set(id);
    	}

    	const writable_props = ['title', 'id', 'is_focus', 'desc'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Error> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('is_focus' in $$props) $$invalidate(2, is_focus = $$props.is_focus);
    		if ('desc' in $$props) $$invalidate(3, desc = $$props.desc);
    	};

    	$$self.$capture_state = () => ({
    		title,
    		id,
    		is_focus,
    		desc,
    		Fa,
    		faEllipsis,
    		activeFocus,
    		onClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('is_focus' in $$props) $$invalidate(2, is_focus = $$props.is_focus);
    		if ('desc' in $$props) $$invalidate(3, desc = $$props.desc);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, id, is_focus, desc, onClick];
    }

    class Error$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { title: 0, id: 1, is_focus: 2, desc: 3 }, add_css$7);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Error",
    			options,
    			id: create_fragment$7.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*title*/ ctx[0] === undefined && !('title' in props)) {
    			console_1.warn("<Error> was created without expected prop 'title'");
    		}

    		if (/*id*/ ctx[1] === undefined && !('id' in props)) {
    			console_1.warn("<Error> was created without expected prop 'id'");
    		}

    		if (/*is_focus*/ ctx[2] === undefined && !('is_focus' in props)) {
    			console_1.warn("<Error> was created without expected prop 'is_focus'");
    		}

    		if (/*desc*/ ctx[3] === undefined && !('desc' in props)) {
    			console_1.warn("<Error> was created without expected prop 'desc'");
    		}
    	}

    	get title() {
    		throw new Error_1("<Error>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error_1("<Error>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error_1("<Error>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error_1("<Error>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get is_focus() {
    		throw new Error_1("<Error>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set is_focus(value) {
    		throw new Error_1("<Error>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get desc() {
    		throw new Error_1("<Error>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set desc(value) {
    		throw new Error_1("<Error>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/List/List.svelte generated by Svelte v3.50.0 */

    const { Error: Error_1$1 } = globals;
    const file$8 = "src/components/List/List.svelte";

    function add_css$8(target) {
    	append_styles(target, "svelte-1h3i19d", ".container.svelte-1h3i19d{padding:16px;display:flex;flex-direction:column;gap:8px;;;align-items:stretch;overflow-y:scroll;height:80vh}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTGlzdC5zdmVsdGUiLCJzb3VyY2VzIjpbIkxpc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gICAgaW1wb3J0IEVycm9yIGZyb20gXCIuL0Vycm9yLnN2ZWx0ZVwiO1xuXG4gICAgaW1wb3J0IHsgYWN0aXZlRm9jdXMgfSBmcm9tIFwiLi4vLi4vc3RvcmVcIjtcbiAgICBcbiAgICAvLyBzZXQgdGhlIGFjdGl2ZSB0YWJcbiAgICBsZXQgYWN0aXZlO1xuICAgIGFjdGl2ZUZvY3VzLnN1YnNjcmliZSgodmFsdWUpID0+IHtcbiAgICAgICAgYWN0aXZlID0gdmFsdWU7XG4gICAgfSk7XG48L3NjcmlwdD5cblxuPGRpdiBjbGFzcz0nY29udGFpbmVyJz5cbiAgICA8RXJyb3IgdGl0bGU9eydFcnJvciAxJ30gaWQ9ezB9IGlzX2ZvY3VzPXthY3RpdmV9IGRlc2M9e1wiVGhpcyBpcyBhbiBlcnJvclwifS8+XG4gICAgPEVycm9yIHRpdGxlPXsnRXJyb3IgMid9IGlkPXsxfSBpc19mb2N1cz17YWN0aXZlfSBkZXNjPXtcIlRoaXMgaXMgYW4gZXJyb3Igb2YgYW4gZXJyb3JcIn0vPlxuICAgIDxFcnJvciB0aXRsZT17J0Vycm9yIDInfSBpZD17Mn0gaXNfZm9jdXM9e2FjdGl2ZX0gZGVzYz17XCJUaGlzIGlzIGFuIGVycm9yIG9mIGFuIGVycm9yXCJ9Lz5cbiAgICA8RXJyb3IgdGl0bGU9eydFcnJvciAyJ30gaWQ9ezN9IGlzX2ZvY3VzPXthY3RpdmV9IGRlc2M9e1wiVGhpcyBpcyBhbiBlcnJvciBvZiBhbiBlcnJvclwifS8+XG4gICAgPEVycm9yIHRpdGxlPXsnRXJyb3IgMid9IGlkPXs0fSBpc19mb2N1cz17YWN0aXZlfSBkZXNjPXtcIlRoaXMgaXMgYW4gZXJyb3Igb2YgYW4gZXJyb3JcIn0vPlxuICAgIDxFcnJvciB0aXRsZT17J0Vycm9yIDInfSBpZD17NX0gaXNfZm9jdXM9e2FjdGl2ZX0gZGVzYz17XCJUaGlzIGlzIGFuIGVycm9yIG9mIGFuIGVycm9yXCJ9Lz5cbiAgICA8RXJyb3IgdGl0bGU9eydFcnJvciAyJ30gaWQ9ezZ9IGlzX2ZvY3VzPXthY3RpdmV9IGRlc2M9e1wiVGhpcyBpcyBhbiBlcnJvciBvZiBhbiBlcnJvclwifS8+XG4gICAgPEVycm9yIHRpdGxlPXsnRXJyb3IgMid9IGlkPXs1fSBpc19mb2N1cz17YWN0aXZlfSBkZXNjPXtcIlRoaXMgaXMgYW4gZXJyb3Igb2YgYW4gZXJyb3JcIn0vPlxuICAgIDxFcnJvciB0aXRsZT17J0Vycm9yIDInfSBpZD17Nn0gaXNfZm9jdXM9e2FjdGl2ZX0gZGVzYz17XCJUaGlzIGlzIGFuIGVycm9yIG9mIGFuIGVycm9yXCJ9Lz5cbjwvZGl2PlxuXG48c3R5bGU+XG4gICAgLmNvbnRhaW5lciB7XG4gICAgICAgIHBhZGRpbmc6MTZweDtcbiAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICBnYXA6OHB4OztcbiAgICAgICAgYWxpZ24taXRlbXM6IHN0cmV0Y2g7XG4gICAgICAgIG92ZXJmbG93LXk6IHNjcm9sbDtcbiAgICAgICAgaGVpZ2h0OiA4MHZoO1xuICAgIH1cbjwvc3R5bGU+Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXlCSSxVQUFVLGVBQUMsQ0FBQyxBQUNSLFFBQVEsSUFBSSxDQUNaLFFBQVEsSUFBSSxDQUNaLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLElBQUksR0FBRyxDQUFDLENBQUMsQ0FDVCxXQUFXLENBQUUsT0FBTyxDQUNwQixVQUFVLENBQUUsTUFBTSxDQUNsQixNQUFNLENBQUUsSUFBSSxBQUNoQixDQUFDIn0= */");
    }

    function create_fragment$8(ctx) {
    	let div;
    	let error0;
    	let t0;
    	let error1;
    	let t1;
    	let error2;
    	let t2;
    	let error3;
    	let t3;
    	let error4;
    	let t4;
    	let error5;
    	let t5;
    	let error6;
    	let t6;
    	let error7;
    	let t7;
    	let error8;
    	let current;

    	error0 = new Error$1({
    			props: {
    				title: 'Error 1',
    				id: 0,
    				is_focus: /*active*/ ctx[0],
    				desc: "This is an error"
    			},
    			$$inline: true
    		});

    	error1 = new Error$1({
    			props: {
    				title: 'Error 2',
    				id: 1,
    				is_focus: /*active*/ ctx[0],
    				desc: "This is an error of an error"
    			},
    			$$inline: true
    		});

    	error2 = new Error$1({
    			props: {
    				title: 'Error 2',
    				id: 2,
    				is_focus: /*active*/ ctx[0],
    				desc: "This is an error of an error"
    			},
    			$$inline: true
    		});

    	error3 = new Error$1({
    			props: {
    				title: 'Error 2',
    				id: 3,
    				is_focus: /*active*/ ctx[0],
    				desc: "This is an error of an error"
    			},
    			$$inline: true
    		});

    	error4 = new Error$1({
    			props: {
    				title: 'Error 2',
    				id: 4,
    				is_focus: /*active*/ ctx[0],
    				desc: "This is an error of an error"
    			},
    			$$inline: true
    		});

    	error5 = new Error$1({
    			props: {
    				title: 'Error 2',
    				id: 5,
    				is_focus: /*active*/ ctx[0],
    				desc: "This is an error of an error"
    			},
    			$$inline: true
    		});

    	error6 = new Error$1({
    			props: {
    				title: 'Error 2',
    				id: 6,
    				is_focus: /*active*/ ctx[0],
    				desc: "This is an error of an error"
    			},
    			$$inline: true
    		});

    	error7 = new Error$1({
    			props: {
    				title: 'Error 2',
    				id: 5,
    				is_focus: /*active*/ ctx[0],
    				desc: "This is an error of an error"
    			},
    			$$inline: true
    		});

    	error8 = new Error$1({
    			props: {
    				title: 'Error 2',
    				id: 6,
    				is_focus: /*active*/ ctx[0],
    				desc: "This is an error of an error"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(error0.$$.fragment);
    			t0 = space();
    			create_component(error1.$$.fragment);
    			t1 = space();
    			create_component(error2.$$.fragment);
    			t2 = space();
    			create_component(error3.$$.fragment);
    			t3 = space();
    			create_component(error4.$$.fragment);
    			t4 = space();
    			create_component(error5.$$.fragment);
    			t5 = space();
    			create_component(error6.$$.fragment);
    			t6 = space();
    			create_component(error7.$$.fragment);
    			t7 = space();
    			create_component(error8.$$.fragment);
    			attr_dev(div, "class", "container svelte-1h3i19d");
    			add_location(div, file$8, 12, 0, 226);
    		},
    		l: function claim(nodes) {
    			throw new Error_1$1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(error0, div, null);
    			append_dev(div, t0);
    			mount_component(error1, div, null);
    			append_dev(div, t1);
    			mount_component(error2, div, null);
    			append_dev(div, t2);
    			mount_component(error3, div, null);
    			append_dev(div, t3);
    			mount_component(error4, div, null);
    			append_dev(div, t4);
    			mount_component(error5, div, null);
    			append_dev(div, t5);
    			mount_component(error6, div, null);
    			append_dev(div, t6);
    			mount_component(error7, div, null);
    			append_dev(div, t7);
    			mount_component(error8, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const error0_changes = {};
    			if (dirty & /*active*/ 1) error0_changes.is_focus = /*active*/ ctx[0];
    			error0.$set(error0_changes);
    			const error1_changes = {};
    			if (dirty & /*active*/ 1) error1_changes.is_focus = /*active*/ ctx[0];
    			error1.$set(error1_changes);
    			const error2_changes = {};
    			if (dirty & /*active*/ 1) error2_changes.is_focus = /*active*/ ctx[0];
    			error2.$set(error2_changes);
    			const error3_changes = {};
    			if (dirty & /*active*/ 1) error3_changes.is_focus = /*active*/ ctx[0];
    			error3.$set(error3_changes);
    			const error4_changes = {};
    			if (dirty & /*active*/ 1) error4_changes.is_focus = /*active*/ ctx[0];
    			error4.$set(error4_changes);
    			const error5_changes = {};
    			if (dirty & /*active*/ 1) error5_changes.is_focus = /*active*/ ctx[0];
    			error5.$set(error5_changes);
    			const error6_changes = {};
    			if (dirty & /*active*/ 1) error6_changes.is_focus = /*active*/ ctx[0];
    			error6.$set(error6_changes);
    			const error7_changes = {};
    			if (dirty & /*active*/ 1) error7_changes.is_focus = /*active*/ ctx[0];
    			error7.$set(error7_changes);
    			const error8_changes = {};
    			if (dirty & /*active*/ 1) error8_changes.is_focus = /*active*/ ctx[0];
    			error8.$set(error8_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(error0.$$.fragment, local);
    			transition_in(error1.$$.fragment, local);
    			transition_in(error2.$$.fragment, local);
    			transition_in(error3.$$.fragment, local);
    			transition_in(error4.$$.fragment, local);
    			transition_in(error5.$$.fragment, local);
    			transition_in(error6.$$.fragment, local);
    			transition_in(error7.$$.fragment, local);
    			transition_in(error8.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(error0.$$.fragment, local);
    			transition_out(error1.$$.fragment, local);
    			transition_out(error2.$$.fragment, local);
    			transition_out(error3.$$.fragment, local);
    			transition_out(error4.$$.fragment, local);
    			transition_out(error5.$$.fragment, local);
    			transition_out(error6.$$.fragment, local);
    			transition_out(error7.$$.fragment, local);
    			transition_out(error8.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(error0);
    			destroy_component(error1);
    			destroy_component(error2);
    			destroy_component(error3);
    			destroy_component(error4);
    			destroy_component(error5);
    			destroy_component(error6);
    			destroy_component(error7);
    			destroy_component(error8);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('List', slots, []);
    	let active;

    	activeFocus.subscribe(value => {
    		$$invalidate(0, active = value);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<List> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Error: Error$1, activeFocus, active });

    	$$self.$inject_state = $$props => {
    		if ('active' in $$props) $$invalidate(0, active = $$props.active);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [active];
    }

    class List extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {}, add_css$8);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "List",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/components/Button.svelte generated by Svelte v3.50.0 */

    const file$9 = "src/components/Button.svelte";

    function add_css$9(target) {
    	append_styles(target, "svelte-1ujl032", ".button-secondary.svelte-1ujl032{border:1px solid #808080;border-radius:8px;padding:8px 16px;background-color:#ffffff;color:#121212}.button-secondary.svelte-1ujl032:hover{background-color:#E5F0E8;animation-name:svelte-1ujl032-on-hover-button;animation-duration:100ms;cursor:pointer}@keyframes svelte-1ujl032-on-hover-button{0%{background-color:#ffffff}100%{background-color:#E5F0E8}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQnV0dG9uLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQnV0dG9uLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICAgIGV4cG9ydCBsZXQgb25DbGljaztcbiAgICBleHBvcnQgbGV0IHR5cGU7XG48L3NjcmlwdD5cblxuPGJ1dHRvbiBjbGFzcz17dHlwZSA9PSAncHJpbWFyeScgPyBcImJ1dHRvbi1zZWNvbmRhcnlcIiA6IFwiXCJ9IG9uOmNsaWNrPXtvbkNsaWNrfT5cbiAgICA8c2xvdD48L3Nsb3Q+XG48L2J1dHRvbj5cblxuPHN0eWxlPlxuICAgIC5idXR0b24tc2Vjb25kYXJ5IHtcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgIzgwODA4MDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICBwYWRkaW5nOiA4cHggMTZweDtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogI2ZmZmZmZjtcbiAgICAgICAgY29sb3I6ICMxMjEyMTI7XG4gICAgfVxuXG4gICAgLmJ1dHRvbi1zZWNvbmRhcnk6aG92ZXIge1xuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjRTVGMEU4O1xuICAgICAgICBhbmltYXRpb24tbmFtZTogb24taG92ZXItYnV0dG9uO1xuICAgICAgICBhbmltYXRpb24tZHVyYXRpb246IDEwMG1zO1xuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgfVxuXG4gICAgQGtleWZyYW1lcyBvbi1ob3Zlci1idXR0b24ge1xuICAgICAgICAwJSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjZmZmZmZmO1xuICAgICAgICB9XG4gICAgICAgIDEwMCUge1xuICAgICAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogI0U1RjBFODtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC5idXR0b24tdGVydGlhcnkge1xuICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgIGNvbG9yOiAjMjQyNDI2O1xuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgfVxuXG4gICAgLmJ1dHRvbi10ZXJ0aWFyeS1vbiB7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgY29sb3I6ICMxNjk3OTQ7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICB9XG5cbiAgICAuYnV0dG9uLXRlcnRpYXJ5OmhvdmVyIHtcbiAgICAgICAgY29sb3I6ICMxNjk3OTQ7XG4gICAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFVSSxpQkFBaUIsZUFBQyxDQUFDLEFBQ2YsTUFBTSxDQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUN6QixhQUFhLENBQUUsR0FBRyxDQUNsQixPQUFPLENBQUUsR0FBRyxDQUFDLElBQUksQ0FDakIsZ0JBQWdCLENBQUUsT0FBTyxDQUN6QixLQUFLLENBQUUsT0FBTyxBQUNsQixDQUFDLEFBRUQsZ0NBQWlCLE1BQU0sQUFBQyxDQUFDLEFBQ3JCLGdCQUFnQixDQUFFLE9BQU8sQ0FDekIsY0FBYyxDQUFFLDhCQUFlLENBQy9CLGtCQUFrQixDQUFFLEtBQUssQ0FDekIsTUFBTSxDQUFFLE9BQU8sQUFDbkIsQ0FBQyxBQUVELFdBQVcsOEJBQWdCLENBQUMsQUFDeEIsRUFBRSxBQUFDLENBQUMsQUFDQSxnQkFBZ0IsQ0FBRSxPQUFPLEFBQzdCLENBQUMsQUFDRCxJQUFJLEFBQUMsQ0FBQyxBQUNGLGdCQUFnQixDQUFFLE9BQU8sQUFDN0IsQ0FBQyxBQUNMLENBQUMifQ== */");
    }

    function create_fragment$9(ctx) {
    	let button;
    	let button_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	const block = {
    		c: function create() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			attr_dev(button, "class", button_class_value = "" + (null_to_empty(/*type*/ ctx[1] == 'primary' ? "button-secondary" : "") + " svelte-1ujl032"));
    			add_location(button, file$9, 5, 0, 65);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*onClick*/ ctx[0])) /*onClick*/ ctx[0].apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[2],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*type*/ 2 && button_class_value !== (button_class_value = "" + (null_to_empty(/*type*/ ctx[1] == 'primary' ? "button-secondary" : "") + " svelte-1ujl032"))) {
    				attr_dev(button, "class", button_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Button', slots, ['default']);
    	let { onClick } = $$props;
    	let { type } = $$props;
    	const writable_props = ['onClick', 'type'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Button> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('onClick' in $$props) $$invalidate(0, onClick = $$props.onClick);
    		if ('type' in $$props) $$invalidate(1, type = $$props.type);
    		if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ onClick, type });

    	$$self.$inject_state = $$props => {
    		if ('onClick' in $$props) $$invalidate(0, onClick = $$props.onClick);
    		if ('type' in $$props) $$invalidate(1, type = $$props.type);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [onClick, type, $$scope, slots];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { onClick: 0, type: 1 }, add_css$9);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*onClick*/ ctx[0] === undefined && !('onClick' in props)) {
    			console.warn("<Button> was created without expected prop 'onClick'");
    		}

    		if (/*type*/ ctx[1] === undefined && !('type' in props)) {
    			console.warn("<Button> was created without expected prop 'type'");
    		}
    	}

    	get onClick() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onClick(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get type() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/pages/Lint.svelte generated by Svelte v3.50.0 */
    const file$a = "src/pages/Lint.svelte";

    function add_css$a(target) {
    	append_styles(target, "svelte-11k933y", ".container.svelte-11k933y{height:653px;justify-content:flex-start;display:flex;flex-direction:column}.body.svelte-11k933y{flex-grow:1;display:grid;grid-template-columns:1fr 2fr}.footer.svelte-11k933y{background-color:white;padding:16px 24px;display:flex;flex-direction:row;justify-content:flex-end}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTGludC5zdmVsdGUiLCJzb3VyY2VzIjpbIkxpbnQuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gICAgaW1wb3J0IE1lbnUgZnJvbSAnLi4vY29tcG9uZW50cy9NZW51L01lbnUuc3ZlbHRlJ1xuICAgIGltcG9ydCBMaXN0IGZyb20gJy4uL2NvbXBvbmVudHMvTGlzdC9MaXN0LnN2ZWx0ZSdcbiAgICBpbXBvcnQgQnV0dG9uIGZyb20gJy4uL2NvbXBvbmVudHMvQnV0dG9uLnN2ZWx0ZSc7XG48L3NjcmlwdD5cblxuPGRpdiBjbGFzcz0nY29udGFpbmVyJz5cbiAgICA8ZGl2IGNsYXNzPSdib2R5Jz5cbiAgICAgICAgPE1lbnUvPlxuICAgICAgICA8TGlzdC8+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz0nZm9vdGVyJz5cbiAgICAgICAgPEJ1dHRvbiB0eXBlPXsnbGluayd9Pkxpbms8L0J1dHRvbj5cbiAgICAgICAgPEJ1dHRvbiB0eXBlPXsncHJpbWFyeSd9PlRFU1Q8L0J1dHRvbj5cbiAgICA8L2Rpdj5cbjwvZGl2PlxuXG5cbjxzdHlsZT5cbiAgICAuY29udGFpbmVyIHtcbiAgICAgICAgaGVpZ2h0OiA2NTNweDtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIH1cblxuICAgIC5ib2R5IHtcbiAgICAgICAgZmxleC1ncm93OiAxO1xuICAgICAgICBkaXNwbGF5OiBncmlkO1xuICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmciAyZnI7XG4gICAgfVxuXG4gICAgLmZvb3RlciB7XG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6IHdoaXRlO1xuICAgICAgICBwYWRkaW5nOiAxNnB4IDI0cHg7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7IFxuICAgIH1cbjwvc3R5bGU+Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQW1CSSxVQUFVLGVBQUMsQ0FBQyxBQUNSLE1BQU0sQ0FBRSxLQUFLLENBQ2IsZUFBZSxDQUFFLFVBQVUsQ0FDM0IsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxBQUMxQixDQUFDLEFBRUQsS0FBSyxlQUFDLENBQUMsQUFDSCxTQUFTLENBQUUsQ0FBQyxDQUNaLE9BQU8sQ0FBRSxJQUFJLENBQ2IscUJBQXFCLENBQUUsR0FBRyxDQUFDLEdBQUcsQUFDbEMsQ0FBQyxBQUVELE9BQU8sZUFBQyxDQUFDLEFBQ0wsZ0JBQWdCLENBQUUsS0FBSyxDQUN2QixPQUFPLENBQUUsSUFBSSxDQUFDLElBQUksQ0FDbEIsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsR0FBRyxDQUNuQixlQUFlLENBQUUsUUFBUSxBQUM3QixDQUFDIn0= */");
    }

    // (13:8) <Button type={'link'}>
    function create_default_slot_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Link");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(13:8) <Button type={'link'}>",
    		ctx
    	});

    	return block;
    }

    // (14:8) <Button type={'primary'}>
    function create_default_slot(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("TEST");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(14:8) <Button type={'primary'}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div2;
    	let div0;
    	let menu;
    	let t0;
    	let list;
    	let t1;
    	let div1;
    	let button0;
    	let t2;
    	let button1;
    	let current;
    	menu = new Menu({ $$inline: true });
    	list = new List({ $$inline: true });

    	button0 = new Button({
    			props: {
    				type: 'link',
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button1 = new Button({
    			props: {
    				type: 'primary',
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			create_component(menu.$$.fragment);
    			t0 = space();
    			create_component(list.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			create_component(button0.$$.fragment);
    			t2 = space();
    			create_component(button1.$$.fragment);
    			attr_dev(div0, "class", "body svelte-11k933y");
    			add_location(div0, file$a, 7, 4, 210);
    			attr_dev(div1, "class", "footer svelte-11k933y");
    			add_location(div1, file$a, 11, 4, 276);
    			attr_dev(div2, "class", "container svelte-11k933y");
    			add_location(div2, file$a, 6, 0, 182);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			mount_component(menu, div0, null);
    			append_dev(div0, t0);
    			mount_component(list, div0, null);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			mount_component(button0, div1, null);
    			append_dev(div1, t2);
    			mount_component(button1, div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const button0_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const button1_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu.$$.fragment, local);
    			transition_in(list.$$.fragment, local);
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu.$$.fragment, local);
    			transition_out(list.$$.fragment, local);
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(menu);
    			destroy_component(list);
    			destroy_component(button0);
    			destroy_component(button1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Lint', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Lint> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Menu, List, Button });
    	return [];
    }

    class Lint extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {}, add_css$a);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Lint",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* src/PluginUI.svelte generated by Svelte v3.50.0 */
    const file$b = "src/PluginUI.svelte";

    function add_css$b(target) {
    	append_styles(target, "svelte-kczk98", "@import url(\"https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&display=swap\");body{font:12px \"Libre Franklin\", \"cursive\";font-family:\"Libre Franklin\", \"cursive\";text-align:center;margin:0;background-color:white}.text-sm-reg{font:12px \"Libre Franklin\";font-weight:400}.text-sm-med{font:12px \"Libre Franklin\";font-weight:500}.text-md-reg{font:14px \"Libre Franklin\";font-weight:400}.text-md-med{font:14px \"Libre Franklin\";font-weight:500}.text-lg-med{font:16px \"Libre Franklin\";font-weight:500}.text-lg-semibold{font:16px \"Libre Franklin\";font-weight:600}.text-xl-semibold{font:18px \"Libre Franklin\";font-weight:600}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGx1Z2luVUkuc3ZlbHRlIiwic291cmNlcyI6WyJQbHVnaW5VSS5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cblx0aW1wb3J0IFRhYmJhciBmcm9tIFwiLi9jb21wb25lbnRzL1RhYmJhci5zdmVsdGVcIjtcblx0aW1wb3J0IExpbnQgZnJvbSBcIi4vcGFnZXMvTGludC5zdmVsdGVcIjtcblxuXHRmdW5jdGlvbiBjcmVhdGVTaGFwZXMoKSB7XG5cdFx0cGFyZW50LnBvc3RNZXNzYWdlKFxuXHRcdFx0e1xuXHRcdFx0XHRwbHVnaW5NZXNzYWdlOiB7XG5cdFx0XHRcdFx0dHlwZTogXCJjcmVhdGUtc2hhcGVzXCIsXG5cdFx0XHRcdFx0Y291bnQ6IGNvdW50LFxuXHRcdFx0XHRcdHNoYXBlOiBzZWxlY3RlZFNoYXBlLnZhbHVlLFxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdFwiKlwiXG5cdFx0KTtcblx0fVxuXG5cdGZ1bmN0aW9uIGNhbmNlbCgpIHtcblx0XHRwYXJlbnQucG9zdE1lc3NhZ2UoeyBwbHVnaW5NZXNzYWdlOiB7IHR5cGU6IFwiY2FuY2VsXCIgfSB9LCBcIipcIik7XG5cdH1cbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwiXCI+XG5cdDxUYWJiYXIgLz5cblx0PExpbnQgLz5cbjwvZGl2PlxuXG48c3R5bGUgZ2xvYmFsPlxuXHRAaW1wb3J0IHVybChcImh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzMj9mYW1pbHk9TGlicmUrRnJhbmtsaW46d2dodEA0MDA7NTAwOzYwMDs3MDAmZGlzcGxheT1zd2FwXCIpO1xuXG5cdC8qIEJvZHkgU3RydWN0dXJlcyAqL1xuXHQ6Z2xvYmFsKGJvZHkpIHtcblx0XHRmb250OiAxMnB4IFwiTGlicmUgRnJhbmtsaW5cIiwgXCJjdXJzaXZlXCI7XG5cdFx0Zm9udC1mYW1pbHk6IFwiTGlicmUgRnJhbmtsaW5cIiwgXCJjdXJzaXZlXCI7XG5cdFx0dGV4dC1hbGlnbjogY2VudGVyO1xuXHRcdG1hcmdpbjogMDtcblx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTtcblx0fVxuXG5cdC8qIFRleHQgKi9cblx0Omdsb2JhbCgudGV4dC1zbS1yZWcpIHtcblx0XHRmb250OiAxMnB4IFwiTGlicmUgRnJhbmtsaW5cIjtcblx0XHRmb250LXdlaWdodDogNDAwO1xuXHR9XG5cblx0Omdsb2JhbCgudGV4dC1zbS1tZWQpIHtcblx0XHRmb250OiAxMnB4IFwiTGlicmUgRnJhbmtsaW5cIjtcblx0XHRmb250LXdlaWdodDogNTAwO1xuXHR9XG5cblx0Omdsb2JhbCgudGV4dC1tZC1yZWcpIHtcblx0XHRmb250OiAxNHB4IFwiTGlicmUgRnJhbmtsaW5cIjtcblx0XHRmb250LXdlaWdodDogNDAwO1xuXHR9XG5cblx0Omdsb2JhbCgudGV4dC1tZC1tZWQpIHtcblx0XHRmb250OiAxNHB4IFwiTGlicmUgRnJhbmtsaW5cIjtcblx0XHRmb250LXdlaWdodDogNTAwO1xuXHR9XG5cblx0Omdsb2JhbCgudGV4dC1sZy1tZWQpIHtcblx0XHRmb250OiAxNnB4IFwiTGlicmUgRnJhbmtsaW5cIjtcblx0XHRmb250LXdlaWdodDogNTAwO1xuXHR9XG5cblx0Omdsb2JhbCgudGV4dC1sZy1zZW1pYm9sZCkge1xuXHRcdGZvbnQ6IDE2cHggXCJMaWJyZSBGcmFua2xpblwiO1xuXHRcdGZvbnQtd2VpZ2h0OiA2MDA7XG5cdH1cblxuXHQ6Z2xvYmFsKC50ZXh0LXhsLXNlbWlib2xkKSB7XG5cdFx0Zm9udDogMThweCBcIkxpYnJlIEZyYW5rbGluXCI7XG5cdFx0Zm9udC13ZWlnaHQ6IDYwMDtcblx0fVxuXHQvKiBBZGQgYWRkaXRpb25hbCBnbG9iYWwgb3Igc2NvcGVkIHN0eWxlcyBoZXJlICovXG48L3N0eWxlPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQTRCQyxRQUFRLElBQUksMkZBQTJGLENBQUMsQ0FBQyxBQUdqRyxJQUFJLEFBQUUsQ0FBQyxBQUNkLElBQUksQ0FBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxTQUFTLENBQ3RDLFdBQVcsQ0FBRSxnQkFBZ0IsQ0FBQyxDQUFDLFNBQVMsQ0FDeEMsVUFBVSxDQUFFLE1BQU0sQ0FDbEIsTUFBTSxDQUFFLENBQUMsQ0FDVCxnQkFBZ0IsQ0FBRSxLQUFLLEFBQ3hCLENBQUMsQUFHTyxZQUFZLEFBQUUsQ0FBQyxBQUN0QixJQUFJLENBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUMzQixXQUFXLENBQUUsR0FBRyxBQUNqQixDQUFDLEFBRU8sWUFBWSxBQUFFLENBQUMsQUFDdEIsSUFBSSxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0IsV0FBVyxDQUFFLEdBQUcsQUFDakIsQ0FBQyxBQUVPLFlBQVksQUFBRSxDQUFDLEFBQ3RCLElBQUksQ0FBRSxJQUFJLENBQUMsZ0JBQWdCLENBQzNCLFdBQVcsQ0FBRSxHQUFHLEFBQ2pCLENBQUMsQUFFTyxZQUFZLEFBQUUsQ0FBQyxBQUN0QixJQUFJLENBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUMzQixXQUFXLENBQUUsR0FBRyxBQUNqQixDQUFDLEFBRU8sWUFBWSxBQUFFLENBQUMsQUFDdEIsSUFBSSxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0IsV0FBVyxDQUFFLEdBQUcsQUFDakIsQ0FBQyxBQUVPLGlCQUFpQixBQUFFLENBQUMsQUFDM0IsSUFBSSxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0IsV0FBVyxDQUFFLEdBQUcsQUFDakIsQ0FBQyxBQUVPLGlCQUFpQixBQUFFLENBQUMsQUFDM0IsSUFBSSxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0IsV0FBVyxDQUFFLEdBQUcsQUFDakIsQ0FBQyJ9 */");
    }

    function create_fragment$b(ctx) {
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
    			add_location(div, file$b, 22, 0, 386);
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
    		id: create_fragment$b.name,
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

    function instance$b($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {}, add_css$b);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PluginUI",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    const app = new PluginUI({
    	target: document.body,
    });

    return app;

}());
