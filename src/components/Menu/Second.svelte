<script>
    import { activeMenu } from "../../store";
    export let isActive;
    export let name;
    export let id;

    // set current menu
    function onClick() {
        console.log("Click")
        activeMenu.set(id);
    }
</script>

<div
    class={`second text-sm-reg ${isActive ? "second--state-active" : "not"}`}
    on:click={onClick}
>
    {name}
</div>

<style>
    .second {
        padding: 12px 32px;
        color: #121212;
        text-align: left;
    }

    .second--state-active {
        background-color:#E5F0E8;
    }
</style>
