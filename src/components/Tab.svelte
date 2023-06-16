<script>
    import { activeTab, activeFocusPage, activeFocusSelection } from "../store";
    export let isActive;
    export let name;
    export let id;

    // set current tab
    function onClick() {
        activeTab.set(id)
        activeFocusPage.set(-1)
        activeFocusSelection.set(-1)
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
        margin: 0px 4px;
        padding: 16px 12px 14px 12px;
        display: flex;
        flex-direction: row;
        justify-content: center;
        gap: 8px;
        color: #666666;
        border-bottom: 2px solid #FFFFFF;
        border-radius: 4px 4px 0px 0px;
    }
    .tab:hover {
        color: #004C45;
        cursor: pointer;
        transition: all 500ms;
    }

    .tab--state-active {
        color: #004C45;
        border-bottom: 2px solid #000000;
        border-radius: 4px 4px 0px 0px;
    }
</style>
