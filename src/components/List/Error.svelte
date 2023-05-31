<script>
    export let title;
    export let id;
    export let is_focus;
    export let desc;

    import Fa from "svelte-fa";
    import { faEllipsis } from "@fortawesome/free-solid-svg-icons";
    import {activeFocus} from '../../store'

    function onClick() {
        console.log("Click")
        activeFocus.set(id);
    }
</script>

<div class={`${id == is_focus ? "container--state-active" : "container"}`} on:click={onClick}>
    <div class="top text-md-med">
        {title}
        <Fa icon={faEllipsis} />
    </div>
    <div class="bot text-sm-reg">{desc}</div>
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
        background-color: #F2F2F2;
    }

    .container--state-active {
        border-color: #128ba6;
        background-color: #F2F2F2;
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
