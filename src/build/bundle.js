
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
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
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
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
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
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
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
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
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
    const activeTab = writable('page');

    // current active menu
    const activeMenu = writable('color');

    // current focus
    const activeFocusPage = writable(-1);
    const activeFocusSelection = writable(-1);

    // current active option
    const activeOption = writable('tds');

    // ran or not
    const ranPage = writable(false);

    // ran or not selection
    const ranSelection = writable(false);

    // error list per page
    const colorPage =  writable([{id: '3:1192', type: 'color', desc: 'Stroke color', name: 'Wrong Color 1'}, {id: '23:1192', type: 'color', desc: 'Stroke color', name: 'Navigation'}]);
    const colorIgnorePage = writable([]);
    const fontPage = writable([{id: '3:1192', type: 'font', desc: 'Stroke color', name: 'Wrong Font', status: false}]);
    const fontIgnorePage = writable([]);

    // error list per page
    const colorSelection =  writable([{id: '3:1192', type: 'color', desc: 'Stroke color', name: 'Navigation', status: false}, {id: '23:1192', type: 'color', desc: 'Stroke color', name: 'Navigation', status: false}]);
    const colorIgnoreSelection = writable([]);
    const fontSelection = writable([{id: '3:1192', type: 'font', desc: 'Stroke color', name: 'Navigation', status: false}, {id: '23:1192', type: 'font', desc: 'Stroke color', name: 'Navigation', status: false}]);
    const fontIgnoreSelection = writable([]);

    /* src\components\Tab.svelte generated by Svelte v3.50.0 */
    const file = "src\\components\\Tab.svelte";

    function add_css(target) {
    	append_styles(target, "svelte-1vcefi9", ".tab.svelte-1vcefi9{margin:0px 4px;padding:16px 12px 14px 12px;display:flex;flex-direction:row;justify-content:center;gap:8px;color:#666666;border-bottom:2px solid #FFFFFF;border-radius:4px 4px 0px 0px}.tab.svelte-1vcefi9:hover{color:#004C45;cursor:pointer;transition:all 500ms}.tab--state-active.svelte-1vcefi9{color:#004C45;border-bottom:2px solid #000000;border-radius:4px 4px 0px 0px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFiLnN2ZWx0ZSIsInNvdXJjZXMiOlsiVGFiLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxyXG4gICAgaW1wb3J0IHsgYWN0aXZlVGFiLCBhY3RpdmVGb2N1c1BhZ2UsIGFjdGl2ZUZvY3VzU2VsZWN0aW9uIH0gZnJvbSBcIi4uL3N0b3JlXCI7XHJcbiAgICBleHBvcnQgbGV0IGlzQWN0aXZlO1xyXG4gICAgZXhwb3J0IGxldCBuYW1lO1xyXG4gICAgZXhwb3J0IGxldCBpZDtcclxuXHJcbiAgICAvLyBzZXQgY3VycmVudCB0YWJcclxuICAgIGZ1bmN0aW9uIG9uQ2xpY2soKSB7XHJcbiAgICAgICAgYWN0aXZlVGFiLnNldChpZClcclxuICAgICAgICBhY3RpdmVGb2N1c1BhZ2Uuc2V0KC0xKVxyXG4gICAgICAgIGFjdGl2ZUZvY3VzU2VsZWN0aW9uLnNldCgtMSlcclxuICAgIH1cclxuPC9zY3JpcHQ+XHJcblxyXG48ZGl2XHJcbiAgICBjbGFzcz17YHRhYiB0ZXh0LXNtLW1lZCAke1xyXG4gICAgICAgIGlzQWN0aXZlID8gXCJ0YWItLXN0YXRlLWFjdGl2ZVwiIDogXCJ0YWJcIlxyXG4gICAgfWB9XHJcbiAgICBvbjpjbGljaz17b25DbGlja31cclxuPlxyXG4gICAge25hbWV9XHJcbjwvZGl2PlxyXG5cclxuPHN0eWxlPlxyXG4gICAgLnRhYiB7XHJcbiAgICAgICAgbWFyZ2luOiAwcHggNHB4O1xyXG4gICAgICAgIHBhZGRpbmc6IDE2cHggMTJweCAxNHB4IDEycHg7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xyXG4gICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICAgIGdhcDogOHB4O1xyXG4gICAgICAgIGNvbG9yOiAjNjY2NjY2O1xyXG4gICAgICAgIGJvcmRlci1ib3R0b206IDJweCBzb2xpZCAjRkZGRkZGO1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweCA0cHggMHB4IDBweDtcclxuICAgIH1cclxuICAgIC50YWI6aG92ZXIge1xyXG4gICAgICAgIGNvbG9yOiAjMDA0QzQ1O1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgICB0cmFuc2l0aW9uOiBhbGwgNTAwbXM7XHJcbiAgICB9XHJcblxyXG4gICAgLnRhYi0tc3RhdGUtYWN0aXZlIHtcclxuICAgICAgICBjb2xvcjogIzAwNEM0NTtcclxuICAgICAgICBib3JkZXItYm90dG9tOiAycHggc29saWQgIzAwMDAwMDtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHggNHB4IDBweCAwcHg7XHJcbiAgICB9XHJcbjwvc3R5bGU+XHJcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUF3QkksSUFBSSxlQUFDLENBQUMsQUFDRixNQUFNLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FDZixPQUFPLENBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUM1QixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxNQUFNLENBQ3ZCLEdBQUcsQ0FBRSxHQUFHLENBQ1IsS0FBSyxDQUFFLE9BQU8sQ0FDZCxhQUFhLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQ2hDLGFBQWEsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEFBQ2xDLENBQUMsQUFDRCxtQkFBSSxNQUFNLEFBQUMsQ0FBQyxBQUNSLEtBQUssQ0FBRSxPQUFPLENBQ2QsTUFBTSxDQUFFLE9BQU8sQ0FDZixVQUFVLENBQUUsR0FBRyxDQUFDLEtBQUssQUFDekIsQ0FBQyxBQUVELGtCQUFrQixlQUFDLENBQUMsQUFDaEIsS0FBSyxDQUFFLE9BQU8sQ0FDZCxhQUFhLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQ2hDLGFBQWEsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEFBQ2xDLENBQUMifQ== */");
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
    			attr_dev(div, "class", div_class_value = "" + (null_to_empty(`tab text-sm-med ${/*isActive*/ ctx[0] ? "tab--state-active" : "tab"}`) + " svelte-1vcefi9"));
    			add_location(div, file, 14, 0, 330);
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

    			if (dirty & /*isActive*/ 1 && div_class_value !== (div_class_value = "" + (null_to_empty(`tab text-sm-med ${/*isActive*/ ctx[0] ? "tab--state-active" : "tab"}`) + " svelte-1vcefi9"))) {
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
    		activeFocusPage.set(-1);
    		activeFocusSelection.set(-1);
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

    	$$self.$capture_state = () => ({
    		activeTab,
    		activeFocusPage,
    		activeFocusSelection,
    		isActive,
    		name,
    		id,
    		onClick
    	});

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

    /* src\components\Tabbar.svelte generated by Svelte v3.50.0 */
    const file$1 = "src\\components\\Tabbar.svelte";

    function add_css$1(target) {
    	append_styles(target, "svelte-52k52l", ".tabbar.svelte-52k52l{display:flex;grid-gap:16px;border-bottom-style:solid;border-color:#d5d5d5;border-width:1px;justify-items:center;align-items:center}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFiYmFyLnN2ZWx0ZSIsInNvdXJjZXMiOlsiVGFiYmFyLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxyXG4gICAgaW1wb3J0IFRhYiBmcm9tIFwiLi9UYWIuc3ZlbHRlXCI7XHJcbiAgICBpbXBvcnQge2FjdGl2ZVRhYiB9IGZyb20gJy4uL3N0b3JlJ1xyXG5cclxuICAgIC8vIHNldCB0aGUgYWN0aXZlIHRhYlxyXG4gICAgbGV0IGFjdGl2ZTtcclxuICAgIGFjdGl2ZVRhYi5zdWJzY3JpYmUodmFsdWUgPT4ge1xyXG4gICAgICAgIGFjdGl2ZSA9IHZhbHVlO1xyXG4gICAgfSlcclxuPC9zY3JpcHQ+XHJcblxyXG48ZGl2IGNsYXNzPVwidGFiYmFyXCI+XHJcbiAgICA8VGFiIG5hbWU9e1wiUGFnZVwifSBpZD17XCJwYWdlXCJ9IGlzQWN0aXZlPXthY3RpdmUgPT0gXCJwYWdlXCJ9Lz5cclxuICAgIDxUYWIgbmFtZT17XCJTZWxlY3Rpb25cIn0gaWQ9e1wic2VsZWN0aW9uXCJ9IGlzQWN0aXZlPXthY3RpdmUgPT0gXCJzZWxlY3Rpb25cIn0vPlxyXG4gICAgPFRhYiBuYW1lPXtcIkNvbmZpZ3VyYXRpb25cIn0gaWQ9e1wiY29uZmlnXCJ9IGlzQWN0aXZlPXthY3RpdmUgPT0gXCJjb25maWdcIn0vPlxyXG48L2Rpdj5cclxuXHJcbjxzdHlsZT5cclxuICAgIC50YWJiYXIge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZ3JpZC1nYXA6IDE2cHg7XHJcbiAgICAgICAgYm9yZGVyLWJvdHRvbS1zdHlsZTogc29saWQ7XHJcbiAgICAgICAgYm9yZGVyLWNvbG9yOiAjZDVkNWQ1O1xyXG4gICAgICAgIGJvcmRlci13aWR0aDogMXB4O1xyXG4gICAgICAgIGp1c3RpZnktaXRlbXM6IGNlbnRlcjtcclxuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgfVxyXG48L3N0eWxlPlxyXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBa0JJLE9BQU8sY0FBQyxDQUFDLEFBQ0wsT0FBTyxDQUFFLElBQUksQ0FDYixRQUFRLENBQUUsSUFBSSxDQUNkLG1CQUFtQixDQUFFLEtBQUssQ0FDMUIsWUFBWSxDQUFFLE9BQU8sQ0FDckIsWUFBWSxDQUFFLEdBQUcsQ0FDakIsYUFBYSxDQUFFLE1BQU0sQ0FDckIsV0FBVyxDQUFFLE1BQU0sQUFDdkIsQ0FBQyJ9 */");
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
    				id: "page",
    				isActive: /*active*/ ctx[0] == "page"
    			},
    			$$inline: true
    		});

    	tab1 = new Tab({
    			props: {
    				name: "Selection",
    				id: "selection",
    				isActive: /*active*/ ctx[0] == "selection"
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
    			add_location(div, file$1, 11, 0, 216);
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
    			if (dirty & /*active*/ 1) tab0_changes.isActive = /*active*/ ctx[0] == "page";
    			tab0.$set(tab0_changes);
    			const tab1_changes = {};
    			if (dirty & /*active*/ 1) tab1_changes.isActive = /*active*/ ctx[0] == "selection";
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

    /* src\components\Radio.svelte generated by Svelte v3.50.0 */

    const file$2 = "src\\components\\Radio.svelte";

    function add_css$2(target) {
    	append_styles(target, "svelte-ff0omp", ".radio-button.svelte-ff0omp{margin-right:8px;width:16px;height:16px;border-radius:50%;box-shadow:inset 0 0 0 1px #808080;background-color:#ffffff}.radio-button.checked.svelte-ff0omp{box-shadow:inset 0 0 0 5px #004c45}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUmFkaW8uc3ZlbHRlIiwic291cmNlcyI6WyJSYWRpby5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cclxuICAgIGV4cG9ydCBsZXQgY2hlY2tlZDtcclxuPC9zY3JpcHQ+XHJcblxyXG48ZGl2IGNsYXNzPVwicmFkaW8tYnV0dG9uIHtjaGVja2VkID8gJ2NoZWNrZWQnIDogJyd9XCIgLz5cclxuXHJcbjxzdHlsZT5cclxuICAgIC5yYWRpby1idXR0b24ge1xyXG4gICAgICAgIG1hcmdpbi1yaWdodDogOHB4O1xyXG4gICAgICAgIHdpZHRoOiAxNnB4O1xyXG4gICAgICAgIGhlaWdodDogMTZweDtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgICAgYm94LXNoYWRvdzogaW5zZXQgMCAwIDAgMXB4ICM4MDgwODA7XHJcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogI2ZmZmZmZjtcclxuICAgIH1cclxuXHJcbiAgICAucmFkaW8tYnV0dG9uLmNoZWNrZWQge1xyXG4gICAgICAgIGJveC1zaGFkb3c6IGluc2V0IDAgMCAwIDVweCAjMDA0YzQ1O1xyXG4gICAgfVxyXG48L3N0eWxlPlxyXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBT0ksYUFBYSxjQUFDLENBQUMsQUFDWCxZQUFZLENBQUUsR0FBRyxDQUNqQixLQUFLLENBQUUsSUFBSSxDQUNYLE1BQU0sQ0FBRSxJQUFJLENBQ1osYUFBYSxDQUFFLEdBQUcsQ0FDbEIsVUFBVSxDQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUNuQyxnQkFBZ0IsQ0FBRSxPQUFPLEFBQzdCLENBQUMsQUFFRCxhQUFhLFFBQVEsY0FBQyxDQUFDLEFBQ25CLFVBQVUsQ0FBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQUFDdkMsQ0FBQyJ9 */");
    }

    function create_fragment$2(ctx) {
    	let div;
    	let div_class_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", div_class_value = "radio-button " + (/*checked*/ ctx[0] ? 'checked' : '') + " svelte-ff0omp");
    			add_location(div, file$2, 4, 0, 48);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*checked*/ 1 && div_class_value !== (div_class_value = "radio-button " + (/*checked*/ ctx[0] ? 'checked' : '') + " svelte-ff0omp")) {
    				attr_dev(div, "class", div_class_value);
    			}
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
    	validate_slots('Radio', slots, []);
    	let { checked } = $$props;
    	const writable_props = ['checked'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Radio> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('checked' in $$props) $$invalidate(0, checked = $$props.checked);
    	};

    	$$self.$capture_state = () => ({ checked });

    	$$self.$inject_state = $$props => {
    		if ('checked' in $$props) $$invalidate(0, checked = $$props.checked);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [checked];
    }

    class Radio extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { checked: 0 }, add_css$2);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Radio",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*checked*/ ctx[0] === undefined && !('checked' in props)) {
    			console.warn("<Radio> was created without expected prop 'checked'");
    		}
    	}

    	get checked() {
    		throw new Error("<Radio>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set checked(value) {
    		throw new Error("<Radio>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Option\Option.svelte generated by Svelte v3.50.0 */
    const file$3 = "src\\components\\Option\\Option.svelte";

    function add_css$3(target) {
    	append_styles(target, "svelte-1o25c6l", ".container.svelte-1o25c6l{padding:16px 24px;border:solid 1px #d2d2d2;border-radius:8px;text-align:left;display:flex;gap:4px;flex-direction:column;background-color:white}.container.svelte-1o25c6l:hover{background-color:#F2F2F2;border-color:#808080;cursor:pointer}.container--active.svelte-1o25c6l{padding:16px 24px;border:solid 1px #172d2d;border-radius:8px;text-align:left;display:flex;gap:4px;flex-direction:column;background-color:#d5ebdb;cursor:pointer}.header.svelte-1o25c6l{display:flex;flex-direction:row;justify-content:space-between}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiT3B0aW9uLnN2ZWx0ZSIsInNvdXJjZXMiOlsiT3B0aW9uLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxyXG4gICAgaW1wb3J0IFJhZGlvIGZyb20gXCIuLi9SYWRpby5zdmVsdGVcIjtcclxuICAgIGltcG9ydCB7IG9uTW91bnQgfSBmcm9tIFwic3ZlbHRlXCI7XHJcbiAgICBpbXBvcnQgeyBhY3RpdmVPcHRpb24gfSBmcm9tIFwiLi4vLi4vc3RvcmVcIjtcclxuXHJcbiAgICAvLyBzZXQgdGhlIGFjdGl2ZSBvcHRpb25cclxuICAgIGxldCBhY3RpdmU7XHJcbiAgICBhY3RpdmVPcHRpb24uc3Vic2NyaWJlKCh2YWx1ZSkgPT4ge1xyXG4gICAgICAgIGFjdGl2ZSA9IHZhbHVlO1xyXG4gICAgfSk7XHJcblxyXG4gICAgZXhwb3J0IGxldCBpZDtcclxuXHJcbiAgICBsZXQgdGl0bGUgPSBcIlwiO1xyXG4gICAgbGV0IGRlc2MgPSBcIlwiO1xyXG5cclxuICAgIG9uTW91bnQoKCkgPT4ge1xyXG4gICAgICAgIGlmIChpZCA9PSBcInRkc1wiKSB7XHJcbiAgICAgICAgICAgIHRpdGxlID0gXCJUcnVsaW9vIERlc2lnbiBTeXN0ZW1cIjtcclxuICAgICAgICAgICAgZGVzYyA9IFwiU3RpY2sgdy8gdGhlIHRyaWVkIGFuZCB0cnVlXCI7XHJcbiAgICAgICAgfSBlbHNlIGlmIChpZCA9PSBcImRvY3ZcIikge1xyXG4gICAgICAgICAgICB0aXRsZSA9IFwiRG9jVlwiO1xyXG4gICAgICAgICAgICBkZXNjID1cclxuICAgICAgICAgICAgICAgIFwiRW5hYmxlcyB0aGUgdXNhZ2Ugb2YgU0YgUHJvLCBSb2JvdG8gYW5kIFZpZXdmaW5kZXIgUGFzc3JhdGVcIjtcclxuICAgICAgICB9IGVsc2UgaWYgKGlkID09IFwidmlzdWFsXCIpIHtcclxuICAgICAgICAgICAgdGl0bGUgPSBcIlZpc3VhbCBUZWFtXCI7XHJcbiAgICAgICAgICAgIGRlc2MgPVxyXG4gICAgICAgICAgICAgICAgXCJTdXBlciBzdHJpY3Qgc2V0dGluZ3MgdGhhdCB2aXN1YWwgdGVhbSB1c2VzIHRvIGNoZWNrIGZvciBmcmFtaW5nIVwiO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGZ1bmN0aW9uIG9uQ2xpY2soKSB7XHJcbiAgICAgICAgYWN0aXZlT3B0aW9uLnNldChpZCk7XHJcbiAgICB9XHJcbjwvc2NyaXB0PlxyXG5cclxuPGRpdiBjbGFzcz17YWN0aXZlID09IGlkID8gJ2NvbnRhaW5lci0tYWN0aXZlJyA6ICdjb250YWluZXInfSBvbjpjbGljaz17b25DbGlja30+XHJcbiAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyIHRleHQtbWQtbWVkXCI+XHJcbiAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAge3RpdGxlfVxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxkaXY+PFJhZGlvIGNoZWNrZWQ9e2FjdGl2ZSA9PSBpZH0vPjwvZGl2PlxyXG4gICAgPC9kaXY+XHJcbiAgICA8ZGl2PlxyXG4gICAgICAgIHtkZXNjfVxyXG4gICAgPC9kaXY+XHJcbjwvZGl2PlxyXG5cclxuPHN0eWxlPlxyXG4gICAgLmNvbnRhaW5lciB7XHJcbiAgICAgICAgcGFkZGluZzogMTZweCAyNHB4O1xyXG4gICAgICAgIGJvcmRlcjogc29saWQgMXB4ICNkMmQyZDI7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICAgIHRleHQtYWxpZ246IGxlZnQ7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBnYXA6IDRweDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6IHdoaXRlO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250YWluZXI6aG92ZXIge1xyXG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6ICNGMkYyRjI7XHJcbiAgICAgICAgYm9yZGVyLWNvbG9yOiAjODA4MDgwO1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgIH1cclxuICAgIC5jb250YWluZXItLWFjdGl2ZSB7XHJcbiAgICAgICAgcGFkZGluZzogMTZweCAyNHB4O1xyXG4gICAgICAgIGJvcmRlcjogc29saWQgMXB4ICMxNzJkMmQ7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICAgIHRleHQtYWxpZ246IGxlZnQ7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBnYXA6IDRweDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6ICNkNWViZGI7XHJcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXIge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcclxuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XHJcbiAgICB9XHJcbjwvc3R5bGU+XHJcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFpREksVUFBVSxlQUFDLENBQUMsQUFDUixPQUFPLENBQUUsSUFBSSxDQUFDLElBQUksQ0FDbEIsTUFBTSxDQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUN6QixhQUFhLENBQUUsR0FBRyxDQUNsQixVQUFVLENBQUUsSUFBSSxDQUNoQixPQUFPLENBQUUsSUFBSSxDQUNiLEdBQUcsQ0FBRSxHQUFHLENBQ1IsY0FBYyxDQUFFLE1BQU0sQ0FDdEIsZ0JBQWdCLENBQUUsS0FBSyxBQUMzQixDQUFDLEFBRUQseUJBQVUsTUFBTSxBQUFDLENBQUMsQUFDZCxnQkFBZ0IsQ0FBRSxPQUFPLENBQ3pCLFlBQVksQ0FBRSxPQUFPLENBQ3JCLE1BQU0sQ0FBRSxPQUFPLEFBQ25CLENBQUMsQUFDRCxrQkFBa0IsZUFBQyxDQUFDLEFBQ2hCLE9BQU8sQ0FBRSxJQUFJLENBQUMsSUFBSSxDQUNsQixNQUFNLENBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQ3pCLGFBQWEsQ0FBRSxHQUFHLENBQ2xCLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsR0FBRyxDQUFFLEdBQUcsQ0FDUixjQUFjLENBQUUsTUFBTSxDQUN0QixnQkFBZ0IsQ0FBRSxPQUFPLENBQ3pCLE1BQU0sQ0FBRSxPQUFPLEFBQ25CLENBQUMsQUFFRCxPQUFPLGVBQUMsQ0FBQyxBQUNMLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLEdBQUcsQ0FDbkIsZUFBZSxDQUFFLGFBQWEsQUFDbEMsQ0FBQyJ9 */");
    }

    function create_fragment$3(ctx) {
    	let div4;
    	let div2;
    	let div0;
    	let t0;
    	let t1;
    	let div1;
    	let radio;
    	let t2;
    	let div3;
    	let t3;
    	let div4_class_value;
    	let current;
    	let mounted;
    	let dispose;

    	radio = new Radio({
    			props: {
    				checked: /*active*/ ctx[1] == /*id*/ ctx[0]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text(/*title*/ ctx[2]);
    			t1 = space();
    			div1 = element("div");
    			create_component(radio.$$.fragment);
    			t2 = space();
    			div3 = element("div");
    			t3 = text(/*desc*/ ctx[3]);
    			add_location(div0, file$3, 38, 8, 1050);
    			add_location(div1, file$3, 41, 8, 1102);
    			attr_dev(div2, "class", "header text-md-med svelte-1o25c6l");
    			add_location(div2, file$3, 37, 4, 1008);
    			add_location(div3, file$3, 43, 4, 1162);

    			attr_dev(div4, "class", div4_class_value = "" + (null_to_empty(/*active*/ ctx[1] == /*id*/ ctx[0]
    			? 'container--active'
    			: 'container') + " svelte-1o25c6l"));

    			add_location(div4, file$3, 36, 0, 921);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div2);
    			append_dev(div2, div0);
    			append_dev(div0, t0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			mount_component(radio, div1, null);
    			append_dev(div4, t2);
    			append_dev(div4, div3);
    			append_dev(div3, t3);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div4, "click", /*onClick*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*title*/ 4) set_data_dev(t0, /*title*/ ctx[2]);
    			const radio_changes = {};
    			if (dirty & /*active, id*/ 3) radio_changes.checked = /*active*/ ctx[1] == /*id*/ ctx[0];
    			radio.$set(radio_changes);
    			if (!current || dirty & /*desc*/ 8) set_data_dev(t3, /*desc*/ ctx[3]);

    			if (!current || dirty & /*active, id*/ 3 && div4_class_value !== (div4_class_value = "" + (null_to_empty(/*active*/ ctx[1] == /*id*/ ctx[0]
    			? 'container--active'
    			: 'container') + " svelte-1o25c6l"))) {
    				attr_dev(div4, "class", div4_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(radio.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(radio.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			destroy_component(radio);
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
    	validate_slots('Option', slots, []);
    	let active;

    	activeOption.subscribe(value => {
    		$$invalidate(1, active = value);
    	});

    	let { id } = $$props;
    	let title = "";
    	let desc = "";

    	onMount(() => {
    		if (id == "tds") {
    			$$invalidate(2, title = "Trulioo Design System");
    			$$invalidate(3, desc = "Stick w/ the tried and true");
    		} else if (id == "docv") {
    			$$invalidate(2, title = "DocV");
    			$$invalidate(3, desc = "Enables the usage of SF Pro, Roboto and Viewfinder Passrate");
    		} else if (id == "visual") {
    			$$invalidate(2, title = "Visual Team");
    			$$invalidate(3, desc = "Super strict settings that visual team uses to check for framing!");
    		}
    	});

    	function onClick() {
    		activeOption.set(id);
    	}

    	const writable_props = ['id'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Option> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		Radio,
    		onMount,
    		activeOption,
    		active,
    		id,
    		title,
    		desc,
    		onClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('active' in $$props) $$invalidate(1, active = $$props.active);
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('title' in $$props) $$invalidate(2, title = $$props.title);
    		if ('desc' in $$props) $$invalidate(3, desc = $$props.desc);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [id, active, title, desc, onClick];
    }

    class Option extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { id: 0 }, add_css$3);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Option",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[0] === undefined && !('id' in props)) {
    			console.warn("<Option> was created without expected prop 'id'");
    		}
    	}

    	get id() {
    		throw new Error("<Option>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Option>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Option\OptionList.svelte generated by Svelte v3.50.0 */
    const file$4 = "src\\components\\Option\\OptionList.svelte";

    function add_css$4(target) {
    	append_styles(target, "svelte-1wfgra7", ".container.svelte-1wfgra7{display:flex;flex-direction:column;gap:8px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiT3B0aW9uTGlzdC5zdmVsdGUiLCJzb3VyY2VzIjpbIk9wdGlvbkxpc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XHJcbiAgICBpbXBvcnQgT3B0aW9uIGZyb20gXCIuL09wdGlvbi5zdmVsdGVcIjtcclxuPC9zY3JpcHQ+XHJcblxyXG48ZGl2IGNsYXNzPSdjb250YWluZXInPlxyXG4gICAgPE9wdGlvbiBpZD0ndGRzJy8+XHJcbiAgICA8T3B0aW9uIGlkPSdkb2N2Jy8+XHJcbiAgICA8T3B0aW9uIGlkPSd2aXN1YWwnLz5cclxuPC9kaXY+XHJcblxyXG48c3R5bGU+XHJcbiAgICAuY29udGFpbmVyIHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgZ2FwOiA4cHg7XHJcbiAgICB9XHJcbjwvc3R5bGU+Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVdJLFVBQVUsZUFBQyxDQUFDLEFBQ1IsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxDQUN0QixHQUFHLENBQUUsR0FBRyxBQUNaLENBQUMifQ== */");
    }

    function create_fragment$4(ctx) {
    	let div;
    	let option0;
    	let t0;
    	let option1;
    	let t1;
    	let option2;
    	let current;
    	option0 = new Option({ props: { id: "tds" }, $$inline: true });
    	option1 = new Option({ props: { id: "docv" }, $$inline: true });
    	option2 = new Option({ props: { id: "visual" }, $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(option0.$$.fragment);
    			t0 = space();
    			create_component(option1.$$.fragment);
    			t1 = space();
    			create_component(option2.$$.fragment);
    			attr_dev(div, "class", "container svelte-1wfgra7");
    			add_location(div, file$4, 4, 0, 66);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(option0, div, null);
    			append_dev(div, t0);
    			mount_component(option1, div, null);
    			append_dev(div, t1);
    			mount_component(option2, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(option0.$$.fragment, local);
    			transition_in(option1.$$.fragment, local);
    			transition_in(option2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(option0.$$.fragment, local);
    			transition_out(option1.$$.fragment, local);
    			transition_out(option2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(option0);
    			destroy_component(option1);
    			destroy_component(option2);
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
    	validate_slots('OptionList', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<OptionList> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Option });
    	return [];
    }

    class OptionList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {}, add_css$4);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "OptionList",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\pages\Configuration.svelte generated by Svelte v3.50.0 */
    const file$5 = "src\\pages\\Configuration.svelte";

    function add_css$5(target) {
    	append_styles(target, "svelte-1kr6lay", ".container.svelte-1kr6lay{padding:16px;display:flex;flex-direction:column;gap:16px}.desc.svelte-1kr6lay{text-align:left;display:flex;flex-direction:column;gap:8px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29uZmlndXJhdGlvbi5zdmVsdGUiLCJzb3VyY2VzIjpbIkNvbmZpZ3VyYXRpb24uc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XHJcbiAgICBpbXBvcnQgT3B0aW9uTGlzdCBmcm9tIFwiLi4vY29tcG9uZW50cy9PcHRpb24vT3B0aW9uTGlzdC5zdmVsdGVcIjtcclxuPC9zY3JpcHQ+XHJcblxyXG48ZGl2IGNsYXNzPSdjb250YWluZXInPlxyXG4gICAgPGRpdiBjbGFzcz0nZGVzYyc+XHJcbiAgICAgICAgPGRpdiBjbGFzcz0ndGV4dC1sZy1tZWQnPlxyXG4gICAgICAgICAgICBDaG9vc2Ugd2hhdCB0eXBlIG9mIGNvbmZpZ3VyYXRpb24geW91IHdhbnQgdG8gdXNlIHdoZW4gbGludGluZyB5b3VyIGRvY3VtZW50OlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgPC9kaXY+XHJcbiAgICA8ZGl2PlxyXG4gICAgICAgIDxPcHRpb25MaXN0IC8+XHJcbiAgICA8L2Rpdj5cclxuPC9kaXY+XHJcblxyXG48c3R5bGU+XHJcbiAgICAuY29udGFpbmVyIHtcclxuICAgICAgICBwYWRkaW5nOjE2cHg7XHJcbiAgICAgICAgZGlzcGxheTpmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgZ2FwOjE2cHg7XHJcbiAgICB9XHJcbiAgICAuZGVzYyB7XHJcbiAgICAgICAgdGV4dC1hbGlnbjogbGVmdDtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgZ2FwOiA4cHg7XHJcbiAgICB9XHJcbjwvc3R5bGU+Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQWdCSSxVQUFVLGVBQUMsQ0FBQyxBQUNSLFFBQVEsSUFBSSxDQUNaLFFBQVEsSUFBSSxDQUNaLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLElBQUksSUFBSSxBQUNaLENBQUMsQUFDRCxLQUFLLGVBQUMsQ0FBQyxBQUNILFVBQVUsQ0FBRSxJQUFJLENBQ2hCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLE1BQU0sQ0FDdEIsR0FBRyxDQUFFLEdBQUcsQUFDWixDQUFDIn0= */");
    }

    function create_fragment$5(ctx) {
    	let div3;
    	let div1;
    	let div0;
    	let t1;
    	let div2;
    	let optionlist;
    	let current;
    	optionlist = new OptionList({ $$inline: true });

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = "Choose what type of configuration you want to use when linting your document:";
    			t1 = space();
    			div2 = element("div");
    			create_component(optionlist.$$.fragment);
    			attr_dev(div0, "class", "text-lg-med");
    			add_location(div0, file$5, 6, 8, 150);
    			attr_dev(div1, "class", "desc svelte-1kr6lay");
    			add_location(div1, file$5, 5, 4, 122);
    			add_location(div2, file$5, 10, 4, 300);
    			attr_dev(div3, "class", "container svelte-1kr6lay");
    			add_location(div3, file$5, 4, 0, 93);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div1);
    			append_dev(div1, div0);
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			mount_component(optionlist, div2, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(optionlist.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(optionlist.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			destroy_component(optionlist);
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
    	validate_slots('Configuration', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Configuration> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ OptionList });
    	return [];
    }

    class Configuration extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {}, add_css$5);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Configuration",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\components\Menu\First.svelte generated by Svelte v3.50.0 */

    const file$6 = "src\\components\\Menu\\First.svelte";

    function add_css$6(target) {
    	append_styles(target, "svelte-chzx9", ".first.svelte-chzx9{padding:12px 8px;color:#121212;text-align:left}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRmlyc3Quc3ZlbHRlIiwic291cmNlcyI6WyJGaXJzdC5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdCA+XHJcbiAgICBleHBvcnQgbGV0IG5hbWU7XHJcbjwvc2NyaXB0PlxyXG5cclxuPGRpdiBjbGFzcz1cInRleHQtc20tbWVkIGZpcnN0XCI+e25hbWV9PC9kaXY+XHJcblxyXG48c3R5bGU+XHJcbiAgICAuZmlyc3Qge1xyXG4gICAgICAgIHBhZGRpbmc6IDEycHggOHB4O1xyXG4gICAgICAgIGNvbG9yOiAjMTIxMjEyO1xyXG4gICAgICAgIHRleHQtYWxpZ246IGxlZnQ7XHJcbiAgICB9XHJcbjwvc3R5bGU+Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQU9JLE1BQU0sYUFBQyxDQUFDLEFBQ0osT0FBTyxDQUFFLElBQUksQ0FBQyxHQUFHLENBQ2pCLEtBQUssQ0FBRSxPQUFPLENBQ2QsVUFBVSxDQUFFLElBQUksQUFDcEIsQ0FBQyJ9 */");
    }

    function create_fragment$6(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*name*/ ctx[0]);
    			attr_dev(div, "class", "text-sm-med first svelte-chzx9");
    			add_location(div, file$6, 4, 0, 46);
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
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { name: 0 }, add_css$6);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "First",
    			options,
    			id: create_fragment$6.name
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

    /* src\components\Tag.svelte generated by Svelte v3.50.0 */

    const file$7 = "src\\components\\Tag.svelte";

    function add_css$7(target) {
    	append_styles(target, "svelte-1is2zsv", ".tag.svelte-1is2zsv{padding:2px 8px;background-color:#172D2D;color:#ffffff;border-radius:16px;align-self:center}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFnLnN2ZWx0ZSIsInNvdXJjZXMiOlsiVGFnLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxyXG4gICAgZXhwb3J0IGxldCBudW1iZXI7XHJcbjwvc2NyaXB0PlxyXG5cclxuPGRpdiBjbGFzcz1cInRleHQtc20tcmVnIHRhZ1wiPntudW1iZXJ9PC9kaXY+XHJcblxyXG48c3R5bGU+XHJcbiAgICAudGFnIHtcclxuICAgICAgICBwYWRkaW5nOiAycHggOHB4O1xyXG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6ICMxNzJEMkQ7XHJcbiAgICAgICAgY29sb3I6ICNmZmZmZmY7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogMTZweDtcclxuICAgICAgICBhbGlnbi1zZWxmOiBjZW50ZXI7XHJcbiAgICB9XHJcbjwvc3R5bGU+Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQU9JLElBQUksZUFBQyxDQUFDLEFBQ0YsT0FBTyxDQUFFLEdBQUcsQ0FBQyxHQUFHLENBQ2hCLGdCQUFnQixDQUFFLE9BQU8sQ0FDekIsS0FBSyxDQUFFLE9BQU8sQ0FDZCxhQUFhLENBQUUsSUFBSSxDQUNuQixVQUFVLENBQUUsTUFBTSxBQUN0QixDQUFDIn0= */");
    }

    function create_fragment$7(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*number*/ ctx[0]);
    			attr_dev(div, "class", "text-sm-reg tag svelte-1is2zsv");
    			add_location(div, file$7, 4, 0, 47);
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
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { number: 0 }, add_css$7);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tag",
    			options,
    			id: create_fragment$7.name
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

    /* src\components\Menu\Second.svelte generated by Svelte v3.50.0 */
    const file$8 = "src\\components\\Menu\\Second.svelte";

    function add_css$8(target) {
    	append_styles(target, "svelte-1eqwww8", ".padding.svelte-1eqwww8{padding:2px 0px}.second.svelte-1eqwww8{padding:12px 16px;border-radius:8px;color:#666666;text-align:left;display:flex;justify-content:space-between;align-items:center}.second.svelte-1eqwww8:hover{background-color:#F2F2F2;color:#121212;cursor:pointer;transition:all 100ms}.second--state-active.svelte-1eqwww8{padding:12px 16px;border-radius:8px;color:#121212;text-align:left;display:flex;background-color:#E5F0E8;justify-content:space-between;align-items:center}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2Vjb25kLnN2ZWx0ZSIsInNvdXJjZXMiOlsiU2Vjb25kLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxyXG4gICAgaW1wb3J0IHsgYWN0aXZlRm9jdXNQYWdlLCBhY3RpdmVGb2N1c1NlbGVjdGlvbiwgYWN0aXZlTWVudSB9IGZyb20gXCIuLi8uLi9zdG9yZVwiO1xyXG4gICAgaW1wb3J0IFRhZyBmcm9tIFwiLi4vVGFnLnN2ZWx0ZVwiO1xyXG5cclxuICAgIGV4cG9ydCBsZXQgaXNBY3RpdmU7XHJcbiAgICBleHBvcnQgbGV0IG5hbWU7XHJcbiAgICBleHBvcnQgbGV0IGlkO1xyXG4gICAgZXhwb3J0IGxldCBudW1iZXI7XHJcblxyXG4gICAgLy8gc2V0IGN1cnJlbnQgbWVudVxyXG4gICAgZnVuY3Rpb24gb25DbGljaygpIHtcclxuICAgICAgICBhY3RpdmVNZW51LnNldChpZCk7XHJcbiAgICAgICAgYWN0aXZlRm9jdXNQYWdlLnNldCgtMSk7XHJcbiAgICAgICAgYWN0aXZlRm9jdXNTZWxlY3Rpb24uc2V0KC0xKVxyXG4gICAgfVxyXG48L3NjcmlwdD5cclxuXHJcbjxkaXZcclxuICAgIGNsYXNzPXtgdGV4dC1zbS1yZWcgJHtpc0FjdGl2ZSA/IFwic2Vjb25kLS1zdGF0ZS1hY3RpdmVcIiA6IFwic2Vjb25kXCJ9YH1cclxuICAgIG9uOmNsaWNrPXtvbkNsaWNrfVxyXG4+ICAgPGRpdiBjbGFzcz0ncGFkZGluZyc+XHJcbiAgICB7bmFtZX1cclxuXHJcbjwvZGl2PlxyXG4gICAgeyNpZiBudW1iZXIgPiAwfSBcclxuICAgICAgICA8VGFnIG51bWJlcj17bnVtYmVyfSAvPlxyXG4gICAgey9pZn1cclxuPC9kaXY+XHJcblxyXG48c3R5bGU+XHJcbiAgICAucGFkZGluZyB7XHJcbiAgICAgICAgcGFkZGluZzogMnB4IDBweDtcclxuICAgIH1cclxuICAgIC5zZWNvbmQge1xyXG4gICAgICAgIHBhZGRpbmc6IDEycHggMTZweDtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XHJcbiAgICAgICAgY29sb3I6ICM2NjY2NjY7XHJcbiAgICAgICAgdGV4dC1hbGlnbjogbGVmdDtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgfVxyXG4gICAgLnNlY29uZDpob3ZlciB7XHJcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjojRjJGMkYyO1xyXG4gICAgICAgIGNvbG9yOiAjMTIxMjEyO1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgICB0cmFuc2l0aW9uOiBhbGwgMTAwbXM7XHJcbiAgICB9XHJcbiAgICAuc2Vjb25kLS1zdGF0ZS1hY3RpdmUge1xyXG4gICAgICAgIHBhZGRpbmc6IDEycHggMTZweDtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XHJcbiAgICAgICAgY29sb3I6ICMxMjEyMTI7XHJcbiAgICAgICAgdGV4dC1hbGlnbjogbGVmdDtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6I0U1RjBFODtcclxuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XHJcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgIH1cclxuPC9zdHlsZT5cclxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQThCSSxRQUFRLGVBQUMsQ0FBQyxBQUNOLE9BQU8sQ0FBRSxHQUFHLENBQUMsR0FBRyxBQUNwQixDQUFDLEFBQ0QsT0FBTyxlQUFDLENBQUMsQUFDTCxPQUFPLENBQUUsSUFBSSxDQUFDLElBQUksQ0FDbEIsYUFBYSxDQUFFLEdBQUcsQ0FDbEIsS0FBSyxDQUFFLE9BQU8sQ0FDZCxVQUFVLENBQUUsSUFBSSxDQUNoQixPQUFPLENBQUUsSUFBSSxDQUNiLGVBQWUsQ0FBRSxhQUFhLENBQzlCLFdBQVcsQ0FBRSxNQUFNLEFBQ3ZCLENBQUMsQUFDRCxzQkFBTyxNQUFNLEFBQUMsQ0FBQyxBQUNYLGlCQUFpQixPQUFPLENBQ3hCLEtBQUssQ0FBRSxPQUFPLENBQ2QsTUFBTSxDQUFFLE9BQU8sQ0FDZixVQUFVLENBQUUsR0FBRyxDQUFDLEtBQUssQUFDekIsQ0FBQyxBQUNELHFCQUFxQixlQUFDLENBQUMsQUFDbkIsT0FBTyxDQUFFLElBQUksQ0FBQyxJQUFJLENBQ2xCLGFBQWEsQ0FBRSxHQUFHLENBQ2xCLEtBQUssQ0FBRSxPQUFPLENBQ2QsVUFBVSxDQUFFLElBQUksQ0FDaEIsT0FBTyxDQUFFLElBQUksQ0FDYixpQkFBaUIsT0FBTyxDQUN4QixlQUFlLENBQUUsYUFBYSxDQUM5QixXQUFXLENBQUUsTUFBTSxBQUN2QixDQUFDIn0= */");
    }

    // (25:4) {#if number > 0}
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
    		source: "(25:4) {#if number > 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1;
    	let div1_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*number*/ ctx[2] > 0 && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(/*name*/ ctx[1]);
    			t1 = space();
    			if (if_block) if_block.c();
    			attr_dev(div0, "class", "padding svelte-1eqwww8");
    			add_location(div0, file$8, 20, 4, 511);
    			attr_dev(div1, "class", div1_class_value = "" + (null_to_empty(`text-sm-reg ${/*isActive*/ ctx[0] ? "second--state-active" : "second"}`) + " svelte-1eqwww8"));
    			add_location(div1, file$8, 17, 0, 402);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div1, t1);
    			if (if_block) if_block.m(div1, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div1, "click", /*onClick*/ ctx[3], false, false, false);
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
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*isActive*/ 1 && div1_class_value !== (div1_class_value = "" + (null_to_empty(`text-sm-reg ${/*isActive*/ ctx[0] ? "second--state-active" : "second"}`) + " svelte-1eqwww8"))) {
    				attr_dev(div1, "class", div1_class_value);
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
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
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
    	validate_slots('Second', slots, []);
    	let { isActive } = $$props;
    	let { name } = $$props;
    	let { id } = $$props;
    	let { number } = $$props;

    	// set current menu
    	function onClick() {
    		activeMenu.set(id);
    		activeFocusPage.set(-1);
    		activeFocusSelection.set(-1);
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
    		activeFocusPage,
    		activeFocusSelection,
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
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { isActive: 0, name: 1, id: 4, number: 2 }, add_css$8);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Second",
    			options,
    			id: create_fragment$8.name
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

    /* src\components\Menu\Menu.svelte generated by Svelte v3.50.0 */
    const file$9 = "src\\components\\Menu\\Menu.svelte";

    function add_css$9(target) {
    	append_styles(target, "svelte-3d56ht", ".container.svelte-3d56ht{margin:0px 8px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWVudS5zdmVsdGUiLCJzb3VyY2VzIjpbIk1lbnUuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XHJcbiAgICBpbXBvcnQgRmlyc3QgZnJvbSBcIi4vRmlyc3Quc3ZlbHRlXCI7XHJcbiAgICBpbXBvcnQgU2Vjb25kIGZyb20gXCIuL1NlY29uZC5zdmVsdGVcIjtcclxuXHJcbiAgICBpbXBvcnQgeyBhY3RpdmVNZW51LCBhY3RpdmVUYWIgfSBmcm9tIFwiLi4vLi4vc3RvcmVcIjtcclxuXHJcbiAgICBleHBvcnQgbGV0IGNvbG9yO1xyXG4gICAgZXhwb3J0IGxldCBmb250O1xyXG5cclxuICAgIC8vIHNldCB0aGUgYWN0aXZlIG1lbnVcclxuICAgIGxldCBhY3RpdmU7XHJcbiAgICBhY3RpdmVNZW51LnN1YnNjcmliZSgodmFsdWUpID0+IHtcclxuICAgICAgICBhY3RpdmUgPSB2YWx1ZTtcclxuICAgIH0pO1xyXG5cclxuPC9zY3JpcHQ+XHJcblxyXG48ZGl2IGNsYXNzPSdjb250YWluZXInPlxyXG4gICAgPGRpdj5cclxuICAgICAgICA8Rmlyc3QgbmFtZT17XCJFcnJvclwifS8+XHJcbiAgICAgICAgPFNlY29uZCBuYW1lPXtcIkNvbG9yXCJ9IGlkPXtcImNvbG9yXCJ9IGlzQWN0aXZlPXthY3RpdmUgPT0gXCJjb2xvclwifSBudW1iZXI9e2NvbG9yfS8+XHJcbiAgICAgICAgPFNlY29uZCBuYW1lPXtcIkZvbnRcIn0gaWQ9e1wiZm9udFwifSBpc0FjdGl2ZT17YWN0aXZlID09IFwiZm9udFwifSBudW1iZXI9e2ZvbnR9Lz5cclxuICAgIDwvZGl2PlxyXG4gICAgPGRpdj5cclxuICAgICAgICA8Rmlyc3QgbmFtZT17XCJCZXRhXCJ9Lz5cclxuICAgICAgICA8U2Vjb25kIG5hbWU9e1wiQXV0byBMYXlvdXRcIn0gaWQ9e1wiZnJhbWVcIn0gaXNBY3RpdmU9e2FjdGl2ZSA9PSBcImZyYW1lXCJ9IG51bWJlcj17NTB9Lz5cclxuICAgICAgICA8U2Vjb25kIG5hbWU9e1wiQ29tcG9uZW50XCJ9IGlkPXtcImNvbXBvbmVudFwifSBpc0FjdGl2ZT17YWN0aXZlID09IFwiY29tcG9uZW50XCJ9IG51bWJlcj17MTB9Lz5cclxuICAgIDwvZGl2PlxyXG48L2Rpdj5cclxuXHJcbjxzdHlsZT5cclxuICAgIC5jb250YWluZXIge1xyXG4gICAgICAgIG1hcmdpbjogMHB4IDhweDtcclxuICAgIH1cclxuPC9zdHlsZT4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBK0JJLFVBQVUsY0FBQyxDQUFDLEFBQ1IsTUFBTSxDQUFFLEdBQUcsQ0FBQyxHQUFHLEFBQ25CLENBQUMifQ== */");
    }

    function create_fragment$9(ctx) {
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
    	first0 = new First({ props: { name: "Error" }, $$inline: true });

    	second0 = new Second({
    			props: {
    				name: "Color",
    				id: "color",
    				isActive: /*active*/ ctx[2] == "color",
    				number: /*color*/ ctx[0]
    			},
    			$$inline: true
    		});

    	second1 = new Second({
    			props: {
    				name: "Font",
    				id: "font",
    				isActive: /*active*/ ctx[2] == "font",
    				number: /*font*/ ctx[1]
    			},
    			$$inline: true
    		});

    	first1 = new First({ props: { name: "Beta" }, $$inline: true });

    	second2 = new Second({
    			props: {
    				name: "Auto Layout",
    				id: "frame",
    				isActive: /*active*/ ctx[2] == "frame",
    				number: 50
    			},
    			$$inline: true
    		});

    	second3 = new Second({
    			props: {
    				name: "Component",
    				id: "component",
    				isActive: /*active*/ ctx[2] == "component",
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
    			add_location(div0, file$9, 18, 4, 365);
    			add_location(div1, file$9, 23, 4, 599);
    			attr_dev(div2, "class", "container svelte-3d56ht");
    			add_location(div2, file$9, 17, 0, 336);
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
    			if (dirty & /*active*/ 4) second0_changes.isActive = /*active*/ ctx[2] == "color";
    			if (dirty & /*color*/ 1) second0_changes.number = /*color*/ ctx[0];
    			second0.$set(second0_changes);
    			const second1_changes = {};
    			if (dirty & /*active*/ 4) second1_changes.isActive = /*active*/ ctx[2] == "font";
    			if (dirty & /*font*/ 2) second1_changes.number = /*font*/ ctx[1];
    			second1.$set(second1_changes);
    			const second2_changes = {};
    			if (dirty & /*active*/ 4) second2_changes.isActive = /*active*/ ctx[2] == "frame";
    			second2.$set(second2_changes);
    			const second3_changes = {};
    			if (dirty & /*active*/ 4) second3_changes.isActive = /*active*/ ctx[2] == "component";
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
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Menu', slots, []);
    	let { color } = $$props;
    	let { font } = $$props;

    	// set the active menu
    	let active;

    	activeMenu.subscribe(value => {
    		$$invalidate(2, active = value);
    	});

    	const writable_props = ['color', 'font'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Menu> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('color' in $$props) $$invalidate(0, color = $$props.color);
    		if ('font' in $$props) $$invalidate(1, font = $$props.font);
    	};

    	$$self.$capture_state = () => ({
    		First,
    		Second,
    		activeMenu,
    		activeTab,
    		color,
    		font,
    		active
    	});

    	$$self.$inject_state = $$props => {
    		if ('color' in $$props) $$invalidate(0, color = $$props.color);
    		if ('font' in $$props) $$invalidate(1, font = $$props.font);
    		if ('active' in $$props) $$invalidate(2, active = $$props.active);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [color, font, active];
    }

    class Menu extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { color: 0, font: 1 }, add_css$9);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Menu",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*color*/ ctx[0] === undefined && !('color' in props)) {
    			console.warn("<Menu> was created without expected prop 'color'");
    		}

    		if (/*font*/ ctx[1] === undefined && !('font' in props)) {
    			console.warn("<Menu> was created without expected prop 'font'");
    		}
    	}

    	get color() {
    		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get font() {
    		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set font(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Button.svelte generated by Svelte v3.50.0 */

    const file$a = "src\\components\\Button.svelte";

    function add_css$a(target) {
    	append_styles(target, "svelte-1al7xlk", ".primary.svelte-1al7xlk{border-radius:8px;border:none;padding:12px 16px;background-color:#004c45;color:white;flex-grow:1}.primary.svelte-1al7xlk:hover{background-color:#172d2d;animation-name:svelte-1al7xlk-on-hover-button;animation-duration:100ms;cursor:pointer}@keyframes svelte-1al7xlk-on-hover-button{0%{background-color:#004c45}100%{background-color:#172d2d}}.tertiary.svelte-1al7xlk{border-radius:8px;padding:12px 16px;border:none;color:#172d2d;background-color:white;cursor:pointer}.tertiary.svelte-1al7xlk:hover{background-color:#e5f0e8;cursor:pointer}.link.svelte-1al7xlk{border:none;background:none;color:#128ba6;cursor:pointer}.link.svelte-1al7xlk:hover{text-decoration:underline;cursor:pointer;color:#0e687d}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQnV0dG9uLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQnV0dG9uLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxyXG4gICAgZXhwb3J0IGxldCBvbkNsaWNrO1xyXG4gICAgZXhwb3J0IGxldCB0eXBlO1xyXG48L3NjcmlwdD5cclxuXHJcbjxidXR0b25cclxuICAgIGNsYXNzPXtgJHtcclxuICAgICAgICB0eXBlID09IFwicHJpbWFyeVwiXHJcbiAgICAgICAgICAgID8gXCJ0ZXh0LW1kLW1lZCBwcmltYXJ5XCJcclxuICAgICAgICAgICAgOiB0eXBlID09IFwidGVydGlhcnlcIlxyXG4gICAgICAgICAgICA/IFwidGV4dC1tZC1tZWQgdGVydGlhcnlcIlxyXG4gICAgICAgICAgICA6IHR5cGUgPT0gXCJsaW5rXCJcclxuICAgICAgICAgICAgPyBcInRleHQtc20tbWVkIGxpbmtcIlxyXG4gICAgICAgICAgICA6IFwiXCJcclxuICAgIH1gfVxyXG4gICAgb246Y2xpY2s9e29uQ2xpY2t9XHJcbj5cclxuICAgIDxzbG90IC8+XHJcbjwvYnV0dG9uPlxyXG5cclxuPHN0eWxlPlxyXG4gICAgLnByaW1hcnkge1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgICAgcGFkZGluZzogMTJweCAxNnB4O1xyXG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6ICMwMDRjNDU7XHJcbiAgICAgICAgY29sb3I6IHdoaXRlO1xyXG4gICAgICAgIGZsZXgtZ3JvdzogMTtcclxuICAgIH1cclxuXHJcbiAgICAucHJpbWFyeTpob3ZlciB7XHJcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogIzE3MmQyZDtcclxuICAgICAgICBhbmltYXRpb24tbmFtZTogb24taG92ZXItYnV0dG9uO1xyXG4gICAgICAgIGFuaW1hdGlvbi1kdXJhdGlvbjogMTAwbXM7XHJcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgfVxyXG5cclxuICAgIEBrZXlmcmFtZXMgb24taG92ZXItYnV0dG9uIHtcclxuICAgICAgICAwJSB7XHJcbiAgICAgICAgICAgIGJhY2tncm91bmQtY29sb3I6ICMwMDRjNDU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIDEwMCUge1xyXG4gICAgICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjMTcyZDJkO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAudGVydGlhcnkge1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XHJcbiAgICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICAgIGNvbG9yOiAjMTcyZDJkO1xyXG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6IHdoaXRlO1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgIH1cclxuXHJcbiAgICAudGVydGlhcnk6aG92ZXIge1xyXG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6ICNlNWYwZTg7XHJcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgfVxyXG5cclxuICAgIC5saW5rIHtcclxuICAgICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgICAgYmFja2dyb3VuZDogbm9uZTtcclxuICAgICAgICBjb2xvcjogIzEyOGJhNjtcclxuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLmxpbms6aG92ZXIge1xyXG4gICAgICAgIHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lO1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgICBjb2xvcjogIzBlNjg3ZDtcclxuICAgIH1cclxuPC9zdHlsZT5cclxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXFCSSxRQUFRLGVBQUMsQ0FBQyxBQUNOLGFBQWEsQ0FBRSxHQUFHLENBQ2xCLE1BQU0sQ0FBRSxJQUFJLENBQ1osT0FBTyxDQUFFLElBQUksQ0FBQyxJQUFJLENBQ2xCLGdCQUFnQixDQUFFLE9BQU8sQ0FDekIsS0FBSyxDQUFFLEtBQUssQ0FDWixTQUFTLENBQUUsQ0FBQyxBQUNoQixDQUFDLEFBRUQsdUJBQVEsTUFBTSxBQUFDLENBQUMsQUFDWixnQkFBZ0IsQ0FBRSxPQUFPLENBQ3pCLGNBQWMsQ0FBRSw4QkFBZSxDQUMvQixrQkFBa0IsQ0FBRSxLQUFLLENBQ3pCLE1BQU0sQ0FBRSxPQUFPLEFBQ25CLENBQUMsQUFFRCxXQUFXLDhCQUFnQixDQUFDLEFBQ3hCLEVBQUUsQUFBQyxDQUFDLEFBQ0EsZ0JBQWdCLENBQUUsT0FBTyxBQUM3QixDQUFDLEFBQ0QsSUFBSSxBQUFDLENBQUMsQUFDRixnQkFBZ0IsQ0FBRSxPQUFPLEFBQzdCLENBQUMsQUFDTCxDQUFDLEFBRUQsU0FBUyxlQUFDLENBQUMsQUFDUCxhQUFhLENBQUUsR0FBRyxDQUNsQixPQUFPLENBQUUsSUFBSSxDQUFDLElBQUksQ0FDbEIsTUFBTSxDQUFFLElBQUksQ0FDWixLQUFLLENBQUUsT0FBTyxDQUNkLGdCQUFnQixDQUFFLEtBQUssQ0FDdkIsTUFBTSxDQUFFLE9BQU8sQUFDbkIsQ0FBQyxBQUVELHdCQUFTLE1BQU0sQUFBQyxDQUFDLEFBQ2IsZ0JBQWdCLENBQUUsT0FBTyxDQUN6QixNQUFNLENBQUUsT0FBTyxBQUNuQixDQUFDLEFBRUQsS0FBSyxlQUFDLENBQUMsQUFDSCxNQUFNLENBQUUsSUFBSSxDQUNaLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLEtBQUssQ0FBRSxPQUFPLENBQ2QsTUFBTSxDQUFFLE9BQU8sQUFDbkIsQ0FBQyxBQUVELG9CQUFLLE1BQU0sQUFBQyxDQUFDLEFBQ1QsZUFBZSxDQUFFLFNBQVMsQ0FDMUIsTUFBTSxDQUFFLE9BQU8sQ0FDZixLQUFLLENBQUUsT0FBTyxBQUNsQixDQUFDIn0= */");
    }

    function create_fragment$a(ctx) {
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

    			attr_dev(button, "class", button_class_value = "" + (null_to_empty(`${/*type*/ ctx[1] == "primary"
			? "text-md-med primary"
			: /*type*/ ctx[1] == "tertiary"
				? "text-md-med tertiary"
				: /*type*/ ctx[1] == "link" ? "text-sm-med link" : ""}`) + " svelte-1al7xlk"));

    			add_location(button, file$a, 5, 0, 70);
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

    			if (!current || dirty & /*type*/ 2 && button_class_value !== (button_class_value = "" + (null_to_empty(`${/*type*/ ctx[1] == "primary"
			? "text-md-med primary"
			: /*type*/ ctx[1] == "tertiary"
				? "text-md-med tertiary"
				: /*type*/ ctx[1] == "link" ? "text-sm-med link" : ""}`) + " svelte-1al7xlk"))) {
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
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { onClick: 0, type: 1 }, add_css$a);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$a.name
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

    /* src\components\List\Error.svelte generated by Svelte v3.50.0 */

    const { Error: Error_1 } = globals;

    const file$b = "src\\components\\List\\Error.svelte";

    function add_css$b(target) {
    	append_styles(target, "svelte-1tzy81h", ".container.svelte-1tzy81h{padding:16px;display:flex;flex-direction:column;justify-content:center;align-items:stretch;gap:8px;border-style:solid;border-width:1px;border-color:#d5d5d5;border-radius:8px;cursor:pointer}.container.svelte-1tzy81h:hover{border-color:#808080;background-color:#f2f2f2}.container--state-active.svelte-1tzy81h{border-color:#128ba6;background-color:#f2f2f2;padding:16px;display:flex;flex-direction:column;justify-content:center;align-items:stretch;gap:8px;border-style:solid;border-width:1px;border-radius:8px;cursor:pointer}.top.svelte-1tzy81h{display:flex;flex-direction:row;justify-content:space-between;text-align:left;align-items:start;gap:8px}.bot.svelte-1tzy81h{color:#6c6c70;text-align:left}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRXJyb3Iuc3ZlbHRlIiwic291cmNlcyI6WyJFcnJvci5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cclxuICAgIGV4cG9ydCBsZXQgb2JqO1xyXG4gICAgZXhwb3J0IGxldCB0eXBlO1xyXG5cclxuICAgIGltcG9ydCBCdXR0b24gZnJvbSBcIi4uL0J1dHRvbi5zdmVsdGVcIjtcclxuICAgIGltcG9ydCB7XHJcbiAgICAgICAgYWN0aXZlRm9jdXNQYWdlLFxyXG4gICAgICAgIGFjdGl2ZUZvY3VzU2VsZWN0aW9uLFxyXG4gICAgICAgIGNvbG9ySWdub3JlUGFnZSxcclxuICAgICAgICBjb2xvcklnbm9yZVNlbGVjdGlvbixcclxuICAgICAgICBjb2xvclBhZ2UsXHJcbiAgICAgICAgY29sb3JTZWxlY3Rpb24sXHJcbiAgICAgICAgZm9udFBhZ2UsXHJcbiAgICAgICAgZm9udElnbm9yZVBhZ2UsXHJcbiAgICAgICAgZm9udFNlbGVjdGlvbixcclxuICAgICAgICBmb250SWdub3JlU2VsZWN0aW9uXHJcbiAgICB9IGZyb20gXCIuLi8uLi9zdG9yZVwiO1xyXG5cclxuICAgIC8vIHNldCB0aGUgY3VycmVudCBmb2N1cyBJRFxyXG4gICAgbGV0IHBhZ2VJRDtcclxuICAgIGFjdGl2ZUZvY3VzUGFnZS5zdWJzY3JpYmUoKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgcGFnZUlEID0gdmFsdWU7XHJcbiAgICB9KTtcclxuXHJcbiAgICBsZXQgc2VsZWN0aW9uSUQ7XHJcbiAgICBhY3RpdmVGb2N1c1NlbGVjdGlvbi5zdWJzY3JpYmUoKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgc2VsZWN0aW9uSUQgPSB2YWx1ZTtcclxuICAgIH0pO1xyXG5cclxuICAgIGZ1bmN0aW9uIG9uQ2xpY2soKSB7XHJcbiAgICAgICAgaWYgKHR5cGUgPT0gXCJwYWdlXCIpIHtcclxuICAgICAgICAgICAgYWN0aXZlRm9jdXNQYWdlLnNldChvYmouaWQpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcInNlbGVjdGlvblwiKSB7XHJcbiAgICAgICAgICAgIGFjdGl2ZUZvY3VzU2VsZWN0aW9uLnNldChvYmouaWQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBtb3ZlIHRoZSBlcnJvciBpbnRvIHRoZSBpZ25vcmUgbGlzdFxyXG4gICAgZnVuY3Rpb24gaWdub3JlRXJyb3IoKSB7XHJcbiAgICAgICAgaWYgKG9iai50eXBlID09IFwiY29sb3JcIiAmJiB0eXBlID09IFwicGFnZVwiKSB7XHJcbiAgICAgICAgICAgIGNvbG9yUGFnZS51cGRhdGUoKGFycikgPT4gYXJyLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5pZCAhPSBvYmouaWQpKTtcclxuICAgICAgICAgICAgY29sb3JJZ25vcmVQYWdlLnVwZGF0ZSgoYXJyKSA9PiBbLi4uYXJyLCBvYmpdKTtcclxuICAgICAgICB9IGVsc2UgaWYgKG9iai50eXBlID09IFwiZm9udFwiICYmIHR5cGUgPT0gXCJwYWdlXCIpIHtcclxuICAgICAgICAgICAgZm9udFBhZ2UudXBkYXRlKChhcnIpID0+IGFyci5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0uaWQgIT0gb2JqLmlkKSk7XHJcbiAgICAgICAgICAgIGZvbnRJZ25vcmVQYWdlLnVwZGF0ZSgoYXJyKSA9PiBbLi4uYXJyLCBvYmpdKTtcclxuICAgICAgICB9IGVsc2UgaWYgKG9iai50eXBlID09IFwiY29sb3JcIiAmJiB0eXBlID09IFwic2VsZWN0aW9uXCIpIHtcclxuICAgICAgICAgICAgY29sb3JTZWxlY3Rpb24udXBkYXRlKChhcnIpID0+IGFyci5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0uaWQgIT0gb2JqLmlkKSk7XHJcbiAgICAgICAgICAgIGNvbG9ySWdub3JlU2VsZWN0aW9uLnVwZGF0ZSgoYXJyKSA9PiBbLi4uYXJyLCBvYmpdKTtcclxuICAgICAgICB9IGVsc2UgaWYgKG9iai50eXBlID09IFwiZm9udFwiICYmIHR5cGUgPT0gXCJzZWxlY3Rpb25cIikge1xyXG4gICAgICAgICAgICBmb250U2VsZWN0aW9uLnVwZGF0ZSgoYXJyKSA9PiBhcnIuZmlsdGVyKChpdGVtKSA9PiBpdGVtLmlkICE9IG9iai5pZCkpO1xyXG4gICAgICAgICAgICBmb250SWdub3JlU2VsZWN0aW9uLnVwZGF0ZSgoYXJyKSA9PiBbLi4uYXJyLCBvYmpdKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbjwvc2NyaXB0PlxyXG5cclxuPGRpdlxyXG4gICAgY2xhc3M9e2Ake1xyXG4gICAgICAgICh0eXBlID09IFwicGFnZVwiICYmIHBhZ2VJRCA9PSBvYmouaWQpIHx8XHJcbiAgICAgICAgKHR5cGUgPT0gXCJzZWxlY3Rpb25cIiAmJiBzZWxlY3Rpb25JRCA9PSBvYmouaWQpXHJcbiAgICAgICAgICAgID8gXCJjb250YWluZXItLXN0YXRlLWFjdGl2ZVwiXHJcbiAgICAgICAgICAgIDogXCJjb250YWluZXJcIlxyXG4gICAgfWB9XHJcbiAgICBvbjpjbGljaz17b25DbGlja31cclxuPlxyXG4gICAgPGRpdiBjbGFzcz1cInRvcCB0ZXh0LW1kLW1lZFwiPlxyXG4gICAgICAgIHtvYmoubmFtZX1cclxuICAgICAgICA8QnV0dG9uIHR5cGU9e1wibGlua1wifSBvbkNsaWNrPXtpZ25vcmVFcnJvcn0+SWdub3JlPC9CdXR0b24+XHJcbiAgICA8L2Rpdj5cclxuICAgIDxkaXYgY2xhc3M9XCJib3QgdGV4dC1zbS1yZWdcIj57b2JqLmRlc2N9PC9kaXY+XHJcbjwvZGl2PlxyXG5cclxuPHN0eWxlPlxyXG4gICAgLmNvbnRhaW5lciB7XHJcbiAgICAgICAgcGFkZGluZzogMTZweDtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgICAgYWxpZ24taXRlbXM6IHN0cmV0Y2g7XHJcbiAgICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgICAgYm9yZGVyLXN0eWxlOiBzb2xpZDtcclxuICAgICAgICBib3JkZXItd2lkdGg6IDFweDtcclxuICAgICAgICBib3JkZXItY29sb3I6ICNkNWQ1ZDU7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFpbmVyOmhvdmVyIHtcclxuICAgICAgICBib3JkZXItY29sb3I6ICM4MDgwODA7XHJcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogI2YyZjJmMjtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFpbmVyLS1zdGF0ZS1hY3RpdmUge1xyXG4gICAgICAgIGJvcmRlci1jb2xvcjogIzEyOGJhNjtcclxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjZjJmMmYyO1xyXG4gICAgICAgIHBhZGRpbmc6IDE2cHg7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICAgIGFsaWduLWl0ZW1zOiBzdHJldGNoO1xyXG4gICAgICAgIGdhcDogOHB4O1xyXG4gICAgICAgIGJvcmRlci1zdHlsZTogc29saWQ7XHJcbiAgICAgICAgYm9yZGVyLXdpZHRoOiAxcHg7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgIH1cclxuICAgIC50b3Age1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcclxuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XHJcbiAgICAgICAgdGV4dC1hbGlnbjogbGVmdDtcclxuICAgICAgICBhbGlnbi1pdGVtczogc3RhcnQ7XHJcbiAgICAgICAgZ2FwOiA4cHg7XHJcbiAgICB9XHJcbiAgICAuYm90IHtcclxuICAgICAgICBjb2xvcjogIzZjNmM3MDtcclxuICAgICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xyXG4gICAgfVxyXG48L3N0eWxlPlxyXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBd0VJLFVBQVUsZUFBQyxDQUFDLEFBQ1IsT0FBTyxDQUFFLElBQUksQ0FDYixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLGVBQWUsQ0FBRSxNQUFNLENBQ3ZCLFdBQVcsQ0FBRSxPQUFPLENBQ3BCLEdBQUcsQ0FBRSxHQUFHLENBQ1IsWUFBWSxDQUFFLEtBQUssQ0FDbkIsWUFBWSxDQUFFLEdBQUcsQ0FDakIsWUFBWSxDQUFFLE9BQU8sQ0FDckIsYUFBYSxDQUFFLEdBQUcsQ0FDbEIsTUFBTSxDQUFFLE9BQU8sQUFDbkIsQ0FBQyxBQUVELHlCQUFVLE1BQU0sQUFBQyxDQUFDLEFBQ2QsWUFBWSxDQUFFLE9BQU8sQ0FDckIsZ0JBQWdCLENBQUUsT0FBTyxBQUM3QixDQUFDLEFBRUQsd0JBQXdCLGVBQUMsQ0FBQyxBQUN0QixZQUFZLENBQUUsT0FBTyxDQUNyQixnQkFBZ0IsQ0FBRSxPQUFPLENBQ3pCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxDQUN0QixlQUFlLENBQUUsTUFBTSxDQUN2QixXQUFXLENBQUUsT0FBTyxDQUNwQixHQUFHLENBQUUsR0FBRyxDQUNSLFlBQVksQ0FBRSxLQUFLLENBQ25CLFlBQVksQ0FBRSxHQUFHLENBQ2pCLGFBQWEsQ0FBRSxHQUFHLENBQ2xCLE1BQU0sQ0FBRSxPQUFPLEFBQ25CLENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNGLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLEdBQUcsQ0FDbkIsZUFBZSxDQUFFLGFBQWEsQ0FDOUIsVUFBVSxDQUFFLElBQUksQ0FDaEIsV0FBVyxDQUFFLEtBQUssQ0FDbEIsR0FBRyxDQUFFLEdBQUcsQUFDWixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDRixLQUFLLENBQUUsT0FBTyxDQUNkLFVBQVUsQ0FBRSxJQUFJLEFBQ3BCLENBQUMifQ== */");
    }

    // (67:8) <Button type={"link"} onClick={ignoreError}>
    function create_default_slot(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Ignore");
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
    		source: "(67:8) <Button type={\\\"link\\\"} onClick={ignoreError}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let div2;
    	let div0;
    	let t0_value = /*obj*/ ctx[0].name + "";
    	let t0;
    	let t1;
    	let button;
    	let t2;
    	let div1;
    	let t3_value = /*obj*/ ctx[0].desc + "";
    	let t3;
    	let div2_class_value;
    	let current;
    	let mounted;
    	let dispose;

    	button = new Button({
    			props: {
    				type: "link",
    				onClick: /*ignoreError*/ ctx[5],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			create_component(button.$$.fragment);
    			t2 = space();
    			div1 = element("div");
    			t3 = text(t3_value);
    			attr_dev(div0, "class", "top text-md-med svelte-1tzy81h");
    			add_location(div0, file$b, 64, 4, 2018);
    			attr_dev(div1, "class", "bot text-sm-reg svelte-1tzy81h");
    			add_location(div1, file$b, 68, 4, 2154);

    			attr_dev(div2, "class", div2_class_value = "" + (null_to_empty(`${/*type*/ ctx[1] == "page" && /*pageID*/ ctx[2] == /*obj*/ ctx[0].id || /*type*/ ctx[1] == "selection" && /*selectionID*/ ctx[3] == /*obj*/ ctx[0].id
			? "container--state-active"
			: "container"}`) + " svelte-1tzy81h"));

    			add_location(div2, file$b, 55, 0, 1783);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			mount_component(button, div0, null);
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
    			if ((!current || dirty & /*obj*/ 1) && t0_value !== (t0_value = /*obj*/ ctx[0].name + "")) set_data_dev(t0, t0_value);
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    			if ((!current || dirty & /*obj*/ 1) && t3_value !== (t3_value = /*obj*/ ctx[0].desc + "")) set_data_dev(t3, t3_value);

    			if (!current || dirty & /*type, pageID, obj, selectionID*/ 15 && div2_class_value !== (div2_class_value = "" + (null_to_empty(`${/*type*/ ctx[1] == "page" && /*pageID*/ ctx[2] == /*obj*/ ctx[0].id || /*type*/ ctx[1] == "selection" && /*selectionID*/ ctx[3] == /*obj*/ ctx[0].id
			? "container--state-active"
			: "container"}`) + " svelte-1tzy81h"))) {
    				attr_dev(div2, "class", div2_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(button);
    			mounted = false;
    			dispose();
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

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Error', slots, []);
    	let { obj } = $$props;
    	let { type } = $$props;

    	// set the current focus ID
    	let pageID;

    	activeFocusPage.subscribe(value => {
    		$$invalidate(2, pageID = value);
    	});

    	let selectionID;

    	activeFocusSelection.subscribe(value => {
    		$$invalidate(3, selectionID = value);
    	});

    	function onClick() {
    		if (type == "page") {
    			activeFocusPage.set(obj.id);
    		} else if (type == "selection") {
    			activeFocusSelection.set(obj.id);
    		}
    	}

    	// move the error into the ignore list
    	function ignoreError() {
    		if (obj.type == "color" && type == "page") {
    			colorPage.update(arr => arr.filter(item => item.id != obj.id));
    			colorIgnorePage.update(arr => [...arr, obj]);
    		} else if (obj.type == "font" && type == "page") {
    			fontPage.update(arr => arr.filter(item => item.id != obj.id));
    			fontIgnorePage.update(arr => [...arr, obj]);
    		} else if (obj.type == "color" && type == "selection") {
    			colorSelection.update(arr => arr.filter(item => item.id != obj.id));
    			colorIgnoreSelection.update(arr => [...arr, obj]);
    		} else if (obj.type == "font" && type == "selection") {
    			fontSelection.update(arr => arr.filter(item => item.id != obj.id));
    			fontIgnoreSelection.update(arr => [...arr, obj]);
    		}
    	}

    	const writable_props = ['obj', 'type'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Error> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('obj' in $$props) $$invalidate(0, obj = $$props.obj);
    		if ('type' in $$props) $$invalidate(1, type = $$props.type);
    	};

    	$$self.$capture_state = () => ({
    		obj,
    		type,
    		Button,
    		activeFocusPage,
    		activeFocusSelection,
    		colorIgnorePage,
    		colorIgnoreSelection,
    		colorPage,
    		colorSelection,
    		fontPage,
    		fontIgnorePage,
    		fontSelection,
    		fontIgnoreSelection,
    		pageID,
    		selectionID,
    		onClick,
    		ignoreError
    	});

    	$$self.$inject_state = $$props => {
    		if ('obj' in $$props) $$invalidate(0, obj = $$props.obj);
    		if ('type' in $$props) $$invalidate(1, type = $$props.type);
    		if ('pageID' in $$props) $$invalidate(2, pageID = $$props.pageID);
    		if ('selectionID' in $$props) $$invalidate(3, selectionID = $$props.selectionID);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [obj, type, pageID, selectionID, onClick, ignoreError];
    }

    class Error$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, { obj: 0, type: 1 }, add_css$b);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Error",
    			options,
    			id: create_fragment$b.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*obj*/ ctx[0] === undefined && !('obj' in props)) {
    			console.warn("<Error> was created without expected prop 'obj'");
    		}

    		if (/*type*/ ctx[1] === undefined && !('type' in props)) {
    			console.warn("<Error> was created without expected prop 'type'");
    		}
    	}

    	get obj() {
    		throw new Error_1("<Error>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set obj(value) {
    		throw new Error_1("<Error>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get type() {
    		throw new Error_1("<Error>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error_1("<Error>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\List\List.svelte generated by Svelte v3.50.0 */

    const { Error: Error_1$1 } = globals;
    const file$c = "src\\components\\List\\List.svelte";

    function add_css$c(target) {
    	append_styles(target, "svelte-1evllcx", ".container.svelte-1evllcx{padding:8px;display:flex;flex-direction:column;gap:8px;align-items:stretch;overflow-y:scroll;height:80vh}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTGlzdC5zdmVsdGUiLCJzb3VyY2VzIjpbIkxpc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XHJcbiAgICBpbXBvcnQgRXJyb3IgZnJvbSBcIi4vRXJyb3Iuc3ZlbHRlXCI7XHJcblxyXG4gICAgZXhwb3J0IGxldCBsaXN0O1xyXG4gICAgZXhwb3J0IGxldCB0eXBlO1xyXG48L3NjcmlwdD5cclxuXHJcbjxkaXYgY2xhc3M9XCJjb250YWluZXJcIj5cclxuICAgIHsjZWFjaCBsaXN0IGFzIGl0ZW19XHJcbiAgICAgICAgPEVycm9yXHJcbiAgICAgICAgICAgIG9iaj17aXRlbX0gICAgXHJcbiAgICAgICAgICAgIHR5cGU9e3R5cGV9XHJcbiAgICAgICAgLz5cclxuICAgIHsvZWFjaH1cclxuPC9kaXY+XHJcblxyXG48c3R5bGU+XHJcbiAgICAuY29udGFpbmVyIHtcclxuICAgICAgICBwYWRkaW5nOiA4cHg7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDogOHB4O1xyXG4gICAgICAgIGFsaWduLWl0ZW1zOiBzdHJldGNoO1xyXG4gICAgICAgIG92ZXJmbG93LXk6IHNjcm9sbDtcclxuICAgICAgICBoZWlnaHQ6IDgwdmg7XHJcbiAgICB9XHJcbjwvc3R5bGU+XHJcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFpQkksVUFBVSxlQUFDLENBQUMsQUFDUixPQUFPLENBQUUsR0FBRyxDQUNaLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLE1BQU0sQ0FDdEIsR0FBRyxDQUFFLEdBQUcsQ0FDUixXQUFXLENBQUUsT0FBTyxDQUNwQixVQUFVLENBQUUsTUFBTSxDQUNsQixNQUFNLENBQUUsSUFBSSxBQUNoQixDQUFDIn0= */");
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (9:4) {#each list as item}
    function create_each_block(ctx) {
    	let error;
    	let current;

    	error = new Error$1({
    			props: {
    				obj: /*item*/ ctx[2],
    				type: /*type*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(error.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(error, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const error_changes = {};
    			if (dirty & /*list*/ 1) error_changes.obj = /*item*/ ctx[2];
    			if (dirty & /*type*/ 2) error_changes.type = /*type*/ ctx[1];
    			error.$set(error_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(error.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(error.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(error, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(9:4) {#each list as item}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let div;
    	let current;
    	let each_value = /*list*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "container svelte-1evllcx");
    			add_location(div, file$c, 7, 0, 110);
    		},
    		l: function claim(nodes) {
    			throw new Error_1$1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*list, type*/ 3) {
    				each_value = /*list*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('List', slots, []);
    	let { list } = $$props;
    	let { type } = $$props;
    	const writable_props = ['list', 'type'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<List> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('list' in $$props) $$invalidate(0, list = $$props.list);
    		if ('type' in $$props) $$invalidate(1, type = $$props.type);
    	};

    	$$self.$capture_state = () => ({ Error: Error$1, list, type });

    	$$self.$inject_state = $$props => {
    		if ('list' in $$props) $$invalidate(0, list = $$props.list);
    		if ('type' in $$props) $$invalidate(1, type = $$props.type);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [list, type];
    }

    class List extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, { list: 0, type: 1 }, add_css$c);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "List",
    			options,
    			id: create_fragment$c.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*list*/ ctx[0] === undefined && !('list' in props)) {
    			console.warn("<List> was created without expected prop 'list'");
    		}

    		if (/*type*/ ctx[1] === undefined && !('type' in props)) {
    			console.warn("<List> was created without expected prop 'type'");
    		}
    	}

    	get list() {
    		throw new Error_1$1("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set list(value) {
    		throw new Error_1$1("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get type() {
    		throw new Error_1$1("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error_1$1("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Lint.svelte generated by Svelte v3.50.0 */

    const { console: console_1 } = globals;

    const file$d = "src\\pages\\Lint.svelte";

    function add_css$d(target) {
    	append_styles(target, "svelte-13ch3y8", ".container.svelte-13ch3y8{justify-content:flex-start;display:flex;flex-direction:column}.body.svelte-13ch3y8{flex-grow:1;display:grid;grid-template-columns:1fr 2fr;z-index:0}.footer.svelte-13ch3y8{border-top:1px solid #d5d5d5;width:100%;display:flex;flex-direction:row;justify-content:flex-end;background-color:white;position:fixed;bottom:0}.footer2.svelte-13ch3y8{display:flex;padding:16px 24px;gap:8px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTGludC5zdmVsdGUiLCJzb3VyY2VzIjpbIkxpbnQuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XHJcbiAgICBpbXBvcnQgTWVudSBmcm9tIFwiLi4vY29tcG9uZW50cy9NZW51L01lbnUuc3ZlbHRlXCI7XHJcbiAgICBpbXBvcnQgTGlzdCBmcm9tIFwiLi4vY29tcG9uZW50cy9MaXN0L0xpc3Quc3ZlbHRlXCI7XHJcbiAgICBpbXBvcnQgQnV0dG9uIGZyb20gXCIuLi9jb21wb25lbnRzL0J1dHRvbi5zdmVsdGVcIjtcclxuXHJcbiAgICBpbXBvcnQge1xyXG4gICAgICAgIGNvbG9yUGFnZSxcclxuICAgICAgICBmb250UGFnZSxcclxuICAgICAgICBjb2xvclNlbGVjdGlvbixcclxuICAgICAgICBmb250U2VsZWN0aW9uLFxyXG4gICAgICAgIGFjdGl2ZU1lbnUsXHJcbiAgICAgICAgYWN0aXZlVGFiLFxyXG4gICAgICAgIGNvbG9ySWdub3JlUGFnZSxcclxuICAgICAgICBmb250SWdub3JlUGFnZSxcclxuICAgICAgICBjb2xvcklnbm9yZVNlbGVjdGlvbixcclxuICAgICAgICBmb250SWdub3JlU2VsZWN0aW9uLFxyXG4gICAgICAgIGFjdGl2ZUZvY3VzU2VsZWN0aW9uLFxyXG4gICAgICAgIGFjdGl2ZUZvY3VzUGFnZSxcclxuICAgIH0gZnJvbSBcIi4uL3N0b3JlXCI7XHJcblxyXG4gICAgZXhwb3J0IGxldCB0eXBlO1xyXG5cclxuICAgIC8vIGxpc3QgdmFyaWFibGVcclxuXHJcbiAgICBsZXQgY29sb3JQYWdlVHJhY2tlcjtcclxuICAgIGNvbG9yUGFnZS5zdWJzY3JpYmUoKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgY29sb3JQYWdlVHJhY2tlciA9IHZhbHVlO1xyXG4gICAgfSk7XHJcblxyXG4gICAgbGV0IGZvbnRQYWdlVHJhY2tlcjtcclxuICAgIGZvbnRQYWdlLnN1YnNjcmliZSgodmFsdWUpID0+IHtcclxuICAgICAgICBmb250UGFnZVRyYWNrZXIgPSB2YWx1ZTtcclxuICAgIH0pO1xyXG5cclxuICAgIGxldCBjb2xvclNlbGVjdGlvblRyYWNrZXI7XHJcbiAgICBjb2xvclNlbGVjdGlvbi5zdWJzY3JpYmUoKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgY29sb3JTZWxlY3Rpb25UcmFja2VyID0gdmFsdWU7XHJcbiAgICB9KTtcclxuXHJcbiAgICBsZXQgZm9udFNlbGVjdGlvblRyYWNrZXI7XHJcbiAgICBmb250U2VsZWN0aW9uLnN1YnNjcmliZSgodmFsdWUpID0+IHtcclxuICAgICAgICBmb250U2VsZWN0aW9uVHJhY2tlciA9IHZhbHVlO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gc2V0IHRoZSBjdXJyZW50IGxpc3RcclxuICAgIGxldCBhY3RpdmU7XHJcbiAgICBhY3RpdmVUYWIuc3Vic2NyaWJlKCh2YWx1ZSkgPT4ge1xyXG4gICAgICAgIGFjdGl2ZSA9IHZhbHVlO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gc2V0IHRyYWNrZXIgZm9yIG1lbnVcclxuICAgIGxldCBtZW51O1xyXG4gICAgYWN0aXZlTWVudS5zdWJzY3JpYmUoKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgbWVudSA9IHZhbHVlO1xyXG4gICAgfSk7XHJcbiAgICAvLyBidXR0b24gb24gY2xpY2sgZXZlbnRzXHJcbiAgICBmdW5jdGlvbiBvblJ1bigpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcInJ1bm5pbmdcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gb25JZ25vcmUoKSB7XHJcbiAgICAgICAgaWYgKGFjdGl2ZSA9PSBcInBhZ2VcIikge1xyXG4gICAgICAgICAgICAkY29sb3JJZ25vcmVQYWdlLmZvckVhY2goKGVsKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZihlbC5pZCA9PSAkYWN0aXZlRm9jdXNQYWdlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYWN0aXZlRm9jdXNQYWdlLnNldCgtMSlcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvbG9yUGFnZS51cGRhdGUoKGFycikgPT4gWy4uLmFyciwgZWxdKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGNvbG9ySWdub3JlUGFnZS5zZXQoW10pO1xyXG4gICAgICAgICAgICAkZm9udElnbm9yZVBhZ2UuZm9yRWFjaCgoZWwpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmKGVsLmlkID09ICRhY3RpdmVGb2N1c1BhZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICBhY3RpdmVGb2N1c1BhZ2Uuc2V0KC0xKVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZm9udFBhZ2UudXBkYXRlKChhcnIpID0+IFsuLi5hcnIsIGVsXSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBmb250SWdub3JlUGFnZS5zZXQoW10pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICRjb2xvcklnbm9yZVNlbGVjdGlvbi5mb3JFYWNoKChlbCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoZWwuaWQgPT0gJGFjdGl2ZUZvY3VzU2VsZWN0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYWN0aXZlRm9jdXNQYWdlLnNldCgtMSlcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvbG9yU2VsZWN0aW9uLnVwZGF0ZSgoYXJyKSA9PiBbLi4uYXJyLCBlbF0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgY29sb3JJZ25vcmVTZWxlY3Rpb24uc2V0KFtdKTtcclxuICAgICAgICAgICAgJGZvbnRJZ25vcmVTZWxlY3Rpb24uZm9yRWFjaCgoZWwpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmKGVsLmlkID09ICRhY3RpdmVGb2N1c1NlbGVjdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGFjdGl2ZUZvY3VzUGFnZS5zZXQoLTEpXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBmb250U2VsZWN0aW9uLnVwZGF0ZSgoYXJyKSA9PiBbLi4uYXJyLCBlbF0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgZm9udElnbm9yZVNlbGVjdGlvbi5zZXQoW10pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuPC9zY3JpcHQ+XHJcblxyXG48ZGl2IGNsYXNzPVwiY29udGFpbmVyXCI+XHJcbiAgICB7I2lmIGFjdGl2ZSA9PSBcInBhZ2VcIn1cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiYm9keVwiPlxyXG4gICAgICAgICAgICA8TWVudVxyXG4gICAgICAgICAgICAgICAgY29sb3I9e2NvbG9yUGFnZVRyYWNrZXIubGVuZ3RofVxyXG4gICAgICAgICAgICAgICAgZm9udD17Zm9udFBhZ2VUcmFja2VyLmxlbmd0aH1cclxuICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgPExpc3RcclxuICAgICAgICAgICAgICAgIHt0eXBlfVxyXG4gICAgICAgICAgICAgICAgbGlzdD17bWVudSA9PSBcImNvbG9yXCIgPyBjb2xvclBhZ2VUcmFja2VyIDogZm9udFBhZ2VUcmFja2VyfVxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgezplbHNlIGlmIGFjdGl2ZSA9PSBcInNlbGVjdGlvblwifVxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJib2R5XCI+XHJcbiAgICAgICAgICAgIDxNZW51XHJcbiAgICAgICAgICAgICAgICBjb2xvcj17Y29sb3JTZWxlY3Rpb25UcmFja2VyLmxlbmd0aH1cclxuICAgICAgICAgICAgICAgIGZvbnQ9e2ZvbnRTZWxlY3Rpb25UcmFja2VyLmxlbmd0aH1cclxuICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgPExpc3RcclxuICAgICAgICAgICAgICAgIHt0eXBlfVxyXG4gICAgICAgICAgICAgICAgbGlzdD17bWVudSA9PSBcImNvbG9yXCJcclxuICAgICAgICAgICAgICAgICAgICA/IGNvbG9yU2VsZWN0aW9uVHJhY2tlclxyXG4gICAgICAgICAgICAgICAgICAgIDogZm9udFNlbGVjdGlvblRyYWNrZXJ9XHJcbiAgICAgICAgICAgIC8+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICB7L2lmfVxyXG4gICAgPGRpdiBjbGFzcz1cImZvb3RlclwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmb290ZXIyXCI+XHJcbiAgICAgICAgICAgIDxCdXR0b24gdHlwZT17XCJ0ZXJ0aWFyeVwifSBvbkNsaWNrPXtvbklnbm9yZX0+Q2xlYXIgSWdub3JlPC9CdXR0b24+XHJcbiAgICAgICAgICAgIDxCdXR0b24gdHlwZT17XCJwcmltYXJ5XCJ9IG9uQ2xpY2s9e29uUnVufT5SdW48L0J1dHRvbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgIDwvZGl2PlxyXG48L2Rpdj5cclxuXHJcbjxzdHlsZT5cclxuICAgIC5jb250YWluZXIge1xyXG4gICAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICB9XHJcblxyXG4gICAgLmJvZHkge1xyXG4gICAgICAgIGZsZXgtZ3JvdzogMTtcclxuICAgICAgICBkaXNwbGF5OiBncmlkO1xyXG4gICAgICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogMWZyIDJmcjtcclxuICAgICAgICB6LWluZGV4OiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5mb290ZXIge1xyXG4gICAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCAjZDVkNWQ1O1xyXG4gICAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcclxuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kO1xyXG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6IHdoaXRlO1xyXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcclxuICAgICAgICBib3R0b206IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmZvb3RlcjIge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgcGFkZGluZzogMTZweCAyNHB4O1xyXG4gICAgICAgIGdhcDogOHB4O1xyXG4gICAgfVxyXG48L3N0eWxlPlxyXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBa0lJLFVBQVUsZUFBQyxDQUFDLEFBQ1IsZUFBZSxDQUFFLFVBQVUsQ0FDM0IsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxBQUMxQixDQUFDLEFBRUQsS0FBSyxlQUFDLENBQUMsQUFDSCxTQUFTLENBQUUsQ0FBQyxDQUNaLE9BQU8sQ0FBRSxJQUFJLENBQ2IscUJBQXFCLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FDOUIsT0FBTyxDQUFFLENBQUMsQUFDZCxDQUFDLEFBRUQsT0FBTyxlQUFDLENBQUMsQUFDTCxVQUFVLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQzdCLEtBQUssQ0FBRSxJQUFJLENBQ1gsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsR0FBRyxDQUNuQixlQUFlLENBQUUsUUFBUSxDQUN6QixnQkFBZ0IsQ0FBRSxLQUFLLENBQ3ZCLFFBQVEsQ0FBRSxLQUFLLENBQ2YsTUFBTSxDQUFFLENBQUMsQUFDYixDQUFDLEFBRUQsUUFBUSxlQUFDLENBQUMsQUFDTixPQUFPLENBQUUsSUFBSSxDQUNiLE9BQU8sQ0FBRSxJQUFJLENBQUMsSUFBSSxDQUNsQixHQUFHLENBQUUsR0FBRyxBQUNaLENBQUMifQ== */");
    }

    // (108:36) 
    function create_if_block_1(ctx) {
    	let div;
    	let menu_1;
    	let t;
    	let list;
    	let current;

    	menu_1 = new Menu({
    			props: {
    				color: /*colorSelectionTracker*/ ctx[3].length,
    				font: /*fontSelectionTracker*/ ctx[4].length
    			},
    			$$inline: true
    		});

    	list = new List({
    			props: {
    				type: /*type*/ ctx[0],
    				list: /*menu*/ ctx[6] == "color"
    				? /*colorSelectionTracker*/ ctx[3]
    				: /*fontSelectionTracker*/ ctx[4]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(menu_1.$$.fragment);
    			t = space();
    			create_component(list.$$.fragment);
    			attr_dev(div, "class", "body svelte-13ch3y8");
    			add_location(div, file$d, 108, 8, 3014);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(menu_1, div, null);
    			append_dev(div, t);
    			mount_component(list, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const menu_1_changes = {};
    			if (dirty & /*colorSelectionTracker*/ 8) menu_1_changes.color = /*colorSelectionTracker*/ ctx[3].length;
    			if (dirty & /*fontSelectionTracker*/ 16) menu_1_changes.font = /*fontSelectionTracker*/ ctx[4].length;
    			menu_1.$set(menu_1_changes);
    			const list_changes = {};
    			if (dirty & /*type*/ 1) list_changes.type = /*type*/ ctx[0];

    			if (dirty & /*menu, colorSelectionTracker, fontSelectionTracker*/ 88) list_changes.list = /*menu*/ ctx[6] == "color"
    			? /*colorSelectionTracker*/ ctx[3]
    			: /*fontSelectionTracker*/ ctx[4];

    			list.$set(list_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu_1.$$.fragment, local);
    			transition_in(list.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu_1.$$.fragment, local);
    			transition_out(list.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(menu_1);
    			destroy_component(list);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(108:36) ",
    		ctx
    	});

    	return block;
    }

    // (97:4) {#if active == "page"}
    function create_if_block$1(ctx) {
    	let div;
    	let menu_1;
    	let t;
    	let list;
    	let current;

    	menu_1 = new Menu({
    			props: {
    				color: /*colorPageTracker*/ ctx[1].length,
    				font: /*fontPageTracker*/ ctx[2].length
    			},
    			$$inline: true
    		});

    	list = new List({
    			props: {
    				type: /*type*/ ctx[0],
    				list: /*menu*/ ctx[6] == "color"
    				? /*colorPageTracker*/ ctx[1]
    				: /*fontPageTracker*/ ctx[2]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(menu_1.$$.fragment);
    			t = space();
    			create_component(list.$$.fragment);
    			attr_dev(div, "class", "body svelte-13ch3y8");
    			add_location(div, file$d, 97, 8, 2665);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(menu_1, div, null);
    			append_dev(div, t);
    			mount_component(list, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const menu_1_changes = {};
    			if (dirty & /*colorPageTracker*/ 2) menu_1_changes.color = /*colorPageTracker*/ ctx[1].length;
    			if (dirty & /*fontPageTracker*/ 4) menu_1_changes.font = /*fontPageTracker*/ ctx[2].length;
    			menu_1.$set(menu_1_changes);
    			const list_changes = {};
    			if (dirty & /*type*/ 1) list_changes.type = /*type*/ ctx[0];

    			if (dirty & /*menu, colorPageTracker, fontPageTracker*/ 70) list_changes.list = /*menu*/ ctx[6] == "color"
    			? /*colorPageTracker*/ ctx[1]
    			: /*fontPageTracker*/ ctx[2];

    			list.$set(list_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu_1.$$.fragment, local);
    			transition_in(list.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu_1.$$.fragment, local);
    			transition_out(list.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(menu_1);
    			destroy_component(list);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(97:4) {#if active == \\\"page\\\"}",
    		ctx
    	});

    	return block;
    }

    // (124:12) <Button type={"tertiary"} onClick={onIgnore}>
    function create_default_slot_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Clear Ignore");
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
    		source: "(124:12) <Button type={\\\"tertiary\\\"} onClick={onIgnore}>",
    		ctx
    	});

    	return block;
    }

    // (125:12) <Button type={"primary"} onClick={onRun}>
    function create_default_slot$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Run");
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
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(125:12) <Button type={\\\"primary\\\"} onClick={onRun}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let div2;
    	let current_block_type_index;
    	let if_block;
    	let t0;
    	let div1;
    	let div0;
    	let button0;
    	let t1;
    	let button1;
    	let current;
    	const if_block_creators = [create_if_block$1, create_if_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*active*/ ctx[5] == "page") return 0;
    		if (/*active*/ ctx[5] == "selection") return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	button0 = new Button({
    			props: {
    				type: "tertiary",
    				onClick: /*onIgnore*/ ctx[7],
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button1 = new Button({
    			props: {
    				type: "primary",
    				onClick: onRun,
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			if (if_block) if_block.c();
    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			create_component(button0.$$.fragment);
    			t1 = space();
    			create_component(button1.$$.fragment);
    			attr_dev(div0, "class", "footer2 svelte-13ch3y8");
    			add_location(div0, file$d, 122, 8, 3424);
    			attr_dev(div1, "class", "footer svelte-13ch3y8");
    			add_location(div1, file$d, 121, 4, 3394);
    			attr_dev(div2, "class", "container svelte-13ch3y8");
    			add_location(div2, file$d, 95, 0, 2604);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(div2, null);
    			}

    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			mount_component(button0, div0, null);
    			append_dev(div0, t1);
    			mount_component(button1, div0, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					} else {
    						if_block.p(ctx, dirty);
    					}

    					transition_in(if_block, 1);
    					if_block.m(div2, t0);
    				} else {
    					if_block = null;
    				}
    			}

    			const button0_changes = {};

    			if (dirty & /*$$scope*/ 16384) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const button1_changes = {};

    			if (dirty & /*$$scope*/ 16384) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}

    			destroy_component(button0);
    			destroy_component(button1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function onRun() {
    	console.log("running");
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let $activeFocusSelection;
    	let $fontIgnoreSelection;
    	let $colorIgnoreSelection;
    	let $activeFocusPage;
    	let $fontIgnorePage;
    	let $colorIgnorePage;
    	validate_store(activeFocusSelection, 'activeFocusSelection');
    	component_subscribe($$self, activeFocusSelection, $$value => $$invalidate(8, $activeFocusSelection = $$value));
    	validate_store(fontIgnoreSelection, 'fontIgnoreSelection');
    	component_subscribe($$self, fontIgnoreSelection, $$value => $$invalidate(9, $fontIgnoreSelection = $$value));
    	validate_store(colorIgnoreSelection, 'colorIgnoreSelection');
    	component_subscribe($$self, colorIgnoreSelection, $$value => $$invalidate(10, $colorIgnoreSelection = $$value));
    	validate_store(activeFocusPage, 'activeFocusPage');
    	component_subscribe($$self, activeFocusPage, $$value => $$invalidate(11, $activeFocusPage = $$value));
    	validate_store(fontIgnorePage, 'fontIgnorePage');
    	component_subscribe($$self, fontIgnorePage, $$value => $$invalidate(12, $fontIgnorePage = $$value));
    	validate_store(colorIgnorePage, 'colorIgnorePage');
    	component_subscribe($$self, colorIgnorePage, $$value => $$invalidate(13, $colorIgnorePage = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Lint', slots, []);
    	let { type } = $$props;

    	// list variable
    	let colorPageTracker;

    	colorPage.subscribe(value => {
    		$$invalidate(1, colorPageTracker = value);
    	});

    	let fontPageTracker;

    	fontPage.subscribe(value => {
    		$$invalidate(2, fontPageTracker = value);
    	});

    	let colorSelectionTracker;

    	colorSelection.subscribe(value => {
    		$$invalidate(3, colorSelectionTracker = value);
    	});

    	let fontSelectionTracker;

    	fontSelection.subscribe(value => {
    		$$invalidate(4, fontSelectionTracker = value);
    	});

    	// set the current list
    	let active;

    	activeTab.subscribe(value => {
    		$$invalidate(5, active = value);
    	});

    	// set tracker for menu
    	let menu;

    	activeMenu.subscribe(value => {
    		$$invalidate(6, menu = value);
    	});

    	function onIgnore() {
    		if (active == "page") {
    			$colorIgnorePage.forEach(el => {
    				if (el.id == $activeFocusPage) {
    					activeFocusPage.set(-1);
    				}

    				colorPage.update(arr => [...arr, el]);
    			});

    			colorIgnorePage.set([]);

    			$fontIgnorePage.forEach(el => {
    				if (el.id == $activeFocusPage) {
    					activeFocusPage.set(-1);
    				}

    				fontPage.update(arr => [...arr, el]);
    			});

    			fontIgnorePage.set([]);
    		} else {
    			$colorIgnoreSelection.forEach(el => {
    				if (el.id == $activeFocusSelection) {
    					activeFocusPage.set(-1);
    				}

    				colorSelection.update(arr => [...arr, el]);
    			});

    			colorIgnoreSelection.set([]);

    			$fontIgnoreSelection.forEach(el => {
    				if (el.id == $activeFocusSelection) {
    					activeFocusPage.set(-1);
    				}

    				fontSelection.update(arr => [...arr, el]);
    			});

    			fontIgnoreSelection.set([]);
    		}
    	}

    	const writable_props = ['type'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Lint> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('type' in $$props) $$invalidate(0, type = $$props.type);
    	};

    	$$self.$capture_state = () => ({
    		Menu,
    		List,
    		Button,
    		colorPage,
    		fontPage,
    		colorSelection,
    		fontSelection,
    		activeMenu,
    		activeTab,
    		colorIgnorePage,
    		fontIgnorePage,
    		colorIgnoreSelection,
    		fontIgnoreSelection,
    		activeFocusSelection,
    		activeFocusPage,
    		type,
    		colorPageTracker,
    		fontPageTracker,
    		colorSelectionTracker,
    		fontSelectionTracker,
    		active,
    		menu,
    		onRun,
    		onIgnore,
    		$activeFocusSelection,
    		$fontIgnoreSelection,
    		$colorIgnoreSelection,
    		$activeFocusPage,
    		$fontIgnorePage,
    		$colorIgnorePage
    	});

    	$$self.$inject_state = $$props => {
    		if ('type' in $$props) $$invalidate(0, type = $$props.type);
    		if ('colorPageTracker' in $$props) $$invalidate(1, colorPageTracker = $$props.colorPageTracker);
    		if ('fontPageTracker' in $$props) $$invalidate(2, fontPageTracker = $$props.fontPageTracker);
    		if ('colorSelectionTracker' in $$props) $$invalidate(3, colorSelectionTracker = $$props.colorSelectionTracker);
    		if ('fontSelectionTracker' in $$props) $$invalidate(4, fontSelectionTracker = $$props.fontSelectionTracker);
    		if ('active' in $$props) $$invalidate(5, active = $$props.active);
    		if ('menu' in $$props) $$invalidate(6, menu = $$props.menu);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		type,
    		colorPageTracker,
    		fontPageTracker,
    		colorSelectionTracker,
    		fontSelectionTracker,
    		active,
    		menu,
    		onIgnore
    	];
    }

    class Lint extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, { type: 0 }, add_css$d);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Lint",
    			options,
    			id: create_fragment$d.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*type*/ ctx[0] === undefined && !('type' in props)) {
    			console_1.warn("<Lint> was created without expected prop 'type'");
    		}
    	}

    	get type() {
    		throw new Error("<Lint>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error("<Lint>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Prelint.svelte generated by Svelte v3.50.0 */

    const { console: console_1$1 } = globals;
    const file$e = "src\\pages\\Prelint.svelte";

    function add_css$e(target) {
    	append_styles(target, "svelte-pgnohe", ".container.svelte-pgnohe{justify-content:flex-start;display:flex;flex-direction:column;flex-grow:1}.body.svelte-pgnohe{flex-grow:1;display:flex;flex-direction:column;gap:8px;justify-content:center;padding:32px}.footer.svelte-pgnohe{border-top:1px solid #d5d5d5;width:100%;display:flex;flex-direction:row;background-color:white}.footer2.svelte-pgnohe{display:flex;padding:16px 24px;gap:8px;flex-grow:1}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJlbGludC5zdmVsdGUiLCJzb3VyY2VzIjpbIlByZWxpbnQuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XHJcbiAgICBpbXBvcnQgQnV0dG9uIGZyb20gXCIuLi9jb21wb25lbnRzL0J1dHRvbi5zdmVsdGVcIjtcclxuICAgIGltcG9ydCB7IHJhblBhZ2UsIHJhblNlbGVjdGlvbiB9IGZyb20gXCIuLi9zdG9yZVwiO1xyXG5cclxuICAgIGV4cG9ydCBsZXQgdHlwZTtcclxuICAgIC8vIGJ1dHRvbiBvbiBjbGljayBldmVudHNcclxuICAgIGZ1bmN0aW9uIG9uUnVuKCkge1xyXG4gICAgICAgIGlmKHR5cGUgPT0gJ3BhZ2UnKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2V0XCIpXHJcbiAgICAgICAgICAgIHJhblBhZ2Uuc2V0KHRydWUpXHJcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09ICdzZWxlY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2V0XCIpXHJcbiAgICAgICAgICAgIHJhblNlbGVjdGlvbi5zZXQodHJ1ZSlcclxuICAgICAgICB9XHJcbiAgICB9XHJcbjwvc2NyaXB0PlxyXG5cclxuPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPlxyXG4gICAgPGRpdiBjbGFzcz0nYm9keSc+XHJcbiAgICAgICAgPGRpdiBjbGFzcz0ndGV4dC14bC1tZWQnPlxyXG4gICAgICAgICAgICBURFMgTGludGVyIDIuMFxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxkaXYgY2xhc3M9J3RleHQtbWQtcmVnJz5cclxuICAgICAgICAgICAgT25jZSB5b3UgcHJlc3MgXCJSdW4gTGludFwiLCB0aGUgbGludGVyIHdpbGwgYW5hbHl6ZSB5b3VyIGZpbGVzIHVzaW5nIHByZWRlZmluZWQgcnVsZXMgZnJvbSB0aGUgVHJ1bGlvbyBkZXNpZ24gc3lzdGVtIGFuZCBkaXNwbGF5IGFueSBkZXNpZ24gaXNzdWVzIG9uIHRoZSBzY3JlZW4hXHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICAgIDxkaXYgY2xhc3M9XCJmb290ZXJcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiZm9vdGVyMlwiPlxyXG4gICAgICAgICAgICA8QnV0dG9uIHR5cGU9e1wicHJpbWFyeVwifSBvbkNsaWNrPXtvblJ1bn0+UnVuPC9CdXR0b24+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuPC9kaXY+XHJcblxyXG48c3R5bGU+XHJcbiAgICAuY29udGFpbmVyIHtcclxuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGZsZXgtZ3JvdzogMTtcclxuICAgIH1cclxuXHJcbiAgICAuYm9keSB7XHJcbiAgICAgICAgZmxleC1ncm93OiAxO1xyXG4gICAgICAgIGRpc3BsYXk6ZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDo4cHg7XHJcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgICAgcGFkZGluZzogMzJweDtcclxuICAgIH1cclxuXHJcbiAgICAuZm9vdGVyIHtcclxuICAgICAgICBib3JkZXItdG9wOiAxcHggc29saWQgI2Q1ZDVkNTtcclxuICAgICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XHJcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogd2hpdGU7XHJcbiAgICB9XHJcblxyXG4gICAgLmZvb3RlcjIge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgcGFkZGluZzogMTZweCAyNHB4O1xyXG4gICAgICAgIGdhcDogOHB4O1xyXG4gICAgICAgIGZsZXgtZ3JvdzoxO1xyXG4gICAgfVxyXG5cclxuICAgIC5mbGV4IHtcclxuICAgICAgICBmbGV4LWdyb3c6IDE7XHJcbiAgICB9XHJcbjwvc3R5bGU+XHJcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFrQ0ksVUFBVSxjQUFDLENBQUMsQUFDUixlQUFlLENBQUUsVUFBVSxDQUMzQixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLFNBQVMsQ0FBRSxDQUFDLEFBQ2hCLENBQUMsQUFFRCxLQUFLLGNBQUMsQ0FBQyxBQUNILFNBQVMsQ0FBRSxDQUFDLENBQ1osUUFBUSxJQUFJLENBQ1osY0FBYyxDQUFFLE1BQU0sQ0FDdEIsSUFBSSxHQUFHLENBQ1AsZUFBZSxDQUFFLE1BQU0sQ0FDdkIsT0FBTyxDQUFFLElBQUksQUFDakIsQ0FBQyxBQUVELE9BQU8sY0FBQyxDQUFDLEFBQ0wsVUFBVSxDQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUM3QixLQUFLLENBQUUsSUFBSSxDQUNYLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLEdBQUcsQ0FDbkIsZ0JBQWdCLENBQUUsS0FBSyxBQUMzQixDQUFDLEFBRUQsUUFBUSxjQUFDLENBQUMsQUFDTixPQUFPLENBQUUsSUFBSSxDQUNiLE9BQU8sQ0FBRSxJQUFJLENBQUMsSUFBSSxDQUNsQixHQUFHLENBQUUsR0FBRyxDQUNSLFVBQVUsQ0FBQyxBQUNmLENBQUMifQ== */");
    }

    // (29:12) <Button type={"primary"} onClick={onRun}>
    function create_default_slot$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Run");
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
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(29:12) <Button type={\\\"primary\\\"} onClick={onRun}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$e(ctx) {
    	let div5;
    	let div2;
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let div4;
    	let div3;
    	let button;
    	let current;

    	button = new Button({
    			props: {
    				type: "primary",
    				onClick: /*onRun*/ ctx[0],
    				$$slots: { default: [create_default_slot$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "TDS Linter 2.0";
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "Once you press \"Run Lint\", the linter will analyze your files using predefined rules from the Trulioo design system and display any design issues on the screen!";
    			t3 = space();
    			div4 = element("div");
    			div3 = element("div");
    			create_component(button.$$.fragment);
    			attr_dev(div0, "class", "text-xl-med");
    			add_location(div0, file$e, 19, 8, 491);
    			attr_dev(div1, "class", "text-md-reg");
    			add_location(div1, file$e, 22, 8, 570);
    			attr_dev(div2, "class", "body svelte-pgnohe");
    			add_location(div2, file$e, 18, 4, 463);
    			attr_dev(div3, "class", "footer2 svelte-pgnohe");
    			add_location(div3, file$e, 27, 8, 833);
    			attr_dev(div4, "class", "footer svelte-pgnohe");
    			add_location(div4, file$e, 26, 4, 803);
    			attr_dev(div5, "class", "container svelte-pgnohe");
    			add_location(div5, file$e, 17, 0, 434);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div2);
    			append_dev(div2, div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div5, t3);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			mount_component(button, div3, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			destroy_component(button);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Prelint', slots, []);
    	let { type } = $$props;

    	// button on click events
    	function onRun() {
    		if (type == 'page') {
    			console.log("set");
    			ranPage.set(true);
    		} else if (type == 'selection') {
    			console.log("set");
    			ranSelection.set(true);
    		}
    	}

    	const writable_props = ['type'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Prelint> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('type' in $$props) $$invalidate(1, type = $$props.type);
    	};

    	$$self.$capture_state = () => ({
    		Button,
    		ranPage,
    		ranSelection,
    		type,
    		onRun
    	});

    	$$self.$inject_state = $$props => {
    		if ('type' in $$props) $$invalidate(1, type = $$props.type);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [onRun, type];
    }

    class Prelint extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, { type: 1 }, add_css$e);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Prelint",
    			options,
    			id: create_fragment$e.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*type*/ ctx[1] === undefined && !('type' in props)) {
    			console_1$1.warn("<Prelint> was created without expected prop 'type'");
    		}
    	}

    	get type() {
    		throw new Error("<Prelint>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error("<Prelint>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\PluginUI.svelte generated by Svelte v3.50.0 */

    const { console: console_1$2 } = globals;
    const file$f = "src\\PluginUI.svelte";

    function add_css$f(target) {
    	append_styles(target, "svelte-1lsgnx0", "@import url(\"https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&display=swap\");body{font:12px \"Libre Franklin\", \"cursive\";font-family:\"Libre Franklin\", \"cursive\";text-align:center;margin:0;background-color:white}.text-sm-reg{font:12px \"Libre Franklin\";font-weight:400}.text-sm-med{font:12px \"Libre Franklin\";font-weight:500}.text-md-reg{font:14px \"Libre Franklin\";font-weight:400}.text-md-med{font:14px \"Libre Franklin\";font-weight:500}.text-lg-reg{font:16px \"Libre Franklin\";font-weight:400}.text-lg-med{font:16px \"Libre Franklin\";font-weight:500}.text-lg-semibold{font:16px \"Libre Franklin\";font-weight:600}.text-xl-med{font:18px \"Libre Franklin\";font-weight:500}.container.svelte-1lsgnx0{display:flex;flex-direction:column;height:100%}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGx1Z2luVUkuc3ZlbHRlIiwic291cmNlcyI6WyJQbHVnaW5VSS5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cclxuXHRpbXBvcnQgVGFiYmFyIGZyb20gXCIuL2NvbXBvbmVudHMvVGFiYmFyLnN2ZWx0ZVwiO1xyXG5cdGltcG9ydCBDb25maWd1cmF0aW9uIGZyb20gXCIuL3BhZ2VzL0NvbmZpZ3VyYXRpb24uc3ZlbHRlXCI7XHJcblx0aW1wb3J0IExpbnQgZnJvbSBcIi4vcGFnZXMvTGludC5zdmVsdGVcIjtcclxuXHRpbXBvcnQgUHJlbGludCBmcm9tIFwiLi9wYWdlcy9QcmVsaW50LnN2ZWx0ZVwiO1xyXG5cclxuXHRpbXBvcnQgeyBhY3RpdmVUYWIsIHJhblBhZ2UsIHJhblNlbGVjdGlvbiB9IGZyb20gXCIuL3N0b3JlXCI7XHJcblxyXG5cdC8vIHNldCB0aGUgYWN0aXZlIHRhYlxyXG5cdGxldCBhY3RpdmU7XHJcblx0YWN0aXZlVGFiLnN1YnNjcmliZSgodmFsdWUpID0+IHtcclxuXHRcdGNvbnNvbGUubG9nKGFjdGl2ZSk7XHJcblx0XHRhY3RpdmUgPSB2YWx1ZTtcclxuXHR9KTtcclxuXHJcblx0bGV0IHBhZ2U7XHJcblx0cmFuUGFnZS5zdWJzY3JpYmUoKHZhbHVlKSA9PiB7XHJcblx0XHRjb25zb2xlLmxvZyhhY3RpdmUpO1xyXG5cdFx0cGFnZSA9IHZhbHVlO1xyXG5cdH0pO1xyXG5cdGxldCBzZWxlY3Rpb247XHJcblx0cmFuU2VsZWN0aW9uLnN1YnNjcmliZSgodmFsdWUpID0+IHtcclxuXHRcdGNvbnNvbGUubG9nKGFjdGl2ZSk7XHJcblx0XHRzZWxlY3Rpb24gPSB2YWx1ZTtcclxuXHR9KTtcclxuXHJcblx0ZnVuY3Rpb24gY3JlYXRlU2hhcGVzKCkge1xyXG5cdFx0cGFyZW50LnBvc3RNZXNzYWdlKFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0cGx1Z2luTWVzc2FnZToge1xyXG5cdFx0XHRcdFx0dHlwZTogXCJjcmVhdGUtc2hhcGVzXCIsXHJcblx0XHRcdFx0XHRjb3VudDogY291bnQsXHJcblx0XHRcdFx0XHRzaGFwZTogc2VsZWN0ZWRTaGFwZS52YWx1ZSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHRcIipcIlxyXG5cdFx0KTtcclxuXHR9XHJcbjwvc2NyaXB0PlxyXG5cclxuPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPlxyXG5cdDxUYWJiYXIgLz5cclxuXHR7I2lmIGFjdGl2ZSA9PSBcInBhZ2VcIn1cclxuXHRcdHsjaWYgcGFnZX1cclxuXHRcdFx0PExpbnQgdHlwZT17XCJwYWdlXCJ9IC8+XHJcblx0XHR7OmVsc2V9XHJcblx0XHRcdDxQcmVsaW50IHR5cGU9e1wicGFnZVwifSAvPlxyXG5cdFx0ey9pZn1cclxuXHR7OmVsc2UgaWYgYWN0aXZlID09IFwic2VsZWN0aW9uXCJ9XHJcblx0XHR7I2lmIHNlbGVjdGlvbn1cclxuXHRcdFx0PExpbnQgdHlwZT17XCJzZWxlY3Rpb25cIn0gLz5cclxuXHRcdHs6ZWxzZX1cclxuXHRcdFx0PFByZWxpbnQgdHlwZT17XCJzZWxlY3Rpb25cIn0vPlxyXG5cdFx0ey9pZn1cclxuXHR7OmVsc2UgaWYgYWN0aXZlID09IFwiY29uZmlnXCJ9XHJcblx0XHQ8Q29uZmlndXJhdGlvbiAvPlxyXG5cdHsvaWZ9XHJcbjwvZGl2PlxyXG5cclxuPHN0eWxlIGdsb2JhbD5cclxuXHRAaW1wb3J0IHVybChcImh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzMj9mYW1pbHk9TGlicmUrRnJhbmtsaW46d2dodEA0MDA7NTAwOzYwMDs3MDAmZGlzcGxheT1zd2FwXCIpO1xyXG5cclxuXHQvKiBCb2R5IFN0cnVjdHVyZXMgKi9cclxuXHQ6Z2xvYmFsKGJvZHkpIHtcclxuXHRcdGZvbnQ6IDEycHggXCJMaWJyZSBGcmFua2xpblwiLCBcImN1cnNpdmVcIjtcclxuXHRcdGZvbnQtZmFtaWx5OiBcIkxpYnJlIEZyYW5rbGluXCIsIFwiY3Vyc2l2ZVwiO1xyXG5cdFx0dGV4dC1hbGlnbjogY2VudGVyO1xyXG5cdFx0bWFyZ2luOiAwO1xyXG5cdFx0YmFja2dyb3VuZC1jb2xvcjogd2hpdGU7XHJcblx0fVxyXG5cclxuXHQvKiBUZXh0ICovXHJcblx0Omdsb2JhbCgudGV4dC1zbS1yZWcpIHtcclxuXHRcdGZvbnQ6IDEycHggXCJMaWJyZSBGcmFua2xpblwiO1xyXG5cdFx0Zm9udC13ZWlnaHQ6IDQwMDtcclxuXHR9XHJcblxyXG5cdDpnbG9iYWwoLnRleHQtc20tbWVkKSB7XHJcblx0XHRmb250OiAxMnB4IFwiTGlicmUgRnJhbmtsaW5cIjtcclxuXHRcdGZvbnQtd2VpZ2h0OiA1MDA7XHJcblx0fVxyXG5cclxuXHQ6Z2xvYmFsKC50ZXh0LW1kLXJlZykge1xyXG5cdFx0Zm9udDogMTRweCBcIkxpYnJlIEZyYW5rbGluXCI7XHJcblx0XHRmb250LXdlaWdodDogNDAwO1xyXG5cdH1cclxuXHJcblx0Omdsb2JhbCgudGV4dC1tZC1tZWQpIHtcclxuXHRcdGZvbnQ6IDE0cHggXCJMaWJyZSBGcmFua2xpblwiO1xyXG5cdFx0Zm9udC13ZWlnaHQ6IDUwMDtcclxuXHR9XHJcblxyXG5cdDpnbG9iYWwoLnRleHQtbGctcmVnKSB7XHJcblx0XHRmb250OiAxNnB4IFwiTGlicmUgRnJhbmtsaW5cIjtcclxuXHRcdGZvbnQtd2VpZ2h0OiA0MDA7XHJcblx0fVxyXG5cclxuXHQ6Z2xvYmFsKC50ZXh0LWxnLW1lZCkge1xyXG5cdFx0Zm9udDogMTZweCBcIkxpYnJlIEZyYW5rbGluXCI7XHJcblx0XHRmb250LXdlaWdodDogNTAwO1xyXG5cdH1cclxuXHJcblx0Omdsb2JhbCgudGV4dC1sZy1zZW1pYm9sZCkge1xyXG5cdFx0Zm9udDogMTZweCBcIkxpYnJlIEZyYW5rbGluXCI7XHJcblx0XHRmb250LXdlaWdodDogNjAwO1xyXG5cdH1cclxuXHJcblx0Omdsb2JhbCgudGV4dC14bC1tZWQpIHtcclxuXHRcdGZvbnQ6IDE4cHggXCJMaWJyZSBGcmFua2xpblwiO1xyXG5cdFx0Zm9udC13ZWlnaHQ6IDUwMDtcclxuXHR9XHJcblx0LyogQWRkIGFkZGl0aW9uYWwgZ2xvYmFsIG9yIHNjb3BlZCBzdHlsZXMgaGVyZSAqL1xyXG5cdC5jb250YWluZXIge1xyXG5cdFx0ZGlzcGxheTogZmxleDtcclxuXHRcdGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcblx0XHRoZWlnaHQ6MTAwJTtcclxuXHR9XHJcbjwvc3R5bGU+XHJcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUE0REMsUUFBUSxJQUFJLDJGQUEyRixDQUFDLENBQUMsQUFHakcsSUFBSSxBQUFFLENBQUMsQUFDZCxJQUFJLENBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsU0FBUyxDQUN0QyxXQUFXLENBQUUsZ0JBQWdCLENBQUMsQ0FBQyxTQUFTLENBQ3hDLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLE1BQU0sQ0FBRSxDQUFDLENBQ1QsZ0JBQWdCLENBQUUsS0FBSyxBQUN4QixDQUFDLEFBR08sWUFBWSxBQUFFLENBQUMsQUFDdEIsSUFBSSxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0IsV0FBVyxDQUFFLEdBQUcsQUFDakIsQ0FBQyxBQUVPLFlBQVksQUFBRSxDQUFDLEFBQ3RCLElBQUksQ0FBRSxJQUFJLENBQUMsZ0JBQWdCLENBQzNCLFdBQVcsQ0FBRSxHQUFHLEFBQ2pCLENBQUMsQUFFTyxZQUFZLEFBQUUsQ0FBQyxBQUN0QixJQUFJLENBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUMzQixXQUFXLENBQUUsR0FBRyxBQUNqQixDQUFDLEFBRU8sWUFBWSxBQUFFLENBQUMsQUFDdEIsSUFBSSxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0IsV0FBVyxDQUFFLEdBQUcsQUFDakIsQ0FBQyxBQUVPLFlBQVksQUFBRSxDQUFDLEFBQ3RCLElBQUksQ0FBRSxJQUFJLENBQUMsZ0JBQWdCLENBQzNCLFdBQVcsQ0FBRSxHQUFHLEFBQ2pCLENBQUMsQUFFTyxZQUFZLEFBQUUsQ0FBQyxBQUN0QixJQUFJLENBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUMzQixXQUFXLENBQUUsR0FBRyxBQUNqQixDQUFDLEFBRU8saUJBQWlCLEFBQUUsQ0FBQyxBQUMzQixJQUFJLENBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUMzQixXQUFXLENBQUUsR0FBRyxBQUNqQixDQUFDLEFBRU8sWUFBWSxBQUFFLENBQUMsQUFDdEIsSUFBSSxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0IsV0FBVyxDQUFFLEdBQUcsQUFDakIsQ0FBQyxBQUVELFVBQVUsZUFBQyxDQUFDLEFBQ1gsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxDQUN0QixPQUFPLElBQUksQUFDWixDQUFDIn0= */");
    }

    // (55:30) 
    function create_if_block_4(ctx) {
    	let configuration;
    	let current;
    	configuration = new Configuration({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(configuration.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(configuration, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(configuration.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(configuration.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(configuration, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(55:30) ",
    		ctx
    	});

    	return block;
    }

    // (49:33) 
    function create_if_block_2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_3, create_else_block_1];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*selection*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_2(ctx);

    			if (current_block_type_index !== previous_block_index) {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
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
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(49:33) ",
    		ctx
    	});

    	return block;
    }

    // (43:1) {#if active == "page"}
    function create_if_block$2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$1, create_else_block];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*page*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index !== previous_block_index) {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
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
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(43:1) {#if active == \\\"page\\\"}",
    		ctx
    	});

    	return block;
    }

    // (52:2) {:else}
    function create_else_block_1(ctx) {
    	let prelint;
    	let current;

    	prelint = new Prelint({
    			props: { type: "selection" },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(prelint.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(prelint, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(prelint.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(prelint.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(prelint, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(52:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (50:2) {#if selection}
    function create_if_block_3(ctx) {
    	let lint;
    	let current;

    	lint = new Lint({
    			props: { type: "selection" },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(lint.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(lint, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(lint.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(lint.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(lint, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(50:2) {#if selection}",
    		ctx
    	});

    	return block;
    }

    // (46:2) {:else}
    function create_else_block(ctx) {
    	let prelint;
    	let current;
    	prelint = new Prelint({ props: { type: "page" }, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(prelint.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(prelint, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(prelint.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(prelint.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(prelint, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(46:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (44:2) {#if page}
    function create_if_block_1$1(ctx) {
    	let lint;
    	let current;
    	lint = new Lint({ props: { type: "page" }, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(lint.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(lint, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(lint.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(lint.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(lint, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(44:2) {#if page}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$f(ctx) {
    	let div;
    	let tabbar;
    	let t;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	tabbar = new Tabbar({ $$inline: true });
    	const if_block_creators = [create_if_block$2, create_if_block_2, create_if_block_4];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*active*/ ctx[0] == "page") return 0;
    		if (/*active*/ ctx[0] == "selection") return 1;
    		if (/*active*/ ctx[0] == "config") return 2;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(tabbar.$$.fragment);
    			t = space();
    			if (if_block) if_block.c();
    			attr_dev(div, "class", "container svelte-1lsgnx0");
    			add_location(div, file$f, 40, 0, 810);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(tabbar, div, null);
    			append_dev(div, t);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					} else {
    						if_block.p(ctx, dirty);
    					}

    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tabbar.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tabbar.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(tabbar);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
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

    function instance$f($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PluginUI', slots, []);
    	let active;

    	activeTab.subscribe(value => {
    		console.log(active);
    		$$invalidate(0, active = value);
    	});

    	let page;

    	ranPage.subscribe(value => {
    		console.log(active);
    		$$invalidate(1, page = value);
    	});

    	let selection;

    	ranSelection.subscribe(value => {
    		console.log(active);
    		$$invalidate(2, selection = value);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<PluginUI> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Tabbar,
    		Configuration,
    		Lint,
    		Prelint,
    		activeTab,
    		ranPage,
    		ranSelection,
    		active,
    		page,
    		selection,
    		createShapes
    	});

    	$$self.$inject_state = $$props => {
    		if ('active' in $$props) $$invalidate(0, active = $$props.active);
    		if ('page' in $$props) $$invalidate(1, page = $$props.page);
    		if ('selection' in $$props) $$invalidate(2, selection = $$props.selection);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [active, page, selection];
    }

    class PluginUI extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, {}, add_css$f);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PluginUI",
    			options,
    			id: create_fragment$f.name
    		});
    	}
    }

    const app = new PluginUI({
    	target: document.body,
    });

    return app;

}());
