<script>
    export let obj;
    export let type;

    import Button from "../Button.svelte";
    import {
        activeFocusPage,
        activeFocusSelection,
        colorIgnorePage,
        colorIgnoreSelection,
        colorPage,
        colorSelection,
        fontPage,
        fontIgnorePage,
        fontSelection,
        fontIgnoreSelection
    } from "../../store";

    // set the current focus ID
    let pageID;
    activeFocusPage.subscribe((value) => {
        pageID = value;
    });

    let selectionID;
    activeFocusSelection.subscribe((value) => {
        selectionID = value;
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
            colorPage.update((arr) => arr.filter((item) => item.id != obj.id));
            colorIgnorePage.update((arr) => [...arr, obj]);
        } else if (obj.type == "font" && type == "page") {
            fontPage.update((arr) => arr.filter((item) => item.id != obj.id));
            fontIgnorePage.update((arr) => [...arr, obj]);
        } else if (obj.type == "color" && type == "selection") {
            colorSelection.update((arr) => arr.filter((item) => item.id != obj.id));
            colorIgnoreSelection.update((arr) => [...arr, obj]);
        } else if (obj.type == "font" && type == "selection") {
            fontSelection.update((arr) => arr.filter((item) => item.id != obj.id));
            fontIgnoreSelection.update((arr) => [...arr, obj]);
        }
    }
</script>

<div
    class={`${
        (type == "page" && pageID == obj.id) ||
        (type == "selection" && selectionID == obj.id)
            ? "container--state-active"
            : "container"
    }`}
    on:click={onClick}
>
    <div class="top text-md-med">
        {obj.name}
        <Button type={"link"} onClick={ignoreError}>Ignore</Button>
    </div>
    <div class="bot text-sm-reg">{obj.desc}</div>
</div>

<style>
    .container {
        padding: 16px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        gap: 8px;
        border-style: solid;
        border-width: 1px;
        border-color: #d5d5d5;
        border-radius: 8px;
        cursor: pointer;
    }

    .container:hover {
        border-color: #808080;
        background-color: #f2f2f2;
    }

    .container--state-active {
        border-color: #128ba6;
        background-color: #f2f2f2;
        padding: 16px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        gap: 8px;
        border-style: solid;
        border-width: 1px;
        border-radius: 8px;
        cursor: pointer;
    }
    .top {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        text-align: left;
        align-items: start;
        gap: 8px;
    }
    .bot {
        color: #6c6c70;
        text-align: left;
    }
</style>
