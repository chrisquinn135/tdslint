<script>
    import { activeFocusPage, activeFocusSelection, activeMenu } from "../../store";
    import Tag from "../Tag.svelte";

    export let isActive;
    export let name;
    export let id;
    export let number;

    // set current menu
    function onClick() {
        activeMenu.set(id);
        activeFocusPage.set(-1);
        activeFocusSelection.set(-1)
    }
</script>

<div
    class={`text-sm-reg ${isActive ? "second--state-active" : "second"}`}
    on:click={onClick}
>   <div class='padding'>
    {name}

</div>
    {#if number > 0} 
        <Tag number={number} />
    {/if}
</div>

<style>
    .padding {
        padding: 2px 0px;
    }
    .second {
        padding: 12px 16px;
        border-radius: 8px;
        color: #666666;
        text-align: left;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .second:hover {
        background-color:#F2F2F2;
        color: #121212;
        cursor: pointer;
        transition: all 100ms;
    }
    .second--state-active {
        padding: 12px 16px;
        border-radius: 8px;
        color: #121212;
        text-align: left;
        display: flex;
        background-color:#E5F0E8;
        justify-content: space-between;
        align-items: center;
    }
</style>
