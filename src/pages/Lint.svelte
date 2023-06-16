<script>
    import Menu from "../components/Menu/Menu.svelte";
    import List from "../components/List/List.svelte";
    import Button from "../components/Button.svelte";

    import {
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
    } from "../store";

    export let type;

    // list variable

    let colorPageTracker;
    colorPage.subscribe((value) => {
        colorPageTracker = value;
    });

    let fontPageTracker;
    fontPage.subscribe((value) => {
        fontPageTracker = value;
    });

    let colorSelectionTracker;
    colorSelection.subscribe((value) => {
        colorSelectionTracker = value;
    });

    let fontSelectionTracker;
    fontSelection.subscribe((value) => {
        fontSelectionTracker = value;
    });

    // set the current list
    let active;
    activeTab.subscribe((value) => {
        active = value;
    });

    // set tracker for menu
    let menu;
    activeMenu.subscribe((value) => {
        menu = value;
    });
    // button on click events
    function onRun() {
        console.log("running");
    }

    function onIgnore() {
        if (active == "page") {
            $colorIgnorePage.forEach((el) => {
                if(el.id == $activeFocusPage) {
                    activeFocusPage.set(-1)
                }
                colorPage.update((arr) => [...arr, el]);
            });
            colorIgnorePage.set([]);
            $fontIgnorePage.forEach((el) => {
                if(el.id == $activeFocusPage) {
                    activeFocusPage.set(-1)
                }
                fontPage.update((arr) => [...arr, el]);
            });
            fontIgnorePage.set([]);
        } else {
            $colorIgnoreSelection.forEach((el) => {
                if(el.id == $activeFocusSelection) {
                    activeFocusPage.set(-1)
                }
                colorSelection.update((arr) => [...arr, el]);
            });
            colorIgnoreSelection.set([]);
            $fontIgnoreSelection.forEach((el) => {
                if(el.id == $activeFocusSelection) {
                    activeFocusPage.set(-1)
                }
                fontSelection.update((arr) => [...arr, el]);
            });
            fontIgnoreSelection.set([]);
        }
    }
</script>

<div class="container">
    {#if active == "page"}
        <div class="body">
            <Menu
                color={colorPageTracker.length}
                font={fontPageTracker.length}
            />
            <List
                {type}
                list={menu == "color" ? colorPageTracker : fontPageTracker}
            />
        </div>
    {:else if active == "selection"}
        <div class="body">
            <Menu
                color={colorSelectionTracker.length}
                font={fontSelectionTracker.length}
            />
            <List
                {type}
                list={menu == "color"
                    ? colorSelectionTracker
                    : fontSelectionTracker}
            />
        </div>
    {/if}
    <div class="footer">
        <div class="footer2">
            <Button type={"tertiary"} onClick={onIgnore}>Clear Ignore</Button>
            <Button type={"primary"} onClick={onRun}>Run</Button>
        </div>
    </div>
</div>

<style>
    .container {
        justify-content: flex-start;
        display: flex;
        flex-direction: column;
    }

    .body {
        flex-grow: 1;
        display: grid;
        grid-template-columns: 1fr 2fr;
        z-index: 0;
    }

    .footer {
        border-top: 1px solid #d5d5d5;
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        background-color: white;
        position: fixed;
        bottom: 0;
    }

    .footer2 {
        display: flex;
        padding: 16px 24px;
        gap: 8px;
    }
</style>
