<script>
    import { activeTab } from "../store";
    export let isActive;
    export let name;
    export let id;

    // set current tab
    function onClick() {
        activeTab.set(id)
    }
</script>

<div
    class={`tab text-sm-med ${
        isActive ? "tab--state-active" : "tab"
    }`}
    on:click={onClick}
>
    {name}
</div>

<style>
    .tab {
        padding: 16px;
        display: flex;
        flex-direction: row;
        justify-content: center;
        gap: 8px;
        color: #666666;
    }
    .tab:hover {
        color: #172D2D;
        cursor: pointer;
        transition: all 500ms;
    }

    .tab--state-active {
        color: #172D2D;
    }
</style>
