<script>
    import Radio from "../Radio.svelte";
    import { onMount } from "svelte";
    import { activeOption } from "../../store";

    // set the active option
    let active;
    activeOption.subscribe((value) => {
        active = value;
    });

    export let id;

    let title = "";
    let desc = "";

    onMount(() => {
        if (id == "tds") {
            title = "Trulioo Design System";
            desc = "Stick w/ the tried and true";
        } else if (id == "docv") {
            title = "DocV";
            desc =
                "Enables the usage of SF Pro, Roboto and Viewfinder Passrate";
        } else if (id == "visual") {
            title = "Visual Team";
            desc =
                "Super strict settings that visual team uses to check for framing!";
        }
    });

    function onClick() {
        activeOption.set(id);
    }
</script>

<div class={active == id ? 'container--active' : 'container'} on:click={onClick}>
    <div class="header text-md-med">
        <div>
            {title}
        </div>
        <div><Radio checked={active == id}/></div>
    </div>
    <div>
        {desc}
    </div>
</div>

<style>
    .container {
        padding: 16px 24px;
        border: solid 1px #d2d2d2;
        border-radius: 8px;
        text-align: left;
        display: flex;
        gap: 4px;
        flex-direction: column;
        background-color: white;
    }

    .container:hover {
        background-color: #F2F2F2;
        border-color: #808080;
        cursor: pointer;
    }
    .container--active {
        padding: 16px 24px;
        border: solid 1px #172d2d;
        border-radius: 8px;
        text-align: left;
        display: flex;
        gap: 4px;
        flex-direction: column;
        background-color: #d5ebdb;
        cursor: pointer;
    }

    .header {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }
</style>
